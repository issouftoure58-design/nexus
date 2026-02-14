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
import { Home } from './pages/Home';

// New Layout
import { AppLayout } from './components/layout/AppLayout';

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
  // DEMO_MODE désactivé - authentification réelle requise
  const DEMO_MODE = false;

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
        <div className="min-h-screen bg-white dark:bg-gray-950">
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />

            {/* Protected routes - Tous plans - Design GitHub style avec AppLayout */}
            <Route path="/" element={<PrivateRoute><AppLayout><Home /></AppLayout></PrivateRoute>} />
            <Route path="/dashboard-old" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/clients" element={<PrivateRoute><AppLayout><Clients /></AppLayout></PrivateRoute>} />
            <Route path="/reservations" element={<PrivateRoute><AppLayout><Reservations /></AppLayout></PrivateRoute>} />
            <Route path="/services" element={<PrivateRoute><AppLayout><Services /></AppLayout></PrivateRoute>} />
            <Route path="/parametres" element={<PrivateRoute><AppLayout><Parametres /></AppLayout></PrivateRoute>} />
            <Route path="/subscription" element={<PrivateRoute><AppLayout><Subscription /></AppLayout></PrivateRoute>} />

            {/* Routes Pro */}
            <Route path="/comptabilite" element={<PrivateRoute><AppLayout><Comptabilite /></AppLayout></PrivateRoute>} />
            <Route path="/stock" element={<PrivateRoute><AppLayout><Stock /></AppLayout></PrivateRoute>} />
            <Route path="/analytics" element={<PrivateRoute><AppLayout><Analytics /></AppLayout></PrivateRoute>} />
            <Route path="/rh" element={<PrivateRoute><AppLayout><RH /></AppLayout></PrivateRoute>} />
            <Route path="/segments" element={<PrivateRoute><AppLayout><SegmentsPage /></AppLayout></PrivateRoute>} />
            <Route path="/workflows" element={<PrivateRoute><AppLayout><WorkflowsPage /></AppLayout></PrivateRoute>} />
            <Route path="/pipeline" element={<PrivateRoute><AppLayout><PipelinePage /></AppLayout></PrivateRoute>} />
            <Route path="/ia-admin" element={<PrivateRoute><AppLayout><ComingSoon title="IA Admin" /></AppLayout></PrivateRoute>} />

            {/* Routes Business */}
            <Route path="/seo" element={<PrivateRoute><AppLayout><SEODashboard /></AppLayout></PrivateRoute>} />
            <Route path="/seo/articles" element={<PrivateRoute><AppLayout><SEOArticles /></AppLayout></PrivateRoute>} />
            <Route path="/churn" element={<PrivateRoute><AppLayout><ChurnPrevention /></AppLayout></PrivateRoute>} />
            <Route path="/sentinel" element={<PrivateRoute><AppLayout><ComingSoon title="Sentinel" /></AppLayout></PrivateRoute>} />

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
