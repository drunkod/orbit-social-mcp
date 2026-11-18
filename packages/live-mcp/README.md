# Orbit Social — live MCP-customizable chat app

A working Effect-powered extension of the [CAFE chat application](https://github.com/Effect-TS/cafe). It demonstrates connecting an AI/MCP client through a Tailscale Funnel HTTPS address and **changing a running social app by installing or editing JavaScript plugins**. Existing viewers see the change automatically over Server-Sent Events.

## What is real

- Polished React social/chat UI with shared persisted chat messages
- Effect v4 state transitions and persistence
- Real MCP **Streamable HTTP** tools at /mcp (official TypeScript MCP SDK)
- Plugin JavaScript source installation, replacement, activation, deactivation and removal
- Browser ESM plugin loading without app rebuild or page refresh
- CSS theme, announcement, sidebar widget and executable message decoration hooks
- Live SSE updates and MCP activity timeline
- Tailscale Funnel on a dedicated HTTPS port

## Architecture

This repository retains the upstream CAFE source and adds packages/live-mcp. The upstream implementation is Cloudflare + Alchemy + Foldkit + Effect; Orbit uses Effect v4 and CAFE's chat/event architecture locally to avoid requiring Cloudflare credentials for a visual MVP.

MCP client -> Tailscale Funnel -> Node HTTP + MCP SDK -> Effect DemoStore -> state JSON -> SSE -> React app -> JS plugins (dynamic import)

The app is a demo. Remote browser plugins are trusted code, not a hardened sandbox. An automatically generated bearer token is required for MCP access. Do not put that token in a URL or make this project a multi-user service without proper auth and isolation.

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

### Connect an external MCP client

Use endpoint:

  https://YOUR-TAILSCALE-NODE.YOUR-TAILNET.ts.net:10000/mcp

With the HTTP header:

  Authorization: Bearer YOUR_TOKEN

For example an MCP client configuration using URL and headers:

  {
    "mcpServers": {
      "orbit": {
        "url": "https://YOUR-TAILSCALE-NODE.YOUR-TAILNET.ts.net:10000/mcp",
        "headers": {
          "Authorization": "Bearer YOUR_TOKEN"
        }
      }
    }
  }

Actual MCP client support for headers varies.

### Tailscale Funnel

Keep existing Tailscale routes untouched. Use dedicated HTTPS port 10000:

  tailscale funnel --bg --https=10000 8787
  tailscale funnel status

Only enable Funnel after the MCP bearer token is present. To stop this one forwarding rule use Tailscale's per-port configuration, not "tailscale funnel reset" (which can remove unrelated routes).

## MCP tools

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
