import { defineConfig } from 'tsup'

export default defineConfig({
  clean: true,
  format: 'esm',
  target: 'esnext',
  treeshake: true,
  entry: ['src/cli.ts'],
})
