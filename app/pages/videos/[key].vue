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

// --- Staff-only management (rename override + move between folders) ---
const { user } = useUserSession()
const canManage = computed(() => isContentManager(user.value?.roles))
// Deleting is admin-only, a narrower gate than the rest of the staff tools.
// Cosmetic here — the endpoint enforces it.
const canDelete = computed(() => isAdmin(user.value?.roleIds))

const toast = useToast()
const moveOpen = ref(false)
const deleteOpen = ref(false)

// The key IS the identity, so a move lands on a new URL.
function onMoved(newKey: string) {
  navigateTo(videoPath(newKey))
}

// Nothing left to show on this page — fall back to the folder it lived in.
function onDeleted() {
  navigateTo(backTo.value)
}

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

const backTo = computed(() => (parentFolder.value ? folderPath(parentFolder.value) : '/'))
const backLabel = computed(() =>
  parentFolder.value ? parentFolder.value.split('/').pop()! : 'Inicio',
)
</script>

<template>
  <div>
    <NuxtLink
      :to="backTo"
      class="group mb-8 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ash transition hover:text-gold"
    >
      <UIcon name="i-lucide-arrow-left" class="h-3.5 w-3.5 transition group-hover:-translate-x-0.5" />
      Volver a {{ backLabel }}
    </NuxtLink>

    <!-- Locked: upsell in place of the player. The URL is null server-side. -->
    <div
      v-if="video!.locked"
      class="relative mb-8 aspect-video overflow-hidden rounded-2xl border border-hair bg-black"
    >
      <img
        v-if="video!.thumb"
        :src="video!.thumb"
        class="absolute inset-0 h-full w-full scale-105 object-cover opacity-20 blur-md saturate-0"
        alt=""
      >
      <div class="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/50" />

      <div class="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div class="grid h-16 w-16 place-items-center rounded-full border border-gold/30 bg-gold-bg text-gold">
          <UIcon name="i-lucide-lock" class="h-7 w-7" />
        </div>
        <div class="max-w-md">
          <p class="stc-eyebrow mb-3">{{ lockLabel(video!.lockReason) }}</p>
          <p class="font-display text-2xl font-bold uppercase leading-tight tracking-tight text-chalk sm:text-3xl">
            {{ lockMessage(video!.lockReason) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Player. The gold hairline frames it against the pure-black page. -->
    <div v-else class="mb-8 overflow-hidden rounded-2xl border border-hair bg-black shadow-[0_30px_80px_-40px_rgba(234,157,19,0.4)]">
      <VideoPlayer :src="video!.url ?? undefined" :title="video!.name" :video-key="key" />
    </div>

    <div class="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <p v-if="parentFolder" class="stc-eyebrow mb-3 truncate">{{ parentFolder }}</p>
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 class="font-display text-[clamp(1.9rem,5vw,3rem)] font-extrabold uppercase leading-[0.95] tracking-tight text-chalk">
            {{ video!.name }}
          </h1>

          <div v-if="canManage || canDelete" class="flex items-center gap-1">
            <UButton
              v-if="canManage"
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Renombrar video"
              @click="openRename"
            />
            <UButton
              v-if="canManage"
              icon="i-lucide-folder-symlink"
              color="neutral"
              variant="ghost"
              size="sm"
              aria-label="Mover video a otra carpeta"
              @click="moveOpen = true"
            />
            <UButton
              v-if="canDelete"
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="sm"
              aria-label="Eliminar video"
              @click="deleteOpen = true"
            />
          </div>
        </div>
      </div>

      <div
        v-if="video!.size"
        class="flex shrink-0 items-center gap-2 self-start rounded-lg border border-hair bg-card px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ash"
      >
        <UIcon name="i-lucide-hard-drive" class="h-3.5 w-3.5 text-gold-dark" />
        {{ formatSize(video!.size) }}
      </div>
    </div>

    <!-- Staff-only move modal -->
    <MoveVideoModal
      v-model:open="moveOpen"
      :video-key="key"
      :video-name="video?.name"
      @moved="onMoved"
    />

    <!-- Admin-only delete modal -->
    <DeleteVideoModal
      v-model:open="deleteOpen"
      :video-key="key"
      :video-name="video?.name"
      @deleted="onDeleted"
    />

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
        <div class="flex w-full justify-end gap-2">
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
