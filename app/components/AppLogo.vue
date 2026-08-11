<script setup lang="ts">
/**
 * The Stocks Trading Club wordmark.
 *
 * Two files, not one: the "TRADING CLUB" script sits on transparency in near
 * black, so it disappears on dark surfaces. `logo-dark.png` is the same artwork
 * with that band recoloured white — the orange banner is identical in both.
 * Both are swapped with CSS (not `useColorMode()`) so the correct one is right
 * on the very first paint, before the colour-mode script runs.
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
      src="/logo.png"
      :alt="alt"
      width="320"
      height="132"
      :class="height"
      class="w-auto dark:hidden"
    >
    <img
      src="/logo-dark.png"
      :alt="alt"
      width="320"
      height="132"
      :class="height"
      class="w-auto hidden dark:block"
    >
  </span>
</template>
