<script setup lang="ts">
// Members share these links in Discord, so the default unfurl is worth setting.
// og:image has to be absolute — derive the origin from the request instead of
// hardcoding a domain that would break between local, preview and production.
const origin = useRequestURL().origin

useSeoMeta({
  description: 'Videoteca privada de Stocks Trading Club: premarket, livetrading, revisiones de trades y Q&A.',
  ogSiteName: 'Stocks Trading Club',
  ogType: 'website',
  ogTitle: 'Stocks Trading Club · Videoteca',
  ogDescription: 'Videoteca privada de Stocks Trading Club: premarket, livetrading, revisiones de trades y Q&A.',
  ogImage: `${origin}/og-image.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  twitterCard: 'summary_large_image',
})
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage/>
    </NuxtLayout>
  </UApp>
</template>
