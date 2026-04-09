#!/usr/bin/env node
/**
 * Backfill correctif post-migration 107 :
 *
 * Migration 104 a marqué TOUS les tenants existants comme `legacy_pricing = TRUE`
 * pour les protéger des changements futurs. Migration 107 a un WHERE clause
 * `legacy_pricing = FALSE` qui exclut donc tous les tenants existants.
 *
 * Décision 9 avril 2026 (utilisateur) : « le tenant doit voir la même chose
 * partout, virer les anciens pour ne pas se tromper ». On veut donc TOUS les
 * tenants sur le nouveau modèle.
 *
 * Ce script :
 *   1) Désactive le flag legacy_pricing pour tous les tenants Business/Basic
 *   2) Met à jour ai_credits.monthly_included (10000 Business / 500 Basic)
 *   3) Crédite le différentiel (top-up immédiat)
 *   4) Insère une trace dans ai_credits_transactions
 *
 * Idempotent : ne re-crédite pas si monthly_included est déjà à la bonne valeur.
 */
import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

console.log('═══ État AVANT backfill ═══');
const beforeBiz = await client.query(`
  SELECT COUNT(*) FILTER (WHERE t.legacy_pricing) AS legacy,
         COUNT(*) FILTER (WHERE NOT t.legacy_pricing) AS non_legacy,
         AVG(ac.monthly_included)::int AS avg_included
    FROM tenants t
    JOIN ai_credits ac ON ac.tenant_id = t.id
   WHERE LOWER(COALESCE(t.plan, '')) = 'business'
`);
console.log('  Business :', beforeBiz.rows[0]);

const beforeBasic = await client.query(`
  SELECT COUNT(*) FILTER (WHERE t.legacy_pricing) AS legacy,
         COUNT(*) FILTER (WHERE NOT t.legacy_pricing) AS non_legacy,
         AVG(ac.monthly_included)::int AS avg_included
    FROM tenants t
    JOIN ai_credits ac ON ac.tenant_id = t.id
   WHERE LOWER(COALESCE(t.plan, '')) = 'basic'
`);
console.log('  Basic    :', beforeBasic.rows[0]);

await client.query('BEGIN');
try {
  // ──────────────────────────────────────────────────────────────────────
  // BUSINESS : legacy → FALSE, monthly_included → 10000, top-up balance
  // ──────────────────────────────────────────────────────────────────────
  const r1 = await client.query(`
    UPDATE tenants
       SET legacy_pricing = FALSE,
           updated_at = NOW()
     WHERE LOWER(COALESCE(plan, '')) = 'business'
       AND legacy_pricing = TRUE
  `);
  console.log(`\n✓ Business : ${r1.rowCount} tenants → legacy_pricing = FALSE`);

  const r2 = await client.query(`
    UPDATE ai_credits ac
       SET monthly_included = 10000,
           balance = ac.balance + GREATEST(0, 10000 - ac.monthly_included),
           updated_at = NOW()
      FROM tenants t
     WHERE ac.tenant_id = t.id
       AND LOWER(COALESCE(t.plan, '')) = 'business'
       AND ac.monthly_included < 10000
  `);
  console.log(`✓ Business : ${r2.rowCount} ai_credits.monthly_included → 10000 (avec top-up)`);

  if (r2.rowCount > 0) {
    const r3 = await client.query(`
      INSERT INTO ai_credits_transactions (tenant_id, type, amount, balance_after, source, description, metadata)
      SELECT ac.tenant_id,
             'bonus',
             6500,
             ac.balance,
             'migration_107_backfill',
             'Backfill révision 9 avril 2026 : Business passe à 10 000 crédits inclus/mois',
             '{"migration": "107_backfill", "plan": "business"}'::jsonb
        FROM ai_credits ac
        JOIN tenants t ON t.id = ac.tenant_id
       WHERE LOWER(COALESCE(t.plan, '')) = 'business'
         AND ac.monthly_included = 10000
    `);
    console.log(`✓ Business : ${r3.rowCount} transactions de bonus créées`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // BASIC : legacy → FALSE, monthly_included → 500, top-up balance
  // ──────────────────────────────────────────────────────────────────────
  const b1 = await client.query(`
    UPDATE tenants
       SET legacy_pricing = FALSE,
           updated_at = NOW()
     WHERE LOWER(COALESCE(plan, '')) = 'basic'
       AND legacy_pricing = TRUE
  `);
  console.log(`\n✓ Basic : ${b1.rowCount} tenants → legacy_pricing = FALSE`);

  const b2 = await client.query(`
    UPDATE ai_credits ac
       SET monthly_included = 500,
           balance = ac.balance + GREATEST(0, 500 - ac.monthly_included),
           updated_at = NOW()
      FROM tenants t
     WHERE ac.tenant_id = t.id
       AND LOWER(COALESCE(t.plan, '')) = 'basic'
       AND ac.monthly_included < 500
  `);
  console.log(`✓ Basic : ${b2.rowCount} ai_credits.monthly_included → 500 (avec top-up)`);

  if (b2.rowCount > 0) {
    const b3 = await client.query(`
      INSERT INTO ai_credits_transactions (tenant_id, type, amount, balance_after, source, description, metadata)
      SELECT ac.tenant_id,
             'bonus',
             500,
             ac.balance,
             'migration_107_backfill',
             'Backfill révision 9 avril 2026 : Basic passe à 500 crédits inclus/mois',
             '{"migration": "107_backfill", "plan": "basic"}'::jsonb
        FROM ai_credits ac
        JOIN tenants t ON t.id = ac.tenant_id
       WHERE LOWER(COALESCE(t.plan, '')) = 'basic'
         AND ac.monthly_included = 500
    `);
    console.log(`✓ Basic : ${b3.rowCount} transactions de bonus créées`);
  }

  await client.query('COMMIT');
  console.log('\n✅ COMMIT OK');
} catch (e) {
  await client.query('ROLLBACK');
  console.error('\n❌ ROLLBACK :', e.message);
  process.exit(1);
}

console.log('\n═══ État APRÈS backfill ═══');
const after = await client.query(`
  SELECT t.plan, t.id, t.legacy_pricing, ac.monthly_included, ac.balance
    FROM tenants t
    JOIN ai_credits ac ON ac.tenant_id = t.id
   WHERE LOWER(COALESCE(t.plan, '')) IN ('business', 'basic')
   ORDER BY t.plan, t.created_at DESC
   LIMIT 20
`);
after.rows.forEach((r) =>
  console.log(`  ${r.plan} | ${r.id.padEnd(40)} | legacy=${r.legacy_pricing} | included=${r.monthly_included} | balance=${r.balance}`)
);

await client.end();
