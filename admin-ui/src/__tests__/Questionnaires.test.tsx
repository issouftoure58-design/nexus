import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Questionnaires from '../pages/Questionnaires';

vi.mock('../lib/api', () => ({
  api: {
    getToken: () => 'test-token',
    setToken: vi.fn(),
    clearToken: vi.fn(),
    get: vi.fn().mockResolvedValue({ questionnaires: [] }),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
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

describe('Questionnaires Page', () => {
  it('should render the header', () => {
    renderWithProviders(<Questionnaires />);
    expect(screen.getByText('Questionnaires de Qualification')).toBeInTheDocument();
  });

  it('should show the Nouveau button', () => {
    renderWithProviders(<Questionnaires />);
    expect(screen.getByText('Nouveau')).toBeInTheDocument();
  });

  it('should display stats cards', () => {
    renderWithProviders(<Questionnaires />);
    expect(screen.getByText('Actifs')).toBeInTheDocument();
    expect(screen.getByText('Soumissions')).toBeInTheDocument();
    expect(screen.getByText('Taux qual.')).toBeInTheDocument();
  });
});
