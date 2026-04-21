// https://nuxt.com/docs/api/configuration/nuxt-config

import { vite as vidstack } from 'vidstack/plugins';
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: {enabled: true},
    modules: ['@nuxt/ui', 'nuxt-auth-utils', 'nuxt-mongoose'],
    mongoose: {
        uri: process.env.MONGODB_URI,
        options: {},
    },
    runtimeConfig: {
        awsRegion: process.env.MY_AWS_REGION,
        awsAccessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
        awsSecretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
        s3Bucket: process.env.S3_BUCKET,
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
