import { defineMongooseModel } from '#nuxt/mongoose'

// Per-video metadata overrides, layered on top of the S3-derived truth.
// The app lists/serves videos straight from S3 (the key is the identity);
// this collection records admin edits that S3 can't express.
//
// Keyed by the full S3 key. Currently only `displayName` (a rename override);
// future fields (virtualFolder, visibility, etc.) belong here too.
export const VideoMeta = defineMongooseModel({
  name: 'VideoMeta',
  schema: {
    s3Key: {
      type: String,
      required: true,
      unique: true,
    },
    // Human-set name shown instead of the filename-derived one.
    // null/absent means "fall back to the filename".
    displayName: {
      type: String,
      default: null,
    },
  },
  options: { timestamps: true },
  hooks(schema) {
    schema.index({ s3Key: 1 }, { unique: true })
  },
})
