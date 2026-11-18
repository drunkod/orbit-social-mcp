import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const base = process.env.DEMO_URL || 'https://tests-macbook-air.tail70b8a.ts.net:10000'
const token = readFileSync('data/.mcp-token', 'utf8').trim()
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) })
const page = await browser.newPage({ viewport: { width: 1512, height: 950 }, deviceScaleFactor: 1 })
const errors: string[] = []
page.on('pageerror', error => errors.push(error.message))
const client = new Client({ name: 'orbit-visual-test', version: '0.1.0' })
const transport = new StreamableHTTPClientTransport(new URL(base + '/mcp'), {
  requestInit: { headers: { Authorization: 'Bearer ' + token } }
})
await client.connect(transport)
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const result = await client.callTool({ name, arguments: args })
  if (result.isError) throw new Error(JSON.stringify(result.content))
  return result
}
try {
  await call('reset_demo')
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.locator('.hero h1').getByText('Good conversations start here.').waitFor({ timeout: 15000 })
  await page.screenshot({ path: '/tmp/orbit-before.png', fullPage: true })
  const before = await page.locator('.hero h1').textContent()
  await call('set_plugin_enabled', { id: 'aurora', enabled: true })
  await page.locator('.hero h1').getByText('Ideas look better together.').waitFor({ timeout: 10000 })
  const source = readFileSync('demo-plugins/sunset.js', 'utf8')
  await call('install_plugin', { id: 'sunset-widget', name: 'Sunset Widget', description: 'Dynamically installed sunrise look', source, enabled: true })
  await page.locator('.hero h1').getByText('A little sunshine in every conversation.').waitFor({ timeout: 10000 })
  await page.screenshot({ path: '/tmp/orbit-after.png', fullPage: true })
  const after = await page.locator('.hero h1').textContent()
  const background = await page.locator('.page').evaluate(el => getComputedStyle(el).backgroundColor)
  const pluginWidget = await page.locator('.dynamic-widget').count()
  const activeCount = await page.locator('.status-toggle.on').count()
  console.log(JSON.stringify({ before, after, background, pluginWidget, activeCount, errors, url: base }, null, 2))
  if (!pluginWidget || activeCount !== 2 || errors.length) process.exitCode = 1
} finally {
  await client.close()
  await browser.close()
}
