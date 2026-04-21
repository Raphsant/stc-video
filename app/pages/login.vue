<script setup lang="ts">
const route = useRoute()
const hasError = computed(() => route.query.error === 'oauth')
</script>

<template>
  <div class="flex flex-col items-center justify-center py-24 gap-6">
    <UIcon name="i-lucide-play-circle" class="text-yellow-400 w-16 h-16" />
    <h1 class="text-2xl font-bold">Sign in to STC Video</h1>
    <p class="text-gray-500 dark:text-gray-400 text-sm max-w-md text-center">
      Access is limited to approved Discord members.
    </p>
    <UButton
      to="/auth/discord"
      external
      size="lg"
      color="primary"
      icon="i-lucide-log-in"
      label="Continue with Discord"
    />
    <UAlert
      v-if="hasError"
      color="error"
      variant="subtle"
      title="Sign-in failed"
      description="Your Discord account isn't authorized, or something went wrong. Contact an admin if you think this is a mistake."
      icon="i-lucide-alert-triangle"
      class="max-w-md"
    />
  </div>
</template>
