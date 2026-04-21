import { defineMongooseModel } from '#nuxt/mongoose'

export const DiscordUser = defineMongooseModel({
  name: 'DiscordUser',
  schema: {
    _id: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    roles: {
      type: [String],
      default: [],
    },
    previousUsernames: {
      type: [String],
      default: [],
    },
    messageCount: {
      type: Number,
      default: 0,
    },
  },
})
