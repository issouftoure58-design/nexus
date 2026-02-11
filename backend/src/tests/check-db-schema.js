import '../config/env.js';
import { supabase } from '../config/supabase.js';

console.log('=== CHECK DB SCHEMA ===\n');

// 1. Plans table
console.log('1. Table plans:');
const { data: plans, error: planError } = await supabase
  .from('plans')
  .select('*')
  .limit(5);

if (planError) {
  console.log('  Erreur:', planError.message);
} else if (plans && plans.length > 0) {
  console.log('  Colonnes:', Object.keys(plans[0]).join(', '));
  plans.forEach(p => console.log('  -', JSON.stringify(p)));
}

// 2. Tenants table
console.log('\n2. Table tenants (colonnes):');
const { data: tenant, error: tenantError } = await supabase
  .from('tenants')
  .select('*')
  .eq('id', 'fatshairafro')
  .single();

if (tenantError) {
  console.log('  Erreur:', tenantError.message);
} else if (tenant) {
  console.log('  Colonnes:', Object.keys(tenant).join(', '));
  console.log('  plan_id:', tenant.plan_id);
}

// 3. Social_posts table
console.log('\n3. Table social_posts (colonnes):');
const { data: posts, error: postError } = await supabase
  .from('social_posts')
  .select('*')
  .limit(1);

if (postError) {
  console.log('  Erreur:', postError.message);
} else {
  // Si pas de posts, créer un post temporaire pour voir les colonnes
  const { data: testInsert, error: insertError } = await supabase
    .from('social_posts')
    .insert({
      tenant_id: 'fatshairafro',
      content: 'Test schema check',
      platforms: ['instagram'],
      status: 'draft'
    })
    .select()
    .single();

  if (insertError) {
    console.log('  Erreur insert test:', insertError.message);
  } else {
    console.log('  Colonnes:', Object.keys(testInsert).join(', '));
    // Supprimer le post test
    await supabase.from('social_posts').delete().eq('id', testInsert.id);
  }
}

console.log('\n=== FIN ===');
