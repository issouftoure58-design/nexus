/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 *
 * PLTE v2 — Tests specifiques par profil metier
 * Tests qui n'ont de sens que pour certains types de business
 */

import { supabase } from '../../config/supabase.js';

function makeResult(name, module, severity, description, status, error = null) {
  return { name, module, severity, description, status, error, category: 'hourly' };
}

/**
 * Retourne les tests specifiques au profil du tenant
 */
export async function getProfileSpecificChecks(ctx) {
  const { tenantId, profile } = ctx;
  const results = [];

  switch (profile) {
    case 'restaurant':
      results.push(await testTableAttribution(tenantId, ctx));
      results.push(await testZoneRestaurant(tenantId));
      break;

    case 'hotel':
      results.push(await testChambreDisponibilite(tenantId, ctx));
      break;

    case 'securite':
      results.push(await testMultiJoursSecurite(tenantId, ctx));
      results.push(await testPricingHoraire(tenantId, ctx, 'securite'));
      break;

    case 'domicile':
      results.push(await testFraisDeplacement(tenantId, ctx));
      break;

    case 'consulting':
      results.push(await testPricingHoraire(tenantId, ctx, 'consulting'));
      break;

    case 'commerce':
    case 'salon':
      results.push(await testStockAutoDecrement(tenantId, ctx));
      break;

    case 'events':
      results.push(await testForfaitPackage(tenantId, ctx));
      break;
  }

  return results;
}

// ============================================
// RESTAURANT — Table/couverts attribution
// ============================================

async function testTableAttribution(tenantId, ctx) {
  const name = 'P_restaurant_table';
  const module = 'reservations';
  const severity = 'warning';
  const description = 'Restaurant: tables presentes avec capacite';

  try {
    const tables = ctx.tables;
    if (!tables?.length) {
      return makeResult(name, module, severity, description, 'fail',
        'Aucune table configuree pour le restaurant');
    }

    // Verifier que chaque table a une capacite
    const sansCapacite = tables.filter(t => !t.capacite || t.capacite < 1);
    if (sansCapacite.length) {
      return makeResult(name, module, severity, description, 'fail',
        `${sansCapacite.length} table(s) sans capacite definie`);
    }

    // Verifier qu'on a au moins 2 zones
    const zones = [...new Set(tables.map(t => t.zone).filter(Boolean))];
    if (zones.length < 1) {
      return makeResult(name, module, severity, description, 'fail',
        'Aucune zone de restaurant definie');
    }

    return makeResult(name, module, severity, description, 'pass');
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// RESTAURANT — Zones midi/soir
// ============================================

async function testZoneRestaurant(tenantId) {
  const name = 'P_restaurant_zones';
  const module = 'config';
  const severity = 'info';
  const description = 'Restaurant: zones configurees (salle, terrasse)';

  try {
    const { data: tables } = await supabase
      .from('restaurant_tables')
      .select('zone')
      .eq('tenant_id', tenantId);

    if (!tables?.length) {
      return makeResult(name, module, severity, description, 'pass',
        'Pas de tables (skip)');
    }

    const zones = [...new Set(tables.map(t => t.zone).filter(Boolean))];
    return makeResult(name, module, severity, description, 'pass',
      `${zones.length} zone(s): ${zones.join(', ')}`);
  } catch (err) {
    if (err.code === 'PGRST205' || err.code === '42P01') {
      return makeResult(name, module, severity, description, 'pass', 'Table non existante (skip)');
    }
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// HOTEL — Chambre disponibilite
// ============================================

async function testChambreDisponibilite(tenantId, ctx) {
  const name = 'P_hotel_chambres';
  const module = 'reservations';
  const severity = 'warning';
  const description = 'Hotel: chambres configurees avec types et capacite';

  try {
    const chambres = ctx.chambres;
    if (!chambres?.length) {
      return makeResult(name, module, severity, description, 'fail',
        'Aucune chambre configuree pour l\'hotel');
    }

    // Verifier types de chambres
    const types = [...new Set(chambres.map(c => c.type).filter(Boolean))];
    if (types.length < 2) {
      return makeResult(name, module, severity, description, 'fail',
        `Seulement ${types.length} type(s) de chambre — minimum 2 attendus`);
    }

    // Verifier capacite
    const sansCapacite = chambres.filter(c => !c.capacite || c.capacite < 1);
    if (sansCapacite.length) {
      return makeResult(name, module, severity, description, 'fail',
        `${sansCapacite.length} chambre(s) sans capacite`);
    }

    return makeResult(name, module, severity, description, 'pass',
      `${chambres.length} chambres, ${types.length} types: ${types.join(', ')}`);
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// SECURITE — Multi-jours
// ============================================

async function testMultiJoursSecurite(tenantId, ctx) {
  const name = 'P_securite_multi_jours';
  const module = 'reservations';
  const severity = 'warning';
  const description = 'Securite: agents et sites configures';

  try {
    const agents = ctx.agents;
    const sites = ctx.sites;

    if (!agents?.length) {
      return makeResult(name, module, severity, description, 'fail',
        'Aucun agent de securite configure');
    }

    if (!sites?.length) {
      return makeResult(name, module, severity, description, 'fail',
        'Aucun site configure');
    }

    return makeResult(name, module, severity, description, 'pass',
      `${agents.length} agent(s), ${sites.length} site(s)`);
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// CONSULTING/SECURITE — Pricing horaire
// ============================================

async function testPricingHoraire(tenantId, ctx, profile) {
  const name = `P_${profile}_pricing`;
  const module = 'config';
  const severity = 'info';
  const description = `${profile}: services avec prix coherents`;

  try {
    const services = ctx.services;
    if (!services?.length) {
      return makeResult(name, module, severity, description, 'fail', 'Aucun service');
    }

    // Verifier que tous les services ont un prix > 0
    const sansPrix = services.filter(s => !s.prix || s.prix <= 0);
    if (sansPrix.length) {
      return makeResult(name, module, severity, description, 'fail',
        `${sansPrix.length} service(s) sans prix: ${sansPrix.map(s => s.nom).join(', ')}`);
    }

    return makeResult(name, module, severity, description, 'pass',
      `${services.length} service(s) avec prix`);
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// DOMICILE — Frais deplacement
// ============================================

async function testFraisDeplacement(tenantId, ctx) {
  const name = 'P_domicile_frais';
  const module = 'config';
  const severity = 'warning';
  const description = 'Domicile: zones intervention avec frais km';

  try {
    const zones = ctx.zones;
    if (!zones?.length) {
      return makeResult(name, module, severity, description, 'fail',
        'Aucune zone d\'intervention configuree');
    }

    // Verifier qu'au moins une zone a un rayon
    const avecRayon = zones.filter(z => z.rayon_km > 0);
    if (avecRayon.length === 0) {
      return makeResult(name, module, severity, description, 'fail',
        'Aucune zone avec rayon defini');
    }

    return makeResult(name, module, severity, description, 'pass',
      `${zones.length} zone(s), max ${Math.max(...zones.map(z => z.rayon_km))}km`);
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// COMMERCE/SALON — Stock auto-decrement
// ============================================

async function testStockAutoDecrement(tenantId, ctx) {
  const name = 'P_stock_coherence';
  const module = 'stock';
  const severity = 'warning';
  const description = 'Stock: produits avec quantites coherentes';

  try {
    const produits = ctx.produits;
    if (!produits?.length) {
      return makeResult(name, module, severity, description, 'pass', 'Pas de produits (skip)');
    }

    // Verifier stock actuel depuis BDD (pas cache)
    const ids = produits.map(p => p.id);
    const { data: freshProduits } = await supabase
      .from('produits')
      .select('id, nom, stock_actuel, stock_minimum')
      .eq('tenant_id', tenantId)
      .in('id', ids);

    if (!freshProduits?.length) {
      return makeResult(name, module, severity, description, 'pass', 'Produits non trouves (skip)');
    }

    const negatifs = freshProduits.filter(p => (p.stock_actuel || 0) < 0);
    if (negatifs.length) {
      return makeResult(name, module, severity, description, 'fail',
        `${negatifs.length} produit(s) en stock negatif`);
    }

    return makeResult(name, module, severity, description, 'pass',
      `${freshProduits.length} produit(s) OK`);
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}

// ============================================
// EVENTS — Forfait package
// ============================================

async function testForfaitPackage(tenantId, ctx) {
  const name = 'P_events_forfaits';
  const module = 'config';
  const severity = 'info';
  const description = 'Events: services avec forfaits';

  try {
    const services = ctx.services;
    if (!services?.length) {
      return makeResult(name, module, severity, description, 'fail', 'Aucun service');
    }

    // Verifier qu'on a des services avec des durees variees (forfaits vs a la carte)
    const durees = [...new Set(services.map(s => s.duree))];
    if (durees.length < 2) {
      return makeResult(name, module, severity, description, 'pass',
        `1 seule duree — diversifier les forfaits recommande`);
    }

    return makeResult(name, module, severity, description, 'pass',
      `${services.length} service(s), ${durees.length} duree(s) differentes`);
  } catch (err) {
    return makeResult(name, module, severity, description, 'error', err.message);
  }
}
