import { getSignedUrl } from '@aws-sdk/cloudfront-signer'
import { readFileSync } from 'node:fs'
import { createPrivateKey } from 'node:crypto'

let cachedKey: string | null = null

// Env vars can't safely carry a multi-line PEM, so we also accept a base64-encoded
// key (the recommended, transport-safe form). If the value has no PEM header,
// assume it's base64 of the whole key file and decode it.
function decodeKeyMaterial(raw: string): string {
  const value = raw.trim()
  if (value.includes('-----BEGIN')) return value
  return Buffer.from(value, 'base64').toString('utf-8')
}

function normalizePem(raw: string): string {
  // Unescape literal \n sequences (single-line env-var form)
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

  const source = config.cloudfrontPrivateKey
    ? decodeKeyMaterial(config.cloudfrontPrivateKey as string)
    : config.cloudfrontPrivateKeyPath
      ? readFileSync(config.cloudfrontPrivateKeyPath as string, 'utf-8')
      : null

  if (!source) {
    throw new Error('No CloudFront private key configured (set NUXT_CLOUDFRONT_PRIVATE_KEY or NUXT_CLOUDFRONT_PRIVATE_KEY_PATH)')
  }

  const pem = normalizePem(source)

  // Validate now so a malformed key fails with a clear message instead of an
  // opaque "DECODER routines::unsupported" error deep inside the signer.
  try {
    createPrivateKey(pem)
  } catch (err) {
    console.error(
      '[cloudfront] private key did not parse as PEM. Recommended fix: set ' +
      'NUXT_CLOUDFRONT_PRIVATE_KEY to the base64 of the key file ' +
      '(`openssl base64 -A -in private_key.pem`).',
    )
    throw err
  }

  cachedKey = pem
  return cachedKey
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
