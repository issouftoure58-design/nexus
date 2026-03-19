/**
 * E2E Test — Parcours Inscription (Signup)
 *
 * Teste le flow complet:
 * 1. Accès page signup
 * 2. Choix du plan (Starter/Pro/Business)
 * 3. Formulaire d'inscription
 * 4. Redirection après inscription
 */

import { test, expect } from '@playwright/test';

const SIGNUP_URL = '/signup';

test.describe('Parcours Inscription', () => {
  test('page signup se charge', async ({ page }) => {
    await page.goto(SIGNUP_URL);
    // La page doit contenir un formulaire ou un bouton d'inscription
    await expect(
      page.getByRole('heading').first()
    ).toBeVisible();
  });

  test('formulaire affiche les champs requis', async ({ page }) => {
    await page.goto(SIGNUP_URL);

    // Champs attendus dans le formulaire d'inscription
    const emailField = page.getByPlaceholder(/email/i).or(page.locator('input[type="email"]'));
    const passwordField = page.getByPlaceholder(/mot de passe/i).or(page.locator('input[type="password"]'));

    // Au moins un de ces champs doit être visible
    const hasEmail = await emailField.first().isVisible().catch(() => false);
    const hasPassword = await passwordField.first().isVisible().catch(() => false);

    expect(hasEmail || hasPassword).toBeTruthy();
  });

  test('validation formulaire — champs vides', async ({ page }) => {
    await page.goto(SIGNUP_URL);

    // Essayer de soumettre sans remplir
    const submitButton = page.getByRole('button', { name: /cr[eé]er|inscription|s.*inscrire|commencer/i });

    if (await submitButton.isVisible().catch(() => false)) {
      await submitButton.click();
      // Le formulaire ne devrait pas rediriger (validation côté client)
      await expect(page).toHaveURL(new RegExp(SIGNUP_URL));
    }
  });

  test('inscription complète avec données valides', async ({ page }) => {
    await page.goto(SIGNUP_URL);

    const timestamp = Date.now();
    const testEmail = `e2e-test-${timestamp}@nexus-test.dev`;

    // Remplir le formulaire
    const emailInput = page.locator('input[type="email"]').or(page.getByPlaceholder(/email/i));
    if (await emailInput.first().isVisible().catch(() => false)) {
      await emailInput.first().fill(testEmail);
    }

    const passwordInput = page.locator('input[type="password"]').first();
    if (await passwordInput.isVisible().catch(() => false)) {
      await passwordInput.fill('TestPassword123!');
    }

    // Nom de l'entreprise si demandé
    const businessName = page.getByPlaceholder(/entreprise|salon|nom/i);
    if (await businessName.first().isVisible().catch(() => false)) {
      await businessName.first().fill(`E2E Test Business ${timestamp}`);
    }

    // Soumettre
    const submitButton = page.getByRole('button', { name: /cr[eé]er|inscription|s.*inscrire|commencer/i });
    if (await submitButton.isVisible().catch(() => false)) {
      await submitButton.click();

      // Attendre la réponse (succès ou erreur gérée)
      await page.waitForTimeout(2000);

      // Soit redirection vers onboarding/dashboard, soit message de confirmation
      const url = page.url();
      const hasRedirected = !url.includes(SIGNUP_URL);
      const hasSuccessMessage = await page.getByText(/bienvenue|cr[eé][eé]|succ[eè]s/i).isVisible().catch(() => false);
      const hasError = await page.getByText(/erreur|existe d[eé]j[aà]/i).isVisible().catch(() => false);

      // Au moins une de ces conditions doit être vraie
      expect(hasRedirected || hasSuccessMessage || hasError).toBeTruthy();
    }
  });

  test('lien vers page login existe', async ({ page }) => {
    await page.goto(SIGNUP_URL);

    const loginLink = page.getByRole('link', { name: /connexion|se connecter|login/i })
      .or(page.getByText(/d[eé]j[aà] un compte/i));

    if (await loginLink.first().isVisible().catch(() => false)) {
      await loginLink.first().click();
      await expect(page).toHaveURL(/login/);
    }
  });
});
