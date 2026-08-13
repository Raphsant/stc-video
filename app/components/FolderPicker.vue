<script setup lang="ts">
// Mini folder explorer over the bucket: breadcrumbs, filter, and inline
// creation of folders that don't exist yet. Shared by the move-video modal and
// the uploader so both browse the tree the same way.
//
// The selected prefix IS the model — `path` is derived from it, so there is no
// second source of truth to keep in sync. Folders in S3 are virtual, so a
// locally-created one is a real destination the moment something is written to
// it; `created` carries those back to the parent, which usually wants to say so.
const created = defineModel<string[]>('created', { default: () => [] })
const model = defineModel<string>({ default: '' })

const loading = ref(false)
const loadError = ref(false)
const allFolders = ref<string[]>([])
const filter = ref('')
const newFolderOpen = ref(false)
const newFolderName = ref('')

const path = computed(() => model.value.split('/').filter(Boolean))
const folderSet = computed(() => new Set([...allFolders.value, ...created.value]))

// Direct children of the current prefix, deduped, filtered and sorted (es).
const childFolders = computed(() => {
  const prefix = model.value
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
onMounted(loadFolders)

function enter(name: string) {
  model.value = model.value + name + '/'
  filter.value = ''
}

function jumpTo(depth: number) {
  model.value = depth ? path.value.slice(0, depth).join('/') + '/' : ''
  filter.value = ''
}

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
  const prefix = model.value + n + '/'
  if (!folderSet.value.has(prefix)) created.value = [...created.value, prefix]
  newFolderName.value = ''
  newFolderOpen.value = false
  enter(n)
}

defineExpose({ reload: loadFolders })
</script>

<template>
  <div class="space-y-4">
    <!-- Breadcrumbs -->
    <nav class="flex flex-wrap items-center gap-0.5 text-sm">
      <UButton
        size="xs"
        :variant="path.length ? 'ghost' : 'soft'"
        color="neutral"
        icon="i-lucide-home"
        label="Raíz"
        @click="jumpTo(0)"
      />
      <template v-for="(seg, i) in path" :key="i">
        <UIcon name="i-lucide-chevron-right" class="h-3.5 w-3.5 shrink-0 opacity-50" />
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

    <UInput
      v-model="filter"
      icon="i-lucide-search"
      size="sm"
      placeholder="Filtrar carpetas…"
      class="w-full"
    />

    <div class="max-h-64 divide-y divide-hair overflow-y-auto rounded-lg border border-hair">
      <div v-if="loading" class="space-y-2 p-4">
        <div v-for="n in 4" :key="n" class="h-8 animate-pulse rounded bg-raised" />
      </div>
      <div v-else-if="loadError" class="space-y-2 p-4 text-center text-sm">
        <p class="text-red-400">No se pudieron cargar las carpetas.</p>
        <UButton size="xs" color="neutral" variant="soft" label="Reintentar" @click="loadFolders" />
      </div>
      <template v-else>
        <button
          v-for="name in childFolders"
          :key="name"
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition hover:bg-raised"
          @click="enter(name)"
        >
          <UIcon name="i-lucide-folder" class="h-4 w-4 shrink-0 text-gold" />
          <span class="flex-1 truncate">{{ name }}</span>
          <UIcon name="i-lucide-chevron-right" class="h-4 w-4 shrink-0 opacity-40" />
        </button>
        <p v-if="!childFolders.length" class="px-3 py-4 text-center text-sm text-ash">
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
      <p v-if="newFolderError" class="text-xs text-red-400">{{ newFolderError }}</p>
      <p v-else class="text-xs text-muted">Se creará en S3 al guardar el primer archivo.</p>
    </div>
  </div>
</template>
