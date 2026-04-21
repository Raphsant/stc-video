<script setup lang="ts">
useSeoMeta({ title: 'All videos' })

const { data, pending } = await useFetch('/api/videos/all')

const search = ref('')

const filteredGroups = computed(() => {
  const groups = data.value?.groups ?? []
  const q = search.value.trim().toLowerCase()
  if (!q) return groups
  return groups
    .map(g => ({
      ...g,
      videos: g.videos.filter(v => v.name.toLowerCase().includes(q)),
    }))
    .filter(g => g.videos.length > 0 || g.folder.toLowerCase().includes(q))
})

const filteredTotal = computed(() =>
  filteredGroups.value.reduce((n, g) => n + g.videos.length, 0)
)

function formatSize(bytes?: number) {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`
}

function folderLink(folder: string) {
  if (!folder) return '/'
  return '/folders/' + folder.split('/').map(encodeURIComponent).join('/')
}

function folderLabel(folder: string) {
  return folder === '' ? 'Root' : folder
}
</script>

<template>
  <div>
    <!-- Header -->
    <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
      <div>
        <h1 class="text-3xl font-bold tracking-tight mb-2">All videos</h1>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          <span v-if="pending">Loading…</span>
          <span v-else>
            {{ filteredTotal }} of {{ data?.total ?? 0 }} videos
            across {{ filteredGroups.length }} {{ filteredGroups.length === 1 ? 'folder' : 'folders' }}
          </span>
        </p>
      </div>
      <UInput
        v-model="search"
        placeholder="Search all videos…"
        icon="i-lucide-search"
        size="lg"
        class="w-full sm:w-80"
      />
    </header>

    <!-- Loading -->
    <div v-if="pending" class="space-y-10">
      <div v-for="n in 2" :key="n">
        <div class="h-6 w-40 rounded bg-gray-100 dark:bg-gray-900 animate-pulse mb-4" />
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="m in 3" :key="m" class="aspect-video rounded-2xl bg-gray-100 dark:bg-gray-900 animate-pulse" />
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!filteredGroups.length"
      class="flex flex-col items-center justify-center py-24 text-gray-400 gap-3"
    >
      <UIcon name="i-lucide-video-off" class="w-12 h-12" />
      <p class="text-sm">{{ search ? 'Nothing matches your search.' : 'No videos available yet.' }}</p>
    </div>

    <!-- Groups -->
    <template v-else>
      <section v-for="group in filteredGroups" :key="group.folder || 'root'" class="mb-12">
        <div class="flex items-center justify-between gap-4 mb-4">
          <div class="flex items-center gap-2 min-w-0">
            <UIcon
              :name="group.folder ? 'i-lucide-folder' : 'i-lucide-home'"
              class="text-yellow-400 shrink-0"
            />
            <h2 class="text-lg font-semibold truncate">{{ folderLabel(group.folder) }}</h2>
            <UBadge color="neutral" variant="subtle" :label="String(group.videos.length)" />
          </div>
          <NuxtLink
            v-if="group.folder"
            :to="folderLink(group.folder)"
            class="text-sm text-gray-500 dark:text-gray-400 hover:text-yellow-400 transition flex items-center gap-1 shrink-0"
          >
            <span>Open folder</span>
            <UIcon name="i-lucide-arrow-right" class="w-4 h-4" />
          </NuxtLink>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <NuxtLink
            v-for="video in group.videos"
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
    </template>
  </div>
</template>
