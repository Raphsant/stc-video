import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const config = useRuntimeConfig()
  const key = decodeURIComponent(getRouterParam(event, 'key') ?? '')
  if (!key) throw createError({ statusCode: 400, message: 'Clave de video faltante' })

  const group = resolveGroup(user.roles)

  const s3 = new S3Client({
    region: config.awsRegion,
    credentials: {
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey,
    },
  })

  let uploadedAt: number | null = null
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: config.s3Bucket, Key: key }))
    uploadedAt = head.LastModified?.getTime() ?? null
  } catch (err: any) {
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
      throw createError({ statusCode: 404, message: 'Video no encontrado' })
    }
    throw createError({ statusCode: 500, message: 'Error al obtener el video' })
  }

  // uploadedAt overrides (set on folder moves) take precedence over S3
  // LastModified — a moved file's LastModified is the move time, not the
  // original availability date.
  // Admins (by Discord role ID) bypass folder and window rules — folders
  // hidden from both tiers are exactly the admin-only ones.
  if (!isAdmin(user.roleIds)) {
    const override = (await getVideoOverrides([key])).get(key)
    const decision = checkVideoAccess({
      group,
      key,
      uploadedAt: override?.uploadedAt ?? uploadedAt,
      rules: await getAccessRules(),
    })
    if (!decision.allowed) {
      throw createError({
        statusCode: 403,
        message: 'No tienes acceso a este video',
        data: { reason: decision.reason },
      })
    }
  }

  return { url: signVideoUrl(key, config) }
})
