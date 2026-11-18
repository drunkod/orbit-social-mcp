import { promises as fs } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { Effect } from 'effect'
import type { ServerResponse } from 'node:http'

export interface CafeChatMessage {
  id: string
  key: string
  role: 'user' | 'assistant'
  text: string
  sentAt: number
}

type CafeChatEvent = { _tag: 'MessagePosted'; message: CafeChatMessage }

export class CafePreviewRooms {
  private readonly file = path.resolve(process.cwd(), 'data/cafe-preview-rooms.json')
  private rooms: Record<string, CafeChatMessage[]> = {}
  private subscribers = new Map<string, Set<ServerResponse>>()
  private queue: Promise<unknown> = Promise.resolve()

  async initialize(): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true })
    try {
      this.rooms = JSON.parse(await fs.readFile(this.file, 'utf8'))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  subscribe(key: string, res: ServerResponse): void {
    let subscribers = this.subscribers.get(key)
    if (!subscribers) { subscribers = new Set(); this.subscribers.set(key, subscribers) }
    subscribers.add(res)
    res.write('retry: 1500\n\n')
    for (const message of this.rooms[key] ?? []) {
      res.write('data: ' + JSON.stringify({ _tag: 'MessagePosted', message } satisfies CafeChatEvent) + '\n\n')
    }
    const heartbeat = setInterval(() => { if (!res.destroyed) res.write(':keep-alive\n\n') }, 18_000)
    res.once('close', () => {
      clearInterval(heartbeat)
      subscribers?.delete(res)
      if (subscribers?.size === 0) this.subscribers.delete(key)
    })
  }

  async post(key: string, text: string): Promise<CafeChatMessage> {
    if (!key.trim() || key.length > 80) throw new Error('Invalid room key')
    if (!text.trim() || text.length > 2000) throw new Error('Message must be 1–2000 characters')
    const job = this.queue.then(async () => {
      const message: CafeChatMessage = {
        id: randomUUID(), key, role: 'user', text: text.trim(), sentAt: Date.now()
      }
      const updated = { ...this.rooms, [key]: [...(this.rooms[key] || []), message].slice(-100) }
      await Effect.runPromise(Effect.tryPromise({
        try: async () => {
          const staging = this.file + '.tmp'
          await fs.writeFile(staging, JSON.stringify(updated))
          await fs.rename(staging, this.file)
        },
        catch: error => new Error('Cannot persist preview room: ' + String(error))
      }))
      this.rooms = updated
      const event = 'data: ' + JSON.stringify({ _tag: 'MessagePosted', message } satisfies CafeChatEvent) + '\n\n'
      for (const subscriber of this.subscribers.get(key) ?? []) subscriber.write(event)
      return message
    })
    this.queue = job.catch(() => {})
    return job
  }
}
