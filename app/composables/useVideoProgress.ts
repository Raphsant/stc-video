export function useVideoProgress() {
  const { data } = useFetch('/api/progress/history')

  const progressMap = computed(() => {
    const map: Record<string, number> = {}
    for (const item of (data.value as any[] ?? [])) {
      if (item.duration > 0) {
        map[item.videoKey] = Math.min(100, Math.round((item.timestamp / item.duration) * 100))
      }
    }
    return map
  })

  return { progressMap }
}
