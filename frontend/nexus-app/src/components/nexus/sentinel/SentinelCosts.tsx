import { useState, useEffect, useRef } from 'react';

const authHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
});

interface CacheStats { hits: number; misses: number; size?: number; savings?: number; }

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

export default function SentinelCosts() {
  const [todayCosts, setTodayCosts] = useState<any>(null);
  const [monthCosts, setMonthCosts] = useState<any>(null);
  const [budget, setBudget] = useState<any>(null);
  const [cache, setCache] = useState<CacheStats | null>(null);
  const [pricing, setPricing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [nexusRes, cacheRes, pricingRes] = await Promise.allSettled([
          fetch('/api/nexus/dashboard', { headers: authHeaders() }),
          fetch('/api/optimization/cache/stats', { headers: authHeaders() }),
          fetch('/api/optimization/pricing', { headers: authHeaders() }),
        ]);

        if (nexusRes.status === 'fulfilled' && nexusRes.value.ok) {
          const nexusData = await nexusRes.value.json();
          const anthropicCost = nexusData.costBreakdown?.anthropic || 0;
          const twilioCost = nexusData.costBreakdown?.twilio || 0;
          const elevenlabsCost = nexusData.costBreakdown?.elevenlabs || 0;
          const totalCalls = nexusData.summary?.totalCalls || 0;
          const twilioSms = nexusData.twilioDetails?.sms?.count || 0;
          const twilioVoice = nexusData.twilioDetails?.voice?.count || 0;
          const elevenLabsChars = nexusData.elevenLabsDetails?.characters || 0;

          setMonthCosts({
            totalCost: anthropicCost + twilioCost + elevenlabsCost,
            services: {
              claude: { cost: anthropicCost, calls: totalCalls },
              elevenlabs: { cost: elevenlabsCost, calls: elevenLabsChars },
              twilio: { cost: twilioCost, calls: twilioSms + twilioVoice },
              dalle: { cost: 0, calls: 0 },
              tavily: { cost: 0, calls: 0 },
            }
          });

          const todayData = nexusData.todayCosts;
          if (todayData) {
            setTodayCosts({
              totalCost: todayData.total || 0,
              services: {
                claude: { cost: todayData.anthropic || 0, calls: 0 },
                elevenlabs: { cost: todayData.elevenlabs || 0, calls: 0 },
                twilio: { cost: todayData.twilio || 0, calls: 0 },
                dalle: { cost: 0, calls: 0 },
                tavily: { cost: 0, calls: 0 },
              }
            });
          } else {
            setTodayCosts({ totalCost: 0, services: {} });
          }

          setBudget({
            services: {
              claude: { spent: anthropicCost, budget: 150 },
              elevenlabs: { spent: elevenlabsCost, budget: 20 },
              twilio: { spent: twilioCost, budget: 80 },
              dalle: { spent: 0, budget: 30 },
              tavily: { spent: 0, budget: 10 },
            }
          });
        }

        if (cacheRes.status === 'fulfilled' && cacheRes.value.ok) {
          const cacheData = await cacheRes.value.json();
          setCache(cacheData?.data ?? cacheData);
        }
        if (pricingRes.status === 'fulfilled' && pricingRes.value.ok) {
          const pricingData = await pricingRes.value.json();
          setPricing(pricingData?.data ?? pricingData);
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

  const services = ['claude', 'elevenlabs', 'twilio', 'dalle', 'tavily'];
  const serviceLabels: Record<string, string> = {
    claude: 'Anthropic Claude', elevenlabs: 'ElevenLabs', twilio: 'Twilio',
    dalle: 'DALL-E (images)', tavily: 'Tavily (recherche)',
  };
  const serviceDescs: Record<string, string> = {
    claude: 'Conversations IA, outils, analyse de texte',
    elevenlabs: 'Synthese vocale pour Halimah',
    twilio: 'SMS de rappel, appels telephoniques, WhatsApp',
    dalle: 'Generation d\'images pour reseaux sociaux',
    tavily: 'Recherche web pour enrichir les reponses IA',
  };
  const serviceColors: Record<string, string> = {
    claude: 'bg-purple-500', elevenlabs: 'bg-cyan-500', twilio: 'bg-blue-500',
    dalle: 'bg-pink-500', tavily: 'bg-green-500',
  };

  const todayTotal = todayCosts?.totalCost ?? 0;
  const monthTotal = monthCosts?.totalCost ?? 0;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AnimatedKpiCard label="Cout aujourd'hui" value={todayTotal} suffix="€" decimals={4} color="cyan" desc="Depenses du jour en cours" index={0} />
        <AnimatedKpiCard label="Cout du mois" value={monthTotal} suffix="€" decimals={4} color="blue" desc="Cumul depuis le 1er du mois" index={1} />
        <AnimatedKpiCard label="Fichiers en cache" value={(cache as any)?.totalFiles ?? cache?.hits ?? 0} suffix="" decimals={0} color="green" desc="Fichiers mis en cache" index={2} />
        <AnimatedKpiCard label="Taille cache" value={parseFloat((cache as any)?.totalSizeMB ?? '0')} suffix="MB" decimals={1} color="purple" desc="Espace utilise par le cache" index={3} />
      </div>

      {/* Budget par service */}
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

      {/* Grille de prix */}
      {pricing && (
        <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
          <div className="text-sm font-medium text-white mb-1">Grille tarifaire des services</div>
          <div className="text-[10px] text-slate-600 mb-3">Prix unitaires factures par les fournisseurs externes</div>
          <div className="grid md:grid-cols-2 gap-3">
            <PricingCard title="Claude IA" items={[
              { label: 'Haiku (rapide)', price: '0.25€ / 1M tokens entree' },
              { label: 'Sonnet (standard)', price: '3€ / 1M tokens entree' },
              { label: 'Opus (puissant)', price: '15€ / 1M tokens entree' },
            ]} />
            <PricingCard title="Twilio" items={[
              { label: 'SMS sortant (France)', price: '0.0725€ / SMS' },
              { label: 'SMS entrant', price: '0.0075€ / SMS' },
              { label: 'Appel vocal', price: '0.015€ / minute' },
            ]} />
            <PricingCard title="ElevenLabs" items={[
              { label: 'Voix Turbo', price: '0.00015€ / caractere' },
              { label: 'Voix Multilingual', price: '0.00030€ / caractere' },
            ]} />
            <PricingCard title="Autres" items={[
              { label: 'DALL-E Standard', price: '0.04€ / image' },
              { label: 'DALL-E HD', price: '0.08€ / image' },
              { label: 'Tavily recherche', price: '0.003€ / requete' },
            ]} />
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
          style={{
            width: `${Math.max(w, pct > 0 ? 1 : 0)}%`,
            transition: 'width 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </div>
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
