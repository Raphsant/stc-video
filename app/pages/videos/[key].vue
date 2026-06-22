<script setup lang="ts">
const route = useRoute()
const key = decodeURIComponent(route.params.key as string)

interface VideoResponse {
  key: string
  name: string
  size?: number
  thumb: string
  url: string | null
  locked: boolean
  lockReason: LockReason | null
}

// Explicit type: the dynamic URL otherwise resolves to a union of every
// /api/videos/* endpoint under Nuxt typed routes.
const { data: video, error, refresh } = await useFetch<VideoResponse>(`/api/videos/${encodeURIComponent(key)}`)

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Video no encontrado' })
}

// --- Staff-only rename (display-name override; S3 is never touched) ---
const { user } = useUserSession()
const canManage = computed(() => isContentManager(user.value?.roles))

const toast = useToast()
const renameOpen = ref(false)
const newName = ref('')
const saving = ref(false)

function openRename() {
  newName.value = video.value?.name ?? ''
  renameOpen.value = true
}

async function submitRename(name: string) {
  saving.value = true
  try {
    await $fetch('/api/admin/videos/rename', {
      method: 'PATCH',
      body: { key, name },
    })
    await refresh()
    renameOpen.value = false
    toast.add({ title: 'Nombre actualizado', color: 'success', icon: 'i-lucide-check' })
  } catch (err: any) {
    toast.add({
      title: 'No se pudo cambiar el nombre',
      description: err?.data?.message ?? 'Inténtalo de nuevo',
      color: 'error',
      icon: 'i-lucide-alert-triangle',
    })
  } finally {
    saving.value = false
  }
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

    <!-- Locked: show upsell instead of the player -->
    <div
      v-if="video!.locked"
      class="relative rounded-xl overflow-hidden shadow-lg bg-black mb-6 aspect-video"
    >
      <img
        v-if="video!.thumb"
        :src="video!.thumb"
        class="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm"
        alt=""
      />
      <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/60 to-black/40" />
      <div class="absolute inset-0 flex flex-col items-center justify-center text-center gap-4 px-6">
        <div class="w-14 h-14 rounded-full bg-yellow-400/15 text-yellow-400 grid place-items-center ring-1 ring-yellow-400/40">
          <UIcon name="i-lucide-lock" class="w-7 h-7" />
        </div>
        <div>
          <p class="text-yellow-400 text-sm font-semibold uppercase tracking-widest mb-1">
            {{ lockLabel(video!.lockReason) }}
          </p>
          <p class="text-white/80 max-w-md text-sm">{{ lockMessage(video!.lockReason) }}</p>
        </div>
      </div>
    </div>

    <div v-else class="rounded-xl overflow-hidden shadow-lg bg-black mb-6">
      <VideoPlayer :src="video!.url ?? undefined" :title="video!.name" :video-key="key" />
    </div>

    <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div class="flex items-start gap-2 min-w-0">
        <h1 class="text-2xl font-bold leading-tight">{{ video!.name }}</h1>
        <UButton
          v-if="canManage"
          icon="i-lucide-pencil"
          color="neutral"
          variant="ghost"
          size="sm"
          class="shrink-0 mt-0.5"
          aria-label="Renombrar video"
          @click="openRename"
        />
      </div>
      <UBadge
        color="neutral"
        variant="subtle"
        :label="formatBytes(video!.size)"
        icon="i-lucide-hard-drive"
        class="shrink-0"
      />
    </div>

    <!-- Staff-only rename modal -->
    <UModal v-model:open="renameOpen" title="Renombrar video">
      <template #body>
        <div class="space-y-4">
          <UFormField
            label="Nombre"
            help="Solo cambia cómo se muestra el video. El archivo en S3 no se mueve."
          >
            <UInput
              v-model="newName"
              placeholder="Nombre del video"
              autofocus
              class="w-full"
              @keydown.enter="submitRename(newName)"
            />
          </UFormField>
          <p class="text-xs text-muted">
            Deja el campo vacío y guarda para restaurar el nombre original del archivo.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton color="neutral" variant="ghost" label="Cancelar" @click="renameOpen = false" />
          <UButton
            color="primary"
            label="Guardar"
            :loading="saving"
            @click="submitRename(newName)"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
