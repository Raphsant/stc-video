<script setup lang="ts">
// Staff-only modal to move a video to another S3 folder.
// Two steps: browse (mini folder explorer with breadcrumbs, filter and
// inline new-folder creation) -> confirm (explicit source -> destination
// summary). The modal locks while the move runs — big files take a while.
const props = defineProps<{
  videoKey: string
  videoName?: string
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ moved: [newKey: string] }>()

const toast = useToast()

const step = ref<'browse' | 'confirm'>('browse')
const moving = ref(false)

// FolderPicker owns the browsing; this modal only cares where it landed.
const currentPrefix = ref('')
const createdFolders = ref<string[]>([]) // added locally; S3 creates them on move
// Bumped on open so the picker remounts and re-fetches — another session may
// have added folders since last time.
const pickerKey = ref(0)

const fileName = computed(() => props.videoKey.split('/').pop() ?? props.videoKey)
const sourcePrefix = computed(() => {
  const i = props.videoKey.lastIndexOf('/')
  return i === -1 ? '' : props.videoKey.slice(0, i + 1)
})
const isAtSource = computed(() => currentPrefix.value === sourcePrefix.value)
const canMoveHere = computed(() => currentPrefix.value !== '' && !isAtSource.value)
const destIsNew = computed(() => createdFolders.value.includes(currentPrefix.value))

// Reset and open the browser at the video's current folder each time.
watch(open, (v) => {
  if (!v) return
  currentPrefix.value = sourcePrefix.value
  createdFolders.value = []
  step.value = 'browse'
  pickerKey.value++
})

// --- Move ---
async function submitMove() {
  if (!canMoveHere.value || moving.value) return
  moving.value = true
  try {
    const res = await $fetch('/api/admin/videos/move', {
      method: 'POST',
      body: { key: props.videoKey, destPrefix: currentPrefix.value },
    })
    toast.add({ title: 'Video movido', description: res.to, color: 'success', icon: 'i-lucide-check' })
    for (const w of res.warnings ?? []) {
      toast.add({ title: 'Aviso', description: w, color: 'warning', icon: 'i-lucide-alert-triangle' })
    }
    open.value = false
    emit('moved', res.to)
  } catch (err: any) {
    toast.add({
      title: 'No se pudo mover el video',
      description: err?.data?.message ?? 'Inténtalo de nuevo',
      color: 'error',
      icon: 'i-lucide-alert-triangle',
    })
    step.value = 'browse'
  } finally {
    moving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Mover video" :dismissible="!moving">
    <template #body>
      <div class="space-y-4">
        <!-- Which video -->
        <div class="flex items-center gap-2 rounded-lg bg-raised px-3 py-2 text-sm">
          <UIcon name="i-lucide-film" class="w-4 h-4 shrink-0 text-gold" />
          <span class="truncate font-medium">{{ videoName ?? fileName }}</span>
        </div>

        <!-- Step 1: browse -->
        <template v-if="step === 'browse'">
          <FolderPicker
            :key="pickerKey"
            v-model="currentPrefix"
            v-model:created="createdFolders"
          />

          <!-- Destination status -->
          <div
            class="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
            :class="canMoveHere
              ? 'border border-gold-dim bg-gold-bg text-gold'
              : 'bg-raised text-ash'"
          >
            <UIcon
              :name="isAtSource ? 'i-lucide-map-pin' : 'i-lucide-corner-down-right'"
              class="w-4 h-4 shrink-0 mt-0.5"
            />
            <p class="min-w-0 break-all">
              <template v-if="isAtSource">El video ya está en esta carpeta.</template>
              <template v-else-if="!currentPrefix">Navega hasta una carpeta de destino.</template>
              <template v-else>Destino: <span class="font-medium">{{ currentPrefix }}</span></template>
            </p>
          </div>
        </template>

        <!-- Step 2: confirm -->
        <template v-else>
          <div class="space-y-3 text-sm">
            <div class="rounded-lg border border-hair divide-y divide-hair">
              <div class="px-3 py-2.5 flex items-start gap-2">
                <UIcon name="i-lucide-folder" class="w-4 h-4 shrink-0 mt-0.5 opacity-60" />
                <div class="min-w-0">
                  <p class="text-xs text-muted uppercase tracking-wide">Desde</p>
                  <p class="break-all">{{ sourcePrefix || 'Raíz' }}</p>
                </div>
              </div>
              <div class="px-3 py-2.5 flex items-start gap-2">
                <UIcon name="i-lucide-folder-symlink" class="w-4 h-4 shrink-0 mt-0.5 text-gold" />
                <div class="min-w-0">
                  <p class="text-xs text-muted uppercase tracking-wide">Hacia</p>
                  <p class="break-all font-medium">{{ currentPrefix }}</p>
                  <p v-if="destIsNew" class="text-xs text-gold mt-0.5">Carpeta nueva — se creará al mover.</p>
                </div>
              </div>
            </div>
            <p v-if="moving" class="flex items-center gap-2 text-muted">
              <UIcon name="i-lucide-loader-circle" class="w-4 h-4 animate-spin" />
              Moviendo… los archivos grandes pueden tardar un poco. No cierres esta ventana.
            </p>
            <p v-else class="text-xs text-muted">
              El archivo se moverá en S3. El historial de reproducción y el nombre personalizado se conservan.
            </p>
          </div>
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <template v-if="step === 'browse'">
          <UButton color="neutral" variant="ghost" label="Cancelar" @click="open = false" />
          <UButton
            color="primary"
            icon="i-lucide-folder-symlink"
            label="Mover aquí"
            :disabled="!canMoveHere"
            @click="step = 'confirm'"
          />
        </template>
        <template v-else>
          <UButton color="neutral" variant="ghost" label="Volver" :disabled="moving" @click="step = 'browse'" />
          <UButton
            color="primary"
            icon="i-lucide-check"
            label="Confirmar movimiento"
            :loading="moving"
            @click="submitMove"
          />
        </template>
      </div>
    </template>
  </UModal>
</template>
