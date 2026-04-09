import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock all lazy-loaded pages
vi.mock('../pages/Login', () => ({
  default: () => <div data-testid="login-page">Login Page</div>,
}));

vi.mock('../pages/Signup', () => ({
  default: () => <div data-testid="signup-page">Signup Page</div>,
}));

vi.mock('../pages/Home', () => ({
  Home: () => <div data-testid="home-page">Home</div>,
}));

vi.mock('../pages/Dashboard', () => ({
  default: () => <div>Dashboard</div>,
}));

vi.mock('../components/layout/AppLayout', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../components/ModuleGate/ModuleGate', () => ({
  ModuleGate: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../contexts/TenantContext', () => ({
  TenantProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useTenantContext: () => ({
    tenant: null,
    isLoading: false,
    error: null,
    slug: '',
    name: 'Test',
    plan: 'free',
    chosenPlan: 'free',
    modules: {},
    branding: {},
    quotas: { clients_max: 200, storage_gb: 2, posts_ia_month: 0, images_ia_month: 100, reservations_month: 500, messages_ia_month: 1000 },
    statut: 'actif',
    hasPlan: () => false,
    isPro: false,
    isBusiness: false,
    hasModule: () => false,
    getQuota: () => 0,
    isQuotaUnlimited: () => false,
    onboardingCompleted: true,
    isOnTrial: false,
    trialEndsAt: null,
    detectedSlug: '',
    refetch: vi.fn(),
  }),
}));

vi.mock('../contexts/ProfileContext', () => ({
  ProfileProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../lib/api', () => ({
  api: {
    getToken: () => null,
    setToken: vi.fn(),
    clearToken: vi.fn(),
    get: vi.fn(),
  },
  authApi: {
    verify: vi.fn().mockRejectedValue(new Error('Not authenticated')),
  },
}));

import App from '../App';

function renderApp(route = '/') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('App Routing', () => {
  it('should render login page on /login', () => {
    renderApp('/login');
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('should render signup page on /signup', () => {
    renderApp('/signup');
    expect(screen.getByTestId('signup-page')).toBeInTheDocument();
  });

  it('should redirect unauthenticated users to login', () => {
    renderApp('/');
    // Without token, should redirect to login
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });
});
