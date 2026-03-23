/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { nexusApi } from '@/lib/nexusApi';
import {
  FlaskConical, Play, ChevronDown, ChevronRight,
  CheckCircle2, XCircle, AlertTriangle, Clock, RefreshCw,
  Shield, Database, Bot, Zap, Wrench, Activity,
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface LogicTest {
  id: string;
  category: string;
  module: string;
  name: string;
  description: string;
  severity: string;
  last_status: string;
  last_run_at: string;
  last_error: string | null;
  fail_count: number;
  pass_count: number;
  auto_fixed?: boolean;
  fix_description?: string | null;
  tenant_id?: string;
  tenant_name?: string;
  profile?: string;
}

interface LogicRun {
  id: string;
  run_type: string;
  started_at: string;
  finished_at: string;
  total_tests: number;
  passed: number;
  failed: number;
  errors: number;
  health_score: number;
  tenant_id?: string;
  tenant_name?: string;
  profile?: string;
}

interface StatusData {
  health_score: number | null;
  last_run: LogicRun | null;
  failed_tests: LogicTest[];
  categories: Record<string, { total: number; pass: number; fail: number; error: number }>;
  total_tests: number;
  auto_fixed_count?: number;
  profile?: string | null;
}

interface HistoryData {
  runs: LogicRun[];
  total: number;
  page: number;
  pages: number;
}

interface GlobalData {
  global_score: number | null;
  tenants: Array<{
    tenantId: string;
    profile: string;
    name: string;
    healthScore: number | null;
    lastRun: LogicRun | null;
  }>;
  total_tenants: number;
  active_tenants: number;
}

// ============================================
// HOOKS
// ============================================

function useAnimatedNumber(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const start = prev.current;
    const diff = target - start;
    if (diff === 0) return;

    const startTime = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + diff * eased));
      if (progress >= 1) {
        clearInterval(id);
        prev.current = target;
      }
    }, 16);
    return () => clearInterval(id);
  }, [target, duration]);

  return value;
}

// ============================================
// SUB-COMPONENTS
// ============================================

function HealthGauge({ score }: { score: number }) {
  const animated = useAnimatedNumber(score);
  const r = 50;
  const c = 2 * Math.PI * r;
  const offset = c - (animated / 100) * c * 0.75;
  const color = animated >= 90 ? '#22c55e' : animated >= 70 ? '#eab308' : '#ef4444';

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="110" viewBox="0 0 140 110">
        <path d="M 20 90 A 50 50 0 1 1 120 90" fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round" />
        <path d="M 20 90 A 50 50 0 1 1 120 90" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${c * 0.75}`} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)', filter: `drop-shadow(0 0 8px ${color}66)` }} />
        <text x="70" y="70" textAnchor="middle" fill="white" fontSize="30" fontWeight="bold" className="font-mono">{animated}</text>
        <text x="70" y="88" textAnchor="middle" fill="#64748b" fontSize="11">/100</text>
      </svg>
      <div className="text-[10px] text-slate-500 -mt-1">Score de sante</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
    pass: { bg: 'bg-green-500/15', text: 'text-green-400', icon: CheckCircle2 },
    fail: { bg: 'bg-red-500/15', text: 'text-red-400', icon: XCircle },
    error: { bg: 'bg-yellow-500/15', text: 'text-yellow-400', icon: AlertTriangle },
    pending: { bg: 'bg-slate-500/15', text: 'text-slate-400', icon: Clock },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text}`}>
      <Icon size={10} />
      {status.toUpperCase()}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: 'text-red-400 bg-red-500/10',
    warning: 'text-yellow-400 bg-yellow-500/10',
    info: 'text-blue-400 bg-blue-500/10',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${colors[severity] || colors.info}`}>
      {severity}
    </span>
  );
}

function SelfHealedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/15 text-emerald-400">
      <Wrench size={9} />
      Self-healed
    </span>
  );
}

const CATEGORY_ICONS: Record<string, typeof Shield> = {
  hourly: Activity,
  nightly: Zap,
  weekly: Bot,
};

const CATEGORY_LABELS: Record<string, string> = {
  hourly: 'Vie quotidienne (horaire)',
  nightly: 'Stress tests (nocturne)',
  weekly: 'IA + Securite (hebdo)',
};

const RUN_TYPE_LABELS: Record<string, string> = {
  hourly: 'Horaire',
  nightly: 'Nocturne',
  weekly: 'Hebdo',
  full: 'Complet',
};

const PROFILE_LABELS: Record<string, string> = {
  salon: 'Salon',
  restaurant: 'Restaurant',
  commerce: 'Commerce',
  events: 'Events',
  consulting: 'Consulting',
  securite: 'Securite',
  hotel: 'Hotel',
  domicile: 'Domicile',
};

function CategoryAccordion({
  category,
  stats,
  tests,
  expanded,
  onToggle,
}: {
  category: string;
  stats: { total: number; pass: number; fail: number; error: number };
  tests: LogicTest[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = CATEGORY_ICONS[category] || FlaskConical;
  const label = CATEGORY_LABELS[category] || category;
  const passRate = stats.total > 0 ? Math.round((stats.pass / stats.total) * 100) : 0;
  const barColor = passRate >= 90 ? 'bg-green-500' : passRate >= 70 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors"
      >
        <Icon size={16} className="text-cyan-400 shrink-0" />
        <span className="text-sm text-white font-medium flex-1 text-left">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-green-400 font-mono">{stats.pass}</span>
          <span className="text-[10px] text-slate-600">/</span>
          <span className="text-[10px] text-slate-400 font-mono">{stats.total}</span>
          {stats.fail > 0 && <span className="text-[10px] text-red-400 font-mono">({stats.fail} fail)</span>}
        </div>
        <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${passRate}%` }} />
        </div>
        {expanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-800 divide-y divide-slate-800/50">
          {tests.map(t => (
            <div key={t.id || t.name} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-800/30 transition-colors">
              <StatusBadge status={t.last_status} />
              <SeverityBadge severity={t.severity} />
              {t.auto_fixed && <SelfHealedBadge />}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-300 truncate">{t.description || t.name}</div>
                <div className="text-[9px] text-slate-600 font-mono mt-0.5">
                  {t.tenant_name && <span className="text-cyan-500/70">[{t.tenant_name}] </span>}
                  {t.module} / {t.name}
                </div>
              </div>
              {t.last_run_at && (
                <div className="text-[9px] text-slate-600 font-mono shrink-0">
                  {new Date(t.last_run_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              {t.last_error && t.last_status !== 'pass' && (
                <div className="text-[9px] text-red-400/70 max-w-[200px] truncate" title={t.last_error}>
                  {t.last_error}
                </div>
              )}
            </div>
          ))}
          {tests.length === 0 && (
            <div className="px-4 py-3 text-xs text-slate-600 text-center">Aucun test execute</div>
          )}
        </div>
      )}
    </div>
  );
}

function RunTimeline({ runs }: { runs: LogicRun[] }) {
  if (!runs.length) {
    return <div className="text-xs text-slate-600 text-center py-4">Aucun run enregistre</div>;
  }

  return (
    <div className="space-y-2">
      {runs.slice(0, 10).map((run, i) => {
        const score = run.health_score ?? 0;
        const scoreColor = score >= 90 ? 'text-green-400' : score >= 70 ? 'text-yellow-400' : 'text-red-400';
        const dotColor = score >= 90 ? 'bg-green-500' : score >= 70 ? 'bg-yellow-500' : 'bg-red-500';

        return (
          <div key={run.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
            style={{ animationDelay: `${i * 60}ms` }}>
            <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />
            <span className="text-[10px] text-slate-400 font-medium w-14">
              {RUN_TYPE_LABELS[run.run_type] || run.run_type}
            </span>
            {run.tenant_name && (
              <span className="text-[9px] text-cyan-500/60 font-mono w-24 truncate shrink-0" title={run.tenant_name}>
                {run.tenant_name}
              </span>
            )}
            <span className={`text-sm font-bold font-mono ${scoreColor} w-10`}>
              {Math.round(score)}
            </span>
            <div className="flex-1 flex items-center gap-1.5 text-[10px]">
              <span className="text-green-400">{run.passed}P</span>
              <span className="text-slate-700">/</span>
              {run.failed > 0 && <span className="text-red-400">{run.failed}F</span>}
              {run.errors > 0 && <span className="text-yellow-400">{run.errors}E</span>}
              <span className="text-slate-600">({run.total_tests})</span>
            </div>
            <span className="text-[9px] text-slate-600 font-mono shrink-0">
              {run.started_at ? new Date(run.started_at).toLocaleString('fr-FR', {
                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
              }) : '-'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ProfileCard({ tenant }: { tenant: GlobalData['tenants'][0] }) {
  const score = tenant.healthScore ?? 0;
  const scoreColor = score >= 90 ? 'text-green-400' : score >= 70 ? 'text-yellow-400' : score > 0 ? 'text-red-400' : 'text-slate-600';
  const borderColor = score >= 90 ? 'border-green-800' : score >= 70 ? 'border-yellow-800' : score > 0 ? 'border-red-800' : 'border-slate-800';

  return (
    <div className={`p-3 rounded-lg border ${borderColor} bg-slate-900/50`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-slate-400 font-medium">
          {PROFILE_LABELS[tenant.profile] || tenant.profile}
        </span>
        <span className={`text-sm font-bold font-mono ${scoreColor}`}>
          {score > 0 ? `${Math.round(score)}%` : '--'}
        </span>
      </div>
      <div className="text-[9px] text-slate-600 truncate">{tenant.name}</div>
      {tenant.lastRun && (
        <div className="text-[9px] text-slate-700 mt-1">
          {new Date(tenant.lastRun.started_at).toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
          })}
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function SentinelLogicTests() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [tests, setTests] = useState<LogicTest[]>([]);
  const [globalData, setGlobalData] = useState<GlobalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runDropdown, setRunDropdown] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['hourly']));

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, historyRes, testsRes, globalRes] = await Promise.allSettled([
        nexusApi.get<{ data?: StatusData; success?: boolean }>('/nexus/sentinel/plte/all-status'),
        nexusApi.get<{ data?: HistoryData; success?: boolean }>('/nexus/sentinel/plte/all-history'),
        nexusApi.get<{ data?: LogicTest[]; success?: boolean }>('/nexus/sentinel/plte/all-tests'),
        nexusApi.get<{ data?: GlobalData; success?: boolean }>('/sentinel/logic/global'),
      ]);

      if (statusRes.status === 'fulfilled') {
        const d = statusRes.value;
        setStatus((d as { data: StatusData }).data || d as StatusData);
      }
      if (historyRes.status === 'fulfilled') {
        const d = historyRes.value;
        setHistory((d as { data: HistoryData }).data || d as HistoryData);
      }
      if (testsRes.status === 'fulfilled') {
        const d = testsRes.value;
        setTests((d as { data: LogicTest[] }).data || d as LogicTest[] || []);
      }
      if (globalRes.status === 'fulfilled') {
        const d = globalRes.value;
        setGlobalData((d as { data: GlobalData }).data || d as GlobalData);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  const handleRun = async (type: string) => {
    setRunDropdown(false);
    setRunning(true);
    try {
      await nexusApi.post('/sentinel/logic/run', { type });
      await fetchData();
    } catch (err) {
      console.error('PLTE run error:', err);
    } finally {
      setRunning(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Group tests by category
  const testsByCategory: Record<string, LogicTest[]> = {};
  for (const t of tests) {
    if (!testsByCategory[t.category]) testsByCategory[t.category] = [];
    testsByCategory[t.category].push(t);
  }

  // Auto-fixed tests this week
  const autoFixedTests = tests.filter(t => t.auto_fixed);

  const healthScore = status?.health_score ?? 0;
  const totalTests = status?.total_tests ?? 0;
  const failedCount = status?.failed_tests?.length ?? 0;
  const globalScore = globalData?.global_score ?? 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={20} className="text-cyan-500 animate-spin" />
        <span className="ml-2 text-slate-500 text-sm">Chargement PLTE v2...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Health Gauge */}
        <div className="md:col-span-1 flex justify-center items-center p-4 rounded-xl border border-slate-800 bg-slate-900/50">
          <HealthGauge score={globalScore || healthScore} />
        </div>

        {/* KPI Cards */}
        <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Tests total" value={totalTests} color="cyan" icon={FlaskConical} />
          <KpiCard label="En echec" value={failedCount} color={failedCount > 0 ? 'red' : 'green'} icon={XCircle} />
          <KpiCard label="Auto-corriges" value={status?.auto_fixed_count ?? 0} color="emerald" icon={Wrench} />
          <KpiCard
            label="Profils actifs"
            value={globalData?.active_tenants ?? 0}
            text={globalData ? `${globalData.active_tenants}/${globalData.total_tenants}` : undefined}
            color="purple"
            icon={Activity}
          />
        </div>
      </div>

      {/* Vue par profil */}
      {globalData?.tenants && globalData.tenants.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Database size={14} className="text-cyan-400" />
            Score par profil metier
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {globalData.tenants.map(t => (
              <ProfileCard key={t.tenantId} tenant={t} />
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <FlaskConical size={14} className="text-cyan-400" />
          Tests par categorie
        </h2>

        <div className="relative">
          <button
            onClick={() => setRunDropdown(!runDropdown)}
            disabled={running}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${running
                ? 'bg-slate-800 text-slate-500 cursor-wait'
                : 'bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 border border-cyan-500/20'}`}
          >
            {running ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
            {running ? 'En cours...' : 'Lancer un test'}
          </button>

          {runDropdown && !running && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-slate-700 bg-slate-900 shadow-xl z-50 overflow-hidden">
              {[
                { type: 'hourly', label: 'Tests horaires', desc: 'Vie quotidienne (8 tenants)' },
                { type: 'nightly', label: 'Tests nocturnes', desc: 'Stress + edge cases' },
                { type: 'weekly', label: 'Tests IA', desc: 'IA deep + securite' },
                { type: 'full', label: 'Suite complete', desc: 'Tout d\'un coup' },
              ].map(item => (
                <button
                  key={item.type}
                  onClick={() => handleRun(item.type)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 transition-colors"
                >
                  <div className="text-xs text-white">{item.label}</div>
                  <div className="text-[9px] text-slate-500">{item.desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Categories Accordions */}
      <div className="space-y-2">
        {['hourly', 'nightly', 'weekly'].map(cat => (
          <CategoryAccordion
            key={cat}
            category={cat}
            stats={status?.categories?.[cat] || { total: 0, pass: 0, fail: 0, error: 0 }}
            tests={testsByCategory[cat] || []}
            expanded={expandedCategories.has(cat)}
            onToggle={() => toggleCategory(cat)}
          />
        ))}
      </div>

      {/* Auto-corrections */}
      {autoFixedTests.length > 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4">
          <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
            <Wrench size={14} />
            Auto-corrections ({autoFixedTests.length})
          </h3>
          <div className="space-y-2">
            {autoFixedTests.map(t => (
              <div key={t.id || t.name} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-slate-900/50">
                <SelfHealedBadge />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white">{t.description || t.name}</div>
                  {t.fix_description && (
                    <div className="text-[10px] text-emerald-400/70 mt-1">{t.fix_description}</div>
                  )}
                </div>
                <div className="text-[9px] text-slate-600 font-mono shrink-0">
                  {t.last_run_at ? new Date(t.last_run_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed Tests Detail */}
      {status?.failed_tests && status.failed_tests.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-950/10 p-4">
          <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
            <XCircle size={14} />
            Tests en echec ({status.failed_tests.length})
          </h3>
          <div className="space-y-2">
            {status.failed_tests.map(t => (
              <div key={`${t.tenant_id}-${t.id || t.name}`} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-slate-900/50">
                <SeverityBadge severity={t.severity} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white">
                    {t.tenant_name && <span className="text-cyan-400/80 mr-1">[{t.tenant_name}]</span>}
                    {t.description || t.name}
                  </div>
                  {t.last_error && (
                    <div className="text-[10px] text-red-400/70 mt-1 break-words">{t.last_error}</div>
                  )}
                </div>
                <div className="text-[9px] text-slate-600 font-mono shrink-0">
                  {t.fail_count}x fail
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run History */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Clock size={14} className="text-cyan-400" />
          Historique des runs
        </h3>
        <RunTimeline runs={history?.runs || []} />
      </div>
    </div>
  );
}

// ============================================
// HELPER COMPONENT
// ============================================

function KpiCard({ label, value, text, color, icon: Icon }: {
  label: string;
  value?: number;
  text?: string;
  color: string;
  icon: typeof FlaskConical;
}) {
  const animated = useAnimatedNumber(value ?? 0);
  const bgMap: Record<string, string> = {
    cyan: 'border-cyan-800 bg-cyan-950/30',
    blue: 'border-blue-800 bg-blue-950/30',
    green: 'border-green-800 bg-green-950/30',
    red: 'border-red-800 bg-red-950/30',
    purple: 'border-purple-800 bg-purple-950/30',
    emerald: 'border-emerald-800 bg-emerald-950/30',
  };
  const textMap: Record<string, string> = {
    cyan: 'text-cyan-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    red: 'text-red-400',
    purple: 'text-purple-400',
    emerald: 'text-emerald-400',
  };

  return (
    <div className={`p-3 rounded-lg border ${bgMap[color]} transition-all`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} className={textMap[color]} />
        <span className="text-[10px] text-slate-400">{label}</span>
      </div>
      <div className={`text-lg font-bold font-mono ${textMap[color]}`}>
        {text ?? animated}
      </div>
    </div>
  );
}
