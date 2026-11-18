# CAFE MCP preview service

This package hosts the **original CAFE Foldkit frontend**, the previously implemented remote MCP transport, a runtime JavaScript plugin registry, and a small local room adapter for demonstrating chat without Cloudflare credentials.

- **Read the complete integration guide:** [docs/CAFE_MCP_INTEGRATION.md](../../docs/CAFE_MCP_INTEGRATION.md).
- **Tailscale setup and no-auth ChatGPT connector:** [docs/CHATGPT_MCP_NOAUTH_TAILSCALE.md](../../docs/CHATGPT_MCP_NOAUTH_TAILSCALE.md).
- **Original CAFE UI:** [packages/frontend/src/main.ts](../frontend/src/main.ts).
- **Optional MCP plugin host:** [packages/frontend/src/mcp-plugins.ts](../frontend/src/mcp-plugins.ts).

Run from the repository root:

~~~bash
pnpm install --filter @cafe/frontend... --filter @cafe/live-mcp...
pnpm dev:mcp
~~~

Website: http://127.0.0.1:8787/

Public ChatGPT MCP URL: https://tests-macbook-air.tail70b8a.ts.net/orbit-mcp

The public route exposes limited visual customization tools, and the administrator route is token protected. **The default chat interface does not display any MCP link or plugin-management dashboard.**

The upstream CAFE production Cloudflare Worker remains unchanged. The local preview can join rooms and exchange shared messages, but does not generate AI replies. Existing synthetic Orbit demo files remain in this package as historical reference and are not the UI served at the current website.

Tests:

~~~bash
pnpm --filter @cafe/frontend test
pnpm --filter @cafe/live-mcp test
cd packages/live-mcp
pnpm exec tsx scripts/smoke-noauth.ts
pnpm exec tsx scripts/test-cafe-plugins.ts
~~~
