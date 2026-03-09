import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/utils';
import RoomCalendar from '../pages/RoomCalendar';

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

const mockCalendarData = {
  date_debut: '2026-03-01',
  date_fin: '2026-03-31',
  chambres: [
    {
      id: 1, nom: 'Suite Royale', type_chambre: 'suite', capacite: 2, prix: 250, actif: true,
      occupation: [
        { id: 1, service_id: 1, date_occupation: '2026-03-10', statut: 'reservee' },
        { id: 2, service_id: 1, date_occupation: '2026-03-15', statut: 'maintenance' },
      ],
      reservations: [
        { id: 1, client_id: 10, service_id: 1, date_debut: '2026-03-10', date_fin: '2026-03-12', statut: 'confirmee', nb_personnes: 2, client: { prenom: 'Jean', nom: 'Dupont', telephone: '+33612345678' } }
      ]
    },
    {
      id: 2, nom: 'Chambre 201', type_chambre: 'double', capacite: 2, prix: 120, actif: true,
      occupation: [],
      reservations: []
    },
  ]
};

const mockStats = {
  nb_chambres: 10,
  occupees_aujourdhui: 4,
  reservations_mois: 32,
  tarifs_actifs: 3,
  taux_occupation: 40
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/admin/hotel/occupation')) return Promise.resolve(mockCalendarData);
    if (url.includes('/admin/hotel/stats')) return Promise.resolve(mockStats);
    return Promise.resolve({});
  });
});

describe('RoomCalendar Page', () => {
  it('affiche le header Calendrier des Chambres', async () => {
    renderWithProviders(<RoomCalendar />);
    await waitFor(() => {
      expect(screen.getByText('Calendrier des Chambres')).toBeInTheDocument();
    });
  });

  it('affiche les stats cards quand les données sont chargées', async () => {
    renderWithProviders(<RoomCalendar />);
    await waitFor(() => {
      expect(screen.getByText('Chambres')).toBeInTheDocument();
      expect(screen.getByText('Occupées')).toBeInTheDocument();
      // "10" may appear multiple times (stat + calendar day)
      const tens = screen.getAllByText('10');
      expect(tens.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('affiche la navigation mois avec boutons', async () => {
    renderWithProviders(<RoomCalendar />);
    await waitFor(() => {
      expect(screen.getByText('Calendrier des Chambres')).toBeInTheDocument();
    });
    // Navigation buttons exist (previous, today, next)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('affiche le mois courant', async () => {
    renderWithProviders(<RoomCalendar />);
    await waitFor(() => {
      // Some month name should be visible
      const content = document.body.textContent || '';
      expect(content).toMatch(/mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|janvier|février/i);
    });
  });

  it('affiche la légende (Libre, Réservée, Occupée, Maintenance)', async () => {
    renderWithProviders(<RoomCalendar />);
    await waitFor(() => {
      expect(screen.getByText('Libre')).toBeInTheDocument();
      expect(screen.getByText('Réservée')).toBeInTheDocument();
      expect(screen.getByText('Occupée')).toBeInTheDocument();
      expect(screen.getByText('Maintenance')).toBeInTheDocument();
    });
  });

  it('affiche les chambres dans le calendrier', async () => {
    renderWithProviders(<RoomCalendar />);
    await waitFor(() => {
      expect(screen.getByText('Suite Royale')).toBeInTheDocument();
      expect(screen.getByText('Chambre 201')).toBeInTheDocument();
    });
  });

  it('gère l\'état vide (aucune chambre)', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/occupation')) return Promise.resolve({ date_debut: '2026-03-01', date_fin: '2026-03-31', chambres: [] });
      if (url.includes('/stats')) return Promise.resolve({ nb_chambres: 0, occupees_aujourdhui: 0, reservations_mois: 0, tarifs_actifs: 0, taux_occupation: 0 });
      return Promise.resolve({});
    });

    renderWithProviders(<RoomCalendar />);
    await waitFor(() => {
      // With 0 chambres, the calendar area should be empty or show the stat 0
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('appelle les bonnes routes API', () => {
    renderWithProviders(<RoomCalendar />);
    expect(mockGet).toHaveBeenCalledWith(expect.stringContaining('/admin/hotel/occupation'));
    expect(mockGet).toHaveBeenCalledWith('/admin/hotel/stats');
  });
});
