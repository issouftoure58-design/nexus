/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */
import { lazy, Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import NexusLayout from '@/components/nexus/NexusLayout';

const SentinelOverview = lazy(() => import('@/components/nexus/sentinel/SentinelOverview'));
const SentinelCosts = lazy(() => import('@/components/nexus/sentinel/SentinelCosts'));
const SentinelSecurity = lazy(() => import('@/components/nexus/sentinel/SentinelSecurity'));
const SentinelIntelligence = lazy(() => import('@/components/nexus/sentinel/SentinelIntelligence'));
const SentinelAutopilot = lazy(() => import('@/components/nexus/sentinel/SentinelAutopilot'));
const SentinelBackups = lazy(() => import('@/components/nexus/sentinel/SentinelBackups'));
const SentinelErrors = lazy(() => import('@/components/nexus/sentinel/SentinelErrors'));
const SentinelLogicTests = lazy(() => import('@/components/nexus/sentinel/SentinelLogicTests'));
const SentinelProspection = lazy(() => import('@/components/nexus/sentinel/SentinelProspection'));

const TAB_COMPONENTS: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
  overview: SentinelOverview,
  autopilot: SentinelAutopilot,
  costs: SentinelCosts,
  security: SentinelSecurity,
  intelligence: SentinelIntelligence,
  backups: SentinelBackups,
  errors: SentinelErrors,
  'logic-tests': SentinelLogicTests,
  prospection: SentinelProspection,
};

const VALID_TABS = Object.keys(TAB_COMPONENTS);

export default function NexusSentinel() {
  const params = useParams<{ tab: string }>();
  const tab = params.tab || 'overview';

  if (!VALID_TABS.includes(tab)) {
    return <Navigate to="/nexus/sentinel/overview" replace />;
  }

  const Component = TAB_COMPONENTS[tab];

  return (
    <NexusLayout>
      <div className="flex flex-col h-[calc(100vh-80px)]">
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

        <div className="flex-1 min-h-0 overflow-y-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <div className="text-slate-500 text-sm">Chargement...</div>
            </div>
          }>
            <Component />
          </Suspense>
        </div>
      </div>
    </NexusLayout>
  );
}
