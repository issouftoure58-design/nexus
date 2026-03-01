/**
 * Tests E2E - Site Vitrine NEXUS
 *
 * Teste les pages publiques du site marketing
 */

import { test, expect } from './fixtures';

test.describe('Site Vitrine NEXUS', () => {
  test.describe('Page Accueil', () => {
    test('affiche le hero avec CTA', async ({ page }) => {
      await page.goto('/website');

      // Verifier le titre
      await expect(page.locator('h1')).toContainText('NEXUS');

      // Verifier le CTA principal
      const ctaButton = page.locator('a:has-text("Reserver une demo")').first();
      await expect(ctaButton).toBeVisible();
    });

    test('navigation vers les sections fonctionne', async ({ page }) => {
      await page.goto('/website');

      // Cliquer sur "Voir comment ca marche"
      await page.click('a:has-text("Voir comment")');

      // Verifier le scroll vers la section features
      await expect(page.locator('#features')).toBeInViewport();
    });

    test('affiche les fonctionnalites principales', async ({ page }) => {
      await page.goto('/website');

      // Scroll vers la section features
      await page.locator('#features').scrollIntoViewIfNeeded();

      // Verifier les fonctionnalites cles
      await expect(page.locator('text=Agenda Intelligent')).toBeVisible();
      await expect(page.locator('text=Tous vos clients')).toBeVisible();
    });

    test('affiche les statistiques', async ({ page }) => {
      await page.goto('/website');

      // Verifier les stats
      await expect(page.locator('text=80%')).toBeVisible();
      await expect(page.locator('text=24/7')).toBeVisible();
    });
  });

  test.describe('Page Fonctionnalites', () => {
    test('affiche les categories de fonctionnalites', async ({ page }) => {
      await page.goto('/website/features');

      // Verifier les categories
      await expect(page.locator('text=Socle de Base')).toBeVisible();
      await expect(page.locator('text=Fonctionnalites Pro')).toBeVisible();
      await expect(page.locator('text=Fonctionnalites Business')).toBeVisible();
    });

    test('affiche les benefices', async ({ page }) => {
      await page.goto('/website/features');

      // Verifier les benefices
      await expect(page.locator('text=10h/semaine')).toBeVisible();
      await expect(page.locator('text=Disponible 24/7')).toBeVisible();
    });
  });

  test.describe('Page Tarifs', () => {
    test('affiche les 3 plans', async ({ page }) => {
      await page.goto('/website/pricing');

      // Verifier les plans
      await expect(page.locator('text=Starter')).toBeVisible();
      await expect(page.locator('text=Pro')).toBeVisible();
      await expect(page.locator('text=Business')).toBeVisible();
    });

    test('affiche les prix corrects', async ({ page }) => {
      await page.goto('/website/pricing');

      // Verifier les prix (mode mensuel)
      await expect(page.locator('text=99')).toBeVisible();
      await expect(page.locator('text=249')).toBeVisible();
      await expect(page.locator('text=499')).toBeVisible();
    });

    test('toggle mensuel/annuel fonctionne', async ({ page }) => {
      await page.goto('/website/pricing');

      // Cliquer sur Annuel
      await page.click('button:has-text("Annuel")');

      // Verifier que les economies sont affichees
      await expect(page.locator('text=Economisez')).toBeVisible();
    });

    test('affiche les modules metier', async ({ page }) => {
      await page.goto('/website/pricing');

      // Verifier les modules
      await expect(page.locator('text=Restaurant Pro')).toBeVisible();
      await expect(page.locator('text=Hotel Pro')).toBeVisible();
      await expect(page.locator('text=Domicile Pro')).toBeVisible();
    });

    test('affiche la FAQ', async ({ page }) => {
      await page.goto('/website/pricing');

      // Scroll vers la FAQ
      await page.locator('text=Questions frequentes').scrollIntoViewIfNeeded();

      // Verifier quelques questions
      await expect(page.locator('text=engagement minimum')).toBeVisible();
      await expect(page.locator('text=essai gratuit')).toBeVisible();
    });
  });

  test.describe('Page Contact', () => {
    test('affiche le formulaire de contact', async ({ page }) => {
      await page.goto('/website/contact');

      // Verifier les champs du formulaire
      await expect(page.locator('input[type="text"]').first()).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('textarea')).toBeVisible();
    });

    test('validation du formulaire fonctionne', async ({ page }) => {
      await page.goto('/website/contact');

      // Soumettre le formulaire vide
      await page.click('button[type="submit"]');

      // Verifier que les champs requis sont invalides
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toHaveAttribute('required', '');
    });

    test('affiche les coordonnees', async ({ page }) => {
      await page.goto('/website/contact');

      // Verifier les infos de contact
      await expect(page.locator('text=contact@nexus.app')).toBeVisible();
      await expect(page.locator('text=Franconville')).toBeVisible();
    });
  });

  test.describe('Pages Legales', () => {
    test('page CGU accessible', async ({ page }) => {
      await page.goto('/website/terms');

      await expect(page.locator('h1')).toContainText('Conditions');
      await expect(page.locator('text=NEXUS SAS')).toBeVisible();
    });

    test('page Confidentialite accessible', async ({ page }) => {
      await page.goto('/website/privacy');

      await expect(page.locator('h1')).toContainText('Confidentialite');
      await expect(page.locator('text=RGPD')).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test('menu desktop fonctionne', async ({ page }) => {
      await page.goto('/website');

      // Verifier les liens du menu
      await expect(page.locator('nav >> text=Accueil')).toBeVisible();
      await expect(page.locator('nav >> text=Tarifs')).toBeVisible();
      await expect(page.locator('nav >> text=Contact')).toBeVisible();
    });

    test('menu mobile fonctionne', async ({ page }) => {
      // Simuler un ecran mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/website');

      // Ouvrir le menu mobile
      await page.click('button:has-text("Menu")').catch(() => {
        // Essayer avec l'icone hamburger
        page.click('[data-testid="mobile-menu-toggle"]');
      });

      // Le menu devrait etre visible
      await expect(page.locator('text=Tarifs')).toBeVisible();
    });

    test('footer contient les liens legaux', async ({ page }) => {
      await page.goto('/website');

      // Scroll vers le footer
      await page.locator('footer').scrollIntoViewIfNeeded();

      // Verifier les liens
      await expect(page.locator('footer >> text=Conditions')).toBeVisible();
      await expect(page.locator('footer >> text=Confidentialite')).toBeVisible();
    });
  });
});
