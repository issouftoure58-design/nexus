import { useEffect, Suspense, lazy } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { CartProvider } from "@/contexts/CartContext";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import HalimahWidget from "@/components/HalimahWidget";

// Composant de chargement pour Suspense
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// PUBLIC TENANT - Lazy loading
const HomePage = lazy(() => import("@/pages/home"));
const ServicesPage = lazy(() => import("@/pages/services"));
const AboutPage = lazy(() => import("@/pages/about"));
const ChatPage = lazy(() => import("@/pages/chat"));
const GaleriePage = lazy(() => import("@/pages/galerie"));
const PanierPage = lazy(() => import("@/pages/panier"));
const AvisPage = lazy(() => import("@/pages/avis"));

// ADMIN TENANT - Lazy loading
const AdminLogin = lazy(() => import("@/pages/admin/Login"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminServices = lazy(() => import("@/pages/admin/Services"));
const AdminDisponibilites = lazy(() => import("@/pages/admin/Disponibilites"));
const AdminClients = lazy(() => import("@/pages/admin/Clients"));
const AdminReservations = lazy(() => import("@/pages/admin/Reservations"));
const AdminCommandes = lazy(() => import("@/pages/admin/Commandes"));
const AdminParametres = lazy(() => import("@/pages/admin/Parametres"));
const AdminReviews = lazy(() => import("@/pages/admin/Reviews"));
const AdminPlanning = lazy(() => import("@/pages/admin/Planning"));
const AdminMediaGenerator = lazy(() => import("@/pages/admin/MediaGenerator"));
const AdminSocialMedia = lazy(() => import("@/pages/admin/SocialMedia"));
const AdminTeam = lazy(() => import("@/pages/admin/Team"));
const AdminAnalytics = lazy(() => import("@/pages/admin/Analytics"));
const AdminMarketing = lazy(() => import("@/pages/admin/Marketing"));
const AdminCommercial = lazy(() => import("@/pages/admin/Commercial"));
const AdminRH = lazy(() => import("@/pages/admin/RH"));
const AdminComptabilite = lazy(() => import("@/pages/admin/Comptabilite"));
const AdminSEO = lazy(() => import("@/pages/admin/SEO"));
const AdminHalimahLogs = lazy(() => import("@/pages/admin/HalimahLogs"));
const AdminChat = lazy(() => import("@/pages/admin/AdminChat"));
const AdminModules = lazy(() => import("@/pages/admin/MesModules"));
const AdminSegments = lazy(() => import("@/pages/admin/Segments"));
const AdminClientAnalytics = lazy(() => import("@/pages/admin/ClientAnalytics"));
const AdminWorkflows = lazy(() => import("@/pages/admin/Workflows"));
const AdminCampagnes = lazy(() => import("@/pages/admin/Campagnes"));
const AdminStock = lazy(() => import("@/pages/admin/Stock"));

// NEXUS Operator - Lazy loading
const NexusLogin = lazy(() => import("@/pages/nexus/NexusLogin"));
const NexusDashboard = lazy(() => import("@/pages/nexus/NexusDashboard"));
const NexusTenants = lazy(() => import("@/pages/nexus/NexusTenants"));
const NexusSentinel = lazy(() => import("@/pages/nexus/NexusSentinel"));
const NexusBilling = lazy(() => import("@/pages/nexus/NexusBilling"));
const NexusSettings = lazy(() => import("@/pages/nexus/NexusSettings"));

// CLIENT - Lazy loading
const ClientLogin = lazy(() => import("@/pages/client/Login"));
const ClientRegister = lazy(() => import("@/pages/client/Register"));
const ClientDashboard = lazy(() => import("@/pages/client/Dashboard"));
const ClientForgotPassword = lazy(() => import("@/pages/client/ForgotPassword"));
const ClientResetPassword = lazy(() => import("@/pages/client/ResetPassword"));

// WEBSITE (NEXUS vitrine) - Lazy loading
const WebsiteHome = lazy(() => import("@/pages/website/Home"));
const WebsitePricing = lazy(() => import("@/pages/website/Pricing"));
const WebsiteContact = lazy(() => import("@/pages/website/Contact"));
const Signup = lazy(() => import("@/pages/Signup"));

// LEGAL - Lazy loading
const ChartePage = lazy(() => import("@/pages/legal/Charte"));
const CGVPage = lazy(() => import("@/pages/legal/CGV"));
const ConfidentialitePage = lazy(() => import("@/pages/legal/Confidentialite"));

// Protected routes (gardes en import statique car utilises partout)
import WebsiteLayout from "@/components/website/WebsiteLayout";
import ProtectedRoute from "@/components/admin/ProtectedRoute";
import SuperAdminRoute from "@/components/admin/SuperAdminRoute";
import NexusProtectedRoute from "@/components/nexus/NexusProtectedRoute";
import ClientProtectedRoute from "@/components/client/ClientProtectedRoute";
import NotFound from "@/pages/not-found";
import ErrorBoundary from "@/components/ErrorBoundary";

// Composant pour reinitialiser le scroll en haut de page a chaque changement de route
function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);

  return null;
}

function Router() {
  const { isNexusSite } = useTenant();

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* ========== NEXUS VITRINE — Quand pas de tenant (racine = site NEXUS) ========== */}
        {isNexusSite && <Route path="/"><WebsiteLayout><WebsiteHome /></WebsiteLayout></Route>}
        {isNexusSite && <Route path="/pricing"><WebsiteLayout><WebsitePricing /></WebsiteLayout></Route>}
        {isNexusSite && <Route path="/contact"><WebsiteLayout><WebsiteContact /></WebsiteLayout></Route>}
        {isNexusSite && <Route path="/signup"><Signup /></Route>}

        {/* ========== SITE TENANT — Quand tenant detecte (racine = site du tenant) ========== */}
        {!isNexusSite && <Route path="/" component={HomePage} />}
        {!isNexusSite && <Route path="/services" component={ServicesPage} />}
        {!isNexusSite && <Route path="/a-propos" component={AboutPage} />}
        {!isNexusSite && <Route path="/galerie" component={GaleriePage} />}
        {!isNexusSite && <Route path="/reserver" component={ChatPage} />}
        {!isNexusSite && <Route path="/panier" component={PanierPage} />}
        {!isNexusSite && <Route path="/avis" component={AvisPage} />}

        {/* ========== ROUTES CLIENT (tenant) ========== */}
        <Route path="/mon-compte/connexion" component={ClientLogin} />
        <Route path="/mon-compte/inscription" component={ClientRegister} />
        <Route path="/mon-compte/mot-de-passe-oublie" component={ClientForgotPassword} />
        <Route path="/mon-compte/reinitialisation" component={ClientResetPassword} />
        <Route path="/mon-compte">
          <ClientProtectedRoute>
            <ClientDashboard />
          </ClientProtectedRoute>
        </Route>

        {/* ========== PAGES LEGALES ========== */}
        <Route path="/charte" component={ChartePage} />
        <Route path="/cgv" component={CGVPage} />
        <Route path="/confidentialite" component={ConfidentialitePage} />

        {/* ========== NEXUS OPERATOR DASHBOARD ========== */}
        <Route path="/nexus/login" component={NexusLogin} />
        <Route path="/nexus/dashboard">
          <NexusProtectedRoute><NexusDashboard /></NexusProtectedRoute>
        </Route>
        <Route path="/nexus/tenants">
          <NexusProtectedRoute><NexusTenants /></NexusProtectedRoute>
        </Route>
        <Route path="/nexus/sentinel/:tab">
          <NexusProtectedRoute><NexusSentinel /></NexusProtectedRoute>
        </Route>
        <Route path="/nexus/sentinel">
          <Redirect to="/nexus/sentinel/overview" />
        </Route>
        <Route path="/nexus/billing">
          <NexusProtectedRoute><NexusBilling /></NexusProtectedRoute>
        </Route>
        <Route path="/nexus/settings">
          <NexusProtectedRoute><NexusSettings /></NexusProtectedRoute>
        </Route>
        <Route path="/nexus">
          <Redirect to="/nexus/dashboard" />
        </Route>

        {/* ========== WEBSITE NEXUS VITRINE (alias /website/* toujours disponible) ========== */}
        <Route path="/website">
          <WebsiteLayout><WebsiteHome /></WebsiteLayout>
        </Route>
        <Route path="/website/pricing">
          <WebsiteLayout><WebsitePricing /></WebsiteLayout>
        </Route>
        <Route path="/website/contact">
          <WebsiteLayout><WebsiteContact /></WebsiteLayout>
        </Route>
        <Route path="/website/signup" component={Signup} />

        {/* ========== ADMIN TENANT DASHBOARD ========== */}
        <Route path="/admin/login" component={AdminLogin} />
        <Route path="/admin/dashboard">
          <ProtectedRoute><AdminDashboard /></ProtectedRoute>
        </Route>
        <Route path="/admin/services">
          <ProtectedRoute><AdminServices /></ProtectedRoute>
        </Route>
        <Route path="/admin/disponibilites">
          <ProtectedRoute><AdminDisponibilites /></ProtectedRoute>
        </Route>
        <Route path="/admin/clients">
          <ProtectedRoute><AdminClients /></ProtectedRoute>
        </Route>
        <Route path="/admin/clients/:clientId/analytics">
          <ProtectedRoute><AdminClientAnalytics /></ProtectedRoute>
        </Route>
        <Route path="/admin/reservations">
          <ProtectedRoute><AdminReservations /></ProtectedRoute>
        </Route>
        <Route path="/admin/commandes">
          <ProtectedRoute><AdminCommandes /></ProtectedRoute>
        </Route>
        <Route path="/admin/parametres">
          <ProtectedRoute><AdminParametres /></ProtectedRoute>
        </Route>
        <Route path="/admin/avis">
          <ProtectedRoute><AdminReviews /></ProtectedRoute>
        </Route>
        <Route path="/admin/planning">
          <ProtectedRoute><AdminPlanning /></ProtectedRoute>
        </Route>
        <Route path="/admin/media">
          <ProtectedRoute><AdminMediaGenerator /></ProtectedRoute>
        </Route>
        <Route path="/admin/social">
          <ProtectedRoute><AdminSocialMedia /></ProtectedRoute>
        </Route>
        <Route path="/admin/equipe">
          <ProtectedRoute><AdminTeam /></ProtectedRoute>
        </Route>
        <Route path="/admin/analytics">
          <ProtectedRoute><AdminAnalytics /></ProtectedRoute>
        </Route>
        <Route path="/admin/marketing">
          <ProtectedRoute><AdminMarketing /></ProtectedRoute>
        </Route>
        <Route path="/admin/workflows">
          <ProtectedRoute><AdminWorkflows /></ProtectedRoute>
        </Route>
        <Route path="/admin/campagnes">
          <ProtectedRoute><AdminCampagnes /></ProtectedRoute>
        </Route>
        <Route path="/admin/stock">
          <ProtectedRoute><AdminStock /></ProtectedRoute>
        </Route>
        <Route path="/admin/commercial">
          <ProtectedRoute><AdminCommercial /></ProtectedRoute>
        </Route>
        <Route path="/admin/rh">
          <ProtectedRoute><AdminRH /></ProtectedRoute>
        </Route>
        <Route path="/admin/comptabilite">
          <ProtectedRoute><AdminComptabilite /></ProtectedRoute>
        </Route>
        <Route path="/admin/seo">
          <ProtectedRoute><AdminSEO /></ProtectedRoute>
        </Route>
        <Route path="/admin/logs">
          <ProtectedRoute><AdminHalimahLogs /></ProtectedRoute>
        </Route>
        <Route path="/admin/modules">
          <ProtectedRoute><AdminModules /></ProtectedRoute>
        </Route>
        <Route path="/admin/chat">
          <ProtectedRoute><AdminChat /></ProtectedRoute>
        </Route>
        <Route path="/admin/segments">
          <ProtectedRoute><AdminSegments /></ProtectedRoute>
        </Route>
        <Route path="/admin/sentinel">
          <Redirect to="/nexus/sentinel/overview" />
        </Route>
        <Route path="/admin/sentinel-dashboard">
          <Redirect to="/nexus/sentinel/overview" />
        </Route>
        <Route path="/admin">
          <Redirect to="/admin/dashboard" />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// Widget Halimah : visible uniquement sur les pages tenant, jamais sur le site NEXUS
function HalimahWidgetWrapper() {
  const { tenantId } = useTenant();
  const [location] = useLocation();

  // Pas de widget sur le site NEXUS
  if (!tenantId) return null;

  // Pas de widget sur les pages admin, operateur, panier, reservation (qui a deja le chat complet)
  const hideOnPaths = ['/admin', '/nexus', '/reserver', '/mon-compte', '/panier', '/website'];
  const shouldHide = hideOnPaths.some(path => location.startsWith(path));

  if (shouldHide) return null;

  return <HalimahWidget />;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TenantProvider>
        <CartProvider>
          <TooltipProvider>
            <ScrollToTop />
            <Toaster />
            <Router />
            <HalimahWidgetWrapper />
            <PWAInstallPrompt />
          </TooltipProvider>
        </CartProvider>
        </TenantProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
