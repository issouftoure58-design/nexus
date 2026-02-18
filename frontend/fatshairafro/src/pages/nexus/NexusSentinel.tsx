import { lazy, Suspense } from 'react';
import { useParams, Redirect } from 'wouter';
import NexusLayout from '../../components/nexus/NexusLayout';

// Composants NEXUS Sentinel (lazy)
const SentinelOverview = lazy(() => import('@/components/nexus/sentinel/SentinelOverview'));
const SentinelCosts = lazy(() => import('@/components/nexus/sentinel/SentinelCosts'));
const SentinelSecurity = lazy(() => import('@/components/nexus/sentinel/SentinelSecurity'));
const SentinelIntelligence = lazy(() => import('@/components/nexus/sentinel/SentinelIntelligence'));
const SentinelAutopilot = lazy(() => import('@/components/nexus/sentinel/SentinelAutopilot'));
const SentinelBackups = lazy(() => import('@/components/nexus/sentinel/SentinelBackups'));
const SentinelConsole = lazy(() => import('@/components/SentinelConsole'));
const LivePulse = lazy(() => import('@/pages/admin/components/LivePulse'));
const CostExplainer = lazy(() => import('@/pages/admin/components/CostExplainer'));

const TAB_COMPONENTS: Record<string, React.LazyExoticComponent<any>> = {
  overview: SentinelOverview,
  live: LivePulse,
  explainer: CostExplainer,
  autopilot: SentinelAutopilot,
  costs: SentinelCosts,
  security: SentinelSecurity,
  intelligence: SentinelIntelligence,
  backups: SentinelBackups,
  console: SentinelConsole,
};

const VALID_TABS = Object.keys(TAB_COMPONENTS);
const WRAPPED_TABS = ['live', 'explainer'];

export default function NexusSentinel() {
  const params = useParams<{ tab: string }>();
  const tab = params.tab || 'overview';

  if (!VALID_TABS.includes(tab)) {
    return <Redirect to="/nexus/sentinel/overview" />;
  }

  const Component = TAB_COMPONENTS[tab];

  return (
    <NexusLayout>
      <div className="flex flex-col h-[calc(100vh-80px)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">SENTINEL</h1>
            <div className="text-[10px] text-slate-600">Centre de controle et surveillance NEXUS</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-slate-500 font-mono">Actif</span>
          </div>
        </div>

        {/* Content */}
        <div className={`flex-1 min-h-0 ${tab === 'console' ? '' : 'overflow-y-auto'}`}>
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-500 text-sm">Chargement...</div>
            </div>
          }>
            {WRAPPED_TABS.includes(tab) ? (
              <div className="bg-slate-900/30 rounded-lg border border-slate-800 p-4">
                <Component />
              </div>
            ) : (
              <Component />
            )}
          </Suspense>
        </div>
      </div>
    </NexusLayout>
  );
}
