import '../config/env.js';
import { supabase } from '../config/supabase.js';

const telephone = '0768199444';
const prenom = 'Vanessa';

// 1. Chercher ou créer le client
let { data: client } = await supabase
  .from('clients')
  .select('id, prenom, nom, telephone')
  .eq('telephone', telephone)
  .eq('tenant_id', 'fatshairafro')
  .single();

if (!client) {
  console.log('Client non trouvé, création...');
  const { data: newClient, error: clientError } = await supabase
    .from('clients')
    .insert({
      prenom: prenom,
      telephone: telephone,
      tenant_id: 'fatshairafro'
    })
    .select()
    .single();

  if (clientError) {
    console.log('Erreur création client:', clientError.message);
    process.exit(1);
  }
  client = newClient;
  console.log('Client créé: ID', client.id);
} else {
  console.log('Client existant: ID', client.id, '-', client.prenom);
}

// 2. Créer le RDV
const { data: rdv, error: rdvError } = await supabase
  .from('reservations')
  .insert({
    client_id: client.id,
    date: '2026-02-11',
    heure: '14:00',
    service_nom: 'Nattes collées cornrow',
    statut: 'confirme',
    prix_total: 2000,
    duree_minutes: 60,
    telephone: telephone,
    tenant_id: 'fatshairafro',
    created_via: 'nexus-admin',
    notes: '[Créé manuellement - RDV non enregistré]'
  })
  .select()
  .single();

if (rdvError) {
  console.log('Erreur création RDV:', rdvError.message);
  process.exit(1);
} else {
  console.log('');
  console.log('=== RDV CRÉÉ ===');
  console.log('ID:', rdv.id);
  console.log('Client:', prenom, '(' + telephone + ')');
  console.log('Date:', rdv.date, 'à', rdv.heure);
  console.log('Service:', rdv.service_nom);
  console.log('Prix:', (rdv.prix_total/100) + 'EUR');
  console.log('Statut:', rdv.statut);
}
