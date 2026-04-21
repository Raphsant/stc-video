<script setup>
import 'vidstack/player/styles/default/theme.css'
import 'vidstack/bundle'
import 'vidstack/icons';

defineProps({
  src: String,
  title: String
})
</script>

<template>
  <ClientOnly>
    <media-player :title="title" :src="src" class="w-full rounded" preload="metadata">
      <media-provider></media-provider>
      <media-video-layout></media-video-layout>
    </media-player>
  </ClientOnly>
</template>
