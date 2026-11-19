import assert from 'node:assert/strict'
import { mkdir, stat, unlink } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const base = process.env.MUSIC_DEMO_URL ?? 'https://tests-macbook-air.tail70b8a.ts.net:10000'
const mcpUrl = process.env.MUSIC_MCP_URL ?? 'https://tests-macbook-air.tail70b8a.ts.net/orbit-mcp'
const artifactDir = process.env.MUSIC_ARTIFACT_DIR
if (artifactDir) await mkdir(artifactDir, { recursive: true })
const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 950 },
  ...(artifactDir ? { recordVideo: { dir: artifactDir, size: { width: 1440, height: 950 } } } : {})
})
const page = await context.newPage()
const errors: string[] = []
const sampleResponses: Array<{url: string; status: number}> = []
page.on('response', response => {
  if (/strudel\.b-cdn\.net\/(?:piano|tidal-drum-machines)/.test(response.url())) {
    sampleResponses.push({ url: response.url(), status: response.status() })
  }
})
page.on('pageerror', error => errors.push(error.message))
const client = new Client({ name: 'strudellm-e2e', version: '0.1.0' })
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl)))
  await page.goto(base + '/music/studio', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.getByText('Live code editor & player').waitFor({ timeout: 90000 })
  await page.getByRole('button', { name: 'Enable Audio' }).waitFor()
  const title = 'Original MCP house groove ' + Date.now()
  const result = await client.callTool({
    name: 'music_compose',
    arguments: {
      title, bpm: 126, drums: 'bd ~ sd ~ [hh hh] ~',
      bank: 'RolandTR909', bass: 'c2 ~ g1 ~', volume: 0.65
    }
  })
  assert.equal(Boolean(result.isError), false)
  await page.getByRole('heading', { name: title }).waitFor({ timeout: 20000 })
  await page.getByText('126 BPM').first().waitFor({ timeout: 15000 })
  await page.getByText('RolandTR909', { exact: false }).last().waitFor()
  const enable = page.getByRole('button', { name: 'Enable Audio' })
  // A true MCP/Strudel integration check must prove browser audio was unlocked.
  await enable.waitFor({ state: 'visible' })
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll('button')].find(node => node.textContent?.includes('Enable Audio'))
    return button instanceof HTMLButtonElement && !button.disabled
  }, undefined, { timeout: 90000 })
  await enable.click()
  let confirmed = false
  for (let attempt = 0; attempt < 40; attempt++) {
    const status = await (await page.request.get(base + '/music-sync/state')).json() as {
      feedback?: { status: string; revision: number } | null
      revision: number
    }
    if (status.feedback?.status === 'playing' && status.feedback.revision === status.revision) {
      confirmed = true
      break
    }
    await page.waitForTimeout(1000)
  }
  assert.ok(confirmed, 'Strudel engine must acknowledge playing after browser audio is enabled')
  await page.screenshot({ path: path.join(artifactDir ?? '/tmp', 'strudel-mcp-studio.png'), fullPage: true })
  const value = await page.getByRole('slider').first().inputValue()
  assert.equal(value, '126')
  await page.getByRole('slider').first().fill('138')
  await page.waitForTimeout(850)
  const state = await (await page.request.get(base + '/music-sync/state')).json() as { composition: { bpm: number } }
  assert.equal(state.composition.bpm, 138)
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mobile.goto(base + '/music/studio', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await mobile.getByText('Live code editor & player').waitFor({ timeout: 30000 })
  await mobile.screenshot({ path: path.join(artifactDir ?? '/tmp', 'strudel-mcp-studio-mobile.png'), fullPage: true })
  // Upstream-parity acceptance: use the same DEFAULT_CODE as strudellm.com/chat.
  const demo = await client.callTool({ name: 'music_load_piano_demo', arguments: {} })
  assert.equal(Boolean(demo.isError), false, JSON.stringify(demo.content))
  const demoCode = await (await page.request.get(base + '/music-sync/state')).json() as { revision: number; code: string }
  assert.match(demoCode.code, /note\("c3 e3 g3 b3"\)/)
  assert.match(demoCode.code, /\.s\("piano"\)/)
  assert.match(demoCode.code, /slider\(0\.5, 0, 1, 0\.01\)/)
  assert.match(demoCode.code, /\._scope\(\{ height: 80 \}\)/)
  assert.match(demoCode.code, /\._pianoroll\(\{ fold: 1 \}\)/)
  await page.getByRole('heading', { name: 'Original StrudelLM Piano + Drums' }).waitFor({ timeout: 30000 })
  let demoPlaying = false
  for (let attempt = 0; attempt < 35; attempt++) {
    const pianoState = await (await page.request.get(base + '/music-sync/state')).json() as {
      feedback?: { revision: number; status: string; message?: string } | null; revision: number
    }
    if (pianoState.feedback?.revision === pianoState.revision && pianoState.feedback?.status === 'error') {
      throw new Error('Original StrudelLM demo playback rejected: ' + pianoState.feedback.message)
    }
    if (pianoState.feedback?.revision === pianoState.revision && pianoState.feedback?.status === 'playing') {
      demoPlaying = true
      break
    }
    await page.waitForTimeout(1000)
  }
  assert.ok(demoPlaying, 'Exact original piano demo must play after MCP update')
  await page.screenshot({ path: path.join(artifactDir ?? '/tmp', 'strudel-mcp-original-piano.png'), fullPage: true })
  await page.waitForTimeout(1400) // Capture the fully updated original piano demo in the review video.
  console.log('PIANO_SAMPLE_NETWORK', JSON.stringify(sampleResponses.filter(v => v.url.includes('/piano'))))
  console.log(JSON.stringify({
    result: 'PASS', liveMcpMusic: true, generatedCodeVisible: true,
    generatedSliders: 2, tempoSliderChangesServerCode: true, exactOriginalPianoCode: true, originalPianoBrowserPlayback: demoPlaying,
    errors, screenshots: [path.join(artifactDir ?? '/tmp', 'strudel-mcp-studio.png'), path.join(artifactDir ?? '/tmp', 'strudel-mcp-studio-mobile.png')]
  }, null, 2))
  if (errors.length) process.exitCode = 1
  await mobile.close()
} finally {
  await client.close()
  await context.close() // Must flush Playwright's video before saveAs.
  if (artifactDir) {
    const recorded = page.video()
    assert.ok(recorded, 'Playwright video capture must be active in PR demo mode')
    await recorded.saveAs(path.join(artifactDir, 'strudel-studio-demo.webm'))
    await unlink(await recorded.path()) // Keep just one CI artifact, not Playwright's temporary copy.
  }
  await browser.close()
  if (artifactDir) {
    const video = path.join(artifactDir, 'strudel-studio-demo.webm')
    const data = await stat(video)
    assert.ok(data.size > 15000, 'Recorded review demo must be larger than 15 KB')
  }
}
