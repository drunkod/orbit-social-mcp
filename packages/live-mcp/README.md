# Orbit Social — live MCP-customizable chat app

A working Effect-powered extension of the [CAFE chat application](https://github.com/Effect-TS/cafe). It demonstrates connecting an AI/MCP client through a Tailscale Funnel HTTPS address and **changing a running social app by installing or editing JavaScript plugins**. Existing viewers see the change automatically over Server-Sent Events.

## What is real

- Polished React social/chat UI with shared persisted chat messages
- Effect v4 state transitions and persistence
- Real MCP **Streamable HTTP** tools at public /mcp and token-protected /mcp-admin (official TypeScript MCP SDK)
- Plugin JavaScript source installation, replacement, activation, deactivation and removal
- Browser ESM plugin loading without app rebuild or page refresh
- CSS theme, announcement, sidebar widget and executable message decoration hooks
- Live SSE updates and MCP activity timeline
- Tailscale Funnel on a dedicated HTTPS port

## Architecture

This repository retains the upstream CAFE source and adds packages/live-mcp. The upstream implementation is Cloudflare + Alchemy + Foldkit + Effect; Orbit uses Effect v4 and CAFE's chat/event architecture locally to avoid requiring Cloudflare credentials for a visual MVP.

MCP client -> Tailscale Funnel -> Node HTTP + MCP SDK -> Effect DemoStore -> state JSON -> SSE -> React app -> JS plugins (dynamic import)

The public no-auth endpoint is limited to preset themes and server-generated visual plugins; it never accepts arbitrary JS source. Powerful JS editing tools remain token-protected at /mcp-admin. This is a demo, not a multi-user security-hardened service.

## Start

Prerequisites: Node.js >= 22 and pnpm.

From the repository root:

  pnpm install --filter @cafe/live-mcp...
  pnpm dev:mcp

The app starts on http://127.0.0.1:8787 and its Streamable HTTP MCP endpoint is http://127.0.0.1:8787/mcp.

The server creates a persistent token at packages/live-mcp/data/.mcp-token (intentionally git-ignored). Read it with:

  cat packages/live-mcp/data/.mcp-token

### Drive the app using actual MCP transport

In another terminal:

  cd packages/live-mcp
  pnpm exec tsx scripts/drive-mcp.ts tools
  pnpm exec tsx scripts/drive-mcp.ts aurora
  pnpm exec tsx scripts/drive-mcp.ts focus
  pnpm exec tsx scripts/drive-mcp.ts install
  pnpm exec tsx scripts/drive-mcp.ts disable sunset-widget
  pnpm exec tsx scripts/drive-mcp.ts reset

Open the browser before running these commands. The app updates without refreshing. Script imports the token from data/.mcp-token.

### ChatGPT setup: no OAuth, no token

ChatGPT web > Plugins > Add custom MCP server.

- Description: Orbit Social — customize a running social chat app through MCP.
- Server URL: https://tests-macbook-air.tail70b8a.ts.net/orbit-mcp
- Authentication: no authentication, with no advanced OAuth settings.
- Acknowledge the connector warning and select Create as a plugin.

Fallback public URL: https://tests-macbook-air.tail70b8a.ts.net:10000/mcp

Both public endpoints have been tested over HTTPS without a token.

Try: "Call get_app_info, then customize_interface to create a fresh blue theme, welcome banner, and sidebar widget."

No-auth tools:
- get_app_info
- list_demo_themes
- set_demo_theme
- customize_interface

If ChatGPT shows "A service needed to create the app is temporarily unavailable", that is a ChatGPT service or permissions problem. Verify that the endpoint works by running pnpm exec tsx scripts/test-chatgpt-noauth.ts and retry the ChatGPT creation flow when available.

### Advanced JS plugin editing (bearer token)

Administrative endpoint: https://tests-macbook-air.tail70b8a.ts.net:10000/mcp-admin

Send Authorization: Bearer YOUR_TOKEN where YOUR_TOKEN is stored in data/.mcp-token (git-ignored). This endpoint supports arbitrary plugin-source editing and must not be publicly unauthenticated.

### Tailscale Funnel routes

The Mac serves the app on port 10000 and adds a path-only 443 alias without disturbing the pre-existing root app:

  tailscale funnel --bg --https=10000 8787
  tailscale funnel --bg --https=443 --set-path=/orbit-mcp http://127.0.0.1:8787/mcp
  tailscale funnel status

Remove only the alias using:
  tailscale funnel --https=443 --set-path=/orbit-mcp off

Remove only the dedicated app using:
  tailscale funnel --https=10000 off

Avoid tailscale funnel reset because it removes unrelated routes.

### Admin MCP tools
- app_overview
- list_plugins
- get_plugin_source
- set_plugin_enabled
- install_plugin
- update_plugin_source
- remove_plugin
- post_message
- reset_demo

## Plugin contract

A plugin is plain JavaScript with export default object. It can export theme, banner, widget, composerPlaceholder, compactMessages, hideReactions, messageDecorator(message), or mount(node, context). See demo-plugins/sunset.js.

The AI calls install_plugin with its JS source or update_plugin_source for an existing plugin. The backend checks syntax using esbuild and persists source. SSE notifies every viewer; the browser imports /plugins/PLUGIN_ID.js?v=VERSION. Module functions can change message rendering at runtime.

## Commands

From repository root:

  pnpm build:mcp
  pnpm --filter @cafe/live-mcp typecheck
  pnpm test:mcp

The demo lives alongside the preserved upstream CAFE code. No Cloudflare credentials are needed for this local/Tailscale version.
