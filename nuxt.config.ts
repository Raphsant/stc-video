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
    //   NUXT_BOT_API_URL             -> botApiUrl
    //   NUXT_BOT_API_KEY             -> botApiKey
    // The keys only need to exist here (empty defaults) for the override to apply.
    runtimeConfig: {
        awsRegion: '',
        awsAccessKeyId: '',
        awsSecretAccessKey: '',
        s3Bucket: '',
        cloudfrontKeyPairId: '',
        cloudfrontPrivateKey: '',
        cloudfrontPrivateKeyPath: '',
        // stcbot's internal API (origin only, no path) and its shared secret.
        // Server-only — the key must never reach the client. Left empty the
        // role sync is skipped entirely and roles fall back to MongoDB.
        botApiUrl: '',
        botApiKey: '',
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
    app: {
        head: {
            // String form, not a function: nuxt.config's head is serialized
            // into the build, so a function titleTemplate is silently dropped.
            // `title` here is the fallback for pages that set none.
            title: 'Videoteca',
            titleTemplate: '%s · Stocks Trading Club',
            htmlAttrs: {lang: 'es'},
            link: [
                {rel: 'icon', type: 'image/x-icon', href: '/favicon.ico'},
                {rel: 'icon', type: 'image/png', sizes: '512x512', href: '/icon.png'},
                {rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png'},
            ],
            meta: [
                {name: 'apple-mobile-web-app-title', content: 'STC'},
                {name: 'theme-color', content: '#e99c13'},
            ],
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
