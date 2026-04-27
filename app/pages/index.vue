<script setup lang="ts">
const { user } = useUserSession()
const { data: rootData, pending: rootPending } = await useFetch('/api/videos')
const { data: previewData, pending: previewPending } = await useFetch('/api/videos/previews')
const { progressMap } = useVideoProgress()

const search = ref('')

const rootVideos = computed(() => rootData.value?.videos ?? [])
const folders = computed(() => previewData.value?.folders ?? [])

const pending = computed(() => rootPending.value || previewPending.value)

const filteredFolders = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return folders.value
  return folders.value.filter(f => f.name.toLowerCase().includes(q))
})

const filteredRootVideos = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rootVideos.value
  return rootVideos.value.filter(v => v.name.toLowerCase().includes(q))
})

const featured = computed(() => rootVideos.value[0])

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
        <UBadge color="primary" variant="soft" label="Miembros STC" icon="i-lucide-sparkles" class="mb-4" />
        <h1 class="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          Bienvenido de nuevo<span v-if="user">, <span class="text-yellow-400">{{ user.username }}</span></span>.
        </h1>
        <p class="text-gray-600 dark:text-gray-400 text-base sm:text-lg max-w-xl mb-6">
          Tu colección de sesiones de zoom y contenido inédito — directo de STC.
        </p>

        <div class="flex flex-col sm:flex-row gap-3 max-w-xl">
          <UInput
            v-model="search"
            placeholder="Buscar carpetas y videos…"
            icon="i-lucide-search"
            size="lg"
            class="flex-1"
          />
          <UButton to="/all" color="neutral" variant="subtle" size="lg" icon="i-lucide-list" label="Ver todo" />
        </div>
      </div>
    </section>

    <!-- Loading -->
    <div v-if="pending" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="n in 6" :key="n" class="aspect-video rounded-2xl bg-gray-100 dark:bg-gray-900 animate-pulse" />
    </div>

    <template v-else>
      <!-- Featured -->
      <section v-if="featured && !search" class="mb-12">
        <div class="flex items-center gap-2 mb-4">
          <UIcon name="i-lucide-flame" class="text-yellow-400" />
          <h2 class="text-lg font-semibold">Destacado</h2>
        </div>
        <NuxtLink
          :to="`/videos/${encodeURIComponent(featured.key)}`"
          class="group block relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 aspect-[16/7]"
        >
          <img
            :src="featured.thumb"
            class="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition"
            alt=""
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          <div class="absolute bottom-0 left-0 right-0 p-6 sm:p-8 flex items-end justify-between gap-4">
            <div class="min-w-0">
              <p class="text-xs uppercase tracking-widest text-yellow-400 mb-1">En pantalla</p>
              <h3 class="text-white text-2xl sm:text-3xl font-bold truncate">{{ featured.name }}</h3>
            </div>
            <UButton color="primary" icon="i-lucide-play" label="Ver" size="lg" class="shrink-0 shadow-lg" />
          </div>
        </NuxtLink>
      </section>

      <!-- Folders with video previews -->
      <section v-if="filteredFolders.length" class="mb-12 space-y-10">
        <div v-for="folder in filteredFolders" :key="folder.prefix">
          <div class="flex items-center justify-between gap-2 mb-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-folder" class="text-yellow-400" />
              <h2 class="text-lg font-semibold">{{ folder.name }}</h2>
            </div>
            <NuxtLink
              :to="`/folders/${folder.prefix.replace(/\/$/, '').split('/').map(encodeURIComponent).join('/')}`"
              class="text-sm text-gray-500 hover:text-yellow-400 transition flex items-center gap-1"
            >
              Ver todo <UIcon name="i-lucide-arrow-right" class="w-4 h-4" />
            </NuxtLink>
          </div>

          <!-- Video previews row -->
          <div v-if="folder.recentVideos.length" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <NuxtLink
              v-for="video in folder.recentVideos"
              :key="video.key"
              :to="`/videos/${encodeURIComponent(video.key)}`"
              class="group relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 transition hover:border-yellow-400/60 hover:-translate-y-0.5"
            >
              <div class="relative aspect-video overflow-hidden bg-black">
                <img
                  :src="video.thumb"
                  class="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                  alt=""
                />
                <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <div class="w-10 h-10 rounded-full bg-yellow-400 text-black grid place-items-center shadow-xl">
                    <UIcon name="i-lucide-play" class="w-5 h-5" />
                  </div>
                </div>
                <div v-if="progressMap[video.key]" class="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                  <div class="h-full bg-yellow-400" :style="{ width: progressMap[video.key] + '%' }" />
                </div>
              </div>
              <div class="p-2">
                <p class="text-xs font-medium truncate group-hover:text-yellow-400 transition">{{ video.name }}</p>
              </div>
            </NuxtLink>
          </div>

          <!-- Empty folder -->
          <p v-else class="text-sm text-gray-400">Sin videos aún.</p>
        </div>
      </section>

      <!-- Root videos -->
      <section v-if="filteredRootVideos.length">
        <div class="flex items-center gap-2 mb-4">
          <UIcon name="i-lucide-film" class="text-gray-400" />
          <h2 class="text-lg font-semibold">Reciente</h2>
          <UBadge color="neutral" variant="subtle" :label="String(filteredRootVideos.length)" />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <NuxtLink
            v-for="video in filteredRootVideos"
            :key="video.key"
            :to="`/videos/${encodeURIComponent(video.key)}`"
            class="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 transition hover:border-yellow-400/60 hover:-translate-y-0.5"
          >
            <div class="relative aspect-video overflow-hidden bg-black">
              <img
                :src="video.thumb"
                class="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition"
                alt=""
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
              <div v-if="progressMap[video.key]" class="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                <div class="h-full bg-yellow-400" :style="{ width: progressMap[video.key] + '%' }" />
              </div>
            </div>
            <div class="p-4">
              <p class="font-semibold truncate group-hover:text-yellow-400 transition">{{ video.name }}</p>
            </div>
          </NuxtLink>
        </div>
      </section>

      <!-- Empty -->
      <div
        v-if="!filteredFolders.length && !filteredRootVideos.length"
        class="flex flex-col items-center justify-center py-24 text-gray-400 gap-3"
      >
        <UIcon name="i-lucide-video-off" class="w-12 h-12" />
        <p class="text-sm">{{ search ? 'Nada coincide con tu búsqueda.' : 'Aún no hay videos disponibles.' }}</p>
      </div>
    </template>
  </div>
</template>
