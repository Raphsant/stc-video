// https://nuxt.com/docs/api/configuration/nuxt-config

import { vite as vidstack } from 'vidstack/plugins';
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: {enabled: true},
    modules: ['@nuxt/ui', 'nuxt-auth-utils', 'nuxt-mongoose'],
    mongoose: {
        // Local dev reads MONGODB_URI from .env; in Docker the URI is injected at
        // runtime via NUXT_MONGOOSE_URI (Nuxt maps it onto runtimeConfig.mongoose.uri).
        // A bare build-time process.env read bakes an empty string into the image.
        uri: process.env.NUXT_MONGOOSE_URI || process.env.MONGODB_URI || '',
        options: {
            bufferCommands: false,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 10000,
            maxPoolSize: 5,
            minPoolSize: 0,
            heartbeatFrequencyMS: 10000,
        },
        modelsDir: 'models',
        devtools: true,
    },
    runtimeConfig: {
        awsRegion: process.env.MY_AWS_REGION,
        awsAccessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
        awsSecretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
        s3Bucket: process.env.S3_BUCKET,
        cloudfrontKeyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID,
        cloudfrontPrivateKey: process.env.CLOUDFRONT_PRIVATE_KEY,
        cloudfrontPrivateKeyPath: process.env.CLOUDFRONT_PRIVATE_KEY_PATH,
        oauth: {
            discord: {
                clientId: '',
                clientSecret: '',
                redirectURL: '',
            },
        },
        public: {
            cloudfrontDomain: process.env.CLOUDFRONT_DOMAIN
        }
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
