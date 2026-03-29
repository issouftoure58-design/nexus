import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: new URL('../.env', import.meta.url).pathname });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const tenantId = 'nexus-test';
  const periode = '2025-12';
  // Prefix lettrage pour dec 2025 : RA1225-xxx et RG1225-xxx
  const prefixRA = 'RA1225';
  const prefixRG = 'RG1225';

  console.log('=== DEVERROUILLAGE RAPPROCHEMENT DECEMBRE 2025 ===\n');

  // 1. Supprimer les ecritures RA-* de decembre (creees par le rapprochement)
  const { data: raEntries } = await supabase
    .from('ecritures_comptables')
    .select('id, compte_numero, libelle, debit, credit, lettrage, numero_piece')
    .eq('tenant_id', tenantId)
    .eq('journal_code', 'BQ')
    .eq('periode', periode)
    .like('numero_piece', 'RA-%');

  console.log(`Ecritures RA-* a supprimer: ${(raEntries || []).length}`);
  (raEntries || []).forEach(e => {
    console.log(`  ${e.id} ${e.compte_numero} ${e.numero_piece} ${e.libelle.substring(0, 40)} D:${e.debit/100} C:${e.credit/100} L:${e.lettrage || '-'}`);
  });

  if (raEntries && raEntries.length > 0) {
    const ids = raEntries.map(e => e.id);
    const { error } = await supabase
      .from('ecritures_comptables')
      .delete()
      .in('id', ids);
    if (error) throw error;
    console.log(`\n${ids.length} ecritures RA-* supprimees.`);
  }

  // 2. Retirer TOUS les lettrages RA1225/RG1225 sur les ecritures 512/BQ (TOUTES periodes)
  // Un auto-match peut pointer une ecriture d'octobre pendant le rapprochement de decembre
  const { data: lettreesRA } = await supabase
    .from('ecritures_comptables')
    .select('id, libelle, lettrage, date_ecriture, periode')
    .eq('tenant_id', tenantId)
    .eq('journal_code', 'BQ')
    .eq('compte_numero', '512')
    .or(`lettrage.like.${prefixRA}%,lettrage.like.${prefixRG}%`);

  console.log(`\nLettrages ${prefixRA}*/RG* a retirer (toutes periodes): ${(lettreesRA || []).length}`);
  (lettreesRA || []).forEach(e => {
    console.log(`  ${e.id} P:${e.periode} ${e.libelle.substring(0, 40)} L:${e.lettrage}`);
  });

  if (lettreesRA && lettreesRA.length > 0) {
    const ids = lettreesRA.map(e => e.id);
    const { error } = await supabase
      .from('ecritures_comptables')
      .update({ lettrage: null, date_lettrage: null })
      .in('id', ids);
    if (error) throw error;
    console.log(`${ids.length} lettrages retires.`);
  }

  // 3. Supprimer le rapprochement sauvegarde
  const { data: rappro } = await supabase
    .from('rapprochements_bancaires')
    .select('id, periode, valide')
    .eq('tenant_id', tenantId)
    .eq('periode', periode)
    .maybeSingle();

  if (rappro) {
    console.log(`\nRapprochement sauvegarde: ID ${rappro.id}, valide: ${rappro.valide}`);
    const { error } = await supabase
      .from('rapprochements_bancaires')
      .delete()
      .eq('id', rappro.id);
    if (error) throw error;
    console.log('Rapprochement supprime.');
  } else {
    console.log('\nAucun rapprochement sauvegarde a supprimer.');
  }

  // 4. Verification finale
  const { data: after } = await supabase
    .from('ecritures_comptables')
    .select('id, libelle, debit, credit, lettrage, numero_piece')
    .eq('tenant_id', tenantId)
    .eq('journal_code', 'BQ')
    .eq('compte_numero', '512')
    .eq('periode', periode)
    .order('date_ecriture');

  console.log(`\n=== ETAT APRES NETTOYAGE ===`);
  console.log(`Ecritures 512 dec: ${(after || []).length}`);
  const lettrees2 = (after || []).filter(e => e.lettrage);
  const nonLettrees = (after || []).filter(e => !e.lettrage);
  console.log(`  Lettrees: ${lettrees2.length}`);
  console.log(`  Non lettrees: ${nonLettrees.length}`);

  nonLettrees.forEach(e => {
    console.log(`  ${e.id} ${e.libelle.substring(0, 50).padEnd(50)} D:${e.debit/100} C:${e.credit/100} ${e.numero_piece}`);
  });

  if (lettrees2.length > 0) {
    console.log('  ATTENTION: ecritures encore lettrees (hors RA/RG):');
    lettrees2.forEach(e => {
      console.log(`  ${e.id} ${e.libelle.substring(0, 50).padEnd(50)} L:${e.lettrage} ${e.numero_piece}`);
    });
  }

  const totalD = (after || []).reduce((s, e) => s + (e.debit || 0), 0);
  const totalC = (after || []).reduce((s, e) => s + (e.credit || 0), 0);
  console.log(`\nMouvement dec: D:${totalD/100}€ C:${totalC/100}€ Solde:${(totalD-totalC)/100}€`);

  // Solde cumulatif
  const { data: cumul } = await supabase
    .from('ecritures_comptables')
    .select('debit, credit')
    .eq('tenant_id', tenantId)
    .eq('journal_code', 'BQ')
    .eq('compte_numero', '512')
    .lte('periode', periode);

  const td = (cumul || []).reduce((s, e) => s + (e.debit || 0), 0);
  const tc = (cumul || []).reduce((s, e) => s + (e.credit || 0), 0);
  console.log(`Solde cumulatif 512: ${(td-tc)/100}€`);
}

main().catch(console.error);
