"use client";

import * as React from "react";
import { LoadingContextProvider } from "@/components/loading/context";
import { StrudelProvider, useStrudel } from "@/strudel/context/strudel-provider";
import { StrudelRepl } from "@/strudel/components/strudel-repl";
import { StrudelService } from "@/strudel/lib/service";
import { Play, Square, Music2, AudioLines, SlidersHorizontal, Wifi } from "lucide-react";

type Control = {
  key: "bpm" | "volume";
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
};
type Music = {
  revision: number;
  title: string;
  code: string;
  playing: boolean;
  color: string;
  controls: Control[];
  feedback: { status: string; message?: string; revision: number } | null;
};

function Studio() {
  const { code, isPlaying, error, isReady, setCode } = useStrudel();
  const [remote, setRemote] = React.useState<Music | null>(null);
  const [connected, setConnected] = React.useState(false);
  const [audioEnabled, setAudioEnabled] = React.useState(false);
  const [working, setWorking] = React.useState(false);
  const [status, setStatus] = React.useState("Waiting for music from ChatGPT");
  const [draft, setDraft] = React.useState({ bpm: 120, volume: 0.65 });
  const lastApplied = React.useRef(-1);
  const draftTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = React.useRef(false);
  const audioReady = React.useRef(false);
  const engineReady = React.useRef(false);
  const latest = React.useRef<Music | null>(null);

  latest.current = remote;
  engineReady.current = isReady;

  const feedback = React.useCallback(async (revision: number, state: string, message?: string) => {
    try {
      await fetch("/music-sync/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision, status: state, message }),
      });
    } catch { /* The live code still works if feedback networking fails. */ }
  }, []);

  const apply = React.useCallback(async (next: Music, activated = false) => {
    if (!engineReady.current || busy.current) return;
    if (lastApplied.current === next.revision && !activated) return;
    lastApplied.current = next.revision;
    const service = StrudelService.instance();
    if (!next.playing) {
      service.stop();
      setStatus("Stopped remotely");
      void feedback(next.revision, "stopped");
      return;
    }
    if (!next.code) return;
    if (!audioReady.current && !activated) {
      // Display the generated code before browser audio is unlocked.
      setCode(next.code);
      setStatus("Generated code is ready — click Enable Audio once");
      void feedback(next.revision, "needs-gesture", "Browser audio needs a user gesture before automatic playback");
      return;
    }
    busy.current = true;
    setWorking(true);
    setStatus("Validating Strudel pattern…");
    try {
      const result = await service.updateAndPlay(next.code, { source: "ai" });
      if (!result.success) {
        setStatus("Strudel rejected the pattern; previous working music restored");
        await feedback(next.revision, "error", result.error);
      } else {
        setStatus("Playing MCP-generated music");
        await feedback(next.revision, "playing");
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setStatus("Playback error — previous code preserved");
      await feedback(next.revision, "error", message);
    } finally {
      busy.current = false;
      setWorking(false);
    }
  }, [feedback, setCode]);

  React.useEffect(() => {
    let alive = true;
    async function refresh() {
      try {
        const response = await fetch("/music-sync/state", { cache: "no-store" });
        if (!response.ok) throw new Error("Music state unavailable");
        const next = await response.json() as Music;
        if (!alive) return;
        setRemote(next);
        setDraft(current => ({
          bpm: next.controls.find(c => c.key === "bpm")?.value ?? current.bpm,
          volume: next.controls.find(c => c.key === "volume")?.value ?? current.volume,
        }));
        setConnected(true);
        void apply(next);
      } catch {
        if (alive) setConnected(false);
      }
    }
    void refresh();
    const stream = new EventSource("/music-sync/events");
    stream.addEventListener("change", () => { void refresh(); });
    stream.onopen = () => { if (alive) setConnected(true); };
    stream.onerror = () => { if (alive) setConnected(false); };
    return () => { alive = false; stream.close(); };
  }, [apply, isReady]);

  React.useEffect(() => () => {
    if (draftTimer.current) clearTimeout(draftTimer.current);
  }, []);

  const enableAudio = () => {
    // Run in a real click handler, not an SSE callback: browsers require user activation.
    audioReady.current = true;
    setAudioEnabled(true);
    const snapshot = latest.current;
    if (snapshot?.code && snapshot.playing) void apply(snapshot, true);
    else setStatus("Audio enabled — ask ChatGPT to generate a groove");
  };

  const setControl = (key: "bpm" | "volume", value: number) => {
    setDraft(current => ({ ...current, [key]: value }));
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      void fetch("/music-sync/controls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      }).then(response => { if (!response.ok) setStatus("Could not update music control"); })
        .catch(() => setStatus("Music controls are disconnected"));
    }, 260);
  };

  const action = (endpoint: "play" | "stop") => {
    void fetch("/music-sync/" + endpoint, { method: "POST" })
      .then(response => { if (!response.ok) setStatus("Playback command failed"); })
      .catch(() => setStatus("Playback command failed"));
  };

  const visibleCode = remote?.code || code || "// Ask ChatGPT for a groove using the Music MCP connector";
  const accent = remote?.color || "#8b5cf6";
  const bpmControl = remote?.controls.find(item => item.key === "bpm");
  const volumeControl = remote?.controls.find(item => item.key === "volume");

  return (
    <main className="min-h-screen bg-background text-foreground p-4 md:p-7">
      <div className="mx-auto max-w-7xl flex flex-col gap-5">
        <header className="flex flex-wrap justify-between gap-3 items-center">
          <div className="flex gap-3 items-center">
            <div className="rounded-xl p-3 text-white" style={{ backgroundColor: accent }}><Music2 size={24} /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">StrudelLM × CAFE MCP</p>
              <h1 className="font-bold text-2xl">{remote?.title || "Music Studio"}</h1>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <span className="inline-flex gap-2 items-center text-xs text-muted-foreground">
              <Wifi size={15} className={connected ? "text-emerald-500" : "text-amber-500"} />
              {connected ? "MCP live updates" : "Reconnecting"}
            </span>
            <a href="/music/chat" className="text-xs underline text-muted-foreground">Original StrudelLM chat</a>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] items-stretch">
          <div className="rounded-2xl bg-card border border-border overflow-hidden flex flex-col min-h-[560px]">
            <div className="px-5 py-4 border-b border-border flex flex-wrap gap-3 justify-between items-center">
              <div>
                <h2 className="font-semibold flex items-center gap-2"><AudioLines size={17} /> Live code editor & player</h2>
                <p className="text-xs text-muted-foreground">Original Strudel engine, live patterns and rollback</p>
              </div>
              <div className="flex gap-2">
                {!audioEnabled && (
                  <button disabled={!isReady} onClick={enableAudio}
                    className="text-sm rounded-lg px-4 py-2 text-white font-semibold disabled:opacity-50"
                    style={{ backgroundColor: accent }}>
                    <Play size={14} className="inline mr-2" />Enable Audio
                  </button>
                )}
                {audioEnabled && (
                  <button onClick={() => action(isPlaying ? "stop" : "play")}
                    className="text-sm rounded-lg px-4 py-2 bg-muted hover:bg-muted/80">
                    {isPlaying ? <Square size={14} className="inline mr-2" /> : <Play size={14} className="inline mr-2" />}
                    {isPlaying ? "Stop" : "Play"}
                  </button>
                )}
              </div>
            </div>
            <div className="relative flex-1 min-h-[420px] flex flex-col"><StrudelRepl /></div>
            <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground" role="status">
              <span className={isPlaying ? "text-emerald-500" : "text-muted-foreground"}>●</span> {working ? "Updating…" : status}
              {error && <p className="text-red-500 mt-1">{String(error)}</p>}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl p-5 bg-card border border-border space-y-6">
              <h2 className="font-semibold flex items-center gap-2"><SlidersHorizontal size={16} /> Generated controls</h2>
              {bpmControl && (
                <label className="block text-sm space-y-2">
                  <span className="flex justify-between"><span>Tempo</span><strong>{draft.bpm} BPM</strong></span>
                  <input type="range" min={40} max={220} step={1} value={draft.bpm}
                    onChange={e => setControl("bpm", Number(e.target.value))} className="w-full accent-violet-500" />
                </label>
              )}
              {volumeControl && (
                <label className="block text-sm space-y-2">
                  <span className="flex justify-between"><span>Volume</span><strong>{Math.round(draft.volume * 100)}%</strong></span>
                  <input type="range" min={0} max={1} step={0.01} value={draft.volume}
                    onChange={e => setControl("volume", Number(e.target.value))} className="w-full accent-violet-500" />
                </label>
              )}
              {!remote?.controls.length && <p className="text-sm text-muted-foreground">Ask ChatGPT to compose music; controls appear automatically.</p>}
              <div aria-label="Playback animation" className="h-12 flex gap-1 items-end">
                {Array.from({ length: 24 }, (_, index) =>
                  <span key={index} style={{ backgroundColor: accent, height: isPlaying ? (18 + (index * 23) % 70) + "%" : "8%", animationDelay: (index * 73) + "ms" }}
                    className={"flex-1 rounded-sm opacity-80 transition-all " + (isPlaying ? "animate-pulse" : "")} />)}
              </div>
              <p className="text-xs text-muted-foreground">Playback animation • tempo {draft.bpm} BPM</p>
            </div>
            <div className="rounded-2xl p-5 bg-card border border-border space-y-3">
              <h2 className="text-sm font-semibold">Generated Strudel program</h2>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words max-h-56 overflow-auto bg-muted/40 rounded-xl p-3">{visibleCode}</pre>
              <p className="text-xs text-muted-foreground">Revision {remote?.revision ?? "—"} · {remote?.feedback?.status || "awaiting browser validation"}</p>
              {remote?.feedback?.message && <p className="text-xs text-red-500 break-words">{remote.feedback.message}</p>}
            </div>
          </aside>
        </div>
        <p className="text-xs text-muted-foreground">Open this page, click Enable Audio once, then use ChatGPT with the existing Tailscale MCP connector. Audio is synthesized locally in this browser.</p>
      </div>
    </main>
  );
}

export default function McpMusicStudioPage() {
  return (
    <LoadingContextProvider>
      <StrudelProvider>
        <Studio />
      </StrudelProvider>
    </LoadingContextProvider>
  );
}
