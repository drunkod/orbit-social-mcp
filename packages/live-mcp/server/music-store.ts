import { promises as fs } from 'node:fs'
import path from 'node:path'
import { compileMusic, controlsFor, musicComposeSchema, musicControlsSchema, type MusicComposition, type MusicControl } from './music-schema.js'

export interface MusicFeedback {
  revision: number
  status: 'playing' | 'stopped' | 'error' | 'needs-gesture'
  message?: string
  updatedAt: string
}

export interface MusicState {
  revision: number
  title: string
  code: string
  playing: boolean
  source: 'composition' | 'admin'
  composition: MusicComposition | null
  controls: MusicControl[]
  color: string
  feedback: MusicFeedback | null
  updatedAt: string
}

const initial = (): MusicState => ({
  revision: 1, title: 'Ready for music', code: '', playing: false,
  source: 'composition', composition: null, controls: [], color: '#8b5cf6',
  feedback: null, updatedAt: new Date().toISOString()
})

export class MusicStore {
  private readonly file = path.resolve(process.cwd(), 'data/music-state.json')
  private state: MusicState = initial()
  private queue: Promise<unknown> = Promise.resolve()
  private listeners = new Set<() => void>()

  async initialize(): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true })
    try {
      this.state = JSON.parse(await fs.readFile(this.file, 'utf8')) as MusicState
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }

  publicState(): MusicState { return structuredClone(this.state) }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private async update(fn: (old: MusicState) => MusicState): Promise<MusicState> {
    const op = this.queue.then(async () => {
      const next = fn(this.state)
      const tmp = this.file + '.tmp'
      await fs.writeFile(tmp, JSON.stringify(next, null, 2) + '\n')
      await fs.rename(tmp, this.file)
      this.state = next
      for (const listener of this.listeners) listener()
      return this.publicState()
    })
    this.queue = op.catch(() => {})
    return op
  }

  async compose(input: unknown): Promise<MusicState> {
    const comp = musicComposeSchema.parse(input)
    return this.update(old => ({
      ...old, revision: old.revision + 1, title: comp.title,
      code: compileMusic(comp), composition: comp,
      controls: controlsFor(comp), color: comp.color,
      source: 'composition', playing: true, feedback: null,
      updatedAt: new Date().toISOString()
    }))
  }

  async changeControls(input: unknown): Promise<MusicState> {
    const change = musicControlsSchema.parse(input)
    return this.update(old => {
      if (!old.composition) throw new Error('Compose music before changing controls')
      const comp = musicComposeSchema.parse({ ...old.composition, ...change })
      return {
        ...old, revision: old.revision + 1, composition: comp,
        code: compileMusic(comp), controls: controlsFor(comp),
        feedback: null, updatedAt: new Date().toISOString()
      }
    })
  }

  async updateSource(source: string, title = 'Custom Strudel pattern'): Promise<MusicState> {
    if (!source.trim() || source.length > 24000) throw new Error('Music source must be 1–24000 characters')
    return this.update(old => ({
      ...old, revision: old.revision + 1, source: 'admin',
      title: title.slice(0, 90), code: source, composition: null,
      controls: [], playing: true, feedback: null, updatedAt: new Date().toISOString()
    }))
  }

  async setPlaying(playing: boolean): Promise<MusicState> {
    return this.update(old => ({
      ...old, revision: old.revision + 1, playing, feedback: null,
      updatedAt: new Date().toISOString()
    }))
  }

  async reportFeedback(input: { revision: number; status: MusicFeedback['status']; message?: string }): Promise<boolean> {
    const op = this.queue.then(async () => {
      if (input.revision !== this.state.revision) return false
      const feedback: MusicFeedback = {
        revision: input.revision, status: input.status,
        ...(input.message ? { message: input.message.slice(0, 1200) } : {}),
        updatedAt: new Date().toISOString()
      }
      const next = { ...this.state, feedback }
      await fs.writeFile(this.file + '.tmp', JSON.stringify(next, null, 2) + '\n')
      await fs.rename(this.file + '.tmp', this.file)
      this.state = next
      // The feedback status does not change musical revision or retrigger playback.
      return true
    })
    this.queue = op.catch(() => {})
    return op
  }
}
