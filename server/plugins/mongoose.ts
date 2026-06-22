import { defineMongooseConnection } from '#nuxt/mongoose'

// Connect to MongoDB at server startup, reading the URI straight from the
// *runtime* container environment rather than relying on Nuxt's NUXT_* override
// of runtimeConfig (which only maps NUXT_MONGOOSE_URI and is easy to misconfigure
// in Docker/Dockge). We accept either NUXT_MONGOOSE_URI or MONGODB_URI.
//
// Still 100% nuxt-mongoose — defineMongooseConnection is nuxt-mongoose's own
// helper; this file imports no `mongoose` directly.
export default defineNitroPlugin(async () => {
    const uri = process.env.NUXT_MONGOOSE_URI || process.env.MONGODB_URI

    if (!uri) {
        console.error(
            '[mongoose] No Mongo URI found in env — set NUXT_MONGOOSE_URI (or MONGODB_URI) ' +
            'on the container. Mongo queries will buffer and time out until this is set.',
        )
        return
    }

    console.log(`[mongoose] connecting (uri from ${process.env.NUXT_MONGOOSE_URI ? 'NUXT_MONGOOSE_URI' : 'MONGODB_URI'})…`)
    await defineMongooseConnection({ uri })
})
