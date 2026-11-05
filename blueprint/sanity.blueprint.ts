import {
  defineBlueprint,
  defineContextKnowledgeBase,
  defineContextMcpEndpoint,
  defineDocumentFunction,
} from '@sanity/blueprints'
import 'dotenv/config'
import {
  AUTHORING_ENDPOINT,
  DATASET,
  KNOWLEDGE_BASE_NAME,
  KNOWLEDGE_BASE_TITLE,
  MCP_ENDPOINT,
  ORGANIZATION_ID,
  PROJECT_ID,
} from './lib/config'
import {AUTHORING_INSTRUCTIONS, PAGE_BUILDER_INSTRUCTIONS} from './lib/instructions'

const {PREVIEW_BASE_URL = 'http://localhost:3000', BUILD_MODEL = 'claude-opus-5-5'} = process.env

// Forwarded to both Functions so lib/config resolves the same values at run time
const runtimeEnv = {
  CONTEXT_PROJECT_ID: PROJECT_ID,
  CONTEXT_DATASET: DATASET,
  CONTEXT_ORGANIZATION_ID: ORGANIZATION_ID,
  MCP_ENDPOINT,
  KNOWLEDGE_BASE_TITLE,
}

const dataset = {type: 'dataset' as const, id: `${PROJECT_ID}.${DATASET}`}

// The organization's Knowledge Base for Rules. A deploy creates it empty; scripts/connect-rules.mjs attaches the
// Rules as its dataset source and runs the first build.
const pageRules = defineContextKnowledgeBase({
  name: KNOWLEDGE_BASE_NAME,
  title: KNOWLEDGE_BASE_TITLE,
  description:
    'Editorial rules for turning a marketing brief into a landing page: voice, copy mechanics, terminology, composition, images, and SEO. It does not contain product facts; facts come only from the brief.',
  lifecycle: {deletionPolicy: 'protect'},
})

export default defineBlueprint({
  resources: [
    pageRules,

    // Knowledge Base mode only. Adding a dataset source here would silently switch it to GROQ mode.
    defineContextMcpEndpoint({
      name: MCP_ENDPOINT,
      title: 'Page builder',
      sources: [pageRules],
      instructions: PAGE_BUILDER_INSTRUCTIONS,
    }),

    // The same Rules for engineers' coding agents, so no repo skill restates them
    defineContextMcpEndpoint({
      name: AUTHORING_ENDPOINT,
      title: 'Authoring',
      sources: [pageRules],
      instructions: AUTHORING_INSTRUCTIONS,
    }),

    defineDocumentFunction({
      name: 'build-page',
      src: './functions/build-page',
      project: PROJECT_ID,
      timeout: 600,
      memory: 2,
      event: {
        on: ['create', 'update'],
        resource: dataset,
        // Only a new buildRequestedAt starts a Build, so the Function's own patches don't loop. On a
        // create there is no "before", so changedAny is false: front doors create Briefs with it set.
        filter:
          '_type == "brief" && defined(buildRequestedAt) && (delta::operation() == "create" || delta::changedAny(buildRequestedAt))',
        projection:
          '{_id, title, text, status, submittedVia, buildRequestedAt, "file": document.asset->{url, originalFilename, mimeType, size}}',
      },
      env: {...runtimeEnv, PREVIEW_BASE_URL, BUILD_MODEL},
    }),

    defineDocumentFunction({
      name: 'sync-rules',
      src: './functions/sync-rules',
      project: PROJECT_ID,
      timeout: 600,
      event: {
        on: ['create', 'update', 'delete'],
        resource: dataset,
        filter: '_type == "rule"',
        projection: '{_id, "operation": delta::operation()}',
      },
      env: runtimeEnv,
    }),
  ],
})
