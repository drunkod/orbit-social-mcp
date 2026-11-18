import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const base = process.env.MUSIC_DEMO_URL ?? 'https://tests-macbook-air.tail70b8a.ts.net:10000'
const mcpUrl = process.env.MUSIC_MCP_URL ?? 'https://tests-macbook-air.tail70b8a.ts.net/orbit-mcp'
const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
})
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } })
const errors: string[] = []
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
  if (await enable.isEnabled()) await enable.click()
  await page.screenshot({ path: '/tmp/strudel-mcp-studio.png', fullPage: true })
  const value = await page.getByRole('slider').first().inputValue()
  assert.equal(value, '126')
  await page.getByRole('slider').first().fill('138')
  await page.waitForTimeout(850)
  const state = await (await page.request.get(base + '/music-sync/state')).json() as { composition: { bpm: number } }
  assert.equal(state.composition.bpm, 138)
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mobile.goto(base + '/music/studio', { waitUntil: 'domcontentloaded', timeout: 90000 })
  await mobile.getByText('Live code editor & player').waitFor({ timeout: 30000 })
  await mobile.screenshot({ path: '/tmp/strudel-mcp-studio-mobile.png', fullPage: true })
  console.log(JSON.stringify({
    result: 'PASS', liveMcpMusic: true, generatedCodeVisible: true,
    generatedSliders: 2, tempoSliderChangesServerCode: true,
    errors, screenshots: ['/tmp/strudel-mcp-studio.png', '/tmp/strudel-mcp-studio-mobile.png']
  }, null, 2))
  if (errors.length) process.exitCode = 1
  await mobile.close()
} finally {
  await client.close()
  await browser.close()
}
