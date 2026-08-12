<script setup lang="ts">
/** A folder tile: the home page's collection list and the folder browser's
 *  subfolder grid render the same object, so they render the same card. */
defineProps<{
  folder: { name: string; prefix: string }
  /** Optional line under the name — video count, date range, whatever fits. */
  meta?: string
}>()
</script>

<template>
  <NuxtLink
    :to="folderPath(folder.prefix)"
    class="group relative flex items-center gap-4 overflow-hidden rounded-xl border border-hair bg-card p-4 transition duration-300 hover:-translate-y-1 hover:border-gold/50 hover:shadow-[0_18px_40px_-24px_rgba(234,157,19,0.55)]"
  >
    <!-- Gold wash that only shows on hover; keeps the resting card flat black. -->
    <div class="pointer-events-none absolute inset-0 bg-gradient-to-r from-gold/[0.07] to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />

    <div class="relative grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-gold-dim bg-gold-bg text-gold transition duration-300 group-hover:border-gold/60">
      <UIcon name="i-lucide-folder" class="h-5 w-5" />
    </div>

    <div class="relative min-w-0 flex-1">
      <p class="truncate font-display text-lg font-bold uppercase leading-tight tracking-tight text-chalk transition group-hover:text-gold">
        {{ folder.name }}
      </p>
      <p v-if="meta" class="mt-0.5 truncate text-[11px] uppercase tracking-widest text-ash">{{ meta }}</p>
    </div>

    <UIcon
      name="i-lucide-arrow-right"
      class="relative h-4 w-4 shrink-0 text-ash transition duration-300 group-hover:translate-x-1 group-hover:text-gold"
    />
  </NuxtLink>
</template>
