import {defineMongooseModel} from "#nuxt/mongoose";

export const videoProgress = defineMongooseModel({
    name: 'VideoProgress',
    schema: {
        userId: {
            type: String,
            required: true,
        },
        videoKey: {
            type: String,
            required: true,
        },
        timestamp: {
            type: Number,
            required: true,
        },
        duration: {
            type: Number,
            default: 0,
        },
    },
    options: {timestamps: true},
    hooks(schema) {
        schema.index({userId: 1, videoKey: 1}, {unique: true})
    }
})
