<script setup lang="ts">
const route = useRoute()
const hasError = computed(() => route.query.error === 'oauth')

useSeoMeta({ title: 'Iniciar sesión' })
</script>

<template>
  <div class="flex flex-col items-center justify-center py-24 gap-6">
    <AppLogo height="h-20" />
    <h1 class="text-2xl font-bold">Videoteca de miembros</h1>
    <p class="text-gray-500 dark:text-gray-400 text-sm max-w-md text-center">
      El acceso está limitado a miembros de Discord aprobados.
    </p>
    <UButton
      to="/auth/discord"
      external
      size="lg"
      color="primary"
      icon="i-lucide-log-in"
      label="Continuar con Discord"
    />
    <UAlert
      v-if="hasError"
      color="error"
      variant="subtle"
      title="Error al iniciar sesión"
      description="Tu cuenta de Discord no está autorizada o algo salió mal. Contacta a un administrador si crees que es un error."
      icon="i-lucide-alert-triangle"
      class="max-w-md"
    />
  </div>
</template>
