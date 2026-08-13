import { S3Client } from '@aws-sdk/client-s3'

// Every endpoint that touches the bucket builds the same client from
// runtimeConfig. New endpoints should reach for this instead of repeating it.
export function createS3Client(): { s3: S3Client; bucket: string } {
  const config = useRuntimeConfig()
  return {
    s3: new S3Client({
      region: config.awsRegion,
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
    }),
    bucket: config.s3Bucket,
  }
}

// S3 reports a missing object under several shapes depending on the command
// (HeadObject throws NotFound, GetObject throws NoSuchKey).
export function isNotFound(err: any): boolean {
  return (
    err?.name === 'NotFound' ||
    err?.name === 'NoSuchKey' ||
    err?.$metadata?.httpStatusCode === 404
  )
}
