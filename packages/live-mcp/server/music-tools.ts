import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { MusicStore } from './music-store.js'
import { musicComposeSchema, musicControlsSchema, musicSoundCatalog } from './music-schema.js'

const ok = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] })
const fail = (error: unknown) => ({
  isError: true,
  content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }]
})

export function registerMusicPublicTools(server: McpServer, music: MusicStore): void {
  server.registerTool('music_get_state', {
    description: 'Inspect the last generated Strudel musical code, BPM, volume sliders, playback state and browser validation feedback. Open /music/studio to hear it.',
    inputSchema: {},
    annotations: { readOnlyHint: true }
  }, async () => ok(music.publicState()))

  server.registerTool('music_list_sounds', {
    description: 'List Strudel drum samples, bank names, synthesized waveforms, sampled piano, melodic demo presets and mini-notation. The full dynamic StrudelLM browser soundMap is available through its original listSamples tool.',
    inputSchema: {},
    annotations: { readOnlyHint: true }
  }, async () => ok(musicSoundCatalog))

  server.registerTool('music_compose', {
    description: 'Compose original music with Strudel mini-notation. Choose preset=piano-drums to play the exact original StrudelLM sampled-piano-and-drums example with its built-in piano slider and pianoroll/scope. For custom tunes, supply melody and instrument=piano, plus optional drums/bass. The server generates code and dynamic tempo/volume controls. An open Music Studio automatically validates and plays it after audio has been enabled in that browser. Use successive calls to revise it. Do not imitate a specific copyrighted recording.',
    inputSchema: musicComposeSchema.shape,
    annotations: { readOnlyHint: false, destructiveHint: false }
  }, async input => {
    try {
      const state = await music.compose(input)
      return ok({
        success: true, revision: state.revision, title: state.title,
        code: state.code, controls: state.controls,
        status: 'queued_for_browser', studio: '/music/studio',
        note: 'MCP generated code is stored. Browser playback is confirmed only by music_get_state.feedback. A one-time Enable Audio click is required.'
      })
    } catch (error) { return fail(error) }
  })

  server.registerTool('music_load_piano_demo', {
    description: 'Load and play the exact original StrudelLM piano-and-drums source from StrudelLM DEFAULT_CODE: acoustic sampled piano c3 e3 g3 b3, bd sd [bd bd] sd drums, piano slider, pianoroll and scope. Use this when comparing the original strudellm.com/chat demo or requesting a melodic example. Playback requires enabling browser audio first.',
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: false }
  }, async () => {
    try {
      const state = await music.compose({ preset: 'piano-drums', title: 'Original StrudelLM Piano + Drums', bpm: 120, volume: 0.5 })
      return ok({ success: true, revision: state.revision, title: state.title, code: state.code,
        controls: state.controls, status: 'queued_for_browser', studio: '/music/studio',
        note: 'The program matches StrudelLM DEFAULT_CODE. Enable Audio in the browser to play and confirm via music_get_state.feedback.' })
    } catch (error) { return fail(error) }
  })

  server.registerTool('music_set_controls', {
    description: 'Change tempo (BPM) and/or gain (piano volume for the upstream demo, mix volume for custom music); regenerate and hot-reload the Strudel code and associated sliders in the Music Studio.',
    inputSchema: musicControlsSchema.innerType().shape,
    annotations: { readOnlyHint: false }
  }, async input => {
    try {
      const state = await music.changeControls(input)
      return ok({ success: true, revision: state.revision, code: state.code, controls: state.controls })
    } catch (error) { return fail(error) }
  })

  server.registerTool('music_stop', {
    description: 'Stop the current music playback in every connected Music Studio browser.',
    inputSchema: {},
    annotations: { readOnlyHint: false, destructiveHint: false }
  }, async () => {
    try {
      const state = await music.setPlaying(false)
      return ok({ success: true, revision: state.revision, playing: false })
    } catch (error) { return fail(error) }
  })

  server.registerTool('music_play', {
    description: 'Resume the most recently generated music in all Music Studio browsers whose audio has been enabled.',
    inputSchema: {},
    annotations: { readOnlyHint: false }
  }, async () => {
    try {
      const state = await music.setPlaying(true)
      return ok({ success: true, revision: state.revision, playing: true })
    } catch (error) { return fail(error) }
  })
}

export function registerMusicAdminTools(server: McpServer, music: MusicStore): void {
  server.registerTool('music_update_strudel_code', {
    description: 'Replace the running Strudel program with complete JavaScript/Strudel source. Restricted to authenticated admin MCP; the browser validates execution and rolls back on errors.',
    inputSchema: {
      code: z.string().min(1).max(24000),
      title: z.string().max(90).optional()
    }
  }, async ({ code, title }) => {
    try {
      const state = await music.updateSource(code, title)
      return ok({ success: true, revision: state.revision, code: state.code, studio: '/music/studio' })
    } catch (error) { return fail(error) }
  })
  registerMusicPublicTools(server, music)
}
