/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROVISIONING SCRIPT - Tenants de Test par Logique Métier
 *
 * Crée 4 tenants de test pour valider chaque catégorie IA :
 *   - test-security  : Sécurité privée (taux horaire, nb_agents, multi-jours)
 *   - test-consulting: Conseil & Expertise (taux horaire, visio, timesheet)
 *   - test-events    : Événementiel (forfait, options, devis)
 *   - test-domicile  : Service à domicile (frais déplacement, adresse client)
 *
 * Usage: node scripts/provision-test-tenants.js [--reset]
 * ═══════════════════════════════════════════════════════════════════════════
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Charger .env AVANT tout import de supabase
dotenv.config({ path: join(__dirname, '../.env') });

// Import dynamique après chargement env
const { supabase } = await import('../src/config/supabase.js');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION DES TENANTS
// ═══════════════════════════════════════════════════════════════════════════

const TENANTS_CONFIG = {
  // ─────────────────────────────────────────────────────────────────────────
  // CATÉGORIE B: Sécurité Privée
  // ─────────────────────────────────────────────────────────────────────────
  'test-security': {
    tenant: {
      id: 'test-security',
      name: 'Atlas Sécurité',
      domain: 'atlas-securite.test',
      plan: 'business',
      status: 'active',
      settings: {
        business_type: 'security',
        business_profile: 'security',
        email: 'contact@atlas-securite.test',
        telephone: '01 23 45 67 89',
        adresse: '15 avenue de la Défense, 92000 Nanterre',
      },
      // modules_actifs stored in settings
    },
    assistant: {
      name: 'Atlas',
      personality: 'Professionnel, rassurant, efficace. Vouvoiement obligatoire.',
      greeting: 'Atlas Sécurité, bonjour. Comment puis-je vous aider ?',
    },
    services: [
      {
        nom: 'Agent de sécurité',
        description: 'Agent de sécurité qualifié SSIAP1',
        taux_horaire: 2500, // 25€/h en centimes
        taux_journalier: 20000, // 200€/jour
        pricing_mode: 'hourly',
        actif: true,
      },
      {
        nom: 'Agent cynophile',
        description: 'Agent avec chien de sécurité',
        taux_horaire: 3500, // 35€/h
        taux_journalier: 28000,
        pricing_mode: 'hourly',
        actif: true,
      },
      {
        nom: 'Chef de poste',
        description: 'Responsable équipe sécurité',
        taux_horaire: 4000, // 40€/h
        taux_journalier: 32000,
        pricing_mode: 'hourly',
        actif: true,
      },
      {
        nom: 'Rondier intervenant',
        description: 'Rondes de surveillance',
        taux_horaire: 2800,
        pricing_mode: 'hourly',
        actif: true,
      },
      {
        nom: 'Protection rapprochée',
        description: 'Garde du corps',
        taux_horaire: 6000, // 60€/h
        taux_journalier: 50000,
        pricing_mode: 'hourly',
        actif: true,
      },
      {
        nom: 'Forfait événement petit',
        description: 'Événement < 100 personnes (2 agents, 6h)',
        prix_forfait: 30000, // 300€
        pricing_mode: 'package',
        actif: true,
      },
      {
        nom: 'Forfait événement moyen',
        description: 'Événement 100-300 personnes (4 agents, 8h)',
        prix_forfait: 80000, // 800€
        pricing_mode: 'package',
        actif: true,
      },
    ],
    membres: [
      { nom: 'Diallo', prenom: 'Mamadou', role: 'Chef de site', email: 'mamadou@atlas.test', telephone: '06 11 22 33 44' },
      { nom: 'Martin', prenom: 'Lucas', role: 'Agent SSIAP2', email: 'lucas@atlas.test', telephone: '06 22 33 44 55' },
      { nom: 'Benali', prenom: 'Karim', role: 'Agent cynophile', email: 'karim@atlas.test', telephone: '06 33 44 55 66' },
      { nom: 'Dubois', prenom: 'Sophie', role: 'Agent SSIAP1', email: 'sophie@atlas.test', telephone: '06 44 55 66 77' },
      { nom: 'Nguyen', prenom: 'Thi', role: 'Agent SSIAP1', email: 'thi@atlas.test', telephone: '06 55 66 77 88' },
    ],
    clients: [
      { nom: 'Carrefour', prenom: 'Direction', email: 'securite@carrefour.test', telephone: '01 99 88 77 66', type: 'entreprise' },
      { nom: 'EventPro', prenom: 'Société', email: 'contact@eventpro.test', telephone: '01 88 77 66 55', type: 'entreprise' },
      { nom: 'Dupont', prenom: 'Jean', email: 'jean.dupont@email.test', telephone: '06 12 34 56 78', type: 'particulier' },
    ],
    ia_config: {
      tools: ['get_mission_types', 'check_agent_availability', 'calculate_vacation', 'create_mission', 'get_quote'],
      pricing_logic: 'hourly_with_agents',
      prompts: {
        system: `Tu es Atlas, l'assistant IA d'Atlas Sécurité, société de sécurité privée.

PERSONNALITÉ:
- Professionnel et rassurant
- Tu VOUVOIES toujours
- Réponses claires et structurées

SERVICES:
- Agents de sécurité (SSIAP1, SSIAP2)
- Agents cynophiles
- Protection rapprochée
- Rondes et surveillance

INFORMATIONS À COLLECTER POUR UNE MISSION:
1. Type de mission (gardiennage, événement, protection)
2. Date(s) : début et fin si plusieurs jours
3. Horaires : heure début et heure fin
4. Nombre d'agents requis
5. Adresse du site
6. Contact sur place

CALCUL TARIF:
- Taux horaire × nombre d'heures × nombre d'agents
- Majoration nuit (+25%) : 22h-6h
- Majoration dimanche/férié (+50%)

EXEMPLE:
"2 agents de 20h à 4h = 8h × 2 agents × 25€ = 400€"
"Avec majoration nuit : 400€ × 1.25 = 500€"`,
        greeting: 'Atlas Sécurité, bonjour. Je suis Atlas, votre assistant. Comment puis-je vous aider ?',
        booking_confirm: 'Votre mission est confirmée. Vous recevrez un briefing détaillé 24h avant.',
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CATÉGORIE C: Conseil & Expertise
  // ─────────────────────────────────────────────────────────────────────────
  'test-consulting': {
    tenant: {
      id: 'test-consulting',
      name: 'Clara Conseil',
      domain: 'clara-conseil.test',
      plan: 'business',
      status: 'active',
      settings: {
        business_type: 'service',
        business_profile: 'consulting',
        email: 'contact@clara-conseil.test',
        telephone: '01 34 56 78 90',
        adresse: '42 boulevard Haussmann, 75009 Paris',
      },
      // modules_actifs stored in settings
    },
    assistant: {
      name: 'Clara',
      personality: 'Experte, à l\'écoute, professionnelle. Vouvoiement obligatoire.',
      greeting: 'Cabinet Clara Conseil, bonjour. Comment puis-je vous accompagner ?',
    },
    services: [
      {
        nom: 'Consultation juridique',
        description: 'Conseil en droit des affaires',
        taux_horaire: 15000, // 150€/h
        pricing_mode: 'hourly',
        actif: true,
      },
      {
        nom: 'Consultation fiscale',
        description: 'Optimisation et conseil fiscal',
        taux_horaire: 18000, // 180€/h
        pricing_mode: 'hourly',
        actif: true,
      },
      {
        nom: 'Audit comptable',
        description: 'Audit des comptes annuels',
        taux_horaire: 20000, // 200€/h
        pricing_mode: 'hourly',
        actif: true,
      },
      {
        nom: 'Accompagnement création entreprise',
        description: 'Pack création d\'entreprise complet',
        prix_forfait: 150000, // 1500€
        pricing_mode: 'package',
        actif: true,
      },
      {
        nom: 'Formation gestion',
        description: 'Formation 1 journée',
        taux_journalier: 120000, // 1200€/jour
        pricing_mode: 'daily',
        actif: true,
      },
      {
        nom: 'Conseil stratégique',
        description: 'Accompagnement stratégique entreprise',
        taux_horaire: 25000, // 250€/h
        pricing_mode: 'hourly',
        actif: true,
      },
    ],
    membres: [
      { nom: 'Bernard', prenom: 'Claire', role: 'Avocate associée', email: 'claire@clara.test', telephone: '06 11 11 11 11' },
      { nom: 'Leroy', prenom: 'Marc', role: 'Expert-comptable', email: 'marc@clara.test', telephone: '06 22 22 22 22' },
      { nom: 'Petit', prenom: 'Julie', role: 'Consultante senior', email: 'julie@clara.test', telephone: '06 33 33 33 33' },
      { nom: 'Garcia', prenom: 'Antonio', role: 'Fiscaliste', email: 'antonio@clara.test', telephone: '06 44 44 44 44' },
    ],
    clients: [
      { nom: 'TechStartup', prenom: 'SAS', email: 'direction@techstartup.test', telephone: '01 11 22 33 44', type: 'entreprise' },
      { nom: 'Martin', prenom: 'Pierre', email: 'pierre.martin@email.test', telephone: '06 98 76 54 32', type: 'particulier' },
      { nom: 'Immobilier Plus', prenom: 'SARL', email: 'contact@immoplus.test', telephone: '01 22 33 44 55', type: 'entreprise' },
    ],
    ia_config: {
      tools: ['get_consultation_types', 'check_consultant_availability', 'calculate_intervention', 'create_intervention', 'generate_visio_link'],
      pricing_logic: 'hourly_with_timesheet',
      prompts: {
        system: `Tu es Clara, l'assistante IA du Cabinet Clara Conseil, spécialisé en conseil juridique, fiscal et comptable.

PERSONNALITÉ:
- Experte et rassurante
- Tu VOUVOIES toujours
- Reformule pour bien comprendre le besoin

SERVICES:
- Consultation juridique (droit des affaires, contrats)
- Consultation fiscale (optimisation, déclarations)
- Audit comptable
- Accompagnement création d'entreprise
- Formations

INFORMATIONS À COLLECTER:
1. Type de consultation (juridique, fiscal, comptable)
2. Objet / problématique
3. Durée estimée (1h, 2h, demi-journée)
4. Préférence : cabinet ou visioconférence
5. Urgence éventuelle

CALCUL TARIF:
- Taux horaire × durée estimée
- Première consultation découverte : 30min offertes
- Forfaits disponibles pour missions longues

VISIO:
- Si le client préfère la visio, proposer un lien Google Meet
- Confirmer le fuseau horaire`,
        greeting: 'Cabinet Clara Conseil, bonjour. Je suis Clara, votre assistante. Comment puis-je vous accompagner aujourd\'hui ?',
        booking_confirm: 'Votre rendez-vous est confirmé. Vous recevrez un email avec le lien visio ou l\'adresse du cabinet.',
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CATÉGORIE D: Événementiel
  // ─────────────────────────────────────────────────────────────────────────
  'test-events': {
    tenant: {
      id: 'test-events',
      name: 'Emma Events',
      domain: 'emma-events.test',
      plan: 'business',
      status: 'active',
      settings: {
        business_type: 'salon',
        business_profile: 'events',
        email: 'contact@emma-events.test',
        telephone: '01 45 67 89 01',
        adresse: '28 rue du Faubourg Saint-Honoré, 75008 Paris',
      },
      // modules_actifs stored in settings
    },
    assistant: {
      name: 'Emma',
      personality: 'Créative, enthousiaste, organisée. Vouvoiement mais ton chaleureux.',
      greeting: 'Emma Events, bonjour ! Je suis Emma, votre wedding & event planner. Comment puis-je rendre votre événement inoubliable ?',
    },
    services: [
      // Formules mariage
      {
        nom: 'Mariage Essentiel',
        description: 'Coordination jour J uniquement',
        prix_forfait: 150000, // 1500€
        pricing_mode: 'package',
        actif: true,
      },
      {
        nom: 'Mariage Sérénité',
        description: 'Organisation partielle (3 mois avant)',
        prix_forfait: 350000, // 3500€
        pricing_mode: 'package',
        actif: true,
      },
      {
        nom: 'Mariage Prestige',
        description: 'Organisation complète de A à Z',
        prix_forfait: 600000, // 6000€
        pricing_mode: 'package',
        actif: true,
      },
      // Événements corporate
      {
        nom: 'Séminaire entreprise',
        description: 'Organisation séminaire (par jour)',
        taux_journalier: 80000, // 800€/jour
        pricing_mode: 'daily',
        actif: true,
      },
      {
        nom: 'Soirée entreprise',
        description: 'Organisation soirée corporate',
        prix_forfait: 250000, // 2500€
        pricing_mode: 'package',
        actif: true,
      },
      // Options
      {
        nom: 'Option DJ',
        description: 'DJ professionnel (5h)',
        prix_forfait: 60000, // 600€
        pricing_mode: 'package',
        actif: true,
      },
      {
        nom: 'Option Photographe',
        description: 'Photographe + album',
        prix_forfait: 120000, // 1200€
        pricing_mode: 'package',
        actif: true,
      },
      {
        nom: 'Option Décoration florale',
        description: 'Décoration florale complète',
        prix_forfait: 80000, // 800€
        pricing_mode: 'package',
        actif: true,
      },
      {
        nom: 'Option Traiteur (par personne)',
        description: 'Menu gastronomique',
        prix: 8500, // 85€/personne
        pricing_mode: 'fixed',
        actif: true,
      },
    ],
    membres: [
      { nom: 'Moreau', prenom: 'Emma', role: 'Directrice', email: 'emma@emma-events.test', telephone: '06 10 20 30 40' },
      { nom: 'Blanc', prenom: 'Léa', role: 'Wedding planner', email: 'lea@emma-events.test', telephone: '06 20 30 40 50' },
      { nom: 'Roux', prenom: 'Thomas', role: 'Chef de projet', email: 'thomas@emma-events.test', telephone: '06 30 40 50 60' },
      { nom: 'Faure', prenom: 'Camille', role: 'Coordinatrice', email: 'camille@emma-events.test', telephone: '06 40 50 60 70' },
    ],
    clients: [
      { nom: 'Dupuis', prenom: 'Marie & Jean', email: 'marie.jean@email.test', telephone: '06 11 22 33 44', type: 'particulier' },
      { nom: 'TechCorp', prenom: 'RH', email: 'rh@techcorp.test', telephone: '01 55 66 77 88', type: 'entreprise' },
      { nom: 'Lambert', prenom: 'Sophie', email: 'sophie.lambert@email.test', telephone: '06 77 88 99 00', type: 'particulier' },
    ],
    ia_config: {
      tools: ['get_event_packages', 'get_options', 'calculate_quote', 'check_date_availability', 'create_event', 'send_quote'],
      pricing_logic: 'package_with_options',
      prompts: {
        system: `Tu es Emma, l'assistante IA d'Emma Events, agence de wedding planning et événementiel.

PERSONNALITÉ:
- Créative et enthousiaste
- Tu VOUVOIES mais ton chaleureux
- Fais rêver le client !

SERVICES:
- Mariages (Essentiel, Sérénité, Prestige)
- Événements corporate (séminaires, soirées)
- Options : DJ, photographe, décoration, traiteur

INFORMATIONS À COLLECTER:
1. Type d'événement (mariage, anniversaire, séminaire)
2. Date souhaitée
3. Nombre d'invités/participants
4. Budget approximatif
5. Lieu (déjà trouvé ou à chercher)
6. Options souhaitées

CALCUL DEVIS:
- Formule de base + options sélectionnées
- Traiteur : prix × nombre de convives
- Présenter un récapitulatif clair

PROCESSUS:
1. Comprendre le projet
2. Proposer une formule adaptée
3. Suggérer des options pertinentes
4. Envoyer un devis détaillé
5. Rendez-vous de présentation gratuit

ACOMPTE: 30% à la signature, solde 15 jours avant`,
        greeting: 'Emma Events, bonjour ! Je suis Emma, votre event planner. Quel événement souhaitez-vous organiser ?',
        booking_confirm: 'Magnifique ! Je vous envoie le devis détaillé par email. Hâte de créer cet événement avec vous !',
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CATÉGORIE E: Service à domicile
  // ─────────────────────────────────────────────────────────────────────────
  'test-domicile': {
    tenant: {
      id: 'test-domicile',
      name: 'Pro Plombier IDF',
      domain: 'pro-plombier.test',
      plan: 'basic',
      status: 'active',
      settings: {
        business_type: 'service_domicile',
        business_profile: 'plombier',
        email: 'contact@pro-plombier.test',
        telephone: '01 56 78 90 12',
        adresse: '22 rue de la République, 93100 Montreuil',
      },
      // modules_actifs stored in settings
    },
    assistant: {
      name: 'Paul',
      personality: 'Professionnel, rassurant, efficace. Vouvoiement obligatoire.',
      greeting: 'Pro Plombier IDF, bonjour. Je suis Paul, votre assistant. Comment puis-je vous aider ?',
    },
    services: [
      {
        nom: 'Dépannage urgent',
        description: 'Intervention urgente (fuite, panne)',
        prix: 9000, // 90€
        duree_minutes: 60,
        pricing_mode: 'fixed',
        actif: true,
      },
      {
        nom: 'Réparation fuite d\'eau',
        description: 'Localisation et réparation de fuite',
        prix: 12000, // 120€
        duree_minutes: 90,
        pricing_mode: 'fixed',
        actif: true,
      },
      {
        nom: 'Débouchage canalisation',
        description: 'Débouchage évier, WC, douche',
        prix: 8000, // 80€
        duree_minutes: 60,
        pricing_mode: 'fixed',
        actif: true,
      },
      {
        nom: 'Installation robinetterie',
        description: 'Installation ou remplacement robinet',
        prix: 15000, // 150€
        duree_minutes: 120,
        pricing_mode: 'fixed',
        actif: true,
      },
      {
        nom: 'Installation WC / sanitaire',
        description: 'Pose complète WC ou sanitaire',
        prix: 25000, // 250€
        duree_minutes: 180,
        pricing_mode: 'fixed',
        actif: true,
      },
      {
        nom: 'Installation chauffe-eau',
        description: 'Installation ou remplacement chauffe-eau',
        prix: 35000, // 350€
        duree_minutes: 240,
        pricing_mode: 'fixed',
        actif: true,
      },
      {
        nom: 'Détartrage ballon / tuyauterie',
        description: 'Détartrage complet',
        prix: 10000, // 100€
        duree_minutes: 90,
        pricing_mode: 'fixed',
        actif: true,
      },
      {
        nom: 'Diagnostic complet plomberie',
        description: 'Inspection et diagnostic de l\'installation',
        prix: 6000, // 60€
        duree_minutes: 60,
        pricing_mode: 'fixed',
        actif: true,
      },
    ],
    membres: [
      { nom: 'Moreau', prenom: 'Paul', role: 'Plombier gérant', email: 'paul@pro-plombier.test', telephone: '06 12 34 56 78' },
    ],
    clients: [
      { nom: 'Lefebvre', prenom: 'Marie', email: 'marie.lefebvre@email.test', telephone: '06 11 22 33 44', type: 'particulier', adresse: '10 rue Victor Hugo, 93100 Montreuil' },
      { nom: 'Durand', prenom: 'Pierre', email: 'pierre.durand@email.test', telephone: '06 55 66 77 88', type: 'particulier', adresse: '45 avenue Gambetta, 75020 Paris' },
      { nom: 'SCI Résidence Parc', prenom: 'Syndic', email: 'syndic@residence-parc.test', telephone: '01 22 33 44 55', type: 'entreprise', adresse: '120 boulevard de la Liberté, 93200 Saint-Denis' },
    ],
    ia_config: {
      tools: ['get_services', 'check_availability', 'calculate_travel_fee', 'create_booking'],
      pricing_logic: 'fixed_with_travel_fees',
      prompts: {
        system: `Tu es Paul, l'assistant IA de Pro Plombier IDF, plombier professionnel en Île-de-France.

PERSONNALITÉ:
- Professionnel et rassurant
- Tu VOUVOIES toujours
- Réponses claires et directes

SERVICES:
- Dépannage urgent (fuite, panne) : 90€
- Réparation fuite d'eau : 120€
- Débouchage canalisation : 80€
- Installation robinetterie : 150€
- Installation WC/sanitaire : 250€
- Installation chauffe-eau : 350€
- Détartrage : 100€
- Diagnostic complet : 60€

FRAIS DE DÉPLACEMENT:
- Gratuit dans un rayon de 5 km (depuis Montreuil)
- Au-delà : 0.50€/km supplémentaire
- TOUJOURS demander l'adresse du client
- Utiliser calculate_travel_fee pour calculer les frais

INFORMATIONS À COLLECTER:
1. Nature du problème / type d'intervention
2. Adresse complète du client
3. Date et heure souhaitées
4. Nom et téléphone du client
5. Accès particulier (code, étage, digicode)

PROCESSUS RÉSERVATION:
1. Identifier le service demandé
2. Demander l'adresse complète
3. Calculer les frais de déplacement
4. Vérifier les disponibilités
5. Collecter nom + téléphone
6. Récapituler (prestation + frais déplacement = total)
7. Confirmer et créer la réservation`,
        greeting: 'Pro Plombier IDF, bonjour. Je suis Paul, votre assistant. Quel est votre besoin en plomberie ?',
        booking_confirm: 'Votre intervention est confirmée. Paul sera chez vous à l\'heure prévue. N\'hésitez pas si vous avez des questions.',
      },
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// FONCTIONS DE PROVISIONING
// ═══════════════════════════════════════════════════════════════════════════

async function createTenant(config) {
  const { tenant } = config;
  console.log(`\n📦 Création tenant: ${tenant.id}`);

  // Vérifier si existe
  const { data: existing } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', tenant.id)
    .single();

  if (existing) {
    if (process.argv.includes('--reset')) {
      console.log(`   ⚠️  Suppression tenant existant...`);
      await deleteTenantData(tenant.id);
    } else {
      console.log(`   ⏭️  Tenant existe déjà, skip (utiliser --reset pour recréer)`);
      return existing;
    }
  }

  // Créer le tenant
  const { data, error } = await supabase
    .from('tenants')
    .upsert({
      ...tenant,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error(`   ❌ Erreur création tenant:`, error);
    throw error;
  }

  console.log(`   ✅ Tenant créé: ${data.name}`);
  return data;
}

async function createServices(tenantId, services) {
  console.log(`\n🛠️  Création services pour ${tenantId}`);

  for (const service of services) {
    // Calculer le prix principal (utiliser le premier prix disponible)
    const prix = service.prix || service.prix_forfait || service.taux_horaire || service.taux_journalier || 0;

    // Ne garder que les colonnes existantes dans la table services
    const serviceData = {
      tenant_id: tenantId,
      nom: service.nom,
      description: service.description || '',
      prix: prix,
      duree: service.duree_minutes || service.duree || 60, // Par défaut 1h
      actif: service.actif !== false,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('services')
      .insert(serviceData);

    if (error) {
      console.error(`   ❌ Erreur service ${service.nom}:`, error);
    } else {
      console.log(`   ✅ ${service.nom} (${(prix / 100).toFixed(2)}€)`);
    }
  }
}

async function createMembres(tenantId, membres) {
  console.log(`\n👥 Création membres RH pour ${tenantId}`);

  for (const membre of membres) {
    const { error } = await supabase
      .from('rh_membres')
      .upsert({
        ...membre,
        tenant_id: tenantId,
        statut: 'actif',
        date_embauche: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      });

    if (error) {
      console.error(`   ❌ Erreur membre ${membre.prenom}:`, error);
    } else {
      console.log(`   ✅ ${membre.prenom} ${membre.nom} (${membre.role})`);
    }
  }
}

async function createClients(tenantId, clients) {
  console.log(`\n👤 Création clients pour ${tenantId}`);

  for (const client of clients) {
    // Formater le téléphone au format +33
    let telephone = client.telephone || '';
    if (telephone && !telephone.startsWith('+')) {
      // Convertir 06 xx xx xx xx -> +33 6 xx xx xx xx
      telephone = telephone.replace(/\s/g, ''); // Supprimer espaces
      if (telephone.startsWith('0')) {
        telephone = '+33' + telephone.substring(1);
      }
    }

    // Ne garder que les colonnes existantes dans la table clients
    const clientData = {
      tenant_id: tenantId,
      nom: client.nom,
      prenom: client.prenom || '',
      email: client.email,
      telephone: telephone,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('clients')
      .insert(clientData);

    if (error) {
      console.error(`   ❌ Erreur client ${client.nom}:`, error);
    } else {
      console.log(`   ✅ ${client.prenom} ${client.nom}`);
    }
  }
}

async function createIAConfig(tenantId, config) {
  console.log(`\n🤖 Configuration IA pour ${tenantId}`);

  const { assistant, ia_config } = config;

  // D'abord récupérer le settings existant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .single();

  const currentSettings = tenant?.settings || {};

  // Fusionner la config IA dans settings
  const newSettings = {
    ...currentSettings,
    ia_config: {
      assistant_name: assistant.name,
      assistant_personality: assistant.personality,
      assistant_greeting: assistant.greeting,
      tools: ia_config.tools,
      pricing_logic: ia_config.pricing_logic,
      prompts: ia_config.prompts,
    },
  };

  const { error } = await supabase
    .from('tenants')
    .update({
      settings: newSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId);

  if (error) {
    console.error(`   ❌ Erreur config IA:`, error);
  } else {
    console.log(`   ✅ Assistant: ${assistant.name}`);
    console.log(`   ✅ Tools: ${ia_config.tools.join(', ')}`);
    console.log(`   ✅ Pricing: ${ia_config.pricing_logic}`);
  }
}

async function createAdminUser(tenantId, config) {
  console.log(`\n🔐 Création admin pour ${tenantId}`);

  const adminEmail = `admin@${tenantId}.test`;
  const adminPassword = 'Test123!'; // À changer en prod

  // Hash du mot de passe (bcrypt)
  const bcrypt = (await import('bcryptjs')).default;
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  // Vérifier si admin existe déjà
  const { data: existing } = await supabase
    .from('admin_users')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email', adminEmail)
    .single();

  if (existing) {
    console.log(`   ⏭️  Admin existe déjà`);
    return;
  }

  const { error } = await supabase
    .from('admin_users')
    .insert({
      email: adminEmail,
      password_hash: passwordHash,
      tenant_id: tenantId,
      role: 'admin',
      nom: 'Admin Test',
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error(`   ❌ Erreur admin:`, error);
  } else {
    console.log(`   ✅ Admin: ${adminEmail} / ${adminPassword}`);
  }
}

async function deleteTenantData(tenantId) {
  // Supprimer dans l'ordre pour respecter les foreign keys
  const tables = [
    'reservation_membres',
    'reservation_lignes',
    'reservations',
    'devis_lignes',
    'devis_historique',
    'devis',
    'opportunites',
    'clients',
    'rh_membres',
    'services',
    'admins',
  ];

  for (const table of tables) {
    try {
      await supabase.from(table).delete().eq('tenant_id', tenantId);
    } catch (e) {
      // Ignorer les erreurs (table peut ne pas exister)
    }
  }

  // Supprimer le tenant lui-même
  await supabase.from('tenants').delete().eq('id', tenantId);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('    PROVISIONING TENANTS DE TEST - NEXUS PLATFORM');
  console.log('═══════════════════════════════════════════════════════════════');

  if (process.argv.includes('--reset')) {
    console.log('\n⚠️  Mode RESET activé - Les données existantes seront supprimées\n');
  }

  const results = {
    success: [],
    failed: [],
  };

  for (const [tenantId, config] of Object.entries(TENANTS_CONFIG)) {
    try {
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`PROVISIONING: ${config.tenant.name} (${tenantId})`);
      console.log(`Profil: ${config.tenant.settings?.business_profile || 'default'}`);
      console.log(`${'─'.repeat(60)}`);

      // 1. Créer le tenant
      await createTenant(config);

      // 2. Créer les services
      await createServices(tenantId, config.services);

      // 3. Créer les membres RH
      await createMembres(tenantId, config.membres);

      // 4. Créer les clients
      await createClients(tenantId, config.clients);

      // 5. Configurer l'IA
      await createIAConfig(tenantId, config);

      // 6. Créer l'admin
      await createAdminUser(tenantId, config);

      results.success.push(tenantId);
    } catch (error) {
      console.error(`\n❌ Erreur provisioning ${tenantId}:`, error);
      results.failed.push({ tenantId, error: error.message });
    }
  }

  // Résumé
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                        RÉSUMÉ');
  console.log('═══════════════════════════════════════════════════════════════');

  if (results.success.length > 0) {
    console.log('\n✅ Tenants créés avec succès:');
    results.success.forEach(id => {
      const config = TENANTS_CONFIG[id];
      console.log(`   • ${id} (${config.tenant.name})`);
      console.log(`     Admin: admin@${id}.test / Test123!`);
      console.log(`     Assistant IA: ${config.assistant.name}`);
    });
  }

  if (results.failed.length > 0) {
    console.log('\n❌ Erreurs:');
    results.failed.forEach(({ tenantId, error }) => {
      console.log(`   • ${tenantId}: ${error}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('Pour tester un tenant:');
  console.log('  1. Aller sur http://localhost:5173/login');
  console.log('  2. Se connecter avec admin@<tenant-id>.test / Test123!');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
