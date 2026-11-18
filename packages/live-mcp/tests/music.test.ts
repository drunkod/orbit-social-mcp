import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { musicComposeSchema, compileMusic } from '../server/music-schema.js'
import { MusicStore } from '../server/music-store.js'

test('MCP composition generates deterministic Strudel code and typed UI controls', () => {
  const composition = musicComposeSchema.parse({
    title: 'Original house drums',
    bpm: 128, bank: 'RolandTR909',
    drums: 'bd ~ sd ~ hh*8', bass: 'c2 ~ g1 ~',
    instrument: 'sine', volume: 0.7
  })
  const source = compileMusic(composition)
  assert.match(source, /setcpm\(32\)/)
  assert.match(source, /RolandTR909/)
  assert.match(source, /\$drums/)
  assert.match(source, /\$bass/)
  assert.match(source, /gain\(0\.7\)/)
  assert.throws(() => musicComposeSchema.parse({ drums: 'bd"); alert(1); s("sd' }), /unsupported characters/)
  assert.throws(() => musicComposeSchema.parse({ bpm: 600 }), /220/)
})

test('persisted music state broadcasts revisions, supports sliders and rollback-friendly feedback', async () => {
  const previous = process.cwd()
  const directory = await mkdtemp(path.join(tmpdir(), 'strudel-mcp-test-'))
  try {
    process.chdir(directory)
    const store = new MusicStore()
    await store.initialize()
    let changes = 0
    const unsub = store.subscribe(() => { changes++ })
    const first = await store.compose({ title: 'First loop', bpm: 120, drums: 'bd ~ sd ~' })
    assert.equal(first.playing, true)
    assert.equal(first.controls.length, 2)
    assert.equal(first.title, 'First loop')
    assert.equal(first.revision, 2)
    const changed = await store.changeControls({ bpm: 132, volume: 0.5 })
    assert.match(changed.code, /setcpm\(33\)/)
    assert.match(changed.code, /gain\(0\.5\)/)
    assert.equal(changed.revision, 3)
    assert.equal(await store.reportFeedback({ revision: 2, status: 'error' }), false)
    assert.equal(await store.reportFeedback({ revision: 3, status: 'playing' }), true)
    assert.equal(store.publicState().feedback?.status, 'playing')
    const stopped = await store.setPlaying(false)
    assert.equal(stopped.playing, false)
    assert.equal(changes, 3)
    unsub()
    const reload = new MusicStore()
    await reload.initialize()
    assert.equal(reload.publicState().revision, stopped.revision)
    const saved = JSON.parse(await readFile('data/music-state.json', 'utf8'))
    assert.equal(saved.title, 'First loop')
    await assert.rejects(store.changeControls({ bpm: 999 }), /220/)
  } finally {
    process.chdir(previous)
    await rm(directory, { recursive: true, force: true })
  }
})
