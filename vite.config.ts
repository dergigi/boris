import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

// Custom plugin to resolve applesauce-core internal modules
// Workaround for restrictive exports field blocking internal imports
const applesauceResolver = (): Plugin => ({
  name: 'applesauce-resolver',
  resolveId(source, importer) {
    if (importer && source.startsWith('./') && importer.includes('applesauce-core/dist/event-store')) {
      // Resolve relative imports within applesauce-core/dist/event-store
      const resolved = path.resolve(path.dirname(importer), source)
      return resolved
    }
    return null
  }
})

export default defineConfig({
  plugins: [react(), applesauceResolver()],
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

