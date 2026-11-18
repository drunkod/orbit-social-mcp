# Research: MCP-generated UI and live interface customization

**Research date:** 18 November 2026.
**Project:** [drunkod/orbit-social-mcp](https://github.com/drunkod/orbit-social-mcp), a fork of [Effect-TS/CAFE](https://github.com/Effect-TS/cafe).
**Goal:** Compare existing open-source methods for changing a website and/or actual broadcast overlay live, driven by MCP, an AI agent or a production controller. Links below point to source repositories or official primary documentation. Comparisons and complexity ratings are independent technical assessments, not claims made by maintainers.

## 1. Executive findings

There are four separate choices: **control protocol** (MCP, OBS WebSocket, HTTP), **representation** (parameters, component JSON, JS modules, entire HTML), **update channel** (SSE, WebSocket, CRDT, polling), and **display surface** (an external web app, a widget *inside* ChatGPT, or a broadcast graphic *on air*). Tailscale Funnel provides HTTPS reachability, not rendering or state synchronization.

| Desired outcome | Strong first candidates | Why |
| --- | --- | --- |
| Change CAFE colors, heading and simple widgets instantly | Existing CAFE MCP plugin system | Already tested; no changes to the original chat layout |
| Generate new cards/forms/layouts *in CAFE* | [json-render](https://github.com/vercel-labs/json-render) or [A2UI](https://github.com/a2ui-project/a2ui) | Typed declarative component trees; do not require executing AI-written browser JS |
| Larger isolated runtime feature extensions | [Piral](https://github.com/smapiot/piral), [Module Federation](https://github.com/module-federation/core) | Dynamic modules and defined extension points |
| An interactive widget *inside ChatGPT* | [MCP Apps](https://github.com/modelcontextprotocol/ext-apps), [OpenAI examples](https://github.com/openai/openai-apps-sdk-examples) | UI resources attached to tools; rendering is host-dependent |
| Live lower-thirds, scores, alerts and broadcast scene graphics | [NodeCG](https://github.com/nodecg/nodecg), [NoaCG Studio](https://github.com/NoaCG/NoaCG-Studio), [OBS MCP](https://github.com/aaronckj/obs-studio-mcp) | Broadcast graphics, playout, existing OBS/streaming integrations |
| Multiple people/agents editing shared layouts | [Yjs](https://github.com/yjs/yjs), [Automerge](https://github.com/automerge/automerge), [Liveblocks](https://github.com/liveblocks/liveblocks) | Conflict-aware collaborative state instead of serial overwrites |

## 2. Exact CAFE mechanism (inspected in repository)

~~~text
User prompts ChatGPT to change CAFE
  -> public MCP tools/call over HTTPS
  -> Tailscale Funnel :443 /orbit-mcp
  -> local Effect/Node HTTP server /mcp
  -> server/mcp.ts validates tool parameters
  -> creates or updates declarative JS plugin: export default { theme, banner, widget }
  -> store.ts persists source, enabled state and version; increments revision
  -> /api/events sends SSE change notification
  -> CAFE plugin host retrieves /api/state
  -> import /plugins/PLUGIN_ID.js?v=VERSION
  -> apply CSS, heading, widget and optional message decorations to Foldkit DOM
  -> no page reload, code deployment or replacement chat UI
~~~

**Public route:** /mcp exposes get_app_info, list_demo_themes, set_demo_theme and customize_interface. The last tool takes fields such as accent, title, description, emoji and widget text. It generates a constrained JS module itself; the caller does *not* supply arbitrary JavaScript source.

**Admin route:** /mcp-admin requires a bearer token and permits installing/replacing/removing JavaScript module source. It is a separate, more powerful mechanism.

**Source:** [MCP tools](../packages/live-mcp/server/mcp.ts), [HTTP routing](../packages/live-mcp/server/index.ts), [state persistence](../packages/live-mcp/server/store.ts), [frontend plugin host](../packages/frontend/src/mcp-plugins.ts), [CAFE integration guide](CAFE_MCP_INTEGRATION.md).

**What this is not:** ChatGPT does not construct a new webpage in its own chat message. It *controls an existing external CAFE webpage* by calling MCP tools. To render an interactive UI *inside* ChatGPT, use an MCP Apps-compatible UI resource instead.

**Current trade-off:** easy MVP, but the plugin host relies on Foldkit markup and MutationObserver selectors; it has no stage preview, operator approval, explicit extension-slot API, simultaneous-editor conflict resolution or broadcast-safe cue system. In the local preview the CAFE room adapter supports text chat but not Cloudflare Workers AI replies.

## 3. Methods A — agent-generated / MCP-oriented UI

| # | Project (verified source) | How UI changes at runtime | Advantages | Limitations / fit for CAFE |
| --- | --- | --- | --- | --- |
| 1 | [Existing CAFE MCP fork](https://github.com/drunkod/orbit-social-mcp) | MCP tool creates JSON-like visual ESM, SSE notifies clients | Smallest integration; tested on real Funnel | Limited vocabulary; DOM coupling. **Best today** |
| 2 | [MCP Apps ext-apps](https://github.com/modelcontextprotocol/ext-apps) | MCP tool advertises ui:// HTML resource; host loads iframe, tool and view communicate | Official interactive MCP UI extension | Primarily a UI *inside a supporting MCP host*, not automatic CAFE DOM change |
| 3 | [MCP-UI](https://github.com/MCP-UI-Org/mcp-ui) | MCP-delivered embedded UI components and renderer | Examples and client/server SDKs | UI protocol variants and host support need checking |
| 4 | [OpenAI Apps SDK examples](https://github.com/openai/openai-apps-sdk-examples) | MCP tools return resources powering ChatGPT widgets | Runnable Node and Python sample widgets; strong ChatGPT learning source | Teaches companion widgets, not CAFE source modification |
| 5 | [Google A2UI](https://github.com/a2ui-project/a2ui) | AI emits structured, streamable component definitions mapped to a host catalog | No arbitrary agent-generated JS; web/mobile-oriented | Requires catalog and renderer integration; limited to supported component types |
| 6 | [A2UI-over-MCP Recipe Studio](https://github.com/a2ui-project/a2ui/tree/main/samples/community/mcp/a2ui-over-mcp-recipe) | MCP resource/tool returns application/a2ui+json for native rendering | Concrete example bridging MCP and A2UI | Demonstrator; adapter needed for Foldkit |
| 7 | [Vercel json-render](https://github.com/vercel-labs/json-render) | AI builds a typed JSON component tree; renderer consumes streaming updates | Multi-framework renderers, component catalog, MCP adapters | Still need to register safe components and actions; **strong fit for CAFE widget catalog** |
| 8 | [CopilotKit generative-ui](https://github.com/CopilotKit/generative-ui) | Controlled component selection, A2UI, and open-ended MCP UI examples | Educational comparison of all three levels of generative UI | Runtime stack heavier than needed for simple CAFE styling |
| 9 | [CopilotKit](https://github.com/CopilotKit/CopilotKit) | AG-UI agent-to-frontend events, component rendering and shared context | Strong for agent-rich reactive apps | Existing Foldkit application would need integration glue or a parallel React layer |
| 10 | [Tambo](https://github.com/tambo-ai/tambo) | AI selects predefined React components and streams props | Component-based, reusable and predictable | React-specific; not drop-in for original Foldkit |
| 11 | [Vercel AI SDK](https://github.com/vercel/ai) | Streams agent/tool outputs into mapped interface components | Rich TypeScript/React examples | Not an arbitrary plugin installer; renderer still yours |
| 12 | [react-jsonschema-form](https://github.com/rjsf-team/react-jsonschema-form) | Dynamic forms from JSON Schema | Excellent for settings/approval forms with validation | Forms rather than entire dynamic chat layouts |
| 13 | [wandb/openui](https://github.com/wandb/openui) | Prompt-to-HTML interface prototype | Good research reference for text-to-UI | More suited to experimentation than dependable broadcast playout |

**Primary sources for A2UI and MCP Apps:** [Google: A2UI + MCP Apps](https://developers.googleblog.com/en/a2ui-and-mcp-apps/), [MCP Apps overview](https://modelcontextprotocol.io/docs/extensions/apps/overview), [CopilotKit pattern guide](https://github.com/CopilotKit/generative-ui), [json-render documentation](https://github.com/vercel-labs/json-render).

## 4. Methods B — runtime code, microfrontends and direct editors

These approaches actually deliver or edit executable browser code. They are more flexible than a declarative UI component catalog, but also harder to roll back and isolate.

| # | Project / technique | Delivery and live-change mechanism | Advantages | Disadvantages / suitability |
| --- | --- | --- | --- | --- |
| 14 | [Native JavaScript ESM import()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import) | Versioned modules are fetched and instantiated at runtime | Smallest possible loader; already used in CAFE | Must define plugin contract, lifecycle, rollback and version cache yourself. **Best if keeping current system** |
| 15 | [SystemJS](https://github.com/systemjs/systemjs) | Dynamic module loader with configurable import maps | Independent module resolution, legacy-compatibility patterns | Runtime and map configuration complexity; arbitrary code is still executable |
| 16 | [Module Federation](https://github.com/module-federation/core) | Remote compiled component bundles registered and fetched at runtime | Independent deployment of real functionality; shared dependencies | Build compatibility, version conflicts, remote-entry reliability. Medium/high integration effort |
| 17 | [single-spa](https://github.com/single-spa/single-spa) | Mount/unmount independently deployed frontend applications | Framework independence, explicit lifecycle | A lot of architecture for one simple chat widget; better for large frontends |
| 18 | [Piral](https://github.com/smapiot/piral) | Publish dynamic runtime extension packages called pilets | Explicit slots, dynamic rollout/disable, full feature extensions | Requires adopting Piral shell/extension model. **Best reference for a mature plugin API** |
| 19 | [import-map-overrides](https://github.com/single-spa/import-map-overrides) | Override a JS module URL for a client at runtime | Excellent for development/testing and previewing a replacement component | Not by itself a production rollout system or synchronized broadcast update |
| 20 | [Vite HMR](https://github.com/vitejs/vite) | Dev server pushes changed module updates to browser | Very fast during local development and prototyping | Primarily a **development** facility; not a live-viewer distribution or release protocol |
| 21 | [Sandpack](https://github.com/codesandbox/sandpack) | Live code editor and preview sandbox in the browser | Fast demonstrations of AI-written React/JS code | Not a drop-in production on-air plugin engine; embedding complexity |
| 22 | [react-live](https://github.com/FormidableLabs/react-live) | Edit React source and see live rendered result | Easy exploratory JSX/component editing | React-only, code evaluation, not suitable for trusted on-air output without staging |
| 23 | [Puck](https://github.com/puckeditor/puck) | React visual editor stores component/layout definitions | Nonprogrammer editing, deterministic registered components | Needs renderer integration; current CAFE is Foldkit, not React |
| 24 | [Craft.js](https://github.com/prevwong/craft.js) | Extensible drag/drop React page editor | Reusable component resolver and node graph | Editor authoring work, no built-in MCP or broadcast delivery |
| 25 | [GrapesJS](https://github.com/GrapesJS/grapesjs) | Drag/drop and live editing of HTML/CSS page templates | Strong visual template composition; framework-agnostic HTML output | Can create uncontrolled markup; need publishing and renderer connection |

**Takeaway:** When the agent needs to create *new executable behavior*, use a separately versioned plugin contract, ideally with explicit extension slots as in Piral. For ordinary visual changes, generating source code is unnecessary complexity; a JSON component registry is easier to validate.

## 5. Methods C — distributing changes to all viewers

These projects are mostly **state synchronization** or remote configuration. They can be added behind any UI-rendering approach. None is inherently a generative UI renderer or an MCP server.

| # | Project / method | Change propagation | Advantages | Disadvantages / when to use |
| --- | --- | --- | --- | --- |
| 26 | [Browser Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) | Server pushes ordered one-way events over HTTP; browser refetches latest revision | Minimal client code; reconnects naturally; already working in CAFE | No bidirectional RPC channel; consider capacity and connection behavior for many clients |
| 27 | [Socket.IO](https://github.com/socketio/socket.io) | Bidirectional realtime events using WebSocket/transport fallback | Rooms, acknowledgments, operator commands, viewer synchronization | More connection/session machinery than SSE |
| 28 | [PartyKit](https://github.com/partykit/partykit) | Realtime room-based WebSocket server at the edge | Convenient broadcast room service; shared realtime patterns | Service/runtime adoption; existing Tailscale Node server may already suffice |
| 29 | [Yjs](https://github.com/yjs/yjs) | CRDT synchronized document for distributed edits | Concurrent multi-operator edits merge and recover | Conflict resolution semantics and shared-doc plumbing; overkill for a single operator |
| 30 | [Automerge](https://github.com/automerge/automerge) | Local-first CRDT and synchronizable history | Offline-first collaboration and change merge | More architecture than single source-of-truth plugin registry |
| 31 | [Liveblocks](https://github.com/liveblocks/liveblocks) | Hosted realtime presence, broadcast and persistent storage SDK | Rapid collaboration UI and shared editor state | Hosted service dependency, integration and operational costs |
| 32 | [Flagsmith](https://github.com/Flagsmith/flagsmith) | Remote configuration and per-audience feature flags | Fast show/hide component and styling toggles; established management UX | Designed for configuration, not dynamic component synthesis |
| 33 | [GrowthBook](https://github.com/growthbook/growthbook) | Feature flags, typed remote configs and experiments | Controlled releases, A/B experiments, cohort targeting | A change distribution/control tool, not a generative UI runtime |

**Best current choice:** Keep **SSE + versioned state** for the one-operator CAFE demonstration. Upgrade to Socket.IO for interactive acknowledgments and synchronized cue commands. Use Yjs/Automerge if multiple people (or agents) will edit the same visual layout concurrently. Use a feature-flag system to gate whether a prebuilt feature is on-air, not to author new feature code.

**Broadcast-specific timing note:** Network change notification time is not video-frame synchronization. For professional playout, the overlay renderer or production controller should own the moment the prepared graphic goes live (cue/take/out), regardless of whether the command originates in MCP.

## 6. Methods D — actual livestream and broadcast graphics

These are not interchangeable with app-side generative UI frameworks: they render or control graphics in OBS, vMix, CasparCG or broadcast production workflows. **If the phrase “live broadcast” means video that viewers watch on Twitch/YouTube/TV, investigate these before rebuilding anything.**

| # | Open-source product / official docs | What it already provides | Advantages | Limitations; MCP integration idea |
| --- | --- | --- | --- | --- |
| 34 | [NodeCG](https://github.com/nodecg/nodecg) | Browser graphics, operator dashboard, server-side extensions and real-time replicated state | **Strongest general-purpose Node/JS broadcast reference**; works in OBS Browser Source; Replicants synchronize graphics | Needs a graphic bundle; MCP adapter calls into dashboard/extension state |
| 35 | [NodeCG simple examples](https://github.com/nodecg/nodecg-simple-examples) | Minimal example graphics and dashboard bundles | Fast way to understand the architecture without a full broadcast | Examples, not a ready-made MCP integration |
| 36 | [OBS browser source](https://github.com/obsproject/obs-browser) | Draws HTML/CSS/JS webpages as broadcast sources using CEF | Reuse any existing web overlay; can react to browser-side events | Browser source is a renderer, not a design/agent backend; performance and sizing must be tested |
| 37 | [OBS WebSocket](https://github.com/obsproject/obs-websocket) | Remote scene/source/input control, bundled with modern OBS | Direct scene switching and overlay visibility control | Does not generate new HTML layouts; separate web graphic renderer needed |
| 38 | [OBS Studio MCP server](https://github.com/aaronckj/obs-studio-mcp) | MCP tools for OBS scene, text source, visibility, audio and streaming actions | **Already implements MCP → OBS**; supports dry-run for mutating calls | Young/small project; focuses on OBS operations rather than arbitrary UI layout |
| 39 | [StreamElements custom widgets](https://docs.streamelements.com/overlays/custom-widget) | Online HTML/CSS/JS widget editor and overlay events | Fastest hosted custom overlay for many streamers | Proprietary hosted service; external MCP bridge/URL coordination required |
| 40 | [CasparCG Server](https://github.com/CasparCG/server) | Professional real-time graphics playout; HTML templates | Mature playout concepts and multiple outputs | More demanding operator/graphics setup; MCP tool must generate or update templates/data |
| 41 | [SPX Graphics / BTV-MCR/live](https://github.com/BTV-MCR/live) | Browser operator dashboard, editable HTML graphics and rundowns for CasparCG/OBS/vMix | Ready-made preview/program style graphic controller; external HTTP API | Adds a separate playout product and template system |
| 42 | [NoaCG Studio](https://github.com/NoaCG/NoaCG-Studio) | Create/edit/preview/export HTML broadcast graphics, run playout, CLI/MCP workflow | **Very close to desired AI-generated on-air graphics**; support for OBS, CasparCG, vMix exports | AGPL and operating model to evaluate; hosted features may require accounts |
| 43 | [Bitfocus Companion](https://github.com/bitfocus/companion) | Production switcher/control surface, Stream Deck buttons and supported integrations | Reliable human-triggered cues alongside automation | Control layer rather than HTML UI-generation layer |
| 44 | [Streamer.bot](https://docs.streamer.bot/) | WebSocket/HTTP API, stream events, C# actions and OBS integration | Event-triggered overlays and user interactions without writing a production engine | The application itself is not an open-source general-purpose plugin framework; external bridge needed |
| 45 | [Social Stream Ninja](https://github.com/steveseguin/social_stream) | Unified social chat streams, custom overlays, WebRTC/WebSocket and iframe bridge | Useful if “live broadcast” includes displaying live social comments | Channel adapters, browser policies and operational dependencies |
| 46 | [SVT Bridge](https://github.com/svt/bridge) | Extensible live graphics control, sends JSON to HTML templates for CasparCG | Real production-oriented graphics/data separation | CasparCG-specific workflow and deployment complexity |
| 47 | [NoaCG MCP plugin docs](https://github.com/NoaCG/NoaCG-Studio/blob/main/cli/plugin-mcp/README.md) | MCP integration for constructing and validating packaged broadcast graphics | Closest reference for AI-to-broadcast-graphics tool schema | MCP can prepare assets; playout requires separate operator/renderer configuration |
| 48 | [NoaCG Studio playout guide](https://noacg.studio/docs) | Browser-managed rundown, preview/program graphics and delivery to OBS/CasparCG | An already designed production UI, avoids reinventing on-air lifecycle | More system surface than a simple CAFE chat plugin |

**Sources:** [NodeCG state Replicants](https://www.nodecg.dev/docs/classes/replicant/), [OBS Browser Source](https://obsproject.com/kb/browser-source), [OBS Remote Control](https://obsproject.com/kb/remote-control-guide), [CasparCG HTML templates](https://github.com/CasparCG/casparcg.com/blob/main/docs/wiki/media/html-templates.md), [SPX graphic controller](https://github.com/BTV-MCR/live), [NoaCG docs](https://noacg.studio/docs).

**Two particularly close implemented systems:**

- **NodeCG** is built around a dashboard/controller, server, persistent/replicated state and on-air HTML graphics. That is conceptually the same separation as MCP tools → server state → CAFE browser, but purpose-built for broadcast.
- **NoaCG Studio** already includes a graphics editor and MCP-enabled CLI workflow. It explicitly supports creating lower thirds, scoreboards and graphics packages, validating them, and using them through production outputs. Its source is AGPL-3.0, which must be considered if incorporating code into a differently licensed product.

## 7. Practical decision table — not all methods solve the same problem

Legend: MVP effort is an **estimated relative integration size** for your existing Effect/CAFE prototype (S small, M medium, L large). UI freedom means how far the technique can move beyond existing components. Broadcast fit evaluates actual on-air overlay needs, not website-only screen sharing.

| Technique | Relative effort | UI freedom | Running website | Actual OBS/on-air graphics | Trade-off |
| --- | --- | --- | --- | --- | --- |
| Current constrained CAFE MCP + SSE | **S** | Low / medium | **Excellent** | Needs OBS browser source and cue layer | Fastest proof, limited UI types |
| JSON schema + native Foldkit components | **S–M** | Medium | **Excellent** | Good with browser source | Need to build a component registry |
| json-render + component catalog | M | Medium / high | Excellent if renderer integrated | Good with overlay renderer | Extra renderer/framework integration |
| Google A2UI + MCP | M | Medium / high | Good with A2UI renderer | Good with custom playout adapter | Moving protocol and renderer options |
| MCP Apps | M | High for an app's own iframe | **Excellent inside ChatGPT**, not external CAFE by itself | Weak directly | Different display surface |
| ESM hot-loaded JS plugins | S–M | **Very high** | Excellent | Good only after testing/staging | Trusted code and lifecycle complexity |
| Piral or Module Federation | L | Very high | Excellent | Moderate | Independent module build/distribution |
| Vite HMR / Sandpack | S for development | High | Good for operator preview | Poor as production on-air architecture | Intended for rapid iteration, not safe playout |
| SSE / Socket.IO alone | S–M | **None** (transport only) | Excellent | Excellent transport for graphics | Still must build renderer and UI format |
| Yjs / Automerge | M–L | **None** (collaborative state only) | Excellent multi-editor | Good for operator collaboration | Harder conflict/order semantics |
| Feature flags / remote config | S–M | Low | Excellent | Good for cueing prebuilt assets | Does not invent components |
| NodeCG + MCP adapter | M | **High in HTML graphics** | Not a replacement for CAFE | **Excellent** | Additional broadcast stack |
| NoaCG Studio with its MCP tools | S–M to trial; L to deeply embed | High in broadcast graphics | Separate production UI | **Excellent** | Workflow/platform/license evaluation |
| OBS Studio MCP + Browser Source | **S–M** | Medium/high via separate HTML overlay | Separate from CAFE | **Excellent** | Split scene control from graphic authoring |
| SPX / CasparCG HTML templates | M–L | High | Separate from CAFE | **Excellent** | Production playout complexity |

**Inference:** For your specific research, the most useful direct head-to-head experimental comparison is **(A) current CAFE MCP ESM + SSE**, **(B) typed JSON/A2UI-driven CAFE components**, and **(C) MCP → NodeCG / OBS HTML graphics**. These cover existing-app decoration, generated component structure, and actual broadcast graphics, rather than comparing many libraries that operate at different layers.

## 8. Recommended implementation sketches

### Option A: Smallest change to the existing CAFE prototype

Retain **Effect + existing MCP server + Tailscale + SSE + existing CAFE Foldkit application**. Add an explicit declarative patch schema and **named extension slots** instead of relying on arbitrary DOM mutation:

~~~json
{
  "version": 1,
  "revision": 42,
  "target": "cafe",
  "changes": [
    { "slot": "chat.header", "type": "Heading", "props": { "text": "Community night" } },
    { "slot": "chat.status", "type": "Badge", "props": { "text": "Live", "tone": "success" } },
    { "slot": "chat.sidebar", "type": "MetricCard", "props": { "title": "Viewers", "value": "1,240" } }
  ]
}
~~~

The server validates this as data, stores a revision, broadcasts via SSE, and the Foldkit view renders only known slot/component combinations. The same transport used by the current public MCP tool still works. This is a **proposed design**, not a feature currently implemented in CAFE. It gives most of the visible Generative UI effect without downloading new executable code for simple layout changes.

### Option B: Broader generative UI using established component schemas

Keep the MCP endpoint, but have a tool return JSON for **A2UI** or **json-render**. The frontend owns a mapping from component names to actual renderers. First implement common chat elements (header, notice, metric, button, tabs, lower-third, simple list). If using a native Foldkit renderer, translation logic is required; json-render's ready-made integrations target their published frameworks. The server can stream partial specs while the client previews them.

MCP Apps can present a *different* view in ChatGPT at the same time: for instance, an operator panel to select or edit CAFE layouts. That widget is a **control surface**, not automatically the broadcast output itself.

### Option C: Broadcast-oriented playout using NodeCG or OBS

~~~text
Operator / ChatGPT
    |
    v
Existing MCP server over Tailscale HTTPS
    |
    v
validate and stage lower-third / scoreboard JSON
    |
    +--> Preview renderer (not visible on stream)
    |
    +--> Operator "Take" (or explicitly approved MCP cue)
              |
              v
         NodeCG Replicant / playout state
              |
              v
        OBS Browser Source / CasparCG
              |
              v
         Broadcast output
~~~

Use a **preview → take → update → out** lifecycle. MCP generates data and/or selects existing templates; the renderer owns HTML/CSS and animation. OBS WebSocket or a dedicated controller changes scene visibility, while NodeCG/NoaCG/SPX manages graphic data. This avoids needing to execute newly generated JS during a live program.

## 9. Minimal experiments to prove which architecture is better

| Experiment | Keep fixed | Change | Proof of success |
| --- | --- | --- | --- |
| **A: Current ESM + SSE** | Original CAFE, Funnel, four public MCP tools | New declarative plugin content | Two open browser tabs update on one MCP call; no reload; restore original |
| **B: Declarative component tree** | Same endpoints and chat | Replace DOM mutation of the test widget with a typed component slot renderer | MCP can create one new card and remove it without shipping JS source |
| **C: Broadcast browser source** | Same MCP server and generated content | Open a dedicated transparent 1920×1080 overlay URL in OBS | Changes appear in OBS browser source without re-adding the source |
| **D: NodeCG / NoaCG** | Same MCP intent/tool inputs | Route a lower-third to a playout graphics server | Preview can update without affecting Program; Take/Out triggers visible change |
| **E: Multi-operator** | Same scene and MCP data format | Add concurrent Yjs/Automerge editor state | Two operators can change independent fields without lost updates |
| **F: Host-embedded MCP UI** | Same existing MCP server | Add a ui:// MCP Apps resource for an operator control panel | Interactive widget renders in a compatible AI host; a tool call updates the external preview |

Suggested tests: screenshot baseline and modified state; inspect browser-console errors; record round-trip from accepted MCP call to browser-render revision; verify that reconnection/reload applies latest state; verify disabling the plugin restores baseline; measure whether repeated updates cause memory growth or animation stutter; verify that unpublished changes never appear on Program.

Do not assume that a fast WebSocket or SSE message implies a broadcast frame-exact transition; frame timing must be checked at the rendering/production layer.

## 10. Selection recommendations and limitations

| Research priority | Preferred choice | Reason |
| --- | --- | --- |
| **Minimal work on the existing CAFE fork** | **Existing MCP tools + typed declarative patches + SSE** | Reuses the already tested connection; original UI remains untouched |
| **Novel UI structures created by AI** | **json-render** as a prototype, **A2UI** if cross-platform protocol is a priority | Controlled component catalog and streamed specs, rather than browser code generation |
| **ChatGPT conversation embeds an interactive UI** | **MCP Apps** and OpenAI examples | This is the correct standardized direction for embedded host UI |
| **Advanced arbitrary runtime plugins** | **Piral** concepts or existing ESM loader + formal extension slots | More independence, but JS lifecycle and trust are more demanding |
| **One-to-many on-air graphic updates** | **NodeCG + OBS Browser Source** | Directly designed for broadcast graphics, operator dashboards and state replication |
| **AI generated broadcast graphics with least custom editor work** | **NoaCG Studio** (evaluate licensing and deployment) | Existing editor, templating, MCP workflow, playout routes |
| **Control existing OBS elements from an LLM immediately** | **obs-studio-mcp + OBS WebSocket** | An implemented MCP-to-OBS control integration |
| **Concurrent operator editing** | **Yjs** or **Liveblocks** | Shared state and collaboration; still requires a display renderer |

**Important distinction:** Not every linked project is itself an MCP server, and not every project is a complete broadcasting application. They are arranged by the system layer they solve. MCP is the **agent control interface**; generative UI frameworks describe/render components; realtime libraries synchronize state; broadcast engines render the final program feed.

**External-source scope:** The linked repositories and vendor docs establish that these features and examples exist. This report does *not* claim that all 48 projects were installed or benchmarked on the Mac. Only the CAFE fork's existing browser test, plugin hot reload, and MCP/Tailscale connectivity were previously run locally. Suitability, complexity and integration effort are engineering assessments.

## 11. High-value firsthand reading

| Question | Most direct guide |
| --- | --- |
| How does a tool return an actual interactive iframe in ChatGPT? | [MCP Apps official overview](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/extensions/apps/overview.mdx) and [OpenAI example servers](https://github.com/openai/openai-apps-sdk-examples) |
| How does MCP carry generated JSON UI? | [Google's A2UI-over-MCP walkthrough](https://developers.googleblog.com/en/a2ui-and-mcp-apps/) and [A2UI source](https://github.com/a2ui-project/a2ui) |
| How do I render only approved components? | [json-render registry/renderer](https://github.com/vercel-labs/json-render) and [CopilotKit patterns](https://github.com/CopilotKit/generative-ui) |
| How do runtime modules and extensions work? | [Piral pilets](https://github.com/smapiot/piral), [Module Federation](https://github.com/module-federation/core), [SystemJS](https://github.com/systemjs/systemjs) |
| How does a live operator dashboard update broadcast graphics? | [NodeCG](https://github.com/nodecg/nodecg), [Replicants](https://www.nodecg.dev/docs/classes/replicant/), [simple examples](https://github.com/nodecg/nodecg-simple-examples) |
| How can an agent talk directly to OBS? | [OBS MCP repository](https://github.com/aaronckj/obs-studio-mcp), [OBS WebSocket](https://github.com/obsproject/obs-websocket) |
| How can AI construct graphic packages for a real show? | [NoaCG Studio](https://github.com/NoaCG/NoaCG-Studio), [NoaCG MCP plugin](https://github.com/NoaCG/NoaCG-Studio/blob/main/cli/plugin-mcp/README.md), [NoaCG docs](https://noacg.studio/docs) |
| How can I run custom HTML overlays in OBS without rewriting the app? | [OBS Browser Source](https://obsproject.com/kb/browser-source), [StreamElements widget guide](https://docs.streamelements.com/overlays/custom-widget), [SPX Graphics](https://github.com/BTV-MCR/live) |
