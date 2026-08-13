import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { AccessDecision } from '~~/server/utils/access'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const key = decodeURIComponent(getRouterParam(event, 'key') ?? '')
  if (!key) throw createError({ statusCode: 400, message: 'Clave de video faltante' })

  const config = useRuntimeConfig()
  const s3 = new S3Client({
    region: config.awsRegion,
    credentials: {
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey
    }
  })

  try {
    const result = await s3.send(
      new HeadObjectCommand({ Bucket: config.s3Bucket, Key: key })
    )

    const group = resolveGroup(user.roles)
    const override = (await getVideoOverrides([key])).get(key)
    const uploadedAt = override?.uploadedAt ?? result.LastModified?.getTime() ?? null
    // Admins (by Discord role ID) bypass folder and window rules — folders
    // hidden from both tiers are exactly the admin-only ones.
    const decision: AccessDecision = isAdmin(user.roleIds)
      ? { allowed: true }
      : checkVideoAccess({ group, key, uploadedAt, rules: await getAccessRules() })

    return {
      key,
      // Basename, not the full key: the page title and player overlay show
      // this, and the rename modal pre-fills it — a path here ends up baked
      // into saved display names.
      name: override?.displayName ?? (key.split('/').pop() ?? key).replace(/\.[^/.]+$/, ''),
      size: result.ContentLength,
      thumb: signVideoUrl(`${key}.jpg`, config),
      url: decision.allowed ? signVideoUrl(key, config) : null,
      locked: !decision.allowed,
      lockReason: decision.reason ?? null,
    }
  } catch (err: any) {
    if (err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
      throw createError({ statusCode: 404, message: 'Video no encontrado' })
    }
    throw createError({ statusCode: 500, message: 'Error al obtener el video' })
  }
})
