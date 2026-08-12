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

const { data, pending, refresh } = await useFetch('/api/videos', {
  query: { prefix },
  watch: [prefix],
})
const { progressMap } = useVideoProgress()

// --- Staff-only: move or delete a video straight from the grid ---
const { user } = useUserSession()
const canManage = computed(() => isContentManager(user.value?.roles))
// Deleting is admin-only, a narrower gate than the rest of the staff tools.
// Cosmetic here — the endpoint enforces it.
const canDelete = computed(() => isAdmin(user.value?.roleIds))

const moveOpen = ref(false)
const moveTarget = ref<{ key: string; name: string } | null>(null)
const deleteOpen = ref(false)
const deleteTarget = ref<{ key: string; name: string } | null>(null)

function openMove(video: { key: string; name: string }) {
  moveTarget.value = { key: video.key, name: video.name }
  moveOpen.value = true
}

function openDelete(video: { key: string; name: string }) {
  deleteTarget.value = { key: video.key, name: video.name }
  deleteOpen.value = true
}

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
</script>

<template>
  <div>
    <!-- Breadcrumb -->
    <nav class="mb-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.16em]">
      <template v-for="(c, i) in crumbs" :key="c.to">
        <NuxtLink
          :to="c.to"
          class="flex items-center gap-1.5 transition"
          :class="i === crumbs.length - 1 ? 'text-gold' : 'text-ash hover:text-chalk'"
        >
          <UIcon v-if="i === 0" name="i-lucide-home" class="h-3.5 w-3.5" />
          <span>{{ c.label }}</span>
        </NuxtLink>
        <UIcon
          v-if="i < crumbs.length - 1"
          name="i-lucide-chevron-right"
          class="h-3.5 w-3.5 text-gold-dark"
        />
      </template>
    </nav>

    <!-- Header -->
    <header class="mb-12">
      <p class="stc-eyebrow mb-4">Colección</p>
      <h1 class="font-display text-[clamp(2.25rem,6vw,3.75rem)] font-extrabold uppercase leading-[0.9] tracking-tight text-chalk">
        {{ currentName }}
      </h1>
      <p class="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-ash">
        <span v-if="folders.length">
          {{ folders.length }} {{ folders.length === 1 ? 'subcarpeta' : 'subcarpetas' }}
          <span class="text-gold-dark"> · </span>
        </span>
        {{ videos.length }} {{ videos.length === 1 ? 'video' : 'videos' }}
      </p>
      <div class="stc-rule mt-8" />
    </header>

    <!-- Loading -->
    <div v-if="pending" class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="n in 6" :key="n" class="aspect-video animate-pulse rounded-xl border border-hair bg-card" />
    </div>

    <template v-else>
      <!-- Subfolders -->
      <section v-if="folders.length" v-reveal class="mb-14">
        <SectionHeading title="Subcarpetas" :count="folders.length" />
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FolderCard v-for="folder in folders" :key="folder.prefix" :folder="folder" />
        </div>
      </section>

      <!-- Videos -->
      <section v-if="videos.length" v-reveal>
        <SectionHeading title="Videos" :count="videos.length" />
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <VideoCard
            v-for="video in videos"
            :key="video.key"
            :video="video"
            :progress="progressMap[video.key]"
            :can-move="canManage"
            :can-delete="canDelete"
            @move="openMove(video)"
            @delete="openDelete(video)"
          />
        </div>
      </section>

      <!-- Empty -->
      <div
        v-if="!folders.length && !videos.length"
        class="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-hair py-24"
      >
        <UIcon name="i-lucide-folder-x" class="h-10 w-10 text-gold-dark" />
        <p class="text-sm text-ash">Esta carpeta está vacía.</p>
      </div>
    </template>

    <!-- Staff-only move modal -->
    <MoveVideoModal
      v-if="moveTarget"
      v-model:open="moveOpen"
      :video-key="moveTarget.key"
      :video-name="moveTarget.name"
      @moved="refresh()"
    />

    <!-- Admin-only delete modal -->
    <DeleteVideoModal
      v-if="deleteTarget"
      v-model:open="deleteOpen"
      :video-key="deleteTarget.key"
      :video-name="deleteTarget.name"
      @deleted="refresh()"
    />
  </div>
</template>
