import { defineMongooseModel } from '#nuxt/mongoose'

// Singleton document (key: 'global') holding the admin-editable access rules.
// Replaces the previously hardcoded GROUP_RULES / RESTRICTED_FOLDERS in
// server/utils/access.ts. Read through getAccessRules() (cached), written by
// PUT /api/admin/access.
export const AccessConfig = defineMongooseModel({
  name: 'AccessConfig',
  schema: {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    // Time window per tier, in days back from now. null = unlimited.
    alphaDaysBack: {
      type: Number,
      default: null,
    },
    deltaDaysBack: {
      type: Number,
      default: 30,
    },
    // Folder restrictions: an S3 key is denied for a group when ANY rule
    // whose prefix matches it has that group set to false. `noWindow: true`
    // exempts the subtree from the time window (always available). Only
    // non-default entries are stored (a folder with both groups allowed and
    // no exemption has no rule).
    folderRules: {
      type: [
        {
          prefix: { type: String, required: true },
          alpha: { type: Boolean, default: true },
          delta: { type: Boolean, default: true },
          noWindow: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
  },
  options: { timestamps: true },
})
