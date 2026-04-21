import { getSignedUrl } from '@aws-sdk/cloudfront-signer'
import { readFileSync } from 'node:fs'

let cachedKey: string | null = null

function loadPrivateKey(config: ReturnType<typeof useRuntimeConfig>): string {
  if (cachedKey) return cachedKey

  if (config.cloudfrontPrivateKey) {
    cachedKey = (config.cloudfrontPrivateKey as string).replace(/\\n/g, '\n')
    return cachedKey
  }

  if (config.cloudfrontPrivateKeyPath) {
    cachedKey = readFileSync(config.cloudfrontPrivateKeyPath as string, 'utf-8')
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
