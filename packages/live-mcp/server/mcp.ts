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

function registerAdminTools(server: McpServer, store: DemoStore) {
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

function registerPublicTools(server: McpServer, store: DemoStore) {
  server.registerTool('get_app_info', {
    description: 'Inspect the Orbit Social demo, current interface, and safe customization options. No authorization required.',
    inputSchema: {},
    annotations: { readOnlyHint: true }
  }, async () => success({
    app: 'Orbit Social',
    purpose: 'Live MCP-driven visual customization of a demo social chat app',
    availableThemes: ['default', 'aurora', 'focus'],
    activePlugins: store.publicState().plugins.filter(p => p.enabled).map(p => ({ id: p.id, name: p.name })),
    revision: store.publicState().revision,
    visualCustomization: 'Use customize_interface to change colors, banner and plugin-created widget without a rebuild',
    web: 'https://tests-macbook-air.tail70b8a.ts.net:10000/'
  }))

  server.registerTool('list_demo_themes', {
    description: 'List safe preset visual plugins that can be toggled live in Orbit Social.',
    inputSchema: {},
    annotations: { readOnlyHint: true }
  }, async () => success([
    { id: 'default', name: 'Orbit Classic', description: 'Original violet Orbit theme' },
    { id: 'aurora', name: 'Aurora Mode', description: 'Expressive violet theme and highlighted chat messages' },
    { id: 'focus', name: 'Focus Flow', description: 'Emerald theme with clean, compact chat' }
  ]))

  server.registerTool('set_demo_theme', {
    description: 'Switch a built-in visual plugin. Changes appear immediately in connected Orbit Social browser tabs.',
    inputSchema: { theme: z.enum(['default', 'aurora', 'focus']) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
  }, async ({ theme }) => {
    try {
      for (const plugin of store.fullState().plugins) {
        const target = plugin.id === theme
        if (plugin.enabled !== target) await store.setEnabled(plugin.id, target)
      }
      return success({ ok: true, theme, revision: store.publicState().revision })
    } catch (error) { return failure(error) }
  })

  server.registerTool('customize_interface', {
    description: 'Create or update a safe visual plugin to customize the running Orbit Social interface: accent color, header, tagline, icon and sidebar widget. No raw code accepted. Refresh not needed.',
    inputSchema: {
      accent: z.string().regex(/^#[a-fA-F0-9]{6}$/).describe('A six-digit hex color, for example #f97316'),
      title: z.string().trim().min(1).max(90).describe('A new welcome banner headline'),
      description: z.string().trim().min(1).max(180).describe('Short explanatory sentence under the headline'),
      emoji: z.string().max(6).optional().describe('Small decorative symbol e.g. ✨'),
      widget_title: z.string().max(40).optional().describe('Title of a new plugin-controlled sidebar widget'),
      widget_value: z.string().max(50).optional().describe('Highlighted widget value e.g. Designed by ChatGPT')
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
  }, async ({ accent, title, description, emoji, widget_title, widget_value }) => {
    try {
      const color = accent.toLowerCase()
      const soft = color + '18'
      const payload = {
        id: 'chatgpt-visual',
        name: 'ChatGPT Visual Designer',
        theme: {
          accent: color,
          accentSoft: soft,
          appBackground: '#f6f6fb',
          cardBackground: '#ffffff',
          radius: '22px'
        },
        banner: { eyebrow: 'CUSTOMIZED LIVE THROUGH MCP', title, description, emoji: emoji ?? '✦' },
        widget: {
          icon: emoji ?? '✦',
          title: widget_title || 'Designed through MCP',
          value: widget_value || 'Live customization',
          subtitle: 'This widget was generated without rebuilding the application'
        }
      }
      const source = 'export default ' + JSON.stringify(payload, null, 2) + ';\n'
      const existing = store.getPlugin(payload.id)
      if (existing) {
        await store.updatePlugin(payload.id, source)
        if (!existing.enabled) await store.setEnabled(payload.id, true)
      } else {
        await store.installPlugin({
          id: payload.id,
          name: payload.name,
          description: 'Visual theme generated through unauthenticated MCP demo',
          source, enabled: true
        })
      }
      return success({ ok: true, plugin: payload.id, accent: color, title, revision: store.publicState().revision })
    } catch (error) { return failure(error) }
  })
}

export async function handleMcp(req: IncomingMessage, res: ServerResponse, store: DemoStore, mode: 'public' | 'admin' = 'public') {

  const server = new McpServer({ name: 'orbit-live-customization', version: '0.1.0' })
  if (mode === 'admin') registerAdminTools(server, store)
  else registerPublicTools(server, store)
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
