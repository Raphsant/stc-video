export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const config = useRuntimeConfig()
  const { key } = getRouterParams(event)

  return { url: signVideoUrl(decodeURIComponent(key), config) }
})
