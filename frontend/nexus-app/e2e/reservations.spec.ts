/**
 * Tests E2E - Widget de Reservation NEXUS
 *
 * Teste le flux de reservation cote client
 */

import { test, expect } from './fixtures';

test.describe('Widget de Reservation', () => {
  test.describe('Page de reservation', () => {
    test.skip('affiche le formulaire de reservation', async ({ page }) => {
      // Ce test necessite un tenant valide configure
      await page.goto('/book/test-tenant');

      // Verifier les elements du widget
      await expect(page.locator('text=Reserver')).toBeVisible();
    });
  });

  test.describe('Selection du service', () => {
    test.skip('affiche la liste des services', async ({ page }) => {
      await page.goto('/book/test-tenant');

      // Verifier qu'il y a des services
      const services = page.locator('[data-testid="service-card"]');
      await expect(services.first()).toBeVisible();
    });

    test.skip('permet de selectionner un service', async ({ page }) => {
      await page.goto('/book/test-tenant');

      // Cliquer sur un service
      await page.click('[data-testid="service-card"]:first-child');

      // Verifier que l'etape suivante s'affiche
      await expect(page.locator('text=Choisir une date')).toBeVisible();
    });
  });

  test.describe('Selection de la date', () => {
    test.skip('affiche le calendrier', async ({ page }) => {
      await page.goto('/book/test-tenant');

      // Selectionner un service d'abord
      await page.click('[data-testid="service-card"]:first-child');

      // Verifier le calendrier
      await expect(page.locator('[data-testid="calendar"]')).toBeVisible();
    });

    test.skip('desactive les dates passees', async ({ page }) => {
      await page.goto('/book/test-tenant');
      await page.click('[data-testid="service-card"]:first-child');

      // Les dates passees devraient etre desactivees
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const yesterdayButton = page.locator(`[data-date="${yesterday.toISOString().split('T')[0]}"]`);
      if (await yesterdayButton.count() > 0) {
        await expect(yesterdayButton).toBeDisabled();
      }
    });
  });

  test.describe('Selection du creneau', () => {
    test.skip('affiche les creneaux disponibles', async ({ page }) => {
      await page.goto('/book/test-tenant');

      // Selectionner service
      await page.click('[data-testid="service-card"]:first-child');

      // Selectionner une date future
      await page.click('[data-testid="calendar-day"]:not([disabled]):first-child');

      // Verifier les creneaux
      await expect(page.locator('[data-testid="time-slot"]').first()).toBeVisible();
    });
  });

  test.describe('Formulaire client', () => {
    test.skip('valide les champs requis', async ({ page }) => {
      await page.goto('/book/test-tenant');

      // Naviguer jusqu'au formulaire client
      await page.click('[data-testid="service-card"]:first-child');
      await page.click('[data-testid="calendar-day"]:not([disabled]):first-child');
      await page.click('[data-testid="time-slot"]:first-child');

      // Essayer de soumettre sans remplir
      await page.click('button[type="submit"]');

      // Verifier les validations
      await expect(page.locator('input[name="nom"]')).toHaveAttribute('required', '');
      await expect(page.locator('input[name="email"]')).toHaveAttribute('required', '');
    });
  });

  test.describe('Confirmation', () => {
    test.skip('affiche le resume de la reservation', async ({ page }) => {
      await page.goto('/book/test-tenant');

      // Completer tout le flux
      await page.click('[data-testid="service-card"]:first-child');
      await page.click('[data-testid="calendar-day"]:not([disabled]):first-child');
      await page.click('[data-testid="time-slot"]:first-child');

      // Remplir le formulaire
      await page.fill('input[name="nom"]', 'Test Client');
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="telephone"]', '0612345678');

      // Soumettre
      await page.click('button[type="submit"]');

      // Verifier la confirmation
      await expect(page.locator('text=Reservation confirmee')).toBeVisible({ timeout: 10000 });
    });
  });
});

test.describe('Widget Embeddable', () => {
  test.skip('charge correctement en iframe', async ({ page }) => {
    // Test du widget embeddable
    await page.goto('/embed/test-tenant');

    await expect(page.locator('[data-testid="embed-widget"]')).toBeVisible();
  });
});
