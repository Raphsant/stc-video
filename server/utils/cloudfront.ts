import { getSignedUrl } from '@aws-sdk/cloudfront-signer'
import { readFileSync } from 'node:fs'

let cachedKey: string | null = null

function loadPrivateKey(config: ReturnType<typeof useRuntimeConfig>) {
  if (cachedKey) return cachedKey

  if (config.cloudfrontPrivateKey) {
      console.log('Using inline CloudFront private key')
    cachedKey = (config.cloudfrontPrivateKey as string).replace(/\\n/g, '\n')
    return cachedKey
  }

  if (config.cloudfrontPrivateKeyPath) {
      console.log('no Using inline CloudFront private key')
    cachedKey = readFileSync(config.cloudfrontPrivateKeyPath as string, 'utf-8')
    return cachedKey
  }

  throw new Error('No CloudFront private key configured')
}

export function signVideoUrl(key: string, config: ReturnType<typeof useRuntimeConfig>) {
  if (!config.cloudfrontKeyPairId) throw new Error('CLOUDFRONT_KEY_PAIR_ID is not set')

  return getSignedUrl({
    url: `https://${config.public.cloudfrontDomain}/${encodeURIComponent(key).replace(/%2F/g, '/')}`,
    keyPairId: config.cloudfrontKeyPairId as string,
    privateKey: loadPrivateKey(config),
    dateLessThan: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
  })
}
