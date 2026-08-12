<script setup lang="ts">
/**
 * The video tile. Four pages render grids of these (home, /all, folder
 * browser, and the home preview rows), and before this component each kept
 * its own copy of the markup — including the locked-state contract, which
 * must not drift: a locked card is never a link, and never exposes a URL.
 */
const props = withDefaults(defineProps<{
  video: {
    key: string
    name: string
    thumb?: string
    size?: number
    locked?: boolean
    lockReason?: LockReason | string | null
  }
  /** Resume position as a percentage, 0–100. Hidden when absent or 0. */
  progress?: number
  /** Tighter tile for the dense preview rows on the home page. */
  dense?: boolean
  /** Staff tools, rendered over the thumbnail. The endpoints enforce both. */
  canMove?: boolean
  canDelete?: boolean
}>(), {
  dense: false,
  canMove: false,
  canDelete: false,
})

const emit = defineEmits<{ move: []; delete: [] }>()

const NuxtLink = resolveComponent('NuxtLink')

const to = computed(() => (props.video.locked ? undefined : videoPath(props.video.key)))
</script>

<template>
  <component
    :is="video.locked ? 'div' : NuxtLink"
    :to="to"
    class="group relative block overflow-hidden rounded-xl border border-hair bg-card transition duration-300"
    :class="video.locked
      ? 'cursor-default'
      : 'hover:border-gold/50 hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgba(234,157,19,0.55)]'"
  >
    <div class="relative aspect-video overflow-hidden bg-black">
      <img
        v-if="video.thumb"
        :src="video.thumb"
        class="absolute inset-0 h-full w-full object-cover transition duration-500"
        :class="video.locked
          ? 'opacity-25 blur-[2px] saturate-0 scale-105'
          : 'opacity-70 saturate-[0.85] group-hover:opacity-100 group-hover:saturate-100 group-hover:scale-[1.04]'"
        loading="lazy"
        alt=""
      >
      <!-- Grounds the tile against #000 so a bright frame doesn't float. -->
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

      <!-- Locked: no link, no URL — just the upsell. -->
      <div
        v-if="video.locked"
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center"
      >
        <div
          class="grid place-items-center rounded-full border border-gold/30 bg-gold-bg/80 text-gold backdrop-blur-sm"
          :class="dense ? 'h-9 w-9' : 'h-12 w-12'"
        >
          <UIcon name="i-lucide-lock" :class="dense ? 'h-4 w-4' : 'h-5 w-5'" />
        </div>
        <span
          class="stc-eyebrow text-chalk"
          :class="dense ? 'text-[9px] tracking-[0.14em]' : 'text-[10px] tracking-[0.18em]'"
        >{{ lockLabel(video.lockReason) }}</span>
      </div>

      <!-- Unlocked: gold play affordance on hover. -->
      <div
        v-else
        class="absolute inset-0 flex items-center justify-center opacity-0 transition duration-300 group-hover:opacity-100"
      >
        <div
          class="grid place-items-center rounded-full bg-gold text-black shadow-[0_10px_30px_-8px_rgba(234,157,19,0.9)] transition duration-300 scale-90 group-hover:scale-100"
          :class="dense ? 'h-10 w-10' : 'h-14 w-14'"
        >
          <UIcon name="i-lucide-play" class="ml-0.5" :class="dense ? 'h-4 w-4' : 'h-6 w-6'" />
        </div>
      </div>

      <span
        v-if="video.size && !dense"
        class="absolute right-2.5 top-2.5 rounded-md border border-white/10 bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-chalk/80 backdrop-blur-sm"
      >{{ formatSize(video.size) }}</span>

      <!-- Staff tools. The card itself is a link, so these must swallow the click. -->
      <div v-if="canMove || canDelete" class="absolute left-2.5 top-2.5 flex items-center gap-1.5">
        <UButton
          v-if="canMove"
          icon="i-lucide-folder-symlink"
          size="xs"
          color="neutral"
          variant="solid"
          class="border border-white/10 bg-black/70 text-chalk backdrop-blur-sm hover:bg-gold hover:text-black"
          aria-label="Mover video a otra carpeta"
          @click.stop.prevent="emit('move')"
        />
        <UButton
          v-if="canDelete"
          icon="i-lucide-trash-2"
          size="xs"
          color="neutral"
          variant="solid"
          class="border border-white/10 bg-black/70 text-chalk backdrop-blur-sm hover:bg-red-600 hover:text-white"
          aria-label="Eliminar video"
          @click.stop.prevent="emit('delete')"
        />
      </div>

      <div v-if="progress" class="absolute inset-x-0 bottom-0 h-[3px] bg-white/10">
        <div class="h-full bg-gold" :style="{ width: `${progress}%` }" />
      </div>
    </div>

    <div :class="dense ? 'px-3 py-2.5' : 'px-4 py-3.5'">
      <p
        class="truncate font-medium text-chalk transition group-hover:text-gold"
        :class="[dense ? 'text-xs' : 'text-sm', video.locked && 'text-ash']"
      >{{ video.name }}</p>
      <p
        v-if="video.size && dense"
        class="mt-0.5 truncate text-[10px] uppercase tracking-wider text-ash"
      >{{ formatSize(video.size) }}</p>
    </div>
  </component>
</template>
