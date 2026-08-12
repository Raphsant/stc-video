<script setup lang="ts">
const { user, clear: clearSession } = useUserSession()

useSeoMeta({ title: 'Perfil' })

const tier = computed(() => tierMeta(resolveGroup(user.value?.roles)))

const { data: history } = await useFetch('/api/progress/history')

function videoName(key: string) {
  return key.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? key
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
  <div v-if="user" class="mx-auto max-w-3xl">
    <!-- Identity -->
    <section class="relative mb-14 overflow-hidden rounded-2xl border border-hair bg-gradient-to-b from-gold-bg to-black p-8 sm:p-10">
      <div
        class="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full"
        style="background: radial-gradient(circle, rgba(234,157,19,0.16) 0%, transparent 70%)"
        aria-hidden="true"
      />
      <div class="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <img
          v-if="avatarUrl"
          :src="avatarUrl"
          :alt="user.username"
          class="h-20 w-20 shrink-0 rounded-full ring-1 ring-gold/40"
        >
        <div class="min-w-0">
          <p class="stc-eyebrow mb-3">Miembro</p>
          <h1 class="truncate font-display text-4xl font-extrabold uppercase leading-none tracking-tight text-chalk sm:text-5xl">
            {{ user.username }}
          </h1>
          <p class="mt-3 truncate font-mono text-xs text-ash">{{ user.id }}</p>
        </div>
      </div>
    </section>

    <!-- Plan -->
    <section v-reveal class="mb-14">
      <SectionHeading title="Plan" />
      <div class="flex items-center gap-5 rounded-xl border border-hair bg-card p-5">
        <div class="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-gold-dim bg-gold-bg text-gold">
          <UIcon :name="tier.icon" class="h-5 w-5" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-display text-2xl font-bold uppercase leading-none tracking-tight text-gold">
            {{ tier.label }}
          </p>
          <p class="mt-2 text-sm text-ash">{{ tier.description }}</p>
        </div>
      </div>
    </section>

    <!-- Roles -->
    <section v-reveal class="mb-14">
      <SectionHeading title="Roles" :count="user.roles?.length ?? 0" />
      <div v-if="user.roles?.length" class="flex flex-wrap gap-2">
        <span
          v-for="role in user.roles"
          :key="role"
          class="rounded-md border border-gold-dim bg-gold-bg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold"
        >{{ role }}</span>
      </div>
      <p v-else class="text-sm text-ash">No tienes roles asignados.</p>
    </section>

    <!-- Watch history -->
    <section v-reveal class="mb-14">
      <SectionHeading title="Historial" :count="history?.length ?? 0" />
      <div v-if="history?.length" class="divide-y divide-hair overflow-hidden rounded-xl border border-hair bg-card">
        <NuxtLink
          v-for="item in history"
          :key="item.videoKey"
          :to="videoPath(item.videoKey)"
          class="group flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-raised"
        >
          <span class="flex min-w-0 items-center gap-3">
            <UIcon name="i-lucide-play" class="h-3.5 w-3.5 shrink-0 text-gold-dark transition group-hover:text-gold" />
            <span class="truncate text-sm text-chalk transition group-hover:text-gold">{{ videoName(item.videoKey) }}</span>
          </span>
          <span class="shrink-0 font-mono text-[11px] tracking-wider text-ash">
            {{ formatTimestamp(item.timestamp) }}
          </span>
        </NuxtLink>
      </div>
      <p v-else class="text-sm text-ash">No has visto ningún video todavía.</p>
    </section>

    <div class="flex flex-wrap gap-3">
      <UButton
        to="/"
        variant="outline"
        color="neutral"
        icon="i-lucide-arrow-left"
        label="Volver al inicio"
        class="font-semibold uppercase tracking-wider"
      />
      <UButton
        color="error"
        variant="ghost"
        icon="i-lucide-log-out"
        label="Cerrar sesión"
        class="font-semibold uppercase tracking-wider"
        @click="logout"
      />
    </div>
  </div>
</template>
