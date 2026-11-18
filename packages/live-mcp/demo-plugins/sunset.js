export default {
  id: 'sunset-widget',
  name: 'Sunset Widget',
  theme: {
    accent: '#ef754d',
    accentSoft: '#fff0e7',
    appBackground: '#fff5ed',
    cardBackground: '#ffffff',
    radius: '26px'
  },
  banner: {
    eyebrow: 'LIVE PLUGIN INSTALLED',
    title: 'A little sunshine in every conversation.',
    description: 'This new theme was added by an AI agent through the MCP server — no rebuild required.',
    emoji: '☀'
  },
  composerPlaceholder: 'Share a warm thought...',
  widget: {
    icon: '☀',
    title: 'Sunset social club',
    value: 'Golden hour',
    subtitle: 'A brand-new widget created from JavaScript'
  },
  messageDecorator(message) {
    return /love|sun|warm|together/i.test(message.text)
      ? { tag: 'GOOD VIBES', highlight: true, tint: '#fff0e3' }
      : {}
  }
}
