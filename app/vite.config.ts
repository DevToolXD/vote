import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Libraries in their own files: an app update doesn't change them, so the
        // browser keeps using its cached copy and only fetches the app code again.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@firebase/firestore') || id.includes('firebase/firestore')) return 'fb-firestore'
          if (id.includes('@firebase/database') || id.includes('firebase/database')) return 'fb-database'
          if (id.includes('@firebase/auth') || id.includes('firebase/auth')) return 'fb-auth'
          if (id.includes('@firebase/messaging') || id.includes('firebase/messaging') || id.includes('@capacitor')) return
          if (id.includes('firebase')) return 'fb-core'
          if (id.includes('react')) return 'react'
        },
      },
    },
  },
})
