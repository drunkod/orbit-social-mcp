import { createServer, request as proxyRequest, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { Effect } from 'effect'
import * as Config from 'effect/Config'
import { DemoStore } from './store.js'
import { handleMcp } from './mcp.js'
import { CafePreviewRooms } from './cafe-preview-rooms.js'
import { MusicStore } from './music-store.js'

const port = Number(process.env.PORT ?? '8787')
// CAFE AGENTS.md: application configuration is parsed through Effect Config.
const strudelPort = Effect.runSync(Config.Number('STRUDELLM_PORT').pipe(Config.withDefault(3105)))
const root = process.cwd()
const dist = path.resolve(root, '../frontend/dist')
const store = new DemoStore()
await store.initialize()
const cafeRooms = new CafePreviewRooms()
await cafeRooms.initialize()
const music = new MusicStore()
await music.initialize()

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

    if (route === '/health') return json(res, 200, { ok: true, name: 'cafe-mcp', revision: store.publicState().revision })
    if (route === '/mcp') {
      return await handleMcp(req, res, store, music, 'public')
    }
    if (route === '/mcp-admin') {
      if (req.headers.authorization !== 'Bearer ' + mcpToken) {
        res.writeHead(401, {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer realm="Orbit MCP admin"'
        })
        return res.end(JSON.stringify({ error: 'Admin MCP requires bearer token' }))
      }
      return await handleMcp(req, res, store, music, 'admin')
    }

    // Original StrudelLM remains an independently runnable Next.js application.
    // This proxy puts it behind the SAME Tailscale Funnel hostname as CAFE/MCP.
    if (route === '/music' || route.startsWith('/music/')) {
      const nextPort = strudelPort
      const proxied = proxyRequest({
        hostname: '127.0.0.1', port: nextPort, path: req.url ?? '/music',
        method: req.method, headers: { ...req.headers, host: '127.0.0.1:' + nextPort }
      }, upstream => {
        res.writeHead(upstream.statusCode ?? 502, upstream.headers)
        upstream.pipe(res)
      })
      proxied.on('error', () => {
        if (!res.headersSent) return json(res, 502, {
          error: 'StrudelLM is not running. From integrations/strudellm run npm run dev or npm run start.',
          app: '/music/studio'
        })
        res.end()
      })
      req.pipe(proxied)
      return
    }

    if (route === '/music-sync/state' && req.method === 'GET') {
      return json(res, 200, music.publicState())
    }
    if (route === '/music-sync/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      })
      res.write('retry: 1200\n\n')
      const notify = () => res.write('event: change\ndata: ' + JSON.stringify({ revision: music.publicState().revision }) + '\n\n')
      const unsub = music.subscribe(notify)
      const keepAlive = setInterval(() => { if (!res.destroyed) res.write(': heartbeat\n\n') }, 20000)
      res.on('close', () => { unsub(); clearInterval(keepAlive) })
      return
    }
    if (route === '/music-sync/feedback' && req.method === 'POST') {
      const body = await readJson(req)
      const status = body.status
      if (typeof body.revision !== 'number' ||
          !['playing', 'stopped', 'error', 'needs-gesture'].includes(String(status)))
        return json(res, 400, { error: 'Invalid music feedback' })
      const accepted = await music.reportFeedback({
        revision: body.revision,
        status: status as 'playing' | 'stopped' | 'error' | 'needs-gesture',
        ...(typeof body.message === 'string' ? { message: body.message } : {})
      })
      return json(res, accepted ? 200 : 409, { ok: accepted })
    }
    if (route === '/music-sync/controls' && req.method === 'POST') {
      try { return json(res, 200, await music.changeControls(await readJson(req))) }
      catch (error) { return json(res, 400, { error: error instanceof Error ? error.message : String(error) }) }
    }
    if (route === '/music-sync/stop' && req.method === 'POST') {
      return json(res, 200, await music.setPlaying(false))
    }
    if (route === '/music-sync/play' && req.method === 'POST') {
      return json(res, 200, await music.setPlaying(true))
    }

    // Preview-only adapter for the original CAFE join/send chat UI. The production
    // CAFE Cloudflare Worker and Foldkit chat logic are unchanged.
    const cafeEvents = /^\/chats\/([^/]+)\/events$/.exec(route)
    if (cafeEvents && req.method === 'GET') {
      const key = decodeURIComponent(cafeEvents[1]!)
      if (!key.trim() || key.length > 80) return json(res, 400, { error: 'Invalid chat room' })
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no'
      })
      cafeRooms.subscribe(key, res)
      return
    }
    const cafePrompts = /^\/chats\/([^/]+)\/prompts$/.exec(route)
    if (cafePrompts && req.method === 'POST') {
      const key = decodeURIComponent(cafePrompts[1]!)
      const payload = await readJson(req)
      const text = typeof payload.text === 'string' ? payload.text : ''
      if (!key.trim() || key.length > 80 || !text.trim() || text.length > 2000)
        return json(res, 400, { error: 'Invalid chat key or text' })
      const posted = await cafeRooms.post(key, text)
      return json(res, 200, posted)
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
  console.log('CAFE Chat + MCP plugins at http://127.0.0.1:' + port)
  console.log('MCP endpoint: http://127.0.0.1:' + port + '/mcp')
  console.log('Token file: ' + path.resolve(root, 'data/.mcp-token'))
  console.log('Connect via Tailscale Funnel on dedicated HTTPS port 10000')
})
