<script setup lang="ts">
// Admin-only modal to permanently delete a video.
// Single confirm step — the destructive part is spelled out rather than
// hidden behind a typed confirmation. The modal locks while the delete runs.
const props = defineProps<{
  videoKey: string
  videoName?: string
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ deleted: [key: string] }>()

const toast = useToast()
const deleting = ref(false)

const fileName = computed(() => props.videoKey.split('/').pop() ?? props.videoKey)

async function submitDelete() {
  if (deleting.value) return
  deleting.value = true
  try {
    const res = await $fetch('/api/admin/videos/delete', {
      method: 'POST',
      body: { key: props.videoKey },
    })
    toast.add({
      title: 'Video eliminado',
      description: props.videoName ?? fileName.value,
      color: 'success',
      icon: 'i-lucide-check',
    })
    for (const w of res.warnings ?? []) {
      toast.add({ title: 'Aviso', description: w, color: 'warning', icon: 'i-lucide-alert-triangle' })
    }
    open.value = false
    emit('deleted', res.key)
  } catch (err: any) {
    toast.add({
      title: 'No se pudo eliminar el video',
      description: err?.data?.message ?? 'Inténtalo de nuevo',
      color: 'error',
      icon: 'i-lucide-alert-triangle',
    })
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Eliminar video" :dismissible="!deleting">
    <template #body>
      <div class="space-y-4">
        <!-- Which video -->
        <div class="flex items-center gap-2 rounded-lg bg-raised px-3 py-2 text-sm">
          <UIcon name="i-lucide-film" class="w-4 h-4 shrink-0 text-gold" />
          <span class="truncate font-medium">{{ videoName ?? fileName }}</span>
        </div>

        <div class="flex items-start gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          <UIcon name="i-lucide-triangle-alert" class="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Esta acción es permanente. El video, su miniatura y el historial de
            reproducción se eliminarán y no se pueden recuperar.
          </p>
        </div>

        <p class="text-xs text-muted break-all">{{ videoKey }}</p>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="ghost" label="Cancelar" :disabled="deleting" @click="open = false" />
        <UButton
          color="error"
          icon="i-lucide-trash-2"
          label="Eliminar definitivamente"
          :loading="deleting"
          @click="submitDelete"
        />
      </div>
    </template>
  </UModal>
</template>
