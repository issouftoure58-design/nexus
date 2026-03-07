import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from '../pages/Login';

// Mock api module
vi.mock('../lib/api', () => ({
  api: {
    getToken: () => null,
    setToken: vi.fn(),
    clearToken: vi.fn(),
    post: vi.fn(),
    get: vi.fn(),
  },
  authApi: {
    login: vi.fn(),
    verify: vi.fn(),
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

describe('Login Page', () => {
  it('should render the login form', () => {
    renderWithProviders(<Login />);

    // Should have password input and submit button
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByText('Se connecter')).toBeInTheDocument();
  });

  it('should have a submit button', () => {
    renderWithProviders(<Login />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
