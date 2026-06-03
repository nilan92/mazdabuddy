import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/mazdabuddy/',
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query', '@tanstack/react-query-persist-client'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-sentry': ['@sentry/react'],
          'vendor-pdf': ['jspdf'],
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
})
