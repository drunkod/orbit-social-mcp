import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const base = process.env.MUSIC_DEMO_URL ?? 'http://127.0.0.1:8787'
const endpoint = process.env.MUSIC_MCP_URL ?? base + '/mcp'
const client = new Client({ name: 'strudellm-mcp-smoke', version: '0.1.0' })
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(endpoint)))
  const tools = await client.listTools()
  const names = tools.tools.map(tool => tool.name)
  for (const required of ['customize_interface', 'music_get_state', 'music_list_sounds', 'music_compose', 'music_set_controls', 'music_stop', 'music_play']) {
    assert.ok(names.includes(required), 'Missing public MCP tool: ' + required)
  }
  const created = await client.callTool({
    name: 'music_compose',
    arguments: {
      title: 'Original MCP drum groove',
      bpm: 124, bank: 'RolandTR909', drums: 'bd ~ sd ~ hh*8',
      bass: 'c2 ~ g1 ~', instrument: 'sine', volume: 0.6
    }
  })
  assert.equal(Boolean(created.isError), false, JSON.stringify(created.content))
  const state = await (await fetch(base + '/music-sync/state')).json() as {
    revision: number; title: string; code: string; controls: unknown[]; playing: boolean
  }
  assert.equal(state.title, 'Original MCP drum groove')
  assert.match(state.code, /RolandTR909/)
  assert.equal(state.controls.length, 2)
  const changed = await client.callTool({ name: 'music_set_controls', arguments: { bpm: 132 } })
  assert.equal(Boolean(changed.isError), false)
  const next = await (await fetch(base + '/music-sync/state')).json() as { revision: number; code: string }
  assert.equal(next.revision, state.revision + 1)
  assert.match(next.code, /setcpm\(33\)/)
  const stopped = await client.callTool({ name: 'music_stop', arguments: {} })
  assert.equal(Boolean(stopped.isError), false)
  const finalState = await (await fetch(base + '/music-sync/state')).json() as { playing: boolean }
  assert.equal(finalState.playing, false)
  const resumed = await client.callTool({ name: 'music_play', arguments: {} })
  assert.equal(Boolean(resumed.isError), false)
  console.log(JSON.stringify({
    result: 'PASS', publicMcpTools: names.length,
    generatedStrudel: true, tempoControl: true, stopAndResume: true,
    studio: base + '/music/studio', feedback: 'awaiting browser validation'
  }, null, 2))
} finally {
  await client.close()
}
