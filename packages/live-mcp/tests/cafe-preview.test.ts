import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { CafePreviewRooms } from '../server/cafe-preview-rooms.js'

test('CAFE local preview persists original chat message format and separates room keys', async () => {
  const previous = process.cwd()
  const directory = await mkdtemp(path.join(tmpdir(), 'cafe-mcp-room-'))
  try {
    process.chdir(directory)
    const rooms = new CafePreviewRooms()
    await rooms.initialize()
    const message = await rooms.post('lobby', 'Hello from the original Cafe UI')
    assert.equal(message.key, 'lobby')
    assert.equal(message.role, 'user')
    assert.equal(message.text, 'Hello from the original Cafe UI')
    assert.equal(typeof message.sentAt, 'number')
    const other = await rooms.post('private-test-room', 'A separate room')
    assert.equal(other.key, 'private-test-room')
    await assert.rejects(rooms.post('lobby', '    '), /Message must be/)
    const stored = JSON.parse(await readFile('data/cafe-preview-rooms.json', 'utf8'))
    assert.equal(stored.lobby.length, 1)
    assert.equal(stored['private-test-room'].length, 1)
    assert.equal(stored.lobby[0].id, message.id)
    assert.equal(stored['private-test-room'][0].id, other.id)
    const reload = new CafePreviewRooms()
    await reload.initialize()
    const next = await reload.post('lobby', 'Persisted on restart')
    const persisted = JSON.parse(await readFile('data/cafe-preview-rooms.json', 'utf8'))
    assert.equal(persisted.lobby.length, 2)
    assert.equal(persisted.lobby[1].id, next.id)
  } finally {
    process.chdir(previous)
    await rm(directory, { recursive: true, force: true })
  }
})
