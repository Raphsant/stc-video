// https://nuxt.com/docs/api/configuration/nuxt-config

import { vite as vidstack } from 'vidstack/plugins';
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: {enabled: true},
    modules: ['@nuxt/ui', 'nuxt-auth-utils', 'nuxt-mongoose'],
    mongoose: {
        // URI is injected at runtime from the NUXT_MONGOOSE_URI env var, which Nuxt
        // maps onto runtimeConfig.mongoose.uri. Keep this empty — nuxt-mongoose
        // auto-connects at server startup using the resolved value.
        uri: '',
        options: {
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 5,
            minPoolSize: 0,
            heartbeatFrequencyMS: 10000,
        },
        modelsDir: 'models',
        devtools: true,
    },
    // Every value is injected at runtime from a NUXT_-prefixed env var. Nuxt maps:
    //   NUXT_AWS_REGION              -> awsRegion
    //   NUXT_AWS_ACCESS_KEY_ID       -> awsAccessKeyId
    //   NUXT_AWS_SECRET_ACCESS_KEY   -> awsSecretAccessKey
    //   NUXT_S3_BUCKET               -> s3Bucket
    //   NUXT_CLOUDFRONT_KEY_PAIR_ID  -> cloudfrontKeyPairId
    //   NUXT_CLOUDFRONT_PRIVATE_KEY  -> cloudfrontPrivateKey
    //   NUXT_PUBLIC_CLOUDFRONT_DOMAIN-> public.cloudfrontDomain
    //   NUXT_OAUTH_DISCORD_CLIENT_ID -> oauth.discord.clientId   (etc.)
    // The keys only need to exist here (empty defaults) for the override to apply.
    runtimeConfig: {
        awsRegion: '',
        awsAccessKeyId: '',
        awsSecretAccessKey: '',
        s3Bucket: '',
        cloudfrontKeyPairId: '',
        cloudfrontPrivateKey: '',
        cloudfrontPrivateKeyPath: '',
        oauth: {
            discord: {
                clientId: '',
                clientSecret: '',
                redirectURL: '',
            },
        },
        public: {
            cloudfrontDomain: '',
        },
    },
    css: ['~/assets/css/main.css'],
    vue: {
        compilerOptions: {
            isCustomElement: (tag) => tag.startsWith('media-'),
        },
    },
    vite: {
        plugins: [vidstack()],
    },
})
