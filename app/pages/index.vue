<script setup lang="ts">
const { user } = useUserSession()
const { data, pending } = await useFetch('/api/videos')

const search = ref('')

const folders = computed(() => data.value?.folders ?? [])
const videos = computed(() => data.value?.videos ?? [])

const filteredFolders = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return folders.value
  return folders.value.filter(f => f.name.toLowerCase().includes(q))
})
const filteredVideos = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return videos.value
  return videos.value.filter(v => v.name.toLowerCase().includes(q))
})

const featured = computed(() => videos.value[0])

function formatSize(bytes?: number) {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`
}
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden rounded-3xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-yellow-400/15 via-transparent to-fuchsia-500/10 px-6 sm:px-10 py-10 sm:py-14 mb-10">
      <div class="absolute -top-20 -right-20 w-72 h-72 bg-yellow-400/10 rounded-full blur-3xl pointer-events-none" />
      <div class="absolute -bottom-24 -left-16 w-72 h-72 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />

      <div class="relative max-w-2xl">
        <UBadge color="primary" variant="soft" label="STC Members" icon="i-lucide-sparkles" class="mb-4" />
        <h1 class="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          Welcome back<span v-if="user">, <span class="text-yellow-400">{{ user.username }}</span></span>.
        </h1>
        <p class="text-gray-600 dark:text-gray-400 text-base sm:text-lg max-w-xl mb-6">
          Your curated collection of exclusive clips, streams and unreleased content — straight from the community.
        </p>

        <div class="flex flex-col sm:flex-row gap-3 max-w-xl">
          <UInput
            v-model="search"
            placeholder="Search folders and videos…"
            icon="i-lucide-search"
            size="lg"
            class="flex-1"
          />
          <UButton to="/all" color="neutral" variant="subtle" size="lg" icon="i-lucide-list" label="View all" />
        </div>
      </div>
    </section>

    <!-- Loading -->
    <div v-if="pending" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="n in 6" :key="n" class="aspect-video rounded-2xl bg-gray-100 dark:bg-gray-900 animate-pulse" />
    </div>

    <template v-else>
      <!-- Folders -->
      <section v-if="filteredFolders.length" class="mb-12">
        <div class="flex items-center gap-2 mb-4">
          <UIcon name="i-lucide-folder" class="text-yellow-400" />
          <h2 class="text-lg font-semibold">Collections</h2>
          <UBadge color="neutral" variant="subtle" :label="String(filteredFolders.length)" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NuxtLink
            v-for="folder in filteredFolders"
            :key="folder.prefix"
            :to="`/folders/${folder.prefix.replace(/\/$/, '').split('/').map(encodeURIComponent).join('/')}`"
            class="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-5 flex items-center gap-4 transition hover:border-yellow-400/60 hover:-translate-y-0.5"
          >
            <div class="w-12 h-12 rounded-xl bg-yellow-400/15 text-yellow-500 grid place-items-center shrink-0 group-hover:bg-yellow-400/25 transition">
              <UIcon name="i-lucide-folder" class="w-6 h-6" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-semibold truncate group-hover:text-yellow-400 transition">{{ folder.name }}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">{{ folder.prefix }}</p>
            </div>
            <UIcon name="i-lucide-arrow-right" class="text-gray-400 group-hover:text-yellow-400 shrink-0 transition" />
          </NuxtLink>
        </div>
      </section>

      <!-- Featured -->
      <section v-if="featured && !search" class="mb-12">
        <div class="flex items-center gap-2 mb-4">
          <UIcon name="i-lucide-flame" class="text-yellow-400" />
          <h2 class="text-lg font-semibold">Featured</h2>
        </div>
        <NuxtLink
          :to="`/videos/${encodeURIComponent(featured.key)}`"
          class="group block relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 aspect-[16/7]"
        >
          <video
            :src="featured.url"
            class="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition"
            muted
            playsinline
            preload="metadata"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div class="absolute bottom-0 left-0 right-0 p-6 sm:p-8 flex items-end justify-between gap-4">
            <div class="min-w-0">
              <p class="text-xs uppercase tracking-widest text-yellow-400 mb-1">Now showing</p>
              <h3 class="text-white text-2xl sm:text-3xl font-bold truncate">{{ featured.name }}</h3>
            </div>
            <UButton color="primary" icon="i-lucide-play" label="Watch" size="lg" class="shrink-0 shadow-lg" />
          </div>
        </NuxtLink>
      </section>

      <!-- Root videos -->
      <section v-if="filteredVideos.length">
        <div class="flex items-center gap-2 mb-4">
          <UIcon name="i-lucide-film" class="text-gray-400" />
          <h2 class="text-lg font-semibold">Recent</h2>
          <UBadge color="neutral" variant="subtle" :label="String(filteredVideos.length)" />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <NuxtLink
            v-for="video in filteredVideos"
            :key="video.key"
            :to="`/videos/${encodeURIComponent(video.key)}`"
            class="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 transition hover:border-yellow-400/60 hover:-translate-y-0.5"
          >
            <div class="relative aspect-video overflow-hidden bg-black">
              <video
                :src="video.url"
                class="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                muted
                playsinline
                preload="metadata"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <div class="w-14 h-14 rounded-full bg-yellow-400 text-black grid place-items-center shadow-xl">
                  <UIcon name="i-lucide-play" class="w-6 h-6" />
                </div>
              </div>
              <UBadge
                v-if="video.size"
                color="neutral"
                variant="solid"
                :label="formatSize(video.size)"
                class="absolute top-3 right-3 bg-black/60 text-white backdrop-blur"
              />
            </div>
            <div class="p-4">
              <p class="font-semibold truncate group-hover:text-yellow-400 transition">{{ video.name }}</p>
            </div>
          </NuxtLink>
        </div>
      </section>

      <!-- Empty -->
      <div
        v-if="!filteredFolders.length && !filteredVideos.length"
        class="flex flex-col items-center justify-center py-24 text-gray-400 gap-3"
      >
        <UIcon name="i-lucide-video-off" class="w-12 h-12" />
        <p class="text-sm">{{ search ? 'Nothing matches your search.' : 'No videos available yet.' }}</p>
      </div>
    </template>
  </div>
</template>
