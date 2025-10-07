import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 9802
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx', '.json']
  },
  optimizeDeps: {
    include: ['applesauce-core', 'applesauce-factory', 'applesauce-relay', 'applesauce-react']
  }
})

