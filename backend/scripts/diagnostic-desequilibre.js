import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

console.log('ENV check:', process.env.SUPABASE_URL ? 'URL OK' : 'URL MISSING', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'KEY OK' : 'KEY MISSING');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function diagnostic() {
  // Trouver le tenant Salon Elegance Paris
  // Lister tous les tenants pour trouver le bon
  const { data: allTenants, error: errT } = await supabase.from('tenants').select('*').limit(20);
  if (errT) console.error('Erreur tenants:', errT);
  console.log('Tenants disponibles:');
  if (allTenants?.[0]) console.log('Colonnes:', Object.keys(allTenants[0]).join(', '));
  allTenants?.forEach(t => console.log(`  ${t.id} — ${t.name || t.nom || t.business_name || JSON.stringify(t).slice(0, 80)}`));

  // Trouver Salon Elegance ou utiliser le premier tenant
  const { data: tenants } = await supabase.from('tenants').select('*');
  const elegance = tenants?.find(t => t.name?.toLowerCase().includes('elegance') || t.name?.toLowerCase().includes('élégance') || t.name?.toLowerCase().includes('salon'));
  const tenantId = elegance?.id || tenants?.[0]?.id;
  console.log('\nTenant selectionne:', elegance?.name || tenants?.[0]?.name, tenantId);

  if (!tenantId) {
    console.error('Aucun tenant trouve');
    return;
  }

  // Toutes les ecritures
  const { data: ecritures, error } = await supabase
    .from('ecritures_comptables')
    .select('id, numero_piece, journal_code, compte_numero, compte_libelle, libelle, debit, credit, date_ecriture, periode, depense_id, facture_id')
    .eq('tenant_id', tenantId)
    .order('numero_piece');

  if (error) {
    console.error('Erreur:', error);
    return;
  }

  console.log(`\nTotal ecritures: ${ecritures.length}\n`);

  const byPiece = {};
  for (const e of ecritures) {
    if (!byPiece[e.numero_piece]) byPiece[e.numero_piece] = [];
    byPiece[e.numero_piece].push(e);
  }

  let totalGap = 0;
  let nbDeseq = 0;
  const piecesDeseq = [];

  for (const [piece, entries] of Object.entries(byPiece)) {
    const totalD = entries.reduce((s, e) => s + (e.debit || 0), 0);
    const totalC = entries.reduce((s, e) => s + (e.credit || 0), 0);
    const gap = totalD - totalC;
    if (Math.abs(gap) > 1) {
      nbDeseq++;
      totalGap += gap;
      piecesDeseq.push({ piece, gap, entries });
    }
  }

  for (const { piece, gap, entries } of piecesDeseq) {
    const totalD = entries.reduce((s, e) => s + (e.debit || 0), 0);
    const totalC = entries.reduce((s, e) => s + (e.credit || 0), 0);
    console.log(`\n=== PIECE ${piece} — gap: ${(gap / 100).toFixed(2)}EUR (D=${totalD} C=${totalC}) ===`);
    entries.forEach(e => {
      console.log(`  ${e.journal_code} | ${e.compte_numero} ${(e.compte_libelle || '').slice(0, 25).padEnd(25)} | D=${String(e.debit || 0).padStart(8)} C=${String(e.credit || 0).padStart(8)} | ${(e.libelle || '').slice(0, 45)} | ${e.date_ecriture} | dep=${e.depense_id || '-'} fac=${e.facture_id || '-'}`);
    });
  }

  console.log(`\n=== RESUME ===`);
  console.log(`${nbDeseq} pieces desequilibrees, gap total: ${(totalGap / 100).toFixed(2)} EUR`);

  // Aussi verifier le total global
  const totalDebitGlobal = ecritures.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCreditGlobal = ecritures.reduce((s, e) => s + (e.credit || 0), 0);
  console.log(`Total global: D=${totalDebitGlobal} C=${totalCreditGlobal} gap=${((totalDebitGlobal - totalCreditGlobal) / 100).toFixed(2)} EUR`);
}

diagnostic().catch(console.error);
