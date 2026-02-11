import '../config/env.js';
import { supabase } from '../config/supabase.js';

console.log('=== VERIFICATION DONNEES HALIMAH ===\n');

// 1. Services
console.log('1. SERVICES:');
const { data: services, error: e1 } = await supabase
  .from('services')
  .select('*')
  .eq('tenant_id', 'fatshairafro')
  .limit(20);

if (e1) {
  console.log('  Erreur:', e1.message);
} else if (!services || services.length === 0) {
  console.log('  AUCUN SERVICE TROUVE!');
} else {
  console.log('  ' + services.length + ' services:');
  services.forEach(s => {
    const prix = s.prix || s.price || 0;
    const duree = s.duree_minutes || s.duration || 0;
    const actif = s.actif !== false;
    console.log('    - ' + s.nom + ': ' + (prix/100) + 'EUR (' + duree + 'min) ' + (actif ? '' : '[INACTIF]'));
  });
}

// 2. Disponibilites
console.log('\n2. DISPONIBILITES:');
const { data: dispos, error: e2 } = await supabase
  .from('disponibilites')
  .select('*')
  .eq('tenant_id', 'fatshairafro');

if (e2) {
  console.log('  Erreur:', e2.message);
} else if (!dispos || dispos.length === 0) {
  console.log('  AUCUNE DISPONIBILITE CONFIGUREE!');
} else {
  const jours = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  dispos.forEach(d => {
    const actif = d.actif !== false;
    console.log('    - ' + jours[d.jour_semaine] + ': ' + d.heure_debut + '-' + d.heure_fin + (actif ? '' : ' [INACTIF]'));
  });
}

// 3. Jours feries / Conges
console.log('\n3. JOURS FERIES/CONGES:');
const { data: conges, error: e3 } = await supabase
  .from('jours_feries')
  .select('*')
  .eq('tenant_id', 'fatshairafro')
  .gte('date', '2026-02-01');

if (e3) {
  console.log('  Erreur:', e3.message);
} else if (!conges || conges.length === 0) {
  console.log('  Aucun jour ferie/conge configure');
} else {
  conges.forEach(c => console.log('    - ' + c.date + ': ' + (c.motif || 'Ferme')));
}

// 4. Verifier AI Tools config
console.log('\n4. CONFIG AI TOOLS:');
try {
  const toolsModule = await import('../ai/tools/clientToolsRegistry.js');
  const tools = toolsModule.clientTools || toolsModule.default?.clientTools;
  if (tools) {
    console.log('  ' + Object.keys(tools).length + ' outils disponibles:');
    Object.keys(tools).forEach(t => console.log('    - ' + t));
  }
} catch (err) {
  console.log('  Erreur chargement tools:', err.message);
}

// 5. RDV du jour pour verifier les creneaux occupes
console.log('\n5. CRENEAUX OCCUPES AUJOURDHUI (11 fev):');
const { data: rdvs } = await supabase
  .from('reservations')
  .select('heure, duree_minutes, service_nom')
  .eq('tenant_id', 'fatshairafro')
  .eq('date', '2026-02-11')
  .neq('statut', 'annule')
  .order('heure');

if (rdvs && rdvs.length > 0) {
  rdvs.forEach(r => {
    const fin = new Date('2026-02-11T' + r.heure);
    fin.setMinutes(fin.getMinutes() + r.duree_minutes);
    const heureFin = fin.toTimeString().slice(0,5);
    console.log('    - ' + r.heure + ' -> ' + heureFin + ' : ' + r.service_nom);
  });
} else {
  console.log('  Aucun RDV');
}

console.log('\n=== FIN VERIFICATION ===');
