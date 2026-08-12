<script setup lang="ts">
const route = useRoute()
const mobileMenuOpen = ref(false)

const { loggedIn, user, clear: clearSession } = useUserSession()
const canManage = computed(() => isContentManager(user.value?.roles))

// Empty when signed out: every destination behind it just bounces back to
// /login through the global auth middleware.
const nav = computed(() => loggedIn.value
  ? [
      { to: '/', label: 'Inicio', icon: 'i-lucide-home' },
      { to: '/all', label: 'Todo', icon: 'i-lucide-layout-grid' },
      ...(canManage.value ? [{ to: '/admin', label: 'Admin', icon: 'i-lucide-shield' }] : []),
    ]
  : [])

// `/` would otherwise match every route under startsWith.
function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}

const avatarUrl = computed(() => {
  if (!user.value?.id) return undefined
  const idx = Number(BigInt(user.value.id) % 5n)
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`
})

const tier = computed(() => tierMeta(resolveGroup(user.value?.roles)))

// Close the mobile sheet on navigation — the route changes under it otherwise
// and it stays open over the new page.
watch(() => route.fullPath, () => { mobileMenuOpen.value = false })

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clearSession()
  await navigateTo('/login')
}
</script>

<template>
  <div class="relative min-h-screen bg-ink text-[#d4d4d4]">
    <!-- Ambient gold wash behind the top of every page. Absolute, not fixed, so
         it belongs to the document and scrolls away instead of tinting the fold. -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-[460px] opacity-70"
      style="background: radial-gradient(70% 100% at 50% 0%, rgba(234,157,19,0.11) 0%, rgba(234,157,19,0.03) 42%, transparent 72%)"
      aria-hidden="true"
    />

    <header class="sticky top-0 z-50 border-b border-hair bg-black/85 backdrop-blur-xl">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between gap-4">
          <NuxtLink to="/" class="group flex items-center gap-3" aria-label="Stocks Trading Club — Inicio">
            <AppLogo height="h-9" />
            <span class="hidden border-l border-hair pl-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-ash transition group-hover:text-gold sm:inline">
              Videoteca
            </span>
          </NuxtLink>

          <!-- Desktop nav -->
          <nav class="hidden items-center gap-1 md:flex">
            <NuxtLink
              v-for="item in nav"
              :key="item.to"
              :to="item.to"
              class="relative px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] transition"
              :class="isActive(item.to) ? 'text-gold' : 'text-ash hover:text-chalk'"
            >
              {{ item.label }}
              <span
                class="absolute inset-x-3 -bottom-px h-px bg-gold transition-transform duration-300"
                :class="isActive(item.to) ? 'scale-x-100' : 'scale-x-0'"
              />
            </NuxtLink>
          </nav>

          <div class="hidden items-center gap-3 md:flex">
            <template v-if="loggedIn">
              <NuxtLink
                to="/me"
                class="group flex items-center gap-2.5 rounded-full border border-hair bg-card py-1 pl-1 pr-3.5 transition hover:border-gold/50"
              >
                <img
                  v-if="avatarUrl"
                  :src="avatarUrl"
                  :alt="user?.username"
                  class="h-7 w-7 rounded-full ring-1 ring-hair"
                >
                <span class="flex flex-col leading-none">
                  <span class="text-xs font-medium text-chalk transition group-hover:text-gold">{{ user?.username }}</span>
                  <span class="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-gold-dark">{{ tier.label }}</span>
                </span>
              </NuxtLink>
              <UButton
                variant="ghost"
                color="neutral"
                icon="i-lucide-log-out"
                aria-label="Cerrar sesión"
                @click="logout"
              />
            </template>
            <UButton
              v-else
              to="/auth/discord"
              external
              color="primary"
              icon="i-lucide-log-in"
              label="Iniciar sesión"
              class="font-semibold uppercase tracking-wider"
            />
          </div>

          <UButton
            variant="ghost"
            color="neutral"
            class="md:hidden"
            :icon="mobileMenuOpen ? 'i-lucide-x' : 'i-lucide-menu'"
            :aria-label="mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'"
            @click="mobileMenuOpen = !mobileMenuOpen"
          />
        </div>
      </div>

      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div v-if="mobileMenuOpen" class="border-t border-hair bg-black px-4 py-3 md:hidden">
          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 rounded-lg px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] transition"
            :class="isActive(item.to) ? 'bg-gold-bg text-gold' : 'text-ash hover:bg-card hover:text-chalk'"
          >
            <UIcon :name="item.icon" class="h-4 w-4" />
            {{ item.label }}
          </NuxtLink>

          <div class="my-2 h-px bg-hair" />

          <template v-if="loggedIn">
            <NuxtLink
              to="/me"
              class="flex items-center gap-3 rounded-lg px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-ash transition hover:bg-card hover:text-chalk"
            >
              <img v-if="avatarUrl" :src="avatarUrl" :alt="user?.username" class="h-5 w-5 rounded-full">
              {{ user?.username }}
            </NuxtLink>
            <button
              type="button"
              class="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-ash transition hover:bg-card hover:text-chalk"
              @click="logout"
            >
              <UIcon name="i-lucide-log-out" class="h-4 w-4" />
              Cerrar sesión
            </button>
          </template>
          <UButton
            v-else
            to="/auth/discord"
            external
            color="primary"
            icon="i-lucide-log-in"
            label="Iniciar sesión con Discord"
            block
            class="mt-1 font-semibold uppercase tracking-wider"
          />
        </div>
      </Transition>
    </header>

    <main class="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <slot />
    </main>

    <footer class="relative mt-16 border-t border-hair">
      <div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-10 sm:flex-row sm:px-6 lg:px-8">
        <AppLogo height="h-7" />
        <p class="text-center text-[10px] uppercase tracking-[0.22em] text-ash sm:text-right">
          Videoteca privada para miembros · {{ new Date().getFullYear() }}
        </p>
      </div>
    </footer>
  </div>
</template>
