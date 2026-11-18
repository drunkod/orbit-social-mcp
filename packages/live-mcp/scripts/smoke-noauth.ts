import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const endpoint = process.env.MCP_ENDPOINT ?? 'https://tests-macbook-air.tail70b8a.ts.net/orbit-mcp'
const client = new Client({ name: 'orbit-public-noauth-smoke-test', version: '0.1.0' })
const transport = new StreamableHTTPClientTransport(new URL(endpoint))

try {
  await client.connect(transport)
  const result = await client.listTools()
  const actual = result.tools.map(tool => tool.name).sort()
  const expected = ['customize_interface', 'get_app_info', 'list_demo_themes', 'set_demo_theme']
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('Unexpected public tool set. Got ' + actual.join(', '))
  }
  const info = await client.callTool({ name: 'get_app_info', arguments: {} })
  if (info.isError || info.content.length === 0) throw new Error('get_app_info returned an error')
  const themes = await client.callTool({ name: 'list_demo_themes', arguments: {} })
  if (themes.isError || themes.content.length === 0) throw new Error('list_demo_themes returned an error')
  console.log('PASS public no-auth MCP handshake')
  console.log('PASS public tools: ' + actual.join(', '))
  console.log('PASS read-only MCP calls')
  console.log('MCP_ENDPOINT=' + endpoint)
} finally {
  await client.close()
}
