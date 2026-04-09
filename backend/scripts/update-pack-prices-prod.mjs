#!/usr/bin/env node
/**
 * Révision finale pricing 2026 (9 avril 2026) — voir memory/business-model-2026.md.
 *
 * Ce script :
 *   1) Supprime les anciens Packs S/M/L de stripe_products
 *   2) Crée le pack unique 'nexus_credits_1000' (15€ → 1 000 crédits, 0% bonus)
 *   3) Met à jour le plan Business : 129€/mois → 149€/mois (+ yearly 1290€ → 1490€)
 *
 * Les migrations SQL (104 puis 107) sont la source de vérité ; ce script
 * est la procédure idempotente de secours à exécuter en prod si la migration
 * 107 n'a pas encore été appliquée via le pipeline normal.
 */
import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

console.log('═══ État AVANT mise à jour ═══');
const beforePacks = await client.query(
  "SELECT product_code, name, description, amount, active, metadata FROM stripe_products WHERE product_code LIKE 'nexus_credits%' ORDER BY product_code"
);
beforePacks.rows.forEach((r) =>
  console.log(`  ${r.product_code} | ${r.name} | ${r.amount} cents (${r.amount / 100}€) | active=${r.active} | ${JSON.stringify(r.metadata)}`)
);
const beforeBiz = await client.query(
  "SELECT product_code, amount FROM stripe_products WHERE product_code LIKE 'nexus_business%' ORDER BY product_code"
);
beforeBiz.rows.forEach((r) => console.log(`  ${r.product_code} | ${r.amount} cents (${r.amount / 100}€)`));
const beforeBizPlan = await client.query("SELECT id, prix_mensuel, credits_ia_inclus FROM plans WHERE id = 'business'");
beforeBizPlan.rows.forEach((r) => console.log(`  plans.business | ${r.prix_mensuel} cents | ${r.credits_ia_inclus} crédits inclus`));

await client.query('BEGIN');
try {
  // 1. Supprime les anciens packs S/M/L (désactive d'abord pour les éventuels refs historiques)
  await client.query(
    `UPDATE stripe_products SET active = FALSE, updated_at = NOW()
      WHERE product_code IN ('nexus_credits_s','nexus_credits_m','nexus_credits_l')`
  );
  const del = await client.query(
    `DELETE FROM stripe_products WHERE product_code IN ('nexus_credits_s','nexus_credits_m','nexus_credits_l')`
  );
  console.log(`\n✓ ${del.rowCount} ancien(s) Pack S/M/L supprimé(s)`);

  // 2. Crée le pack unique 1000
  const pack = await client.query(
    `INSERT INTO stripe_products (product_code, name, description, type, billing_type, amount, interval, trial_days, metadata, active)
     VALUES ('nexus_credits_1000', 'Pack 1000 crédits', '1 000 crédits IA (taux base, sans bonus)', 'pack', 'one_time', 1500, NULL, 0, '{"credits": 1000, "tier": "unique", "bonus_pct": 0}'::jsonb, TRUE)
     ON CONFLICT (product_code) DO UPDATE SET
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       amount = EXCLUDED.amount,
       metadata = EXCLUDED.metadata,
       active = TRUE,
       updated_at = NOW()`
  );
  console.log(`✓ ${pack.rowCount} ligne Pack 1000 (UPSERT)`);

  // 3. Met à jour le plan Business — stripe_products
  const biz = await client.query(
    `UPDATE stripe_products
        SET amount = 14900,
            description = 'Plan Business — multi-site + 10 000 crédits IA/mois',
            updated_at = NOW()
      WHERE product_code = 'nexus_business_monthly'`
  );
  const bizY = await client.query(
    `UPDATE stripe_products
        SET amount = 149000,
            description = 'Plan Business annuel — 2 mois offerts (1 490€/an)',
            updated_at = NOW()
      WHERE product_code = 'nexus_business_yearly'`
  );
  console.log(`✓ ${biz.rowCount} ligne Business mensuel mise à jour (12900 → 14900)`);
  console.log(`✓ ${bizY.rowCount} ligne Business annuel mise à jour (129000 → 149000)`);

  // 4. Met à jour le plan Business — table plans (prix + crédits inclus)
  const bizPlan = await client.query(
    `UPDATE plans
        SET prix_mensuel = 14900,
            credits_ia_inclus = 10000,
            description = 'Multi-site illimité, white-label, API + 10 000 crédits IA inclus/mois',
            updated_at = NOW()
      WHERE id = 'business'`
  );
  console.log(`✓ ${bizPlan.rowCount} ligne plans.business mise à jour (credits 3500 → 10000)`);

  // 5. Met à jour le plan Basic — credits inclus
  const basicPlan = await client.query(
    `UPDATE plans
        SET credits_ia_inclus = 500,
            description = 'Tout illimité — 500 crédits IA inclus/mois + pack additionnel',
            updated_at = NOW()
      WHERE id = 'basic'`
  );
  console.log(`✓ ${basicPlan.rowCount} ligne plans.basic mise à jour (credits 0 → 500)`);

  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  console.error('✗ Echec :', e.message);
  process.exit(1);
}

console.log('\n═══ État APRÈS mise à jour ═══');
const afterPacks = await client.query(
  "SELECT product_code, name, description, amount, active, metadata FROM stripe_products WHERE product_code LIKE 'nexus_credits%' ORDER BY product_code"
);
afterPacks.rows.forEach((r) =>
  console.log(`  ${r.product_code} | ${r.name} | ${r.amount} cents (${r.amount / 100}€) | active=${r.active} | ${JSON.stringify(r.metadata)}`)
);
const afterBiz = await client.query(
  "SELECT product_code, amount FROM stripe_products WHERE product_code LIKE 'nexus_business%' ORDER BY product_code"
);
afterBiz.rows.forEach((r) => console.log(`  ${r.product_code} | ${r.amount} cents (${r.amount / 100}€)`));
const afterBizPlan = await client.query("SELECT id, prix_mensuel, credits_ia_inclus FROM plans WHERE id IN ('basic','business') ORDER BY ordre");
afterBizPlan.rows.forEach((r) => console.log(`  plans.${r.id} | ${r.prix_mensuel} cents | ${r.credits_ia_inclus} crédits inclus`));

await client.end();
