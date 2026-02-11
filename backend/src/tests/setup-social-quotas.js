import '../config/env.js';
import { supabase } from '../config/supabase.js';

console.log('=== SETUP QUOTAS RÉSEAUX SOCIAUX ===\n');

// 1. Vérifier colonnes existantes dans tenants
console.log('1. Vérification colonnes tenants...');
const { data: tenantSample, error: tenantError } = await supabase
  .from('tenants')
  .select('*')
  .limit(1)
  .single();

if (tenantError) {
  console.log('  Erreur:', tenantError.message);
} else {
  const cols = Object.keys(tenantSample);
  console.log('  Colonnes actuelles:', cols.length);

  const quotaCols = ['images_ia_ce_mois', 'posts_ia_ce_mois', 'reset_compteurs_date'];
  quotaCols.forEach(col => {
    if (cols.includes(col)) {
      console.log(`  ✅ ${col} existe`);
    } else {
      console.log(`  ❌ ${col} MANQUANTE`);
    }
  });

  const socialCols = ['facebook_page_id', 'facebook_access_token', 'linkedin_person_id', 'linkedin_access_token'];
  socialCols.forEach(col => {
    if (cols.includes(col)) {
      console.log(`  ✅ ${col} existe`);
    } else {
      console.log(`  ❌ ${col} MANQUANTE`);
    }
  });
}

// 2. Vérifier colonnes social_posts
console.log('\n2. Vérification colonnes social_posts...');
const { data: postSample, error: postError } = await supabase
  .from('social_posts')
  .select('*')
  .limit(1);

if (postError) {
  console.log('  Erreur:', postError.message);
} else {
  const cols = postSample.length > 0 ? Object.keys(postSample[0]) : [];
  console.log('  Colonnes actuelles:', cols.join(', '));

  const neededCols = ['published_at', 'error_message'];
  neededCols.forEach(col => {
    if (cols.includes(col)) {
      console.log(`  ✅ ${col} existe`);
    } else {
      console.log(`  ❌ ${col} MANQUANTE`);
    }
  });
}

// 3. Vérifier table plans
console.log('\n3. Vérification table plans...');
const { data: plans, error: planError } = await supabase
  .from('plans')
  .select('id, code, nom')
  .limit(10);

if (planError) {
  console.log('  Erreur:', planError.message);
} else if (!plans || plans.length === 0) {
  console.log('  ❌ Aucun plan trouvé');
} else {
  console.log('  Plans existants:');
  plans.forEach(p => console.log(`    - ${p.code}: ${p.nom} (id: ${p.id})`));
}

console.log('\n=== FIN VÉRIFICATION ===');
