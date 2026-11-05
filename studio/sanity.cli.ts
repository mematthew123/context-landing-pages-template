import {defineCliConfig} from 'sanity/cli'

// Values come from studio/.env (see .env.example), which the Sanity CLI loads automatically
export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID,
    dataset: process.env.SANITY_STUDIO_DATASET || 'production',
  },
  deployment: {
    // Set after the first `sanity deploy`, so later deploys update the same Studio
    appId: process.env.SANITY_STUDIO_APP_ID,
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/studio/latest-version-of-sanity#k47faf43faf56
     */
    autoUpdates: true,
  },
  typegen: {
    enabled: true,
    path: '../web/src/**/*.{ts,tsx,js,jsx}',
    schema: 'schema.json',
    generates: '../web/sanity.types.d.ts',
    overloadClientMethods: true,
  },
})
