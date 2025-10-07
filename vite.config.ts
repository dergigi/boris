import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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

