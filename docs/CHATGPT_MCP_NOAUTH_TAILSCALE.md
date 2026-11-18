# ChatGPT MCP without OAuth — Tailscale Funnel runbook

> **Historical Orbit-demo notes.** The Tailscale Funnel and no-auth MCP endpoints described here still work, but the live website now serves the **original CAFE chat UI**. See [CAFE MCP integration](CAFE_MCP_INTEGRATION.md) for the current application and screenshots.


**Verified:** 18 November 2026, on the authorized development Mac running Tailscale 1.102.3.
**Foundation:** [Effect-TS/cafe](https://github.com/Effect-TS/cafe).
**Implementation:** [packages/live-mcp](../packages/live-mcp).
**Goal:** connect ChatGPT to a running social/chat application via MCP, then change the interface instantly through built-in visual plugins **without OAuth or a bearer token**.

> The no-auth server has only four limited visual tools, not the ability to upload arbitrary JavaScript. Anyone who knows the public address can change the shared demo appearance. The code-editing administrator endpoint requires a separate bearer token.

## 1. Actual URLs that worked

| Role | Address | Authentication |
| --- | --- | --- |
| Open Orbit Social UI | https://tests-macbook-air.tail70b8a.ts.net:10000/ | None |
| **ChatGPT MCP, recommended** | **https://tests-macbook-air.tail70b8a.ts.net/orbit-mcp** | **None, HTTPS 443** |
| ChatGPT MCP, alternate | https://tests-macbook-air.tail70b8a.ts.net:10000/mcp | None |
| Full developer MCP | https://tests-macbook-air.tail70b8a.ts.net:10000/mcp-admin | Bearer token |
| Local app | http://127.0.0.1:8787/ | Local machine |
| Local public MCP | http://127.0.0.1:8787/mcp | None |
| Local admin MCP | http://127.0.0.1:8787/mcp-admin | Bearer token |

The Tailscale hostname belongs to the development Mac's tailnet. **On another computer, substitute that computer's hostname** as shown by Tailscale. The 443 alias is particularly useful because ChatGPT may connect more reliably through the standard HTTPS port.

## 2. Start the app

Prerequisites: Node.js 22+, pnpm, Git, and an active Tailscale connection with Funnel enabled for the tailnet.

~~~bash
git clone https://github.com/drunkod/orbit-social-mcp.git
cd orbit-social-mcp
pnpm install --filter @cafe/live-mcp...
pnpm dev:mcp
~~~

The new package uses Effect v4, an HTTP server bound to **127.0.0.1:8787**, the official MCP TypeScript SDK, a React interface and a filesystem-backed demo store. It builds and starts locally without Cloudflare credentials.

In another terminal:

~~~bash
curl http://127.0.0.1:8787/health
~~~

Expected JSON includes an <code>ok: true</code> health flag and a revision number. The server generates a local <code>packages/live-mcp/data/.mcp-token</code> for **administrator access only**. The token and mutable <code>data/state.json</code> are git-ignored.

## 3. Publish the server through Tailscale Funnel

Check that the device is online:

~~~bash
tailscale status
tailscale version
~~~

### Expose the website and MCP path on port 10000

~~~bash
tailscale funnel --bg --https=10000 8787
tailscale funnel status
~~~

This maps the HTTPS public origin on port 10000 to the local app at 127.0.0.1:8787. The website appears at its root, and the MCP endpoint appears at its <code>/mcp</code> path.

### Add the ChatGPT-friendly URL on HTTPS 443

~~~bash
tailscale funnel --bg --https=443 --set-path=/orbit-mcp http://127.0.0.1:8787/mcp
tailscale funnel status
~~~

**This was the crucial route.** It creates a path-based public reverse proxy:

~~~text
https://DEVICE.TAILNET.ts.net/orbit-mcp
    -> Tailscale Funnel on HTTPS 443
    -> local http://127.0.0.1:8787/mcp
    -> Streamable HTTP MCP endpoint
~~~

At the time of the working test, the Mac already exposed a *different* app on 443 and a private tailnet service on 8443. Tailscale preserved both:

~~~text
https://tests-macbook-air.tail70b8a.ts.net:10000
|-- /          proxy http://127.0.0.1:8787

https://tests-macbook-air.tail70b8a.ts.net
|-- /          proxy http://127.0.0.1:3000
|-- /orbit-mcp proxy http://127.0.0.1:8787/mcp

https://tests-macbook-air.tail70b8a.ts.net:8443  (tailnet only)
|-- /          proxy http://127.0.0.1:8648
~~~

To remove only the demo routes later, without resetting existing services:

~~~bash
tailscale funnel --https=443 --set-path=/orbit-mcp off
tailscale funnel --https=10000 off
~~~

Avoid a global <code>tailscale funnel reset</code> on a machine hosting other services.

## 4. Why this URL works without OAuth

See [server/index.ts](../packages/live-mcp/server/index.ts) and [server/mcp.ts](../packages/live-mcp/server/mcp.ts).

- The route **/mcp** calls the MCP server in <code>public</code> mode, without checking an authorization header.
- The route **/mcp-admin** requires an <code>Authorization: Bearer TOKEN</code> header before dispatching admin MCP requests.
- The MCP implementation uses **Streamable HTTP** and registers only the four public tools listed below.
- We did **not** implement an OAuth authorization server or OAuth discovery metadata. ChatGPT connects in no-authentication mode.
- The public customization tool accepts validated fields, generates a declarative visual JavaScript module *inside the server*, and activates it. It does not accept arbitrary executable source text.

| Tool | Operation |
| --- | --- |
| <code>get_app_info</code> | Read app details, revision, enabled plugins |
| <code>list_demo_themes</code> | Read the three preset themes |
| <code>set_demo_theme</code> | Turn on a preset (default, aurora, focus) |
| <code>customize_interface</code> | Change accent hex color, banner title/description, icon and sidebar widget |

The **admin** endpoint instead provides <code>install_plugin</code>, <code>update_plugin_source</code>, <code>get_plugin_source</code>, and other advanced plugin tools. Its token comes from <code>MCP_DEMO_TOKEN</code> or the generated <code>data/.mcp-token</code> file. Never put it in the repository or append it to a public URL.

## 5. Add Orbit Social in ChatGPT

1. Open [ChatGPT Plugins](https://chatgpt.com/plugins) and select **Add custom MCP server**.
2. Enter the description: **Orbit Social — customize a live social-chat interface through MCP.**
3. Select **Server URL** and paste **https://tests-macbook-air.tail70b8a.ts.net/orbit-mcp**.
4. Under Authentication, use the option allowing **no authentication**. In the observed interface it was labeled **OAuth or no authentication**. Do not enter OAuth client IDs, secrets, callback URL values or advanced OAuth settings.
5. Read and check the warning about connecting custom servers; click **Create as a plugin**.
6. Enable the new plugin in a ChatGPT conversation and open the Orbit Social website in another tab.

Example prompt:

> Use the Orbit Social plugin. Call get_app_info, then customize_interface to give the app a blue (#2563eb) accent, the headline "ChatGPT can redesign this app live.", a short welcome description and a sidebar widget titled "Designed in ChatGPT" with the value "Live!". Describe what changed.

Once the call succeeds, the browser changes the banner, colors and sidebar widget without rebuilding or refreshing.

**The user confirmed the ChatGPT connection worked.** Separately, we tested a real no-auth MCP client against both public URLs and successfully invoked the visual customization tool.

## 6. Verify the protocol end to end

From the <code>packages/live-mcp</code> directory:

~~~bash
# Read-only public MCP connection test; does not modify the UI:
MCP_ENDPOINT=https://tests-macbook-air.tail70b8a.ts.net/orbit-mcp \
  pnpm exec tsx scripts/smoke-noauth.ts

# Full UI-changing test (modifies the shared live demo):
MCP_ENDPOINT=https://tests-macbook-air.tail70b8a.ts.net/orbit-mcp \
DEMO_STATE_URL=https://tests-macbook-air.tail70b8a.ts.net:10000/api/state \
  pnpm exec tsx scripts/test-chatgpt-noauth.ts

# Basic app and developer checks:
curl -fsS https://tests-macbook-air.tail70b8a.ts.net:10000/health
pnpm typecheck
pnpm build
pnpm test
~~~

Expected: the smoke test discovers four no-auth tools and **no** code-writing admin tools. The full UI-changing test reports <code>SUCCESS revision=...</code>.

**A plain HTTP GET returning 406 for /mcp is not an MCP failure.** Streamable HTTP negotiates specific methods and Accept headers; use the SDK-based smoke test. Conversely, <code>/mcp-admin</code> should return HTTP **401** if no token is supplied.

## 7. Why the UI changes immediately

~~~text
ChatGPT
  -> Tailscale Funnel HTTPS /orbit-mcp
  -> Effect/Node MCP server /mcp
  -> customize_interface generates the constrained visual plugin
  -> DemoStore validates and persists it; revision increases
  -> Server-Sent Events at /api/events broadcasts the revision
  -> React UI refetches /api/state
  -> Browser imports /plugins/chatgpt-visual.js?v=VERSION
  -> New theme, banner and sidebar widget render immediately
~~~

Source references: [server/mcp.ts](../packages/live-mcp/server/mcp.ts), [server/store.ts](../packages/live-mcp/server/store.ts), [server/index.ts](../packages/live-mcp/server/index.ts), [web/main.tsx](../packages/live-mcp/web/main.tsx).

## 8. Troubleshooting

| Symptom | Explanation / resolution |
| --- | --- |
| ChatGPT cannot discover OAuth settings | Ensure you used the **public** /orbit-mcp address, not /mcp-admin. Select a no-auth flow; do not fill in advanced OAuth client settings. |
| ChatGPT says its plugin creation service is unavailable | This is a separate **ChatGPT-side** service or account/workspace issue. Verify the MCP server with the smoke test; server edits cannot fix unavailable ChatGPT services. |
| Plain GET on /orbit-mcp responds 406 | Expected when GET does not contain the required MCP Accept headers; run the SDK smoke test. |
| Server responds 401 | You likely selected /mcp-admin without a bearer token. |
| The website loads but no theme change appears | Inspect /api/events, the browser console and /api/state; ensure the plugin is enabled. |
| The URL stops responding | Confirm the Node app is running, Tailscale is online and <code>tailscale funnel status</code> still shows the route. |
| OAuth controls cannot be bypassed | If the ChatGPT product/account requires OAuth for the attempted workflow, this is a product limitation. Only the server's unauthenticated tools are demonstrated here. |

## 9. Scope of the proof

This is a single running demo. Tailscale publicly exposes its HTTPS address; the no-auth route is for controlled visual customization. Browser JavaScript plugins installed through the admin interface are trusted code, not sandboxed. There is no per-user isolation, account login or OAuth, so the design must be hardened before real-world deployment.
