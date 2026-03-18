import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Signatures from '../pages/Signatures';

vi.mock('../lib/api', () => ({
  api: {
    getToken: () => 'test-token',
    setToken: vi.fn(),
    clearToken: vi.fn(),
    get: vi.fn().mockResolvedValue({ signatures: [], total: 0 }),
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

describe('Signatures Page', () => {
  it('should render the header', () => {
    renderWithProviders(<Signatures />);
    expect(screen.getByText('Signatures Electroniques')).toBeInTheDocument();
  });

  it('should show stats cards', () => {
    renderWithProviders(<Signatures />);
    expect(screen.getByText('En attente')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('should show empty state', async () => {
    renderWithProviders(<Signatures />);
    expect(await screen.findByText('Aucune signature')).toBeInTheDocument();
  });
});
