// Everything environment-specific comes from env vars: blueprint/.env at deploy time (see
// .env.example), and the Blueprint's `env` block forwards the same values to the Functions at run
// time. Never use SANITY_PROJECT_ID here: the Blueprints CLI reads it as a scope override.

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}. Copy blueprint/.env.example to blueprint/.env and fill it in.`)
  return value
}

export const PROJECT_ID = required('CONTEXT_PROJECT_ID')
export const DATASET = process.env.CONTEXT_DATASET || 'production'
export const ORGANIZATION_ID = required('CONTEXT_ORGANIZATION_ID')

// Context resources. Renaming one after its first deploy replaces it (and the Knowledge Base is
// protected from deletion), so set these once.
export const KNOWLEDGE_BASE_NAME = process.env.KNOWLEDGE_BASE_NAME || 'page-rules'
export const KNOWLEDGE_BASE_TITLE = process.env.KNOWLEDGE_BASE_TITLE || 'Page rules'
export const MCP_ENDPOINT = process.env.MCP_ENDPOINT || 'page-builder'
export const AUTHORING_ENDPOINT = process.env.AUTHORING_ENDPOINT || 'authoring'

export const MCP_URL = `https://api.sanity.io/v1/context/organizations/${ORGANIZATION_ID}/mcp/${MCP_ENDPOINT}`
export const API_VERSION = '2026-11-01'
export const CONTEXT_API_VERSION = '2026-08-25'
// The workspace schema Agent Actions use for image generation (written by `sanity deploy`)
export const SCHEMA_ID = process.env.SCHEMA_ID || '_.schemas.default'
