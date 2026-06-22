// Maps a server lock reason to a short Spanish badge label for locked cards.
export type LockReason = 'no-group' | 'folder' | 'window'

export function lockLabel(reason?: LockReason | string | null): string {
  switch (reason) {
    case 'folder':
      return 'Exclusivo Alpha'
    case 'window':
      return 'Solo Alpha'
    case 'no-group':
      return 'Membresía requerida'
    default:
      return 'Bloqueado'
  }
}

// Longer message for the locked single-video page.
export function lockMessage(reason?: LockReason | string | null): string {
  switch (reason) {
    case 'folder':
      return 'Este contenido es exclusivo para miembros Alpha.'
    case 'window':
      return 'Tu plan Delta da acceso a los últimos 30 días. Actualiza a Alpha para ver todo el archivo.'
    case 'no-group':
      return 'Tu cuenta no tiene un plan activo. Contacta al equipo de STC para obtener acceso.'
    default:
      return 'No tienes acceso a este video.'
  }
}
