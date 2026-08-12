<script setup lang="ts">
const route = useRoute()
const hasError = computed(() => route.query.error === 'oauth')

useSeoMeta({ title: 'Iniciar sesión' })
</script>

<template>
  <div class="flex min-h-[60vh] items-center justify-center py-10">
    <div class="w-full max-w-lg text-center">
      <AppLogo height="h-20" class="mx-auto" />

      <p class="stc-eyebrow mt-10">Acceso privado</p>

      <h1 class="mt-5 font-display text-[clamp(2.5rem,9vw,4rem)] font-extrabold uppercase leading-[0.9] tracking-tight text-chalk">
        Videoteca<br><span class="stc-gold-text">de miembros</span>
      </h1>

      <p class="mx-auto mt-6 max-w-sm text-sm leading-relaxed text-ash">
        Sesiones en vivo, análisis de premarket, revisiones de trades y Q&amp;A.
        El acceso está limitado a miembros aprobados de la comunidad.
      </p>

      <UButton
        to="/auth/discord"
        external
        size="xl"
        color="primary"
        icon="i-simple-icons-discord"
        label="Continuar con Discord"
        class="mt-9 justify-center px-8 font-semibold uppercase tracking-wider"
      />

      <UAlert
        v-if="hasError"
        color="error"
        variant="subtle"
        title="Error al iniciar sesión"
        description="Tu cuenta de Discord no está autorizada o algo salió mal. Contacta a un administrador si crees que es un error."
        icon="i-lucide-alert-triangle"
        class="mt-8 text-left"
      />

      <div class="stc-rule mx-auto mt-12 max-w-xs" />
      <p class="mt-6 text-[10px] uppercase tracking-[0.22em] text-ash">
        Stocks Trading Club
      </p>
    </div>
  </div>
</template>
