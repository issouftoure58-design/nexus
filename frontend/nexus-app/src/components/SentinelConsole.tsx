import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── TYPES ──────────────────────────────────────────────
interface LogEntry {
  type: "log" | "alert" | "metric" | "command_result" | "welcome" | "heartbeat";
  timestamp: string;
  data: any;
}

interface Insight {
  id: string;
  severity: "info" | "warn" | "critical" | "ok";
  title: string;
  message: string;
  recommendation: string;
  metric: string;
  value: number;
  threshold: number;
}

interface Metrics {
  cpu: number;
  cpuHistory: number[];
  memory: {
    used: number;
    total: number;
    percent: number;
    history: number[];
    node: { rss: number; heapUsed: number; heapTotal: number };
    systemLabel?: string;
    nodeLabel?: string;
  };
  requests: {
    total: number;
    perMinute: number;
    current: number;
    history: number[];
    errors: number;
    note?: string;
  };
  uptime: number;
  connections: number;
  pid: number;
  nodeVersion: string;
  platform: string;
  env?: string;
  insights?: Insight[];
}

// ─── SPARKLINE SVG ──────────────────────────────────────
function Sparkline({
  data,
  color,
  height = 32,
  width = 120,
  filled = false,
}: {
  data: number[];
  color: string;
  height?: number;
  width?: number;
  filled?: boolean;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  });

  return (
    <svg width={width} height={height} className="opacity-80">
      {filled && (
        <polygon
          points={`0,${height} ${points.join(" ")} ${width},${height}`}
          fill={color}
          opacity="0.15"
        />
      )}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {data.length > 0 && (
        <circle
          cx={width}
          cy={parseFloat(points[points.length - 1].split(",")[1])}
          r="2.5"
          fill={color}
          className="animate-pulse"
        />
      )}
    </svg>
  );
}

// ─── ECG HEARTBEAT LINE ─────────────────────────────────
function HeartbeatLine({ alive }: { alive: boolean }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!alive) return;
    const id = setInterval(() => setPhase((p) => (p + 1) % 100), 30);
    return () => clearInterval(id);
  }, [alive]);

  const width = 300;
  const height = 40;
  const points: string[] = [];

  for (let i = 0; i < width; i += 2) {
    const x = i;
    const t = (i + phase * 3) % width;
    let y = height / 2;
    if (t > 80 && t < 85) y = height / 2 - 4;
    else if (t > 85 && t < 90) y = height / 2 + 2;
    else if (t > 90 && t < 95) y = height / 2 - 18;
    else if (t > 95 && t < 100) y = height / 2 + 12;
    else if (t > 100 && t < 105) y = height / 2 - 3;
    else if (t > 105 && t < 110) y = height / 2 + 1;
    points.push(`${x},${y}`);
  }

  return (
    <svg width={width} height={height} className="w-full">
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={alive ? "#22d3ee" : "#334155"}
        strokeWidth="2"
        strokeLinecap="round"
        opacity={alive ? 0.9 : 0.3}
      />
    </svg>
  );
}

// ─── GAUGE CIRCULAIRE ───────────────────────────────────
function CircularGauge({
  value,
  max = 100,
  label,
  unit = "%",
  color,
  size = 72,
}: {
  value: number;
  max?: number;
  label: string;
  unit?: string;
  color: string;
  size?: number;
}) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  const offset = circ * (1 - pct);
  const c = pct > 0.8 ? "#ef4444" : pct > 0.6 ? "#eab308" : color;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e293b" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700 ease-out" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth="5"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          opacity="0.3" filter="blur(4px)" />
      </svg>
      <div className="text-center -mt-[calc(50%+8px)] mb-4">
        <div className="text-lg font-bold" style={{ color: c }}>
          {value}<span className="text-xs opacity-60">{unit}</span>
        </div>
      </div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

// ─── BARRE ANIMÉE ───────────────────────────────────────
function AnimatedBar({ value, max, color, label, detail }: {
  value: number; max: number; color: string; label: string; detail: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-500">{detail}</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700 ease-out relative"
          style={{ width: `${pct}%`, backgroundColor: color }}>
          <div className="absolute inset-0 rounded-full animate-pulse opacity-40"
            style={{ backgroundColor: color }} />
        </div>
      </div>
    </div>
  );
}

// ─── STATUS DOT ─────────────────────────────────────────
function StatusDot({ active, label }: { active: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${active ? "bg-green-400" : "bg-red-500"}`} />
        {active && <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-400 animate-ping opacity-50" />}
      </div>
      <span className={`text-[10px] ${active ? "text-green-400" : "text-red-400"}`}>{label}</span>
    </div>
  );
}

// ─── INSIGHT CARD ───────────────────────────────────────
function InsightCard({ insight }: { insight: Insight }) {
  const [expanded, setExpanded] = useState(false);
  const severityStyles: Record<string, { border: string; bg: string; icon: string; glow: string }> = {
    critical: { border: "border-red-700", bg: "bg-red-950/40", icon: "text-red-400", glow: "shadow-red-500/20 shadow-lg" },
    warn: { border: "border-yellow-700", bg: "bg-yellow-950/30", icon: "text-yellow-400", glow: "" },
    info: { border: "border-blue-800", bg: "bg-blue-950/20", icon: "text-blue-400", glow: "" },
    ok: { border: "border-green-800", bg: "bg-green-950/20", icon: "text-green-400", glow: "" },
  };
  const s = severityStyles[insight.severity] || severityStyles.info;
  const icons = { critical: "!!!", warn: "!", info: "i", ok: "OK" };

  return (
    <div
      className={`rounded-lg border ${s.border} ${s.bg} ${s.glow} p-3 cursor-pointer transition-all duration-300 hover:brightness-110`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-2">
        <div className={`${s.icon} font-mono font-bold text-xs mt-0.5 shrink-0 w-6 h-6 rounded-full border ${s.border} flex items-center justify-center ${insight.severity === "critical" ? "animate-pulse" : ""}`}>
          {icons[insight.severity]}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold ${s.icon}`}>{insight.title}</div>
          <div className="text-xs text-slate-400 mt-0.5 leading-relaxed">{insight.message}</div>
          {expanded && (
            <div className="mt-2 pt-2 border-t border-slate-700/50">
              <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Recommandation Sentinel</div>
              <div className="text-xs text-cyan-300 leading-relaxed">{insight.recommendation}</div>
            </div>
          )}
          {!expanded && (
            <div className="text-[9px] text-slate-600 mt-1">Cliquer pour voir la recommandation</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SENTINEL VOICE (text that types itself) ────────────
function SentinelVoice({ text, severity }: { text: string; severity: string }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      if (i <= text.length) {
        setDisplayed(text.slice(0, i));
      } else {
        setDone(true);
        clearInterval(id);
      }
    }, 15);
    return () => clearInterval(id);
  }, [text]);

  const color = severity === "critical" ? "text-red-400" : severity === "warn" ? "text-yellow-300" : severity === "ok" ? "text-green-400" : "text-cyan-300";

  return (
    <div className={`${color} text-xs font-mono leading-relaxed`}>
      {displayed}
      {!done && <span className="animate-pulse">|</span>}
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────
export default function SentinelConsole() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [heartbeat, setHeartbeat] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [activeTab, setActiveTab] = useState<"console" | "insights">("insights");
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (activeTab === "console") scrollToBottom();
  }, [logs, scrollToBottom, activeTab]);

  // ── WebSocket ──
  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/sentinel`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; }
    };
    ws.onclose = () => {
      setConnected(false);
      setHeartbeat(false);
      wsRef.current = null;
      reconnectRef.current = setTimeout(connect, 2000);
    };
    ws.onmessage = (event) => {
      try {
        const msg: LogEntry = JSON.parse(event.data);
        if (msg.type === "heartbeat") {
          setHeartbeat(true);
          setTimeout(() => setHeartbeat(false), 200);
          return;
        }
        if (msg.type === "metric") {
          setMetrics(msg.data);
          return;
        }
        if (msg.type === "welcome") {
          setMetrics(msg.data.metrics);
          if (msg.data.recentLogs) setLogs(msg.data.recentLogs);
          setLogs((prev) => [...prev, { type: "welcome", timestamp: msg.timestamp, data: { message: msg.data.message } }]);
          return;
        }
        if (msg.type === "command_result" && msg.data.command === "clear") {
          setLogs([]);
          return;
        }
        setLogs((prev) => [...prev.slice(-400), msg]);
      } catch {}
    };
    return ws;
  }, []);

  useEffect(() => {
    const ws = connect();
    return () => { if (reconnectRef.current) clearTimeout(reconnectRef.current); ws.close(); };
  }, [connect]);

  const sendCommand = (cmd: string) => {
    if (!cmd.trim() || !wsRef.current) return;
    setCommandHistory((prev) => [...prev.slice(-50), cmd]);
    setHistoryIdx(-1);
    setLogs((prev) => [...prev, { type: "log", timestamp: new Date().toISOString(), data: { level: "command", source: "CLI", message: `> ${cmd}` } }]);
    wsRef.current.send(JSON.stringify({ type: "command", command: cmd }));
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") sendCommand(input);
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const idx = historyIdx < 0 ? commandHistory.length - 1 : Math.max(0, historyIdx - 1);
        setHistoryIdx(idx); setInput(commandHistory[idx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx >= 0) {
        const idx = historyIdx + 1;
        if (idx >= commandHistory.length) { setHistoryIdx(-1); setInput(""); }
        else { setHistoryIdx(idx); setInput(commandHistory[idx]); }
      }
    }
  };

  const uptimeStr = useMemo(() => {
    if (!metrics) return "---";
    const s = metrics.uptime;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  }, [metrics?.uptime]);

  // Determine overall health from insights
  const insights = metrics?.insights || [];
  const worstSeverity = insights.reduce((worst, i) => {
    const order = { critical: 3, warn: 2, info: 1, ok: 0 };
    return (order[i.severity] || 0) > (order[worst] || 0) ? i.severity : worst;
  }, "ok" as string);

  const sentinelSpeech = useMemo(() => {
    if (!metrics) return { text: "Connexion en cours...", severity: "info" };
    const critical = insights.filter((i) => i.severity === "critical");
    const warns = insights.filter((i) => i.severity === "warn");
    if (critical.length > 0) {
      return {
        text: `ALERTE : ${critical.map((c) => c.title).join(", ")}. ${critical[0].recommendation}`,
        severity: "critical",
      };
    }
    if (warns.length > 0) {
      return {
        text: `Attention : ${warns.map((w) => w.title).join(", ")}. ${warns[0].recommendation}`,
        severity: "warn",
      };
    }
    if (metrics.uptime < 120) {
      return { text: "Sentinel en ligne. Calibration des capteurs en cours... Les sparklines se rempliront dans quelques instants.", severity: "info" };
    }
    return {
      text: `Tous les systemes fonctionnent normalement. CPU ${metrics.cpu}%, RAM Node ${metrics.memory.node.rss}MB. Uptime ${uptimeStr}. Aucune anomalie detectee.`,
      severity: "ok",
    };
  }, [metrics, insights, uptimeStr]);

  const healthColor = worstSeverity === "critical" ? "#ef4444" : worstSeverity === "warn" ? "#eab308" : "#22c55e";

  return (
    <div className="flex flex-col h-full gap-3 select-none">
      {/* ─── TOP BAR: ECG + SENTINEL VOICE ─── */}
      <div className="bg-slate-900/80 rounded-lg border border-slate-800 p-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <StatusDot active={connected} label={connected ? "LIVE" : "OFFLINE"} />
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full transition-all duration-200 ${heartbeat ? "bg-cyan-400 shadow-[0_0_8px_#22d3ee]" : "bg-slate-700"}`} />
              <span className="text-[10px] text-slate-500">HEARTBEAT</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full transition-all" style={{ backgroundColor: healthColor, boxShadow: `0 0 6px ${healthColor}` }} />
              <span className="text-[10px] text-slate-500">HEALTH</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-slate-500 font-mono">
            <span>PID {metrics?.pid || "---"}</span>
            <span>{metrics?.nodeVersion || ""}</span>
            <span>UP {uptimeStr}</span>
          </div>
        </div>

        {/* Sentinel Voice */}
        <div className="bg-black/40 rounded px-3 py-2 mb-2 min-h-[32px]">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: healthColor }} />
            <span className="text-[9px] text-slate-600 uppercase tracking-widest">Sentinel Intelligence</span>
          </div>
          <SentinelVoice text={sentinelSpeech.text} severity={sentinelSpeech.severity} />
        </div>

        <HeartbeatLine alive={connected} />
      </div>

      {/* ─── GAUGES + SPARKLINES ─── */}
      {metrics?.env === "development" && (
        <div className="bg-blue-950/30 border border-blue-800/50 rounded-lg px-3 py-2 text-[10px] text-blue-300">
          Mode developpement — les metriques ci-dessous concernent votre Mac, pas un serveur distant.
          L'application NEXUS n'utilise que <span className="text-white font-bold">{metrics?.memory.node.rss || 0}MB</span> de memoire.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* CPU */}
        <div className="bg-slate-900/80 rounded-lg border border-slate-800 p-3">
          <div className="text-[9px] text-slate-600 mb-1 uppercase tracking-wider">
            Processeur {metrics?.env === "development" ? "(votre Mac)" : "(serveur)"}
          </div>
          <div className="flex items-start justify-between">
            <CircularGauge value={metrics?.cpu || 0} label="CPU" color="#22d3ee" />
            <div className="flex-1 ml-3">
              <Sparkline data={metrics?.cpuHistory || []} color="#22d3ee" filled width={140} height={50} />
            </div>
          </div>
        </div>

        {/* RAM */}
        <div className="bg-slate-900/80 rounded-lg border border-slate-800 p-3">
          <div className="text-[9px] text-slate-600 mb-1 uppercase tracking-wider">
            {metrics?.memory.systemLabel || "RAM"}
          </div>
          <div className="flex items-start justify-between">
            <CircularGauge value={metrics?.memory.percent || 0} label="RAM" color="#a78bfa" />
            <div className="flex-1 ml-3 space-y-2">
              <Sparkline data={metrics?.memory.history || []} color="#a78bfa" filled width={140} height={28} />
              <div className="text-[10px] text-slate-500 space-y-0.5">
                <div>App NEXUS : <span className="text-white font-medium">{metrics?.memory.node.rss || 0}MB</span></div>
                <div>Heap JS : <span className="text-slate-300">{metrics?.memory.node.heapUsed || 0}/{metrics?.memory.node.heapTotal || 0}MB</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Requests */}
        <div className="bg-slate-900/80 rounded-lg border border-slate-800 p-3">
          <div className="text-[9px] text-slate-600 mb-1 uppercase tracking-wider">
            Requetes API (depuis le demarrage)
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-emerald-400">{metrics?.requests.total || 0}</div>
                <div className="text-[10px] text-slate-500">depuis {uptimeStr}</div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-emerald-300">
                  {metrics?.requests.perMinute || 0}<span className="text-xs text-slate-500">/min</span>
                </div>
                {(metrics?.requests.errors || 0) > 0 && (
                  <div className="text-xs text-red-400">{metrics?.requests.errors} erreur{(metrics?.requests.errors || 0) > 1 ? "s" : ""}</div>
                )}
              </div>
            </div>
            <Sparkline data={metrics?.requests.history || []} color="#34d399" filled width={200} height={30} />
            <AnimatedBar
              value={metrics?.memory.node.heapUsed || 0}
              max={metrics?.memory.node.heapTotal || 256}
              color="#a78bfa"
              label="Memoire app NEXUS"
              detail={`${metrics?.memory.node.heapUsed || 0}/${metrics?.memory.node.heapTotal || 0}MB`}
            />
          </div>
        </div>
      </div>

      {/* ─── TABS: INSIGHTS / CONSOLE ─── */}
      <div className="flex gap-1 text-xs">
        <button
          onClick={() => setActiveTab("insights")}
          className={`px-3 py-1.5 rounded-t-lg transition ${activeTab === "insights" ? "bg-slate-900 text-cyan-400 border border-b-0 border-slate-800" : "text-slate-500 hover:text-slate-300"}`}
        >
          Diagnostics ({insights.length})
        </button>
        <button
          onClick={() => setActiveTab("console")}
          className={`px-3 py-1.5 rounded-t-lg transition ${activeTab === "console" ? "bg-black/90 text-green-400 border border-b-0 border-slate-800" : "text-slate-500 hover:text-slate-300"}`}
        >
          Console ({logs.length})
        </button>
      </div>

      {/* ─── INSIGHTS TAB ─── */}
      {activeTab === "insights" && (
        <div className="flex-1 bg-slate-900/80 rounded-lg rounded-tl-none border border-slate-800 p-3 overflow-y-auto min-h-[200px] space-y-2">
          {insights.length === 0 ? (
            <div className="text-slate-500 text-sm py-8 text-center">
              Sentinel analyse les metriques... Les diagnostics apparaitront dans quelques secondes.
            </div>
          ) : (
            insights.map((insight) => <InsightCard key={insight.id} insight={insight} />)
          )}
        </div>
      )}

      {/* ─── CONSOLE TAB ─── */}
      {activeTab === "console" && (
        <div className="flex-1 bg-black/90 rounded-lg rounded-tl-none border border-slate-800 font-mono text-[11px] overflow-hidden flex flex-col min-h-[200px]"
          onClick={() => inputRef.current?.focus()}>
          <div className="flex-1 overflow-y-auto p-3 space-y-px min-h-0">
            {logs.map((entry, i) => <LogLine key={i} entry={entry} />)}
            <div ref={logsEndRef} />
          </div>
          <div className="border-t border-slate-800/50 px-3 py-2 flex items-center gap-2 bg-slate-950/80">
            <span className="text-cyan-500 font-bold">sentinel &gt;</span>
            <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off" data-lpignore="true" data-1p-ignore="true" aria-autocomplete="none"
              className="flex-1 bg-transparent text-green-400 outline-none caret-green-400 placeholder:text-slate-700"
              placeholder="help | status | health | rdv | tenants | logs" autoFocus />
            {connected && <div className="w-1.5 h-4 bg-green-500 rounded-sm animate-pulse" />}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LOG LINE ───────────────────────────────────────────
function LogLine({ entry }: { entry: LogEntry }) {
  const time = new Date(entry.timestamp).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  if (entry.type === "welcome") {
    return <div className="text-cyan-400 py-1 border-b border-slate-800/30 mb-1"><span className="text-slate-600">[{time}]</span> {entry.data.message}</div>;
  }

  if (entry.type === "command_result") {
    const { result, command } = entry.data;
    if (command === "clear") return null;
    if (Array.isArray(result)) {
      return <div className="text-slate-300 py-0.5">{result.map((line: any, i: number) => (
        <div key={i} className="pl-4">{typeof line === "string" ? line : JSON.stringify(line)}</div>
      ))}</div>;
    }
    if (typeof result === "string") return <div className="text-yellow-300 pl-4 py-0.5">{result}</div>;
    return <div className="text-slate-300 pl-4 py-0.5"><pre className="whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre></div>;
  }

  const { level, source, message, details } = entry.data || {};
  const styles: Record<string, { text: string; badge: string }> = {
    info: { text: "text-slate-400", badge: "text-blue-400" },
    warn: { text: "text-yellow-300", badge: "text-yellow-500" },
    error: { text: "text-red-400", badge: "text-red-500" },
    success: { text: "text-green-400", badge: "text-green-500" },
    command: { text: "text-cyan-300", badge: "text-cyan-500" },
  };
  const s = styles[level] || styles.info;

  return (
    <div className={`${s.text} flex items-baseline gap-1 py-px hover:bg-slate-900/30`}>
      <span className="text-slate-700 shrink-0">[{time}]</span>
      {source && <span className={`${s.badge} text-[9px] font-bold shrink-0`}>[{source}]</span>}
      <span className="truncate">{message}</span>
      {details?.status && (
        <span className={`text-[9px] ml-auto shrink-0 px-1 rounded ${details.status >= 500 ? "bg-red-900/40 text-red-400" : details.status >= 400 ? "bg-yellow-900/40 text-yellow-400" : "bg-green-900/40 text-green-400"}`}>
          {details.status}
        </span>
      )}
      {details?.duration != null && (
        <span className={`text-[9px] shrink-0 ${details.duration > 1000 ? "text-red-400" : details.duration > 200 ? "text-yellow-400" : "text-slate-600"}`}>
          {details.duration}ms
        </span>
      )}
      {details?.recommendation && (
        <span className="text-[9px] text-cyan-600 shrink-0 ml-1" title={details.recommendation}>TIP</span>
      )}
    </div>
  );
}
