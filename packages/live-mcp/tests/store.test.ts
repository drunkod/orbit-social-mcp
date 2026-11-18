import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

test('Effect store persists plugin CRUD, chat and subscriptions', async () => {
  const original = process.cwd()
  const isolated = await mkdtemp(path.join(tmpdir(), 'orbit-effect-test-'))
  try {
    process.chdir(isolated)
    const { DemoStore } = await import('../server/store.js')
    const store = new DemoStore()
    await store.initialize()
    assert.equal(store.publicState().plugins.length, 2)
    assert.equal(store.publicState().messages.length, 4)

    let notifications = 0
    const unsubscribe = store.subscribe(() => notifications++)
    const source = 'export default { id: "test-addon", name: "Test", messageDecorator(m) { return m.text ? { tag: "TEST" } : {}; } }'
    await store.installPlugin({
      id: 'test-addon', name: 'Test', description: 'Plugin test',
      enabled: true, source
    })
    assert.equal(store.getPlugin('test-addon')?.enabled, true)
    await store.setEnabled('test-addon', false)
    assert.equal(store.getPlugin('test-addon')?.enabled, false)
    await store.updatePlugin('test-addon', source + '\n// edited')
    assert.equal(store.getPlugin('test-addon')?.version, 3)
    await store.postMessage('Hello from the test', 'Test Runner')
    assert.equal(store.publicState().messages.length, 5)
    assert.equal(notifications, 4)
    const saved = JSON.parse(await readFile('data/state.json', 'utf8'))
    assert.equal(saved.messages.at(-1).text, 'Hello from the test')
    assert.ok(!JSON.stringify(store.publicState()).includes('messageDecorator'))
    await store.removePlugin('test-addon')
    assert.equal(store.getPlugin('test-addon'), undefined)
    unsubscribe()
    await store.reset()
    assert.equal(store.publicState().messages.length, 4)
    assert.equal(store.publicState().plugins.length, 2)
  } finally {
    process.chdir(original)
    await rm(isolated, { recursive: true, force: true })
  }
})

test('plugin validation rejects malformed or duplicate code', async () => {
  const original = process.cwd()
  const isolated = await mkdtemp(path.join(tmpdir(), 'orbit-validation-'))
  try {
    process.chdir(isolated)
    const { DemoStore } = await import('../server/store.js')
    const store = new DemoStore()
    await store.initialize()
    await assert.rejects(store.installPlugin({ id: 'wrong id', name: 'Bad', description: '', source: 'export default { a: 1 }' }))
    await assert.rejects(store.installPlugin({ id: 'aurora', name: 'Duplicate', description: '', source: 'export default { a: 1 }' }))
    await assert.rejects(store.updatePlugin('aurora', 'export default { syntax::: }'))
  } finally {
    process.chdir(original)
    await rm(isolated, { recursive: true, force: true })
  }
})
