/**
 * Tests dispoService — Disponibilites et creneaux
 */
import { describe, test, expect } from '@jest/globals';

// dispoService exporte des fonctions pures de calcul
import {
  heureEnMinutes,
  minutesEnHeure,
  blocsSeChevauche,
  getHorairesJour,
  validerHorairesJour
} from '../src/services/dispoService.js';

// ════════════════════════════════════════════════
// CONVERSIONS HEURES
// ════════════════════════════════════════════════
describe('heureEnMinutes', () => {
  test('"09:00" = 540 minutes', () => {
    expect(heureEnMinutes('09:00')).toBe(540);
  });

  test('"13:30" = 810 minutes', () => {
    expect(heureEnMinutes('13:30')).toBe(810);
  });

  test('"00:00" = 0 minutes', () => {
    expect(heureEnMinutes('00:00')).toBe(0);
  });

  test('"23:59" = 1439 minutes', () => {
    expect(heureEnMinutes('23:59')).toBe(1439);
  });
});

describe('minutesEnHeure', () => {
  test('540 = "09:00"', () => {
    expect(minutesEnHeure(540)).toBe('09:00');
  });

  test('810 = "13:30"', () => {
    expect(minutesEnHeure(810)).toBe('13:30');
  });

  test('0 = "00:00"', () => {
    expect(minutesEnHeure(0)).toBe('00:00');
  });
});

// ════════════════════════════════════════════════
// CHEVAUCHEMENT DE BLOCS
// ════════════════════════════════════════════════
describe('blocsSeChevauche', () => {
  test('blocs qui se chevauchent', () => {
    expect(blocsSeChevauche('09:00', '10:00', '09:30', '10:30')).toBe(true);
  });

  test('blocs identiques = chevauchement', () => {
    expect(blocsSeChevauche('09:00', '10:00', '09:00', '10:00')).toBe(true);
  });

  test('blocs consecutifs = pas de chevauchement', () => {
    expect(blocsSeChevauche('09:00', '10:00', '10:00', '11:00')).toBe(false);
  });

  test('blocs separes = pas de chevauchement', () => {
    expect(blocsSeChevauche('09:00', '10:00', '14:00', '15:00')).toBe(false);
  });

  test('bloc contenu dans un autre', () => {
    expect(blocsSeChevauche('09:00', '12:00', '10:00', '11:00')).toBe(true);
  });
});

// ════════════════════════════════════════════════
// HORAIRES PAR JOUR
// ════════════════════════════════════════════════
describe('getHorairesJour', () => {
  test('lundi = ouvert', () => {
    // 2026-03-02 is a Monday
    const h = getHorairesJour('2026-03-02');
    expect(h).not.toBeNull();
    if (h) {
      expect(h.debut).toBeDefined();
      expect(h.fin).toBeDefined();
    }
  });

  test('dimanche = ferme', () => {
    // 2026-03-01 is a Sunday
    const h = getHorairesJour('2026-03-01');
    expect(h).toBeNull();
  });
});

// ════════════════════════════════════════════════
// VALIDATION HORAIRES
// ════════════════════════════════════════════════
describe('validerHorairesJour', () => {
  test('lundi 10:00 1h = valide', () => {
    const r = validerHorairesJour('2026-03-02', '10:00', 60);
    expect(r.valide).toBe(true);
  });

  test('dimanche = invalide (ferme)', () => {
    const r = validerHorairesJour('2026-03-01', '10:00', 60);
    expect(r.valide).toBe(false);
  });

  test('lundi 23:00 = invalide (hors horaires)', () => {
    const r = validerHorairesJour('2026-03-02', '23:00', 60);
    expect(r.valide).toBe(false);
  });
});
