import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ErrorBoundary from './components/ErrorBoundary';
import { authApi } from './lib/api';
import { TenantProvider } from './contexts/TenantContext';
import { ModuleGate } from './components/ModuleGate/ModuleGate';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Clients from './pages/Clients';
import Reservations from './pages/Reservations';
import Services from './pages/Services';
import Comptabilite from './pages/Comptabilite';
import Stock from './pages/Stock';
import Parametres from './pages/Parametres';
import Subscription from './pages/Subscription';

// Existing pages
import SegmentsPage from './pages/Segments';
import WorkflowsPage from './pages/Workflows';
import PipelinePage from './pages/Pipeline';
import SEODashboard from './pages/SEODashboard';
import SEOArticles from './pages/SEOArticles';
import Analytics from './pages/Analytics';
import ChurnPrevention from './pages/ChurnPrevention';
import RH from './pages/RH';

// Auth guard component
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('nexus_admin_token');

  const { isLoading, isError } = useQuery({
    queryKey: ['auth-verify'],
    queryFn: authApi.verify,
    enabled: !!token,
    retry: false,
  });

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError) {
    localStorage.removeItem('nexus_admin_token');
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <TenantProvider>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes - Tous plans */}
            <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/clients" element={<PrivateRoute><Clients /></PrivateRoute>} />
            <Route path="/reservations" element={<PrivateRoute><Reservations /></PrivateRoute>} />
            <Route path="/services" element={<PrivateRoute><Services /></PrivateRoute>} />
            <Route path="/parametres" element={<PrivateRoute><Parametres /></PrivateRoute>} />
            <Route path="/subscription" element={<PrivateRoute><Subscription /></PrivateRoute>} />

            {/* Routes Pro */}
            <Route path="/comptabilite" element={
              <PrivateRoute>
                <ModuleGate requiredPlan="pro" moduleTitle="Comptabilite" moduleDescription="Gestion comptable complete avec export">
                  <Comptabilite />
                </ModuleGate>
              </PrivateRoute>
            } />
            <Route path="/stock" element={
              <PrivateRoute>
                <ModuleGate requiredPlan="pro" moduleTitle="Gestion Stock" moduleDescription="Inventaire et gestion des produits">
                  <Stock />
                </ModuleGate>
              </PrivateRoute>
            } />
            <Route path="/analytics" element={
              <PrivateRoute>
                <ModuleGate requiredPlan="pro" moduleTitle="Analytics" moduleDescription="Tableaux de bord et statistiques avancees">
                  <Analytics />
                </ModuleGate>
              </PrivateRoute>
            } />
            <Route path="/rh" element={
              <PrivateRoute>
                <ModuleGate requiredPlan="pro" moduleTitle="Gestion RH" moduleDescription="Gestion de votre equipe et plannings">
                  <RH />
                </ModuleGate>
              </PrivateRoute>
            } />
            <Route path="/segments" element={
              <PrivateRoute>
                <ModuleGate requiredPlan="pro" moduleTitle="Segments CRM" moduleDescription="Segmentation avancee de vos clients">
                  <SegmentsPage />
                </ModuleGate>
              </PrivateRoute>
            } />
            <Route path="/workflows" element={
              <PrivateRoute>
                <ModuleGate requiredPlan="pro" moduleTitle="Workflows" moduleDescription="Automatisation marketing et processus">
                  <WorkflowsPage />
                </ModuleGate>
              </PrivateRoute>
            } />
            <Route path="/pipeline" element={
              <PrivateRoute>
                <ModuleGate requiredPlan="pro" moduleTitle="Pipeline Marketing" moduleDescription="Gestion des campagnes et prospects">
                  <PipelinePage />
                </ModuleGate>
              </PrivateRoute>
            } />
            <Route path="/ia-admin" element={
              <PrivateRoute>
                <ModuleGate requiredPlan="pro" moduleTitle="IA Admin" moduleDescription="Assistant IA pour administration">
                  <ComingSoon title="IA Admin" />
                </ModuleGate>
              </PrivateRoute>
            } />

            {/* Routes Business */}
            <Route path="/seo" element={
              <PrivateRoute>
                <ModuleGate requiredPlan="business" moduleTitle="SEO & Contenu" moduleDescription="Optimisation referencement et contenu IA">
                  <SEODashboard />
                </ModuleGate>
              </PrivateRoute>
            } />
            <Route path="/seo/articles" element={
              <PrivateRoute>
                <ModuleGate requiredPlan="business" moduleTitle="Articles SEO" moduleDescription="Generation d'articles optimises">
                  <SEOArticles />
                </ModuleGate>
              </PrivateRoute>
            } />
            <Route path="/churn" element={
              <PrivateRoute>
                <ModuleGate requiredPlan="business" moduleTitle="Anti-Churn" moduleDescription="Prevention de la perte de clients">
                  <ChurnPrevention />
                </ModuleGate>
              </PrivateRoute>
            } />
            <Route path="/sentinel" element={
              <PrivateRoute>
                <ModuleGate requiredPlan="business" moduleTitle="SENTINEL" moduleDescription="Intelligence et surveillance avancee">
                  <ComingSoon title="Sentinel" />
                </ModuleGate>
              </PrivateRoute>
            } />

            {/* Catch all - redirect to dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </TenantProvider>
    </ErrorBoundary>
  );
}

// Coming soon placeholder
function ComingSoon({ title }: { title: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
          <span className="text-white font-bold text-3xl">N</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-gray-500">Cette fonctionnalité arrive bientôt</p>
        <a href="/" className="inline-block mt-4 text-cyan-600 hover:text-cyan-700 font-medium">
          ← Retour au tableau de bord
        </a>
      </div>
    </div>
  );
}

export default App;
