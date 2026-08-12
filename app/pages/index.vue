<script setup lang="ts">
const { user } = useUserSession()
const { data: rootData, pending: rootPending } = await useFetch('/api/videos')
const { data: previewData, pending: previewPending } = await useFetch('/api/videos/previews')
const { progressMap } = useVideoProgress()

// Resolved here, not in the template: `resolveComponent` is a script-scope
// auto-import and is not available to template expressions.
const NuxtLink = resolveComponent('NuxtLink')

const search = ref('')

const rootVideos = computed(() => rootData.value?.videos ?? [])
const folders = computed(() => previewData.value?.folders ?? [])
const pending = computed(() => rootPending.value || previewPending.value)

const tier = computed(() => tierMeta(resolveGroup(user.value?.roles)))

const filteredFolders = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return folders.value
  // Match the folder itself or any of the videos previewed inside it, so a
  // search for a session name doesn't hide the collection that contains it.
  return folders.value
    .map(f => ({ ...f, recentVideos: f.recentVideos.filter(v => v.name.toLowerCase().includes(q)) }))
    .filter(f => f.name.toLowerCase().includes(q) || f.recentVideos.length > 0)
})

const filteredRootVideos = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rootVideos.value
  return rootVideos.value.filter(v => v.name.toLowerCase().includes(q))
})

const featured = computed(() => rootVideos.value[0])

const stats = computed(() => [
  { value: String(folders.value.length), label: 'Colecciones' },
  { value: tier.value.label, label: 'Tu plan' },
  {
    value: resolveGroup(user.value?.roles) === 'delta' ? '30 días' : 'Completo',
    label: 'Archivo',
  },
])
</script>

<template>
  <div>
    <!-- ── Hero ─────────────────────────────────────────────────────────── -->
    <section class="relative mb-16 overflow-hidden rounded-2xl border border-hair bg-gradient-to-b from-gold-bg to-black px-6 py-12 sm:px-10 sm:py-16">
      <div
        class="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-60"
        style="background: radial-gradient(circle, rgba(234,157,19,0.18) 0%, transparent 68%)"
        aria-hidden="true"
      />

      <div class="relative max-w-3xl">
        <p class="stc-eyebrow mb-5">Acceso de miembros</p>

        <h1 class="font-display text-[clamp(2.5rem,8vw,4.75rem)] font-extrabold uppercase leading-[0.9] tracking-tight text-chalk">
          Bienvenido de nuevo<template v-if="user"><br><span class="stc-gold-text">{{ user.username }}</span></template>
        </h1>

        <p class="mt-6 max-w-xl text-base leading-relaxed text-ash sm:text-lg">
          Tu archivo completo de sesiones en vivo, análisis de premarket, revisiones de trades y Q&amp;A —
          directo del equipo de STC.
        </p>

        <div class="mt-8 flex max-w-xl flex-col gap-3 sm:flex-row">
          <UInput
            v-model="search"
            placeholder="Buscar colecciones y videos…"
            icon="i-lucide-search"
            size="xl"
            class="flex-1"
            :ui="{ base: 'bg-card ring-hair focus-visible:ring-gold/60 text-chalk placeholder:text-ash' }"
          />
          <UButton
            to="/all"
            color="primary"
            size="xl"
            icon="i-lucide-layout-grid"
            label="Ver todo"
            class="justify-center font-semibold uppercase tracking-wider"
          />
        </div>

        <!-- Library stats, all derived from what this member can actually see. -->
        <dl class="mt-10 flex flex-wrap gap-x-10 gap-y-5 border-t border-hair pt-7">
          <div v-for="stat in stats" :key="stat.label">
            <dt class="text-[10px] font-semibold uppercase tracking-[0.22em] text-ash">{{ stat.label }}</dt>
            <dd class="mt-1.5 font-display text-3xl font-extrabold uppercase leading-none text-gold">{{ stat.value }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <!-- ── Loading ──────────────────────────────────────────────────────── -->
    <div v-if="pending" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="n in 6" :key="n" class="aspect-video animate-pulse rounded-xl border border-hair bg-card" />
    </div>

    <template v-else>
      <!-- ── Featured ───────────────────────────────────────────────────── -->
      <section v-if="featured && !search" v-reveal class="mb-16">
        <SectionHeading eyebrow="Lo más reciente" title="En pantalla" />

        <component
          :is="featured.locked ? 'div' : NuxtLink"
          :to="featured.locked ? undefined : videoPath(featured.key)"
          class="group relative block aspect-[16/9] overflow-hidden rounded-2xl border border-hair bg-card sm:aspect-[16/7]"
          :class="featured.locked ? 'cursor-default' : 'transition duration-300 hover:border-gold/50'"
        >
          <img
            v-if="featured.thumb"
            :src="featured.thumb"
            class="absolute inset-0 h-full w-full object-cover transition duration-700"
            :class="featured.locked
              ? 'opacity-25 blur-sm saturate-0'
              : 'opacity-70 group-hover:scale-[1.03] group-hover:opacity-100'"
            alt=""
          >
          <div class="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

          <div class="absolute inset-x-0 bottom-0 flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-9">
            <div class="min-w-0">
              <p class="stc-eyebrow mb-3">{{ featured.locked ? lockLabel(featured.lockReason) : 'Destacado' }}</p>
              <h3 class="truncate font-display text-3xl font-extrabold uppercase leading-none tracking-tight text-chalk sm:text-5xl">
                {{ featured.name }}
              </h3>
            </div>

            <UButton
              v-if="featured.locked"
              color="neutral"
              variant="subtle"
              icon="i-lucide-lock"
              :label="lockLabel(featured.lockReason)"
              size="lg"
              class="shrink-0 justify-center font-semibold uppercase tracking-wider"
              disabled
            />
            <UButton
              v-else
              color="primary"
              icon="i-lucide-play"
              label="Reproducir"
              size="lg"
              class="shrink-0 justify-center font-semibold uppercase tracking-wider"
            />
          </div>
        </component>
      </section>

      <!-- ── Collections ────────────────────────────────────────────────── -->
      <section v-for="folder in filteredFolders" :key="folder.prefix" v-reveal class="mb-16">
        <SectionHeading
          eyebrow="Colección"
          :title="folder.name"
          :to="folderPath(folder.prefix)"
        />

        <div v-if="folder.recentVideos.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <VideoCard
            v-for="video in folder.recentVideos"
            :key="video.key"
            :video="video"
            :progress="progressMap[video.key]"
            dense
          />
        </div>
        <p v-else class="text-sm text-ash">Sin videos aún.</p>
      </section>

      <!-- ── Loose videos at the bucket root ────────────────────────────── -->
      <section v-if="filteredRootVideos.length" v-reveal>
        <SectionHeading eyebrow="Sin clasificar" title="Reciente" :count="filteredRootVideos.length" />

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <VideoCard
            v-for="video in filteredRootVideos"
            :key="video.key"
            :video="video"
            :progress="progressMap[video.key]"
          />
        </div>
      </section>

      <!-- ── Empty ──────────────────────────────────────────────────────── -->
      <div
        v-if="!filteredFolders.length && !filteredRootVideos.length"
        class="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-hair py-24"
      >
        <UIcon name="i-lucide-video-off" class="h-10 w-10 text-gold-dark" />
        <p class="text-sm text-ash">
          {{ search ? 'Nada coincide con tu búsqueda.' : 'Aún no hay videos disponibles.' }}
        </p>
      </div>
    </template>
  </div>
</template>
