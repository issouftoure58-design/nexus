/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

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
const Facturation = lazy(() => import('./pages/Facturation'));
const Comptabilite = lazy(() => import('./pages/Comptabilite'));
// Rapprochement, ComptesAuxiliaires, ExpertComptable → intégrés comme onglets dans Comptabilite
const Stock = lazy(() => import('./pages/Stock'));
const Parametres = lazy(() => import('./pages/Parametres'));
const Subscription = lazy(() => import('./pages/Subscription'));
const Home = lazy(() => import('./pages/Home').then(m => ({ default: m.Home })));
// Ancien onboarding supprimé — redirigé vers /configuration
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
const SignaturesPage = lazy(() => import('./pages/Signatures'));
const InstagramSetterPage = lazy(() => import('./pages/InstagramSetter'));
const QuestionnairesPage = lazy(() => import('./pages/Questionnaires'));
const QualiopiPage = lazy(() => import('./pages/Qualiopi'));
const SatisfactionPage = lazy(() => import('./pages/Satisfaction'));
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
const Commandes = lazy(() => import('./pages/Commandes'));
const OrderTracking = lazy(() => import('./pages/OrderTracking'));
const Guide = lazy(() => import('./pages/Guide'));
const AvisClients = lazy(() => import('./pages/AvisClients'));
const ReseauxSociaux = lazy(() => import('./pages/ReseauxSociaux'));
const Blog = lazy(() => import('./pages/Blog'));
const BlogArticle = lazy(() => import('./pages/BlogArticle'));
const SSOCallback = lazy(() => import('./pages/SSOCallback'));
const Configuration = lazy(() => import('./pages/Configuration'));
const Equipe = lazy(() => import('./pages/Equipe'));
const OnboardingSequences = lazy(() => import('./pages/OnboardingSequences'));

// Employee Portal (lazy)
const EmployeeLogin = lazy(() => import('./pages/employee/EmployeeLogin'));
const EmployeeSetupPassword = lazy(() => import('./pages/employee/EmployeeSetupPassword'));
const EmployeePlanning = lazy(() => import('./pages/employee/EmployeePlanning'));
const EmployeeAbsences = lazy(() => import('./pages/employee/EmployeeAbsences'));
const EmployeeBulletins = lazy(() => import('./pages/employee/EmployeeBulletins'));
const EmployeeProfil = lazy(() => import('./pages/employee/EmployeeProfil'));
import { EmployeeAuthProvider } from './contexts/EmployeeAuthContext';
import { EmployeeProtectedRoute } from './components/employee/EmployeeProtectedRoute';
import { EmployeeLayout } from './components/employee/EmployeeLayout';

// Layout
import { AppLayout } from './components/layout/AppLayout';
import CookieBanner from './components/CookieBanner';
import PWAInstallPrompt from './components/PWAInstallPrompt';

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
  return api.getToken();
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
  /** Plan minimum requis (free | basic | business) — bloque les Free sur les features IA/avancees */
  requiredPlan?: 'free' | 'basic' | 'business';
}

function ModuleRoute({ children, module, moduleTitle, moduleDescription, requiredPlan }: ModuleRouteProps) {
  return (
    <PrivateRoute>
      <AppLayout>
        {(module || requiredPlan) ? (
          <ModuleGate
            module={module}
            requiredPlan={requiredPlan}
            moduleTitle={moduleTitle}
            moduleDescription={moduleDescription}
          >
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
            <Route path="/sso/callback" element={<SSOCallback />} />
            <Route path="/suivi/:token" element={<OrderTracking />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:slug" element={<BlogArticle />} />
            <Route path="/onboarding" element={<Navigate to="/configuration" replace />} />
            <Route path="/configuration" element={<PrivateRoute skipOnboarding><Configuration /></PrivateRoute>} />

            {/* Routes de base - toujours accessibles */}
            <Route path="/" element={<ModuleRoute><Home /></ModuleRoute>} />
            <Route path="/dashboard-old" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/clients" element={<ModuleRoute><Clients /></ModuleRoute>} />
            <Route path="/services" element={<ModuleRoute><Services /></ModuleRoute>} />
            <Route path="/equipe" element={<ModuleRoute moduleTitle="Equipe" moduleDescription="Gerez les membres de votre equipe"><Equipe /></ModuleRoute>} />
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

            {/* Facturation (Starter) */}
            <Route path="/facturation" element={<ModuleRoute module="facturation" moduleTitle="Facturation" moduleDescription="Factures, dépenses et relances"><Facturation /></ModuleRoute>} />

            {/* Modules Business */}
            <Route path="/comptabilite" element={<ModuleRoute module="comptabilite" moduleTitle="Comptabilité" moduleDescription="Résultat, bilan, rapprochement, auxiliaires et exports"><Comptabilite /></ModuleRoute>} />
            {/* Redirections anciennes routes comptabilité → onglets */}
            <Route path="/rapprochement" element={<Navigate to="/comptabilite?tab=rapprochement" replace />} />
            <Route path="/auxiliaires" element={<Navigate to="/comptabilite?tab=auxiliaires" replace />} />
            <Route path="/expert-comptable" element={<Navigate to="/comptabilite?tab=expert" replace />} />
            <Route path="/commandes" element={<ModuleRoute module="ecommerce" moduleTitle="Commandes" moduleDescription="Gestion des commandes"><Commandes /></ModuleRoute>} />
            <Route path="/stock" element={<ModuleRoute module="stock" moduleTitle="Stock & Inventaire" moduleDescription="Gestion des produits et inventaires"><Stock /></ModuleRoute>} />
            <Route path="/analytics" element={<ModuleRoute module="analytics" moduleTitle="Comptabilité Analytique" moduleDescription="Rentabilité, marges et seuil de rentabilité"><Analytics /></ModuleRoute>} />
            <Route path="/rh" element={<ModuleRoute requiredPlan="business" module="rh" moduleTitle="RH & Planning" moduleDescription="Gestion multi-employés, planning et congés"><RH /></ModuleRoute>} />

            {/* Modules Marketing — verrouilles Basic+ (Free tier bloque sur features IA) */}
            <Route path="/segments" element={<ModuleRoute requiredPlan="basic" module="marketing" moduleTitle="Segments CRM" moduleDescription="Segmentation clients et ciblage"><SegmentsPage /></ModuleRoute>} />
            <Route path="/workflows" element={<ModuleRoute requiredPlan="basic" module="marketing" moduleTitle="Workflows" moduleDescription="Automatisation marketing"><WorkflowsPage /></ModuleRoute>} />
            <Route path="/pipeline" element={<ModuleRoute requiredPlan="basic" module="pipeline" moduleTitle="Pipeline Commercial" moduleDescription="Suivi des opportunités"><PipelinePage /></ModuleRoute>} />
            <Route path="/devis" element={<ModuleRoute requiredPlan="basic" module="devis" moduleTitle="Devis" moduleDescription="Gestion des devis clients"><DevisPage /></ModuleRoute>} />
            <Route path="/prestations" element={<ModuleRoute module="reservations" moduleTitle="Prestations" moduleDescription="Suivi des prestations planifiées"><PrestationsPage /></ModuleRoute>} />
            <Route path="/campagnes" element={<ModuleRoute requiredPlan="basic" module="marketing" moduleTitle="Campagnes" moduleDescription="Campagnes marketing email, SMS et push"><CampagnesPage /></ModuleRoute>} />
            <Route path="/email-templates" element={<ModuleRoute requiredPlan="basic" module="marketing" moduleTitle="Templates Email" moduleDescription="Modèles email réutilisables"><EmailTemplatesPage /></ModuleRoute>} />
            <Route path="/marketing-analytics" element={<ModuleRoute requiredPlan="basic" module="marketing" moduleTitle="Analytics Marketing" moduleDescription="Performance des campagnes marketing"><MarketingAnalyticsPage /></ModuleRoute>} />
            <Route path="/churn" element={<ModuleRoute requiredPlan="basic" module="marketing" moduleTitle="Anti-Churn" moduleDescription="Prévention de la perte clients"><ChurnPrevention /></ModuleRoute>} />
            <Route path="/fidelite" element={<ModuleRoute moduleTitle="Programme Fidélité" moduleDescription="Gestion des points et récompenses clients"><Fidelite /></ModuleRoute>} />
            <Route path="/waitlist" element={<ModuleRoute moduleTitle="Liste d'attente" moduleDescription="Gestion des créneaux en attente"><Waitlist /></ModuleRoute>} />
            <Route path="/avis-clients" element={<ModuleRoute moduleTitle="Avis Clients" moduleDescription="Moderation des avis clients"><AvisClients /></ModuleRoute>} />
            <Route path="/reseaux-sociaux" element={<ModuleRoute requiredPlan="basic" module="marketing" moduleTitle="Reseaux Sociaux" moduleDescription="Connectez vos comptes Facebook et Instagram"><ReseauxSociaux /></ModuleRoute>} />
            <Route path="/onboarding-sequences" element={<ModuleRoute requiredPlan="basic" module="marketing" moduleTitle="Onboarding" moduleDescription="Suivi des sequences d'onboarding post-paiement"><OnboardingSequences /></ModuleRoute>} />
            <Route path="/guide" element={<ModuleRoute moduleTitle="Mode d'emploi" moduleDescription="Guide d'utilisation de la plateforme"><Guide /></ModuleRoute>} />

            {/* Modules IA — verrouilles Basic+ (necessitent des credits) */}
            <Route path="/ia-admin" element={<ModuleRoute requiredPlan="basic" module="agent_ia_web" moduleTitle="Agent IA Web" moduleDescription="Chatbot IA 24/7 sur votre site"><IAAdmin /></ModuleRoute>} />
            <Route path="/ia-telephone" element={<ModuleRoute requiredPlan="basic" module="telephone" moduleTitle="Agent IA Telephone" moduleDescription="Assistant vocal IA pour appels entrants"><IATelephone /></ModuleRoute>} />
            <Route path="/ia-whatsapp" element={<ModuleRoute requiredPlan="basic" module="whatsapp" moduleTitle="Agent IA WhatsApp" moduleDescription="Assistant IA WhatsApp 24/7"><IAWhatsApp /></ModuleRoute>} />
            <Route path="/signatures" element={<ModuleRoute requiredPlan="basic" module="pipeline" moduleTitle="Signatures" moduleDescription="Signatures électroniques Yousign"><SignaturesPage /></ModuleRoute>} />
            <Route path="/instagram-setter" element={<ModuleRoute requiredPlan="basic" module="marketing" moduleTitle="Setter IA Instagram" moduleDescription="Qualification automatique via DMs Instagram"><InstagramSetterPage /></ModuleRoute>} />
            <Route path="/questionnaires" element={<ModuleRoute requiredPlan="basic" module="marketing" moduleTitle="Questionnaires" moduleDescription="Formulaires de qualification avec scoring"><QuestionnairesPage /></ModuleRoute>} />
            <Route path="/qualiopi" element={<ModuleRoute requiredPlan="basic" module="pipeline" moduleTitle="Conformite Qualiopi" moduleDescription="Checklist documentaire par apprenant"><QualiopiPage /></ModuleRoute>} />
            <Route path="/satisfaction" element={<ModuleRoute requiredPlan="basic" module="pipeline" moduleTitle="Satisfaction" moduleDescription="Enquetes a chaud et a froid"><SatisfactionPage /></ModuleRoute>} />

            {/* Modules SEO & Système — verrouilles Basic+ */}
            <Route path="/seo" element={<ModuleRoute requiredPlan="basic" module="seo" moduleTitle="SEO & Visibilité" moduleDescription="Articles IA, mots-clés et Google My Business"><SEODashboard /></ModuleRoute>} />
            <Route path="/seo/articles" element={<ModuleRoute requiredPlan="basic" module="seo"><SEOArticles /></ModuleRoute>} />
            <Route path="/sentinel" element={<ModuleRoute module="sentinel" moduleTitle="SENTINEL" moduleDescription="Business Intelligence et monitoring temps réel"><Sentinel /></ModuleRoute>} />

            {/* Superadmin NEXUS routes */}
            <Route path="/nexus/login" element={<NexusLogin />} />
            <Route path="/nexus/dashboard" element={<NexusProtectedRoute><NexusDashboard /></NexusProtectedRoute>} />
            <Route path="/nexus/tenants" element={<NexusProtectedRoute><NexusTenants /></NexusProtectedRoute>} />
            <Route path="/nexus/sentinel/:tab?" element={<NexusProtectedRoute><NexusSentinel /></NexusProtectedRoute>} />
            <Route path="/nexus/billing" element={<NexusProtectedRoute><NexusBilling /></NexusProtectedRoute>} />
            <Route path="/nexus/settings" element={<NexusProtectedRoute><NexusSettings /></NexusProtectedRoute>} />
            <Route path="/nexus" element={<Navigate to="/nexus/dashboard" replace />} />

            {/* Employee Portal routes */}
            <Route path="/employee/login" element={<EmployeeAuthProvider><EmployeeLogin /></EmployeeAuthProvider>} />
            <Route path="/employee/setup-password" element={<EmployeeAuthProvider><EmployeeSetupPassword /></EmployeeAuthProvider>} />
            <Route path="/employee" element={<EmployeeAuthProvider><EmployeeProtectedRoute><EmployeeLayout /></EmployeeProtectedRoute></EmployeeAuthProvider>}>
              <Route index element={<Navigate to="/employee/planning" replace />} />
              <Route path="planning" element={<EmployeePlanning />} />
              <Route path="conges" element={<EmployeeAbsences />} />
              <Route path="bulletins" element={<EmployeeBulletins />} />
              <Route path="profil" element={<EmployeeProfil />} />
            </Route>

            {/* Catch all - redirect to dashboard */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
          <CookieBanner />
          <PWAInstallPrompt />
        </div>
        </ProfileProvider>
      </TenantProvider>
    </ErrorBoundary>
  );
}

export default App;
