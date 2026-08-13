<script setup lang="ts">
import { VIDEO_ACCEPT } from '~~/shared/utils/videoExt'

// Admin-only uploader. Pick a destination folder, drop files, watch them go.
//
// The bytes go browser -> S3 directly (presigned multipart, see
// useVideoUpload). Nothing here streams through Nitro: the site sits behind a
// Cloudflare tunnel that would reject a request body the size of a session
// recording long before it reached the server.
//
// The queue lives at module scope in the composable, so leaving this page does
// not cancel an upload in flight — coming back shows it where it left off.
const { user } = useUserSession()
const canUpload = computed(() => isAdmin(user.value?.roleIds))
if (!canUpload.value) {
  throw createError({ statusCode: 403, statusMessage: 'Acceso restringido a administradores' })
}

useSeoMeta({ title: 'Subir videos' })
const toast = useToast()

const { items, hasActive, addFiles, cancel, retry, remove, clearFinished } = useVideoUpload()

const destPrefix = ref('')
const createdFolders = ref<string[]>([])
const destIsNew = computed(() => createdFolders.value.includes(destPrefix.value))
const canQueue = computed(() => destPrefix.value !== '')

// UFileUpload appends to its own model; this page owns the queue, so drain it
// on every change and hand the files straight to the uploader.
const dropped = ref<File[]>([])
watch(dropped, (files) => {
  if (!files?.length) return
  const skipped = addFiles(files, destPrefix.value)
  dropped.value = []
  if (skipped.length) {
    toast.add({
      title: skipped.length === 1 ? 'Archivo omitido' : `${skipped.length} archivos omitidos`,
      description: `Solo se aceptan videos: ${skipped.join(', ')}`,
      color: 'warning',
      icon: 'i-lucide-alert-triangle',
    })
  }
})

const finishedCount = computed(() =>
  items.value.filter(i => i.status === 'done' || i.status === 'canceled').length)

function percent(item: { uploadedBytes: number; totalBytes: number }) {
  if (!item.totalBytes) return 0
  return Math.min(100, Math.round((item.uploadedBytes / item.totalBytes) * 100))
}

const STATUS: Record<string, { label: string; icon: string; class: string; spin?: boolean }> = {
  pending: { label: 'En cola', icon: 'i-lucide-clock', class: 'text-ash' },
  preparing: { label: 'Preparando', icon: 'i-lucide-loader-circle', class: 'text-ash', spin: true },
  uploading: { label: 'Subiendo', icon: 'i-lucide-upload', class: 'text-gold' },
  finishing: { label: 'Finalizando', icon: 'i-lucide-loader-circle', class: 'text-gold', spin: true },
  done: { label: 'Listo', icon: 'i-lucide-check', class: 'text-green-400' },
  error: { label: 'Error', icon: 'i-lucide-alert-triangle', class: 'text-red-400' },
  canceled: { label: 'Cancelado', icon: 'i-lucide-x', class: 'text-ash' },
}
</script>

<template>
  <div>
    <header class="mb-12">
      <p class="stc-eyebrow mb-4">Panel de staff</p>
      <h1 class="font-display text-[clamp(2.25rem,6vw,3.75rem)] font-extrabold uppercase leading-[0.9] tracking-tight text-chalk">
        Subir videos
      </h1>
      <p class="mt-4 max-w-xl text-sm text-ash">
        Elige la carpeta de destino y arrastra los archivos. Se suben directo a S3, así que
        puedes cambiar de página sin cortar la subida — pero no cierres el navegador.
      </p>
      <div class="stc-rule mt-8" />
    </header>

    <!-- Destination -->
    <section class="mb-14">
      <SectionHeading eyebrow="Paso 1" title="Destino" />

      <div class="rounded-xl border border-hair bg-card p-6">
        <FolderPicker v-model="destPrefix" v-model:created="createdFolders" />

        <div
          class="mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
          :class="canQueue ? 'border border-gold-dim bg-gold-bg text-gold' : 'bg-raised text-ash'"
        >
          <UIcon
            :name="canQueue ? 'i-lucide-corner-down-right' : 'i-lucide-map-pin'"
            class="mt-0.5 h-4 w-4 shrink-0"
          />
          <p class="min-w-0 break-all">
            <template v-if="!canQueue">Navega hasta la carpeta donde quieres subir los videos.</template>
            <template v-else>
              Destino: <span class="font-medium">{{ destPrefix }}</span>
              <span v-if="destIsNew" class="ml-1 opacity-80">· carpeta nueva</span>
            </template>
          </p>
        </div>
      </div>
    </section>

    <!-- Files -->
    <section>
      <SectionHeading eyebrow="Paso 2" title="Archivos" :count="items.length || null">
        <template #action>
          <UButton
            v-if="finishedCount"
            size="xs"
            color="neutral"
            variant="ghost"
            icon="i-lucide-eraser"
            label="Limpiar terminados"
            @click="clearFinished"
          />
        </template>
      </SectionHeading>

      <UFileUpload
        v-model="dropped"
        multiple
        reset
        :preview="false"
        :accept="VIDEO_ACCEPT"
        :disabled="!canQueue"
        icon="i-lucide-upload-cloud"
        :label="canQueue ? 'Arrastra los videos aquí' : 'Elige primero una carpeta de destino'"
        description="MP4, MOV, M4V, MKV, WEBM o AVI · sin límite práctico de tamaño"
        class="min-h-44 w-full"
      />

      <!-- Queue -->
      <ul v-if="items.length" class="mt-6 space-y-3">
        <li
          v-for="item in items"
          :key="item.id"
          class="rounded-xl border border-hair bg-card p-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-chalk">{{ item.fileName }}</p>
              <p class="mt-0.5 truncate text-xs text-ash">{{ item.destPrefix }}</p>
            </div>

            <div class="flex shrink-0 items-center gap-3">
              <span
                class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
                :class="STATUS[item.status]!.class"
              >
                <UIcon
                  :name="STATUS[item.status]!.icon"
                  class="h-3.5 w-3.5"
                  :class="STATUS[item.status]!.spin && 'animate-spin'"
                />
                {{ STATUS[item.status]!.label }}
              </span>

              <UButton
                v-if="item.status === 'uploading' || item.status === 'preparing' || item.status === 'pending'"
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                aria-label="Cancelar subida"
                @click="cancel(item.id)"
              />
              <UButton
                v-else-if="item.status === 'error' || item.status === 'canceled'"
                size="xs"
                color="neutral"
                variant="soft"
                icon="i-lucide-rotate-ccw"
                label="Reintentar"
                @click="retry(item.id)"
              />
              <UButton
                v-if="item.status === 'done' || item.status === 'error' || item.status === 'canceled'"
                size="xs"
                color="neutral"
                variant="ghost"
                icon="i-lucide-trash-2"
                aria-label="Quitar de la lista"
                @click="remove(item.id)"
              />
            </div>
          </div>

          <UProgress
            v-if="item.status !== 'done' && item.status !== 'canceled'"
            :model-value="percent(item)"
            :color="item.status === 'error' ? 'error' : 'primary'"
            size="sm"
            class="mt-3"
          />

          <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ash">
            <template v-if="item.status === 'done'">
              <UIcon name="i-lucide-hard-drive" class="h-3.5 w-3.5" />
              <span>{{ formatSize(item.totalBytes) }}</span>
              <NuxtLink
                :to="folderPath(item.destPrefix)"
                class="font-medium text-gold transition hover:text-gold-soft"
              >
                Ver en la carpeta →
              </NuxtLink>
            </template>
            <template v-else>
              <span>{{ percent(item) }}%</span>
              <span>{{ formatSize(item.uploadedBytes) || '0 MB' }} de {{ formatSize(item.totalBytes) }}</span>
              <span v-if="item.speedBps && item.status === 'uploading'">{{ formatSpeed(item.speedBps) }}</span>
            </template>
          </div>

          <p v-if="item.error" class="mt-2 text-xs text-red-400">{{ item.error }}</p>
        </li>
      </ul>

      <p v-if="hasActive" class="mt-6 flex items-center gap-2 text-xs text-ash">
        <UIcon name="i-lucide-info" class="h-3.5 w-3.5 shrink-0" />
        Las miniaturas se generan solas unos minutos después de que termine cada subida.
      </p>
    </section>
  </div>
</template>
