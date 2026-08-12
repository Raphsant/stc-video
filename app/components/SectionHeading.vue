<script setup lang="ts">
/**
 * The section rhythm used across every page: gold eyebrow → condensed display
 * heading → hairline rule. Keeping it in one component is what stops the
 * headings on /all, the folder browser and the home page from drifting apart.
 */
withDefaults(defineProps<{
  eyebrow?: string
  title: string
  /** Count chip after the title, e.g. the number of videos in a folder. */
  count?: number | string | null
  /** Renders a "Ver todo →" link on the right. */
  to?: string
  linkLabel?: string
  /** The fading hairline under the heading. Off for tight, stacked headings. */
  rule?: boolean
}>(), {
  linkLabel: 'Ver todo',
  rule: true,
})
</script>

<template>
  <div class="mb-6">
    <div class="flex items-end justify-between gap-4">
      <div class="min-w-0">
        <p v-if="eyebrow" class="stc-eyebrow mb-2.5">{{ eyebrow }}</p>
        <div class="flex items-baseline gap-3">
          <h2 class="truncate font-display text-2xl font-extrabold uppercase leading-none tracking-tight text-chalk sm:text-3xl">
            {{ title }}
          </h2>
          <span
            v-if="count != null"
            class="shrink-0 font-display text-lg font-bold leading-none text-gold-dark"
          >{{ count }}</span>
        </div>
      </div>

      <slot name="action">
        <NuxtLink
          v-if="to"
          :to="to"
          class="group flex shrink-0 items-center gap-1.5 pb-1 text-xs font-semibold uppercase tracking-widest text-ash transition hover:text-gold"
        >
          <span>{{ linkLabel }}</span>
          <UIcon name="i-lucide-arrow-right" class="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </NuxtLink>
      </slot>
    </div>

    <div v-if="rule" class="stc-rule mt-4" />
  </div>
</template>
