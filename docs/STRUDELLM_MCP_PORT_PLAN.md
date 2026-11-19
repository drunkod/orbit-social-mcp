# StrudelLM → CAFE MCP Music Studio: phased port plan

Date: 18 November 2026. Source: https://github.com/tambo-labs/strudellm at commit 99229c05. Accompanying reference: uploaded DeepWiki full-wiki capture, also indexed at 99229c05. Target: https://github.com/drunkod/orbit-social-mcp.

## Primary objective

Preserve the original CAFE Foldkit chat and working Tailscale Funnel MCP connector. Preserve the complete upstream StrudelLM application (Next.js/React, Tambo, audio engine, generative components, auth, chat, code editor, themes, persistence). Add a separate ChatGPT-controlled music workflow: natural-language prompt → MCP tool with structured composition → durable versioned Strudel code and UI controls → live StrudelLM browser update → StrudelService validation, audio playback, status/error feedback. Audio requires a one-time browser gesture; remote MCP cannot bypass browser autoplay restrictions.

## Upstream agent rules — authoritative

The actual repository contains root CLAUDE.md and src/components/tambo/AGENTS.md; it does not contain a root agent.md at commit 99229c05. Preserve both files intact. CLAUDE.md requires, before new code, checking installed @tambo-ai/react package exports. Read that package after npm ci. It specifies npm install/npm ci, npm run dev, npm run build, npm run lint, npm run lint:fix, strict TypeScript, Zod validation, central Tambo tools and component registration in src/lib/tambo.ts, React provider usage, Tailwind patterns and manual testing. The nested AGENTS.md requires consulting https://docs.tambo.co/llms.txt for Tambo component creation patterns. Upstream CI uses Node 20+, npm ci, npm run lint, npm run build. Preserve these workflows for the imported application, with its own package-lock.json, rather than converting it to the CAFE pnpm workspace. Create a new root AGENTS.md in the imported folder referring to the upstream files for tools that read AGENTS.md.

## Port matrix — preserve complete original source

| Feature | Upstream implementation | Approach |
| --- | --- | --- |
| Strudel audio singleton; scheduler, initialization, sample prebaking, safe update, rollback | src/strudel/lib/service.ts, prebake.ts, errors.ts | Preserve and reuse |
| Browser CodeMirror REPL, status and playback controls | src/strudel/components and context | Preserve and reuse |
| Tambo prompts, tool registry, listSamples and validateAndUpdateRepl | src/lib/tambo.ts, src/strudel/tools | Preserve; supplement via MCP |
| Tambo AI-generated UIs | src/components/tambo; MultiSelectForm, ThemePicker, KeybindingsPicker, FontSettings | Preserve |
| Auth, magic links, anonymous user identity and threads | src/lib/auth.ts; src/app/chat; auth components | Preserve; optional config |
| Sound banks, synths, soundfonts, Strudel pattern prompt | src/strudel/lib | Preserve |
| Themes, preferences, local and thread-scoped code persistence | src/lib, src/hooks | Preserve |
| Original landing, chat, samples, assets | src/app, src/components, public | Preserve |
| Build workflow | README.md, CLAUDE.md, nested AGENTS.md, package-lock.json, CI | Preserve exactly; mirror in root CI |

## Stages, each with a verification gate

- [x] 0. Audit and plan: clone pinned source; read README, CLAUDE.md, nested AGENTS.md and license; run npm ci; inspect installed Tambo package exports; document workflow before implementation.
- [x] 1. Import full source into integrations/strudellm with all files, lockfile, upstream attribution and AGPL-3.0 license. It remains an independently runnable Next.js app; the original CAFE root UI is not rewritten.
- [x] 2. Add typed music state, persistent revisions, REST and SSE to existing packages/live-mcp; keep all current /mcp and CAFE endpoints unchanged.
- [x] 3. Add public MCP tools for music state, sound discovery, structured music composition and stop/control settings. ChatGPT generates original patterns in tool arguments; the server compiles them into Strudel JS. Arbitrary source editing uses bearer-protected admin MCP only.
- [x] 4. Add a new /studio page to the StrudelLM app, reusing StrudelService, StrudelProvider and StrudelRepl. It listens to MCP state and calls the existing safe update/play function. Report evaluation status to the server.
- [x] 5. Render generated music controls (tempo, overall volume, per-track settings), track indicators and currently generated source. Changing controls regenerates/evaluates code.
- [x] 6. Route /music and /music/* through the current Tailscale-exposed Node server to the independent Next.js app; preserve main CAFE webpage and current ChatGPT MCP URL.
- [x] 7. Local checks: schema/store unit tests, tool discovery, MCP mutation, original CAFE browser regression, desktop/mobile Studio E2E, audio activation and reported playing, npm lint/build. Remaining independent checks: actual speaker output, production Tambo auth/mail config, GitHub Actions status after push.
- [ ] 8. Document deployment/run commands and license notices. Push tested changes to GitHub; check published CI status.

## Reference end-user flow

User says in ChatGPT: "Create a punchy 909 kick at 128 BPM, with a gentle bass, and add tempo and volume sliders."

ChatGPT sends an MCP music_compose call over the existing Tailscale URL. The server checks structured inputs, generates Strudel source and a typed component/slider configuration, persists a revision and broadcasts SSE. An open StrudelLM Studio automatically imports the new code, validates it using the existing StrudelService updateAndPlay pipeline, reverts on invalid code, and shows result/status. Once the user has clicked Enable Audio at least once, subsequent MCP updates can automatically play through WebAudio. No samples or sound are streamed through MCP itself.

## Architecture boundary and license

CAFE is Foldkit/Effect and StrudelLM is Next.js/React. Treat these as independent web applications sharing the same MCP/Tailscale service; do not migrate the entire StrudelLM UI to Foldkit or redesign CAFE. The original StrudelLM source is AGPL-3.0 and archived. Retain LICENSE, attribution and applicable distribution/network obligations. Complete source import does not imply every external Tambo/Auth/email service has been configured or tested.

## Verified local outcomes (18 November 2026)

- Original complete source import preserves original tool registry, REPL, soundbanks and Tambo widgets; distinct MCP music endpoint has six music tools (plus restricted raw code tool). No claim that *all* original tools are individually remapped to the public MCP protocol.
- Node24 npm ci, npm run lint (0 errors, 6 pre-existing upstream warnings) and npm run build passed. Source requires Node20–25 because pinned better-sqlite3 does not compile under Node26.
- CAFE service typecheck, five unit tests, MCP music smoke, new Studio browser tests (desktop/mobile), original CAFE UI regression all passed.
- StrudelService initialized and acknowledged the current revision as playing after an explicit browser click; no physical loudspeaker test.
- External Tambo API, magic-link email and production database require their own configuration.
