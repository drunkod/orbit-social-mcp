import type { IncomingMessage, ServerResponse } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import type { DemoStore } from './store.js'

export const PLUGIN_GUIDE = [
  'Plugins are browser-executed JavaScript ESM files with export default { ... }.',
  'Required metadata: id (lowercase slug), name.',
  'Optional: theme: { accent, accentSoft, appBackground, cardBackground, radius } (CSS colors).',
  'Optional: banner: { eyebrow, title, description, emoji }.',
  'Optional: widget: { icon, title, value, subtitle }.',
  'Optional: composerPlaceholder (string), compactMessages (boolean), hideReactions (boolean).',
  'Optional: messageDecorator(message) => { tag?: string, highlight?: boolean, tint?: string }.',
  'Optional: mount(hostElement, context) => cleanupFunction for a custom sidebar widget.',
  'Client code hot-reloads over EventSource; no APK or app rebuild is necessary.',
  'Example: export default { id: "spark", name: "Spark", theme: { accent: "#e66b4c" }, widget: { icon: "✦", title: "New plugin", value: "Live!", subtitle: "Installed through MCP" }, messageDecorator(m) { return m.text.includes("idea") ? { tag: "IDEA", highlight: true } : {} } };',
  'Demo runtime: plugin code executes in the browser. Install only trusted code.'
].join('\n')

const success = (value: unknown) => ({
  content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }]
})
const failure = (error: unknown) => ({
  isError: true,
  content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }]
})

function registerTools(server: McpServer, store: DemoStore) {
  server.registerTool('app_overview', {
    description: 'Get app state, plugin interface and instructions for writing hot-reloadable UI plugins.',
    inputSchema: {}
  }, async () => success({ app: 'Orbit Social / CAFE Effect MVP', state: store.publicState(), pluginGuide: PLUGIN_GUIDE }))

  server.registerTool('list_plugins', {
    description: 'List installed JavaScript UI plugins and their enable/disable state.',
    inputSchema: {}
  }, async () => success(store.publicState().plugins))

  server.registerTool('get_plugin_source', {
    description: 'Read editable JavaScript source code of an installed plugin.',
    inputSchema: { id: z.string() }
  }, async ({ id }) => {
    const plugin = store.getPlugin(id)
    return plugin ? success({ ...plugin }) : failure('Unknown plugin: ' + id)
  })

  server.registerTool('set_plugin_enabled', {
    description: 'Enable or disable an installed plugin. All connected browsers update live.',
    inputSchema: { id: z.string(), enabled: z.boolean() }
  }, async ({ id, enabled }) => {
    try {
      await store.setEnabled(id, enabled)
      return success({ ok: true, id, enabled, revision: store.publicState().revision })
    } catch (e) { return failure(e) }
  })

  server.registerTool('install_plugin', {
    description: 'Install and activate a JavaScript ESM UI plugin from source code. Changes appear live.',
    inputSchema: {
      id: z.string().describe('Lowercase slug, e.g. neon-labels'),
      name: z.string(),
      description: z.string(),
      source: z.string().describe('JavaScript module source with export default'),
      enabled: z.boolean().optional()
    }
  }, async input => {
    try {
      await store.installPlugin(input)
      return success({ ok: true, id: input.id, revision: store.publicState().revision })
    } catch (e) { return failure(e) }
  })

  server.registerTool('update_plugin_source', {
    description: 'Replace JavaScript source of an existing plugin and hot reload without restart.',
    inputSchema: { id: z.string(), source: z.string() }
  }, async ({ id, source }) => {
    try {
      await store.updatePlugin(id, source)
      return success({ ok: true, id, revision: store.publicState().revision })
    } catch (e) { return failure(e) }
  })

  server.registerTool('remove_plugin', {
    description: 'Uninstall a runtime plugin and revert its effects immediately.',
    inputSchema: { id: z.string() }
  }, async ({ id }) => {
    try {
      await store.removePlugin(id)
      return success({ ok: true, id })
    } catch (e) { return failure(e) }
  })

  server.registerTool('post_message', {
    description: 'Post a new chat message; it immediately appears to connected viewers.',
    inputSchema: { text: z.string().min(1).max(2000), author: z.string().optional() }
  }, async ({ text, author }) => {
    try {
      await store.postMessage(text, author || 'MCP Agent')
      return success({ ok: true, revision: store.publicState().revision })
    } catch (e) { return failure(e) }
  })

  server.registerTool('reset_demo', {
    description: 'Restore baseline chat messages and disable all demo plugins.',
    inputSchema: {}
  }, async () => {
    try {
      await store.reset()
      return success({ ok: true, revision: store.publicState().revision })
    } catch (e) { return failure(e) }
  })
}

export async function handleMcp(req: IncomingMessage, res: ServerResponse, store: DemoStore) {
  const server = new McpServer({ name: 'orbit-live-customization', version: '0.1.0' })
  registerTools(server, store)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  try {
    await server.connect(transport)
    await transport.handleRequest(req, res)
  } finally {
    if (res.writableEnded) {
      await transport.close()
      await server.close()
    } else {
      res.on('close', () => { void transport.close(); void server.close() })
    }
  }
}
