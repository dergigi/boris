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
    // Disable strict package exports resolution to allow Rollup to resolve
    // internal modules in packages with restrictive exports maps
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
        // Ensure ESM output
        format: 'es'
      }
    }
  },
  // Force pre-bundling of problematic packages
  ssr: {
    noExternal: ['applesauce-core', 'applesauce-factory', 'applesauce-relay']
  }
})

