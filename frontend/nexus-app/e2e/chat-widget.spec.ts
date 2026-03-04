/**
 * Tests E2E - Chat Widget IA NEXUS
 *
 * Teste le widget de chat IA sur le site vitrine
 */

import { test, expect } from './fixtures';

test.describe('Chat Widget IA', () => {
  test.describe('Affichage du widget', () => {
    test('affiche le bouton de chat sur le site vitrine', async ({ page }) => {
      await page.goto('/website');

      // Le bouton de chat devrait etre visible
      const chatButton = page.locator('[data-testid="chat-widget-button"]');
      await expect(chatButton).toBeVisible();
    });

    test('ouvre le chat au clic', async ({ page }) => {
      await page.goto('/website');

      // Cliquer sur le bouton
      await page.click('[data-testid="chat-widget-button"]');

      // Le panel de chat devrait s ouvrir
      await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible();
    });

    test('ferme le chat au clic sur X', async ({ page }) => {
      await page.goto('/website');

      // Ouvrir
      await page.click('[data-testid="chat-widget-button"]');
      await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible();

      // Fermer
      await page.click('[data-testid="chat-close-button"]');
      await expect(page.locator('[data-testid="chat-panel"]')).not.toBeVisible();
    });
  });

  test.describe('Interface de chat', () => {
    test('affiche le champ de saisie', async ({ page }) => {
      await page.goto('/website');
      await page.click('[data-testid="chat-widget-button"]');

      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    });

    test('affiche le message de bienvenue', async ({ page }) => {
      await page.goto('/website');
      await page.click('[data-testid="chat-widget-button"]');

      // Un message de bienvenue devrait s afficher
      const welcomeMessage = page.locator('[data-testid="chat-message"]').first();
      await expect(welcomeMessage).toBeVisible();
    });

    test('permet d envoyer un message', async ({ page }) => {
      await page.goto('/website');
      await page.click('[data-testid="chat-widget-button"]');

      // Saisir un message
      await page.fill('[data-testid="chat-input"]', 'Bonjour, quels sont vos tarifs?');

      // Envoyer (bouton ou Enter)
      await page.click('[data-testid="chat-send-button"]');

      // Le message devrait apparaitre dans le chat
      await expect(page.locator('text=Bonjour, quels sont vos tarifs?')).toBeVisible();
    });
  });

  test.describe('Reponses IA', () => {
    test.skip('repond avec les tarifs quand demande', async ({ page }) => {
      await page.goto('/website');
      await page.click('[data-testid="chat-widget-button"]');

      // Demander les tarifs
      await page.fill('[data-testid="chat-input"]', 'Quels sont vos prix?');
      await page.click('[data-testid="chat-send-button"]');

      // Attendre une reponse de l IA (timeout plus long car API)
      const aiResponse = page.locator('[data-testid="chat-message-ai"]').last();
      await expect(aiResponse).toBeVisible({ timeout: 30000 });

      // La reponse devrait mentionner les prix
      await expect(aiResponse).toContainText(/99|249|499/);
    });

    test.skip('propose de reserver une demo', async ({ page }) => {
      await page.goto('/website');
      await page.click('[data-testid="chat-widget-button"]');

      // Demander une demo
      await page.fill('[data-testid="chat-input"]', 'Je voudrais une demonstration');
      await page.click('[data-testid="chat-send-button"]');

      // Attendre la reponse
      const aiResponse = page.locator('[data-testid="chat-message-ai"]').last();
      await expect(aiResponse).toBeVisible({ timeout: 30000 });

      // Devrait proposer de reserver
      await expect(aiResponse).toContainText(/demo|reservation|contact/i);
    });
  });

  test.describe('Mobile', () => {
    test('fonctionne sur mobile', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/website');

      // Le bouton devrait etre visible
      const chatButton = page.locator('[data-testid="chat-widget-button"]');
      await expect(chatButton).toBeVisible();

      // Ouvrir le chat
      await page.click('[data-testid="chat-widget-button"]');

      // Le panel devrait prendre tout l ecran sur mobile
      const chatPanel = page.locator('[data-testid="chat-panel"]');
      await expect(chatPanel).toBeVisible();
    });
  });
});
