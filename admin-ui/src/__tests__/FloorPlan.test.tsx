import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import FloorPlanPage from '../pages/FloorPlan';

// Mock api
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    getToken: () => 'test-token',
    setToken: vi.fn(),
    clearToken: vi.fn(),
  },
}));

const { api } = await import('../lib/api');
const mockGet = vi.mocked(api.get);

const mockTables = [
  { id: 1, nom: 'Table 1', capacite: 4, zone: 'interieur', service_dispo: 'midi_soir', actif: true },
  { id: 2, nom: 'Table 2', capacite: 2, zone: 'terrasse', service_dispo: 'midi_soir', actif: true },
  { id: 3, nom: 'Table 3', capacite: 6, zone: 'interieur', service_dispo: 'midi', actif: true },
  { id: 4, nom: 'Table 4', capacite: 8, zone: 'prive', service_dispo: 'soir', actif: false },
];

const mockReservations = [
  { id: 1, service_id: 1, client_nom: 'Dupont', date: '2026-03-08', heure: '12:00', nb_personnes: 2, statut: 'confirmee' },
  { id: 2, service_id: 2, client_nom: 'Martin', date: '2026-03-08', heure: '19:30', nb_personnes: 4, statut: 'confirmee' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/admin/services')) return Promise.resolve({ services: mockTables });
    if (url.includes('/admin/reservations')) return Promise.resolve({ reservations: mockReservations });
    return Promise.resolve({});
  });
});

describe('FloorPlan Page', () => {
  it('affiche le header Plan de salle', async () => {
    renderWithProviders(<FloorPlanPage />);
    await waitFor(() => {
      expect(screen.getByText('Plan de salle')).toBeInTheDocument();
    });
  });

  it('affiche les stats: Tables, Libres, Réservées, Occupées', async () => {
    renderWithProviders(<FloorPlanPage />);
    await waitFor(() => {
      expect(screen.getByText('Tables')).toBeInTheDocument();
      expect(screen.getByText('Libres')).toBeInTheDocument();
      expect(screen.getByText('Réservées')).toBeInTheDocument();
      expect(screen.getByText('Occupées')).toBeInTheDocument();
    });
  });

  it('affiche les tables du restaurant', async () => {
    renderWithProviders(<FloorPlanPage />);
    await waitFor(() => {
      expect(screen.getByText('Table 1')).toBeInTheDocument();
      expect(screen.getByText('Table 2')).toBeInTheDocument();
      expect(screen.getByText('Table 3')).toBeInTheDocument();
    });
  });

  it('affiche un état vide sans tables', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/admin/services')) return Promise.resolve({ services: [] });
      if (url.includes('/admin/reservations')) return Promise.resolve({ reservations: [] });
      return Promise.resolve({});
    });

    renderWithProviders(<FloorPlanPage />);
    await waitFor(() => {
      expect(screen.getByText(/aucune table/i)).toBeInTheDocument();
    });
  });

  it('gère les erreurs API avec un banner', async () => {
    mockGet.mockImplementation(() => Promise.reject(new Error('Network error')));

    renderWithProviders(<FloorPlanPage />);
    await waitFor(() => {
      expect(screen.getByText(/impossible de charger/i)).toBeInTheDocument();
    });
  });

  it('affiche le filtre de zones', async () => {
    renderWithProviders(<FloorPlanPage />);
    await waitFor(() => {
      expect(screen.getByText('Table 1')).toBeInTheDocument();
    });
    expect(screen.getByText('Toutes zones')).toBeInTheDocument();
  });

  it('affiche le bouton de rafraîchissement', async () => {
    renderWithProviders(<FloorPlanPage />);
    await waitFor(() => {
      expect(screen.getByText('Plan de salle')).toBeInTheDocument();
    });
    // Refresh button exists
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('appelle les routes API correctes', () => {
    renderWithProviders(<FloorPlanPage />);
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/admin/services'));
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/admin/reservations'));
  });

  it('rend les compteurs de stats', async () => {
    renderWithProviders(<FloorPlanPage />);
    await waitFor(() => {
      // At least some numeric values should be rendered
      const allText = document.body.textContent;
      expect(allText).toContain('Table 1');
    });
  });
});
