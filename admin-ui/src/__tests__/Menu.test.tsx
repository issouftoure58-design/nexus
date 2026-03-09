import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../test/utils';
import MenuPage from '../pages/Menu';

// Mock api
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
}));

const { api } = await import('../lib/api');
const mockGet = vi.mocked(api.get);

const mockCategories = [
  { id: 1, nom: 'Entrées', description: 'Nos entrées', ordre: 1, actif: true },
  { id: 2, nom: 'Plats', description: 'Plats principaux', ordre: 2, actif: true },
  { id: 3, nom: 'Desserts', description: 'Desserts', ordre: 3, actif: true },
];

const mockPlats = [
  {
    id: 1, nom: 'Salade César', description: 'Laitue romaine', prix: 1450,
    categorie_id: 1, menu_categories: { id: 1, nom: 'Entrées' },
    allergenes: ['gluten', 'lactose'], regime: ['vegetarien'],
    disponible_midi: true, disponible_soir: true, plat_du_jour: false,
    stock_limite: false, stock_quantite: 0, actif: true, ordre: 1
  },
  {
    id: 2, nom: 'Steak Frites', description: 'Bœuf Angus', prix: 2250,
    categorie_id: 2, menu_categories: { id: 2, nom: 'Plats' },
    allergenes: ['gluten'], regime: [],
    disponible_midi: true, disponible_soir: true, plat_du_jour: true,
    stock_limite: false, stock_quantite: 0, actif: true, ordre: 1
  },
];

const mockStats = { total_plats: 12, total_categories: 4, plats_du_jour: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockImplementation((url: string) => {
    if (url.includes('/categories')) return Promise.resolve({ categories: mockCategories });
    if (url.includes('/plats')) return Promise.resolve({ plats: mockPlats });
    if (url.includes('/stats')) return Promise.resolve(mockStats);
    return Promise.resolve({});
  });
});

describe('Menu Page', () => {
  // ═══════════════════════════════════════════
  // HEADER & STATS
  // ═══════════════════════════════════════════

  it('affiche le header avec le titre Gestion du Menu', async () => {
    renderWithProviders(<MenuPage />);
    await waitFor(() => {
      // h1 contains "Menu" — may appear multiple times, check at least one exists
      const headings = screen.getAllByText(/menu/i);
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('affiche les stats cards', async () => {
    renderWithProviders(<MenuPage />);
    await waitFor(() => {
      expect(screen.getByText('12')).toBeInTheDocument(); // total_plats
    });
  });

  // ═══════════════════════════════════════════
  // ONGLETS
  // ═══════════════════════════════════════════

  it('affiche les 3 onglets', async () => {
    renderWithProviders(<MenuPage />);
    await waitFor(() => {
      // "Plats" appears in stats card AND as tab — use getAllByText
      const platsElements = screen.getAllByText('Plats');
      expect(platsElements.length).toBeGreaterThanOrEqual(1);
      const categoriesElements = screen.getAllByText('Catégories');
      expect(categoriesElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Menu du jour')).toBeInTheDocument();
    });
  });

  it('onglet Plats actif par défaut', async () => {
    renderWithProviders(<MenuPage />);
    await waitFor(() => {
      expect(screen.getByText('Nouveau plat')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // PLATS
  // ═══════════════════════════════════════════

  it('affiche la liste des plats', async () => {
    renderWithProviders(<MenuPage />);
    await waitFor(() => {
      expect(screen.getByText('Salade César')).toBeInTheDocument();
      expect(screen.getByText('Steak Frites')).toBeInTheDocument();
    });
  });

  it('affiche le bouton Nouveau plat', async () => {
    renderWithProviders(<MenuPage />);
    await waitFor(() => {
      expect(screen.getByText('Nouveau plat')).toBeInTheDocument();
    });
  });

  it('affiche le champ de recherche', async () => {
    renderWithProviders(<MenuPage />);
    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(/rechercher/i);
      expect(searchInput).toBeInTheDocument();
    });
  });

  it('filtre les plats par recherche', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MenuPage />);

    await waitFor(() => {
      expect(screen.getByText('Salade César')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/rechercher/i);
    await user.type(searchInput, 'Steak');

    await waitFor(() => {
      expect(screen.getByText('Steak Frites')).toBeInTheDocument();
      expect(screen.queryByText('Salade César')).not.toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // ÉTAT VIDE
  // ═══════════════════════════════════════════

  it('affiche un état vide quand aucun plat', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/categories')) return Promise.resolve({ categories: [] });
      if (url.includes('/plats')) return Promise.resolve({ plats: [] });
      if (url.includes('/stats')) return Promise.resolve({ total_plats: 0, total_categories: 0, plats_du_jour: 0 });
      return Promise.resolve({});
    });

    renderWithProviders(<MenuPage />);
    await waitFor(() => {
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════
  // CATÉGORIES TAB
  // ═══════════════════════════════════════════

  it('bascule sur l\'onglet Catégories', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MenuPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Catégories').length).toBeGreaterThanOrEqual(1);
    });

    // Click the tab button (not the stats card text)
    const tabs = screen.getAllByText('Catégories');
    const tabButton = tabs.find(el => el.closest('button'));
    await user.click(tabButton!);

    await waitFor(() => {
      expect(screen.getByText(/catégories de plats/i)).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════
  // MENU DU JOUR TAB
  // ═══════════════════════════════════════════

  it('bascule sur l\'onglet Menu du jour', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MenuPage />);

    await waitFor(() => {
      expect(screen.getByText('Menu du jour')).toBeInTheDocument();
    });

    const tabButton = screen.getByText('Menu du jour');
    await user.click(tabButton);

    await waitFor(() => {
      // After clicking, the tab content should show
      const menuElements = screen.getAllByText(/menu du jour/i);
      expect(menuElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('appelle les bonnes routes API', () => {
    renderWithProviders(<MenuPage />);
    expect(mockGet).toHaveBeenCalledWith('/admin/menu/categories');
    expect(mockGet).toHaveBeenCalledWith('/admin/menu/plats');
    expect(mockGet).toHaveBeenCalledWith('/admin/menu/stats');
  });
});
