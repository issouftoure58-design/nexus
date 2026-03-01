/**
 * Fixtures et utilitaires pour les tests E2E
 */

import { test as base, expect } from '@playwright/test';

// Types pour les fixtures
interface TestFixtures {
  authenticatedAdminPage: ReturnType<typeof base.extend>;
}

// Credentials de test (utiliser des vrais credentials en env pour CI)
export const TEST_ADMIN = {
  email: process.env.E2E_ADMIN_EMAIL || 'test@nexus.app',
  password: process.env.E2E_ADMIN_PASSWORD || 'testpassword123',
};

export const TEST_TENANT = {
  id: process.env.E2E_TENANT_ID || 'test-tenant',
  domain: process.env.E2E_TENANT_DOMAIN || 'test.nexus.app',
};

/**
 * Helper pour se connecter en tant qu'admin
 */
export async function loginAsAdmin(page: any) {
  await page.goto('/admin/login');

  // Remplir le formulaire de connexion
  await page.fill('input[type="email"]', TEST_ADMIN.email);
  await page.fill('input[type="password"]', TEST_ADMIN.password);

  // Soumettre
  await page.click('button[type="submit"]');

  // Attendre la redirection vers le dashboard
  await page.waitForURL(/\/admin\/dashboard/, { timeout: 10000 });
}

/**
 * Helper pour se deconnecter
 */
export async function logout(page: any) {
  // Ouvrir le menu utilisateur et cliquer sur deconnexion
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout-button"]');

  // Attendre la redirection vers login
  await page.waitForURL(/\/admin\/login/);
}

/**
 * Helper pour naviguer vers une page admin
 */
export async function navigateToAdminPage(page: any, path: string) {
  await page.goto(`/admin${path}`);
  await page.waitForLoadState('networkidle');
}

/**
 * Helper pour verifier un toast de succes
 */
export async function expectSuccessToast(page: any, message?: string) {
  const toast = page.locator('[data-testid="toast"]').first();
  await expect(toast).toBeVisible({ timeout: 5000 });

  if (message) {
    await expect(toast).toContainText(message);
  }
}

/**
 * Helper pour verifier un toast d'erreur
 */
export async function expectErrorToast(page: any, message?: string) {
  const toast = page.locator('[data-testid="toast-error"]').first();
  await expect(toast).toBeVisible({ timeout: 5000 });

  if (message) {
    await expect(toast).toContainText(message);
  }
}

/**
 * Helper pour attendre le chargement d'une page
 */
export async function waitForPageLoad(page: any) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
}

/**
 * Helper pour prendre un screenshot avec un nom descriptif
 */
export async function takeScreenshot(page: any, name: string) {
  await page.screenshot({
    path: `playwright-screenshots/${name}-${Date.now()}.png`,
    fullPage: true
  });
}

// Re-export de test et expect pour simplifier les imports
export { expect };
export const test = base;
