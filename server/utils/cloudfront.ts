import { getSignedUrl } from '@aws-sdk/cloudfront-signer'
import { readFileSync } from 'node:fs'

let cachedKey: string | null = null

function normalizePem(raw: string): string {
  // Unescape literal \n sequences from env var storage
  const pem = raw.replace(/\\n/g, '\n').trim()
  const header = pem.match(/-----BEGIN ([^-]+)-----/)
  const footer = pem.match(/-----END ([^-]+)-----/)
  if (!header || !footer) return pem

  const type = header[1]
  const body = pem
    .replace(`-----BEGIN ${type}-----`, '')
    .replace(`-----END ${type}-----`, '')
    .replace(/\s+/g, '') // strip all whitespace so we can reformat cleanly

  // OpenSSL 3 requires exactly 64 chars per line in the base64 body
  const lines = (body.match(/.{1,64}/g) ?? []).join('\n')
  return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----`
}

function loadPrivateKey(config: ReturnType<typeof useRuntimeConfig>): string {
  if (cachedKey) return cachedKey

  if (config.cloudfrontPrivateKey) {
    cachedKey = normalizePem(config.cloudfrontPrivateKey as string)
    return cachedKey
  }

  if (config.cloudfrontPrivateKeyPath) {
    cachedKey = normalizePem(readFileSync(config.cloudfrontPrivateKeyPath as string, 'utf-8'))
    return cachedKey
  }

  throw new Error('No CloudFront private key configured (set CLOUDFRONT_PRIVATE_KEY or CLOUDFRONT_PRIVATE_KEY_PATH)')
}

export function signVideoUrl(key: string, config: ReturnType<typeof useRuntimeConfig>): string {
  const url = `https://${config.public.cloudfrontDomain}/${encodeURIComponent(key).replace(/%2F/g, '/')}`

  if (!config.cloudfrontKeyPairId) {
    console.warn('[cloudfront] CLOUDFRONT_KEY_PAIR_ID not set — serving unsigned URL')
    return url
  }

  try {
    return getSignedUrl({
      url,
      keyPairId: config.cloudfrontKeyPairId as string,
      privateKey: loadPrivateKey(config),
      dateLessThan: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    })
  } catch (err) {
    console.error('[cloudfront] signing failed:', err)
    return url
  }
}
