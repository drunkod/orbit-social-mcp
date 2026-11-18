import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { Effect } from 'effect'
import { DemoStore } from './store.js'
import { handleMcp } from './mcp.js'

const port = Number(process.env.PORT ?? '8787')
const root = process.cwd()
const dist = path.resolve(root, 'dist')
const store = new DemoStore()
await store.initialize()

async function getToken(): Promise<string> {
  if (process.env.MCP_DEMO_TOKEN?.trim()) return process.env.MCP_DEMO_TOKEN.trim()
  const tokenPath = path.resolve(root, 'data/.mcp-token')
  try { return (await fs.readFile(tokenPath, 'utf8')).trim() }
  catch {
    const token = randomBytes(24).toString('hex')
    await fs.writeFile(tokenPath, token + '\n', { mode: 0o600 })
    return token
  }
}
const mcpToken = await getToken()

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}
const readJson = async (req: IncomingMessage): Promise<Record<string, unknown>> => {
  let body = ''
  for await (const chunk of req) {
    body += String(chunk)
    if (body.length > 10_000) throw new Error('Request is too large')
  }
  return JSON.parse(body) as Record<string, unknown>
}
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const route = url.pathname

    if (route === '/health') return json(res, 200, { ok: true, name: 'orbit-mcp', revision: store.publicState().revision })
    if (route === '/mcp') {
      if (req.headers.authorization !== 'Bearer ' + mcpToken) {
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer realm="Orbit MCP demo"',
          'Access-Control-Allow-Origin': '*'
        })
        return res.end(JSON.stringify({ error: 'Connect using Authorization: Bearer <token> from data/.mcp-token' }))
      }
      return await handleMcp(req, res, store)
    }

    if (route === '/api/state' && req.method === 'GET') return json(res, 200, store.publicState())

    if (route === '/api/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      })
      res.write('retry: 1200\n\n')
      const notify = () => res.write('event: change\ndata: ' + JSON.stringify({ revision: store.publicState().revision }) + '\n\n')
      const unsub = store.subscribe(notify)
      const keepAlive = setInterval(() => res.write(': heartbeat\n\n'), 20_000)
      res.on('close', () => { unsub(); clearInterval(keepAlive) })
      return
    }

    if (route === '/api/messages' && req.method === 'POST') {
      const payload = await readJson(req)
      const text = typeof payload.text === 'string' ? payload.text : ''
      await Effect.runPromise(Effect.tryPromise({
        try: () => store.postMessage(text, 'You'),
        catch: e => new Error(String(e))
      }))
      return json(res, 201, { ok: true })
    }

    const pluginMatch = /^\/plugins\/([a-z][a-z0-9-]{1,40})\.js$/.exec(route)
    if (pluginMatch && req.method === 'GET') {
      const p = store.getPlugin(pluginMatch[1]!)
      if (!p?.enabled) return json(res, 404, { error: 'Plugin not enabled' })
      res.writeHead(200, {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      })
      return res.end(p.source)
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' })
    const normalized = path.normalize(route).replace(/^\/+/, '')
    const candidate = path.resolve(dist, normalized || 'index.html')
    if (!candidate.startsWith(dist + path.sep) && candidate !== path.join(dist, 'index.html')) {
      return json(res, 403, { error: 'Forbidden' })
    }
    let file = candidate
    try {
      const stat = await fs.stat(file)
      if (!stat.isFile()) file = path.join(dist, 'index.html')
    } catch {
      file = path.join(dist, 'index.html')
    }
    const bytes = await fs.readFile(file)
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream' })
    if (req.method === 'HEAD') res.end()
    else res.end(bytes)
  } catch (error) {
    console.error('[orbit]', error)
    if (!res.headersSent) json(res, 500, { error: error instanceof Error ? error.message : String(error) })
    else res.end()
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log('Orbit Social running at http://127.0.0.1:' + port)
  console.log('MCP endpoint: http://127.0.0.1:' + port + '/mcp')
  console.log('Token file: ' + path.resolve(root, 'data/.mcp-token'))
  console.log('Connect via Tailscale Funnel on dedicated HTTPS port 10000')
})
