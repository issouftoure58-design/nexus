import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CookieBanner from '../components/CookieBanner';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('CookieBanner', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('should show banner when no consent stored', () => {
    render(<CookieBanner />);
    expect(screen.getByText('Respect de votre vie privee')).toBeInTheDocument();
  });

  it('should hide banner after accepting all', () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByText('Accepter tout'));
    expect(screen.queryByText('Respect de votre vie privee')).not.toBeInTheDocument();
  });

  it('should hide banner after refusing all', () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByText('Refuser tout'));
    expect(screen.queryByText('Respect de votre vie privee')).not.toBeInTheDocument();
  });

  it('should store consent in localStorage', () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByText('Accepter tout'));
    const stored = JSON.parse(localStorageMock.getItem('nexus_cookie_consent')!);
    expect(stored.essential).toBe(true);
    expect(stored.analytics).toBe(true);
  });

  it('should not show banner if consent already stored', () => {
    localStorageMock.setItem('nexus_cookie_consent', JSON.stringify({
      essential: true,
      analytics: false,
      expiry: Date.now() + 86400000,
    }));
    render(<CookieBanner />);
    expect(screen.queryByText('Respect de votre vie privee')).not.toBeInTheDocument();
  });

  it('should show customize panel', () => {
    render(<CookieBanner />);
    fireEvent.click(screen.getByText('Personnaliser'));
    expect(screen.getByText('Gestion des cookies')).toBeInTheDocument();
    expect(screen.getByText('Cookies essentiels')).toBeInTheDocument();
    expect(screen.getByText('Cookies analytiques')).toBeInTheDocument();
  });
});
