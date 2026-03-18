import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Qualiopi from '../pages/Qualiopi';

vi.mock('../lib/api', () => ({
  api: {
    getToken: () => 'test-token',
    setToken: vi.fn(),
    clearToken: vi.fn(),
    get: vi.fn().mockResolvedValue({ apprenants: [], alertes: [] }),
    post: vi.fn(),
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{ui}</BrowserRouter>
    </QueryClientProvider>
  );
}

describe('Qualiopi Page', () => {
  it('should render the header', () => {
    renderWithProviders(<Qualiopi />);
    expect(screen.getByText('Conformite Qualiopi')).toBeInTheDocument();
  });

  it('should display stats cards', () => {
    renderWithProviders(<Qualiopi />);
    expect(screen.getByText('Conformite moy.')).toBeInTheDocument();
    expect(screen.getByText('Documents types')).toBeInTheDocument();
  });

  it('should show empty state message', async () => {
    renderWithProviders(<Qualiopi />);
    expect(await screen.findByText('Aucun apprenant')).toBeInTheDocument();
  });
});
