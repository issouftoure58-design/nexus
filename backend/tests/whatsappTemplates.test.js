/**
 * Tests WhatsApp Templates — Format et contenu des messages
 */
import { describe, test, expect } from '@jest/globals';
import {
  confirmationReservation,
  rappelJ1,
  annulation,
  modificationRdv,
  remerciement,
  demandeAvis,
  rappelPaiement,
  expirationPaiement
} from '../src/utils/whatsappTemplates.js';

const MOCK_RDV = {
  client_prenom: 'Jean',
  client_nom: 'Dupont',
  client_telephone: '+33612345678',
  service_nom: 'Coupe homme',
  date: '2026-03-15',
  heure: '10:00',
  duree: 60,
  prix_total: 3500,
  statut: 'confirme'
};

// ════════════════════════════════════════════════
// CONFIRMATION
// ════════════════════════════════════════════════
describe('confirmationReservation', () => {
  test('contient le mot reservation ou confirme', () => {
    const msg = confirmationReservation(MOCK_RDV, 10, 'nexus-test');
    const lower = msg.toLowerCase();
    expect(lower.includes('réservation') || lower.includes('confirmé')).toBe(true);
  });

  test('contient le service', () => {
    const msg = confirmationReservation(MOCK_RDV, 10, 'nexus-test');
    expect(msg).toContain('Coupe homme');
  });

  test('contient l\'heure', () => {
    const msg = confirmationReservation(MOCK_RDV, 10, 'nexus-test');
    expect(msg).toContain('10:00');
  });

  test('retourne une string non vide', () => {
    const msg = confirmationReservation(MOCK_RDV, 10, 'nexus-test');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  test('gere acompte 0', () => {
    const msg = confirmationReservation(MOCK_RDV, 0, 'nexus-test');
    expect(typeof msg).toBe('string');
  });
});

// ════════════════════════════════════════════════
// RAPPEL J-1
// ════════════════════════════════════════════════
describe('rappelJ1', () => {
  test('contient l\'heure du RDV', () => {
    const msg = rappelJ1(MOCK_RDV, 10, 'nexus-test');
    expect(msg).toContain('10:00');
  });

  test('retourne une string non vide', () => {
    const msg = rappelJ1(MOCK_RDV, 10, 'nexus-test');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════
// ANNULATION
// ════════════════════════════════════════════════
describe('annulation', () => {
  test('retourne un message d\'annulation', () => {
    const msg = annulation(MOCK_RDV, 0, 'nexus-test');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  test('contient le prenom', () => {
    const msg = annulation(MOCK_RDV, 0, 'nexus-test');
    expect(msg).toContain('Jean');
  });
});

// ════════════════════════════════════════════════
// MODIFICATION
// ════════════════════════════════════════════════
describe('modificationRdv', () => {
  test('retourne un message de modification', () => {
    const ancien = { ...MOCK_RDV, heure: '09:00' };
    const nouveau = { ...MOCK_RDV, heure: '10:00' };
    const msg = modificationRdv(ancien, nouveau, 'nexus-test');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════
// REMERCIEMENT
// ════════════════════════════════════════════════
describe('remerciement', () => {
  test('contient le prenom', () => {
    const msg = remerciement(MOCK_RDV, 'nexus-test');
    expect(msg).toContain('Jean');
  });

  test('retourne un message non vide', () => {
    const msg = remerciement(MOCK_RDV, 'nexus-test');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════
// DEMANDE AVIS
// ════════════════════════════════════════════════
describe('demandeAvis', () => {
  test('retourne un message non vide', () => {
    const msg = demandeAvis(MOCK_RDV, 'https://avis.example.com', 'nexus-test');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  test('contient le lien avis quand fourni', () => {
    const msg = demandeAvis(MOCK_RDV, 'https://avis.example.com', 'nexus-test');
    expect(msg).toContain('avis.example.com');
  });
});

// ════════════════════════════════════════════════
// RAPPEL PAIEMENT
// ════════════════════════════════════════════════
describe('rappelPaiement', () => {
  test('retourne un message non vide', () => {
    const msg = rappelPaiement(MOCK_RDV, 'https://pay.example.com', 15, 'nexus-test');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════
// EXPIRATION PAIEMENT
// ════════════════════════════════════════════════
describe('expirationPaiement', () => {
  test('retourne un message non vide', () => {
    const msg = expirationPaiement(MOCK_RDV, 'nexus-test');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });
});
