import { useState, useEffect, useRef } from 'react';
import { nexusApi } from '@/lib/nexusApi';

interface CacheStats { hits: number; misses: number; size?: number; savings?: number; totalFiles?: number; totalSizeMB?: string; }
interface AIStats {
  month: {
    calls: number; callsHaiku: number; callsSonnet: number; haikuPercent: number;
    tokensIn: number; tokensOut: number; tokensTotal: number;
    cost: number; avgCostPerCall: number; costIfAllSonnet: number;
    savings: number; savingsPercent: number;
  };
  session: {
    router: { haiku?: number; sonnet?: number; cached?: number; haikuPercentage?: string; estimatedSavings?: string };
    cache: { hits?: number; misses?: number; hitRate?: string; estimatedSavings?: string };
    prompt: { totalSaved?: number; totalOriginal?: number; reductionPercent?: string };
  };
}

function useAnimatedNumber(target: number, duration = 1000, decimals = 0) {
  const [value, setValue] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const diff = target - start;
    if (Math.abs(diff) < 0.001) return;
    const startTime = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const raw = start + diff * eased;
      setValue(decimals > 0 ? parseFloat(raw.toFixed(decimals)) : Math.round(raw));
      if (progress >= 1) { clearInterval(id); prev.current = target; }
    }, 16);
    return () => clearInterval(id);
  }, [target, duration, decimals]);
  return value;
}

interface ServiceCost { cost: number; calls: number; }
interface CostData { totalCost: number; services: Record<string, ServiceCost>; }
interface BudgetData { services: Record<string, { spent: number; budget: number }>; }
interface PlanBudgets { budget_ai: number; budget_sms: number; budget_voice: number; }
interface PricingData { plans?: Record<string, PlanBudgets>; [key: string]: unknown; }

export default function SentinelCosts() {
  const [todayCosts, setTodayCosts] = useState<CostData | null>(null);
  const [monthCosts, setMonthCosts] = useState<CostData | null>(null);
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [cache, setCache] = useState<CacheStats | null>(null);
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [aiStats, setAiStats] = useState<AIStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [nexusRes, cacheRes, pricingRes, aiRes] = await Promise.allSettled([
          nexusApi.get<Record<string, unknown>>('/nexus/dashboard'),
          nexusApi.get<{ data?: CacheStats } | CacheStats>('/optimization/cache/stats'),
          nexusApi.get<{ data?: PricingData } | PricingData>('/optimization/pricing'),
          nexusApi.get<{ data?: AIStats }>('/optimization/ai-stats'),
        ]);

        if (nexusRes.status === 'fulfilled') {
          const nexusData = nexusRes.value;
          const cb = nexusData.costBreakdown as Record<string, number> | undefined;
          const aiCost = cb?.anthropic || 0;
          const smsCost = cb?.twilio_sms || 0;
          const voiceCost = cb?.twilio_voice || 0;
          const emailCost = cb?.email || 0;
          const summary = nexusData.summary as Record<string, number> | undefined;
          const totalCalls = summary?.totalCalls || 0;

          setMonthCosts({
            totalCost: aiCost + smsCost + voiceCost + emailCost,
            services: {
              claude: { cost: aiCost, calls: totalCalls },
              twilio_sms: { cost: smsCost, calls: 0 },
              twilio_voice: { cost: voiceCost, calls: 0 },
              email: { cost: emailCost, calls: 0 },
            }
          });

          const todayData = nexusData.todayCosts as Record<string, number> | undefined;
          if (todayData) {
            setTodayCosts({
              totalCost: todayData.total || 0,
              services: {
                claude: { cost: todayData.anthropic || 0, calls: 0 },
                twilio_sms: { cost: 0, calls: 0 },
                twilio_voice: { cost: 0, calls: 0 },
                email: { cost: 0, calls: 0 },
              }
            });
          } else {
            setTodayCosts({ totalCost: 0, services: {} });
          }

          // Budgets depuis pricing API (source unique de vérité)
          const totalTenants = (nexusData.summary as Record<string, number>)?.totalTenants || 1;
          const baseBudgets = { ai: 30, sms: 40, voice: 15 };
          setBudget({
            services: {
              claude: { spent: aiCost, budget: baseBudgets.ai * totalTenants },
              twilio_sms: { spent: smsCost, budget: baseBudgets.sms * totalTenants },
              twilio_voice: { spent: voiceCost, budget: baseBudgets.voice * totalTenants },
            }
          });
        }

        if (cacheRes.status === 'fulfilled') {
          const cacheData = cacheRes.value;
          setCache((cacheData as { data?: CacheStats }).data ?? cacheData as CacheStats);
        }
        if (pricingRes.status === 'fulfilled') {
          const pricingData = pricingRes.value;
          const pricingParsed = (pricingData as { data?: PricingData }).data ?? pricingData as PricingData;
          setPricing(pricingParsed);

          // Mettre à jour les budgets avec les données réelles du pricing API
          if (pricingParsed.plans && nexusRes.status === 'fulfilled') {
            const businessPlan = (pricingParsed.plans as Record<string, PlanBudgets>).business;
            if (businessPlan) {
              const nexusData = nexusRes.value;
              const totalTenants = (nexusData.summary as Record<string, number>)?.totalTenants || 1;
              const cb = nexusData.costBreakdown as Record<string, number> | undefined;
              setBudget({
                services: {
                  claude: { spent: cb?.anthropic || 0, budget: businessPlan.budget_ai * totalTenants },
                  twilio_sms: { spent: cb?.twilio_sms || 0, budget: businessPlan.budget_sms * totalTenants },
                  twilio_voice: { spent: cb?.twilio_voice || 0, budget: businessPlan.budget_voice * totalTenants },
                }
              });
            }
          }
        }
        if (aiRes.status === 'fulfilled') {
          const aiData = aiRes.value;
          setAiStats((aiData as { data?: AIStats }).data ?? aiData as unknown as AIStats);
        }
      } catch (err) {
        console.error('[SentinelCosts] Error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
    const id = setInterval(fetchAll, 30000);
    return () => clearInterval(id);
  }, []);

  if (loading) return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-28 bg-slate-900 rounded-lg animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  );

  const allServices = ['claude', 'twilio_sms', 'twilio_voice'];
  const serviceLabels: Record<string, string> = {
    claude: 'Anthropic Claude', twilio_sms: 'Twilio SMS', twilio_voice: 'Twilio Voice',
  };
  const serviceDescs: Record<string, string> = {
    claude: 'Conversations IA, outils, analyse de texte',
    twilio_sms: 'SMS de rappel et notifications',
    twilio_voice: 'Appels telephoniques et WhatsApp',
  };
  const serviceColors: Record<string, string> = {
    claude: 'bg-purple-500', twilio_sms: 'bg-blue-500', twilio_voice: 'bg-cyan-500',
  };
  const services = allServices;

  const todayTotal = todayCosts?.totalCost ?? 0;
  const monthTotal = monthCosts?.totalCost ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AnimatedKpiCard label="Cout aujourd'hui" value={todayTotal} suffix="€" decimals={4} color="cyan" desc="Depenses du jour en cours" index={0} />
        <AnimatedKpiCard label="Cout du mois" value={monthTotal} suffix="€" decimals={4} color="blue" desc="Cumul depuis le 1er du mois" index={1} />
        <AnimatedKpiCard label="Fichiers en cache" value={cache?.totalFiles ?? cache?.hits ?? 0} suffix="" decimals={0} color="green" desc="Fichiers mis en cache" index={2} />
        <AnimatedKpiCard label="Taille cache" value={parseFloat(cache?.totalSizeMB ?? '0')} suffix="MB" decimals={1} color="purple" desc="Espace utilise par le cache" index={3} />
      </div>

      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <div className="text-sm font-medium text-white mb-1">Budget par service</div>
        <div className="text-[10px] text-slate-600 mb-4">Chaque service a un budget mensuel. La barre montre le % consomme.</div>
        <div className="space-y-3">
          {services.map((svc, i) => {
            const budgetInfo = budget?.services?.[svc];
            const spent = budgetInfo?.spent ?? 0;
            const limit = budgetInfo?.budget ?? 150;
            const pct = limit > 0 ? Math.min((typeof spent === 'number' ? spent : 0) / limit * 100, 100) : 0;

            return (
              <AnimatedBudgetRow
                key={svc}
                label={serviceLabels[svc]}
                desc={serviceDescs[svc]}
                spent={typeof spent === 'number' ? spent : 0}
                limit={limit}
                pct={pct}
                color={serviceColors[svc]}
                index={i}
              />
            );
          })}
        </div>
      </div>

      {aiStats && <AIOptimizationSection stats={aiStats} />}

      {pricing && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <div className="text-sm font-medium text-white mb-1">Grille tarifaire des services</div>
          <div className="text-[10px] text-slate-600 mb-3">Prix unitaires factures par les fournisseurs externes</div>
          <div className="grid md:grid-cols-2 gap-3">
            <PricingCard title="Claude IA" items={
              (pricing as Record<string, Record<string, Record<string, number>>>).anthropic
                ? Object.entries((pricing as Record<string, Record<string, Record<string, number>>>).anthropic).map(([model, prices]) => ({
                    label: model.charAt(0).toUpperCase() + model.slice(1),
                    price: `${prices.input_per_1m}€ / 1M tokens entree`
                  }))
                : [{ label: 'Haiku', price: '0.25€ / 1M tokens' }]
            } />
            <PricingCard title="Twilio" items={
              (pricing as Record<string, Record<string, number>>).twilio
                ? [
                    { label: 'SMS sortant (FR)', price: `${(pricing as Record<string, Record<string, number>>).twilio.sms_outbound_fr}€ / SMS` },
                    { label: 'SMS entrant', price: `${(pricing as Record<string, Record<string, number>>).twilio.sms_inbound}€ / SMS` },
                    { label: 'Appel vocal', price: `${(pricing as Record<string, Record<string, number>>).twilio.voice_per_min}€ / minute` },
                  ]
                : [{ label: 'SMS', price: '0.0725€ / SMS' }]
            } />
            <PricingCard title="ElevenLabs" items={
              (pricing as Record<string, Record<string, number>>).elevenlabs
                ? [
                    { label: 'Voix Turbo', price: `${(pricing as Record<string, Record<string, number>>).elevenlabs.turbo_per_char}€ / caractere` },
                    { label: 'Voix Multilingual', price: `${(pricing as Record<string, Record<string, number>>).elevenlabs.multilingual_per_char}€ / caractere` },
                  ]
                : [{ label: 'Voix', price: '0.00015€ / char' }]
            } />
            <PricingCard title="Budgets par plan" items={
              (pricing as Record<string, Record<string, PlanBudgets>>).plans
                ? Object.entries((pricing as Record<string, Record<string, PlanBudgets>>).plans).map(([plan, p]) => ({
                    label: plan.charAt(0).toUpperCase() + plan.slice(1),
                    price: `IA ${p.budget_ai}€ | SMS ${p.budget_sms}€ | Voix ${p.budget_voice}€`
                  }))
                : [{ label: 'Business', price: 'IA 200€ | SMS 100€ | Voix 80€' }]
            } />
          </div>
        </div>
      )}
    </div>
  );
}

function AnimatedKpiCard({ label, value, suffix, decimals, color, desc, index }: {
  label: string; value: number; suffix: string; decimals: number; color: string; desc: string; index: number;
}) {
  const animated = useAnimatedNumber(value, 1200, decimals);
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), index * 100); return () => clearTimeout(t); }, [index]);

  const bg: Record<string, string> = { cyan: 'border-cyan-800 bg-cyan-950/30', blue: 'border-blue-800 bg-blue-950/30', green: 'border-green-800 bg-green-950/30', purple: 'border-purple-800 bg-purple-950/30' };
  const text: Record<string, string> = { cyan: 'text-cyan-400', blue: 'text-blue-400', green: 'text-green-400', purple: 'text-purple-400' };

  return (
    <div className={`p-3 rounded-lg border ${bg[color]} transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={`text-lg font-bold font-mono ${text[color]}`}>
        {decimals > 0 ? animated.toFixed(decimals) : animated}{suffix}
      </div>
      <div className="text-[9px] text-slate-600 mt-0.5">{desc}</div>
    </div>
  );
}

function AnimatedBudgetRow({ label, desc, spent, limit, pct, color, index }: {
  label: string; desc: string; spent: number; limit: number; pct: number; color: string; index: number;
}) {
  const [w, setW] = useState(0);
  const [visible, setVisible] = useState(false);
  const animatedSpent = useAnimatedNumber(spent, 1000, 4);

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), index * 80);
    const t2 = setTimeout(() => setW(pct), index * 80 + 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [index, pct]);

  const barColor = pct > 80 ? 'bg-red-500' : pct > 60 ? 'bg-yellow-500' : color;
  const barGlow = pct > 80 ? 'shadow-red-500/30' : pct > 60 ? 'shadow-yellow-500/30' : '';

  return (
    <div className={`transition-all duration-500 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="text-sm text-slate-300">{label}</span>
          <span className="text-[10px] text-slate-600 ml-2">{desc}</span>
        </div>
        <div className="text-right">
          <span className="text-sm text-white font-mono">{animatedSpent.toFixed(4)}€</span>
          <span className="text-[10px] text-slate-600"> / {limit}€</span>
        </div>
      </div>
      <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} shadow-sm ${barGlow}`}
          style={{ width: `${Math.max(w, pct > 0 ? 1 : 0)}%`, transition: 'width 1.2s cubic-bezier(0.22, 1, 0.36, 1)' }}
        />
      </div>
    </div>
  );
}

function AIOptimizationSection({ stats }: { stats: AIStats }) {
  const m = stats.month;
  const haikuPct = useAnimatedNumber(m.haikuPercent, 1200, 1);
  const sonnetPct = useAnimatedNumber(m.calls > 0 ? 100 - m.haikuPercent : 0, 1200, 1);
  const savingsPct = useAnimatedNumber(m.savingsPercent, 1200, 1);

  const [barW, setBarW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setBarW(m.haikuPercent), 300); return () => clearTimeout(t); }, [m.haikuPercent]);

  const formatTokens = (n: number) => n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n > 1000 ? `${(n / 1000).toFixed(0)}K` : `${n}`;

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <div className="text-sm font-medium text-white mb-1">Optimisation IA</div>
      <div className="text-[10px] text-slate-600 mb-4">Repartition des modeles et economies realisees ce mois</div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-slate-800/40 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-500">Appels total</div>
          <div className="text-base font-bold text-white font-mono">{m.calls}</div>
        </div>
        <div className="bg-slate-800/40 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-500">Cout moyen / appel</div>
          <div className="text-base font-bold text-cyan-400 font-mono">{m.avgCostPerCall.toFixed(4)}€</div>
        </div>
        <div className="bg-slate-800/40 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-500">Tokens consommes</div>
          <div className="text-base font-bold text-slate-300 font-mono">{formatTokens(m.tokensTotal)}</div>
        </div>
        <div className="bg-slate-800/40 rounded-lg p-2.5">
          <div className="text-[10px] text-slate-500">Economies</div>
          <div className="text-base font-bold text-emerald-400 font-mono">{m.savings.toFixed(2)}€</div>
          <div className="text-[9px] text-emerald-600">-{savingsPct.toFixed(0)}% vs tout-Sonnet</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-xs text-slate-400">Repartition Haiku / Sonnet</div>
          <div className="text-[10px] text-slate-500 font-mono">
            <span className="text-amber-400">{m.callsHaiku}</span> Haiku
            <span className="text-slate-600 mx-1">|</span>
            <span className="text-purple-400">{m.callsSonnet}</span> Sonnet
          </div>
        </div>
        <div className="h-4 bg-slate-800 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-l-full flex items-center justify-center"
            style={{ width: `${Math.max(barW, m.callsHaiku > 0 ? 8 : 0)}%`, transition: 'width 1.2s cubic-bezier(0.22, 1, 0.36, 1)' }}
          >
            {m.haikuPercent >= 15 && <span className="text-[9px] font-bold text-amber-900">{haikuPct.toFixed(0)}%</span>}
          </div>
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-r-full flex items-center justify-center flex-1"
          >
            {m.callsSonnet > 0 && <span className="text-[9px] font-bold text-purple-900">{sonnetPct.toFixed(0)}%</span>}
          </div>
        </div>
        <div className="flex justify-between mt-1">
          <div className="text-[9px] text-amber-600">Haiku — 0.25€/M tokens (rapide)</div>
          <div className="text-[9px] text-purple-600">Sonnet — 3€/M tokens (complexe)</div>
        </div>
      </div>

      {m.callsHaiku === 0 && m.callsSonnet === 0 && m.calls > 0 && (
        <div className="bg-slate-800/40 rounded-lg p-2.5 text-[10px] text-slate-500">
          Le tracking Haiku/Sonnet vient d'etre active. Les prochains appels seront categorises.
        </div>
      )}
    </div>
  );
}

function PricingCard({ title, items }: { title: string; items: { label: string; price: string }[] }) {
  return (
    <div className="bg-slate-800/40 rounded-lg p-3">
      <div className="text-xs font-medium text-slate-300 mb-2">{title}</div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex justify-between text-[11px]">
            <span className="text-slate-500">{item.label}</span>
            <span className="text-slate-300 font-mono">{item.price}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
