<script setup>
import 'vidstack/player/styles/default/theme.css'
import 'vidstack/bundle'
import 'vidstack/icons'

const props = defineProps({
  src: String,
  title: String,
  videoKey: String,
})

const player = ref(null)
const duration = ref(0)

async function onCanPlay(event) {
  duration.value = event.detail.duration
  const { timestamp } = await $fetch(`/api/progress/${encodeURIComponent(props.videoKey)}`)
  if (timestamp > 5) {
    player.value.currentTime = timestamp
  }
}

function onPause() {
  $fetch(`/api/progress/${encodeURIComponent(props.videoKey)}`, {
    method: 'PUT',
    body: { timestamp: player.value.currentTime, duration: duration.value },
  })
}

function onEnded() {
  $fetch(`/api/progress/${encodeURIComponent(props.videoKey)}`, {
    method: 'PUT',
    body: { timestamp: 0, duration: duration.value },
  })
}
</script>

<template>
  <ClientOnly>
    <media-player
      ref="player"
      :title="title"
      :src="src"
      class="w-full rounded"
      preload="metadata"
      @can-play="onCanPlay"
      @pause="onPause"
      @ended="onEnded"
    >
      <media-provider></media-provider>
      <media-video-layout></media-video-layout>
    </media-player>
  </ClientOnly>
</template>