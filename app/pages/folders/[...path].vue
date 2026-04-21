<script setup lang="ts">
const route = useRoute()

const segments = computed(() => {
  const raw = route.params.path
  const arr = Array.isArray(raw) ? raw : [raw]
  return arr
    .filter((s): s is string => !!s)
    .map(s => decodeURIComponent(s))
})

const prefix = computed(() => (segments.value.length ? segments.value.join('/') + '/' : ''))
const currentName = computed(() => segments.value[segments.value.length - 1] ?? 'Colecciones')

const { data, pending } = await useFetch('/api/videos', {
  query: { prefix },
  watch: [prefix],
})

useSeoMeta({ title: () => currentName.value })

const folders = computed(() => data.value?.folders ?? [])
const videos = computed(() => data.value?.videos ?? [])

const crumbs = computed(() => {
  const out: { label: string; to: string }[] = [{ label: 'Inicio', to: '/' }]
  let acc = ''
  for (const seg of segments.value) {
    acc = acc ? `${acc}/${encodeURIComponent(seg)}` : encodeURIComponent(seg)
    out.push({ label: seg, to: `/folders/${acc}` })
  }
  return out
})

function formatSize(bytes?: number) {
  if (!bytes) return ''
  const mb = bytes / (1024 * 1024)
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`
}
</script>

<template>
  <div>
    <!-- Breadcrumb -->
    <nav class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mb-6 flex-wrap">
      <template v-for="(c, i) in crumbs" :key="c.to">
        <NuxtLink
          :to="c.to"
          class="hover:text-yellow-400 transition flex items-center gap-1"
        >
          <UIcon v-if="i === 0" name="i-lucide-home" class="w-4 h-4" />
          <span>{{ c.label }}</span>
        </NuxtLink>
        <UIcon v-if="i < crumbs.length - 1" name="i-lucide-chevron-right" class="w-4 h-4 opacity-50" />
      </template>
    </nav>

    <!-- Header -->
    <header class="flex items-start justify-between gap-4 mb-8">
      <div class="min-w-0 flex items-center gap-4">
        <div class="w-14 h-14 rounded-2xl bg-yellow-400/15 text-yellow-500 grid place-items-center shrink-0">
          <UIcon name="i-lucide-folder-open" class="w-7 h-7" />
        </div>
        <div class="min-w-0">
          <h1 class="text-2xl sm:text-3xl font-bold truncate">{{ currentName }}</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ folders.length }} {{ folders.length === 1 ? 'subcarpeta' : 'subcarpetas' }} ·
            {{ videos.length }} {{ videos.length === 1 ? 'video' : 'videos' }}
          </p>
        </div>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="pending" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="n in 6" :key="n" class="aspect-video rounded-2xl bg-gray-100 dark:bg-gray-900 animate-pulse" />
    </div>

    <template v-else>
      <!-- Subfolders -->
      <section v-if="folders.length" class="mb-10">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          Subcarpetas
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <NuxtLink
            v-for="folder in folders"
            :key="folder.prefix"
            :to="`/folders/${folder.prefix.replace(/\/$/, '').split('/').map(encodeURIComponent).join('/')}`"
            class="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-5 flex items-center gap-4 transition hover:border-yellow-400/60 hover:-translate-y-0.5"
          >
            <div class="w-11 h-11 rounded-xl bg-yellow-400/15 text-yellow-500 grid place-items-center shrink-0 group-hover:bg-yellow-400/25 transition">
              <UIcon name="i-lucide-folder" class="w-5 h-5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-semibold truncate group-hover:text-yellow-400 transition">{{ folder.name }}</p>
            </div>
            <UIcon name="i-lucide-arrow-right" class="text-gray-400 group-hover:text-yellow-400 shrink-0 transition" />
          </NuxtLink>
        </div>
      </section>

      <!-- Videos -->
      <section v-if="videos.length">
        <h2 class="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
          Videos
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <NuxtLink
            v-for="video in videos"
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
        v-if="!folders.length && !videos.length"
        class="flex flex-col items-center justify-center py-24 text-gray-400 gap-3"
      >
        <UIcon name="i-lucide-folder-x" class="w-12 h-12" />
        <p class="text-sm">Esta carpeta está vacía.</p>
      </div>
    </template>
  </div>
</template>
