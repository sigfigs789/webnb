import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Declared locally so the config can read PORT without pulling in @types/node.
declare const process: { env: Record<string, string | undefined> }

export default defineConfig({
  plugins: [react()],
  server: {
    // Honor PORT so the dev server can run alongside other checkouts of this repo
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
  test: {
    environment: 'node',
  },
})
