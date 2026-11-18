import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const endpoint = process.env.MCP_ENDPOINT ?? 'https://tests-macbook-air.tail70b8a.ts.net:10000/mcp'
const client = new Client({ name: 'chatgpt-noauth-connection-check', version: '0.1.0' })
const transport = new StreamableHTTPClientTransport(new URL(endpoint))
await client.connect(transport)

const tools = await client.listTools()
const names = tools.tools.map(tool => tool.name)
console.log('PUBLIC_TOOLS=' + names.join(','))
if (names.includes('install_plugin') || names.includes('update_plugin_source')) throw new Error('Admin-only tools were exposed!')
if (!names.includes('customize_interface')) throw new Error('Public visual customization tool is missing')

const call = async (name: string, args: Record<string, unknown>) => {
  const result = await client.callTool({ name, arguments: args })
  console.log(name.toUpperCase() + '=' + JSON.stringify(result))
  if (result.isError) throw new Error('Tool failed: ' + name)
}
await call('get_app_info', {})
await call('set_demo_theme', { theme: 'focus' })
await call('customize_interface', {
  accent: '#2563eb',
  title: 'ChatGPT can redesign this app live.',
  description: 'A real MCP call changed this interface through Tailscale Funnel — without OAuth, a page reload, or rebuilding the application.',
  emoji: '✦',
  widget_title: 'ChatGPT Live Designer',
  widget_value: 'Connected through MCP'
})
const stateUrl = process.env.DEMO_STATE_URL ?? endpoint.replace(/\/mcp$/, '/api/state')
const app = await fetch(stateUrl).then(response => response.json()) as {
  plugins: Array<{ id: string; enabled: boolean }>; revision: number
}
if (!app.plugins.some(p => p.id === 'chatgpt-visual' && p.enabled)) throw new Error('Visual plugin was not activated')
console.log('SUCCESS revision=' + app.revision)
await client.close()
