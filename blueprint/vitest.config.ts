import {defineConfig} from 'vitest/config'

// lib/config requires these at import time; tests only need placeholders
export default defineConfig({
  test: {env: {CONTEXT_PROJECT_ID: 'test-project', CONTEXT_ORGANIZATION_ID: 'test-org'}},
})
