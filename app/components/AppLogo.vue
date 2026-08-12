<script setup lang="ts">
/**
 * The Stocks Trading Club wordmark.
 *
 * Only the dark variant is shipped: the app has a single surface (#000), so
 * the light-background artwork in `logo.png` — whose "TRADING CLUB" script is
 * near-black on transparency — would be invisible everywhere it appeared.
 */
withDefaults(defineProps<{
  /** Rendered height. The wordmark is 320x132, so width follows at ~2.42:1. */
  height?: string
  alt?: string
}>(), {
  height: 'h-9',
  alt: 'Stocks Trading Club',
})
</script>

<template>
  <span class="inline-flex shrink-0">
    <img
      src="/logo-dark.png"
      :alt="alt"
      width="320"
      height="132"
      :class="height"
      class="w-auto"
    >
  </span>
</template>
