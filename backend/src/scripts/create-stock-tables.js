/**
 * Script pour créer les tables Stock
 */

import '../config/env.js';
import { supabase } from '../config/supabase.js';

async function createTables() {
  console.log('Création des tables Stock & Inventaire...\n');

  // Table produits
  console.log('1. Création table produits...');
  const { error: err1 } = await supabase.from('produits').select('id').limit(1);
  if (err1 && err1.message.includes('does not exist')) {
    // Utiliser un insert pour créer la table via la première entrée
    // Non, on doit créer via SQL directement
    console.log('   Table produits n\'existe pas - utiliser SQL Editor Supabase');
  } else if (err1) {
    console.log('   Erreur:', err1.message);
  } else {
    console.log('   ✓ Table produits existe déjà');
  }

  // Table mouvements_stock
  console.log('2. Vérification table mouvements_stock...');
  const { error: err2 } = await supabase.from('mouvements_stock').select('id').limit(1);
  if (err2 && err2.message.includes('does not exist')) {
    console.log('   Table mouvements_stock n\'existe pas - utiliser SQL Editor Supabase');
  } else if (err2) {
    console.log('   Erreur:', err2.message);
  } else {
    console.log('   ✓ Table mouvements_stock existe déjà');
  }

  // Table inventaires
  console.log('3. Vérification table inventaires...');
  const { error: err3 } = await supabase.from('inventaires').select('id').limit(1);
  if (err3 && err3.message.includes('does not exist')) {
    console.log('   Table inventaires n\'existe pas - utiliser SQL Editor Supabase');
  } else if (err3) {
    console.log('   Erreur:', err3.message);
  } else {
    console.log('   ✓ Table inventaires existe déjà');
  }

  // Table alertes_stock
  console.log('4. Vérification table alertes_stock...');
  const { error: err4 } = await supabase.from('alertes_stock').select('id').limit(1);
  if (err4 && err4.message.includes('does not exist')) {
    console.log('   Table alertes_stock n\'existe pas - utiliser SQL Editor Supabase');
  } else if (err4) {
    console.log('   Erreur:', err4.message);
  } else {
    console.log('   ✓ Table alertes_stock existe déjà');
  }

  console.log('\n============================================');
  console.log('INSTRUCTIONS POUR CRÉER LES TABLES:');
  console.log('============================================');
  console.log('1. Aller sur Supabase Dashboard');
  console.log('2. SQL Editor');
  console.log('3. Copier-coller le contenu de /tmp/create-stock-tables.sql');
  console.log('4. Exécuter le script');
  console.log('5. Relancer ce test');
  console.log('============================================\n');
}

createTables().catch(console.error);
