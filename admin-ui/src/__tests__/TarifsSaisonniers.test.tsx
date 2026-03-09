import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils';

// Mock api before import
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

// Import component after mock
const { default: TarifsSaisonniers } = await import('../pages/TarifsSaisonniers');

const mockTarifs = [
  {
    id: 1, tenant_id: 'test', service_id: 100,
    nom: 'Haute saison été', date_debut: '2026-06-01', date_fin: '2026-08-31',
    prix_nuit: 18000, prix_weekend: 22000, prix_semaine: null,
    petit_dejeuner_inclus: true, prix_petit_dejeuner: 1500,
    duree_min_nuits: 2, actif: true,
    service: { id: 100, nom: 'Suite Royale', type_chambre: 'suite' }
  },
  {
    id: 2, tenant_id: 'test', service_id: 101,
    nom: 'Basse saison', date_debut: '2026-01-01', date_fin: '2026-03-31',
    prix_nuit: 12000, prix_weekend: 14000, prix_semaine: null,
    petit_dejeuner_inclus: false, prix_petit_dejeuner: 0,
    duree_min_nuits: 1, actif: true,
    service: { id: 101, nom: 'Chambre Double 201', type_chambre: 'double' }
  },
];

const mockChambres = [
  { id: 100, nom: 'Suite Royale', type_chambre: 'suite', capacite: 2, prix: 25000 },
  { id: 101, nom: 'Chambre Double 201', type_chambre: 'double', capacite: 2, prix: 12000 },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockImplementation((url: string) => {
    if (url === '/admin/hotel/tarifs') return Promise.resolve(mockTarifs);
    if (url === '/admin/hotel/chambres') return Promise.resolve(mockChambres);
    return Promise.resolve([]);
  });
});

describe('TarifsSaisonniers Page', () => {
  it('affiche le header Tarifs Saisonniers', async () => {
    renderWithProviders(<TarifsSaisonniers />);
    await waitFor(() => {
      expect(screen.getByText('Tarifs Saisonniers')).toBeInTheDocument();
    });
  });

  it('affiche le bouton Nouveau tarif', async () => {
    renderWithProviders(<TarifsSaisonniers />);
    await waitFor(() => {
      expect(screen.getByText('Nouveau tarif')).toBeInTheDocument();
    });
  });

  it('affiche la liste des tarifs par nom', async () => {
    renderWithProviders(<TarifsSaisonniers />);
    await waitFor(() => {
      expect(screen.getByText('Haute saison été')).toBeInTheDocument();
      expect(screen.getByText('Basse saison')).toBeInTheDocument();
    });
  });

  it('affiche les groupes par chambre', async () => {
    renderWithProviders(<TarifsSaisonniers />);
    await waitFor(() => {
      // Les tarifs sont groupés par service.nom — présents en h3 ET dans le select
      const suiteElements = screen.getAllByText('Suite Royale');
      expect(suiteElements.length).toBeGreaterThanOrEqual(1);
      const chambreElements = screen.getAllByText('Chambre Double 201');
      expect(chambreElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('affiche les prix formatés', async () => {
    renderWithProviders(<TarifsSaisonniers />);
    await waitFor(() => {
      // formatPrice(18000) = 180€ or 180,00€
      const content = document.body.textContent || '';
      expect(content).toMatch(/180/);
    });
  });

  it('affiche le badge "En cours" pour les tarifs actifs dans la période', async () => {
    renderWithProviders(<TarifsSaisonniers />);
    await waitFor(() => {
      // Basse saison covers jan-mar 2026, we are in march 2026
      const badges = screen.queryAllByText('En cours');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('affiche le champ de recherche', async () => {
    renderWithProviders(<TarifsSaisonniers />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/rechercher/i)).toBeInTheDocument();
    });
  });

  it('filtre les tarifs par recherche', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TarifsSaisonniers />);

    await waitFor(() => {
      expect(screen.getByText('Haute saison été')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/rechercher/i);
    await user.type(searchInput, 'Basse');

    await waitFor(() => {
      expect(screen.getByText('Basse saison')).toBeInTheDocument();
      expect(screen.queryByText('Haute saison été')).not.toBeInTheDocument();
    });
  });

  it('affiche un état vide sans tarifs', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/admin/hotel/tarifs') return Promise.resolve([]);
      if (url === '/admin/hotel/chambres') return Promise.resolve([]);
      return Promise.resolve([]);
    });

    renderWithProviders(<TarifsSaisonniers />);
    await waitFor(() => {
      expect(screen.getByText(/aucun tarif/i)).toBeInTheDocument();
    });
  });

  it('appelle la route API tarifs', () => {
    renderWithProviders(<TarifsSaisonniers />);
    expect(mockGet).toHaveBeenCalledWith('/admin/hotel/tarifs');
  });
});
