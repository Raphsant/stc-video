<script setup lang="ts">
// Staff-only panel: edit who sees what.
//  - Time window per tier ("Deltas no ven videos de hace más de X días/meses")
//  - Folder tree with per-folder Alpha/Delta checkboxes. A rule on a folder
//    applies to everything under it; a child can't re-allow what an ancestor
//    blocks (matches the server's AND semantics), so inherited blocks render
//    as disabled checkboxes.
const { user } = useUserSession()
const canManage = computed(() => isContentManager(user.value?.roles))
if (!canManage.value) {
  throw createError({ statusCode: 403, statusMessage: 'Acceso restringido al staff' })
}

useSeoMeta({ title: 'Administración' })
const toast = useToast()

type Tier = 'alpha' | 'delta'
type RuleMap = Record<string, { alpha: boolean; delta: boolean; noWindow: boolean }>

const { data: config } = await useFetch('/api/admin/access')
const {
  data: foldersData,
  pending: foldersPending,
  error: foldersError,
  refresh: refreshFolders,
} = await useFetch('/api/admin/folders', { lazy: true })

// --- Editable state (canonical: days per tier + rule map by prefix) ---
const days = reactive<Record<Tier, number | null>>({ alpha: null, delta: 30 })
const rulesMap = ref<RuleMap>({})

interface AccessConfigShape {
  alphaDaysBack?: number | null
  deltaDaysBack?: number | null
  folderRules?: { prefix: string; alpha: boolean; delta: boolean; noWindow?: boolean }[]
}

function stateFromConfig(c: AccessConfigShape | null | undefined) {
  const map: RuleMap = {}
  for (const r of c?.folderRules ?? []) map[r.prefix] = { alpha: r.alpha, delta: r.delta, noWindow: r.noWindow === true }
  return { alpha: c?.alphaDaysBack ?? null, delta: c?.deltaDaysBack ?? null, rules: map }
}

// Last-saved snapshot for dirty tracking / discard.
const savedState = ref(stateFromConfig(config.value))

function serialize(alpha: number | null, delta: number | null, rules: RuleMap) {
  return JSON.stringify({
    alpha,
    delta,
    rules: Object.entries(rules).sort(([a], [b]) => a.localeCompare(b)),
  })
}
const dirty = computed(() =>
  serialize(days.alpha, days.delta, rulesMap.value)
  !== serialize(savedState.value.alpha, savedState.value.delta, savedState.value.rules),
)

// --- Time-window editors (value + unit view over the canonical days) ---
const UNIT_ITEMS = [
  { label: 'días', value: 'dias' },
  { label: 'meses', value: 'meses' },
]
const editors = reactive<Record<Tier, { value: number; unit: 'dias' | 'meses' }>>({
  alpha: { value: 1, unit: 'meses' },
  delta: { value: 1, unit: 'meses' },
})

function syncEditors() {
  for (const tier of ['alpha', 'delta'] as Tier[]) {
    const d = days[tier]
    if (d == null) editors[tier] = { value: 1, unit: 'meses' }
    else if (d % 30 === 0 && d >= 30) editors[tier] = { value: d / 30, unit: 'meses' }
    else editors[tier] = { value: d, unit: 'dias' }
  }
}

function applyState(s: { alpha: number | null; delta: number | null; rules: RuleMap }) {
  days.alpha = s.alpha
  days.delta = s.delta
  rulesMap.value = JSON.parse(JSON.stringify(s.rules))
  syncEditors()
}
applyState(savedState.value)

function applyEditor(tier: Tier) {
  const e = editors[tier]
  const v = Math.max(1, Math.floor(Number(e.value) || 1))
  e.value = v
  days[tier] = e.unit === 'meses' ? v * 30 : v
}

function setLimited(tier: Tier, on: boolean) {
  if (on) applyEditor(tier)
  else days[tier] = null
}

function windowSummary(tier: Tier): string {
  const d = days[tier]
  if (d == null) return 'Sin límite: ve todo el archivo.'
  const months = d / 30
  const approx = months >= 1 ? ` (~${Number.isInteger(months) ? months : months.toFixed(1)} ${months === 1 ? 'mes' : 'meses'})` : ''
  return `Solo ve videos subidos en los últimos ${d} ${d === 1 ? 'día' : 'días'}${approx}.`
}

const TIERS: { id: Tier; label: string; icon: string; note?: string }[] = [
  { id: 'delta', label: 'Delta', icon: 'i-lucide-clock' },
  {
    id: 'alpha',
    label: 'Alpha',
    icon: 'i-lucide-crown',
    note: 'El staff también pertenece a Alpha: limitar Alpha también afecta al panel del staff.',
  },
]

// --- Folder tree ---
interface TreeNode {
  prefix: string
  name: string
  depth: number
  children: TreeNode[]
}

const tree = computed<TreeNode[]>(() => {
  const roots: TreeNode[] = []
  const byPrefix = new Map<string, TreeNode>()
  for (const p of foldersData.value?.folders ?? []) {
    const segs = p.slice(0, -1).split('/')
    const node: TreeNode = { prefix: p, name: segs[segs.length - 1]!, depth: segs.length - 1, children: [] }
    byPrefix.set(p, node)
    const parent = segs.length > 1 ? byPrefix.get(segs.slice(0, -1).join('/') + '/') : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
})

const expanded = ref(new Set<string>())

const visibleRows = computed(() => {
  const rows: TreeNode[] = []
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      rows.push(n)
      if (n.children.length && expanded.value.has(n.prefix)) walk(n.children)
    }
  }
  walk(tree.value)
  return rows
})

function toggleExpand(prefix: string) {
  const s = new Set(expanded.value)
  if (s.has(prefix)) s.delete(prefix)
  else s.add(prefix)
  expanded.value = s
}

function setAllExpanded(on: boolean) {
  if (!on) {
    expanded.value = new Set()
    return
  }
  const s = new Set<string>()
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      if (n.children.length) s.add(n.prefix)
      walk(n.children)
    }
  }
  walk(tree.value)
  expanded.value = s
}

// --- Folder rule helpers (server semantics: every matching prefix must allow) ---
function ancestorBlocked(prefix: string, tier: Tier): boolean {
  for (const [p, r] of Object.entries(rulesMap.value)) {
    if (p !== prefix && prefix.startsWith(p) && !r[tier]) return true
  }
  return false
}

function isChecked(prefix: string, tier: Tier): boolean {
  return !ancestorBlocked(prefix, tier) && (rulesMap.value[prefix]?.[tier] ?? true)
}

function setRule(prefix: string, next: RuleMap[string]) {
  const map = { ...rulesMap.value }
  if (next.alpha && next.delta && !next.noWindow) delete map[prefix]
  else map[prefix] = next
  rulesMap.value = map
}

function toggleRule(prefix: string, tier: Tier) {
  if (ancestorBlocked(prefix, tier)) return
  const cur = rulesMap.value[prefix] ?? { alpha: true, delta: true, noWindow: false }
  setRule(prefix, { ...cur, [tier]: !cur[tier] })
}

// Window exemptions inherit downward with OR semantics (matching the server:
// one exempt ancestor is enough), so a subfolder of an exempt folder shows a
// checked, disabled box.
function ancestorExempt(prefix: string): boolean {
  for (const [p, r] of Object.entries(rulesMap.value)) {
    if (p !== prefix && prefix.startsWith(p) && r.noWindow) return true
  }
  return false
}

function isExempt(prefix: string): boolean {
  return ancestorExempt(prefix) || (rulesMap.value[prefix]?.noWindow ?? false)
}

function toggleNoWindow(prefix: string) {
  if (ancestorExempt(prefix)) return
  const cur = rulesMap.value[prefix] ?? { alpha: true, delta: true, noWindow: false }
  setRule(prefix, { ...cur, noWindow: !cur.noWindow })
}

function rowBadge(prefix: string): { label: string; color: 'error' | 'warning' | 'success' } | null {
  if (!isChecked(prefix, 'alpha')) return { label: 'Oculta para todos', color: 'error' }
  if (!isChecked(prefix, 'delta')) return { label: 'Solo Alpha', color: 'warning' }
  if (isExempt(prefix)) return { label: 'Siempre disponible', color: 'success' }
  return null
}

// --- Save / discard ---
const saving = ref(false)

async function save() {
  if (!dirty.value || saving.value) return
  saving.value = true
  try {
    const res = await $fetch('/api/admin/access', {
      method: 'PUT',
      body: {
        alphaDaysBack: days.alpha,
        deltaDaysBack: days.delta,
        folderRules: Object.entries(rulesMap.value).map(([prefix, r]) => ({ prefix, ...r })),
      },
    })
    savedState.value = stateFromConfig(res)
    applyState(savedState.value)
    toast.add({
      title: 'Reglas de acceso guardadas',
      description: 'Los cambios se aplican en menos de un minuto.',
      color: 'success',
      icon: 'i-lucide-check',
    })
  } catch (err: any) {
    toast.add({
      title: 'No se pudieron guardar las reglas',
      description: err?.data?.message ?? 'Inténtalo de nuevo',
      color: 'error',
      icon: 'i-lucide-alert-triangle',
    })
  } finally {
    saving.value = false
  }
}

function discard() {
  applyState(savedState.value)
}
</script>

<template>
  <div class="pb-28">
    <!-- Header -->
    <header class="mb-12">
      <p class="stc-eyebrow mb-4">Panel de staff</p>
      <h1 class="font-display text-[clamp(2.25rem,6vw,3.75rem)] font-extrabold uppercase leading-[0.9] tracking-tight text-chalk">
        Administración
      </h1>
      <p class="mt-4 max-w-xl text-sm text-ash">
        Controla qué carpetas y qué antigüedad de videos ve cada rol.
      </p>
      <div class="stc-rule mt-8" />
    </header>

    <!-- Time windows -->
    <section class="mb-14">
      <SectionHeading eyebrow="Regla 1" title="Ventana de tiempo" />

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div
          v-for="t in TIERS"
          :key="t.id"
          class="space-y-5 rounded-xl border border-hair bg-card p-6"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-3">
              <div class="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-gold-dim bg-gold-bg text-gold">
                <UIcon :name="t.icon" class="h-4 w-4" />
              </div>
              <span class="font-display text-xl font-bold uppercase leading-none tracking-tight text-chalk">
                {{ t.label }}
              </span>
            </div>
            <USwitch
              :model-value="days[t.id] != null"
              label="Limitar por tiempo"
              @update:model-value="setLimited(t.id, $event)"
            />
          </div>

          <div v-if="days[t.id] != null" class="flex flex-wrap items-center gap-2">
            <span class="shrink-0 text-sm text-ash">No ven videos de hace más de</span>
            <UInputNumber
              v-model="editors[t.id].value"
              :min="1"
              :max="editors[t.id].unit === 'meses' ? 120 : 3650"
              size="sm"
              class="w-24"
              @update:model-value="applyEditor(t.id)"
            />
            <USelect
              v-model="editors[t.id].unit"
              :items="UNIT_ITEMS"
              size="sm"
              class="w-28"
              @update:model-value="applyEditor(t.id)"
            />
          </div>

          <p class="text-sm" :class="days[t.id] == null ? 'text-ash' : 'text-gold'">
            {{ windowSummary(t.id) }}
          </p>

          <p v-if="t.note && days[t.id] != null" class="flex items-start gap-2 text-xs text-red-400">
            <UIcon name="i-lucide-alert-triangle" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {{ t.note }}
          </p>
        </div>
      </div>

      <p class="mt-3 text-xs text-ash">
        Un mes equivale a 30 días. La antigüedad se mide desde que el video se subió a la plataforma.
      </p>
    </section>

    <!-- Folder access -->
    <section>
      <SectionHeading eyebrow="Regla 2" title="Acceso por carpeta">
        <template #action>
          <div class="flex shrink-0 items-center gap-1 pb-1">
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-chevrons-up-down"
              label="Expandir todo"
              @click="setAllExpanded(true)"
            />
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-chevrons-down-up"
              label="Contraer"
              @click="setAllExpanded(false)"
            />
          </div>
        </template>
      </SectionHeading>

      <div class="overflow-hidden rounded-xl border border-hair bg-card">
        <!-- Column headers -->
        <div class="grid grid-cols-[1fr_72px_72px_88px] items-center gap-2 border-b border-hair bg-raised px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ash">
          <span>Carpeta</span>
          <span class="text-center">Alpha</span>
          <span class="text-center">Delta</span>
          <span class="text-center" title="Exenta de la ventana de tiempo: siempre disponible">Sin límite</span>
        </div>

        <div v-if="foldersPending" class="space-y-2 p-4">
          <div v-for="n in 6" :key="n" class="h-9 animate-pulse rounded bg-raised" />
        </div>

        <div v-else-if="foldersError" class="space-y-3 p-8 text-center text-sm">
          <p class="text-red-400">No se pudieron cargar las carpetas.</p>
          <UButton size="xs" color="neutral" variant="subtle" label="Reintentar" @click="refreshFolders()" />
        </div>

        <div v-else class="max-h-[32rem] divide-y divide-hair overflow-y-auto">
          <div
            v-for="node in visibleRows"
            :key="node.prefix"
            class="grid grid-cols-[1fr_72px_72px_88px] items-center gap-2 px-4 py-2.5 transition hover:bg-raised"
          >
            <div class="flex min-w-0 items-center gap-1.5" :style="{ paddingLeft: `${node.depth * 1.25}rem` }">
              <UButton
                v-if="node.children.length"
                :icon="expanded.has(node.prefix) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                size="xs"
                color="neutral"
                variant="ghost"
                class="-ml-1.5 shrink-0"
                :aria-label="expanded.has(node.prefix) ? 'Contraer' : 'Expandir'"
                @click="toggleExpand(node.prefix)"
              />
              <span v-else class="w-6 shrink-0" />
              <UIcon name="i-lucide-folder" class="h-4 w-4 shrink-0 text-gold-dark" />
              <span class="truncate text-sm text-chalk">{{ node.name }}</span>
              <span
                v-if="rowBadge(node.prefix)"
                class="ml-1 shrink-0 rounded border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em]"
                :class="{
                  'border-red-900/60 bg-red-950/40 text-red-400': rowBadge(node.prefix)!.color === 'error',
                  'border-gold-dim bg-gold-bg text-gold': rowBadge(node.prefix)!.color === 'warning',
                  'border-emerald-900/60 bg-emerald-950/40 text-emerald-400': rowBadge(node.prefix)!.color === 'success',
                }"
              >{{ rowBadge(node.prefix)!.label }}</span>
            </div>
            <div
              class="flex justify-center"
              :title="ancestorBlocked(node.prefix, 'alpha') ? 'Bloqueada por una carpeta superior' : undefined"
            >
              <UCheckbox
                :model-value="isChecked(node.prefix, 'alpha')"
                :disabled="ancestorBlocked(node.prefix, 'alpha')"
                @update:model-value="toggleRule(node.prefix, 'alpha')"
              />
            </div>
            <div
              class="flex justify-center"
              :title="ancestorBlocked(node.prefix, 'delta') ? 'Bloqueada por una carpeta superior' : undefined"
            >
              <UCheckbox
                :model-value="isChecked(node.prefix, 'delta')"
                :disabled="ancestorBlocked(node.prefix, 'delta')"
                @update:model-value="toggleRule(node.prefix, 'delta')"
              />
            </div>
            <div
              class="flex justify-center"
              :title="ancestorExempt(node.prefix) ? 'Exenta por una carpeta superior' : 'Siempre disponible: sin ventana de tiempo'"
            >
              <UCheckbox
                :model-value="isExempt(node.prefix)"
                :disabled="ancestorExempt(node.prefix)"
                @update:model-value="toggleNoWindow(node.prefix)"
              />
            </div>
          </div>

          <p v-if="!visibleRows.length" class="px-4 py-10 text-center text-sm text-ash">
            No hay carpetas en el bucket.
          </p>
        </div>
      </div>

      <div class="mt-3 space-y-1 text-xs text-ash">
        <p>Desmarcar una casilla oculta la carpeta (y todo su contenido) para ese rol. Las reglas de una carpeta se heredan a sus subcarpetas.</p>
        <p>Los miembros Delta ven las carpetas exclusivas como contenido bloqueado con aviso de "Solo Alpha". Quitar Alpha oculta la carpeta para todos, incluido el staff.</p>
        <p>Marcar "Sin límite" exime a la carpeta (y a sus subcarpetas) de la ventana de tiempo: sus videos quedan siempre disponibles para los roles que pueden verla.</p>
      </div>
    </section>

    <!-- Sticky save bar -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-2"
    >
      <div v-if="dirty" class="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2">
        <div class="flex items-center justify-between gap-3 rounded-xl border border-gold/30 bg-black/95 px-4 py-3 shadow-[0_20px_50px_-20px_rgba(234,157,19,0.5)] backdrop-blur-xl">
          <p class="flex min-w-0 items-center gap-2 text-sm">
            <UIcon name="i-lucide-circle-alert" class="h-4 w-4 shrink-0 text-gold" />
            <span class="truncate text-chalk">Tienes cambios sin guardar.</span>
          </p>
          <div class="flex shrink-0 items-center gap-2">
            <UButton color="neutral" variant="ghost" label="Descartar" :disabled="saving" @click="discard" />
            <UButton
              color="primary"
              icon="i-lucide-save"
              label="Guardar"
              :loading="saving"
              class="font-semibold uppercase tracking-wider"
              @click="save"
            />
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
