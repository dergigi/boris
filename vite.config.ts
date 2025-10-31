/* eslint-env node */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

function getGitMetadata() {
  const envSha = process.env.VERCEL_GIT_COMMIT_SHA || ''
  const envRef = process.env.VERCEL_GIT_COMMIT_REF || ''
  let commit = envSha
  let branch = envRef
  try {
    if (!commit) commit = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    // ignore
  }
  try {
    if (!branch) branch = execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    // ignore
  }
  return { commit, branch }
}

function getPackageVersion() {
  try {
    const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)).toString())
    return pkg.version as string
  } catch {
    return '0.0.0'
  }
}

const { commit, branch } = getGitMetadata()
const version = getPackageVersion()
const buildTime = new Date().toISOString()

function getReleaseUrl(version: string): string {
  if (!version) return ''
  const provider = process.env.VERCEL_GIT_PROVIDER || ''
  const owner = process.env.VERCEL_GIT_REPO_OWNER || ''
  const slug = process.env.VERCEL_GIT_REPO_SLUG || ''
  if (provider.toLowerCase() === 'github' && owner && slug) {
    return `https://github.com/${owner}/${slug}/releases/tag/v${version}`
  }
  try {
    const remote = execSync('git config --get remote.origin.url', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    if (remote.includes('github.com')) {
      // git@github.com:owner/repo.git or https://github.com/owner/repo.git
      const https = remote.startsWith('git@')
        ? `https://github.com/${remote.split(':')[1]}`
        : remote
      const cleaned = https.replace(/\.git$/, '')
      return `${cleaned}/releases/tag/v${version}`
    }
  } catch {
    // ignore
  }
  return ''
}

function getCommitUrl(commit: string): string {
  if (!commit) return ''
  const provider = process.env.VERCEL_GIT_PROVIDER || ''
  const owner = process.env.VERCEL_GIT_REPO_OWNER || ''
  const slug = process.env.VERCEL_GIT_REPO_SLUG || ''
  if (provider.toLowerCase() === 'github' && owner && slug) {
    return `https://github.com/${owner}/${slug}/commit/${commit}`
  }
  try {
    const remote = execSync('git config --get remote.origin.url', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    if (remote.includes('github.com')) {
      // git@github.com:owner/repo.git or https://github.com/owner/repo.git
      const https = remote.startsWith('git@')
        ? `https://github.com/${remote.split(':')[1]}`
        : remote
      const cleaned = https.replace(/\.git$/, '')
      return `${cleaned}/commit/${commit}`
    }
  } catch {
    // ignore
  }
  return ''
}

const releaseUrl = getReleaseUrl(version)
const commitUrl = getCommitUrl(commit)

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __GIT_COMMIT__: JSON.stringify(commit),
    __GIT_BRANCH__: JSON.stringify(branch),
    __BUILD_TIME__: JSON.stringify(buildTime),
    __GIT_COMMIT_URL__: JSON.stringify(commitUrl),
    __RELEASE_URL__: JSON.stringify(releaseUrl)
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: null,
      manifest: {
        name: 'Boris - Read, Highlight, Explore',
        short_name: 'Boris',
        description: 'Your reading list for the Nostr world. A minimal nostr client for bookmark management with highlights.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#0f172a',
        background_color: '#0b1220',
        orientation: 'any',
        categories: ['productivity', 'social', 'utilities'],
        // Web Share Target configuration so the installed PWA shows up in the system share sheet
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'link'
          }
        },
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        globIgnores: ['**/_headers', '**/_redirects', '**/robots.txt'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024 // 3 MiB
      },
      devOptions: {
        enabled: true,
        type: 'module',
        // Use generateSW strategy for dev mode to enable SW testing
        // This creates a working SW in dev mode, while injectManifest is used in production
        navigateFallback: 'index.html'
      }
    })
  ],
  server: {
    port: 9802
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx', '.json'],
    conditions: ['import', 'module', 'browser', 'default'],
    preserveSymlinks: false,
    mainFields: ['module', 'jsnext:main', 'jsnext', 'main']
  },
  optimizeDeps: {
    include: ['applesauce-core', 'applesauce-factory', 'applesauce-relay', 'applesauce-react', 'applesauce-accounts', 'applesauce-signers'],
    esbuildOptions: {
      resolveExtensions: ['.js', '.ts', '.tsx', '.json']
    }
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    },
    rollupOptions: {
      output: {
        format: 'es'
      }
    }
  },
  ssr: {
    noExternal: ['applesauce-core', 'applesauce-factory', 'applesauce-relay', 'applesauce-accounts', 'applesauce-signers']
  }
})

