import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'node:path'

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  publicDir: resolve(__dirname, 'src/renderer/public'),
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@shared-types': resolve(__dirname, 'src/types'),
      '@main': resolve(__dirname, 'src/main'),
      '@preload': resolve(__dirname, 'src/preload'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  plugins: [
    {
      name: 'development-csp',
      transformIndexHtml: {
        order: 'post',
        handler(html, context) {
          // React refresh injects an inline preamble in dev only.
          return context.server ? html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '') : html
        },
      },
    },
    react(),
    electron([
      {
        entry: resolve(__dirname, 'src/main/index.ts'),
        vite: {
          build: {
            outDir: resolve(__dirname, 'dist/main'),
            emptyOutDir: true,
            rollupOptions: {
              external: [
                'electron',
                'cross-spawn',
                'tree-kill',
                'node:child_process',
                'node:fs',
                'node:path',
                'node:os',
                'node:url',
                'node:net',
                'node:http',
                'node:https',
                'node:events',
              ],
            },
          },
        },
      },
      {
        entry: resolve(__dirname, 'src/preload/index.ts'),
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: resolve(__dirname, 'dist/preload'),
            emptyOutDir: true,
            lib: false,
            rollupOptions: {
              input: resolve(__dirname, 'src/preload/index.ts'),
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: 'index.cjs',
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  server: {
    port: 5273,
  },
})
