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

// --- Folder tree (fetched fresh on every open: uploads may have added folders) ---
const loading = ref(false)
const loadError = ref(false)
const allFolders = ref<string[]>([])
const createdFolders = ref<string[]>([]) // added locally; S3 creates them on move

async function loadFolders() {
  loading.value = true
  loadError.value = false
  try {
    const res = await $fetch('/api/admin/folders')
    allFolders.value = res.folders
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

// --- Browser state ---
const path = ref<string[]>([])
const filter = ref('')
const step = ref<'browse' | 'confirm'>('browse')
const moving = ref(false)
const newFolderOpen = ref(false)
const newFolderName = ref('')

const fileName = computed(() => props.videoKey.split('/').pop() ?? props.videoKey)
const sourcePrefix = computed(() => {
  const i = props.videoKey.lastIndexOf('/')
  return i === -1 ? '' : props.videoKey.slice(0, i + 1)
})
const currentPrefix = computed(() => (path.value.length ? path.value.join('/') + '/' : ''))
const isAtSource = computed(() => currentPrefix.value === sourcePrefix.value)
const canMoveHere = computed(() => currentPrefix.value !== '' && !isAtSource.value)

const folderSet = computed(() => new Set([...allFolders.value, ...createdFolders.value]))

// Direct children of the current prefix, deduped, filtered and sorted (es).
const childFolders = computed(() => {
  const prefix = currentPrefix.value
  const names = new Set<string>()
  for (const f of folderSet.value) {
    if (f === prefix || !f.startsWith(prefix)) continue
    const rest = f.slice(prefix.length)
    const name = rest.slice(0, rest.indexOf('/'))
    if (name) names.add(name)
  }
  const q = filter.value.trim().toLowerCase()
  return Array.from(names)
    .filter(n => !q || n.toLowerCase().includes(q))
    .sort((a, b) => a.localeCompare(b, 'es'))
})

// Reset and open the browser at the video's current folder each time.
watch(open, (v) => {
  if (!v) return
  path.value = sourcePrefix.value.split('/').filter(Boolean)
  filter.value = ''
  step.value = 'browse'
  createdFolders.value = []
  newFolderOpen.value = false
  newFolderName.value = ''
  loadFolders()
})

function enter(name: string) {
  path.value = [...path.value, name]
  filter.value = ''
}

function jumpTo(depth: number) {
  path.value = path.value.slice(0, depth)
  filter.value = ''
}

// --- New folder (created in S3 implicitly when the move lands in it) ---
const newFolderError = computed(() => {
  const n = newFolderName.value.trim()
  if (!n) return ''
  if (n.includes('/')) return 'El nombre no puede contener "/"'
  if (n === '.' || n === '..') return 'Nombre inválido'
  if (n.length > 100) return 'El nombre es demasiado largo (máx. 100)'
  return ''
})

function addFolder() {
  const n = newFolderName.value.trim()
  if (!n || newFolderError.value) return
  const p = currentPrefix.value + n + '/'
  if (!folderSet.value.has(p)) createdFolders.value.push(p)
  newFolderName.value = ''
  newFolderOpen.value = false
  enter(n)
}

const destIsNew = computed(() => createdFolders.value.includes(currentPrefix.value))

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
        <div class="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm">
          <UIcon name="i-lucide-film" class="w-4 h-4 shrink-0 text-yellow-500" />
          <span class="truncate font-medium">{{ videoName ?? fileName }}</span>
        </div>

        <!-- Step 1: browse -->
        <template v-if="step === 'browse'">
          <!-- Breadcrumbs -->
          <nav class="flex items-center gap-0.5 text-sm flex-wrap">
            <UButton
              size="xs"
              :variant="path.length ? 'ghost' : 'soft'"
              color="neutral"
              icon="i-lucide-home"
              label="Raíz"
              @click="jumpTo(0)"
            />
            <template v-for="(seg, i) in path" :key="i">
              <UIcon name="i-lucide-chevron-right" class="w-3.5 h-3.5 opacity-50 shrink-0" />
              <UButton
                size="xs"
                :variant="i === path.length - 1 ? 'soft' : 'ghost'"
                color="neutral"
                :label="seg"
                class="max-w-40"
                @click="jumpTo(i + 1)"
              />
            </template>
          </nav>

          <!-- Filter -->
          <UInput
            v-model="filter"
            icon="i-lucide-search"
            size="sm"
            placeholder="Filtrar carpetas…"
            class="w-full"
          />

          <!-- Folder list -->
          <div class="rounded-lg border border-gray-200 dark:border-gray-800 max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800/60">
            <div v-if="loading" class="p-4 space-y-2">
              <div v-for="n in 4" :key="n" class="h-8 rounded bg-gray-100 dark:bg-gray-900 animate-pulse" />
            </div>
            <div v-else-if="loadError" class="p-4 text-sm text-center space-y-2">
              <p class="text-red-500">No se pudieron cargar las carpetas.</p>
              <UButton size="xs" color="neutral" variant="soft" label="Reintentar" @click="loadFolders" />
            </div>
            <template v-else>
              <button
                v-for="name in childFolders"
                :key="name"
                type="button"
                class="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-900 transition"
                @click="enter(name)"
              >
                <UIcon name="i-lucide-folder" class="w-4 h-4 shrink-0 text-yellow-500" />
                <span class="truncate flex-1">{{ name }}</span>
                <UIcon name="i-lucide-chevron-right" class="w-4 h-4 shrink-0 opacity-40" />
              </button>
              <p v-if="!childFolders.length" class="px-3 py-4 text-sm text-center text-gray-400">
                {{ filter ? 'Ninguna carpeta coincide con el filtro.' : 'Sin subcarpetas.' }}
              </p>
            </template>
          </div>

          <!-- New folder -->
          <div v-if="!newFolderOpen">
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-folder-plus"
              label="Nueva carpeta aquí"
              @click="newFolderOpen = true"
            />
          </div>
          <div v-else class="space-y-1">
            <div class="flex items-center gap-2">
              <UInput
                v-model="newFolderName"
                size="sm"
                placeholder="Nombre de la carpeta"
                autofocus
                class="flex-1"
                @keydown.enter="addFolder"
                @keydown.esc="newFolderOpen = false"
              />
              <UButton
                size="sm"
                color="primary"
                label="Crear"
                :disabled="!newFolderName.trim() || !!newFolderError"
                @click="addFolder"
              />
              <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-x" @click="newFolderOpen = false" />
            </div>
            <p v-if="newFolderError" class="text-xs text-red-500">{{ newFolderError }}</p>
            <p v-else class="text-xs text-muted">Se creará en S3 al mover el video.</p>
          </div>

          <!-- Destination status -->
          <div
            class="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
            :class="canMoveHere
              ? 'bg-yellow-400/10 text-yellow-600 dark:text-yellow-400'
              : 'bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400'"
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
            <div class="rounded-lg border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800/60">
              <div class="px-3 py-2.5 flex items-start gap-2">
                <UIcon name="i-lucide-folder" class="w-4 h-4 shrink-0 mt-0.5 opacity-60" />
                <div class="min-w-0">
                  <p class="text-xs text-muted uppercase tracking-wide">Desde</p>
                  <p class="break-all">{{ sourcePrefix || 'Raíz' }}</p>
                </div>
              </div>
              <div class="px-3 py-2.5 flex items-start gap-2">
                <UIcon name="i-lucide-folder-symlink" class="w-4 h-4 shrink-0 mt-0.5 text-yellow-500" />
                <div class="min-w-0">
                  <p class="text-xs text-muted uppercase tracking-wide">Hacia</p>
                  <p class="break-all font-medium">{{ currentPrefix }}</p>
                  <p v-if="destIsNew" class="text-xs text-yellow-500 mt-0.5">Carpeta nueva — se creará al mover.</p>
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
            :disabled="!canMoveHere || loading || loadError"
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
