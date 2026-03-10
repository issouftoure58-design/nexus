import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ErrorBoundary from './components/ErrorBoundary';
import { authApi, api } from './lib/api';
import { TenantProvider, useTenantContext } from './contexts/TenantContext';
import { ProfileProvider } from './contexts/ProfileContext';
import { ModuleGate } from './components/ModuleGate/ModuleGate';

// Login/Signup restent statiques (premier écran)
import Login from './pages/Login';
import Signup from './pages/Signup';

// Superadmin NEXUS (lazy)
const NexusLogin = lazy(() => import('./pages/nexus/NexusLogin'));
const NexusDashboard = lazy(() => import('./pages/nexus/NexusDashboard'));
const NexusTenants = lazy(() => import('./pages/nexus/NexusTenants'));
const NexusSentinel = lazy(() => import('./pages/nexus/NexusSentinel'));
const NexusBilling = lazy(() => import('./pages/nexus/NexusBilling'));
const NexusSettings = lazy(() => import('./pages/nexus/NexusSettings'));
import NexusProtectedRoute from './components/nexus/NexusProtectedRoute';

// Lazy-loaded pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clients = lazy(() => import('./pages/Clients'));
const Activites = lazy(() => import('./pages/Activites'));
const Agenda = lazy(() => import('./pages/Agenda'));
const Services = lazy(() => import('./pages/Services'));
const Comptabilite = lazy(() => import('./pages/Comptabilite'));
const Rapprochement = lazy(() => import('./pages/Rapprochement'));
const ComptesAuxiliaires = lazy(() => import('./pages/ComptesAuxiliaires'));
const ExpertComptable = lazy(() => import('./pages/ExpertComptable'));
const Stock = lazy(() => import('./pages/Stock'));
const Parametres = lazy(() => import('./pages/Parametres'));
const Subscription = lazy(() => import('./pages/Subscription'));
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const SegmentsPage = lazy(() => import('./pages/Segments'));
const WorkflowsPage = lazy(() => import('./pages/Workflows'));
const PipelinePage = lazy(() => import('./pages/Pipeline'));
const DevisPage = lazy(() => import('./pages/Devis'));
const PrestationsPage = lazy(() => import('./pages/Prestations'));
const SEODashboard = lazy(() => import('./pages/SEODashboard'));
const SEOArticles = lazy(() => import('./pages/SEOArticles'));
const Analytics = lazy(() => import('./pages/Analytics'));
const ChurnPrevention = lazy(() => import('./pages/ChurnPrevention'));
const CampagnesPage = lazy(() => import('./pages/Campagnes'));
const EmailTemplatesPage = lazy(() => import('./pages/EmailTemplates'));
const MarketingAnalyticsPage = lazy(() => import('./pages/MarketingAnalytics'));
const RH = lazy(() => import('./pages/RH'));
const Sentinel = lazy(() => import('./pages/Sentinel'));
const IAAdmin = lazy(() => import('./pages/IAAdmin'));
const IATelephone = lazy(() => import('./pages/IATelephone'));
const IAWhatsApp = lazy(() => import('./pages/IAWhatsApp'));
const Menu = lazy(() => import('./pages/Menu'));
const FloorPlan = lazy(() => import('./pages/FloorPlan'));
const RoomCalendar = lazy(() => import('./pages/RoomCalendar'));
const TarifsSaisonniers = lazy(() => import('./pages/TarifsSaisonniers'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const AcceptInvite = lazy(() => import('./pages/AcceptInvite'));
const Disponibilites = lazy(() => import('./pages/Disponibilites'));
const CGV = lazy(() => import('./pages/CGV'));
const Fidelite = lazy(() => import('./pages/Fidelite'));
const Waitlist = lazy(() => import('./pages/Waitlist'));
const Guide = lazy(() => import('./pages/Guide'));
const Configuration = lazy(() => import('./pages/Configuration'));

// Layout
import { AppLayout } from './components/layout/AppLayout';

// Page loader for Suspense fallback
function PageLoader() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

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
function PrivateRoute({ children, skipOnboarding }: { children: React.ReactNode; skipOnboarding?: boolean }) {
  const token = getCurrentToken();
  const { onboardingCompleted, isLoading: tenantLoading, tenant } = useTenantContext();

  const { isLoading, isError } = useQuery({
    queryKey: ['auth-verify'],
    queryFn: authApi.verify,
    enabled: !!token,
    retry: false,
  });

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading || tenantLoading) {
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

  // Rediriger vers configuration (nouveau flow) ou onboarding (ancien flow)
  // seulement si les données tenant sont chargées et que l'onboarding n'est pas fait
  if (!skipOnboarding && tenant && !onboardingCompleted) {
    // Nouveau flow: tenants avec template_id → /configuration
    // Ancien flow: tenants sans template_id → /onboarding (rétrocompatibilité)
    const hasTemplate = !!(tenant as any).template_id;
    return <Navigate to={hasTemplate ? '/configuration' : '/onboarding'} replace />;
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
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/cgv" element={<CGV />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />
            <Route path="/onboarding" element={<PrivateRoute skipOnboarding><Onboarding /></PrivateRoute>} />
            <Route path="/configuration" element={<PrivateRoute skipOnboarding><Configuration /></PrivateRoute>} />

            {/* Routes de base - toujours accessibles */}
            <Route path="/" element={<ModuleRoute><Home /></ModuleRoute>} />
            <Route path="/dashboard-old" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/clients" element={<ModuleRoute><Clients /></ModuleRoute>} />
            <Route path="/services" element={<ModuleRoute><Services /></ModuleRoute>} />
            <Route path="/disponibilites" element={<ModuleRoute module="reservations" moduleTitle="Disponibilites" moduleDescription="Horaires d'ouverture et periodes de fermeture"><Disponibilites /></ModuleRoute>} />
            <Route path="/menu" element={<ModuleRoute module="reservations" moduleTitle="Menu" moduleDescription="Gestion des plats et menus du jour"><Menu /></ModuleRoute>} />
            <Route path="/salle" element={<ModuleRoute module="reservations" moduleTitle="Plan de salle" moduleDescription="Vue des tables et réservations"><FloorPlan /></ModuleRoute>} />
            <Route path="/chambres" element={<ModuleRoute module="reservations" moduleTitle="Calendrier Chambres" moduleDescription="Vue d'occupation des chambres"><RoomCalendar /></ModuleRoute>} />
            <Route path="/tarifs" element={<ModuleRoute module="reservations" moduleTitle="Tarifs Saisonniers" moduleDescription="Gestion des tarifs selon les saisons"><TarifsSaisonniers /></ModuleRoute>} />
            <Route path="/parametres" element={<ModuleRoute><Parametres /></ModuleRoute>} />
            <Route path="/audit-log" element={<ModuleRoute><AuditLog /></ModuleRoute>} />
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
            <Route path="/rapprochement" element={<ModuleRoute module="comptabilite" moduleTitle="Rapprochement Bancaire" moduleDescription="Rapprochement des écritures bancaires"><Rapprochement /></ModuleRoute>} />
            <Route path="/auxiliaires" element={<ModuleRoute module="comptabilite" moduleTitle="Comptes Auxiliaires" moduleDescription="Balance clients, fournisseurs et personnel"><ComptesAuxiliaires /></ModuleRoute>} />
            <Route path="/expert-comptable" element={<ModuleRoute module="comptabilite" moduleTitle="Expert-Comptable" moduleDescription="Journaux, grand livre, balance et exports"><ExpertComptable /></ModuleRoute>} />
            <Route path="/stock" element={<ModuleRoute module="stock" moduleTitle="Stock & Inventaire" moduleDescription="Gestion des produits et inventaires"><Stock /></ModuleRoute>} />
            <Route path="/analytics" element={<ModuleRoute module="analytics" moduleTitle="Comptabilité Analytique" moduleDescription="Rentabilité, marges et seuil de rentabilité"><Analytics /></ModuleRoute>} />
            <Route path="/rh" element={<ModuleRoute module="rh" moduleTitle="RH & Planning" moduleDescription="Gestion multi-employés, planning et congés"><RH /></ModuleRoute>} />

            {/* Modules Marketing */}
            <Route path="/segments" element={<ModuleRoute module="marketing" moduleTitle="Segments CRM" moduleDescription="Segmentation clients et ciblage"><SegmentsPage /></ModuleRoute>} />
            <Route path="/workflows" element={<ModuleRoute module="marketing" moduleTitle="Workflows" moduleDescription="Automatisation marketing"><WorkflowsPage /></ModuleRoute>} />
            <Route path="/pipeline" element={<ModuleRoute module="marketing" moduleTitle="Pipeline Commercial" moduleDescription="Suivi des opportunités"><PipelinePage /></ModuleRoute>} />
            <Route path="/devis" element={<ModuleRoute module="marketing" moduleTitle="Devis" moduleDescription="Gestion des devis clients"><DevisPage /></ModuleRoute>} />
            <Route path="/prestations" element={<ModuleRoute module="reservations" moduleTitle="Prestations" moduleDescription="Suivi des prestations planifiées"><PrestationsPage /></ModuleRoute>} />
            <Route path="/campagnes" element={<ModuleRoute module="marketing" moduleTitle="Campagnes" moduleDescription="Campagnes marketing email, SMS et push"><CampagnesPage /></ModuleRoute>} />
            <Route path="/email-templates" element={<ModuleRoute module="marketing" moduleTitle="Templates Email" moduleDescription="Modèles email réutilisables"><EmailTemplatesPage /></ModuleRoute>} />
            <Route path="/marketing-analytics" element={<ModuleRoute module="marketing" moduleTitle="Analytics Marketing" moduleDescription="Performance des campagnes marketing"><MarketingAnalyticsPage /></ModuleRoute>} />
            <Route path="/churn" element={<ModuleRoute module="marketing" moduleTitle="Anti-Churn" moduleDescription="Prévention de la perte clients"><ChurnPrevention /></ModuleRoute>} />
            <Route path="/fidelite" element={<ModuleRoute moduleTitle="Programme Fidélité" moduleDescription="Gestion des points et récompenses clients"><Fidelite /></ModuleRoute>} />
            <Route path="/waitlist" element={<ModuleRoute moduleTitle="Liste d'attente" moduleDescription="Gestion des créneaux en attente"><Waitlist /></ModuleRoute>} />
            <Route path="/guide" element={<ModuleRoute moduleTitle="Mode d'emploi" moduleDescription="Guide d'utilisation de la plateforme"><Guide /></ModuleRoute>} />

            {/* Modules IA */}
            <Route path="/ia-admin" element={<ModuleRoute module="agent_ia_web" moduleTitle="Agent IA Web" moduleDescription="Chatbot IA 24/7 sur votre site"><IAAdmin /></ModuleRoute>} />
            <Route path="/ia-telephone" element={<ModuleRoute module="telephone" moduleTitle="Agent IA Telephone" moduleDescription="Assistant vocal IA pour appels entrants"><IATelephone /></ModuleRoute>} />
            <Route path="/ia-whatsapp" element={<ModuleRoute module="whatsapp" moduleTitle="Agent IA WhatsApp" moduleDescription="Assistant IA WhatsApp 24/7"><IAWhatsApp /></ModuleRoute>} />

            {/* Modules SEO & Système */}
            <Route path="/seo" element={<ModuleRoute module="seo" moduleTitle="SEO & Visibilité" moduleDescription="Articles IA, mots-clés et Google My Business"><SEODashboard /></ModuleRoute>} />
            <Route path="/seo/articles" element={<ModuleRoute module="seo"><SEOArticles /></ModuleRoute>} />
            <Route path="/sentinel" element={<ModuleRoute module="sentinel" moduleTitle="SENTINEL" moduleDescription="Business Intelligence et monitoring temps réel"><Sentinel /></ModuleRoute>} />

            {/* Superadmin NEXUS routes */}
            <Route path="/nexus/login" element={<NexusLogin />} />
            <Route path="/nexus/dashboard" element={<NexusProtectedRoute><NexusDashboard /></NexusProtectedRoute>} />
            <Route path="/nexus/tenants" element={<NexusProtectedRoute><NexusTenants /></NexusProtectedRoute>} />
            <Route path="/nexus/sentinel/:tab?" element={<NexusProtectedRoute><NexusSentinel /></NexusProtectedRoute>} />
            <Route path="/nexus/billing" element={<NexusProtectedRoute><NexusBilling /></NexusProtectedRoute>} />
            <Route path="/nexus/settings" element={<NexusProtectedRoute><NexusSettings /></NexusProtectedRoute>} />
            <Route path="/nexus" element={<Navigate to="/nexus/dashboard" replace />} />

            {/* Catch all - redirect to dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
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
