import { readFileSync } from 'node:fs'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const endpoint = process.env.MCP_ENDPOINT || 'http://127.0.0.1:8787/mcp'
const token = process.env.MCP_DEMO_TOKEN || readFileSync('data/.mcp-token', 'utf8').trim()
const client = new Client({ name: 'orbit-demo-controller', version: '0.1.0' })
const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
  requestInit: { headers: { Authorization: 'Bearer ' + token } }
})
await client.connect(transport)

const [operation = 'list', a, b] = process.argv.slice(2)
const operations: Record<string, { name: string; arguments: Record<string, unknown> }> = {
  list: { name: 'list_plugins', arguments: {} },
  overview: { name: 'app_overview', arguments: {} },
  aurora: { name: 'set_plugin_enabled', arguments: { id: 'aurora', enabled: true } },
  focus: { name: 'set_plugin_enabled', arguments: { id: 'focus', enabled: true } },
  disable: { name: 'set_plugin_enabled', arguments: { id: a ?? 'aurora', enabled: false } },
  toggle: { name: 'set_plugin_enabled', arguments: { id: a ?? 'aurora', enabled: b === 'on' } },
  reset: { name: 'reset_demo', arguments: {} },
  post: { name: 'post_message', arguments: { author: 'MCP Agent', text: [a, b].filter(Boolean).join(' ') || 'An MCP agent just changed this conversation ✨' } },
  install: {
    name: 'install_plugin',
    arguments: {
      id: 'sunset-widget',
      name: 'Sunset Widget',
      description: 'An AI-generated citrus theme, custom sidebar card and message badges',
      enabled: true,
      source: readFileSync('demo-plugins/sunset.js', 'utf8')
    }
  }
}
if (operation === 'tools') {
  console.log(JSON.stringify(await client.listTools(), null, 2))
} else {
  const action = operations[operation]
  if (!action) throw new Error('Unknown operation: ' + operation + '. Use list, tools, aurora, focus, disable, toggle, reset, post, install.')
  const result = await client.callTool(action)
  console.log(JSON.stringify(result, null, 2))
  if (result.isError) process.exitCode = 1
}
await client.close()
