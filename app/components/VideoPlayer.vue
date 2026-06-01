<script setup>
import 'vidstack/player/styles/default/theme.css'
import 'vidstack/bundle'
import 'vidstack/icons'

const props = defineProps({
  src: String,
  title: String,
  videoKey: String,
})

const { user } = useUserSession()

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
  <div class="relative">
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
    <div v-if="user" class="watermark" aria-hidden="true">
      {{ user.username }} · {{ user.id }}
    </div>
  </div>
</template>

<style scoped>
.watermark {
  position: absolute;
  z-index: 10;
  pointer-events: none;
  font-size: 12px;
  font-family: monospace;
  color: white;
  opacity: 0.4;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
  white-space: nowrap;
  user-select: none;
  animation: wm-drift 36s linear infinite;
}

@keyframes wm-drift {
  0%   { top: 6%;  left: 3%; }
  20%  { top: 6%;  left: 3%; }
  25%  { top: 6%;  left: 70%; }
  45%  { top: 6%;  left: 70%; }
  50%  { top: 82%; left: 70%; }
  70%  { top: 82%; left: 70%; }
  75%  { top: 82%; left: 3%; }
  95%  { top: 82%; left: 3%; }
  100% { top: 6%;  left: 3%; }
}
</style>