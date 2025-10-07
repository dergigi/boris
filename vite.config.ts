import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error Node built-in types may be missing in editor, available at build time
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 9802
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx', '.json'],
    conditions: ['import', 'module', 'browser', 'default'],
    preserveSymlinks: false,
    mainFields: ['module', 'jsnext:main', 'jsnext', 'main'],
    alias: {
      // applesauce-core publishes async-event-store.js in some environments, but exports map can block deep resolution on Vercel
      // We don't use the async store; stub it to avoid bundler trying to resolve it
      'applesauce-core/dist/event-store/async-event-store.js': path.resolve(new URL('./src/shims/applesauce/async-event-store.js', import.meta.url).pathname)
    }
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

