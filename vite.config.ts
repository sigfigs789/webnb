import { defineConfig, Plugin } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Declared locally so the config can read PORT without pulling in @types/node.
declare const process: { env: Record<string, string | undefined>; cwd(): string }

// Minimal shapes of the Node req/res the dev middleware touches, for the same
// reason.
type DevRequest = {
  method?: string
  headers: Record<string, string | undefined>
  on(event: string, listener: (chunk: { toString(): string }) => void): void
}
type DevResponse = {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: string): void
}

// `vite dev` serves the SPA but not the functions under /api/, which would
// leave the password gate with nothing to call. Run the same handler module
// in-process so local dev behaves like the deployed site.
function apiAuthDevServer(): Plugin {
  return {
    name: 'api-auth-dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/auth', (req, res, next) => {
        void handle(req as unknown as DevRequest, res as unknown as DevResponse).catch(next)
      })
    },
  }
}

async function handle(req: DevRequest, res: DevResponse) {
  const { GET, POST, DELETE } = await import('./api/auth.js')
  const method = req.method ?? 'GET'
  const handler =
    method === 'GET' ? GET : method === 'POST' ? POST : method === 'DELETE' ? DELETE : null
  if (!handler) {
    res.statusCode = 405
    res.end()
    return
  }

  const body = method === 'GET' || method === 'DELETE' ? undefined : await readBody(req)
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
  }

  const response = await handler(new Request('http://localhost/api/auth', { method, headers, body }))
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  res.end(await response.text())
}

function readBody(req: DevRequest): Promise<string> {
  return new Promise(resolve => {
    let data = ''
    req.on('data', chunk => {
      data += chunk.toString()
    })
    req.on('end', () => resolve(data))
  })
}

export default defineConfig(({ mode }) => {
  // api/auth.js reads SITE_PASSWORD off process.env, the way it does on Vercel.
  Object.assign(process.env, loadEnv(mode, process.cwd(), 'SITE_'))

  return {
    plugins: [react(), apiAuthDevServer()],
    server: {
      // Honor PORT so the dev server can run alongside other checkouts of this repo
      port: process.env.PORT ? Number(process.env.PORT) : 5173,
    },
    test: {
      environment: 'node',
    },
  }
})
