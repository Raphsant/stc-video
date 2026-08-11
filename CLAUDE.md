# STC Video Platform

A private, member-gated video platform for a trading community. Streams previously-recorded trading sessions (Premarket Analysis, Livetrading, Trade Reviews, Q&A, Sesion de Progreso) to authenticated members with tiered access.

## Stack

### Frontend
- **Nuxt 4** (Vue 3, TypeScript, SSR)
- **Nuxt UI v4** for components
- **Tailwind CSS** for styling
- **Vidstack** for video playback (with `hls.js` for non-Safari browsers)
- **nuxt-auth-utils** for session management

### Backend (Nitro)
- API routes in `server/api/`
- Server utilities in `server/utils/`
- Discord OAuth for authentication
- MongoDB for application data
- AWS S3 + CloudFront for video storage and delivery

### Infrastructure
- **AWS S3** bucket: `stc-video` in `us-east-2` (Ohio)
- **CloudFront** distribution with Origin Access Control (OAC), signed URLs for access control
- **AWS Lambda** (Node.js) for thumbnail generation on upload (FFmpeg via Lambda layer)
- **MongoDB** (Atlas or self-hosted) for video metadata, users, access tiers
- **Netlify** for Nuxt deployment

## Architecture

```
User browser
    ↓
Nuxt 4 (SSR + Nitro API)
    ↓
    ├── MongoDB (videos, users, watch history)
    └── Server-side: generate CloudFront signed URLs
        ↓
        CloudFront (private distribution)
            ↓
            S3 (private bucket, OAC-protected)
```

## S3 Bucket Structure

```
stc-video/
├── premarket/{year}/{Mes año}/                  # Analisis de Premarket
├── Live/Livetrading {year}/{Mes año}/           # Livetrading
├── revisiones/{year}/{Mes año}/                 # Revisiones de Trades
├── Q&A/{year}/{Mes año}/                        # Q&A sessions
├── Sesion de progreso/{year}/{Mes año}/         # Sesion de Progreso
└── otros/{year}/{Mes año}/                      # Outside scheduled hours
```

- Month folders use Spanish names: `Enero 2026`, `Febrero 2026`, etc.
- Filenames follow pattern: `[DD-mmm-YY] Session Name.mp4` (e.g., `[19-may-26] Livetrading.mp4`)
- Duplicate names on same day get suffixed: `(2)`, `(3)`, etc.

## Authentication

- **Discord OAuth2** via `nuxt-auth-utils`
- User's Discord roles are synced to MongoDB on login and mapped to access groups
- Session stored server-side; `discordId` is the canonical user identifier

## Access Control Model

Two-tier system based on Discord roles:

### Group: `alpha`
- Sees all videos, no time limit
- Has access to exclusive folders (TBD, currently none)

### Group: `delta`
- Time-windowed: last 30 days of uploads only
- No access to alpha-exclusive folders
- Should see locked content with upgrade prompts (drives conversion)

Access logic lives in `server/utils/access.ts` (`checkVideoAccess`). The rules themselves are **admin-editable** and stored in the `accessconfigs` MongoDB singleton (key `'global'`), edited from the `/admin` page (staff-only):

```js
{
  key: 'global',
  alphaDaysBack: null,        // days back per tier; null = unlimited
  deltaDaysBack: 30,
  folderRules: [              // only non-default entries stored
    { prefix: 'Live/', alpha: true, delta: false },  // e.g. delta blocked
  ],
}
```

Endpoints load rules once per request via `getAccessRules()` (`server/utils/accessRules.ts`, 30 s in-memory cache per serverless instance; `PUT /api/admin/access` invalidates it) and pass them to `checkVideoAccess`. Hardcoded `DEFAULT_ACCESS_RULES` (alpha unlimited, delta 30 days, no folder rules) apply when no document exists or the DB is unreachable.

Two checks happen on every video request:
1. **Folder restriction** — a key is denied for a group when ANY `folderRules` prefix matching it has that group set to false (nested rules AND together; a child can't re-allow what an ancestor blocks).
2. **Time window** — is the video within the tier's `daysBack` range (measured against `uploadedAt`)?

**Critical:** access is enforced server-side at the signed URL endpoint (`/api/videos/[key]/url`). The list endpoint may show locked content with `locked: true` and `url: null` to enable upsell UI.

## MongoDB Collections

### `videos`
```js
{
  _id: ObjectId,
  s3Key: "Live/Livetrading 2026/Mayo 2026/[19-may-26] Livetrading.mp4",
  name: "Livetrading",
  size: Number,
  uploadedAt: Date,        // used for access window checks
  createdAt: Date,         // parsed from filename for display
  sessionType: "livetrading",
  // future: description, tags, transcript, thumbnailKey, durationSeconds
}
```

Indexes: `{ s3Key: 1 }` (unique), `{ uploadedAt: -1 }`, `{ s3Key: 1, uploadedAt: -1 }`

### `users`
```js
{
  _id: ObjectId,
  discordId: "123456789",
  username: "trader123",
  groups: ["alpha"],       // or ["delta"]
  createdAt: Date,
  lastSeenAt: Date,
}
```

### `videoProgress` (future)
For watch history and resume-from-position feature:
```js
{
  userId: String,          // discordId
  videoKey: String,
  positionSeconds: Number,
  durationSeconds: Number,
  completed: Boolean,
  firstWatchedAt: Date,
  lastWatchedAt: Date,
}
```

## Staff Content Management

Staff roles (admin/mod/coach — `isContentManager` in `shared/utils/tier.ts`) get management UI on the video page and folder grid:

- **Rename** — `PATCH /api/admin/videos/rename`: display-name override stored in `videometas`; the S3 object is never touched.
- **Move** — `POST /api/admin/videos/move` (`{ key, destPrefix }`): moves a video to another S3 folder via copy → verify → re-key MongoDB → delete original (never deletes before the copy is verified; uses multipart copy above S3's 5 GB single-copy limit). The thumbnail moves with it and the Lambda regenerates it anyway.
- **Folder tree** — `GET /api/admin/folders`: flat list of every folder prefix, feeds the move destination picker (`app/components/MoveVideoModal.vue`) and the admin panel's folder tree.
- **Access rules** — `GET`/`PUT /api/admin/access` + the `/admin` page (`app/pages/admin.vue`): per-tier time windows and per-folder Alpha/Delta visibility (see Access Control Model).

**Critical invariant:** an S3 copy resets `LastModified`, which the delta 30-day window reads. The move endpoint preserves the original availability date in `videometas.uploadedAt`, and every access-window check prefers that override over S3 `LastModified` (via `getVideoOverrides` in `server/utils/videoMeta.ts`). Any new endpoint that calls `checkVideoAccess` must do the same.

## Signed URL Flow

1. User requests `/api/videos/[key]/url`
2. Server checks: session valid → user has access (folder + time rules) → video exists
3. Server generates CloudFront signed URL (1 hour expiry)
4. Frontend uses URL with Vidstack player

CloudFront key pair:
- Public key uploaded to CloudFront → Key Group attached to distribution
- Private key stored in `CLOUDFRONT_PRIVATE_KEY` env var on Netlify (or `.pem` file locally)
- `CLOUDFRONT_KEY_PAIR_ID` env var holds the Key Pair ID

## Environment Variables

```
# Nuxt runtime
AWS_REGION=us-east-2
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=stc-video
CLOUDFRONT_DOMAIN=xxxxxx.cloudfront.net
CLOUDFRONT_KEY_PAIR_ID=K2JCJMDEHXQW5F
CLOUDFRONT_PRIVATE_KEY=...     # production (multi-line)
CLOUDFRONT_PRIVATE_KEY_PATH=./private_key.pem   # local dev only

# Discord OAuth (nuxt-auth-utils)
NUXT_OAUTH_DISCORD_CLIENT_ID=...
NUXT_OAUTH_DISCORD_CLIENT_SECRET=...
NUXT_SESSION_PASSWORD=...      # random 32+ char string

# MongoDB
MONGODB_URI=mongodb+srv://...
MONGODB_DB=stc-video
```

## Lambda: Thumbnail Generator

- Triggered by `s3:ObjectCreated:*` events on the `stc-video` bucket
- Region: `us-east-2` (must match bucket region)
- Runtime: Node.js
- Uses FFmpeg from a public Lambda layer
- Downloads video to `/tmp`, extracts a frame at ~5s mark, uploads as `[original-key].jpg` next to the video
- Requires `s3:GetObject`, `s3:PutObject`, `s3:ListBucket` on the bucket
- Memory: 3008 MB, Timeout: 15 min, Ephemeral storage: 4096 MB

## Frontend Conventions

### Pages
- `/` — home grid showing folders + recent videos
- `/folders/[...path]` — folder browser (handles nested structure)
- `/videos/[key]` — single video player page

### Branding
The Stocks Trading Club wordmark. Assets live in `public/`:

| File | Use |
| --- | --- |
| `logo.png` / `logo-dark.png` | Wordmark, 320×132. **Two files:** "TRADING CLUB" sits on transparency in near-black, so the dark variant recolors that band white. The orange banner is identical in both. |
| `icon.png`, `apple-touch-icon.png`, `favicon.ico` | Square mark — the logo's "S" on brand orange. |
| `og-image.png` | 1200×630 social card (members share links in Discord). |

Render the wordmark with `<AppLogo height="h-9" />` — never an `<img>` directly. It swaps the two files with `dark:hidden` / `hidden dark:block` rather than `useColorMode()`, so the right one is correct on first paint.

**Palette.** Brand orange is `#e99c13`. `app.config.ts` maps Nuxt UI's primary onto `yellow`, and the accent is written as `yellow-*` at ~50 call sites, so `app/assets/css/main.css` retints the whole `yellow` ramp to a constant-hue (38.5°) amber with the logo orange at `yellow-500`. Two things to know before touching it:

- The ramp lives in **`@theme static`**, not `@theme`. Nuxt UI reads it via `var(--color-yellow-N)` from its own stylesheet, which Tailwind's usage scan never sees — under a plain `@theme` the unreferenced shades get tree-shaken and Nuxt UI falls back to stock Tailwind yellow.
- `--color-primary-*` is **not** read by Nuxt UI v4 (it resolves `--ui-primary` from the `yellow` ramp). A block of those existed for months with no effect; don't reintroduce it. To adjust the primary, set `--ui-primary` directly — which is what light mode does, stepping down to `#ad640b` because solid buttons put white on it there and the logo orange is only 2.3:1 against white (dark mode uses the logo orange as-is — its text is near-black there, 7.8:1).

### Video Player Component
`components/VideoPlayer.client.vue` — Vidstack wrapper, must be `.client.vue` because Vidstack touches `window`.

### Locked Content UI
When user lacks access, video cards show with `opacity-60`, a lock icon overlay, and a "Solo Alpha" / "Exclusivo Alpha" label. Click-through is disabled.

### Localization
UI text is in Spanish. Session types and folder names are in Spanish. Dates display in Spanish format.

## Future Features (Not Yet Built)

- **Watch history + resume playback** — periodic `timeupdate` events save position to MongoDB
- **AI-generated descriptions** — local Whisper transcription + Claude Haiku for summaries
- **Forensic watermarking** — overlay viewer's Discord username on the video for leak deterrence
- **Admin UI** — manage user groups, folder restrictions, video metadata
- **Stripe integration** — automatic group assignment based on subscription tier

## Conventions for Claude

- Spanish for all user-facing strings
- Folder structure in S3 must follow the documented pattern exactly (path lookups depend on it)
- Always check access at the signed URL endpoint, never trust the list endpoint to filter alone
- Use `uploadedAt` (not `createdAt`) for access window checks — it represents when content became available
- Time-related comparisons should account for CST when relevant (the recording schedule is in CST)
- New session types require updates to: `SessionTypes` config in upload tooling, S3 folder structure, MongoDB `videos` documents
