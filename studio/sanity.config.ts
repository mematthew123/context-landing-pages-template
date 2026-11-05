import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {presentationTool} from 'sanity/presentation'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'
import {SINGLETON_TYPES, structure} from './structure'
import {resolve} from './presentation'
import {BuildPageAction} from './actions/BuildPageAction'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID
const dataset = process.env.SANITY_STUDIO_DATASET || 'production'
if (!projectId) throw new Error('Set SANITY_STUDIO_PROJECT_ID in studio/.env (see .env.example)')

// The web app Presentation loads; set it to the deployed URL before `sanity deploy`
const previewUrl = process.env.SANITY_STUDIO_PREVIEW_URL || 'http://localhost:3000'

export default defineConfig({
  name: 'default',
  title: 'Context Landing Pages',

  projectId,
  dataset,

  plugins: [
    structureTool({structure}),
    presentationTool({
      resolve,
      previewUrl: {initial: previewUrl, previewMode: {enable: '/api/draft-mode/enable'}},
    }),
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
    templates: (templates) => templates.filter(({schemaType}) => !SINGLETON_TYPES.has(schemaType)),
  },

  document: {
    actions: (prev, context) => {
      if (SINGLETON_TYPES.has(context.schemaType)) return []
      return context.schemaType === 'brief' ? [BuildPageAction, ...prev] : prev
    },
  },
})
