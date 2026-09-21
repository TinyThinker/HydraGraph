import { execSync } from 'node:child_process'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Short SHA of the build, stamped into the UI so a bug report identifies which
 * build it came from. Cloudflare Pages sets `CF_PAGES_COMMIT_SHA`; locally we
 * ask git. Neither is guaranteed, and a missing stamp must never fail a build.
 */
function buildSha(): string {
  const fromCI = process.env.CF_PAGES_COMMIT_SHA
  if (fromCI) return fromCI.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'unknown'
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __BUILD_SHA__: JSON.stringify(buildSha()),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
