<script setup lang="ts">
const route = useRoute()
const key = decodeURIComponent(route.params.key as string)

const { data: video, error } = await useFetch(`/api/videos/${encodeURIComponent(key)}`)

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Video no encontrado' })
}

useSeoMeta({ title: () => video.value?.name ?? 'Video' })

const parentFolder = computed(() => {
  const i = key.lastIndexOf('/')
  return i === -1 ? '' : key.slice(0, i)
})

const backTo = computed(() =>
  parentFolder.value
    ? '/folders/' + parentFolder.value.split('/').map(encodeURIComponent).join('/')
    : '/'
)
const backLabel = computed(() =>
  parentFolder.value ? parentFolder.value.split('/').pop()! : 'Inicio'
)

function formatBytes(bytes?: number) {
  if (!bytes) return '—'
  const mb = bytes / (1024 * 1024)
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`
}
</script>

<template>
  <div>
    <UButton
      :to="backTo"
      variant="ghost"
      color="neutral"
      icon="i-lucide-arrow-left"
      :label="`Volver a ${backLabel}`"
      class="mb-6 -ml-2"
    />

    <div class="rounded-xl overflow-hidden shadow-lg bg-black mb-6">
      <VideoPlayer :src="video!.url" :title="video!.name" :video-key="key" />
    </div>

    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <h1 class="text-2xl font-bold leading-tight">{{ video!.name }}</h1>
      <UBadge
        color="neutral"
        variant="subtle"
        :label="formatBytes(video!.size)"
        icon="i-lucide-hard-drive"
        class="shrink-0"
      />
    </div>
  </div>
</template>
