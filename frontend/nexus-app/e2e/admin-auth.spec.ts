/**
 * Tests E2E - Authentification Admin NEXUS
 *
 * Teste le flux de connexion/deconnexion admin
 */

import { test, expect, TEST_ADMIN } from './fixtures';

test.describe('Authentification Admin', () => {
  test.describe('Page de connexion', () => {
    test('affiche le formulaire de connexion', async ({ page }) => {
      await page.goto('/admin/login');

      // Verifier les elements du formulaire
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('affiche erreur avec identifiants invalides', async ({ page }) => {
      await page.goto('/admin/login');

      // Remplir avec de mauvais identifiants
      await page.fill('input[type="email"]', 'invalid@test.com');
      await page.fill('input[type="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');

      // Verifier le message d'erreur
      await expect(page.locator('text=Identifiants invalides')).toBeVisible({ timeout: 10000 });
    });

    test('validation email format', async ({ page }) => {
      await page.goto('/admin/login');

      // Remplir avec un email invalide
      await page.fill('input[type="email"]', 'notanemail');
      await page.fill('input[type="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Le champ email devrait etre invalide (validation HTML5)
      const emailInput = page.locator('input[type="email"]');
      const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
      expect(isInvalid).toBe(true);
    });

    test('champs requis', async ({ page }) => {
      await page.goto('/admin/login');

      // Verifier les attributs required
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');

      await expect(emailInput).toHaveAttribute('required', '');
      await expect(passwordInput).toHaveAttribute('required', '');
    });
  });

  test.describe('Connexion reussie', () => {
    test.skip('redirige vers le dashboard apres connexion', async ({ page }) => {
      // Skip ce test si pas de credentials de test configurees
      if (!process.env.E2E_ADMIN_EMAIL) {
        test.skip();
        return;
      }

      await page.goto('/admin/login');

      await page.fill('input[type="email"]', TEST_ADMIN.email);
      await page.fill('input[type="password"]', TEST_ADMIN.password);
      await page.click('button[type="submit"]');

      // Attendre la redirection
      await page.waitForURL(/\/admin\/dashboard/, { timeout: 15000 });

      // Verifier qu'on est sur le dashboard
      await expect(page.locator('text=Dashboard')).toBeVisible();
    });
  });

  test.describe('Protection des routes', () => {
    test('redirige vers login si non authentifie', async ({ page }) => {
      // Essayer d'acceder au dashboard sans etre connecte
      await page.goto('/admin/dashboard');

      // Devrait rediriger vers login
      await expect(page).toHaveURL(/\/admin\/login/);
    });

    test('redirige vers login pour les pages clients', async ({ page }) => {
      await page.goto('/admin/clients');
      await expect(page).toHaveURL(/\/admin\/login/);
    });

    test('redirige vers login pour les reservations', async ({ page }) => {
      await page.goto('/admin/reservations');
      await expect(page).toHaveURL(/\/admin\/login/);
    });
  });

  test.describe('Mot de passe oublie', () => {
    test('lien mot de passe oublie present', async ({ page }) => {
      await page.goto('/admin/login');

      const forgotLink = page.locator('a:has-text("Mot de passe oublie")');
      await expect(forgotLink).toBeVisible();
    });

    test('page reset password accessible', async ({ page }) => {
      await page.goto('/admin/forgot-password');

      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });
  });
});
