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
  } catch {}
  try {
    if (!branch) branch = execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {}
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

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __GIT_COMMIT__: JSON.stringify(commit),
    __GIT_BRANCH__: JSON.stringify(branch),
    __BUILD_TIME__: JSON.stringify(buildTime)
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: null,
      manifest: {
        name: 'Boris - Nostr Bookmarks',
        short_name: 'Boris',
        description: 'Your reading list for the Nostr world. A minimal nostr client for bookmark management with highlights.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#0f172a',
        background_color: '#0b1220',
        orientation: 'any',
        categories: ['productivity', 'social', 'utilities'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        globIgnores: ['**/_headers', '**/_redirects', '**/robots.txt']
      },
      devOptions: {
        enabled: true,
        type: 'module'
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
    include: ['applesauce-core', 'applesauce-factory', 'applesauce-relay', 'applesauce-react'],
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
    noExternal: ['applesauce-core', 'applesauce-factory', 'applesauce-relay']
  }
})

