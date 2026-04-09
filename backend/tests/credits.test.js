/**
 * Credits Service — Unit Tests (constantes & logique pure)
 *
 * Modèle 2026 (révisé 9 avril 2026) :
 *   • 1,5€ = 100 crédits (taux interne de référence — 0,015€/crédit)
 *   • Free     = 0 crédit/mois
 *   • Basic    = 1 000 crédits/mois inclus (valeur 15€)
 *   • Business = 10 000 crédits/mois inclus (valeur 150€)
 *
 * Pack unique additionnel :
 *   • Pack 1000 : 15€ → 1 000 crédits (taux base, 0% bonus)
 */

import { jest } from '@jest/globals';
import { CREDIT_COSTS, CREDIT_PACKS, MONTHLY_INCLUDED } from '../src/services/creditsService.js';

describe('CREDIT_COSTS — Tarifs par action IA', () => {
  test('chat IA admin = 4 crédits/question', () => {
    expect(CREDIT_COSTS.chat_admin_question).toBe(4);
  });

  test('WhatsApp IA = 4 crédits/message', () => {
    expect(CREDIT_COSTS.whatsapp_message).toBe(4);
  });

  test('Web chat = 9 crédits/conversation', () => {
    expect(CREDIT_COSTS.web_chat_conversation).toBe(9);
  });

  test('Téléphone IA = 15 crédits/minute', () => {
    expect(CREDIT_COSTS.phone_minute).toBe(15);
  });

  test('Post réseaux IA = 9 crédits', () => {
    expect(CREDIT_COSTS.social_post_generated).toBe(9);
  });

  test('Email IA = 6 crédits', () => {
    expect(CREDIT_COSTS.email_ia_sent).toBe(6);
  });

  test('Article SEO complet = 66 crédits (action la plus chère)', () => {
    expect(CREDIT_COSTS.seo_article).toBe(66);
    // Vérifie que c'est bien la plus chère parmi les actions courantes
    const otherCosts = ['chat_admin_question', 'whatsapp_message', 'web_chat_conversation', 'phone_minute', 'email_ia_sent']
      .map((k) => CREDIT_COSTS[k]);
    otherCosts.forEach((c) => expect(CREDIT_COSTS.seo_article).toBeGreaterThan(c));
  });

  test('Anti-churn SMS FR plus cher que WhatsApp (SMS coûte cher)', () => {
    expect(CREDIT_COSTS.antichurn_sms_fr).toBeGreaterThan(CREDIT_COSTS.antichurn_whatsapp);
  });
});

describe('CREDIT_PACKS — Pack unique (révision 9 avril 2026)', () => {
  test('Pack 1000 = 15€ pour 1 000 crédits (0% bonus)', () => {
    expect(CREDIT_PACKS.pack_1000).toBeDefined();
    expect(CREDIT_PACKS.pack_1000.code).toBe('nexus_credits_1000');
    expect(CREDIT_PACKS.pack_1000.credits).toBe(1000);
    expect(CREDIT_PACKS.pack_1000.price_cents).toBe(1500);
    expect(CREDIT_PACKS.pack_1000.bonus_pct).toBe(0);
  });

  test('Un seul pack disponible (plus de S/M/L)', () => {
    expect(Object.keys(CREDIT_PACKS)).toEqual(['pack_1000']);
  });

  test('Aucun pack legacy S/M/L ne subsiste', () => {
    expect(CREDIT_PACKS.pack_s).toBeUndefined();
    expect(CREDIT_PACKS.pack_m).toBeUndefined();
    expect(CREDIT_PACKS.pack_l).toBeUndefined();
  });

  test('Taux base : 1,5€ = 100 crédits (Pack 1000 = taux base)', () => {
    const euroPerCredit = CREDIT_PACKS.pack_1000.price_cents / 100 / CREDIT_PACKS.pack_1000.credits;
    expect(euroPerCredit).toBeCloseTo(0.015, 4); // 0,015€/crédit
  });
});

describe('MONTHLY_INCLUDED — Crédits inclus mensuels par plan', () => {
  test('Free = 0 crédit inclus (IA bloquée)', () => {
    expect(MONTHLY_INCLUDED.free).toBe(0);
  });

  test('Basic = 1 000 crédits inclus (valeur 15€)', () => {
    expect(MONTHLY_INCLUDED.basic).toBe(1000);
  });

  test('Business = 10 000 crédits inclus (valeur 150€)', () => {
    expect(MONTHLY_INCLUDED.business).toBe(10000);
  });

  test('Aucun plan exotique', () => {
    expect(Object.keys(MONTHLY_INCLUDED).sort()).toEqual(['basic', 'business', 'free']);
  });
});

describe('Cohérence pricing crédits', () => {
  test('1 000 crédits Basic permettent 250 messages WhatsApp', () => {
    expect(Math.floor(MONTHLY_INCLUDED.basic / CREDIT_COSTS.whatsapp_message)).toBe(250);
  });

  test('1 000 crédits Basic permettent ~66 minutes de téléphone IA', () => {
    expect(Math.floor(MONTHLY_INCLUDED.basic / CREDIT_COSTS.phone_minute)).toBe(66);
  });

  test('1 000 crédits Basic permettent 15 articles SEO', () => {
    expect(Math.floor(MONTHLY_INCLUDED.basic / CREDIT_COSTS.seo_article)).toBe(15);
  });

  test('10 000 crédits Business permettent 2 500 messages WhatsApp', () => {
    expect(Math.floor(MONTHLY_INCLUDED.business / CREDIT_COSTS.whatsapp_message)).toBe(2500);
  });

  test('10 000 crédits Business permettent ~666 minutes de téléphone IA', () => {
    expect(Math.floor(MONTHLY_INCLUDED.business / CREDIT_COSTS.phone_minute)).toBe(666);
  });

  test('10 000 crédits Business permettent ~151 articles SEO', () => {
    expect(Math.floor(MONTHLY_INCLUDED.business / CREDIT_COSTS.seo_article)).toBe(151);
  });

  test('Pack 1000 additionnel permet 250 messages WhatsApp', () => {
    expect(Math.floor(CREDIT_PACKS.pack_1000.credits / CREDIT_COSTS.whatsapp_message)).toBe(250);
  });

  test('Valeur 1 000 crédits Basic = 15€ au taux base', () => {
    // 1 000 crédits × 0,015€/crédit = 15€
    expect((MONTHLY_INCLUDED.basic * 0.015).toFixed(2)).toBe('15.00');
  });

  test('Valeur 10 000 crédits Business = 150€ au taux base', () => {
    expect((MONTHLY_INCLUDED.business * 0.015).toFixed(2)).toBe('150.00');
  });
});
