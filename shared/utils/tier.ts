// Tier resolution shared by the server (access enforcement) and the client
// (profile display) so the role->tier mapping lives in exactly one place.

export type AccessGroup = 'alpha' | 'delta'

// Discord role -> tier. Roles are normalized (lowercased, non-letters stripped)
// before matching so messy variants all collapse to one key:
//   "Alpha", "Alpha.", "alpha"           -> "alpha"
//   "Delta", "Delta.", "delta"           -> "delta"
//   "👨🏻‍💻Admin", "👮🏻‍♂️Mod", "🧠Coach" -> "admin" / "mod" / "coach"
// Staff roles are treated as alpha so moderators are never locked out.
const ALPHA_ROLE_KEYS = new Set(['alpha', 'admin', 'mod', 'coach'])
const DELTA_ROLE_KEYS = new Set(['delta'])

// Staff roles allowed to manage content (rename/move/visibility). A subset of
// the alpha roles: every manager is also alpha, but a plain alpha member is not
// a manager.
const STAFF_ROLE_KEYS = new Set(['admin', 'mod', 'coach'])

// The Discord role ID of "Admin". Deleting a video is matched against this ID
// rather than a name: names are editable in Discord and normalizeRoleKey would
// collapse a renamed role onto the same key, IDs cannot be spoofed that way.
export const ADMIN_ROLE_ID = '714214136506220625'

function normalizeRoleKey(role: string): string {
  return role.toLowerCase().replace(/[^a-z]/g, '')
}

// True when the user holds the Admin role. Takes role IDs, not names — do not
// route these through normalizeRoleKey, which strips digits and would turn
// every ID into an empty string.
export function isAdmin(roleIds: string[] | null | undefined): boolean {
  return !!roleIds?.includes(ADMIN_ROLE_ID)
}

// True when the user holds a staff role and may edit video metadata. Used to
// gate admin endpoints (server) and reveal management UI (client).
export function isContentManager(roles: string[] | null | undefined): boolean {
  if (!roles?.length) return false
  return roles.map(normalizeRoleKey).some(k => STAFF_ROLE_KEYS.has(k))
}

// Resolve a user's tier from their roles. Returns null when the user holds
// neither an alpha nor a delta role (e.g. only @everyone + interest tags).
export function resolveGroup(roles: string[] | null | undefined): AccessGroup | null {
  if (!roles?.length) return null
  const keys = roles.map(normalizeRoleKey)
  if (keys.some(k => ALPHA_ROLE_KEYS.has(k))) return 'alpha'
  if (keys.some(k => DELTA_ROLE_KEYS.has(k))) return 'delta'
  return null
}

// Presentation metadata for a resolved tier — used by the profile UI.
export function tierMeta(group: AccessGroup | null): {
  label: string
  description: string
  color: 'warning' | 'primary' | 'neutral'
  icon: string
} {
  switch (group) {
    case 'alpha':
      return {
        label: 'Alpha',
        description: 'Acceso completo a todo el archivo, sin límite de tiempo.',
        color: 'warning',
        icon: 'i-lucide-crown',
      }
    case 'delta':
      return {
        label: 'Delta',
        description: 'Acceso a los últimos 30 días de contenido.',
        color: 'primary',
        icon: 'i-lucide-clock',
      }
    default:
      return {
        label: 'Sin plan',
        description: 'Tu cuenta no tiene un plan activo. Contacta al equipo de STC.',
        color: 'neutral',
        icon: 'i-lucide-lock',
      }
  }
}
