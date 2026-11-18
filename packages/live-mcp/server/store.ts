import { Effect } from 'effect'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { transform } from 'esbuild'
import { AURORA_SOURCE, FOCUS_SOURCE, DEFAULT_MESSAGES } from './defaults.js'

export interface ChatMessage {
  id: string
  author: string
  initials: string
  tone: string
  time: string
  text: string
  reactions: string[]
}
export interface PluginEntry {
  id: string
  name: string
  description: string
  source: string
  enabled: boolean
  version: number
}
export interface AuditEntry {
  id: string
  event: string
  detail: string
  time: string
}
export interface AppState {
  revision: number
  plugins: PluginEntry[]
  messages: ChatMessage[]
  activity: AuditEntry[]
}

const initial = (): AppState => ({
  revision: 1,
  plugins: [
    { id: 'aurora', name: 'Aurora Mode', description: 'Violet gradients, announcement banner and highlighted ideas', source: AURORA_SOURCE, enabled: false, version: 1 },
    { id: 'focus', name: 'Focus Flow', description: 'Calm emerald theme, compact chat and fewer distractions', source: FOCUS_SOURCE, enabled: false, version: 1 }
  ],
  messages: DEFAULT_MESSAGES.map(item => ({ ...item })),
  activity: [
    { id: randomUUID(), event: 'workspace', detail: 'Orbit demo workspace is ready for MCP connections', time: new Date().toISOString() }
  ]
})

export class DemoStore {
  private readonly dataFile = path.resolve(process.cwd(), 'data/state.json')
  private state: AppState = initial()
  private queue: Promise<void> = Promise.resolve()
  private listeners = new Set<(state: AppState) => void>()

  async initialize(): Promise<void> {
    await Effect.runPromise(Effect.tryPromise({
      try: () => fs.mkdir(path.dirname(this.dataFile), { recursive: true }),
      catch: error => new Error('Cannot create data folder: ' + String(error))
    }))
    try {
      const raw = await Effect.runPromise(Effect.tryPromise({
        try: () => fs.readFile(this.dataFile, 'utf8'),
        catch: error => new Error('Cannot read state: ' + String(error))
      }))
      this.state = JSON.parse(raw) as AppState
    } catch {
      await this.save(this.state)
    }
  }

  private save(state: AppState): Promise<void> {
    return Effect.runPromise(Effect.tryPromise({
      try: async () => {
        const staging = this.dataFile + '.tmp'
        await fs.writeFile(staging, JSON.stringify(state, null, 2))
        await fs.rename(staging, this.dataFile)
      },
      catch: error => new Error('Cannot persist app state: ' + String(error))
    }))
  }

  private change(label: string, detail: string, edit: (draft: AppState) => void): Promise<void> {
    const job = this.queue.then(async () => {
      const draft = structuredClone(this.state)
      edit(draft)
      draft.revision += 1
      draft.activity.unshift({ id: randomUUID(), event: label, detail, time: new Date().toISOString() })
      draft.activity = draft.activity.slice(0, 16)
      await this.save(draft)
      this.state = draft
      for (const listener of this.listeners) listener(this.state)
    })
    this.queue = job.catch(() => {})
    return job
  }

  subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  publicState() {
    return {
      ...this.state,
      plugins: this.state.plugins.map(({ source: _source, ...meta }) => meta)
    }
  }
  fullState(): AppState { return structuredClone(this.state) }
  getPlugin(id: string): PluginEntry | undefined { return this.state.plugins.find(p => p.id === id) }

  async installPlugin(input: { id: string; name: string; description: string; source: string; enabled?: boolean }): Promise<void> {
    if (!/^[a-z][a-z0-9-]{1,40}$/.test(input.id)) throw new Error('Plugin id must be lowercase letters, numbers or hyphens')
    if (!input.name.trim() || input.name.length > 70) throw new Error('Invalid plugin name')
    if (input.source.length > 20000 || input.source.length < 20) throw new Error('Plugin source must be 20–20000 characters')
    if (!input.source.includes('export default')) throw new Error('Plugin must export a default object')
    await transform(input.source, { loader: 'js', format: 'esm', target: 'es2022' })
    await this.change('plugin:installed', input.name + ' installed through MCP', draft => {
      if (draft.plugins.some(p => p.id === input.id)) throw new Error('A plugin with this id already exists')
      draft.plugins.push({
        id: input.id, name: input.name, description: input.description.slice(0, 200),
        source: input.source, enabled: input.enabled ?? true, version: 1
      })
    })
  }

  async updatePlugin(id: string, source: string): Promise<void> {
    if (source.length > 20000 || !source.includes('export default')) throw new Error('Invalid JavaScript plugin source')
    await transform(source, { loader: 'js', format: 'esm', target: 'es2022' })
    await this.change('plugin:updated', id + ' source updated and hot-reloaded', draft => {
      const p = draft.plugins.find(p => p.id === id)
      if (!p) throw new Error('Plugin not found: ' + id)
      p.source = source
      p.version += 1
    })
  }

  setEnabled(id: string, enabled: boolean): Promise<void> {
    return this.change(enabled ? 'plugin:enabled' : 'plugin:disabled', id + (enabled ? ' activated' : ' disabled'), draft => {
      const p = draft.plugins.find(p => p.id === id)
      if (!p) throw new Error('Plugin not found: ' + id)
      p.enabled = enabled
      p.version += 1
    })
  }

  removePlugin(id: string): Promise<void> {
    return this.change('plugin:removed', id + ' removed', draft => {
      const original = draft.plugins.length
      draft.plugins = draft.plugins.filter(p => p.id !== id)
      if (original === draft.plugins.length) throw new Error('Plugin not found: ' + id)
    })
  }

  postMessage(text: string, author = 'You'): Promise<void> {
    if (!text.trim() || text.length > 2000) throw new Error('Message must be 1–2000 characters')
    return this.change('chat:message', author + ' posted to #general', draft => {
      draft.messages.push({
        id: randomUUID(), author: author.slice(0, 40), initials: author.slice(0, 2).toUpperCase(),
        tone: 'purple', text: text.trim(), time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        reactions: []
      })
      draft.messages = draft.messages.slice(-80)
    })
  }

  reset(): Promise<void> {
    return this.change('workspace:reset', 'Demo plugins and messages reset to defaults', draft => {
      const defaults = initial()
      draft.plugins = defaults.plugins
      draft.messages = defaults.messages
    })
  }
}
