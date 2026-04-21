<script setup>
import 'vidstack/player/styles/default/theme.css'
import 'vidstack/bundle'

defineProps({
  src: String,
  title: String
})
</script>

<template>
  <media-player :title="title" :src="src" class="w-full rounded" preload="metadata">
    <ClientOnly>
      <media-provider></media-provider>
    </ClientOnly>
  </media-player>
</template>
