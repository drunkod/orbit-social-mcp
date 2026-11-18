import { z } from 'zod'

/** A public MCP request expresses music data, never executable JavaScript. */
const pattern = z.string().min(1).max(220)
  .regex(/^[a-zA-Z0-9_#~,.*?!/<>[\] ():+-]+$/, 'Pattern contains unsupported characters')

export const musicComposeSchema = z.object({
  title: z.string().trim().min(1).max(90).default('New groove'),
  bpm: z.number().int().min(40).max(220).default(120),
  bank: z.enum(['RolandTR808', 'RolandTR909', 'LinnDrum']).default('RolandTR909'),
  drums: pattern.default('bd ~ sd ~ bd ~ sd [hh hh]'),
  bass: pattern.optional(),
  melody: pattern.optional(),
  instrument: z.enum(['sine', 'sawtooth', 'square', 'triangle', 'supersaw']).default('sine'),
  volume: z.number().min(0).max(1).default(0.65),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#8b5cf6')
})
export type MusicComposition = z.infer<typeof musicComposeSchema>

export const musicControlsSchema = z.object({
  bpm: z.number().int().min(40).max(220).optional(),
  volume: z.number().min(0).max(1).optional()
}).refine(input => input.bpm !== undefined || input.volume !== undefined, 'Specify at least one control')

export type MusicControl = {
  key: 'bpm' | 'volume'
  label: string
  min: number
  max: number
  step: number
  value: number
  unit: string
}

export function controlsFor(comp: MusicComposition): MusicControl[] {
  return [
    { key: 'bpm', label: 'Tempo', min: 40, max: 220, step: 1, value: comp.bpm, unit: 'BPM' },
    { key: 'volume', label: 'Volume', min: 0, max: 1, step: 0.01, value: comp.volume, unit: '' }
  ]
}

export function compileMusic(comp: MusicComposition): string {
  // All user strings go into JSON-encoded Strudel mini-notation, not JS source.
  // Sound banks and instruments are allow-listed by musicComposeSchema.
  const tempo = comp.bpm / 4
  const volume = Number(comp.volume.toFixed(3))
  const quote = JSON.stringify
  const layers = [
    'setcpm(' + tempo + ')',
    '$drums: s(' + quote(comp.drums) + ').bank(' + quote(comp.bank) + ').gain(' + volume + ')'
  ]
  if (comp.bass) {
    layers.push('$bass: note(' + quote(comp.bass) + ').s(' + quote(comp.instrument) + ').gain(' + Number((volume * 0.48).toFixed(3)) + ')')
  }
  if (comp.melody) {
    layers.push('$melody: note(' + quote(comp.melody) + ').s(' + quote(comp.instrument) + ').gain(' + Number((volume * 0.32).toFixed(3)) + ')')
  }
  return layers.join('\n') + '\n'
}

export const musicSoundCatalog = {
  drums: ['bd', 'sd', 'hh', 'oh', 'cp', 'rim', 'cb', 'cr', 'rd', 'ht', 'mt', 'lt'],
  banks: ['RolandTR808', 'RolandTR909', 'LinnDrum'],
  instruments: ['sine', 'sawtooth', 'square', 'triangle', 'supersaw'],
  notation: {
    sequence: 'bd ~ sd ~',
    repeats: 'hh*8',
    grouped: 'bd [hh hh] sd ~',
    melody: 'c3 ~ e3 g3',
    note: 'Other sound banks/samples are available through the original StrudelLM listSamples tool inside the browser.'
  }
}
