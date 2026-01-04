import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // General Kie.ai API (Generation, Polling)
      '/api-kie': {
        target: 'https://api.kie.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-kie/, ''),
        secure: true,
      },
      // RedPanda AI (Uploads often use this backend)
      '/api-upload': {
        target: 'https://kieai.redpandaai.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-upload/, ''),
        secure: true,
      }
    }
  }
})
