<script setup lang="ts">
useSeoMeta({ title: 'Todos los videos' })

const { data, pending } = await useFetch('/api/videos/all')
const { progressMap } = useVideoProgress()

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

// The endpoint returns each folder's 5 most recent videos plus its true
// `count`, so there are two different numbers to report and they must not be
// mixed up: with a search active only the loaded videos can be matched, so it
// counts hits; with no search it reports the real archive size.
const matchCount = computed(() =>
  filteredGroups.value.reduce((n, g) => n + g.videos.length, 0),
)

function folderLabel(folder: string) {
  return folder === '' ? 'Raíz' : folder
}
</script>

<template>
  <div>
    <header class="mb-12">
      <p class="stc-eyebrow mb-4">Archivo completo</p>

      <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div class="min-w-0">
          <h1 class="font-display text-[clamp(2.25rem,6vw,3.75rem)] font-extrabold uppercase leading-[0.9] tracking-tight text-chalk">
            Todos los videos
          </h1>
          <p class="mt-4 text-sm text-ash">
            <span v-if="pending">Cargando…</span>
            <span v-else-if="search">
              <span class="font-semibold text-gold">{{ matchCount }}</span>
              {{ matchCount === 1 ? 'coincidencia' : 'coincidencias' }} en
              {{ filteredGroups.length }} {{ filteredGroups.length === 1 ? 'carpeta' : 'carpetas' }}
            </span>
            <span v-else>
              <span class="font-semibold text-gold">{{ data?.total ?? 0 }}</span>
              videos en {{ filteredGroups.length }}
              {{ filteredGroups.length === 1 ? 'carpeta' : 'carpetas' }} · lo más reciente de cada una
            </span>
          </p>
        </div>

        <UInput
          v-model="search"
          placeholder="Buscar en todo el archivo…"
          icon="i-lucide-search"
          size="xl"
          class="w-full lg:w-96"
          :ui="{ base: 'bg-card ring-hair focus-visible:ring-gold/60 text-chalk placeholder:text-ash' }"
        />
      </div>

      <div class="stc-rule mt-8" />
    </header>

    <!-- Loading -->
    <div v-if="pending" class="space-y-12">
      <div v-for="n in 2" :key="n">
        <div class="mb-6 h-7 w-48 animate-pulse rounded bg-card" />
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="m in 3" :key="m" class="aspect-video animate-pulse rounded-xl border border-hair bg-card" />
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div
      v-else-if="!filteredGroups.length"
      class="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-hair py-24"
    >
      <UIcon name="i-lucide-video-off" class="h-10 w-10 text-gold-dark" />
      <p class="text-sm text-ash">
        {{ search ? 'Nada coincide con tu búsqueda.' : 'Aún no hay videos disponibles.' }}
      </p>
    </div>

    <!-- Groups -->
    <template v-else>
      <section v-for="group in filteredGroups" :key="group.folder || 'root'" v-reveal class="mb-16">
        <SectionHeading
          :title="folderLabel(group.folder)"
          :count="group.count"
          :to="group.folder ? folderPath(group.folder) : undefined"
          link-label="Abrir carpeta"
        />

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <VideoCard
            v-for="video in group.videos"
            :key="video.key"
            :video="video"
            :progress="progressMap[video.key]"
          />
        </div>

        <!-- Only the 5 most recent per folder come down this endpoint. Say so,
             rather than letting the count above look like a rendering bug. -->
        <NuxtLink
          v-if="group.folder && group.count > group.videos.length"
          :to="folderPath(group.folder)"
          class="group mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ash transition hover:text-gold"
        >
          Ver los {{ group.count }} videos de esta carpeta
          <UIcon name="i-lucide-arrow-right" class="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </NuxtLink>
      </section>
    </template>
  </div>
</template>
