import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'
import type { Plugin } from 'rollup'

const removeExportPlugin = (): Plugin => ({
  name: 'remove-export',
  renderChunk(code, chunk) {
    if (chunk.fileName === 'preload.cjs') {
      return code.replace(/export default [^;]+;/g, 'require_preload();')
    }
    return null
  },
  generateBundle(_, bundle) {
    const chunk = bundle['preload.cjs']
    if (chunk && chunk.type === 'chunk') {
      chunk.code = chunk.code.replace(/export default [^;]+;/g, 'require_preload();')
    }
  }
})

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart(options) {
          options.startup()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['better-sqlite3'],
              output: {
                format: 'cjs'
              }
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              output: {
                format: 'cjs',
                entryFileNames: 'preload.cjs'
              },
              plugins: [removeExportPlugin()]
            }
          }
        }
      }
    ]),
    renderer()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
