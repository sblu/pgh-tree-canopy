import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const build = JSON.parse(readFileSync('./build.json', 'utf-8'))
const buildTag = `${build.date}.${build.seq}`

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __BUILD_TAG__: JSON.stringify(buildTag),
  },
  server: {
    host: '0.0.0.0',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
  build: {
    target: 'es2022',
  },
})
