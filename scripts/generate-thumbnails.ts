// Generate JPEG thumbnails for every video in S3 (frame at exactly 1 second)
// Run with:  npx tsx scripts/generate-thumbnails.ts

import { ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/cloudfront-signer'
import { readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { config } from 'dotenv'

config()

const region          = process.env.MY_AWS_REGION!
const accessKeyId     = process.env.MY_AWS_ACCESS_KEY_ID!
const secretAccessKey = process.env.MY_AWS_SECRET_ACCESS_KEY!
const bucket          = process.env.S3_BUCKET!
const cfDomain        = process.env.CLOUDFRONT_DOMAIN!
const cfKeyPairId     = process.env.CLOUDFRONT_KEY_PAIR_ID!
const cfPrivateKey    = readFileSync(process.env.CLOUDFRONT_PRIVATE_KEY_PATH!, 'utf-8')

const s3 = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } })

function signUrl(key: string): string {
  const url = `https://${cfDomain}/${encodeURIComponent(key).replace(/%2F/g, '/')}`
  return getSignedUrl({
    url,
    keyPairId: cfKeyPairId,
    privateKey: cfPrivateKey,
    dateLessThan: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
  })
}

function extractFrame(videoUrl: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const errLines: string[] = []

    const ff = spawn('ffmpeg', [
      '-ss', '00:00:01',   // seek BEFORE -i so ffmpeg uses HTTP range requests (fast, no full download)
      '-i', videoUrl,
      '-vframes', '1',
      '-f', 'image2',
      '-vcodec', 'mjpeg',
      'pipe:1',
    ])

    ff.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    ff.stderr.on('data', (d: Buffer) => errLines.push(d.toString()))
    ff.on('close', (code) => {
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks))
      } else {
        const detail = errLines.join('').split('\n').filter(l => l.includes('Error') || l.includes('error') || l.includes('Invalid') || l.includes('http')).slice(-3).join(' | ')
        reject(new Error(`ffmpeg exited with code ${code}${detail ? ': ' + detail : ''}`))
      }
    })
  })
}

async function listAllKeys(): Promise<string[]> {
  const keys: string[] = []
  let token: string | undefined

  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }))
    for (const obj of res.Contents ?? []) {
      if (obj.Key && !obj.Key.endsWith('/') && obj.Size) keys.push(obj.Key)
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)

  return keys
}

async function main() {
  const allKeys   = await listAllKeys()
  const videoKeys = allKeys.filter(k => !k.endsWith('.jpg'))
  const existing  = new Set(allKeys)

  console.log(`Found ${videoKeys.length} videos\n`)

  for (let i = 0; i < videoKeys.length; i++) {
    const key      = videoKeys[i]
    const thumbKey = `${key}.jpg`
    const label    = `[${i + 1}/${videoKeys.length}]`

    if (existing.has(thumbKey)) {
      console.log(`${label} skip   ${key}`)
      continue
    }

    try {
      const url  = signUrl(key)
      const jpeg = await extractFrame(url)

      await s3.send(new PutObjectCommand({
        Bucket:      bucket,
        Key:         thumbKey,
        Body:        jpeg,
        ContentType: 'image/jpeg',
      }))

      console.log(`${label} ✓      ${key}`)
    } catch (err) {
      console.error(`${label} ✗ FAIL ${key}:`, (err as Error).message)
    }
  }

  console.log('\nDone!')
}

main()
