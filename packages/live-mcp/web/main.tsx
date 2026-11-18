import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  ArrowRight, Bell, Check, ChevronDown, CircleHelp, Code2, Compass, Copy,
  Hash, Heart, Home, Layers3, MessageCircle, MoreHorizontal, Plus,
  RadioTower, Search, Send, Settings2, ShieldCheck, Sparkles, Users, WandSparkles,
  Zap
} from 'lucide-react'
import './styles.css'

type ChatMessage = { id: string; author: string; initials: string; tone: string; time: string; text: string; reactions: string[] }
type PluginMeta = { id: string; name: string; description: string; enabled: boolean; version: number }
type AuditEntry = { id: string; event: string; detail: string; time: string }
type State = { revision: number; messages: ChatMessage[]; plugins: PluginMeta[]; activity: AuditEntry[] }
type Decoration = { tag?: string; highlight?: boolean; tint?: string }
type RuntimePlugin = {
  id?: string
  name?: string
  theme?: Partial<{ accent: string; accentSoft: string; appBackground: string; cardBackground: string; radius: string }>
  banner?: { eyebrow?: string; title?: string; description?: string; emoji?: string }
  widget?: { icon?: string; title?: string; value?: string; subtitle?: string }
  composerPlaceholder?: string
  compactMessages?: boolean
  hideReactions?: boolean
  messageDecorator?: (message: ChatMessage) => Decoration
  mount?: (node: HTMLElement, context: { channel: string; connected: boolean }) => void | (() => void)
}
const DEFAULT_BANNER = {
  eyebrow: 'YOUR SPACE, YOUR RULES',
  title: 'Good conversations start here.',
  description: 'A cozy corner for the curious. Say hello, share a thought, or build something together.',
  emoji: '✳'
}
const participants = [
  ['Maya Chen', 'MC', 'coral'], ['Alex Rivera', 'AR', 'blue'],
  ['Jordan Lee', 'JL', 'violet'], ['Sam Taylor', 'ST', 'green']
]

function Avatar({ initials, tone, size = 'normal' }: { initials: string; tone: string; size?: 'normal' | 'small' }) {
  return <span className={'avatar avatar-' + tone + (size === 'small' ? ' avatar-small' : '')}>{initials}</span>
}

function CustomWidget({ plugin }: { plugin: RuntimePlugin }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node || !plugin.mount) return
    node.replaceChildren()
    let cleanup: void | (() => void)
    try { cleanup = plugin.mount(node, { channel: 'general', connected: true }) }
    catch (error) { console.warn('[plugin mount]', error) }
    return () => {
      if (typeof cleanup === 'function') cleanup()
      node.replaceChildren()
    }
  }, [plugin])
  return <div className="plugin-mount" ref={ref} />
}

function App() {
  const [state, setState] = useState<State | null>(null)
  const [modules, setModules] = useState<RuntimePlugin[]>([])
  const [connection, setConnection] = useState<'connecting' | 'live' | 'offline'>('connecting')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [channel, setChannel] = useState('general')
  const [copied, setCopied] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [search, setSearch] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let closed = false
    const load = async () => {
      try {
        const response = await fetch('/api/state', { cache: 'no-store' })
        if (!response.ok) throw new Error('state unavailable')
        const data = await response.json() as State
        if (!closed) { setState(data); setConnection('live') }
      } catch { if (!closed) setConnection('offline') }
    }
    void load()
    const source = new EventSource('/api/events')
    source.addEventListener('change', () => { void load() })
    source.onopen = () => setConnection('live')
    source.onerror = () => setConnection('connecting')
    return () => { closed = true; source.close() }
  }, [])

  const pluginKey = state?.plugins.map(p => p.id + ':' + p.version + ':' + p.enabled).join('|') ?? ''
  useEffect(() => {
    let cancelled = false
    const enabled = state?.plugins.filter(p => p.enabled) ?? []
    void Promise.all(enabled.map(async meta => {
      try {
        const path = '/plugins/' + meta.id + '.js?v=' + meta.version
        const imported = await import(/* @vite-ignore */ path) as { default?: RuntimePlugin }
        return imported.default ?? null
      } catch (error) {
        console.error('Plugin load failed', meta.id, error)
        return null
      }
    })).then(loaded => { if (!cancelled) setModules(loaded.filter((p): p is RuntimePlugin => p !== null)) })
    return () => { cancelled = true }
  }, [pluginKey])

  const settings = useMemo(() => {
    const theme = {
      accent: '#615ceb', accentSoft: '#edecff',
      appBackground: '#f3f4f8', cardBackground: '#ffffff', radius: '18px'
    }
    for (const plugin of modules) Object.assign(theme, plugin.theme ?? {})
    return {
      theme,
      banner: [...modules].reverse().find(p => p.banner)?.banner ?? DEFAULT_BANNER,
      widget: [...modules].reverse().find(p => p.widget)?.widget,
      placeholder: [...modules].reverse().find(p => p.composerPlaceholder)?.composerPlaceholder ?? 'Message #general...',
      compact: modules.some(p => p.compactMessages),
      hideReactions: modules.some(p => p.hideReactions)
    }
  }, [modules])

  const style = {
    '--accent': settings.theme.accent,
    '--accent-soft': settings.theme.accentSoft,
    '--app-bg': settings.theme.appBackground,
    '--card-bg': settings.theme.cardBackground,
    '--card-radius': settings.theme.radius
  } as React.CSSProperties

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!message.trim() || sending) return
    const text = message
    setSending(true)
    try {
      const response = await fetch('/api/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      if (!response.ok) throw new Error('Unable to send')
      setMessage('')
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60)
    } catch (error) { window.alert(String(error)) }
    finally { setSending(false) }
  }

  const mcpUrl = window.location.hostname === 'tests-macbook-air.tail70b8a.ts.net'
    ? 'https://tests-macbook-air.tail70b8a.ts.net/orbit-mcp'
    : window.location.origin + '/mcp'
  const copyMcp = async () => {
    try { await navigator.clipboard.writeText(mcpUrl); setCopied(true); setTimeout(() => setCopied(false), 1600) }
    catch { window.prompt('Copy MCP endpoint:', mcpUrl) }
  }

  const messages = (state?.messages ?? []).filter(m => !search || (m.text + m.author).toLowerCase().includes(search.toLowerCase()))
  const activePlugins = state?.plugins.filter(p => p.enabled) ?? []

  return (
    <div className="page" style={style}>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark"><span>✳</span></div>
            <div><strong>orbit<span className="brand-dot">.</span></strong><small>your social universe</small></div>
          </div>
          <button className="workspace-select" type="button" onClick={() => setShowHelp(v => !v)}>
            <div className="workspace-icon">O</div>
            <span><strong>Orbit Studio</strong><small>Community workspace</small></span>
            <ChevronDown size={16} />
          </button>
          <div className="sidebar-section-label">DISCOVER</div>
          <nav className="nav">
            <button onClick={() => setChannel('home')} className={channel === 'home' ? 'nav-link active' : 'nav-link'}><Home size={18}/> Home <span className="nav-counter">2</span></button>
            <button onClick={() => setChannel('explore')} className={channel === 'explore' ? 'nav-link active' : 'nav-link'}><Compass size={18}/> Explore</button>
            <button onClick={() => setChannel('messages')} className={channel === 'messages' ? 'nav-link active' : 'nav-link'}><MessageCircle size={18}/> Messages <span className="nav-pill">3</span></button>
          </nav>
          <div className="section-line"></div>
          <div className="sidebar-heading"><span>YOUR CHANNELS</span><Plus size={16}/></div>
          <nav className="nav channel-list">
            {['general', 'design-corner', 'random'].map(label => (
              <button key={label} className={'nav-link ' + (channel === label ? 'active' : '')} onClick={() => setChannel(label)}>
                <Hash size={17} />{label}{label === 'general' ? <span className="channel-dot" /> : null}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="invitation"><div className="invitation-icon"><Sparkles size={18}/></div><strong>Make it yours.</strong><p>Change this space live with an AI agent using MCP.</p><button onClick={copyMcp}>{copied ? 'Copied!' : 'Copy MCP link'} <ArrowRight size={14}/></button></div>
            <div className="current-user"><Avatar initials="YO" tone="purple" size="small"/><div><strong>Demo Visitor</strong><small>Community member</small></div><MoreHorizontal size={19}/></div>
          </div>
        </aside>

        <main className="center">
          <header className="main-header">
            <div className="breadcrumbs"><span>Workspace</span><span className="slash">/</span><strong>#{channel === 'home' || channel === 'explore' || channel === 'messages' ? 'general' : channel}</strong></div>
            <div className="header-actions">
              <div className={'connection-chip ' + connection}><span className="pulse-dot"/>{connection === 'live' ? 'Live sync' : connection}</div>
              <button className="icon-button" aria-label="Help" onClick={() => setShowHelp(v => !v)}><CircleHelp size={19}/></button>
              <button className="icon-button" aria-label="Search" onClick={() => document.getElementById('search-input')?.focus()}><Search size={19}/></button>
              <Avatar initials="YO" tone="purple" size="small"/>
            </div>
          </header>
          <div className="main-scroll">
            <div className="hero">
              <div className="hero-orb hero-orb-one"/><div className="hero-orb hero-orb-two"/>
              <div className="hero-eyebrow"><span className="tiny-star">✦</span> {settings.banner?.eyebrow}</div>
              <h1>{settings.banner?.title}</h1>
              <p>{settings.banner?.description}</p>
              <div className="hero-pills"><span><Users size={15}/> 248 members</span><span><span className="hero-online"/> 18 online</span></div>
              <span className="hero-symbol">{settings.banner?.emoji}</span>
            </div>
            {showHelp && <div className="help-panel"><strong>How to customize this app with MCP</strong><p>Connect an MCP-capable AI client to <code>{mcpUrl}</code> without authentication. For advanced JavaScript editing, use <code>/mcp-admin</code> with the token stored in <code>data/.mcp-token</code>. Ask it to enable Aurora Mode, install a JavaScript plugin, or rewrite a plugin. Every connected browser sees the result without reloading.</p><button onClick={copyMcp}>{copied ? 'Copied' : 'Copy connection URL'} <Copy size={14}/></button></div>}
            <div className="conversation-heading">
              <div><div className="eyebrow">CONVERSATION</div><h2>What's happening in #{channel === 'home' || channel === 'explore' || channel === 'messages' ? 'general' : channel}<span className="heading-spark">✳</span></h2><p>A little place for big ideas. Join the conversation.</p></div>
              <button className="more-button" onClick={() => setShowHelp(v => !v)}><MoreHorizontal size={20}/></button>
            </div>
            <div className="search-area"><Search size={16}/><input id="search-input" placeholder="Search this conversation..." value={search} onChange={e => setSearch(e.target.value)}/>{search && <button onClick={() => setSearch('')}>Clear</button>}</div>
            <div className={'messages ' + (settings.compact ? 'compact' : '')}>
              {messages.map((m) => {
                let decoration: Decoration = {}
                for (const plugin of modules) {
                  try { decoration = { ...decoration, ...(plugin.messageDecorator?.(m) ?? {}) } }
                  catch (error) { console.warn('Plugin messageDecorator failed', error) }
                }
                return <article className={'message ' + (decoration.highlight ? 'message-highlight' : '')} key={m.id} style={decoration.tint ? { '--message-tint': decoration.tint } as React.CSSProperties : undefined}>
                  <Avatar initials={m.initials} tone={m.tone}/>
                  <div className="message-body"><div className="message-meta"><strong>{m.author}</strong>{m.author === 'Maya Chen' && <span className="admin-label">ADMIN</span>}{decoration.tag && <span className="plugin-label">{decoration.tag}</span>}<time>{m.time}</time></div><p>{m.text}</p>{!settings.hideReactions && m.reactions?.length > 0 && <div className="reactions">{m.reactions.map(r => <span key={r}>{r}</span>)}</div>}</div><button className="message-more" aria-label="More"><MoreHorizontal size={16}/></button>
                </article>
              })}
              {!messages.length && <div className="empty-messages">No matching messages yet. Start the conversation!</div>}
              <div ref={bottomRef}/>
            </div>
          </div>
          <form className="composer-wrap" onSubmit={sendMessage}>
            <div className="composer"><button type="button" className="composer-add" onClick={() => setShowHelp(true)} title="Learn about plugins"><Plus size={19}/></button><input aria-label="Message" value={message} onChange={e => setMessage(e.target.value)} placeholder={settings.placeholder} maxLength={2000}/><span className="composer-spark"><Sparkles size={18}/></span><button className="send-button" type="submit" disabled={sending || !message.trim()} aria-label="Send message"><Send size={17}/></button></div>
            <div className="composer-footer"><span><strong>↵</strong> to send</span><span>Powered by <strong>Effect</strong> & <strong>MCP</strong> ✦</span></div>
          </form>
        </main>

        <aside className="right-panel">
          <div className="right-top"><div className="right-title"><Layers3 size={20}/> Studio panel</div><button className="icon-button" onClick={() => setShowHelp(v=>!v)}><Settings2 size={18}/></button></div>
          <div className="right-scroll">
            <div className="panel-heading">LIVE EXTENSIONS <span className="count-tag">{activePlugins.length} active</span></div>
            <div className="plugin-intro"><div className="plugin-illustration"><WandSparkles size={22}/></div><strong>Your space, reimagined.</strong><p>AI-written plugins change this experience live through the MCP connection.</p></div>
            <div className="plugins">{(state?.plugins ?? []).map((p,i) => <div className="plugin-row" key={p.id}><span className={'plugin-icon pi-' + (i % 3)}>{i === 0 ? '✦' : i === 1 ? '◈' : '✳'}</span><div className="plugin-description"><strong>{p.name}</strong><small>{p.enabled ? 'Running · v' + p.version : 'Ready to activate'}</small></div><span className={'status-toggle ' + (p.enabled ? 'on' : '')} aria-label={p.enabled ? 'Active' : 'Inactive'}><span/></span></div>)}</div>
            <div className="connector-card">
              <div className="connector-top"><div className="connector-icon"><RadioTower size={19}/></div><span className="connector-status"><span/> MCP READY</span></div>
              <h3>Connect your AI</h3><p>Ask Claude, Codex, or any MCP client to rewrite the interface in real time.</p><div className="endpoint-field"><span>/mcp</span><button onClick={copyMcp} title="Copy MCP endpoint">{copied ? <Check size={15}/> : <Copy size={15}/>}</button></div><button className="connector-button" onClick={copyMcp}>{copied ? 'Copied to clipboard' : 'Copy MCP endpoint'}<ArrowRight size={15}/></button>
            </div>
            {settings.widget && <div className="dynamic-widget"><div className="widget-overline">PLUGIN-CREATED WIDGET</div><div className="widget-icon">{settings.widget.icon}</div><strong>{settings.widget.title}</strong><b>{settings.widget.value}</b><p>{settings.widget.subtitle}</p></div>}
            {modules.filter(p => p.mount).map((p,i) => <CustomWidget plugin={p} key={p.id ?? i}/>)}
            <div className="panel-heading activity-heading">LIVE ACTIVITY <span className="live-indicator"/> </div>
            <div className="timeline">{(state?.activity ?? []).slice(0,5).map((item,i) => <div className="timeline-item" key={item.id}><span className={'timeline-point ' + (i === 0 ? 'current' : '')}/><div><strong>{item.event.replaceAll(':', ' · ')}</strong><p>{item.detail}</p><time>{new Date(item.time).toLocaleTimeString('en-US',{hour:'numeric', minute:'2-digit'})}</time></div></div>)}</div>
            <div className="panel-heading members-heading">ONLINE MEMBERS <span className="count-tag">18 online</span></div>
            <div className="member-stack">{participants.map(([name, initials, tone]) => <div className="member" key={name}><Avatar initials={initials} tone={tone} size="small"/><span>{name}</span><i/></div>)}</div>
          </div>
          <div className="right-footer"><ShieldCheck size={15}/> Local-first demo · Runtime plugins</div>
        </aside>
      </div>
    </div>
  )
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>)
