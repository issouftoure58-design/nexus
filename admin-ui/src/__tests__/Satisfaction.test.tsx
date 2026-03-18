import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Satisfaction from '../pages/Satisfaction';

vi.mock('../lib/api', () => ({
  api: {
    getToken: () => 'test-token',
    setToken: vi.fn(),
    clearToken: vi.fn(),
    get: vi.fn().mockResolvedValue({ enquetes: [] }),
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

describe('Satisfaction Page', () => {
  it('should render the header', () => {
    renderWithProviders(<Satisfaction />);
    expect(screen.getByText('Enquetes de Satisfaction')).toBeInTheDocument();
  });

  it('should show create buttons', () => {
    renderWithProviders(<Satisfaction />);
    expect(screen.getByText('A chaud')).toBeInTheDocument();
    expect(screen.getByText('A froid')).toBeInTheDocument();
  });

  it('should display stats', () => {
    renderWithProviders(<Satisfaction />);
    expect(screen.getByText('Envois')).toBeInTheDocument();
    expect(screen.getByText('Reponses')).toBeInTheDocument();
  });
});
