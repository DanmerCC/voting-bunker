import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  // MPA: dos entradas HTML
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main:       resolve(__dirname, 'index.html'),
        validating: resolve(__dirname, 'validando-voto/index.html'),
      },
    },
    // Minificación agresiva con esbuild (incluido en Vite, sin instalar nada extra)
    minify: 'esbuild',
    // Separar chunks del vendor
    chunkSizeWarningLimit: 200,
  },

  // Tailwind entra como plugin PostCSS — no CDN
  css: {
    postcss: './postcss.config.js',
  },
})
