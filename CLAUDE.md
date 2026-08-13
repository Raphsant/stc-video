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
- **Folder tree** — `GET /api/admin/folders`: flat list of every folder prefix, feeds the destination pickers (`app/components/FolderPicker.vue`, used by the move modal and the uploader) and the admin panel's folder tree.
- **Access rules** — `GET`/`PUT /api/admin/access` + the `/admin` page (`app/pages/admin.vue`): per-tier time windows and per-folder Alpha/Delta visibility (see Access Control Model).
- **Upload** — the `/upload` page (`app/pages/upload.vue`). **Admin-only** (`requireAdmin`, matched on Discord role ID), stricter than the rest of this list because it writes new objects to the bucket.

**Critical invariant:** an S3 copy resets `LastModified`, which the delta 30-day window reads. The move endpoint preserves the original availability date in `videometas.uploadedAt`, and every access-window check prefers that override over S3 `LastModified` (via `getVideoOverrides` in `server/utils/videoMeta.ts`). Any new endpoint that calls `checkVideoAccess` must do the same.

## Video Upload (browser → S3 direct)

Uploads **must not** pass through Nitro: the site is served through a Cloudflare tunnel that caps request bodies around 100 MB, and sessions run to multiple GB. The browser PUTs each part straight to S3 with a presigned URL; the server only brokers the multipart lifecycle.

```
browser ──presigned PUT per part──> S3        (bytes; bypasses the tunnel entirely)
   └────create/sign/complete────> Nitro       (JSON only; a few hundred bytes)
```

Endpoints, all under `server/api/admin/uploads/` and all `requireAdmin`:

| Route | Does |
| --- | --- |
| `POST create` | Validates prefix + name + size, picks a free key, opens the multipart upload. Returns `{ key, uploadId, partSize, partCount }`. |
| `POST sign` | Presigns up to 100 `UploadPart` URLs (1 h expiry). Pure local crypto — no S3 round-trip. |
| `POST complete` | Assembles the parts, then HeadObject-verifies the size (a mismatch is a `warnings` entry, never a failure). |
| `POST abort` | Discards the upload. Idempotent — a missing upload is a success. |

Client: `app/composables/useVideoUpload.ts`. Part size is a flat 16 MiB (S3 exempts only the *last* part from the 5 MiB floor, so even a small file is a one-part multipart upload and there is a single code path). Parts go 4-at-a-time via `XMLHttpRequest` — `fetch` cannot report upload progress. Each part retries 3× with backoff and **re-signs on every retry**, so URL expiry, clock skew and transient 403s all recover through one path. The queue lives at module scope, so navigating away from `/upload` does not kill a transfer; a `beforeunload` guard catches tab closes.

**No MongoDB write happens.** S3 is the source of truth, the listing endpoints pick the object up on the next request, `uploadedAt` falls back to S3 `LastModified` (correct for a fresh upload), and the thumbnail Lambda fires on `s3:ObjectCreated` — `CompleteMultipartUpload` included.

**Name collisions auto-suffix** ` (2)`, ` (3)` server-side, matching the bucket's existing convention. Same-named files queued together are pre-suffixed client-side too, because an in-flight multipart upload is invisible to `HeadObject`.

### Required bucket configuration (AWS console — not in this repo)

**CORS.** Without `ExposeHeaders: ETag` every part PUT appears to succeed but the browser cannot read the ETag, so `complete` can never assemble the object:

```json
[{ "AllowedHeaders": ["*"], "AllowedMethods": ["PUT"],
   "AllowedOrigins": ["https://<production-domain>", "http://localhost:3000"],
   "ExposeHeaders": ["ETag"], "MaxAgeSeconds": 3000 }]
```

**Lifecycle rule.** A closed tab mid-upload leaves parts that are billable but invisible in every listing. Set `AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 }` on the bucket.

**IAM.** The existing key already has everything the flow needs (verified end-to-end). It does **not** have `s3:ListBucketMultipartUploads`, so orphaned uploads cannot be enumerated with the app's credentials — which is why the lifecycle rule above is the cleanup mechanism rather than a manual sweep.

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
| `logo-dark.png` | The wordmark, 320×132. The only one rendered. |
| `logo.png` | Light-background variant — **unused.** Its "TRADING CLUB" band is near-black on transparency, invisible on the black surface. |
| `icon.png`, `apple-touch-icon.png`, `favicon.ico` | Square mark — the logo's "S" on brand gold. |
| `og-image.png` | 1200×630 social card (members share links in Discord). |

Render the wordmark with `<AppLogo height="h-9" />` — never an `<img>` directly.

**The app is dark-only.** `colorMode` is pinned to `dark` in nuxt.config, so `.dark` is on `<html>` from the first SSR paint and **`dark:` variants are dead weight — don't write them.** There is no light palette and no colour-mode toggle.

**Palette** (`app/assets/css/main.css`, from the STC brand brief):

| Token | Value | Use |
| --- | --- | --- |
| `bg-ink` | `#000` | The page. The *only* background. |
| `bg-card` / `bg-raised` | `#0b0b0b` / `#111` | The two elevations above it |
| `border-hair` | `#1a1a1a` | Every divider and card edge |
| `text-chalk` / `text-ash` | `#f0f0f0` / `#777` | Primary / secondary text |
| `text-gold` + `gold-soft/dark/dim/bg` | `#ea9d13` … | Accent, plus its ramp |

The rule that is easy to break: **#000 is the only page background.** Intermediate greys (`#060606`, `#0d0d0d`) used as section backgrounds read as visible seams. Cards lift off the page with `bg-card` + `border-hair`, never with a lighter page background.

Three things to know before touching the CSS:

- The `yellow` ramp is retinted to the brand gold (`yellow-500` = `#ea9d13`), because `app.config.ts` maps Nuxt UI's primary onto `yellow` and the accent is written as `yellow-*` at ~50 call sites. It lives in **`@theme static`**, not `@theme`: Nuxt UI reads it via `var(--color-yellow-N)` from its own stylesheet, which Tailwind's usage scan never sees — under a plain `@theme` the unreferenced shades get tree-shaken and Nuxt UI falls back to stock Tailwind yellow.
- Nuxt UI's semantic tokens (`--ui-bg`, `--ui-border`, `--ui-text-*`, `--ui-primary`) are repointed at those surfaces in one block. That is what keeps UModal/UInput/UButton on-brand without per-component `ui` overrides. `--ui-text-inverted` must stay dark: gold carries near-black at 7.8:1 and white at only 2.3:1.
- `--color-primary-*` is **not** read by Nuxt UI v4. A block of those existed for months with no effect; don't reintroduce it. Set `--ui-primary` directly.

**Type.** Big Shoulders Display (600–900) for headings and big numbers, Inter (400–700) for everything else, loaded with `<link>` tags in nuxt.config. `h1/h2/h3` default to the display face; use `font-display` for anything else that needs it, and headings are set uppercase with tight tracking. The section rhythm is gold eyebrow → display heading → hairline rule — use `<SectionHeading>` rather than rebuilding it.

**Motion.** `v-reveal` (`app/plugins/reveal.ts`) fades sections in on scroll. It fails open: the element ships visible and the directive *adds* the hidden state on mount, so no-JS, failed hydration and `prefers-reduced-motion` all leave the content readable.

### Video Player Component
`components/VideoPlayer.client.vue` — Vidstack wrapper, must be `.client.vue` because Vidstack touches `window`.

### Shared UI components
The grids are assembled from these — reach for them before writing new card markup:

- **`VideoCard`** — the video tile, used by every grid (`dense` for the home preview rows). Owns the locked-state contract, staff move/delete buttons and the resume bar.
- **`FolderCard`** — the folder tile.
- **`SectionHeading`** — eyebrow / display heading / count / "ver todo" link / hairline rule.
- **`videoPath()` / `folderPath()`** (`app/utils/paths.ts`) — route builders. Keys and prefixes contain spaces, accents and `&` (`Q&A/2026/Mayo 2026/`), so every segment must be encoded the same way in all call sites or links 404 on exactly the folders whose names are most interesting.

### Locked Content UI
When a user lacks access, `VideoCard` renders the thumbnail desaturated and blurred behind a gold lock badge and a "Solo Alpha" / "Exclusivo Alpha" label, and the card is a `<div>`, not a link. The single-video page swaps the player for a full upsell panel. In both cases the server has already withheld the URL — the UI never has one to leak.

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
