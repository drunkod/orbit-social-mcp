import { chromium } from 'playwright'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const base = process.env.DEMO_URL ?? 'https://tests-macbook-air.tail70b8a.ts.net:10000'
const mcpEndpoint = process.env.MCP_ENDPOINT ?? 'https://tests-macbook-air.tail70b8a.ts.net/orbit-mcp'
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
const client = new Client({ name: 'cafe-original-ui-test', version: '0.1.0' })
const transport = new StreamableHTTPClientTransport(new URL(mcpEndpoint))
const errors: string[] = []
page.on('pageerror', error => errors.push(error.message))

async function call(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name, arguments: args })
  if (result.isError) throw new Error(name + ' failed: ' + JSON.stringify(result.content))
}
try {
  await client.connect(transport)
  await call('set_demo_theme', { theme: 'default' })
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.getByText('Cafe Chat', { exact: true }).waitFor({ timeout: 12000 })
  await page.getByPlaceholder('Chat key, e.g. lobby').waitFor()
  if (await page.getByText('Copy MCP', { exact: false }).count()) throw new Error('MCP promotion appeared in original CAFE UI')
  if (await page.getByRole('button', { name: 'Sign in' }).count()) throw new Error('Non-CAFE login UI appeared')
  await page.screenshot({ path: '/tmp/cafe-original-baseline.png', fullPage: true })
  const roomKey = 'mcp-test-' + Date.now().toString(36)
  await page.getByPlaceholder('Chat key, e.g. lobby').fill(roomKey)
  await page.getByRole('button', { name: 'Join chat' }).click()
  await page.getByText('#' + roomKey, { exact: true }).waitFor({ timeout: 12000 })
  const prompt = 'Testing the original CAFE chat ' + Date.now()
  await page.getByPlaceholder('Type a prompt…').fill(prompt)
  await page.getByRole('button', { name: 'Send' }).click()
  await page.getByText(prompt, { exact: true }).waitFor({ timeout: 12000 })
  await call('customize_interface', {
    accent: '#2563eb',
    title: 'CAFE — customized through MCP',
    description: 'A JavaScript plugin modified this original CAFE UI without rebuilding.',
    widget_title: 'Live plugin',
    widget_value: 'MCP connected',
    emoji: '✦'
  })
  await page.getByText('CAFE — customized through MCP', { exact: true }).waitFor({ timeout: 12000 })
  await page.getByText('Live plugin', { exact: false }).waitFor({ timeout: 12000 })
  await page.screenshot({ path: '/tmp/cafe-original-plugin.png', fullPage: true })
  const computedAccent = await page.locator('button:has-text("Send")').first().evaluate(el => getComputedStyle(el).backgroundColor)
  await call('set_demo_theme', { theme: 'default' })
  await page.getByText('Cafe Chat', { exact: true }).waitFor({ timeout: 12000 })
  await page.getByRole('button', { name: 'Leave' }).click()
  await page.getByRole('button', { name: 'Join chat' }).waitFor({ timeout: 10000 })
  console.log(JSON.stringify({
    result: 'PASS', originalUI: true, chatJoined: roomKey, promptSent: true,
    mcpPluginEnabled: true, accentBackground: computedAccent, reverted: true,
    leftRoom: true, errors,
    screenshots: ['/tmp/cafe-original-baseline.png', '/tmp/cafe-original-plugin.png']
  }, null, 2))
  if (errors.length) process.exitCode = 1
} finally {
  await client.close()
  await browser.close()
}
