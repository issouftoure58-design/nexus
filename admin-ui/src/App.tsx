import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ErrorBoundary from './components/ErrorBoundary';
import { authApi, api } from './lib/api';
import { TenantProvider } from './contexts/TenantContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { ModuleGate } from './components/ModuleGate/ModuleGate';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Clients from './pages/Clients';
import Activites from './pages/Activites';
import Agenda from './pages/Agenda';
import Services from './pages/Services';
import Comptabilite from './pages/Comptabilite';
import Stock from './pages/Stock';
import Parametres from './pages/Parametres';
import Subscription from './pages/Subscription';
import { Home } from './pages/Home';
import Onboarding from './pages/Onboarding';

// New Layout
import { AppLayout } from './components/layout/AppLayout';

// Existing pages
import SegmentsPage from './pages/Segments';
import WorkflowsPage from './pages/Workflows';
import PipelinePage from './pages/Pipeline';
import DevisPage from './pages/Devis';
import PrestationsPage from './pages/Prestations';
import SEODashboard from './pages/SEODashboard';
import SEOArticles from './pages/SEOArticles';
// Analytics est maintenant intégré dans Sentinel
import ChurnPrevention from './pages/ChurnPrevention';
import RH from './pages/RH';
import Sentinel from './pages/Sentinel';
import IAAdmin from './pages/IAAdmin';
import IATelephone from './pages/IATelephone';
import IAWhatsApp from './pages/IAWhatsApp';

// Helper pour récupérer le token du tenant actuel
function getCurrentToken(): string | null {
  const currentTenant = localStorage.getItem('nexus_current_tenant');
  if (currentTenant) {
    return localStorage.getItem(`nexus_admin_token_${currentTenant}`);
  }
  // Fallback ancien système
  return localStorage.getItem('nexus_admin_token');
}

// Auth guard component
function PrivateRoute({ children }: { children: React.ReactNode }) {
  // DEMO_MODE désactivé - authentification réelle requise
  const DEMO_MODE = false;

  const token = getCurrentToken();

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
    api.clearToken();
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Module-protected route component
interface ModuleRouteProps {
  children: React.ReactNode;
  module?: string;
  moduleTitle?: string;
  moduleDescription?: string;
}

function ModuleRoute({ children, module, moduleTitle, moduleDescription }: ModuleRouteProps) {
  return (
    <PrivateRoute>
      <AppLayout>
        {module ? (
          <ModuleGate module={module} moduleTitle={moduleTitle} moduleDescription={moduleDescription}>
            {children}
          </ModuleGate>
        ) : (
          children
        )}
      </AppLayout>
    </PrivateRoute>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <TenantProvider>
        <ProfileProvider>
        <div className="min-h-screen bg-white dark:bg-gray-950">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>} />

            {/* Routes de base - toujours accessibles */}
            <Route path="/" element={<ModuleRoute><Home /></ModuleRoute>} />
            <Route path="/dashboard-old" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/clients" element={<ModuleRoute><Clients /></ModuleRoute>} />
            <Route path="/services" element={<ModuleRoute><Services /></ModuleRoute>} />
            <Route path="/parametres" element={<ModuleRoute><Parametres /></ModuleRoute>} />
            <Route path="/subscription" element={<ModuleRoute><Subscription /></ModuleRoute>} />

            {/* Agenda - RDV business de l'entrepreneur */}
            <Route path="/agenda" element={<ModuleRoute moduleTitle="Agenda" moduleDescription="Gérez vos rendez-vous business"><Agenda /></ModuleRoute>} />

            {/* Activités (ex-Réservations) - module requis */}
            <Route path="/activites" element={<ModuleRoute module="reservations" moduleTitle="Activités" moduleDescription="Gérez vos activités et prestations"><Activites /></ModuleRoute>} />
            <Route path="/activites/historique" element={<ModuleRoute module="reservations"><Activites /></ModuleRoute>} />
            <Route path="/activites/parametres" element={<ModuleRoute module="reservations"><Activites /></ModuleRoute>} />
            {/* Redirection ancien chemin */}
            <Route path="/reservations/*" element={<Navigate to="/activites" replace />} />

            {/* Modules Business */}
            <Route path="/comptabilite" element={<ModuleRoute module="comptabilite" moduleTitle="Comptabilité" moduleDescription="Suivi dépenses, P&L et exports"><Comptabilite /></ModuleRoute>} />
            <Route path="/stock" element={<ModuleRoute module="stock" moduleTitle="Stock & Inventaire" moduleDescription="Gestion des produits et inventaires"><Stock /></ModuleRoute>} />
            <Route path="/analytics" element={<Navigate to="/sentinel" replace />} />
            <Route path="/rh" element={<ModuleRoute module="rh" moduleTitle="RH & Planning" moduleDescription="Gestion multi-employés, planning et congés"><RH /></ModuleRoute>} />

            {/* Modules Marketing */}
            <Route path="/segments" element={<ModuleRoute module="marketing" moduleTitle="Segments CRM" moduleDescription="Segmentation clients et ciblage"><SegmentsPage /></ModuleRoute>} />
            <Route path="/workflows" element={<ModuleRoute module="marketing" moduleTitle="Workflows" moduleDescription="Automatisation marketing"><WorkflowsPage /></ModuleRoute>} />
            <Route path="/pipeline" element={<ModuleRoute module="marketing" moduleTitle="Pipeline Commercial" moduleDescription="Suivi des opportunités"><PipelinePage /></ModuleRoute>} />
            <Route path="/devis" element={<ModuleRoute module="marketing" moduleTitle="Devis" moduleDescription="Gestion des devis clients"><DevisPage /></ModuleRoute>} />
            <Route path="/prestations" element={<ModuleRoute module="reservations" moduleTitle="Prestations" moduleDescription="Suivi des prestations planifiées"><PrestationsPage /></ModuleRoute>} />
            <Route path="/churn" element={<ModuleRoute module="marketing" moduleTitle="Anti-Churn" moduleDescription="Prévention de la perte clients"><ChurnPrevention /></ModuleRoute>} />

            {/* Modules IA */}
            <Route path="/ia-admin" element={<ModuleRoute module="agent_ia_web" moduleTitle="Agent IA Web" moduleDescription="Chatbot IA 24/7 sur votre site"><IAAdmin /></ModuleRoute>} />
            <Route path="/ia-telephone" element={<ModuleRoute module="agent_ia_telephone" moduleTitle="Agent IA Telephone" moduleDescription="Assistant vocal IA pour appels entrants"><IATelephone /></ModuleRoute>} />
            <Route path="/ia-whatsapp" element={<ModuleRoute module="agent_ia_whatsapp" moduleTitle="Agent IA WhatsApp" moduleDescription="Assistant IA WhatsApp 24/7"><IAWhatsApp /></ModuleRoute>} />

            {/* Modules SEO & Système */}
            <Route path="/seo" element={<ModuleRoute module="seo" moduleTitle="SEO & Visibilité" moduleDescription="Articles IA, mots-clés et Google My Business"><SEODashboard /></ModuleRoute>} />
            <Route path="/seo/articles" element={<ModuleRoute module="seo"><SEOArticles /></ModuleRoute>} />
            <Route path="/sentinel" element={<ModuleRoute module="sentinel" moduleTitle="SENTINEL" moduleDescription="Business Intelligence et monitoring temps réel"><Sentinel /></ModuleRoute>} />

            {/* Catch all - redirect to dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        </ProfileProvider>
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
