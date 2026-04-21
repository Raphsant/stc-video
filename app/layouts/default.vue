<script setup>
const colorMode = useColorMode()

const isDark = computed({
  get: () => colorMode.value === 'dark',
  set: (val) => { colorMode.preference = val ? 'dark' : 'light' }
})

const mobileMenuOpen = ref(false)

const { loggedIn, user, clear: clearSession } = useUserSession()

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
  <div class="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
    <!-- Navbar -->
    <header class="border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 bg-white/80 dark:bg-gray-950/80 backdrop-blur">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <!-- Logo -->
          <NuxtLink to="/" class="flex items-center gap-2 font-bold text-lg tracking-tight">
            <UIcon name="i-lucide-play-circle" class="text-yellow-400 w-7 h-7" />
            <span>STC<span class="text-yellow-400">Video</span></span>
          </NuxtLink>

          <!-- Desktop right side -->
          <div class="hidden sm:flex items-center gap-3">
            <UButton to="/" variant="ghost" color="neutral" icon="i-lucide-home" label="Home" />
            <UButton to="/all" variant="ghost" color="neutral" icon="i-lucide-list" label="All" />
            <UColorModeButton />
            <template v-if="loggedIn">
              <NuxtLink
                to="/me"
                class="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-gray-200 dark:border-gray-800 hover:border-yellow-400/60 transition"
              >
                <img
                  v-if="avatarUrl"
                  :src="avatarUrl"
                  :alt="user?.username"
                  class="w-7 h-7 rounded-full"
                />
                <span class="text-sm font-medium">{{ user?.username }}</span>
              </NuxtLink>
              <UButton variant="ghost" color="neutral" icon="i-lucide-log-out" @click="logout" />
            </template>
            <UButton
              v-else
              to="/auth/discord"
              external
              color="primary"
              icon="i-lucide-log-in"
              label="Login"
            />
          </div>

          <!-- Mobile: toggle + hamburger -->
          <div class="flex sm:hidden items-center gap-2">
            <UColorModeButton />
            <UButton
              variant="ghost"
              color="neutral"
              :icon="mobileMenuOpen ? 'i-lucide-x' : 'i-lucide-menu'"
              @click="mobileMenuOpen = !mobileMenuOpen"
            />
          </div>
        </div>
      </div>

      <!-- Mobile menu -->
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div v-if="mobileMenuOpen" class="sm:hidden border-t border-gray-200 dark:border-gray-800 px-4 py-3 space-y-1">
          <UButton
            to="/"
            variant="ghost"
            color="neutral"
            icon="i-lucide-home"
            label="Home"
            block
            class="justify-start"
            @click="mobileMenuOpen = false"
          />
          <UButton
            to="/all"
            variant="ghost"
            color="neutral"
            icon="i-lucide-list"
            label="All videos"
            block
            class="justify-start"
            @click="mobileMenuOpen = false"
          />
          <UButton
            v-if="loggedIn"
            to="/me"
            variant="ghost"
            color="neutral"
            icon="i-lucide-user"
            :label="`Profile (${user?.username})`"
            block
            class="justify-start"
            @click="mobileMenuOpen = false"
          />
          <UButton
            v-if="loggedIn"
            variant="ghost"
            color="neutral"
            icon="i-lucide-log-out"
            label="Logout"
            block
            class="justify-start"
            @click="() => { mobileMenuOpen = false; logout() }"
          />
          <UButton
            v-else
            to="/auth/discord"
            external
            variant="ghost"
            color="primary"
            icon="i-lucide-log-in"
            label="Login with Discord"
            block
            class="justify-start"
          />
        </div>
      </Transition>
    </header>

    <!-- Page content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <slot />
    </main>
  </div>
</template>
