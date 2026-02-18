import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupRHSalaries() {
  console.log('🚀 Configuration RH - Salariés et liaison réservations\n');

  // Récupérer tous les tenants
  const { data: tenants, error: tenantErr } = await supabase.from('tenants').select('id');

  if (tenantErr) {
    console.error('Erreur récupération tenants:', tenantErr);
    return;
  }

  console.log(`📋 ${tenants?.length || 0} tenant(s) trouvé(s)`);

  for (const tenant of tenants || []) {
    console.log(`\n📁 Tenant: ${tenant.id}`);

    // 1. Vérifier si des salariés existent déjà
    const { data: existingMembres } = await supabase
      .from('rh_membres')
      .select('id, nom, prenom, role')
      .eq('tenant_id', tenant.id);

    if (existingMembres && existingMembres.length > 0) {
      console.log(`  ✅ ${existingMembres.length} salarié(s) déjà présent(s)`);
      existingMembres.forEach(m => console.log(`     - ${m.prenom} ${m.nom} (${m.role})`));
    } else {
      // 2. Créer les 2 salariés
      console.log('  👤 Création des salariés...');

      const salaries = [
        {
          tenant_id: tenant.id,
          nom: 'DIALLO',
          prenom: 'Aminata',
          email: 'aminata.diallo@salon.fr',
          telephone: '+33612345001',
          role: 'coiffeuse',
          statut: 'actif',
          date_embauche: '2024-01-15',
          salaire_mensuel: 180000, // 1800€ en centimes
          nir: '2850175123456',
          date_naissance: '1985-01-15',
          notes: 'Spécialiste coupes femmes, colorations, lissages'
        },
        {
          tenant_id: tenant.id,
          nom: 'TRAORE',
          prenom: 'Moussa',
          email: 'moussa.traore@salon.fr',
          telephone: '+33612345002',
          role: 'coiffeur',
          statut: 'actif',
          date_embauche: '2024-03-01',
          salaire_mensuel: 170000, // 1700€ en centimes
          nir: '1900375654321',
          date_naissance: '1990-03-25',
          notes: 'Spécialiste coupes hommes, barbe, dégradés'
        }
      ];

      const { data: newMembres, error: insertErr } = await supabase
        .from('rh_membres')
        .insert(salaries)
        .select();

      if (insertErr) {
        console.error('  ❌ Erreur création salariés:', insertErr.message);
        continue;
      }

      console.log(`  ✅ ${newMembres.length} salariés créés:`);
      newMembres.forEach(m => console.log(`     - ${m.prenom} ${m.nom} (${m.role}) ID: ${m.id}`));
    }

    // 3. Récupérer les IDs des salariés
    const { data: membres } = await supabase
      .from('rh_membres')
      .select('id, nom, prenom, role')
      .eq('tenant_id', tenant.id)
      .eq('statut', 'actif');

    if (!membres || membres.length === 0) {
      console.log('  ⚠️ Aucun salarié actif trouvé');
      continue;
    }

    const coiffeuse = membres.find(m => m.role === 'coiffeuse' || m.prenom === 'Aminata');
    const coiffeur = membres.find(m => m.role === 'coiffeur' || m.prenom === 'Moussa');

    // 4. Récupérer les réservations existantes
    const { data: reservations } = await supabase
      .from('reservations')
      .select('id, service_nom, client_id, date, heure, membre_id')
      .eq('tenant_id', tenant.id)
      .order('date', { ascending: true });

    console.log(`\n  📅 ${reservations?.length || 0} réservations trouvées`);

    // 5. Assigner les réservations aux salariés selon le service
    let assignedCoiffeuse = 0;
    let assignedCoiffeur = 0;

    for (const resa of reservations || []) {
      if (resa.membre_id) {
        // Déjà assigné
        continue;
      }

      const serviceNom = (resa.service_nom || '').toLowerCase();
      let membreId = null;

      // Logique d'assignation basée sur le service
      if (serviceNom.includes('homme') || serviceNom.includes('barbe') || serviceNom.includes('dégradé') || serviceNom.includes('degrade')) {
        membreId = coiffeur?.id;
        assignedCoiffeur++;
      } else if (serviceNom.includes('femme') || serviceNom.includes('coloration') || serviceNom.includes('lissage') || serviceNom.includes('mèches')) {
        membreId = coiffeuse?.id;
        assignedCoiffeuse++;
      } else {
        // Par défaut, alterner entre les deux
        const random = Math.random() > 0.5;
        membreId = random ? coiffeuse?.id : coiffeur?.id;
        if (random) assignedCoiffeuse++;
        else assignedCoiffeur++;
      }

      if (membreId) {
        await supabase
          .from('reservations')
          .update({ membre_id: membreId })
          .eq('id', resa.id);
      }
    }

    console.log(`  ✅ Assignations: ${assignedCoiffeuse} à ${coiffeuse?.prenom || 'coiffeuse'}, ${assignedCoiffeur} à ${coiffeur?.prenom || 'coiffeur'}`);
  }

  console.log('\n✅ Configuration RH terminée!');
}

// D'abord, ajouter la colonne membre_id si elle n'existe pas
async function addMembreIdColumn() {
  console.log('🔧 Vérification colonne membre_id sur reservations...');

  // Vérifier si la colonne existe en faisant une requête
  const { data, error } = await supabase
    .from('reservations')
    .select('membre_id')
    .limit(1);

  if (error && error.message.includes('membre_id')) {
    console.log('  📝 La colonne membre_id n\'existe pas, création nécessaire...');
    console.log('  ⚠️ Exécutez cette migration SQL:');
    console.log(`
-- Migration: Ajout membre_id aux réservations
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS membre_id INTEGER REFERENCES rh_membres(id);
CREATE INDEX IF NOT EXISTS idx_reservations_membre ON reservations(membre_id);
COMMENT ON COLUMN reservations.membre_id IS 'Employé assigné à la réservation';
    `);
    return false;
  } else {
    console.log('  ✅ Colonne membre_id existe déjà');
    return true;
  }
}

async function main() {
  const columnExists = await addMembreIdColumn();
  if (columnExists) {
    await setupRHSalaries();
  }
}

main().catch(console.error);
