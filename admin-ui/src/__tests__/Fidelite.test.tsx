import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    getToken: () => 'test-token',
    setToken: vi.fn(),
    clearToken: vi.fn(),
  },
  loyaltyApi: {
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getStats: vi.fn(),
    getLeaderboard: vi.fn(),
    getClientDetail: vi.fn(),
    adjustPoints: vi.fn(),
    redeemPoints: vi.fn(),
  },
}));

const { loyaltyApi } = await import('../lib/api');
const mockGetStats = vi.mocked(loyaltyApi.getStats);
const mockGetLeaderboard = vi.mocked(loyaltyApi.getLeaderboard);
const mockGetConfig = vi.mocked(loyaltyApi.getConfig);

const mockStats = {
  stats: {
    total_points_circulation: 12500,
    active_members: 45,
    earned_30d: 3200,
    redeemed_30d: 800,
  },
  config: {
    enabled: true,
    points_per_euro: 1,
    signup_bonus: 50,
    validity_days: 730,
    min_redeem: 100,
    redeem_ratio: 0.10,
  },
};

const mockLeaderboard = {
  leaderboard: [
    { id: 1, nom: 'Dupont', prenom: 'Jean', email: 'jean@test.com', loyalty_points: 500, total_spent: 2500 },
    { id: 2, nom: 'Martin', prenom: 'Sophie', email: 'sophie@test.com', loyalty_points: 350, total_spent: 1800 },
    { id: 3, nom: 'Lemoine', prenom: 'Marie', email: 'marie@test.com', loyalty_points: 200, total_spent: 1200 },
  ],
};

const mockConfig = {
  config: {
    enabled: true,
    points_per_euro: 1,
    signup_bonus: 50,
    validity_days: 730,
    min_redeem: 100,
    redeem_ratio: 0.10,
  },
};

// Lazy import after mocks
const { default: Fidelite } = await import('../pages/Fidelite');

describe('Fidelite Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStats.mockResolvedValue(mockStats);
    mockGetLeaderboard.mockResolvedValue(mockLeaderboard);
    mockGetConfig.mockResolvedValue(mockConfig);
  });

  it('affiche le titre Programme Fidélité', async () => {
    renderWithProviders(<Fidelite />);
    await waitFor(() => {
      expect(screen.getByText('Programme Fidélité')).toBeDefined();
    });
  });

  it('affiche les 4 KPI cards', async () => {
    renderWithProviders(<Fidelite />);
    await waitFor(() => {
      expect(screen.getByText('Points en circulation')).toBeDefined();
      expect(screen.getByText('Membres actifs')).toBeDefined();
      expect(screen.getByText('Gagnés (30j)')).toBeDefined();
      expect(screen.getByText('Utilisés (30j)')).toBeDefined();
    });
  });

  it('affiche les valeurs des stats', async () => {
    renderWithProviders(<Fidelite />);
    await waitFor(() => {
      // toLocaleString peut formatter différemment selon l'environnement
      const container = document.body;
      expect(container.textContent).toContain('12');
      expect(container.textContent).toContain('500');
      expect(screen.getByText('45')).toBeDefined();
    });
  });

  it('affiche le badge Actif', async () => {
    renderWithProviders(<Fidelite />);
    await waitFor(() => {
      expect(screen.getByText('Actif')).toBeDefined();
    });
  });

  it('affiche les règles actives dans l\'onglet overview', async () => {
    renderWithProviders(<Fidelite />);
    await waitFor(() => {
      expect(screen.getByText('Règles actives')).toBeDefined();
      expect(screen.getByText('1 pt/€')).toBeDefined();
    });
  });

  it('affiche le Top 5 clients', async () => {
    renderWithProviders(<Fidelite />);
    await waitFor(() => {
      expect(screen.getByText('Top 5 clients')).toBeDefined();
      expect(screen.getByText('Jean Dupont')).toBeDefined();
      expect(screen.getByText('Sophie Martin')).toBeDefined();
    });
  });

  it('affiche les 3 onglets', async () => {
    renderWithProviders(<Fidelite />);
    await waitFor(() => {
      expect(screen.getByText("Vue d'ensemble")).toBeDefined();
      expect(screen.getByText('Configuration')).toBeDefined();
      expect(screen.getByText('Classement')).toBeDefined();
    });
  });

  it('appelle les API au montage', async () => {
    renderWithProviders(<Fidelite />);
    await waitFor(() => {
      expect(mockGetStats).toHaveBeenCalled();
      expect(mockGetLeaderboard).toHaveBeenCalled();
      expect(mockGetConfig).toHaveBeenCalled();
    });
  });
});
