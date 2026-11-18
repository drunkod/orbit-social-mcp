/**
 * Optional MCP-controlled extension host for CAFE.
 *
 * The original Foldkit Model, chat view, commands and Cloudflare backend remain
 * unchanged. This host subscribes to the existing MCP server's plugin registry
 * and decorates CAFE's existing DOM only when a plugin is enabled.
 */
type CafePlugin = {
  id?: string
  name?: string
  theme?: Partial<{
    accent: string
    accentSoft: string
    appBackground: string
    cardBackground: string
    radius: string
  }>
  banner?: { eyebrow?: string; title?: string; description?: string; emoji?: string }
  widget?: { icon?: string; title?: string; value?: string; subtitle?: string }
  messageDecorator?: (message: { role: string; text: string }) =>
    { tag?: string; highlight?: boolean; tint?: string }
  mount?: (node: HTMLElement, context: { channel: string; connected: boolean }) => void | (() => void)
}

type PluginMeta = { id: string; enabled: boolean; version: number }
type Registry = { plugins: PluginMeta[] }

const originalTitle = 'Cafe Chat'
const originalDisconnectedText = 'Pick a chat key to join'
const allowedColor = /^(?:#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|rgba?\([^)]{1,60}\))$/
function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && allowedColor.test(value) ? value : fallback
}

export function startMcpPlugins(base: string | undefined): void {
  if (!base || !document.getElementById('root')) return

  const service = new URL(base, window.location.href)
  const uri = (path: string) => new URL(path.replace(/^\/+/, ''), service).href
  // Foldkit replaces the #root mount node with its generated Document.
  // Observe the stable document element so we can follow that replacement.
  const root = document.documentElement
  const style = document.createElement('style')
  style.id = 'cafe-mcp-plugin-style'
  document.head.appendChild(style)

  let modules: CafePlugin[] = []
  let lastRevision = ''
  let previousSubtitle = ''
  let mounted: { element: HTMLElement; cleanup?: () => void } | undefined
  let scheduled = false
  let synchronizing = false

  function render() {
    const panel = root.querySelector<HTMLElement>('[data-mcp-panel]')
    if (!panel) return

    const theme: NonNullable<CafePlugin['theme']> = Object.assign({}, ...modules.map(p => p.theme ?? {}))
    const accent = color(theme.accent, '#d97706')
    const soft = color(theme.accentSoft, '#fef3c7')
    const background = color(theme.appBackground, '#f5f5f4')
    const card = color(theme.cardBackground, '#ffffff')
    const radius = theme.radius && /^(\d{1,2}px)$/.test(theme.radius) ? theme.radius : '12px'

    // No plugins means exactly the upstream Cafe HTML/CSS styling.
    const nextStylesheet = modules.length ? [
      '[data-mcp-panel] { background-color: ' + card + ' !important; border-radius:' + radius + ' !important; }',
      '[data-mcp-app] { background-color: ' + background + ' !important; }',
      '[data-mcp-panel] .bg-amber-600 { background-color:' + accent + ' !important; }',
      '[data-mcp-panel] .hover\\:bg-amber-700:hover { background-color:' + accent + ' !important; filter:brightness(.9); }',
      '[data-mcp-panel] .bg-amber-100 { background-color:' + soft + ' !important; }',
      '[data-mcp-panel] .focus\\:ring-amber-500:focus { --tw-ring-color:' + accent + ' !important; }'
    ].join('\n') : ''
    if (style.textContent !== nextStylesheet) style.textContent = nextStylesheet

    const banner = [...modules].reverse().find(p => p.banner)?.banner
    const title = root.querySelector<HTMLElement>('[data-mcp-title]')
    if (title) {
      const next = banner?.title || originalTitle
      if (title.textContent !== next) title.textContent = next
    }
    const subtitle = root.querySelector<HTMLElement>('[data-mcp-subtitle]')
    if (subtitle && (subtitle.textContent === originalDisconnectedText || subtitle.textContent === previousSubtitle)) {
      const next = banner?.description || originalDisconnectedText
      if (subtitle.textContent !== next) subtitle.textContent = next
      previousSubtitle = next
    }

    const widget = [...modules].reverse().find(p => p.widget)?.widget
    const header = root.querySelector<HTMLElement>('[data-mcp-header]')
    if (header) {
      let badge = header.querySelector<HTMLElement>('[data-mcp-widget]')
      if (!widget && badge) { badge.remove(); badge = null }
      if (widget) {
        if (!badge) {
          badge = document.createElement('span')
          badge.dataset.mcpWidget = 'true'
          badge.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-left:auto;margin-right:10px;border-radius:8px;padding:5px 9px;font-size:11px;font-weight:600;white-space:nowrap;'
          // Header already contains the upstream connection status and Leave button.
          header.insertBefore(badge, header.lastElementChild)
        }
        const label = [widget.icon, widget.title, widget.value].filter(Boolean).join(' · ')
        if (badge.textContent !== label) badge.textContent = label
        badge.style.backgroundColor = soft
        badge.style.color = accent
      }
    }

    for (const message of root.querySelectorAll<HTMLElement>('[data-mcp-message]')) {
      const bubble = message.querySelector<HTMLElement>('[data-mcp-bubble]')
      if (!bubble) continue
      const text = bubble.textContent || ''
      const role = message.dataset.role || 'user'
      let decoration: ReturnType<NonNullable<CafePlugin['messageDecorator']>> = {}
      for (const plugin of modules) {
        try { decoration = { ...decoration, ...plugin.messageDecorator?.({ role, text }) } }
        catch (error) { console.warn('CAFE plugin decorator failed:', error) }
      }
      const tint = decoration.tint ? color(decoration.tint, soft) : ''
      bubble.style.backgroundColor = tint || ''
      bubble.style.boxShadow = decoration.highlight ? '0 0 0 2px ' + accent : ''
      let tag = message.querySelector<HTMLElement>('[data-mcp-tag]')
      if (!decoration.tag && tag) { tag.remove(); tag = null }
      if (decoration.tag) {
        if (!tag) {
          tag = document.createElement('span')
          tag.dataset.mcpTag = 'true'
          tag.style.cssText = 'font-size:10px;font-weight:700;margin-left:6px;letter-spacing:.3px;'
          message.appendChild(tag)
        }
        const next = decoration.tag.slice(0, 30)
        if (tag.textContent !== next) tag.textContent = next
        tag.style.color = accent
      }
    }

    const mountPlugin = [...modules].reverse().find(p => p.mount)
    if (!mountPlugin || !header) {
      if (mounted) { mounted.cleanup?.(); mounted.element.remove(); mounted = undefined }
    } else if (!mounted || !mounted.element.isConnected || mounted.element.dataset.pluginId !== mountPlugin.id) {
      if (mounted) { mounted.cleanup?.(); mounted.element.remove() }
      const node = document.createElement('div')
      node.dataset.pluginId = mountPlugin.id ?? ''
      node.style.cssText = 'font-size:12px;max-width:250px;'
      header.insertBefore(node, header.lastElementChild)
      let cleanup: void | (() => void) = undefined
      try { cleanup = mountPlugin.mount?.(node, { channel: 'lobby', connected: !!root.querySelector('[data-mcp-message]') }) }
      catch (error) { console.warn('CAFE plugin mount failed:', error) }
      mounted = { element: node, ...(typeof cleanup === 'function' ? { cleanup } : {}) }
    }
  }

  const observer = new MutationObserver(() => {
    if (synchronizing || scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      synchronizing = true
      try { render() } finally { synchronizing = false }
    })
  })
  observer.observe(root, { childList: true, subtree: true, characterData: true })

  async function refresh() {
    try {
      const response = await fetch(uri('api/state'), { cache: 'no-store' })
      if (!response.ok) return
      const state: Registry = await response.json()
      const enabled = state.plugins.filter(p => p.enabled)
      const revision = enabled.map(p => p.id + ':' + p.version).join('|')
      if (revision === lastRevision) return
      const next = await Promise.all(enabled.map(async p => {
        try {
          const moduleUrl = uri('plugins/' + p.id + '.js') + '?v=' + p.version
          const imported: { default?: CafePlugin } = await import(/* @vite-ignore */ moduleUrl)
          return imported.default ?? null
        } catch (error) { console.warn('CAFE plugin load failed:', p.id, error); return null }
      }))
      modules = next.filter((p): p is CafePlugin => p !== null)
      lastRevision = revision
      synchronizing = true
      try { render() } finally { synchronizing = false }
    } catch (error) {
      console.warn('CAFE MCP endpoint not available:', error)
    }
  }

  void refresh()
  const events = new EventSource(uri('api/events'))
  events.addEventListener('change', () => { void refresh() })
  window.addEventListener('pagehide', () => {
    events.close()
    observer.disconnect()
    mounted?.cleanup?.()
  }, { once: true })
}
