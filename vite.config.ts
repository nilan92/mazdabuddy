import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// https://vite.dev/config/
export default defineConfig({
  base: '/mazdabuddy/',
  build: {
    sourcemap: true, // Required for Sentry source maps
  },
  plugins: [
    react(),
    tailwindcss(),
    // Upload source maps to Sentry on production builds
    ...(process.env.SENTRY_AUTH_TOKEN ? [sentryVitePlugin({
      org: 'nilanhobbies',
      project: 'javascript-react',
      authToken: process.env.SENTRY_AUTH_TOKEN,
      url: 'https://de.sentry.io/',
      telemetry: false,
    })] : []),
  ],
})
