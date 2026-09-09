import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // V1.11（D66）：pdfjs-dist 模块级 DOMMatrix 占位（见 tests/setup-node-dom-stubs.ts）。
    setupFiles: ['tests/setup-node-dom-stubs.ts'],
  },
})
