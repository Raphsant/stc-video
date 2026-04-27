<script setup lang="ts">
const { user, clear: clearSession } = useUserSession()

useSeoMeta({ title: 'Perfil' })

const { data: history } = await useFetch('/api/progress/history')

function formatTimestamp(seconds: number) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

function videoName(key: string) {
  return key.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? key
}

function videoLink(key: string) {
  return '/videos/' + key.split('/').map(encodeURIComponent).join('/')
}

const avatarUrl = computed(() => {
  if (!user.value?.id) return undefined
  const idx = Number(BigInt(user.value.id) % 5n)
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`
})

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clearSession()
  await navigateTo('/login')
}
</script>

<template>
  <div v-if="user" class="max-w-2xl mx-auto">
    <div class="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-yellow-400/10 via-transparent to-fuchsia-500/10 p-8 mb-8">
      <div class="flex items-center gap-5">
        <img
          v-if="avatarUrl"
          :src="avatarUrl"
          :alt="user.username"
          class="w-20 h-20 rounded-full ring-2 ring-yellow-400/50"
        />
        <div class="min-w-0">
          <h1 class="text-2xl font-bold truncate">{{ user.username }}</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">{{ user.id }}</p>
        </div>
      </div>
    </div>

    <section class="mb-8">
      <div class="flex items-center gap-2 mb-3">
        <UIcon name="i-lucide-shield-check" class="text-yellow-400" />
        <h2 class="text-lg font-semibold">Roles</h2>
        <UBadge color="neutral" variant="subtle" :label="String(user.roles?.length ?? 0)" />
      </div>
      <div v-if="user.roles?.length" class="flex flex-wrap gap-2">
        <UBadge
          v-for="role in user.roles"
          :key="role"
          color="primary"
          variant="soft"
          :label="role"
          icon="i-lucide-tag"
        />
      </div>
      <p v-else class="text-sm text-gray-500 dark:text-gray-400">
        No tienes roles asignados.
      </p>
    </section>

    <section class="mb-8">
      <div class="flex items-center gap-2 mb-3">
        <UIcon name="i-lucide-history" class="text-yellow-400" />
        <h2 class="text-lg font-semibold">Historial</h2>
        <UBadge color="neutral" variant="subtle" :label="String(history?.length ?? 0)" />
      </div>
      <div v-if="history?.length" class="flex flex-col gap-2">
        <NuxtLink
          v-for="item in history"
          :key="item.videoKey"
          :to="videoLink(item.videoKey)"
          class="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
        >
          <span class="text-sm font-medium truncate mr-4">{{ videoName(item.videoKey) }}</span>
          <UBadge color="neutral" variant="subtle" :label="formatTimestamp(item.timestamp)" icon="i-lucide-clock" class="shrink-0" />
        </NuxtLink>
      </div>
      <p v-else class="text-sm text-gray-500 dark:text-gray-400">
        No has visto ningún video todavía.
      </p>
    </section>

    <div class="flex flex-wrap gap-3">
      <UButton to="/" variant="ghost" color="neutral" icon="i-lucide-arrow-left" label="Volver al inicio" />
      <UButton color="error" variant="soft" icon="i-lucide-log-out" label="Cerrar sesión" @click="logout" />
    </div>
  </div>
</template>
