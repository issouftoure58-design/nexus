/**
 * Routes Admin RH - Business Plan
 * Gestion equipe simplifiee
 */

import express from 'express';
import PDFDocument from 'pdfkit';
import { authenticateAdmin } from './adminAuth.js';
import { supabase } from '../config/supabase.js';
import { validerDSN, genererRapport } from '../services/dsnValidator.js';
import documentsRHService from '../services/documentsRHService.js';
const { genererDocument, getOrCreateModeles, regenererPDF, MODELES_DEFAUT } = documentsRHService;

const router = express.Router();

// ============================================
// HELPER: CONVERSION CHAMPS VIDES
// ============================================

/**
 * Convertit les chaînes vides en null (pour les champs date notamment)
 */
function emptyToNull(value) {
  if (value === '' || value === undefined) return null;
  return value;
}

/**
 * Nettoie un objet en convertissant les chaînes vides en null
 */
function cleanEmptyStrings(obj) {
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    cleaned[key] = emptyToNull(value);
  }
  return cleaned;
}

// ============================================
// HELPER: CALCUL CONGÉS PAYÉS ACQUIS
// ============================================

/**
 * Calcule les CP acquis depuis la date d'embauche
 * Règle: 2.5 jours ouvrables par mois complet travaillé
 * Période de référence: 1er juin N-1 au 31 mai N
 * Maximum: 30 jours ouvrables (ou 25 jours ouvrés)
 */
function calculerCPAcquis(dateEmbauche) {
  const now = new Date();
  const embauche = new Date(dateEmbauche);

  // Déterminer la période de référence en cours
  // Si on est avant le 1er juin, la période est juin N-1 à mai N
  // Si on est après le 1er juin, la période est juin N à mai N+1
  let debutPeriode, finPeriode;
  if (now.getMonth() < 5) { // Avant juin
    debutPeriode = new Date(now.getFullYear() - 1, 5, 1); // 1er juin N-1
    finPeriode = new Date(now.getFullYear(), 4, 31); // 31 mai N
  } else {
    debutPeriode = new Date(now.getFullYear(), 5, 1); // 1er juin N
    finPeriode = new Date(now.getFullYear() + 1, 4, 31); // 31 mai N+1
  }

  // Date de début de comptage = max(embauche, début période)
  const debutComptage = embauche > debutPeriode ? embauche : debutPeriode;

  // Si pas encore embauché ou embauché après la période, 0 CP
  if (debutComptage > now) return 0;

  // Calculer le nombre de mois complets travaillés
  let moisTravailles = 0;
  const current = new Date(debutComptage);
  current.setDate(1); // Premier jour du mois

  while (current <= now && current <= finPeriode) {
    // Un mois compte s'il y a au moins 10 jours travaillés dans le mois
    // Simplifié: on compte le mois si l'employé était présent au 1er du mois
    if (current <= now) {
      moisTravailles++;
    }
    current.setMonth(current.getMonth() + 1);
  }

  // 2.5 jours par mois, max 25 jours ouvrés (ou 30 ouvrables)
  const cpAcquis = Math.min(moisTravailles * 2.5, 25);

  return Math.round(cpAcquis * 10) / 10; // Arrondir à 0.5 près
}

/**
 * Calcule les RTT acquis depuis la date d'embauche
 * Règle: si temps de travail > 35h, des RTT sont générés
 * Exemple: 39h/sem → environ 23 RTT/an → ~1.9 RTT/mois
 */
function calculerRTTAcquis(dateEmbauche, heuresHebdo) {
  if (heuresHebdo <= 35) return 0;

  const now = new Date();
  const embauche = new Date(dateEmbauche);
  const anneeActuelle = now.getFullYear();

  // Début de l'année ou date d'embauche si plus récente
  const debutAnnee = new Date(anneeActuelle, 0, 1);
  const debutComptage = embauche > debutAnnee ? embauche : debutAnnee;

  if (debutComptage > now) return 0;

  // Calculer le nombre de mois depuis le début de l'année
  const moisTravailles = Math.max(0,
    (now.getFullYear() - debutComptage.getFullYear()) * 12 +
    (now.getMonth() - debutComptage.getMonth()) + 1
  );

  // RTT annuels selon heures hebdo
  // Formule: (heures_hebdo - 35) * 52 / 7 = jours RTT annuels
  const rttAnnuels = Math.round((heuresHebdo - 35) * 52 / 7);
  const rttMensuels = rttAnnuels / 12;

  const rttAcquis = Math.min(moisTravailles * rttMensuels, rttAnnuels);

  return Math.round(rttAcquis * 10) / 10;
}

// ============================================
// HELPER: GÉNÉRATION ÉCRITURES COMPTABLES PAIE
// ============================================

/**
 * Génère les écritures comptables de paie dans le journal PA
 */
async function genererEcrituresPaie(tenantId, periode, salairesNet, cotisationsPatronales, cotisationsSalariales, paieJournalId) {
  const dateEcriture = `${periode}-28`; // Fin de mois
  const exercice = parseInt(periode.slice(0, 4));
  const totalCotisations = cotisationsPatronales + cotisationsSalariales;
  const brutTotal = salairesNet + cotisationsSalariales;

  // Vérifier si écritures déjà générées pour cette période
  const { data: existantes } = await supabase
    .from('ecritures_comptables')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('journal_code', 'PA')
    .eq('periode', periode);

  if (existantes && existantes.length > 0) {
    // Supprimer les anciennes écritures de paie pour cette période
    await supabase
      .from('ecritures_comptables')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('journal_code', 'PA')
      .eq('periode', periode);
  }

  const ecritures = [];

  // 1. Charge de personnel (brut) - Débit 641
  ecritures.push({
    tenant_id: tenantId,
    journal_code: 'PA',
    date_ecriture: dateEcriture,
    numero_piece: `PAIE-${periode}`,
    compte_numero: '641',
    compte_libelle: 'Rémunérations personnel',
    libelle: `Salaires bruts ${periode}`,
    debit: brutTotal,
    credit: 0,
    paie_journal_id: paieJournalId,
    periode,
    exercice
  });

  // 2. Charges sociales patronales - Débit 645
  if (cotisationsPatronales > 0) {
    ecritures.push({
      tenant_id: tenantId,
      journal_code: 'PA',
      date_ecriture: dateEcriture,
      numero_piece: `PAIE-${periode}`,
      compte_numero: '645',
      compte_libelle: 'Charges sociales',
      libelle: `Cotisations patronales ${periode}`,
      debit: cotisationsPatronales,
      credit: 0,
      paie_journal_id: paieJournalId,
      periode,
      exercice
    });
  }

  // 3. Personnel - rémunérations dues (net à payer) - Crédit 421
  ecritures.push({
    tenant_id: tenantId,
    journal_code: 'PA',
    date_ecriture: dateEcriture,
    numero_piece: `PAIE-${periode}`,
    compte_numero: '421',
    compte_libelle: 'Personnel - Rémunérations dues',
    libelle: `Salaires nets à payer ${periode}`,
    debit: 0,
    credit: salairesNet,
    paie_journal_id: paieJournalId,
    periode,
    exercice
  });

  // 4. Organismes sociaux (total cotisations) - Crédit 431
  if (totalCotisations > 0) {
    ecritures.push({
      tenant_id: tenantId,
      journal_code: 'PA',
      date_ecriture: dateEcriture,
      numero_piece: `PAIE-${periode}`,
      compte_numero: '431',
      compte_libelle: 'Sécurité sociale',
      libelle: `Cotisations sociales ${periode}`,
      debit: 0,
      credit: totalCotisations,
      paie_journal_id: paieJournalId,
      periode,
      exercice
    });
  }

  const { data, error } = await supabase
    .from('ecritures_comptables')
    .insert(ecritures)
    .select();

  if (error) throw error;

  return data || [];
}

// ============================================
// MEMBRES EQUIPE
// ============================================

/**
 * GET /api/admin/rh/membres
 * Liste des membres de l'equipe
 */
router.get('/membres', authenticateAdmin, async (req, res) => {
  try {
    const { data: membres, error } = await supabase
      .from('rh_membres')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .order('nom');

    if (error) throw error;

    res.json(membres || []);
  } catch (error) {
    console.error('[RH] Erreur liste membres:', error);
    res.status(500).json({ error: 'Erreur recuperation equipe' });
  }
});

/**
 * GET /api/admin/rh/membres/disponibles
 * Liste des membres disponibles pour un créneau donné
 * Query params: date (YYYY-MM-DD), heure (HH:MM), duree (minutes, optionnel, défaut 60)
 */
router.get('/membres/disponibles', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { date, heure, duree = 60 } = req.query;

    if (!date || !heure) {
      return res.status(400).json({ error: 'Date et heure requis' });
    }

    // 1. Récupérer tous les membres actifs
    const { data: membres, error: membresError } = await supabase
      .from('rh_membres')
      .select('id, nom, prenom, role, statut, jours_travailles')
      .eq('tenant_id', tenantId)
      .eq('statut', 'actif')
      .order('nom');

    if (membresError) throw membresError;

    // 2. Vérifier le jour de la semaine
    const dateObj = new Date(date);
    const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const jourSemaine = jours[dateObj.getDay()];

    // 3. Calculer la plage horaire demandée
    const [heureStart, minuteStart] = heure.split(':').map(Number);
    const startMinutes = heureStart * 60 + minuteStart;
    const endMinutes = startMinutes + parseInt(duree);

    // 4. Récupérer toutes les réservations du jour avec un membre assigné
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('id, heure, duree_minutes, duree_totale_minutes, membre_id, service_nom, statut')
      .eq('tenant_id', tenantId)
      .eq('date', date)
      .not('membre_id', 'is', null)
      .not('statut', 'in', '("annule","termine")');

    if (resError) throw resError;

    // 5. Récupérer les réservations multi-membres
    const { data: reservationMembres, error: rmError } = await supabase
      .from('reservation_membres')
      .select('reservation_id, membre_id')
      .eq('tenant_id', tenantId);

    if (rmError) throw rmError;

    // Créer un map reservation_id -> liste de membre_ids
    const reservationMembreMap = {};
    (reservationMembres || []).forEach(rm => {
      if (!reservationMembreMap[rm.reservation_id]) {
        reservationMembreMap[rm.reservation_id] = [];
      }
      reservationMembreMap[rm.reservation_id].push(rm.membre_id);
    });

    // 6. Déterminer les membres occupés
    const membresOccupes = new Set();

    (reservations || []).forEach(resa => {
      // Calculer la plage de cette réservation
      const [h, m] = (resa.heure || '09:00').split(':').map(Number);
      const resaStart = h * 60 + m;
      const resaDuree = resa.duree_totale_minutes || resa.duree_minutes || 60;
      const resaEnd = resaStart + resaDuree;

      // Vérifier si chevauchement
      const chevauche = !(endMinutes <= resaStart || startMinutes >= resaEnd);

      if (chevauche) {
        // Membre principal
        if (resa.membre_id) {
          membresOccupes.add(resa.membre_id);
        }
        // Membres multiples
        const membresList = reservationMembreMap[resa.id] || [];
        membresList.forEach(mid => membresOccupes.add(mid));
      }
    });

    // 7. Filtrer les membres disponibles
    const membresDisponibles = (membres || []).filter(m => {
      // Vérifier si le membre travaille ce jour
      const joursTravail = m.jours_travailles || ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
      if (!joursTravail.includes(jourSemaine)) {
        return false;
      }

      // Vérifier s'il n'est pas occupé
      return !membresOccupes.has(m.id);
    });

    res.json({
      disponibles: membresDisponibles,
      occupes: membres?.filter(m => membresOccupes.has(m.id)).map(m => ({
        id: m.id,
        nom: m.nom,
        prenom: m.prenom,
        role: m.role,
        raison: 'Déjà réservé sur ce créneau'
      })) || [],
      non_travail: membres?.filter(m => {
        const joursTravail = m.jours_travailles || ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
        return !joursTravail.includes(jourSemaine);
      }).map(m => ({
        id: m.id,
        nom: m.nom,
        prenom: m.prenom,
        role: m.role,
        raison: `Ne travaille pas le ${jourSemaine}`
      })) || [],
      creneau: { date, heure, duree: parseInt(duree), jour: jourSemaine }
    });
  } catch (error) {
    console.error('[RH] Erreur membres disponibles:', error);
    res.status(500).json({ error: 'Erreur vérification disponibilités' });
  }
});

/**
 * POST /api/admin/rh/membres
 * Ajouter un membre avec tous les champs enrichis
 */
router.post('/membres', authenticateAdmin, async (req, res) => {
  try {
    const {
      // Identité
      nom, prenom, email, telephone, sexe, nationalite, lieu_naissance, date_naissance,
      // Adresse
      adresse_rue, adresse_cp, adresse_ville, adresse_pays,
      // Pièce d'identité
      piece_identite_type, piece_identite_numero, piece_identite_expiration, piece_identite_url,
      // Contrat
      role, poste, type_contrat, date_embauche, date_fin_contrat, temps_travail, heures_hebdo, heures_mensuelles, jours_travailles,
      // Classification
      convention_collective, classification_niveau, classification_echelon, classification_coefficient, categorie_sociopro,
      // Rémunération
      salaire_mensuel, regime_ss, mutuelle_obligatoire, mutuelle_dispense, prevoyance, iban, bic,
      // Contact urgence
      contact_urgence_nom, contact_urgence_tel, contact_urgence_lien,
      // Autre
      nir, notes
    } = req.body;

    if (!nom || !prenom) {
      return res.status(400).json({ error: 'Nom et prénom requis' });
    }

    const { data: membre, error } = await supabase
      .from('rh_membres')
      .insert({
        tenant_id: req.admin.tenant_id,
        // Identité
        nom, prenom,
        email: emptyToNull(email),
        telephone: emptyToNull(telephone),
        sexe: emptyToNull(sexe),
        nationalite: emptyToNull(nationalite),
        lieu_naissance: emptyToNull(lieu_naissance),
        date_naissance: emptyToNull(date_naissance),
        nir: emptyToNull(nir),
        // Adresse
        adresse_rue: emptyToNull(adresse_rue),
        adresse_cp: emptyToNull(adresse_cp),
        adresse_ville: emptyToNull(adresse_ville),
        adresse_pays: adresse_pays || 'France',
        // Pièce d'identité
        piece_identite_type: emptyToNull(piece_identite_type),
        piece_identite_numero: emptyToNull(piece_identite_numero),
        piece_identite_expiration: emptyToNull(piece_identite_expiration),
        piece_identite_url: emptyToNull(piece_identite_url),
        // Contrat
        role: role || 'autre',
        poste: emptyToNull(poste),
        type_contrat: type_contrat || 'cdi',
        date_embauche: emptyToNull(date_embauche),
        date_fin_contrat: emptyToNull(date_fin_contrat),
        temps_travail: temps_travail || 'temps_plein',
        heures_hebdo: heures_hebdo || 35,
        heures_mensuelles: heures_mensuelles || 151.67,
        jours_travailles: jours_travailles || ['lundi','mardi','mercredi','jeudi','vendredi'],
        // Classification
        convention_collective: emptyToNull(convention_collective),
        classification_niveau: emptyToNull(classification_niveau),
        classification_echelon: emptyToNull(classification_echelon),
        classification_coefficient: emptyToNull(classification_coefficient),
        categorie_sociopro: emptyToNull(categorie_sociopro),
        // Rémunération
        salaire_mensuel: salaire_mensuel || 0,
        regime_ss: regime_ss || 'general',
        mutuelle_obligatoire: mutuelle_obligatoire !== false,
        mutuelle_dispense: mutuelle_dispense || false,
        prevoyance: prevoyance || false,
        iban: emptyToNull(iban),
        bic: emptyToNull(bic),
        // Contact urgence
        contact_urgence_nom: emptyToNull(contact_urgence_nom),
        contact_urgence_tel: emptyToNull(contact_urgence_tel),
        contact_urgence_lien: emptyToNull(contact_urgence_lien),
        // Autre
        notes: emptyToNull(notes),
        statut: 'actif'
      })
      .select()
      .single();

    if (error) throw error;

    // Créer le compteur de congés pour l'année en cours
    // Calcul dynamique basé sur la date d'embauche
    const annee = new Date().getFullYear();
    const dateEmbauche = date_embauche ? new Date(date_embauche) : new Date();
    const cpAcquis = calculerCPAcquis(dateEmbauche);
    const rttAcquis = heures_hebdo > 35 ? calculerRTTAcquis(dateEmbauche, heures_hebdo) : 0;

    await supabase
      .from('rh_compteurs_conges')
      .insert({
        tenant_id: req.admin.tenant_id,
        membre_id: membre.id,
        annee,
        cp_acquis: cpAcquis,
        rtt_acquis: rttAcquis
      })
      .select();

    res.json(membre);
  } catch (error) {
    console.error('[RH] Erreur ajout membre:', error);
    res.status(500).json({ error: 'Erreur ajout membre' });
  }
});

/**
 * PUT /api/admin/rh/membres/:id
 * Modifier un membre avec tous les champs enrichis
 */
router.put('/membres/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      // Identité
      nom, prenom, email, telephone, sexe, nationalite, lieu_naissance, date_naissance,
      // Adresse
      adresse_rue, adresse_cp, adresse_ville, adresse_pays,
      // Pièce d'identité
      piece_identite_type, piece_identite_numero, piece_identite_expiration, piece_identite_url,
      // Contrat
      role, poste, type_contrat, date_embauche, date_fin_contrat, temps_travail, heures_hebdo, heures_mensuelles, jours_travailles,
      // Classification
      convention_collective, classification_niveau, classification_echelon, classification_coefficient, categorie_sociopro,
      // Rémunération
      salaire_mensuel, regime_ss, mutuelle_obligatoire, mutuelle_dispense, prevoyance, iban, bic,
      // Contact urgence
      contact_urgence_nom, contact_urgence_tel, contact_urgence_lien,
      // Autre
      nir, notes, statut
    } = req.body;

    // Construire l'objet de mise à jour (seulement les champs présents, chaînes vides → null)
    const updateData = {};

    // Identité
    if (nom !== undefined) updateData.nom = nom;
    if (prenom !== undefined) updateData.prenom = prenom;
    if (email !== undefined) updateData.email = emptyToNull(email);
    if (telephone !== undefined) updateData.telephone = emptyToNull(telephone);
    if (sexe !== undefined) updateData.sexe = emptyToNull(sexe);
    if (nationalite !== undefined) updateData.nationalite = emptyToNull(nationalite);
    if (lieu_naissance !== undefined) updateData.lieu_naissance = emptyToNull(lieu_naissance);
    if (date_naissance !== undefined) updateData.date_naissance = emptyToNull(date_naissance);
    if (nir !== undefined) updateData.nir = emptyToNull(nir);

    // Adresse
    if (adresse_rue !== undefined) updateData.adresse_rue = emptyToNull(adresse_rue);
    if (adresse_cp !== undefined) updateData.adresse_cp = emptyToNull(adresse_cp);
    if (adresse_ville !== undefined) updateData.adresse_ville = emptyToNull(adresse_ville);
    if (adresse_pays !== undefined) updateData.adresse_pays = emptyToNull(adresse_pays);

    // Pièce d'identité
    if (piece_identite_type !== undefined) updateData.piece_identite_type = emptyToNull(piece_identite_type);
    if (piece_identite_numero !== undefined) updateData.piece_identite_numero = emptyToNull(piece_identite_numero);
    if (piece_identite_expiration !== undefined) updateData.piece_identite_expiration = emptyToNull(piece_identite_expiration);
    if (piece_identite_url !== undefined) updateData.piece_identite_url = emptyToNull(piece_identite_url);

    // Contrat
    if (role !== undefined) updateData.role = role;
    if (poste !== undefined) updateData.poste = emptyToNull(poste);
    if (type_contrat !== undefined) updateData.type_contrat = type_contrat;
    if (date_embauche !== undefined) updateData.date_embauche = emptyToNull(date_embauche);
    if (date_fin_contrat !== undefined) updateData.date_fin_contrat = emptyToNull(date_fin_contrat);
    if (temps_travail !== undefined) updateData.temps_travail = temps_travail;
    if (heures_hebdo !== undefined) updateData.heures_hebdo = heures_hebdo;
    if (heures_mensuelles !== undefined) updateData.heures_mensuelles = heures_mensuelles;
    if (jours_travailles !== undefined) updateData.jours_travailles = jours_travailles;

    // Classification
    if (convention_collective !== undefined) updateData.convention_collective = convention_collective;
    if (classification_niveau !== undefined) updateData.classification_niveau = classification_niveau;
    if (classification_echelon !== undefined) updateData.classification_echelon = classification_echelon;
    if (classification_coefficient !== undefined) updateData.classification_coefficient = classification_coefficient;
    if (categorie_sociopro !== undefined) updateData.categorie_sociopro = categorie_sociopro;

    // Rémunération
    if (salaire_mensuel !== undefined) updateData.salaire_mensuel = salaire_mensuel;
    if (regime_ss !== undefined) updateData.regime_ss = regime_ss;
    if (mutuelle_obligatoire !== undefined) updateData.mutuelle_obligatoire = mutuelle_obligatoire;
    if (mutuelle_dispense !== undefined) updateData.mutuelle_dispense = mutuelle_dispense;
    if (prevoyance !== undefined) updateData.prevoyance = prevoyance;
    if (iban !== undefined) updateData.iban = iban;
    if (bic !== undefined) updateData.bic = bic;

    // Contact urgence
    if (contact_urgence_nom !== undefined) updateData.contact_urgence_nom = contact_urgence_nom;
    if (contact_urgence_tel !== undefined) updateData.contact_urgence_tel = contact_urgence_tel;
    if (contact_urgence_lien !== undefined) updateData.contact_urgence_lien = contact_urgence_lien;

    // Autre
    if (notes !== undefined) updateData.notes = notes;
    if (statut !== undefined) updateData.statut = statut;

    const { data: membre, error } = await supabase
      .from('rh_membres')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;

    res.json(membre);
  } catch (error) {
    console.error('[RH] Erreur modification membre:', error);
    res.status(500).json({ error: 'Erreur modification membre' });
  }
});

/**
 * DELETE /api/admin/rh/membres/:id
 * Supprimer un membre (soft delete via statut)
 */
router.delete('/membres/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('rh_membres')
      .update({ statut: 'inactif' })
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('[RH] Erreur suppression membre:', error);
    res.status(500).json({ error: 'Erreur suppression membre' });
  }
});

// ============================================
// DÉTAIL EMPLOYÉ (pour EntityLink)
// ============================================

/**
 * GET /api/admin/rh/employes/:id
 * Détail complet d'un employé avec compteur de congés
 */
router.get('/employes/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer l'employé
    const { data: employe, error } = await supabase
      .from('rh_membres')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (error || !employe) {
      return res.status(404).json({ success: false, error: 'Employé non trouvé' });
    }

    // Récupérer le compteur de congés
    const annee = new Date().getFullYear();
    const { data: compteur } = await supabase
      .from('rh_compteurs_conges')
      .select('*')
      .eq('membre_id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .eq('annee', annee)
      .single();

    // Formater la réponse
    res.json({
      success: true,
      employe: {
        id: employe.id,
        nom: employe.nom,
        prenom: employe.prenom,
        email: employe.email,
        telephone: employe.telephone,
        poste: employe.poste || employe.role,
        departement: employe.categorie_sociopro,
        salaire_mensuel: employe.salaire_mensuel,
        date_embauche: employe.date_embauche,
        date_naissance: employe.date_naissance,
        type_contrat: employe.type_contrat,
        temps_travail: employe.temps_travail,
        heures_hebdo: employe.heures_hebdo,
        actif: employe.statut === 'actif',
        adresse_rue: employe.adresse_rue,
        adresse_cp: employe.adresse_cp,
        adresse_ville: employe.adresse_ville,
        nir: employe.nir,
        iban: employe.iban,
        bic: employe.bic,
        contact_urgence_nom: employe.contact_urgence_nom,
        contact_urgence_tel: employe.contact_urgence_tel
      },
      compteur_conges: compteur ? {
        annee: compteur.annee,
        cp_acquis: compteur.cp_acquis || 0,
        cp_pris: compteur.cp_pris || 0,
        cp_solde: (compteur.cp_acquis || 0) - (compteur.cp_pris || 0),
        rtt_acquis: compteur.rtt_acquis || 0,
        rtt_pris: compteur.rtt_pris || 0,
        rtt_solde: (compteur.rtt_acquis || 0) - (compteur.rtt_pris || 0)
      } : null
    });
  } catch (error) {
    console.error('[RH] Erreur détail employé:', error);
    res.status(500).json({ success: false, error: 'Erreur récupération employé' });
  }
});

// ============================================
// DIPLÔMES
// ============================================

/**
 * GET /api/admin/rh/membres/:id/diplomes
 * Liste des diplômes d'un employé
 */
router.get('/membres/:id/diplomes', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: diplomes, error } = await supabase
      .from('rh_diplomes')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('membre_id', id)
      .order('date_obtention', { ascending: false });

    if (error) throw error;

    res.json(diplomes || []);
  } catch (error) {
    console.error('[RH] Erreur liste diplômes:', error);
    res.status(500).json({ error: 'Erreur récupération diplômes' });
  }
});

/**
 * POST /api/admin/rh/membres/:id/diplomes
 * Ajouter un diplôme
 */
router.post('/membres/:id/diplomes', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { intitule, etablissement, date_obtention, niveau, domaine, document_url } = req.body;

    if (!intitule) {
      return res.status(400).json({ error: 'Intitulé du diplôme requis' });
    }

    // Vérifier que le membre appartient au tenant
    const { data: membre } = await supabase
      .from('rh_membres')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (!membre) {
      return res.status(404).json({ error: 'Employé non trouvé' });
    }

    const { data: diplome, error } = await supabase
      .from('rh_diplomes')
      .insert({
        tenant_id: req.admin.tenant_id,
        membre_id: parseInt(id),
        intitule,
        etablissement,
        date_obtention,
        niveau,
        domaine,
        document_url
      })
      .select()
      .single();

    if (error) throw error;

    res.json(diplome);
  } catch (error) {
    console.error('[RH] Erreur ajout diplôme:', error);
    res.status(500).json({ error: 'Erreur ajout diplôme' });
  }
});

/**
 * PUT /api/admin/rh/diplomes/:id
 * Modifier un diplôme
 */
router.put('/diplomes/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { intitule, etablissement, date_obtention, niveau, domaine, document_url } = req.body;

    const { data: diplome, error } = await supabase
      .from('rh_diplomes')
      .update({
        intitule,
        etablissement,
        date_obtention,
        niveau,
        domaine,
        document_url
      })
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;

    res.json(diplome);
  } catch (error) {
    console.error('[RH] Erreur modification diplôme:', error);
    res.status(500).json({ error: 'Erreur modification diplôme' });
  }
});

/**
 * DELETE /api/admin/rh/diplomes/:id
 * Supprimer un diplôme
 */
router.delete('/diplomes/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('rh_diplomes')
      .delete()
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('[RH] Erreur suppression diplôme:', error);
    res.status(500).json({ error: 'Erreur suppression diplôme' });
  }
});

// ============================================
// COMPTEURS CONGÉS
// ============================================

/**
 * GET /api/admin/rh/membres/:id/compteurs
 * Récupérer les compteurs de congés d'un employé
 */
router.get('/membres/:id/compteurs', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { annee } = req.query;
    const anneeFilter = annee || new Date().getFullYear();

    const { data: compteurs, error } = await supabase
      .from('rh_compteurs_conges')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('membre_id', id)
      .eq('annee', anneeFilter)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    // Si pas de compteur pour cette année, créer un par défaut
    if (!compteurs) {
      const { data: membre } = await supabase
        .from('rh_membres')
        .select('heures_hebdo')
        .eq('id', id)
        .eq('tenant_id', req.admin.tenant_id)
        .single();

      const heuresHebdo = membre?.heures_hebdo || 35;
      const rttAcquis = heuresHebdo > 35 ? Math.round((heuresHebdo - 35) * 52 / 12 / 7 * 12) : 0;

      const { data: newCompteur, error: insertError } = await supabase
        .from('rh_compteurs_conges')
        .insert({
          tenant_id: req.admin.tenant_id,
          membre_id: parseInt(id),
          annee: parseInt(anneeFilter),
          cp_acquis: 25,
          rtt_acquis: rttAcquis
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return res.json(newCompteur);
    }

    // Calculer les soldes
    const result = {
      ...compteurs,
      cp_solde: (compteurs.cp_acquis || 0) + (compteurs.cp_report_n1 || 0) - (compteurs.cp_pris || 0),
      rtt_solde: (compteurs.rtt_acquis || 0) - (compteurs.rtt_pris || 0),
      rc_solde: (compteurs.rc_acquis || 0) - (compteurs.rc_pris || 0)
    };

    res.json(result);
  } catch (error) {
    console.error('[RH] Erreur compteurs:', error);
    res.status(500).json({ error: 'Erreur récupération compteurs' });
  }
});

/**
 * PUT /api/admin/rh/membres/:id/compteurs
 * Modifier manuellement les compteurs (ajustements)
 */
router.put('/membres/:id/compteurs', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      annee,
      cp_acquis, cp_pris, cp_report_n1,
      rtt_acquis, rtt_pris,
      rc_acquis, rc_pris,
      conges_anciennete, conges_fractionnement
    } = req.body;

    const anneeFilter = annee || new Date().getFullYear();

    const updateData = {};
    if (cp_acquis !== undefined) updateData.cp_acquis = cp_acquis;
    if (cp_pris !== undefined) updateData.cp_pris = cp_pris;
    if (cp_report_n1 !== undefined) updateData.cp_report_n1 = cp_report_n1;
    if (rtt_acquis !== undefined) updateData.rtt_acquis = rtt_acquis;
    if (rtt_pris !== undefined) updateData.rtt_pris = rtt_pris;
    if (rc_acquis !== undefined) updateData.rc_acquis = rc_acquis;
    if (rc_pris !== undefined) updateData.rc_pris = rc_pris;
    if (conges_anciennete !== undefined) updateData.conges_anciennete = conges_anciennete;
    if (conges_fractionnement !== undefined) updateData.conges_fractionnement = conges_fractionnement;
    updateData.updated_at = new Date().toISOString();

    const { data: compteur, error } = await supabase
      .from('rh_compteurs_conges')
      .upsert({
        tenant_id: req.admin.tenant_id,
        membre_id: parseInt(id),
        annee: parseInt(anneeFilter),
        ...updateData
      }, {
        onConflict: 'tenant_id,membre_id,annee'
      })
      .select()
      .single();

    if (error) throw error;

    res.json(compteur);
  } catch (error) {
    console.error('[RH] Erreur modification compteurs:', error);
    res.status(500).json({ error: 'Erreur modification compteurs' });
  }
});

/**
 * GET /api/admin/rh/compteurs
 * Récapitulatif des compteurs de tous les employés
 */
router.get('/compteurs', authenticateAdmin, async (req, res) => {
  try {
    const { annee } = req.query;
    const anneeFilter = annee || new Date().getFullYear();

    const { data: compteurs, error } = await supabase
      .from('rh_compteurs_conges')
      .select(`
        *,
        membre:rh_membres(id, nom, prenom, role, statut)
      `)
      .eq('tenant_id', req.admin.tenant_id)
      .eq('annee', anneeFilter);

    if (error) throw error;

    // Filtrer uniquement les employés actifs et calculer les soldes
    const result = (compteurs || [])
      .filter(c => c.membre?.statut === 'actif')
      .map(c => ({
        membre_id: c.membre_id,
        membre_nom: `${c.membre.prenom} ${c.membre.nom}`,
        membre_role: c.membre.role,
        annee: c.annee,
        cp: {
          acquis: c.cp_acquis || 0,
          pris: c.cp_pris || 0,
          report: c.cp_report_n1 || 0,
          solde: (c.cp_acquis || 0) + (c.cp_report_n1 || 0) - (c.cp_pris || 0)
        },
        rtt: {
          acquis: c.rtt_acquis || 0,
          pris: c.rtt_pris || 0,
          solde: (c.rtt_acquis || 0) - (c.rtt_pris || 0)
        },
        rc: {
          acquis: c.rc_acquis || 0,
          pris: c.rc_pris || 0,
          solde: (c.rc_acquis || 0) - (c.rc_pris || 0)
        },
        conges_anciennete: c.conges_anciennete || 0,
        conges_fractionnement: c.conges_fractionnement || 0
      }));

    res.json(result);
  } catch (error) {
    console.error('[RH] Erreur liste compteurs:', error);
    res.status(500).json({ error: 'Erreur récupération compteurs' });
  }
});

/**
 * POST /api/admin/rh/compteurs/recalculer
 * Recalcule les compteurs de tous les employés basé sur leur date d'embauche
 */
router.post('/compteurs/recalculer', authenticateAdmin, async (req, res) => {
  try {
    const annee = new Date().getFullYear();

    // Récupérer tous les membres actifs
    const { data: membres, error: membreErr } = await supabase
      .from('rh_membres')
      .select('id, date_embauche, heures_hebdo')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('statut', 'actif');

    if (membreErr) throw membreErr;

    // Récupérer les absences approuvées pour calculer les jours pris
    const { data: absences } = await supabase
      .from('rh_absences')
      .select('membre_id, type, jours_ouvres')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('statut', 'approuve')
      .gte('date_debut', `${annee}-01-01`)
      .lte('date_fin', `${annee}-12-31`);

    const results = [];

    for (const membre of membres || []) {
      const dateEmbauche = membre.date_embauche ? new Date(membre.date_embauche) : new Date();
      const heuresHebdo = membre.heures_hebdo || 35;

      // Calculer les CP et RTT acquis
      const cpAcquis = calculerCPAcquis(dateEmbauche);
      const rttAcquis = calculerRTTAcquis(dateEmbauche, heuresHebdo);

      // Calculer les jours pris depuis les absences
      const absencesMembre = (absences || []).filter(a => a.membre_id === membre.id);
      const cpPris = absencesMembre
        .filter(a => a.type === 'conge')
        .reduce((sum, a) => sum + (a.jours_ouvres || 0), 0);
      const rttPris = absencesMembre
        .filter(a => a.type === 'rtt')
        .reduce((sum, a) => sum + (a.jours_ouvres || 0), 0);
      const rcPris = absencesMembre
        .filter(a => a.type === 'repos_compensateur')
        .reduce((sum, a) => sum + (a.jours_ouvres || 0), 0);

      // Mettre à jour ou créer le compteur
      const { data: existing } = await supabase
        .from('rh_compteurs_conges')
        .select('id')
        .eq('tenant_id', req.admin.tenant_id)
        .eq('membre_id', membre.id)
        .eq('annee', annee)
        .single();

      const compteurData = {
        cp_acquis: cpAcquis,
        cp_pris: cpPris,
        rtt_acquis: rttAcquis,
        rtt_pris: rttPris,
        rc_pris: rcPris,
        updated_at: new Date().toISOString()
      };

      if (existing) {
        await supabase
          .from('rh_compteurs_conges')
          .update(compteurData)
          .eq('id', existing.id);
      } else {
        await supabase
          .from('rh_compteurs_conges')
          .insert({
            tenant_id: req.admin.tenant_id,
            membre_id: membre.id,
            annee,
            ...compteurData
          });
      }

      results.push({
        membre_id: membre.id,
        cp_acquis: cpAcquis,
        cp_pris: cpPris,
        cp_solde: cpAcquis - cpPris,
        rtt_acquis: rttAcquis,
        rtt_pris: rttPris
      });
    }

    res.json({
      message: `${results.length} compteur(s) recalculé(s)`,
      compteurs: results
    });
  } catch (error) {
    console.error('[RH] Erreur recalcul compteurs:', error);
    res.status(500).json({ error: 'Erreur recalcul compteurs' });
  }
});

// ============================================
// VÉRIFICATION DISPONIBILITÉ
// ============================================

/**
 * GET /api/admin/rh/planning/disponibilite
 * Vérifie la disponibilité d'un employé pour un créneau
 */
router.get('/planning/disponibilite', authenticateAdmin, async (req, res) => {
  try {
    const { membre_id, date, heure_debut, heure_fin } = req.query;

    if (!membre_id || !date || !heure_debut || !heure_fin) {
      return res.status(400).json({ error: 'membre_id, date, heure_debut et heure_fin requis' });
    }

    // Appeler la fonction SQL de vérification
    const { data, error } = await supabase.rpc('verifier_disponibilite_employe', {
      p_tenant_id: req.admin.tenant_id,
      p_membre_id: parseInt(membre_id),
      p_date: date,
      p_heure_debut: heure_debut,
      p_heure_fin: heure_fin
    });

    if (error) {
      // Si la fonction n'existe pas encore, faire une vérification basique
      if (error.code === 'PGRST202' || error.message.includes('function')) {
        // Vérification basique des conflits
        const { data: conflits } = await supabase
          .from('reservations')
          .select('id, heure_debut, heure_fin, service_nom')
          .eq('tenant_id', req.admin.tenant_id)
          .eq('membre_id', membre_id)
          .eq('date_reservation', date)
          .not('statut', 'in', '("cancelled","no_show")')
          .or(`and(heure_debut.lt.${heure_fin},heure_fin.gt.${heure_debut})`);

        // Vérifier absences
        const { data: absences } = await supabase
          .from('rh_absences')
          .select('type, date_debut, date_fin')
          .eq('tenant_id', req.admin.tenant_id)
          .eq('membre_id', membre_id)
          .eq('statut', 'approuve')
          .lte('date_debut', date)
          .gte('date_fin', date);

        return res.json({
          disponible: (!conflits || conflits.length === 0) && (!absences || absences.length === 0),
          conflits: conflits || [],
          absences: absences || [],
          alertes: absences?.length > 0 ? [{
            type: 'absence',
            niveau: 'error',
            message: 'Employé en absence ce jour'
          }] : []
        });
      }
      throw error;
    }

    res.json(data);
  } catch (error) {
    console.error('[RH] Erreur vérification disponibilité:', error);
    res.status(500).json({ error: 'Erreur vérification disponibilité' });
  }
});

/**
 * GET /api/admin/rh/planning/resume-hebdo
 * Résumé hebdomadaire des heures planifiées par employé
 */
router.get('/planning/resume-hebdo', authenticateAdmin, async (req, res) => {
  try {
    const { semaine } = req.query; // format: YYYY-WW ou date

    // Calculer les dates de la semaine
    let dateDebut;
    if (semaine && semaine.includes('-W')) {
      const [year, week] = semaine.split('-W');
      const firstDayOfYear = new Date(parseInt(year), 0, 1);
      const daysOffset = (parseInt(week) - 1) * 7 - firstDayOfYear.getDay() + 1;
      dateDebut = new Date(firstDayOfYear.getTime() + daysOffset * 24 * 60 * 60 * 1000);
    } else if (semaine) {
      dateDebut = new Date(semaine);
    } else {
      const now = new Date();
      const dayOfWeek = now.getDay();
      dateDebut = new Date(now);
      dateDebut.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    }

    const dateFin = new Date(dateDebut);
    dateFin.setDate(dateDebut.getDate() + 6);

    const dateDebutStr = dateDebut.toISOString().split('T')[0];
    const dateFinStr = dateFin.toISOString().split('T')[0];

    // Récupérer tous les employés actifs
    const { data: membres } = await supabase
      .from('rh_membres')
      .select('id, nom, prenom, heures_hebdo, role')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('statut', 'actif');

    // Récupérer les réservations de la semaine (colonnes correctes: date, heure, duree_minutes)
    const { data: reservations } = await supabase
      .from('reservations')
      .select('id, membre_id, heure, duree_minutes, duree_totale_minutes, date')
      .eq('tenant_id', req.admin.tenant_id)
      .gte('date', dateDebutStr)
      .lte('date', dateFinStr)
      .not('statut', 'in', '("cancelled","no_show","annule")');

    // Récupérer les membres multiples pour ces réservations
    const reservationIds = (reservations || []).map(r => r.id);
    const { data: reservationMembres } = reservationIds.length > 0
      ? await supabase
          .from('reservation_membres')
          .select('reservation_id, membre_id')
          .eq('tenant_id', req.admin.tenant_id)
          .in('reservation_id', reservationIds)
      : { data: [] };

    // Récupérer les lignes de services pour avoir la durée par membre
    const { data: reservationLignes } = reservationIds.length > 0
      ? await supabase
          .from('reservation_lignes')
          .select('reservation_id, membre_id, duree_minutes, quantite')
          .eq('tenant_id', req.admin.tenant_id)
          .in('reservation_id', reservationIds)
      : { data: [] };

    // Calculer les heures par employé
    const resume = (membres || []).map(m => {
      let heuresPlanifiees = 0;
      let nbRdv = 0;

      (reservations || []).forEach(r => {
        // Vérifier si ce membre est assigné à cette réservation
        const estMembrePrincipal = r.membre_id === m.id;
        const estMembreMultiple = (reservationMembres || []).some(
          rm => rm.reservation_id === r.id && rm.membre_id === m.id
        );

        if (estMembrePrincipal || estMembreMultiple) {
          nbRdv++;

          // Chercher la durée spécifique pour ce membre dans les lignes
          const lignesMembre = (reservationLignes || []).filter(
            l => l.reservation_id === r.id && l.membre_id === m.id
          );

          if (lignesMembre.length > 0) {
            // Utiliser la durée des services assignés à ce membre
            lignesMembre.forEach(l => {
              const duree = (l.duree_minutes || 60) * (l.quantite || 1);
              heuresPlanifiees += duree / 60;
            });
          } else {
            // Fallback: utiliser la durée totale de la réservation
            const dureeMinutes = r.duree_totale_minutes || r.duree_minutes || 60;
            heuresPlanifiees += dureeMinutes / 60;
          }
        }
      });

      const heuresContrat = m.heures_hebdo || 35;
      const pourcentage = heuresContrat > 0 ? Math.round(heuresPlanifiees / heuresContrat * 100) : 0;

      let statut = 'ok';
      if (pourcentage > 100) statut = 'depassement';
      else if (pourcentage > 90) statut = 'proche_limite';

      return {
        membre_id: m.id,
        employe_nom: `${m.prenom} ${m.nom}`,
        semaine_debut: dateDebutStr,
        role: m.role,
        heures_contrat: heuresContrat,
        heures_planifiees: Math.round(heuresPlanifiees * 100) / 100,
        heures_disponibles: Math.round((heuresContrat - heuresPlanifiees) * 100) / 100,
        pourcentage_remplissage: pourcentage,
        nb_rdv: nbRdv,
        statut_charge: statut
      };
    });

    // Retourner directement le tableau (le frontend attend un array)
    res.json(resume);
  } catch (error) {
    console.error('[RH] Erreur résumé hebdo:', error);
    res.status(500).json({ error: 'Erreur récupération résumé' });
  }
});

// ============================================
// PERFORMANCES
// ============================================

/**
 * GET /api/admin/rh/performances
 * Liste des performances (derniers mois)
 */
router.get('/performances', authenticateAdmin, async (req, res) => {
  try {
    const { membre_id, periode } = req.query;

    let query = supabase
      .from('rh_performances')
      .select(`
        *,
        membre:rh_membres(id, nom, prenom, role)
      `)
      .eq('tenant_id', req.admin.tenant_id)
      .order('periode', { ascending: false });

    if (membre_id) {
      query = query.eq('membre_id', membre_id);
    }
    if (periode) {
      query = query.eq('periode', periode);
    }

    const { data: performances, error } = await query.limit(50);

    if (error) throw error;

    res.json(performances || []);
  } catch (error) {
    console.error('[RH] Erreur performances:', error);
    res.status(500).json({ error: 'Erreur recuperation performances' });
  }
});

/**
 * POST /api/admin/rh/performances
 * Enregistrer une performance mensuelle
 */
router.post('/performances', authenticateAdmin, async (req, res) => {
  try {
    const { membre_id, periode, ca_genere, rdv_realises, taux_conversion, clients_acquis, note_satisfaction, objectif_atteint } = req.body;

    if (!membre_id || !periode) {
      return res.status(400).json({ error: 'Membre et periode requis' });
    }

    // Verifier que le membre appartient au tenant
    const { data: membre } = await supabase
      .from('rh_membres')
      .select('id')
      .eq('id', membre_id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (!membre) {
      return res.status(404).json({ error: 'Membre non trouve' });
    }

    // Upsert pour eviter les doublons periode/membre
    const { data: perf, error } = await supabase
      .from('rh_performances')
      .upsert({
        tenant_id: req.admin.tenant_id,
        membre_id,
        periode,
        ca_genere: ca_genere || 0,
        rdv_realises: rdv_realises || 0,
        taux_conversion: taux_conversion || 0,
        clients_acquis: clients_acquis || 0,
        note_satisfaction: note_satisfaction || 0,
        objectif_atteint: objectif_atteint || false
      }, {
        onConflict: 'membre_id,periode'
      })
      .select()
      .single();

    if (error) throw error;

    res.json(perf);
  } catch (error) {
    console.error('[RH] Erreur enregistrement performance:', error);
    res.status(500).json({ error: 'Erreur enregistrement performance' });
  }
});

// ============================================
// ABSENCES
// ============================================

/**
 * GET /api/admin/rh/absences
 * Liste des absences avec filtres
 */
router.get('/absences', authenticateAdmin, async (req, res) => {
  try {
    const { membre_id, statut, type, date_debut, date_fin, annee } = req.query;

    let query = supabase
      .from('rh_absences')
      .select(`
        *,
        membre:rh_membres!rh_absences_membre_id_fkey(id, nom, prenom, role, email),
        approuveur:rh_membres!rh_absences_approuve_par_fkey(id, nom, prenom)
      `)
      .eq('tenant_id', req.admin.tenant_id)
      .order('date_debut', { ascending: false });

    if (membre_id) {
      query = query.eq('membre_id', membre_id);
    }
    if (statut) {
      query = query.eq('statut', statut);
    }
    if (type) {
      query = query.eq('type', type);
    }
    if (date_debut) {
      query = query.gte('date_debut', date_debut);
    }
    if (date_fin) {
      query = query.lte('date_fin', date_fin);
    }
    if (annee) {
      query = query.gte('date_debut', `${annee}-01-01`).lte('date_debut', `${annee}-12-31`);
    }

    const { data: absences, error } = await query;

    if (error) throw error;

    res.json(absences || []);
  } catch (error) {
    console.error('[RH] Erreur absences:', error);
    res.status(500).json({ error: 'Erreur recuperation absences' });
  }
});

/**
 * GET /api/admin/rh/absences/calendrier
 * Calendrier des absences pour une période
 */
router.get('/absences/calendrier', authenticateAdmin, async (req, res) => {
  try {
    const { mois, annee } = req.query;
    const year = annee || new Date().getFullYear();
    const month = mois || new Date().getMonth() + 1;

    const dateDebut = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const dateFin = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    // Récupérer les absences approuvées qui chevauchent cette période
    const { data: absences, error } = await supabase
      .from('rh_absences')
      .select(`
        id, membre_id, type, date_debut, date_fin, demi_journee, periode_journee,
        membre:rh_membres!rh_absences_membre_id_fkey(id, nom, prenom, role)
      `)
      .eq('tenant_id', req.admin.tenant_id)
      .eq('statut', 'approuve')
      .lte('date_debut', dateFin)
      .gte('date_fin', dateDebut);

    if (error) throw error;

    // Organiser par jour
    const calendrier = {};
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      calendrier[dateStr] = [];
    }

    (absences || []).forEach(abs => {
      const debut = new Date(abs.date_debut);
      const fin = new Date(abs.date_fin);

      for (let d = new Date(debut); d <= fin; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (calendrier[dateStr]) {
          calendrier[dateStr].push({
            id: abs.id,
            membre_id: abs.membre_id,
            membre_nom: abs.membre ? `${abs.membre.prenom} ${abs.membre.nom}` : 'Inconnu',
            type: abs.type,
            demi_journee: abs.demi_journee,
            periode: abs.periode_journee
          });
        }
      }
    });

    res.json({
      periode: { mois: month, annee: year },
      calendrier
    });
  } catch (error) {
    console.error('[RH] Erreur calendrier absences:', error);
    res.status(500).json({ error: 'Erreur récupération calendrier' });
  }
});

/**
 * POST /api/admin/rh/absences
 * Créer une demande d'absence
 */
router.post('/absences', authenticateAdmin, async (req, res) => {
  try {
    const {
      membre_id, type, date_debut, date_fin, motif,
      demi_journee, periode_journee, justificatif_url,
      statut_initial // 'en_attente' par défaut, 'approuve' si créé par admin directement
    } = req.body;

    if (!membre_id || !type || !date_debut || !date_fin) {
      return res.status(400).json({ error: 'Membre, type et dates requis' });
    }

    // Vérifier que le membre appartient au tenant
    const { data: membre } = await supabase
      .from('rh_membres')
      .select('id, nom, prenom')
      .eq('id', membre_id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (!membre) {
      return res.status(404).json({ error: 'Membre non trouvé' });
    }

    // Vérifier le solde disponible si c'est un congé ou RTT
    if (['conge', 'rtt', 'repos_compensateur'].includes(type)) {
      const { data: compteurs } = await supabase
        .from('rh_compteurs_conges')
        .select('*')
        .eq('tenant_id', req.admin.tenant_id)
        .eq('membre_id', membre_id)
        .eq('annee', new Date(date_debut).getFullYear())
        .single();

      if (compteurs) {
        // Calculer les jours demandés (approximatif, le trigger calculera précisément)
        const jours = Math.ceil((new Date(date_fin) - new Date(date_debut)) / (1000 * 60 * 60 * 24)) + 1;
        const joursOuvres = Math.round(jours * 5 / 7); // Approximation

        let solde = 0;
        if (type === 'conge') {
          solde = (compteurs.cp_acquis || 0) + (compteurs.cp_report_n1 || 0) - (compteurs.cp_pris || 0);
        } else if (type === 'rtt') {
          solde = (compteurs.rtt_acquis || 0) - (compteurs.rtt_pris || 0);
        } else if (type === 'repos_compensateur') {
          solde = (compteurs.rc_acquis || 0) - (compteurs.rc_pris || 0);
        }

        if (joursOuvres > solde) {
          return res.status(400).json({
            error: `Solde insuffisant: ${solde} jours disponibles, ${joursOuvres} demandés`
          });
        }
      }
    }

    const insertData = {
      tenant_id: req.admin.tenant_id,
      membre_id,
      type,
      date_debut,
      date_fin,
      motif,
      demi_journee: demi_journee || false,
      periode_journee: demi_journee ? periode_journee : null,
      justificatif_url,
      statut: statut_initial || 'en_attente'
    };

    // Si créé directement comme approuvé par admin
    if (statut_initial === 'approuve') {
      insertData.approuve_par = req.admin.id;
      insertData.date_approbation = new Date().toISOString();
    }

    const { data: absence, error } = await supabase
      .from('rh_absences')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    res.json(absence);
  } catch (error) {
    console.error('[RH] Erreur création absence:', error);
    res.status(500).json({ error: 'Erreur création absence' });
  }
});

/**
 * PUT /api/admin/rh/absences/:id
 * Modifier une absence
 */
router.put('/absences/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, date_debut, date_fin, motif, demi_journee, periode_journee, justificatif_url } = req.body;

    const updateData = {};
    if (type !== undefined) updateData.type = type;
    if (date_debut !== undefined) updateData.date_debut = date_debut;
    if (date_fin !== undefined) updateData.date_fin = date_fin;
    if (motif !== undefined) updateData.motif = motif;
    if (demi_journee !== undefined) updateData.demi_journee = demi_journee;
    if (periode_journee !== undefined) updateData.periode_journee = periode_journee;
    if (justificatif_url !== undefined) updateData.justificatif_url = justificatif_url;

    const { data: absence, error } = await supabase
      .from('rh_absences')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;

    res.json(absence);
  } catch (error) {
    console.error('[RH] Erreur modification absence:', error);
    res.status(500).json({ error: 'Erreur modification absence' });
  }
});

/**
 * PUT /api/admin/rh/absences/:id/approve
 * Approuver une absence
 */
router.put('/absences/:id/approve', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: absence, error } = await supabase
      .from('rh_absences')
      .update({
        statut: 'approuve',
        date_approbation: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;

    // Mettre à jour le compteur de congés
    if (['conge', 'rtt', 'repos_compensateur'].includes(absence.type)) {
      const annee = new Date().getFullYear();
      const joursOuvres = absence.jours_ouvres || 1;

      // Déterminer le champ à mettre à jour
      let champPris = 'cp_pris';
      if (absence.type === 'rtt') champPris = 'rtt_pris';
      if (absence.type === 'repos_compensateur') champPris = 'rc_pris';

      // Récupérer le compteur actuel
      const { data: compteur } = await supabase
        .from('rh_compteurs_conges')
        .select('*')
        .eq('membre_id', absence.membre_id)
        .eq('tenant_id', req.admin.tenant_id)
        .eq('annee', annee)
        .single();

      if (compteur) {
        const updateData = {};
        updateData[champPris] = (compteur[champPris] || 0) + joursOuvres;

        await supabase
          .from('rh_compteurs_conges')
          .update(updateData)
          .eq('id', compteur.id);
      }
    }

    // Mettre à jour le statut du membre si l'absence est en cours
    const today = new Date().toISOString().split('T')[0];
    if (absence.date_debut <= today && absence.date_fin >= today) {
      await supabase
        .from('rh_membres')
        .update({ statut: 'conge' })
        .eq('id', absence.membre_id)
        .eq('tenant_id', req.admin.tenant_id);
    }

    res.json(absence);
  } catch (error) {
    console.error('[RH] Erreur approbation absence:', error);
    res.status(500).json({ error: 'Erreur approbation absence' });
  }
});

/**
 * PUT /api/admin/rh/absences/:id/refuse
 * Refuser une absence
 */
router.put('/absences/:id/refuse', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { commentaire_refus } = req.body;

    const { data: absence, error } = await supabase
      .from('rh_absences')
      .update({
        statut: 'refuse',
        date_approbation: new Date().toISOString(),
        commentaire_refus: commentaire_refus || null
      })
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;

    res.json(absence);
  } catch (error) {
    console.error('[RH] Erreur refus absence:', error);
    res.status(500).json({ error: 'Erreur refus absence' });
  }
});

/**
 * PUT /api/admin/rh/absences/:id/cancel
 * Annuler une absence (restaure le compteur si déjà approuvée)
 */
router.put('/absences/:id/cancel', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: absence, error } = await supabase
      .from('rh_absences')
      .update({ statut: 'annule' })
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;

    res.json(absence);
  } catch (error) {
    console.error('[RH] Erreur annulation absence:', error);
    res.status(500).json({ error: 'Erreur annulation absence' });
  }
});

/**
 * DELETE /api/admin/rh/absences/:id
 * Supprimer une absence (seulement si en_attente)
 */
router.delete('/absences/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Récupérer l'absence
    const { data: absence } = await supabase
      .from('rh_absences')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (!absence) {
      return res.status(404).json({ error: 'Absence non trouvée' });
    }

    // Permettre suppression si: en_attente, refuse, annule, ou approuve mais pas encore commencée
    const today = new Date().toISOString().split('T')[0];
    const peutSupprimer = ['en_attente', 'refuse', 'annule'].includes(absence.statut) ||
                          (absence.statut === 'approuve' && absence.date_debut > today);

    if (!peutSupprimer) {
      return res.status(400).json({ error: 'Cette absence ne peut pas être supprimée (déjà en cours ou passée)' });
    }

    // Si l'absence était approuvée, restaurer le compteur
    if (absence.statut === 'approuve' && ['conge', 'rtt', 'repos_compensateur'].includes(absence.type)) {
      const annee = new Date().getFullYear();
      const joursOuvres = absence.jours_ouvres || 0;

      let champPris = 'cp_pris';
      if (absence.type === 'rtt') champPris = 'rtt_pris';
      if (absence.type === 'repos_compensateur') champPris = 'rc_pris';

      const { data: compteur } = await supabase
        .from('rh_compteurs_conges')
        .select('*')
        .eq('membre_id', absence.membre_id)
        .eq('tenant_id', req.admin.tenant_id)
        .eq('annee', annee)
        .single();

      if (compteur) {
        const updateData = {};
        updateData[champPris] = Math.max(0, (compteur[champPris] || 0) - joursOuvres);

        await supabase
          .from('rh_compteurs_conges')
          .update(updateData)
          .eq('id', compteur.id);
      }
    }

    const { error } = await supabase
      .from('rh_absences')
      .delete()
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id);

    if (error) throw error;

    res.json({ success: true, message: 'Absence supprimée' });
  } catch (error) {
    console.error('[RH] Erreur suppression absence:', error);
    res.status(500).json({ error: 'Erreur suppression absence' });
  }
});

/**
 * PUT /api/admin/rh/absences/:id/:action (legacy support)
 * Approuver/Refuser une absence - maintenu pour compatibilité
 */
router.put('/absences/:id/:action', authenticateAdmin, async (req, res) => {
  try {
    const { id, action } = req.params;
    const { commentaire_refus } = req.body;

    if (!['approve', 'refuse'].includes(action)) {
      return res.status(400).json({ error: 'Action invalide' });
    }

    const statut = action === 'approve' ? 'approuve' : 'refuse';

    const updateData = {
      statut,
      approuve_par: req.admin.id,
      date_approbation: new Date().toISOString()
    };

    if (action === 'refuse' && commentaire_refus) {
      updateData.commentaire_refus = commentaire_refus;
    }

    const { data: absence, error } = await supabase
      .from('rh_absences')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;

    // Si approuvé et absence en cours, mettre à jour le statut du membre
    if (statut === 'approuve') {
      const today = new Date().toISOString().split('T')[0];
      if (absence.date_debut <= today && absence.date_fin >= today) {
        await supabase
          .from('rh_membres')
          .update({ statut: 'conge' })
          .eq('id', absence.membre_id)
          .eq('tenant_id', req.admin.tenant_id);
      }
    }

    res.json(absence);
  } catch (error) {
    console.error('[RH] Erreur action absence:', error);
    res.status(500).json({ error: 'Erreur action absence' });
  }
});

// ============================================
// DASHBOARD RH
// ============================================

/**
 * GET /api/admin/rh/dashboard
 * Stats RH globales
 */
router.get('/dashboard', authenticateAdmin, async (req, res) => {
  try {
    // Membres avec salaires
    const { data: membres } = await supabase
      .from('rh_membres')
      .select('id, role, statut, salaire_mensuel')
      .eq('tenant_id', req.admin.tenant_id);

    const actifs = membres?.filter(m => m.statut === 'actif').length || 0;
    const enConge = membres?.filter(m => m.statut === 'conge').length || 0;

    // Roles distribution
    const rolesCount = {};
    membres?.forEach(m => {
      rolesCount[m.role] = (rolesCount[m.role] || 0) + 1;
    });

    // Calcul masse salariale (somme des salaires des actifs)
    const masseSalariale = membres
      ?.filter(m => m.statut === 'actif')
      .reduce((sum, m) => sum + (m.salaire_mensuel || 0), 0) || 0;

    // Coût moyen par employé
    const coutMoyenEmploye = actifs > 0 ? Math.round(masseSalariale / actifs) : 0;

    // Absences du mois courant
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data: absences } = await supabase
      .from('rh_absences')
      .select('id, statut, date_debut, date_fin')
      .eq('tenant_id', req.admin.tenant_id);

    const absencesEnAttente = absences?.filter(a => a.statut === 'en_attente').length || 0;

    // Calculer les jours d'absence du mois
    const absencesMois = absences?.filter(a =>
      a.statut === 'approuve' &&
      a.date_debut <= endOfMonth &&
      a.date_fin >= startOfMonth
    ) || [];

    let totalJoursAbsence = 0;
    absencesMois.forEach(a => {
      const debut = new Date(Math.max(new Date(a.date_debut), new Date(startOfMonth)));
      const fin = new Date(Math.min(new Date(a.date_fin), new Date(endOfMonth)));
      const jours = Math.ceil((fin - debut) / (1000 * 60 * 60 * 24)) + 1;
      totalJoursAbsence += jours;
    });

    // Taux d'absentéisme: jours absence / (nb employés * jours ouvrés du mois) * 100
    const joursOuvresMois = 22; // Approximation
    const tauxAbsenteisme = actifs > 0
      ? (totalJoursAbsence / (actifs * joursOuvresMois)) * 100
      : 0;

    // Heures travaillées estimées (151.67h/mois standard en France)
    const heuresMensuelles = 151.67;
    const heuresTravaillees = Math.round(actifs * heuresMensuelles * (1 - tauxAbsenteisme / 100));

    // Période formatée
    const periode = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    res.json({
      equipe: {
        total: membres?.length || 0,
        actifs,
        en_conge: enConge,
        roles: rolesCount
      },
      absences: {
        en_attente: absencesEnAttente,
        total_jours_mois: totalJoursAbsence
      },
      paie: {
        periode,
        masse_salariale: masseSalariale,
        heures_travaillees: heuresTravaillees,
        taux_absenteisme: Math.round(tauxAbsenteisme * 10) / 10,
        cout_moyen_employe: coutMoyenEmploye
      }
    });
  } catch (error) {
    console.error('[RH] Erreur dashboard:', error);
    res.status(500).json({ error: 'Erreur dashboard RH' });
  }
});

// ============================================
// TRAITEMENT PAIE - Génération écritures comptables
// ============================================

// Taux de cotisations 2026 - Mis à jour selon URSSAF (01/01/2026)
// Source: https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-secteur-prive.html
const TAUX_COTISATIONS = {
  // SMIC 2026
  smic_horaire: 1202, // en centimes (12.02€)
  smic_mensuel: 182303, // en centimes (1823.03€)

  // Plafond SS 2026
  plafond_ss_mensuel: 400500, // en centimes (4005€)
  plafond_ss_annuel: 4806000, // en centimes (48060€)

  // Cotisations patronales
  maladie_employeur: 7.00, // taux réduit < 2.5 SMIC (13% sinon)
  maladie_employeur_haut: 13.00, // si > 2.5 SMIC
  vieillesse_plafonnee_employeur: 8.55,
  vieillesse_deplafonnee_employeur: 2.11, // CORRIGÉ: était 2.02, augmenté en 2026
  allocations_familiales: 5.25, // taux normal (3.45% si réduction)
  allocations_familiales_reduit: 3.45, // si < 3.5 SMIC
  accidents_travail: 2.08, // taux moyen 2026 (variable selon secteur)
  chomage_employeur: 4.05,
  ags: 0.20, // CORRIGÉ: était 0.15
  fnal_moins_50: 0.10,
  fnal_50_plus: 0.50,
  csa: 0.30, // Contribution Solidarité Autonomie
  retraite_t1_employeur: 4.72,
  retraite_t2_employeur: 12.95,
  ceg_t1_employeur: 1.29,
  ceg_t2_employeur: 1.62,
  formation_moins_11: 0.55,
  formation_11_plus: 1.00,
  taxe_apprentissage: 0.68,
  dialogue_social: 0.016,

  // Cotisations salariales
  maladie_salarie: 0.00, // 0% depuis 2018
  vieillesse_plafonnee_salarie: 6.90,
  vieillesse_deplafonnee_salarie: 0.40,
  chomage_salarie: 0.00, // 0% depuis 2019
  retraite_t1_salarie: 3.15,
  retraite_t2_salarie: 8.64,
  ceg_t1_salarie: 0.86,
  ceg_t2_salarie: 1.08,
  csg_deductible: 6.80,
  csg_non_deductible: 2.40,
  crds: 0.50,
  base_csg_pct: 98.25, // Base CSG/CRDS = 98.25% du brut

  // Heures supplémentaires
  majoration_hs_25: 25,
  majoration_hs_50: 50,
  contingent_annuel_hs: 220
};

/**
 * POST /api/admin/rh/paie/generer
 * Génère les écritures comptables de paie pour un mois
 */
router.post('/paie/generer', authenticateAdmin, async (req, res) => {
  try {
    const { periode, heures_supp } = req.body; // periode: "2026-02", heures_supp: [{membre_id, heures_25, heures_50}]

    if (!periode) {
      return res.status(400).json({ error: 'Période requise (format: YYYY-MM)' });
    }

    const [year, month] = periode.split('-');
    const dateDepense = `${year}-${month}-01`;

    // Récupérer les membres actifs
    const { data: membres } = await supabase
      .from('rh_membres')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('statut', 'actif');

    if (!membres || membres.length === 0) {
      return res.status(400).json({ error: 'Aucun employé actif' });
    }

    let totalSalairesNets = 0;
    let totalCotisationsPatronales = 0;
    let totalCotisationsSalariales = 0;
    const detailParMembre = [];

    // Calculer pour chaque membre
    for (const membre of membres) {
      const salaireBrut = membre.salaire_mensuel || 0;
      if (salaireBrut === 0) continue;

      // Heures supp pour ce membre
      const hs = heures_supp?.find(h => h.membre_id === membre.id) || { heures_25: 0, heures_50: 0 };
      const tauxHoraire = salaireBrut / 15167; // 151.67h en centimes
      const montantHS = Math.round((hs.heures_25 * tauxHoraire * 1.25) + (hs.heures_50 * tauxHoraire * 1.50));

      const brutTotal = salaireBrut + montantHS;
      const plafondSS = TAUX_COTISATIONS.plafond_ss_mensuel;
      const tranche1 = Math.min(brutTotal, plafondSS);

      // Cotisations patronales
      const cotisPatronales = Math.round(
        brutTotal * (TAUX_COTISATIONS.maladie_employeur +
                     TAUX_COTISATIONS.vieillesse_deplafonnee_employeur +
                     TAUX_COTISATIONS.allocations_familiales +
                     TAUX_COTISATIONS.accidents_travail +
                     TAUX_COTISATIONS.chomage_employeur +
                     TAUX_COTISATIONS.ags) / 100 +
        tranche1 * (TAUX_COTISATIONS.vieillesse_plafonnee_employeur +
                    TAUX_COTISATIONS.retraite_t1_employeur +
                    TAUX_COTISATIONS.ceg_t1_employeur) / 100
      );

      // Cotisations salariales
      const cotisSalariales = Math.round(
        brutTotal * (TAUX_COTISATIONS.vieillesse_deplafonnee_salarie) / 100 +
        tranche1 * (TAUX_COTISATIONS.vieillesse_plafonnee_salarie +
                    TAUX_COTISATIONS.retraite_t1_salarie +
                    TAUX_COTISATIONS.ceg_t1_salarie) / 100 +
        brutTotal * 0.9825 * (TAUX_COTISATIONS.csg_deductible +
                              TAUX_COTISATIONS.csg_non_deductible +
                              TAUX_COTISATIONS.crds) / 100
      );

      const salaireNet = brutTotal - cotisSalariales;

      totalSalairesNets += salaireNet;
      totalCotisationsPatronales += cotisPatronales;
      totalCotisationsSalariales += cotisSalariales;

      detailParMembre.push({
        membre_id: membre.id,
        nom: `${membre.prenom} ${membre.nom}`,
        brut: brutTotal,
        heures_supp: montantHS,
        cotisations_salariales: cotisSalariales,
        cotisations_patronales: cotisPatronales,
        net: salaireNet
      });
    }

    // Créer les écritures comptables (dépenses)
    // Vérifier si des dépenses existent déjà pour cette période (éviter doublons)
    const libelleSalaires = `Salaires nets - ${month}/${year}`;
    const libelleCotisations = `Cotisations sociales - ${month}/${year}`;

    const { data: depensesExistantes } = await supabase
      .from('depenses')
      .select('id, libelle')
      .eq('tenant_id', req.admin.tenant_id)
      .in('libelle', [libelleSalaires, libelleCotisations]);

    const salairesExiste = depensesExistantes?.some(d => d.libelle === libelleSalaires);
    const cotisationsExiste = depensesExistantes?.some(d => d.libelle === libelleCotisations);

    const ecritures = [];
    let depSalaires, depCotis;

    // 1. Dépense Salaires (net à payer) - seulement si n'existe pas
    if (!salairesExiste) {
      const { data, error: errSal } = await supabase
        .from('depenses')
        .insert({
          tenant_id: req.admin.tenant_id,
          categorie: 'salaires',
          libelle: libelleSalaires,
          description: `Paie du mois de ${month}/${year} - ${membres.length} salarié(s)`,
          montant: totalSalairesNets,
          montant_ttc: totalSalairesNets,
          taux_tva: 0,
          deductible_tva: false,
          date_depense: dateDepense,
          recurrence: 'ponctuelle',
          payee: false
        })
        .select()
        .single();

      if (errSal) throw errSal;
      depSalaires = data;
      ecritures.push(depSalaires);
    } else {
      // Récupérer l'existante
      depSalaires = depensesExistantes.find(d => d.libelle === libelleSalaires);
      console.log(`[RH] Dépense salaires déjà existante pour ${periode}, skip`);
    }

    // 2. Dépense Cotisations sociales (patronales + salariales) - seulement si n'existe pas
    const totalCotisations = totalCotisationsPatronales + totalCotisationsSalariales;

    if (!cotisationsExiste) {
      const { data, error: errCot } = await supabase
        .from('depenses')
        .insert({
          tenant_id: req.admin.tenant_id,
          categorie: 'cotisations_sociales',
          libelle: libelleCotisations,
          description: `Charges sociales: ${(totalCotisationsPatronales/100).toFixed(2)}€ patron + ${(totalCotisationsSalariales/100).toFixed(2)}€ salarié`,
          montant: totalCotisations,
          montant_ttc: totalCotisations,
          taux_tva: 0,
          deductible_tva: false,
          date_depense: dateDepense,
          recurrence: 'ponctuelle',
          payee: false
        })
        .select()
        .single();

      if (errCot) throw errCot;
      depCotis = data;
      ecritures.push(depCotis);
    } else {
      depCotis = depensesExistantes.find(d => d.libelle === libelleCotisations);
      console.log(`[RH] Dépense cotisations déjà existante pour ${periode}, skip`);
    }

    // Enregistrer le journal de paie
    const { data: journal, error: errJournal } = await supabase
      .from('rh_journal_paie')
      .upsert({
        tenant_id: req.admin.tenant_id,
        periode,
        total_brut: detailParMembre.reduce((s, m) => s + m.brut, 0),
        total_net: totalSalairesNets,
        total_cotisations_patronales: totalCotisationsPatronales,
        total_cotisations_salariales: totalCotisationsSalariales,
        nb_salaries: detailParMembre.length,
        detail: detailParMembre,
        depense_salaires_id: depSalaires.id,
        depense_cotisations_id: depCotis.id
      }, {
        onConflict: 'tenant_id,periode'
      })
      .select()
      .single();

    if (errJournal) throw errJournal;

    // Générer les écritures comptables dans le journal PA
    let ecrituresPA = [];
    try {
      ecrituresPA = await genererEcrituresPaie(
        req.admin.tenant_id,
        periode,
        totalSalairesNets,
        totalCotisationsPatronales,
        totalCotisationsSalariales,
        journal?.id
      );
      console.log(`[RH] Écritures PA générées: ${ecrituresPA.length} lignes`);
    } catch (errEcritures) {
      console.error('[RH] Erreur génération écritures PA:', errEcritures);
      // Ne pas bloquer si les écritures ne peuvent être générées
    }

    res.json({
      success: true,
      periode,
      journal,
      ecritures_comptables: ecrituresPA.length,
      ecritures: ecritures.map(e => ({
        id: e.id,
        categorie: e.categorie,
        libelle: e.libelle,
        montant: e.montant / 100
      })),
      totaux: {
        brut: detailParMembre.reduce((s, m) => s + m.brut, 0) / 100,
        net: totalSalairesNets / 100,
        cotisations_patronales: totalCotisationsPatronales / 100,
        cotisations_salariales: totalCotisationsSalariales / 100,
        cout_total: (totalSalairesNets + totalCotisations) / 100
      },
      detail: detailParMembre.map(m => ({
        ...m,
        brut: m.brut / 100,
        heures_supp: m.heures_supp / 100,
        cotisations_salariales: m.cotisations_salariales / 100,
        cotisations_patronales: m.cotisations_patronales / 100,
        net: m.net / 100
      }))
    });
  } catch (error) {
    console.error('[RH] Erreur génération paie:', error);
    res.status(500).json({ error: 'Erreur génération paie' });
  }
});

/**
 * GET /api/admin/rh/paie/journal
 * Récupère le journal de paie pour une période
 */
router.get('/paie/journal', authenticateAdmin, async (req, res) => {
  try {
    const { periode, annee } = req.query;

    let query = supabase
      .from('rh_journal_paie')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .order('periode', { ascending: false });

    if (periode) {
      query = query.eq('periode', periode);
    } else if (annee) {
      query = query.like('periode', `${annee}-%`);
    }

    const { data: journaux, error } = await query.limit(12);

    if (error) throw error;

    res.json(journaux || []);
  } catch (error) {
    console.error('[RH] Erreur journal paie:', error);
    res.status(500).json({ error: 'Erreur récupération journal' });
  }
});

// ============================================
// RECRUTEMENTS
// ============================================

/**
 * GET /api/admin/rh/recrutements
 * Liste des offres de recrutement
 */
router.get('/recrutements', authenticateAdmin, async (req, res) => {
  try {
    const { statut } = req.query;

    let query = supabase
      .from('rh_recrutements')
      .select(`
        *,
        candidatures:rh_candidatures(count)
      `)
      .eq('tenant_id', req.admin.tenant_id)
      .order('created_at', { ascending: false });

    if (statut) {
      query = query.eq('statut', statut);
    }

    const { data: recrutements, error } = await query;

    if (error) throw error;

    res.json(recrutements || []);
  } catch (error) {
    console.error('[RH] Erreur liste recrutements:', error);
    res.status(500).json({ error: 'Erreur récupération recrutements' });
  }
});

/**
 * POST /api/admin/rh/recrutements
 * Créer une offre de recrutement
 */
router.post('/recrutements', authenticateAdmin, async (req, res) => {
  try {
    const { titre, description, type_contrat, salaire_min, salaire_max, lieu, competences, date_limite } = req.body;

    if (!titre || !type_contrat) {
      return res.status(400).json({ error: 'Titre et type de contrat requis' });
    }

    const { data: recrutement, error } = await supabase
      .from('rh_recrutements')
      .insert({
        tenant_id: req.admin.tenant_id,
        titre,
        description,
        type_contrat,
        salaire_min: salaire_min || null,
        salaire_max: salaire_max || null,
        lieu,
        competences: competences || [],
        date_limite,
        statut: 'ouvert'
      })
      .select()
      .single();

    if (error) throw error;

    res.json(recrutement);
  } catch (error) {
    console.error('[RH] Erreur création recrutement:', error);
    res.status(500).json({ error: 'Erreur création offre' });
  }
});

/**
 * PUT /api/admin/rh/recrutements/:id
 * Modifier une offre de recrutement
 */
router.put('/recrutements/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { titre, description, type_contrat, salaire_min, salaire_max, lieu, competences, date_limite, statut } = req.body;

    const { data: recrutement, error } = await supabase
      .from('rh_recrutements')
      .update({
        titre,
        description,
        type_contrat,
        salaire_min,
        salaire_max,
        lieu,
        competences,
        date_limite,
        statut
      })
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;

    res.json(recrutement);
  } catch (error) {
    console.error('[RH] Erreur modification recrutement:', error);
    res.status(500).json({ error: 'Erreur modification offre' });
  }
});

/**
 * GET /api/admin/rh/candidatures
 * Liste des candidatures
 */
router.get('/candidatures', authenticateAdmin, async (req, res) => {
  try {
    const { recrutement_id, statut } = req.query;

    let query = supabase
      .from('rh_candidatures')
      .select(`
        *,
        recrutement:rh_recrutements(id, titre)
      `)
      .eq('tenant_id', req.admin.tenant_id)
      .order('created_at', { ascending: false });

    if (recrutement_id) {
      query = query.eq('recrutement_id', recrutement_id);
    }
    if (statut) {
      query = query.eq('statut', statut);
    }

    const { data: candidatures, error } = await query;

    if (error) throw error;

    res.json(candidatures || []);
  } catch (error) {
    console.error('[RH] Erreur liste candidatures:', error);
    res.status(500).json({ error: 'Erreur récupération candidatures' });
  }
});

/**
 * POST /api/admin/rh/candidatures
 * Ajouter une candidature
 */
router.post('/candidatures', authenticateAdmin, async (req, res) => {
  try {
    const { recrutement_id, nom, prenom, email, telephone, cv_url, lettre_motivation, source, notes } = req.body;

    if (!recrutement_id || !nom || !prenom || !email) {
      return res.status(400).json({ error: 'Recrutement, nom, prénom et email requis' });
    }

    const { data: candidature, error } = await supabase
      .from('rh_candidatures')
      .insert({
        tenant_id: req.admin.tenant_id,
        recrutement_id,
        nom,
        prenom,
        email,
        telephone,
        cv_url,
        lettre_motivation,
        source: source || 'direct',
        notes,
        statut: 'nouveau'
      })
      .select()
      .single();

    if (error) throw error;

    res.json(candidature);
  } catch (error) {
    console.error('[RH] Erreur ajout candidature:', error);
    res.status(500).json({ error: 'Erreur ajout candidature' });
  }
});

/**
 * PUT /api/admin/rh/candidatures/:id
 * Modifier le statut d'une candidature
 */
router.put('/candidatures/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { statut, notes, date_entretien } = req.body;

    const updates = {};
    if (statut) updates.statut = statut;
    if (notes !== undefined) updates.notes = notes;
    if (date_entretien) updates.date_entretien = date_entretien;

    const { data: candidature, error } = await supabase
      .from('rh_candidatures')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;

    res.json(candidature);
  } catch (error) {
    console.error('[RH] Erreur modification candidature:', error);
    res.status(500).json({ error: 'Erreur modification candidature' });
  }
});

// ============================================
// DOCUMENTS RH
// ============================================

/**
 * GET /api/admin/rh/documents/registre-personnel
 * Génère le registre unique du personnel (PDF conforme article D1221-23 Code du travail)
 */
router.get('/documents/registre-personnel', authenticateAdmin, async (req, res) => {
  try {
    const { format } = req.query; // 'pdf' ou 'json'
    const tenantId = req.admin?.tenant_id || req.tenantId;

    // Récupérer tous les employés par ordre d'embauche
    const { data: membres } = await supabase
      .from('rh_membres')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('date_embauche', { ascending: true });

    // Récupérer infos entreprise
    const { data: tenant } = await supabase
      .from('tenants')
      .select('nom, siret, adresse')
      .eq('id', tenantId)
      .single();

    // Préparer les données du registre
    const registreData = (membres || []).map((m, idx) => {
      const typeContrat = (m.type_contrat || 'cdi').toUpperCase();
      let mentionSpeciale = '';

      // Mention CDD obligatoire
      if (typeContrat === 'CDD') {
        mentionSpeciale = `CDD${m.cdd_motif ? ` - ${m.cdd_motif}` : ''}`;
      }
      // Mention intérim obligatoire
      if (typeContrat === 'INTERIM') {
        mentionSpeciale = `Intérim${m.interim_agence ? ` - ${m.interim_agence}` : ''}`;
      }

      // Autorisation travail pour étrangers
      let autorisationTravail = '';
      if (m.nationalite && m.nationalite.toLowerCase() !== 'française' && m.nationalite.toLowerCase() !== 'francaise') {
        if (m.autorisation_travail_type) {
          autorisationTravail = `${m.autorisation_travail_type}${m.autorisation_travail_numero ? ` n°${m.autorisation_travail_numero}` : ''}`;
        } else {
          autorisationTravail = 'À vérifier';
        }
      }

      return {
        numero_ordre: m.numero_ordre_registre || idx + 1,
        nom: m.nom,
        prenom: m.prenom,
        date_naissance: m.date_naissance,
        sexe: m.sexe || '-',
        nationalite: m.nationalite || 'Française',
        emploi: m.poste || m.role,
        qualification: m.classification_niveau ? `${m.classification_niveau}${m.classification_echelon ? `-${m.classification_echelon}` : ''}` : (m.categorie_sociopro || m.role),
        date_entree: m.date_embauche,
        date_sortie: m.date_sortie || (m.statut === 'inactif' ? m.updated_at?.split('T')[0] : null),
        type_contrat: typeContrat,
        mention_speciale: mentionSpeciale,
        autorisation_travail: autorisationTravail
      };
    });

    // Si format JSON demandé
    if (format !== 'pdf') {
      return res.json({
        titre: 'Registre Unique du Personnel',
        entreprise: tenant?.nom || 'Entreprise',
        siret: tenant?.siret || '',
        date_generation: new Date().toISOString(),
        employes: registreData
      });
    }

    // Génération PDF
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({
      margin: 30,
      size: 'A4',
      layout: 'landscape' // Paysage pour plus de colonnes
    });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    // En-tête
    doc.fontSize(16).font('Helvetica-Bold').text('REGISTRE UNIQUE DU PERSONNEL', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text(`Article D1221-23 du Code du travail`, { align: 'center' });
    doc.moveDown(0.5);

    // Infos entreprise
    doc.fontSize(9);
    doc.text(`Entreprise: ${tenant?.nom || 'N/C'}`, 30);
    doc.text(`SIRET: ${tenant?.siret || 'N/C'}`, 30);
    doc.text(`Date d'édition: ${new Date().toLocaleDateString('fr-FR')}`, 30);
    doc.moveDown();

    // Tableau
    const startY = doc.y;
    const colWidths = [30, 70, 70, 60, 25, 60, 80, 55, 55, 45, 70, 90];
    const headers = ['N°', 'Nom', 'Prénom', 'Né(e) le', 'Sexe', 'Nationalité', 'Emploi', 'Entrée', 'Sortie', 'Contrat', 'Aut. travail', 'Mentions'];

    // En-tête tableau
    let x = 30;
    doc.font('Helvetica-Bold').fontSize(7);
    doc.rect(30, startY, 782, 15).fill('#e0e0e0').stroke();
    doc.fillColor('#000');

    headers.forEach((header, i) => {
      doc.text(header, x + 2, startY + 3, { width: colWidths[i] - 4, align: 'left' });
      x += colWidths[i];
    });

    // Lignes du tableau
    let y = startY + 18;
    doc.font('Helvetica').fontSize(7);

    registreData.forEach((emp, idx) => {
      // Nouvelle page si nécessaire
      if (y > 520) {
        doc.addPage({ layout: 'landscape' });
        y = 30;

        // Répéter en-tête
        x = 30;
        doc.font('Helvetica-Bold');
        doc.rect(30, y, 782, 15).fill('#e0e0e0').stroke();
        doc.fillColor('#000');
        headers.forEach((header, i) => {
          doc.text(header, x + 2, y + 3, { width: colWidths[i] - 4, align: 'left' });
          x += colWidths[i];
        });
        y += 18;
        doc.font('Helvetica');
      }

      // Alternance couleur lignes
      if (idx % 2 === 0) {
        doc.rect(30, y - 2, 782, 14).fill('#f9f9f9').stroke('#ddd');
        doc.fillColor('#000');
      }

      x = 30;
      const rowData = [
        emp.numero_ordre,
        emp.nom,
        emp.prenom,
        emp.date_naissance ? new Date(emp.date_naissance).toLocaleDateString('fr-FR') : '-',
        emp.sexe === 'M' ? 'H' : emp.sexe === 'F' ? 'F' : '-',
        emp.nationalite,
        emp.emploi,
        emp.date_entree ? new Date(emp.date_entree).toLocaleDateString('fr-FR') : '-',
        emp.date_sortie ? new Date(emp.date_sortie).toLocaleDateString('fr-FR') : '-',
        emp.type_contrat,
        emp.autorisation_travail || '-',
        emp.mention_speciale || '-'
      ];

      rowData.forEach((cell, i) => {
        doc.text(String(cell || ''), x + 2, y, { width: colWidths[i] - 4, align: 'left' });
        x += colWidths[i];
      });

      y += 14;
    });

    // Bordure tableau
    doc.rect(30, startY, 782, y - startY).stroke();

    // Pied de page
    doc.moveDown(2);
    doc.fontSize(7).fillColor('#666');
    doc.text(`Ce registre doit être conservé 5 ans après le départ du dernier salarié inscrit.`, 30);
    doc.text(`Les mentions sont indélébiles. Document généré automatiquement par NEXUS SIRH.`, 30);

    doc.end();

    await new Promise(resolve => doc.on('end', resolve));
    const pdfBuffer = Buffer.concat(chunks);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="registre_personnel_${new Date().toISOString().split('T')[0]}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('[RH] Erreur registre personnel:', error);
    res.status(500).json({ error: 'Erreur génération registre' });
  }
});

/**
 * GET /api/admin/rh/documents/etat-cotisations
 * État récapitulatif des cotisations
 */
router.get('/documents/etat-cotisations', authenticateAdmin, async (req, res) => {
  try {
    const { periode } = req.query;

    if (!periode) {
      return res.status(400).json({ error: 'Période requise' });
    }

    const { data: journal } = await supabase
      .from('rh_journal_paie')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('periode', periode)
      .single();

    if (!journal) {
      return res.status(404).json({ error: 'Aucune paie pour cette période' });
    }

    // Répartition des cotisations
    const totalBrut = journal.total_brut;
    const plafondSS = TAUX_COTISATIONS.plafond_ss_mensuel * journal.nb_salaries;
    const tranche1 = Math.min(totalBrut, plafondSS);

    res.json({
      titre: 'État des Cotisations Sociales',
      periode,
      date_generation: new Date().toISOString(),
      nb_salaries: journal.nb_salaries,
      masse_salariale_brute: totalBrut / 100,
      cotisations: {
        urssaf: {
          maladie: (totalBrut * TAUX_COTISATIONS.maladie_employeur / 100) / 100,
          vieillesse: ((totalBrut * TAUX_COTISATIONS.vieillesse_deplafonnee_employeur / 100) +
                       (tranche1 * TAUX_COTISATIONS.vieillesse_plafonnee_employeur / 100)) / 100,
          allocations_familiales: (totalBrut * TAUX_COTISATIONS.allocations_familiales / 100) / 100,
          accidents_travail: (totalBrut * TAUX_COTISATIONS.accidents_travail / 100) / 100,
          csg_crds: (totalBrut * 0.9825 * (TAUX_COTISATIONS.csg_deductible +
                                           TAUX_COTISATIONS.csg_non_deductible +
                                           TAUX_COTISATIONS.crds) / 100) / 100
        },
        pole_emploi: {
          chomage: (totalBrut * TAUX_COTISATIONS.chomage_employeur / 100) / 100,
          ags: (totalBrut * TAUX_COTISATIONS.ags / 100) / 100
        },
        retraite: {
          agirc_arrco_t1: (tranche1 * (TAUX_COTISATIONS.retraite_t1_employeur + TAUX_COTISATIONS.retraite_t1_salarie) / 100) / 100,
          ceg: (tranche1 * (TAUX_COTISATIONS.ceg_t1_employeur + TAUX_COTISATIONS.ceg_t1_salarie) / 100) / 100
        }
      },
      total_patronal: journal.total_cotisations_patronales / 100,
      total_salarial: journal.total_cotisations_salariales / 100,
      total_cotisations: (journal.total_cotisations_patronales + journal.total_cotisations_salariales) / 100
    });
  } catch (error) {
    console.error('[RH] Erreur état cotisations:', error);
    res.status(500).json({ error: 'Erreur génération état' });
  }
});

// ============================================
// PLANNING EMPLOYÉS
// ============================================

/**
 * GET /api/admin/rh/planning
 * Planning des réservations par employé
 */
router.get('/planning', authenticateAdmin, async (req, res) => {
  try {
    const { membre_id, date_debut, date_fin } = req.query;
    const tenantId = req.admin.tenant_id;

    // Si on filtre par membre, il faut aussi chercher dans reservation_membres
    let reservationIds = [];
    if (membre_id) {
      // Trouver les réservations où ce membre est assigné via reservation_membres
      const { data: membreAssignments } = await supabase
        .from('reservation_membres')
        .select('reservation_id')
        .eq('tenant_id', tenantId)
        .eq('membre_id', membre_id);

      reservationIds = (membreAssignments || []).map(rm => rm.reservation_id);
    }

    let query = supabase
      .from('reservations')
      .select(`
        id,
        date,
        heure,
        service_nom,
        duree_minutes,
        statut,
        prix_total,
        notes,
        membre_id,
        client:clients(id, nom, prenom, telephone, type_client, raison_sociale),
        membre:rh_membres(id, nom, prenom, role),
        reservation_membres(
          membre_id,
          role,
          membre:rh_membres(id, nom, prenom, role)
        )
      `)
      .eq('tenant_id', tenantId)
      .not('statut', 'eq', 'annule')
      .order('date', { ascending: true })
      .order('heure', { ascending: true });

    if (membre_id) {
      // Filtrer par membre_id principal OU réservations où le membre est assigné
      if (reservationIds.length > 0) {
        query = query.or(`membre_id.eq.${membre_id},id.in.(${reservationIds.join(',')})`);
      } else {
        query = query.eq('membre_id', membre_id);
      }
    }
    if (date_debut) {
      query = query.gte('date', date_debut);
    }
    if (date_fin) {
      query = query.lte('date', date_fin);
    }

    const { data: planning, error } = await query;

    if (error) throw error;

    // Grouper par jour et par membre (pour afficher chaque membre séparément)
    const planningParJour = {};
    (planning || []).forEach(rdv => {
      const jour = rdv.date;
      if (!planningParJour[jour]) {
        planningParJour[jour] = [];
      }

      // Collecter tous les membres assignés
      const tousLesMembres = [];

      // Membre principal
      if (rdv.membre) {
        tousLesMembres.push({
          id: rdv.membre.id,
          nom: rdv.membre.nom,
          prenom: rdv.membre.prenom,
          role: 'principal'
        });
      }

      // Membres via reservation_membres
      (rdv.reservation_membres || []).forEach(rm => {
        if (rm.membre && !tousLesMembres.find(m => m.id === rm.membre.id)) {
          tousLesMembres.push({
            id: rm.membre.id,
            nom: rm.membre.nom,
            prenom: rm.membre.prenom,
            role: rm.role
          });
        }
      });

      // Formater le nom du client (raison sociale pour les pros)
      const formatClientName = (client) => {
        if (!client) return 'N/A';
        const isPro = client.type_client === 'professionnel' || !!client.raison_sociale;
        return isPro && client.raison_sociale
          ? client.raison_sociale
          : `${client.prenom} ${client.nom}`;
      };

      planningParJour[jour].push({
        id: rdv.id,
        heure: rdv.heure,
        service: rdv.service_nom,
        duree: rdv.duree_minutes,
        statut: rdv.statut,
        prix: rdv.prix_total ? rdv.prix_total / 100 : 0,
        client: formatClientName(rdv.client),
        client_tel: rdv.client?.telephone,
        employe: tousLesMembres.length > 0
          ? tousLesMembres.map(m => `${m.prenom} ${m.nom}`).join(', ')
          : 'Non assigné',
        employe_id: rdv.membre_id,
        // Tous les membres assignés
        employes: tousLesMembres
      });
    });

    // Calculer les stats
    const totalRdv = planning?.length || 0;
    const totalHeures = (planning || []).reduce((sum, rdv) => sum + (rdv.duree_minutes || 60), 0) / 60;
    const totalCA = (planning || []).filter(r => r.statut === 'termine').reduce((sum, r) => sum + (r.prix_total || 0), 0) / 100;

    res.json({
      planning: planningParJour,
      stats: {
        total_rdv: totalRdv,
        total_heures: Math.round(totalHeures * 10) / 10,
        ca_potentiel: totalCA
      }
    });
  } catch (error) {
    console.error('[RH] Erreur planning:', error);
    res.status(500).json({ error: 'Erreur récupération planning' });
  }
});

/**
 * GET /api/admin/rh/membres/:id/planning
 * Planning d'un employé spécifique
 */
router.get('/membres/:id/planning', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { semaine, date_debut, date_fin } = req.query;

    console.log(`[PLANNING] Requête reçue: membre=${id}, date_debut=${date_debut}, date_fin=${date_fin}, semaine=${semaine}`);

    // Calculer les dates de la semaine
    let dateDebut, dateFin;

    // Option 1: Dates directes (préféré - plus fiable)
    // On garde les strings directement pour éviter les problèmes de timezone
    let dateDebutStr, dateFinStr;
    if (date_debut && date_fin) {
      dateDebutStr = date_debut;
      dateFinStr = date_fin;
      // Créer les objets Date pour les calculs (veille, etc.)
      const [y1, m1, d1] = date_debut.split('-').map(Number);
      const [y2, m2, d2] = date_fin.split('-').map(Number);
      dateDebut = new Date(y1, m1 - 1, d1);
      dateFin = new Date(y2, m2 - 1, d2);
      console.log(`[PLANNING] Utilisation dates directes: ${dateDebutStr} -> ${dateFinStr}`);
    }
    // Option 2: Format semaine YYYY-WW (legacy)
    else if (semaine) {
      const [year, week] = semaine.split('-W');
      const firstDayOfYear = new Date(parseInt(year), 0, 1);
      const daysOffset = (parseInt(week) - 1) * 7;
      dateDebut = new Date(firstDayOfYear.getTime() + daysOffset * 24 * 60 * 60 * 1000);
      dateFin = new Date(dateDebut.getTime() + 6 * 24 * 60 * 60 * 1000);
      // Formatter sans timezone
      dateDebutStr = `${dateDebut.getFullYear()}-${String(dateDebut.getMonth() + 1).padStart(2, '0')}-${String(dateDebut.getDate()).padStart(2, '0')}`;
      dateFinStr = `${dateFin.getFullYear()}-${String(dateFin.getMonth() + 1).padStart(2, '0')}-${String(dateFin.getDate()).padStart(2, '0')}`;
    }
    // Option 3: Semaine courante par défaut
    else {
      const now = new Date();
      const dayOfWeek = now.getDay();
      dateDebut = new Date(now);
      dateDebut.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      dateFin = new Date(dateDebut);
      dateFin.setDate(dateDebut.getDate() + 6);
      // Formatter sans timezone
      dateDebutStr = `${dateDebut.getFullYear()}-${String(dateDebut.getMonth() + 1).padStart(2, '0')}-${String(dateDebut.getDate()).padStart(2, '0')}`;
      dateFinStr = `${dateFin.getFullYear()}-${String(dateFin.getMonth() + 1).padStart(2, '0')}-${String(dateFin.getDate()).padStart(2, '0')}`;
    }

    // Calculer la veille du début pour les shifts de nuit qui s'étendent sur la semaine
    const dateVeille = new Date(dateDebut);
    dateVeille.setDate(dateVeille.getDate() - 1);
    // Formatter la veille sans problème de timezone
    const dateVeilleStr = `${dateVeille.getFullYear()}-${String(dateVeille.getMonth() + 1).padStart(2, '0')}-${String(dateVeille.getDate()).padStart(2, '0')}`;
    console.log(`[PLANNING] Semaine ${dateDebutStr} -> ${dateFinStr}, veille incluse: ${dateVeilleStr}`);

    // Récupérer l'employé
    const { data: membre } = await supabase
      .from('rh_membres')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (!membre) {
      return res.status(404).json({ error: 'Employé non trouvé' });
    }

    // Récupérer les réservations où ce membre est assigné (membre_id principal)
    // On inclut la veille pour capturer les shifts de nuit qui s'étendent sur le premier jour
    const { data: reservationsPrincipales, error: error1 } = await supabase
      .from('reservations')
      .select(`
        id,
        date,
        heure,
        service_nom,
        duree_minutes,
        duree_totale_minutes,
        statut,
        prix_total,
        client:clients(id, nom, prenom, telephone, type_client, raison_sociale)
      `)
      .eq('tenant_id', req.admin.tenant_id)
      .eq('membre_id', id)
      .gte('date', dateVeilleStr)  // Inclure la veille pour les shifts de nuit
      .lte('date', dateFinStr)
      .not('statut', 'eq', 'annule');

    if (error1) throw error1;

    // Récupérer les réservations où ce membre est dans reservation_membres
    const { data: reservationsMembres } = await supabase
      .from('reservation_membres')
      .select('reservation_id')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('membre_id', id);

    const reservationMembreIds = (reservationsMembres || []).map(rm => rm.reservation_id);

    // Récupérer ces réservations supplémentaires (exclure celles déjà récupérées)
    const idsDejaRecuperes = (reservationsPrincipales || []).map(r => r.id);
    const idsSupplementaires = reservationMembreIds.filter(rid => !idsDejaRecuperes.includes(rid));

    let reservationsSupplementaires = [];
    if (idsSupplementaires.length > 0) {
      const { data: resasSupp } = await supabase
        .from('reservations')
        .select(`
          id,
          date,
          heure,
          service_nom,
          duree_minutes,
          duree_totale_minutes,
          statut,
          prix_total,
          client:clients(id, nom, prenom, telephone, type_client, raison_sociale)
        `)
        .eq('tenant_id', req.admin.tenant_id)
        .in('id', idsSupplementaires)
        .gte('date', dateVeilleStr)  // Inclure la veille pour les shifts de nuit
        .lte('date', dateFinStr)
        .not('statut', 'eq', 'annule');

      reservationsSupplementaires = resasSupp || [];
    }

    // Récupérer les lignes de services pour avoir les services spécifiques
    // On récupère TOUTES les lignes, puis on filtre par membre ou on utilise comme fallback
    const allReservationIds = [...idsDejaRecuperes, ...idsSupplementaires];
    let allLignes = [];
    if (allReservationIds.length > 0) {
      const { data: lignes } = await supabase
        .from('reservation_lignes')
        .select('reservation_id, service_nom, duree_minutes, quantite, prix_total, heure_debut, heure_fin, membre_id')
        .eq('tenant_id', req.admin.tenant_id)
        .in('reservation_id', allReservationIds);
      allLignes = lignes || [];
    }

    // Fonction pour obtenir les lignes d'une réservation pour ce membre
    // Priorité: lignes assignées à ce membre, sinon toutes les lignes de la réservation
    const membreIdNum = parseInt(id); // Convertir en nombre pour la comparaison
    const getLignesForReservation = (reservationId) => {
      const lignesResa = allLignes.filter(l => l.reservation_id === reservationId);
      // D'abord chercher les lignes assignées à ce membre (comparaison en nombre)
      const lignesMembre = lignesResa.filter(l => l.membre_id === membreIdNum);
      // Si trouvé, utiliser celles-ci, sinon toutes les lignes (fallback pour anciens rdv)
      return lignesMembre.length > 0 ? lignesMembre : lignesResa;
    };

    // Combiner et trier les réservations
    const reservations = [...(reservationsPrincipales || []), ...reservationsSupplementaires]
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.heure || '').localeCompare(b.heure || '');
      });

    // Récupérer les absences de la période
    const { data: absences } = await supabase
      .from('rh_absences')
      .select('*')
      .eq('membre_id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .lte('date_debut', dateFinStr)
      .gte('date_fin', dateDebutStr)
      .eq('statut', 'approuve');

    // Helper pour formater le nom du client (raison sociale pour les pros)
    const formatClientName = (client) => {
      if (!client) return 'N/A';
      const isPro = client.type_client === 'professionnel' || !!client.raison_sociale;
      return isPro && client.raison_sociale
        ? client.raison_sociale
        : `${client.prenom} ${client.nom}`;
    };

    // Organiser par jour
    const planningHebdo = {};
    for (let d = new Date(dateDebut); d <= dateFin; d.setDate(d.getDate() + 1)) {
      // Formatter sans timezone pour éviter le décalage UTC
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      planningHebdo[dateStr] = {
        rdv: [],
        absent: false,
        type_absence: null
      };
    }

    // Marquer les jours d'absence
    (absences || []).forEach(abs => {
      for (let d = new Date(abs.date_debut); d <= new Date(abs.date_fin); d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        if (planningHebdo[dateStr]) {
          planningHebdo[dateStr].absent = true;
          planningHebdo[dateStr].type_absence = abs.type;
        }
      }
    });

    // Helper pour vérifier si un créneau passe minuit
    const isOvernightShift = (heureDebut, heureFin) => {
      if (!heureDebut || !heureFin) return false;
      const [hD] = heureDebut.split(':').map(Number);
      const [hF] = heureFin.split(':').map(Number);
      return hF < hD; // Ex: 22:00 -> 07:00
    };

    // Helper pour calculer les minutes depuis minuit
    const toMinutes = (heure) => {
      if (!heure) return 0;
      const [h, m] = heure.split(':').map(Number);
      return h * 60 + (m || 0);
    };

    // Helper pour calculer Pâques (algorithme de Meeus/Jones/Butcher)
    const getEasterDate = (year) => {
      const a = year % 19;
      const b = Math.floor(year / 100);
      const c = year % 100;
      const d = Math.floor(b / 4);
      const e = b % 4;
      const f = Math.floor((b + 8) / 25);
      const g = Math.floor((b - f + 1) / 3);
      const h = (19 * a + b - d - g + 15) % 30;
      const i = Math.floor(c / 4);
      const k = c % 4;
      const l = (32 + 2 * e + 2 * i - h - k) % 7;
      const m = Math.floor((a + 11 * h + 22 * l) / 451);
      const month = Math.floor((h + l - 7 * m + 114) / 31);
      const day = ((h + l - 7 * m + 114) % 31) + 1;
      return new Date(year, month - 1, day);
    };

    // Helper pour obtenir les jours fériés français d'une année
    const getFrenchHolidays = (year) => {
      const easter = getEasterDate(year);
      const easterMonday = new Date(easter);
      easterMonday.setDate(easter.getDate() + 1);
      const ascension = new Date(easter);
      ascension.setDate(easter.getDate() + 39);
      const whitMonday = new Date(easter);
      whitMonday.setDate(easter.getDate() + 50);

      const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      return new Set([
        `${year}-01-01`, // Jour de l'an
        `${year}-05-01`, // Fête du travail
        `${year}-05-08`, // Victoire 1945
        `${year}-07-14`, // Fête nationale
        `${year}-08-15`, // Assomption
        `${year}-11-01`, // Toussaint
        `${year}-11-11`, // Armistice
        `${year}-12-25`, // Noël
        formatDate(easterMonday), // Lundi de Pâques
        formatDate(ascension),    // Ascension
        formatDate(whitMonday),   // Lundi de Pentecôte
      ]);
    };

    // Cache des jours fériés par année
    const holidaysCache = {};
    const isHoliday = (dateStr) => {
      const year = parseInt(dateStr.slice(0, 4));
      if (!holidaysCache[year]) {
        holidaysCache[year] = getFrenchHolidays(year);
      }
      return holidaysCache[year].has(dateStr);
    };

    // Helper pour vérifier si une date est un dimanche
    const isSunday = (dateStr) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.getDay() === 0;
    };

    // Helper pour calculer la répartition des heures par catégorie
    // Retourne { jour, nuit, dimanche_jour, dimanche_nuit, ferie_jour, ferie_nuit, dimanche_ferie_jour, dimanche_ferie_nuit }
    const calculateHoursBreakdown = (dateStr, heureDebut, heureFin, totalMinutes) => {
      const NUIT_DEBUT = 21 * 60; // 21:00
      const NUIT_FIN = 6 * 60;    // 06:00

      const debutMin = toMinutes(heureDebut);
      const finMin = toMinutes(heureFin);

      // Calculer minutes de nuit vs jour
      let nightMinutes = 0;

      // Heures entre 21h et minuit
      if (debutMin < 24 * 60 && (finMin > NUIT_DEBUT || finMin < debutMin)) {
        const nightStart = Math.max(debutMin, NUIT_DEBUT);
        const nightEnd = finMin < debutMin ? 24 * 60 : Math.min(finMin, 24 * 60);
        if (nightStart < nightEnd) {
          nightMinutes += nightEnd - nightStart;
        }
      }

      // Heures entre minuit et 6h
      if (finMin <= NUIT_FIN || (finMin < debutMin && finMin > 0)) {
        const effectiveFin = finMin < debutMin ? finMin : Math.min(finMin, NUIT_FIN);
        if (debutMin < NUIT_FIN) {
          nightMinutes += Math.min(effectiveFin, NUIT_FIN) - debutMin;
        } else if (finMin < debutMin) {
          nightMinutes += Math.min(effectiveFin, NUIT_FIN);
        }
      }

      const dayMinutes = totalMinutes - nightMinutes;

      // Déterminer le type de jour
      const sunday = isSunday(dateStr);
      const holiday = isHoliday(dateStr);

      // Résultat par défaut
      const result = {
        jour: 0, nuit: 0,
        dimanche_jour: 0, dimanche_nuit: 0,
        ferie_jour: 0, ferie_nuit: 0,
        dimanche_ferie_jour: 0, dimanche_ferie_nuit: 0
      };

      // Catégorisation : dimanche_ferie > ferie > dimanche > normal
      if (sunday && holiday) {
        result.dimanche_ferie_jour = dayMinutes;
        result.dimanche_ferie_nuit = nightMinutes;
      } else if (holiday) {
        result.ferie_jour = dayMinutes;
        result.ferie_nuit = nightMinutes;
      } else if (sunday) {
        result.dimanche_jour = dayMinutes;
        result.dimanche_nuit = nightMinutes;
      } else {
        result.jour = dayMinutes;
        result.nuit = nightMinutes;
      }

      return result;
    };

    // Helper pour calculer les heures de nuit légales (21h-6h en France)
    // Retourne le nombre de minutes travaillées pendant les heures de nuit
    const calculateNightMinutes = (heureDebut, heureFin) => {
      if (!heureDebut || !heureFin) return 0;

      const NUIT_DEBUT = 21 * 60; // 21:00 = 1260 min
      const NUIT_FIN = 6 * 60;    // 06:00 = 360 min

      let debutMin = toMinutes(heureDebut);
      let finMin = toMinutes(heureFin);

      // Gérer le passage à minuit
      if (finMin < debutMin) {
        // Shift de nuit qui passe minuit (ex: 22:00 -> 07:00)
        // Partie 1: de début jusqu'à minuit (21:00-00:00)
        let nightMinutes = 0;

        // Heures de nuit avant minuit (21:00 - 00:00)
        if (debutMin < 24 * 60) { // toujours vrai
          const nightStart = Math.max(debutMin, NUIT_DEBUT);
          const nightEnd = 24 * 60; // minuit
          if (nightStart < nightEnd) {
            nightMinutes += nightEnd - nightStart;
          }
        }

        // Heures de nuit après minuit (00:00 - 06:00)
        if (finMin > 0) {
          const nightEnd = Math.min(finMin, NUIT_FIN);
          if (nightEnd > 0) {
            nightMinutes += nightEnd;
          }
        }

        return nightMinutes;
      } else {
        // Shift normal (même jour)
        let nightMinutes = 0;

        // Vérifier intersection avec 21:00-00:00
        if (debutMin < 24 * 60 && finMin > NUIT_DEBUT) {
          const nightStart = Math.max(debutMin, NUIT_DEBUT);
          const nightEnd = Math.min(finMin, 24 * 60);
          if (nightStart < nightEnd) {
            nightMinutes += nightEnd - nightStart;
          }
        }

        // Vérifier intersection avec 00:00-06:00
        if (debutMin < NUIT_FIN) {
          const nightStart = debutMin;
          const nightEnd = Math.min(finMin, NUIT_FIN);
          if (nightStart < nightEnd) {
            nightMinutes += nightEnd - nightStart;
          }
        }

        return nightMinutes;
      }
    };

    // Ajouter les RDV (avec gestion des prestations de nuit)
    (reservations || []).forEach(rdv => {
      // Chercher les services spécifiques (priorité: assignés à ce membre, sinon tous)
      const lignesRdv = getLignesForReservation(rdv.id);

      const serviceNoms = lignesRdv.length > 0
        ? lignesRdv.map(l => l.service_nom).join(', ')
        : rdv.service_nom;
      const dureeTotale = lignesRdv.length > 0
        ? lignesRdv.reduce((sum, l) => sum + (l.duree_minutes || 60) * (l.quantite || 1), 0)
        : (rdv.duree_totale_minutes || rdv.duree_minutes || 60);
      const prixTotal = lignesRdv.length > 0
        ? lignesRdv.reduce((sum, l) => sum + (l.prix_total || 0), 0) / 100
        : (rdv.prix_total ? rdv.prix_total / 100 : 0);
      const heureDebut = lignesRdv[0]?.heure_debut || rdv.heure;
      // Utiliser heure_fin de la ligne, sinon celle de la réservation
      const heureFin = lignesRdv[0]?.heure_fin || rdv.heure_fin || null;

      // Est-ce que la date de début est dans la semaine affichée?
      const dateInWeek = !!planningHebdo[rdv.date];

      // Vérifier si c'est une prestation de nuit (passe minuit)
      if (isOvernightShift(heureDebut, heureFin)) {
        // Calculer la date du lendemain
        const [annee, mois, jour] = rdv.date.split('-').map(Number);
        const dateJour2 = new Date(annee, mois - 1, jour + 1);
        const dateStrJour2 = `${dateJour2.getFullYear()}-${String(dateJour2.getMonth() + 1).padStart(2, '0')}-${String(dateJour2.getDate()).padStart(2, '0')}`;

        // Partie 1: Jour de début -> minuit (seulement si le jour de début est dans la semaine)
        console.log(`[PLANNING] Overnight shift: ${rdv.date} ${heureDebut}-${heureFin}, dateInWeek=${dateInWeek}`);
        if (dateInWeek) {
          const minutesJour1 = (24 * 60) - toMinutes(heureDebut);
          // Heures de nuit partie 1 (21:00 - 00:00)
          const NUIT_DEBUT = 21 * 60;
          const heuresNuitJour1 = Math.max(0, (24 * 60) - Math.max(toMinutes(heureDebut), NUIT_DEBUT));
          // Calcul répartition heures (dimanche/férié/normal)
          const breakdown1 = calculateHoursBreakdown(rdv.date, heureDebut, '00:00', minutesJour1);

          console.log(`[PLANNING] Ajout partie 1 (${rdv.date}): ${heureDebut} - 00:00`);
          planningHebdo[rdv.date].rdv.push({
            id: rdv.id,
            heure: heureDebut,
            heure_fin: '00:00',
            service: serviceNoms,
            duree: minutesJour1,
            heures_nuit: heuresNuitJour1,
            hours_breakdown: breakdown1,
            statut: rdv.statut,
            prix: prixTotal / 2,
            client: formatClientName(rdv.client),
            client_tel: rdv.client?.telephone,
            is_overnight: true,
            overnight_part: 1,
            is_sunday: isSunday(rdv.date),
            is_holiday: isHoliday(rdv.date)
          });
        }

        // Partie 2: Lendemain minuit -> heure de fin
        // Vérifier si le lendemain est dans la semaine (ou existe déjà)
        const jour2InWeek = dateStrJour2 >= dateDebutStr && dateStrJour2 <= dateFinStr;

        if (jour2InWeek) {
          // Créer l'entrée pour le lendemain si elle n'existe pas
          if (!planningHebdo[dateStrJour2]) {
            planningHebdo[dateStrJour2] = {
              rdv: [],
              absent: false,
              type_absence: null
            };
            console.log(`[PLANNING] Création jour ${dateStrJour2} pour suite nuit de ${rdv.date}`);
          }

          console.log(`[PLANNING] Ajout partie 2 (${rdv.date} -> ${dateStrJour2}): 00:00 - ${heureFin}`);

          const minutesJour2 = toMinutes(heureFin);
          // Heures de nuit partie 2 (00:00 - 06:00)
          const NUIT_FIN = 6 * 60;
          const heuresNuitJour2 = Math.min(minutesJour2, NUIT_FIN);
          // Calcul répartition heures pour jour 2 (dimanche/férié/normal)
          const breakdown2 = calculateHoursBreakdown(dateStrJour2, '00:00', heureFin, minutesJour2);

          planningHebdo[dateStrJour2].rdv.push({
            id: rdv.id,
            heure: '00:00',
            heure_fin: heureFin,
            service: serviceNoms,
            duree: minutesJour2,
            heures_nuit: heuresNuitJour2,
            hours_breakdown: breakdown2,
            statut: rdv.statut,
            prix: prixTotal / 2,
            client: formatClientName(rdv.client),
            client_tel: rdv.client?.telephone,
            is_overnight: true,
            overnight_part: 2,
            is_sunday: isSunday(dateStrJour2),
            is_holiday: isHoliday(dateStrJour2)
          });
        }
      } else {
        // Prestation normale (même jour) - seulement si dans la semaine
        if (!dateInWeek) return;

        const heuresNuit = calculateNightMinutes(heureDebut, heureFin);
        // Calcul répartition heures (dimanche/férié/normal)
        const breakdown = calculateHoursBreakdown(rdv.date, heureDebut, heureFin, dureeTotale);

        planningHebdo[rdv.date].rdv.push({
          id: rdv.id,
          heure: heureDebut,
          heure_fin: heureFin,
          service: serviceNoms,
          duree: dureeTotale,
          heures_nuit: heuresNuit,
          hours_breakdown: breakdown,
          statut: rdv.statut,
          prix: prixTotal,
          client: formatClientName(rdv.client),
          client_tel: rdv.client?.telephone,
          is_sunday: isSunday(rdv.date),
          is_holiday: isHoliday(rdv.date)
        });
      }
    });

    // Stats de la semaine (utiliser les durées spécifiques des lignes si disponibles)
    let totalMinutes = 0;
    let caRealise = 0;

    (reservations || []).forEach(r => {
      const lignesRdv = getLignesForReservation(r.id);
      if (lignesRdv.length > 0) {
        totalMinutes += lignesRdv.reduce((sum, l) => sum + (l.duree_minutes || 60) * (l.quantite || 1), 0);
        if (r.statut === 'termine') {
          caRealise += lignesRdv.reduce((sum, l) => sum + (l.prix_total || 0), 0) / 100;
        }
      } else {
        totalMinutes += r.duree_totale_minutes || r.duree_minutes || 60;
        if (r.statut === 'termine') {
          caRealise += (r.prix_total || 0) / 100;
        }
      }
    });

    // Calculer les heures par catégorie depuis le planning
    const hoursTotals = {
      jour: 0,
      nuit: 0,
      dimanche_jour: 0,
      dimanche_nuit: 0,
      ferie_jour: 0,
      ferie_nuit: 0,
      dimanche_ferie_jour: 0,
      dimanche_ferie_nuit: 0
    };

    Object.values(planningHebdo).forEach(jour => {
      (jour.rdv || []).forEach(rdv => {
        if (rdv.hours_breakdown) {
          hoursTotals.jour += rdv.hours_breakdown.jour || 0;
          hoursTotals.nuit += rdv.hours_breakdown.nuit || 0;
          hoursTotals.dimanche_jour += rdv.hours_breakdown.dimanche_jour || 0;
          hoursTotals.dimanche_nuit += rdv.hours_breakdown.dimanche_nuit || 0;
          hoursTotals.ferie_jour += rdv.hours_breakdown.ferie_jour || 0;
          hoursTotals.ferie_nuit += rdv.hours_breakdown.ferie_nuit || 0;
          hoursTotals.dimanche_ferie_jour += rdv.hours_breakdown.dimanche_ferie_jour || 0;
          hoursTotals.dimanche_ferie_nuit += rdv.hours_breakdown.dimanche_ferie_nuit || 0;
        }
      });
    });

    // Convertir en heures (arrondi à 0.1)
    const toHours = (minutes) => Math.round((minutes / 60) * 10) / 10;

    const heuresJour = toHours(hoursTotals.jour);
    const heuresNuit = toHours(hoursTotals.nuit);
    const heuresDimancheJour = toHours(hoursTotals.dimanche_jour);
    const heuresDimancheNuit = toHours(hoursTotals.dimanche_nuit);
    const heuresFerieJour = toHours(hoursTotals.ferie_jour);
    const heuresFerieNuit = toHours(hoursTotals.ferie_nuit);
    const heuresDimancheFerieJour = toHours(hoursTotals.dimanche_ferie_jour);
    const heuresDimancheFerieNuit = toHours(hoursTotals.dimanche_ferie_nuit);

    const totalHeures = heuresJour + heuresNuit + heuresDimancheJour + heuresDimancheNuit + heuresFerieJour + heuresFerieNuit + heuresDimancheFerieJour + heuresDimancheFerieNuit;

    res.json({
      membre: {
        id: membre.id,
        nom: membre.nom,
        prenom: membre.prenom,
        role: membre.role
      },
      semaine: {
        debut: dateDebutStr,
        fin: dateFinStr
      },
      planning: planningHebdo,
      stats: {
        total_rdv: reservations?.length || 0,
        heures_travaillees: totalHeures,
        // Heures normales
        heures_jour: heuresJour,
        heures_nuit: heuresNuit,
        // Heures dimanche
        heures_dimanche_jour: heuresDimancheJour,
        heures_dimanche_nuit: heuresDimancheNuit,
        // Heures fériés
        heures_ferie_jour: heuresFerieJour,
        heures_ferie_nuit: heuresFerieNuit,
        // Heures dimanche férié (cumul des majorations)
        heures_dimanche_ferie_jour: heuresDimancheFerieJour,
        heures_dimanche_ferie_nuit: heuresDimancheFerieNuit,
        // CA et absences
        ca_realise: caRealise,
        jours_absence: Object.values(planningHebdo).filter(j => j.absent).length
      }
    });
  } catch (error) {
    console.error('[RH] Erreur planning membre:', error);
    res.status(500).json({ error: 'Erreur récupération planning' });
  }
});

/**
 * GET /api/admin/rh/planning/:id/pdf
 * Télécharger le planning d'un employé en PDF
 */
router.get('/planning/:id/pdf', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { semaine } = req.query;
    const tenantId = req.admin?.tenant_id || req.tenantId;

    // Calculer les dates de la semaine
    let dateDebut, dateFin;
    if (semaine) {
      const [year, week] = semaine.split('-W');
      const firstDayOfYear = new Date(parseInt(year), 0, 1);
      const daysOffset = (parseInt(week) - 1) * 7;
      dateDebut = new Date(firstDayOfYear.getTime() + daysOffset * 24 * 60 * 60 * 1000);
      dateFin = new Date(dateDebut.getTime() + 6 * 24 * 60 * 60 * 1000);
    } else {
      const now = new Date();
      const dayOfWeek = now.getDay();
      dateDebut = new Date(now);
      dateDebut.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      dateFin = new Date(dateDebut);
      dateFin.setDate(dateDebut.getDate() + 6);
    }

    const dateDebutStr = dateDebut.toISOString().split('T')[0];
    const dateFinStr = dateFin.toISOString().split('T')[0];

    // Récupérer l'employé
    const { data: membre } = await supabase
      .from('rh_membres')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!membre) {
      return res.status(404).json({ error: 'Employé non trouvé' });
    }

    // Récupérer les réservations
    const { data: reservations } = await supabase
      .from('reservations')
      .select(`
        id, date, heure, service_nom, duree_minutes, statut, prix_total,
        client:clients(id, nom, prenom, telephone, type_client, raison_sociale)
      `)
      .eq('tenant_id', tenantId)
      .eq('membre_id', id)
      .gte('date', dateDebutStr)
      .lte('date', dateFinStr)
      .not('statut', 'eq', 'annule')
      .order('date', { ascending: true })
      .order('heure', { ascending: true });

    // Récupérer les absences
    const { data: absences } = await supabase
      .from('rh_absences')
      .select('*')
      .eq('membre_id', id)
      .eq('tenant_id', tenantId)
      .lte('date_debut', dateFinStr)
      .gte('date_fin', dateDebutStr)
      .eq('statut', 'approuve');

    // Générer le PDF
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));

    // En-tête
    doc.fontSize(20).text('Planning Hebdomadaire', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).text(`${membre.prenom} ${membre.nom}`, { align: 'center' });
    doc.fontSize(10).text(`Semaine du ${dateDebutStr} au ${dateFinStr}`, { align: 'center' });
    doc.moveDown();

    // Stats
    const totalMinutes = (reservations || []).reduce((sum, r) => sum + (r.duree_minutes || 60), 0);
    const heuresContrat = membre.heures_hebdo || 35;
    doc.fontSize(10)
       .text(`Heures planifiées: ${Math.round(totalMinutes / 60 * 10) / 10}h / ${heuresContrat}h contrat`)
       .text(`Nombre de RDV: ${reservations?.length || 0}`)
       .moveDown();

    // Tableau par jour
    const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(dateDebut);
      currentDate.setDate(dateDebut.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];

      // Vérifier absence
      const absence = (absences || []).find(a => {
        const debut = new Date(a.date_debut);
        const fin = new Date(a.date_fin);
        return currentDate >= debut && currentDate <= fin;
      });

      const rdvJour = (reservations || []).filter(r => r.date === dateStr);

      doc.fontSize(11).fillColor('#333')
         .text(`${jours[i]} ${currentDate.getDate()}/${currentDate.getMonth() + 1}`, { underline: true });

      if (absence) {
        doc.fontSize(9).fillColor('#c00').text(`  ⚠ Absent: ${absence.type}`);
      } else if (rdvJour.length === 0) {
        doc.fontSize(9).fillColor('#666').text('  Aucun RDV');
      } else {
        rdvJour.forEach(rdv => {
          const duree = rdv.duree_minutes || 60;
          const [h, m] = (rdv.heure || '09:00').split(':').map(Number);
          const finMin = h * 60 + m + duree;
          const heureFin = `${(Math.floor(finMin / 60) % 24).toString().padStart(2, '0')}:${(finMin % 60).toString().padStart(2, '0')}`;
          // Formater le nom du client (raison sociale pour les pros)
          const isPro = rdv.client?.type_client === 'professionnel' || !!rdv.client?.raison_sociale;
          const client = rdv.client
            ? (isPro && rdv.client.raison_sociale ? rdv.client.raison_sociale : `${rdv.client.prenom} ${rdv.client.nom}`)
            : 'Client';

          doc.fontSize(9).fillColor('#000')
             .text(`  ${rdv.heure?.slice(0, 5)} - ${heureFin}  |  ${client}  |  ${rdv.service_nom || 'Service'}`);
        });
      }

      doc.moveDown(0.5);
    }

    // Pied de page
    doc.moveDown()
       .fontSize(8)
       .fillColor('#999')
       .text(`Généré le ${new Date().toLocaleDateString('fr-FR')} - NEXUS SIRH`, { align: 'center' });

    doc.end();

    await new Promise(resolve => doc.on('end', resolve));
    const pdfBuffer = Buffer.concat(chunks);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="planning_${membre.nom}_${membre.prenom}_${dateDebutStr}.pdf"`);
    res.send(pdfBuffer);

  } catch (error) {
    console.error('[RH] Erreur génération PDF planning:', error);
    res.status(500).json({ error: 'Erreur génération PDF' });
  }
});

/**
 * POST /api/admin/rh/planning/:id/envoyer
 * Envoyer le planning par email à l'employé
 */
router.post('/planning/:id/envoyer', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { semaine } = req.body;
    const tenantId = req.admin?.tenant_id || req.tenantId;

    // Récupérer l'employé
    const { data: membre } = await supabase
      .from('rh_membres')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!membre) {
      return res.status(404).json({ error: 'Employé non trouvé' });
    }

    if (!membre.email) {
      return res.status(400).json({ error: 'L\'employé n\'a pas d\'adresse email' });
    }

    // TODO: Implémenter l'envoi d'email avec le PDF en pièce jointe
    // Pour l'instant, on simule le succès
    console.log(`[RH] Envoi planning à ${membre.email} pour la semaine ${semaine}`);

    res.json({
      success: true,
      message: `Planning envoyé à ${membre.email}`,
      note: 'Fonctionnalité email à implémenter'
    });

  } catch (error) {
    console.error('[RH] Erreur envoi planning:', error);
    res.status(500).json({ error: 'Erreur envoi planning' });
  }
});

// ============================================
// DSN - DÉCLARATION SOCIALE NOMINATIVE
// ============================================

/**
 * GET /api/admin/rh/dsn/parametres
 * Récupérer les paramètres DSN de l'entreprise
 */
router.get('/dsn/parametres', authenticateAdmin, async (req, res) => {
  try {
    const { data: params, error } = await supabase
      .from('rh_dsn_parametres')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json(params || {});
  } catch (error) {
    console.error('[RH] Erreur paramètres DSN:', error);
    res.status(500).json({ error: 'Erreur récupération paramètres DSN' });
  }
});

/**
 * PUT /api/admin/rh/dsn/parametres
 * Sauvegarder les paramètres DSN
 */
router.put('/dsn/parametres', authenticateAdmin, async (req, res) => {
  try {
    const {
      siren, raison_sociale, adresse_siege, code_postal_siege, ville_siege,
      siret, nic, code_naf, effectif_moyen, adresse_etablissement, code_postal_etablissement, ville_etablissement,
      contact_nom, contact_email, contact_tel,
      logiciel_paie, version_norme, fraction,
      urssaf_code, caisse_retraite_code, caisse_retraite_nom, prevoyance_code, prevoyance_nom, mutuelle_code, mutuelle_nom,
      idcc, convention_libelle,
      date_creation_etablissement, date_premiere_embauche
    } = req.body;

    const { data: params, error } = await supabase
      .from('rh_dsn_parametres')
      .upsert({
        tenant_id: req.admin.tenant_id,
        siren, raison_sociale, adresse_siege, code_postal_siege, ville_siege,
        siret, nic, code_naf, effectif_moyen, adresse_etablissement, code_postal_etablissement, ville_etablissement,
        contact_nom, contact_email, contact_tel,
        logiciel_paie: logiciel_paie || 'NEXUS SIRH',
        version_norme: version_norme || 'P26V01',
        fraction: fraction || '11',
        urssaf_code, caisse_retraite_code, caisse_retraite_nom, prevoyance_code, prevoyance_nom, mutuelle_code, mutuelle_nom,
        idcc, convention_libelle,
        date_creation_etablissement, date_premiere_embauche,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id'
      })
      .select()
      .single();

    if (error) throw error;

    res.json(params);
  } catch (error) {
    console.error('[RH] Erreur sauvegarde paramètres DSN:', error);
    res.status(500).json({ error: 'Erreur sauvegarde paramètres DSN' });
  }
});

/**
 * POST /api/admin/rh/dsn/generer
 * Générer un fichier DSN pour une période
 */
router.post('/dsn/generer', authenticateAdmin, async (req, res) => {
  try {
    const { periode, type_declaration, nature_envoi } = req.body; // periode: "2026-02"

    if (!periode) {
      return res.status(400).json({ error: 'Période requise (format: YYYY-MM)' });
    }

    // Récupérer les paramètres DSN
    const { data: params } = await supabase
      .from('rh_dsn_parametres')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (!params || !params.siret) {
      return res.status(400).json({ error: 'Paramètres DSN incomplets. Veuillez configurer les informations entreprise.' });
    }

    // Récupérer les employés actifs
    const { data: membres } = await supabase
      .from('rh_membres')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('statut', 'actif');

    // Récupérer les bulletins de paie de la période (source principale)
    const { data: bulletins } = await supabase
      .from('rh_bulletins_paie')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('periode', periode);

    // Créer un map des bulletins par membre_id pour accès rapide
    const bulletinsMap = new Map();
    (bulletins || []).forEach(b => {
      bulletinsMap.set(b.membre_id, b);
    });

    console.log(`[DSN] Période ${periode}: ${membres?.length || 0} membres actifs, ${bulletins?.length || 0} bulletins trouvés`);

    // Générer le contenu DSN - Format NEODeS 2026
    const dateGeneration = new Date();
    const [year, month] = periode.split('-');
    const dateGen = dateGeneration.toISOString().slice(0, 10).replace(/-/g, '');
    const moisDecl = `${year}${month}`; // Format AAAAMM

    let dsn = '';
    let nbRubriques = 0;

    const add = (code, value) => {
      if (value !== null && value !== undefined && value !== '') {
        dsn += `${code},'${value}'\n`;
        nbRubriques++;
      }
    };

    // =====================================================
    // S10 - ENVOI (structure obligatoire)
    // =====================================================
    // S10.G00.00 - Envoi
    add('S10.G00.00.001', params.logiciel_paie || 'NEXUS SIRH');  // Nom du logiciel
    add('S10.G00.00.002', 'NEXUS');                               // Nom de l'éditeur
    add('S10.G00.00.003', '1.0.0');                               // Version du logiciel
    add('S10.G00.00.005', '01');                                  // Code envoi: 01=réel, 02=test
    add('S10.G00.00.006', params.version_norme || 'P26V01');      // Version norme NEODeS 2026
    add('S10.G00.00.007', '01');                                  // Point de dépôt: 01=net-entreprises
    add('S10.G00.00.008', '01');                                  // Type envoi: 01=normal

    // S10.G00.01 - Emetteur de l'envoi
    add('S10.G00.01.001', params.siren);                          // SIREN émetteur
    add('S10.G00.01.002', params.nic || params.siret?.slice(9));  // NIC émetteur
    add('S10.G00.01.004', params.raison_sociale);                 // Raison sociale
    add('S10.G00.01.005', params.adresse_siege);                  // Adresse
    add('S10.G00.01.006', params.code_postal_siege);              // Code postal
    add('S10.G00.01.007', params.ville_siege);                    // Commune

    // S10.G00.02 - Contact émetteur
    add('S10.G00.02.001', params.contact_nom);                    // Nom contact
    add('S10.G00.02.002', params.contact_email);                  // Email
    add('S10.G00.02.004', params.contact_tel);                    // Téléphone

    // =====================================================
    // S20 - DÉCLARATION
    // =====================================================
    add('S20.G00.05.001', '01');                                  // Nature: 01=DSN mensuelle
    add('S20.G00.05.002', '01');                                  // Type: 01=normale
    add('S20.G00.05.003', params.fraction || '11');               // Fraction: 11=mensuelle normale
    add('S20.G00.05.004', '00');                                  // Ordre de la déclaration
    add('S20.G00.05.005', `01${moisDecl}`);                       // Date mois principal déclaré
    add('S20.G00.05.007', '01');                                  // Devise: 01=Euro
    add('S20.G00.05.008', '01');                                  // Champ: 01=régime général
    add('S20.G00.05.009', params.urssaf_code || '');              // Identifiant URSSAF
    add('S20.G00.05.010', dateGen);                               // Date constitution fichier

    // S20.G00.07 - Contact déclaration
    add('S20.G00.07.001', params.contact_nom);                    // Nom contact
    add('S20.G00.07.002', params.contact_email);                  // Email

    // =====================================================
    // S21 - DONNÉES DÉCLARATIVES
    // =====================================================

    // S21.G00.06 - Entreprise
    add('S21.G00.06.001', params.siren);                          // SIREN
    add('S21.G00.06.002', params.code_naf);                       // Code APEN (NAF)
    add('S21.G00.06.003', params.adresse_siege);                  // Adresse siège
    add('S21.G00.06.004', params.code_postal_siege);              // Code postal siège
    add('S21.G00.06.005', params.ville_siege);                    // Commune siège

    // S21.G00.11 - Établissement
    add('S21.G00.11.001', params.nic || params.siret?.slice(9));  // NIC
    add('S21.G00.11.003', params.code_naf);                       // Code APET
    add('S21.G00.11.004', params.adresse_etablissement || params.adresse_siege);
    add('S21.G00.11.005', params.code_postal_etablissement || params.code_postal_siege);
    add('S21.G00.11.006', params.ville_etablissement || params.ville_siege);
    add('S21.G00.11.008', String(params.effectif_moyen || membres?.length || 0).padStart(5, '0'));

    // Variables pour totaux
    let totalBrut = 0;
    let totalNet = 0;
    let totalCotisations = 0;
    let nbSalariesDSN = 0;

    // Pour TOUS les salariés actifs
    (membres || []).forEach((m) => {
      // Chercher le bulletin de paie directement dans la table rh_bulletins_paie
      const bulletin = bulletinsMap.get(m.id);

      // Si pas de bulletin et pas de salaire mensuel, skip
      if (!bulletin && !m.salaire_mensuel) return;

      // Calculer les montants : soit depuis le bulletin, soit depuis le salaire de base
      const brut = bulletin ? bulletin.brut_total : (m.salaire_mensuel || 0);
      const cotisationsSalariales = bulletin
        ? (bulletin.total_cotisations_salariales || Math.round(brut * 0.22))
        : Math.round(brut * 0.22); // ~22% estimation
      const net = bulletin ? bulletin.net_a_payer : (brut - cotisationsSalariales);
      const cotisationsPatronales = bulletin
        ? (bulletin.total_cotisations_patronales || Math.round(brut * 0.45))
        : Math.round(brut * 0.45); // ~45% estimation

      nbSalariesDSN++;
      console.log(`[DSN] Ajout salarié: ${m.nom} ${m.prenom} - Brut: ${brut/100}€ (source: ${bulletin ? 'bulletin' : 'fiche'})`);

      // S21.G00.30 - Individu
      add('S21.G00.30.001', m.nir || '');                         // NIR
      add('S21.G00.30.002', (m.nom || '').toUpperCase());         // Nom de famille
      add('S21.G00.30.004', (m.prenom || ''));                    // Prénoms
      add('S21.G00.30.006', m.sexe === 'M' ? '01' : '02');        // Sexe: 01=M, 02=F
      add('S21.G00.30.007', m.date_naissance?.replace(/-/g, '')); // Date naissance AAAAMMJJ
      add('S21.G00.30.008', m.lieu_naissance || '');              // Lieu naissance
      add('S21.G00.30.014', m.adresse_rue || '');                 // Adresse salarié
      add('S21.G00.30.015', m.adresse_cp || '');                  // Code postal
      add('S21.G00.30.016', m.adresse_ville || '');               // Commune

      // S21.G00.40 - Contrat
      add('S21.G00.40.001', m.date_embauche?.replace(/-/g, ''));  // Date début contrat
      add('S21.G00.40.007', m.type_contrat === 'cdi' ? '01' : '02'); // Nature: 01=CDI, 02=CDD
      add('S21.G00.40.008', m.poste || m.role || '');             // Libellé emploi
      add('S21.G00.40.009', '01');                                // Dispositif politique publique
      add('S21.G00.40.011', String(Math.round((m.heures_mensuelles || 151.67) * 100))); // Quotité travail
      add('S21.G00.40.016', params.idcc || '');                   // Code convention collective
      add('S21.G00.40.019', m.categorie_sociopro || '');          // Catégorie socioprofessionnelle

      // S21.G00.50 - Versement individu (brut/net déjà calculés au-dessus)
      add('S21.G00.50.001', `01${moisDecl}`);                     // Date versement JJAAAAMM
      add('S21.G00.50.002', String(Math.round(brut / 100)));      // Rémunération nette fiscale (euros)
      add('S21.G00.50.004', String(Math.round(net / 100)));       // Montant net versé (euros)
      add('S21.G00.50.006', '01');                                // Mode paiement: 01=virement
      add('S21.G00.50.009', String(Math.round(brut / 100)));      // Rémunération brute (euros)

      // S21.G00.51 - Rémunération (composantes)
      add('S21.G00.51.001', `01${moisDecl}`);                     // Date début période paie
      add('S21.G00.51.002', `${new Date(parseInt(year), parseInt(month), 0).getDate()}${moisDecl}`); // Date fin
      add('S21.G00.51.010', '001');                               // Type: 001=salaire de base
      add('S21.G00.51.011', String(Math.round(brut / 100)));      // Montant (euros)
      add('S21.G00.51.012', String(Math.round((m.heures_mensuelles || 151.67) * 100))); // Nombre heures

      totalBrut += brut;
      totalNet += net;
      totalCotisations += cotisationsPatronales + cotisationsSalariales;
    });

    // =====================================================
    // S90 - TOTAL ENVOI (structure obligatoire)
    // =====================================================
    add('S90.G00.90.001', String(nbRubriques + 1).padStart(10, '0')); // Nombre de rubriques
    add('S90.G00.90.002', '01');                                      // Nombre de déclarations

    // Enregistrer dans l'historique
    const { data: historique, error } = await supabase
      .from('rh_dsn_historique')
      .insert({
        tenant_id: req.admin.tenant_id,
        periode,
        type_declaration: type_declaration || 'mensuelle',
        nature_envoi: nature_envoi || '01',
        nb_salaries: nbSalariesDSN,
        total_brut: Math.round(totalBrut),
        total_cotisations: Math.round(totalCotisations),
        statut: 'generee',
        fichier_nom: `DSN_${periode.replace('-', '')}_${Date.now()}.dsn`,
        contenu_dsn: dsn
        // genere_par omis car c'est une FK vers rh_membres et non admins
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      historique,
      contenu_dsn: dsn,
      stats: {
        periode,
        nb_salaries: nbSalariesDSN,
        total_brut: totalBrut / 100,
        total_net: totalNet / 100,
        total_cotisations: totalCotisations / 100
      }
    });
  } catch (error) {
    console.error('[RH] Erreur génération DSN:', error);
    res.status(500).json({ error: 'Erreur génération DSN' });
  }
});

/**
 * GET /api/admin/rh/dsn/historique
 * Historique des DSN générées
 */
router.get('/dsn/historique', authenticateAdmin, async (req, res) => {
  try {
    const { data: historique, error } = await supabase
      .from('rh_dsn_historique')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .order('created_at', { ascending: false })
      .limit(24);

    if (error) throw error;

    res.json(historique || []);
  } catch (error) {
    console.error('[RH] Erreur historique DSN:', error);
    res.status(500).json({ error: 'Erreur récupération historique DSN' });
  }
});

/**
 * DELETE /api/admin/rh/dsn/historique/:id
 * Supprimer une DSN de l'historique
 */
router.delete('/dsn/historique/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('rh_dsn_historique')
      .delete()
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id);

    if (error) throw error;

    res.json({ success: true, message: 'DSN supprimée' });
  } catch (error) {
    console.error('[RH] Erreur suppression DSN:', error);
    res.status(500).json({ error: 'Erreur suppression DSN' });
  }
});

/**
 * POST /api/admin/rh/dsn/valider
 * Valider une DSN avant transmission
 */
router.post('/dsn/valider', authenticateAdmin, async (req, res) => {
  try {
    const { dsn_id, contenu_dsn } = req.body;

    let contenu = contenu_dsn;

    // Si dsn_id fourni, récupérer le contenu depuis la base
    if (dsn_id && !contenu) {
      const { data: dsn, error } = await supabase
        .from('rh_dsn_historique')
        .select('contenu_dsn, periode, fichier_nom')
        .eq('id', dsn_id)
        .eq('tenant_id', req.admin.tenant_id)
        .single();

      if (error || !dsn) {
        return res.status(404).json({ error: 'DSN non trouvée' });
      }

      contenu = dsn.contenu_dsn;
    }

    if (!contenu) {
      return res.status(400).json({ error: 'Contenu DSN requis (dsn_id ou contenu_dsn)' });
    }

    // Valider la DSN
    const resultat = validerDSN(contenu);
    const rapport = genererRapport(resultat);

    // Mettre à jour le statut si validation depuis historique
    if (dsn_id && resultat.valide) {
      await supabase
        .from('rh_dsn_historique')
        .update({
          statut: 'validee',
          message_retour: `Validée le ${new Date().toLocaleDateString('fr-FR')} - ${resultat.stats.nb_salaries} salarié(s)`
        })
        .eq('id', dsn_id)
        .eq('tenant_id', req.admin.tenant_id);
    }

    res.json({
      success: true,
      valide: resultat.valide,
      erreurs: resultat.erreurs,
      avertissements: resultat.avertissements,
      stats: resultat.stats,
      rapport
    });
  } catch (error) {
    console.error('[RH] Erreur validation DSN:', error);
    res.status(500).json({ error: 'Erreur validation DSN' });
  }
});

/**
 * GET /api/admin/rh/dsn/:id/valider
 * Valider une DSN existante par son ID
 */
router.get('/dsn/:id/valider', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: dsn, error } = await supabase
      .from('rh_dsn_historique')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    if (error || !dsn) {
      return res.status(404).json({ error: 'DSN non trouvée' });
    }

    if (!dsn.contenu_dsn) {
      return res.status(400).json({ error: 'Contenu DSN non disponible' });
    }

    // Valider
    const resultat = validerDSN(dsn.contenu_dsn);
    const rapport = genererRapport(resultat);

    res.json({
      success: true,
      dsn: {
        id: dsn.id,
        periode: dsn.periode,
        fichier_nom: dsn.fichier_nom
      },
      valide: resultat.valide,
      erreurs: resultat.erreurs,
      avertissements: resultat.avertissements,
      stats: resultat.stats,
      rapport
    });
  } catch (error) {
    console.error('[RH] Erreur validation DSN:', error);
    res.status(500).json({ error: 'Erreur validation DSN' });
  }
});

// ============================================
// PARAMÈTRES SOCIAUX (Taux, SMIC, Plafonds)
// ============================================

/**
 * GET /api/admin/rh/parametres-sociaux
 * Récupérer les paramètres sociaux actuels (taux cotisations, SMIC, plafonds)
 */
router.get('/parametres-sociaux', authenticateAdmin, async (req, res) => {
  try {
    const annee = req.query.annee || new Date().getFullYear();

    // Essayer de récupérer depuis la base
    const { data: params } = await supabase
      .from('rh_parametres_sociaux')
      .select('*')
      .eq('annee', annee)
      .eq('actif', true)
      .order('date_application', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (params) {
      res.json({
        source: 'database',
        annee: params.annee,
        date_application: params.date_application,
        parametres: params,
        updated_at: params.updated_at
      });
    } else {
      // Retourner les taux codés en dur
      res.json({
        source: 'application',
        annee: 2026,
        date_application: '2026-01-01',
        parametres: {
          // SMIC
          smic_horaire_brut: TAUX_COTISATIONS.smic_horaire / 100,
          smic_mensuel_brut: TAUX_COTISATIONS.smic_mensuel / 100,

          // Plafonds
          plafond_ss_mensuel: TAUX_COTISATIONS.plafond_ss_mensuel / 100,
          plafond_ss_annuel: TAUX_COTISATIONS.plafond_ss_annuel / 100,

          // Cotisations salariales
          cotisations_salariales: {
            maladie: { taux: TAUX_COTISATIONS.maladie_salarie, note: '0% depuis 2018' },
            vieillesse_plafonnee: { taux: TAUX_COTISATIONS.vieillesse_plafonnee_salarie },
            vieillesse_deplafonnee: { taux: TAUX_COTISATIONS.vieillesse_deplafonnee_salarie },
            chomage: { taux: TAUX_COTISATIONS.chomage_salarie, note: '0% depuis 2019' },
            retraite_t1: { taux: TAUX_COTISATIONS.retraite_t1_salarie },
            retraite_t2: { taux: TAUX_COTISATIONS.retraite_t2_salarie },
            ceg_t1: { taux: TAUX_COTISATIONS.ceg_t1_salarie },
            ceg_t2: { taux: TAUX_COTISATIONS.ceg_t2_salarie },
            csg_deductible: { taux: TAUX_COTISATIONS.csg_deductible },
            csg_non_deductible: { taux: TAUX_COTISATIONS.csg_non_deductible },
            crds: { taux: TAUX_COTISATIONS.crds }
          },

          // Cotisations patronales
          cotisations_patronales: {
            maladie: { taux: TAUX_COTISATIONS.maladie_employeur, taux_haut_revenu: TAUX_COTISATIONS.maladie_employeur_haut, note: '7% si < 2.5 SMIC, 13% sinon' },
            vieillesse_plafonnee: { taux: TAUX_COTISATIONS.vieillesse_plafonnee_employeur },
            vieillesse_deplafonnee: { taux: TAUX_COTISATIONS.vieillesse_deplafonnee_employeur, note: 'Augmenté à 2.11% en 2026' },
            allocations_familiales: { taux: TAUX_COTISATIONS.allocations_familiales, taux_reduit: TAUX_COTISATIONS.allocations_familiales_reduit, note: '5.25% normal, 3.45% si < 3.5 SMIC' },
            accidents_travail: { taux: TAUX_COTISATIONS.accidents_travail, note: 'Taux moyen, variable selon secteur' },
            chomage: { taux: TAUX_COTISATIONS.chomage_employeur },
            ags: { taux: TAUX_COTISATIONS.ags },
            fnal_moins_50: { taux: TAUX_COTISATIONS.fnal_moins_50 },
            fnal_50_plus: { taux: TAUX_COTISATIONS.fnal_50_plus },
            csa: { taux: TAUX_COTISATIONS.csa },
            retraite_t1: { taux: TAUX_COTISATIONS.retraite_t1_employeur },
            retraite_t2: { taux: TAUX_COTISATIONS.retraite_t2_employeur },
            ceg_t1: { taux: TAUX_COTISATIONS.ceg_t1_employeur },
            ceg_t2: { taux: TAUX_COTISATIONS.ceg_t2_employeur },
            formation_moins_11: { taux: TAUX_COTISATIONS.formation_moins_11 },
            formation_11_plus: { taux: TAUX_COTISATIONS.formation_11_plus },
            taxe_apprentissage: { taux: TAUX_COTISATIONS.taxe_apprentissage },
            dialogue_social: { taux: TAUX_COTISATIONS.dialogue_social }
          },

          // Heures supplémentaires
          heures_supplementaires: {
            majoration_25: TAUX_COTISATIONS.majoration_hs_25,
            majoration_50: TAUX_COTISATIONS.majoration_hs_50,
            contingent_annuel: TAUX_COTISATIONS.contingent_annuel_hs
          }
        },
        sources: [
          'URSSAF - urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-secteur-prive.html',
          'Service-public.fr - Revalorisation SMIC 2026',
          'Légifrance - Décret plafond SS 2026'
        ]
      });
    }
  } catch (error) {
    console.error('[RH] Erreur récupération paramètres sociaux:', error);
    res.status(500).json({ error: 'Erreur récupération paramètres sociaux' });
  }
});

/**
 * PUT /api/admin/rh/parametres-sociaux
 * Mettre à jour les paramètres sociaux (admin seulement)
 */
router.put('/parametres-sociaux', authenticateAdmin, async (req, res) => {
  try {
    const { annee, ...params } = req.body;
    const targetAnnee = annee || new Date().getFullYear();

    // Vérifier si entrée existe
    const { data: existing } = await supabase
      .from('rh_parametres_sociaux')
      .select('id')
      .eq('annee', targetAnnee)
      .maybeSingle();

    let result;
    if (existing) {
      // Mise à jour
      const { data, error } = await supabase
        .from('rh_parametres_sociaux')
        .update({
          ...params,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insertion
      const { data, error } = await supabase
        .from('rh_parametres_sociaux')
        .insert({
          annee: targetAnnee,
          date_application: `${targetAnnee}-01-01`,
          actif: true,
          ...params
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.json({ success: true, parametres: result });
  } catch (error) {
    console.error('[RH] Erreur mise à jour paramètres sociaux:', error);
    res.status(500).json({ error: 'Erreur mise à jour paramètres sociaux' });
  }
});

// ============================================
// DOCUMENTS RH (DPAE, Contrats, Certificats...)
// ============================================

/**
 * GET /api/admin/rh/documents/modeles
 * Liste des modèles de documents
 */
router.get('/documents/modeles', authenticateAdmin, async (req, res) => {
  try {
    const { type } = req.query;

    let query = supabase
      .from('rh_documents_modeles')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('actif', true)
      .order('type');

    if (type) {
      query = query.eq('type', type);
    }

    const { data: modeles, error } = await query;

    if (error) throw error;

    res.json(modeles || []);
  } catch (error) {
    console.error('[RH] Erreur modèles documents:', error);
    res.status(500).json({ error: 'Erreur récupération modèles' });
  }
});

/**
 * PUT /api/admin/rh/documents/modeles/:id
 * Modifier un modèle de document
 */
router.put('/documents/modeles/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nom, description, contenu_html, variables, actif } = req.body;

    const updateData = {};
    if (nom !== undefined) updateData.nom = nom;
    if (description !== undefined) updateData.description = description;
    if (contenu_html !== undefined) updateData.contenu_html = contenu_html;
    if (variables !== undefined) updateData.variables = variables;
    if (actif !== undefined) updateData.actif = actif;
    updateData.updated_at = new Date().toISOString();

    const { data: modele, error } = await supabase
      .from('rh_documents_modeles')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;

    res.json(modele);
  } catch (error) {
    console.error('[RH] Erreur modification modèle:', error);
    res.status(500).json({ error: 'Erreur modification modèle' });
  }
});

/**
 * POST /api/admin/rh/documents/generer
 * Générer un document pour un employé
 * Utilise MODELES_DEFAUT si pas de modèle custom en DB
 */
router.post('/documents/generer', authenticateAdmin, async (req, res) => {
  console.log('[RH DOCUMENTS] POST /documents/generer - body:', req.body);
  try {
    const { membre_id, type, variables_custom, donnees_supplementaires } = req.body;

    if (!membre_id || !type) {
      return res.status(400).json({ error: 'membre_id et type requis' });
    }

    // Vérifier que le type est valide via MODELES_DEFAUT
    if (!MODELES_DEFAUT[type]) {
      return res.status(400).json({ error: `Type de document invalide: ${type}` });
    }

    const tenantId = req.admin.tenant_id || req.tenantId;

    // Utiliser le service pour générer le document
    const result = await genererDocument(tenantId, type, membre_id, { ...variables_custom, ...donnees_supplementaires });

    res.json({
      success: true,
      document: result.document
    });
  } catch (error) {
    console.error('[RH] Erreur génération document:', error);
    res.status(500).json({ error: 'Erreur génération document' });
  }
});

/**
 * GET /api/admin/rh/membres/:id/documents
 * Documents d'un employé
 */
router.get('/membres/:id/documents', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: documents, error } = await supabase
      .from('rh_documents')
      .select('*')
      .eq('tenant_id', req.admin.tenant_id)
      .eq('membre_id', id)
      .order('date_generation', { ascending: false });

    if (error) throw error;

    res.json(documents || []);
  } catch (error) {
    console.error('[RH] Erreur documents employé:', error);
    res.status(500).json({ error: 'Erreur récupération documents' });
  }
});

/**
 * DELETE /api/admin/rh/documents/:id
 * Supprimer un document
 */
router.delete('/documents/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('rh_documents')
      .delete()
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('[RH] Erreur suppression document:', error);
    res.status(500).json({ error: 'Erreur suppression document' });
  }
});

// ============================================
// POINTAGE (ancienne route supprimée - doublon)
// ============================================

/**
 * POST /api/admin/rh/pointage
 * Créer/mettre à jour une entrée de pointage
 */
router.post('/pointage', authenticateAdmin, async (req, res) => {
  try {
    const { membre_id, date_travail, heure_debut, heure_fin, pause_minutes, notes, source } = req.body;

    if (!membre_id || !date_travail) {
      return res.status(400).json({ error: 'membre_id et date_travail requis' });
    }

    // Calculer les heures travaillées
    let heuresTravaillees = 0;
    if (heure_debut && heure_fin) {
      const [hd, md] = heure_debut.split(':').map(Number);
      const [hf, mf] = heure_fin.split(':').map(Number);
      heuresTravaillees = (hf * 60 + mf - hd * 60 - md - (pause_minutes || 60)) / 60;
    }

    // Récupérer les heures théoriques du contrat
    const { data: membre } = await supabase
      .from('rh_membres')
      .select('heures_hebdo')
      .eq('id', membre_id)
      .eq('tenant_id', req.admin.tenant_id)
      .single();

    const heuresTheoriques = (membre?.heures_hebdo || 35) / 5; // Heures par jour
    const heuresSupp = Math.max(heuresTravaillees - heuresTheoriques, 0);

    const { data: pointage, error } = await supabase
      .from('rh_pointage')
      .upsert({
        tenant_id: req.admin.tenant_id,
        membre_id,
        date_travail,
        heure_debut,
        heure_fin,
        pause_minutes: pause_minutes || 60,
        heures_travaillees: Math.round(heuresTravaillees * 100) / 100,
        heures_theoriques: heuresTheoriques,
        heures_supp: Math.round(heuresSupp * 100) / 100,
        source: source || 'manuel',
        notes
      }, {
        onConflict: 'tenant_id,membre_id,date_travail'
      })
      .select()
      .single();

    if (error) throw error;

    res.json(pointage);
  } catch (error) {
    console.error('[RH] Erreur création pointage:', error);
    res.status(500).json({ error: 'Erreur création pointage' });
  }
});

/**
 * PUT /api/admin/rh/pointage/:id/validate
 * Valider une entrée de pointage
 */
router.put('/pointage/:id/validate', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: pointage, error } = await supabase
      .from('rh_pointage')
      .update({
        validated: true,
        validated_by: req.admin.id,
        validated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', req.admin.tenant_id)
      .select()
      .single();

    if (error) throw error;

    res.json(pointage);
  } catch (error) {
    console.error('[RH] Erreur validation pointage:', error);
    res.status(500).json({ error: 'Erreur validation pointage' });
  }
});

/**
 * GET /api/admin/rh/heures-supp
 * Récapitulatif des heures supplémentaires
 */
router.get('/heures-supp', authenticateAdmin, async (req, res) => {
  try {
    const { membre_id, periode, annee } = req.query;

    let query = supabase
      .from('rh_heures_supp_mensuel')
      .select(`
        *,
        membre:rh_membres(id, nom, prenom, role)
      `)
      .eq('tenant_id', req.admin.tenant_id)
      .order('periode', { ascending: false });

    if (membre_id) {
      query = query.eq('membre_id', membre_id);
    }
    if (periode) {
      query = query.eq('periode', periode);
    }
    if (annee) {
      query = query.like('periode', `${annee}-%`);
    }

    const { data: heuresSupp, error } = await query.limit(24);

    if (error) throw error;

    res.json(heuresSupp || []);
  } catch (error) {
    console.error('[RH] Erreur heures supp:', error);
    res.status(500).json({ error: 'Erreur récupération heures supplémentaires' });
  }
});

// ════════════════════════════════════════════════════════════════════
// POINTAGE
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/rh/pointage
 * Liste le pointage avec filtres (membre, période)
 */
router.get('/pointage', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { membre_id, date_debut, date_fin, validated } = req.query;

    let query = supabase
      .from('rh_pointage')
      .select(`
        *,
        membre:rh_membres!rh_pointage_membre_id_fkey (
          id, nom, prenom, poste, heures_hebdo
        )
      `)
      .eq('tenant_id', tenantId)
      .order('date_travail', { ascending: false });

    if (membre_id) query = query.eq('membre_id', membre_id);
    if (date_debut) query = query.gte('date_travail', date_debut);
    if (date_fin) query = query.lte('date_travail', date_fin);
    if (validated !== undefined) query = query.eq('validated', validated === 'true');

    const { data: pointages, error } = await query.limit(100);

    if (error) throw error;

    res.json({ pointages: pointages || [] });
  } catch (error) {
    console.error('[RH POINTAGE] Erreur liste:', error);
    res.status(500).json({ error: 'Erreur récupération pointage' });
  }
});

/**
 * GET /api/admin/rh/pointage/resume
 * Résumé du pointage pour une période (total heures par employé)
 */
router.get('/pointage/resume', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { periode } = req.query; // 'YYYY-MM'

    if (!periode) {
      return res.status(400).json({ error: 'Période requise (YYYY-MM)' });
    }

    const [annee, mois] = periode.split('-');
    const dateDebut = `${annee}-${mois}-01`;
    // Dernier jour du mois sans conversion UTC
    const lastDay = new Date(parseInt(annee), parseInt(mois), 0).getDate();
    const dateFin = `${annee}-${mois}-${String(lastDay).padStart(2, '0')}`;

    // Récupérer tous les pointages du mois
    const { data: pointages, error } = await supabase
      .from('rh_pointage')
      .select(`
        membre_id,
        heures_travaillees,
        heures_supp,
        validated,
        membre:rh_membres!rh_pointage_membre_id_fkey (
          id, nom, prenom, heures_hebdo, salaire_mensuel
        )
      `)
      .eq('tenant_id', tenantId)
      .gte('date_travail', dateDebut)
      .lte('date_travail', dateFin);

    if (error) throw error;

    // Agréger par employé
    const resume = {};
    (pointages || []).forEach(p => {
      if (!resume[p.membre_id]) {
        resume[p.membre_id] = {
          membre_id: p.membre_id,
          membre_nom: p.membre ? `${p.membre.prenom} ${p.membre.nom}` : 'Inconnu',
          heures_hebdo_contrat: p.membre?.heures_hebdo || 35,
          salaire_mensuel: p.membre?.salaire_mensuel || 0,
          heures_travaillees: 0,
          heures_supp: 0,
          jours_pointes: 0,
          jours_valides: 0
        };
      }
      resume[p.membre_id].heures_travaillees += parseFloat(p.heures_travaillees || 0);
      resume[p.membre_id].heures_supp += parseFloat(p.heures_supp || 0);
      resume[p.membre_id].jours_pointes += 1;
      if (p.validated) resume[p.membre_id].jours_valides += 1;
    });

    res.json({
      periode,
      resume: Object.values(resume)
    });
  } catch (error) {
    console.error('[RH POINTAGE] Erreur résumé:', error);
    res.status(500).json({ error: 'Erreur récupération résumé' });
  }
});

/**
 * POST /api/admin/rh/pointage
 * Créer une entrée de pointage
 */
router.post('/pointage', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { membre_id, date_travail, heure_debut, heure_fin, pause_minutes, notes, source } = req.body;

    if (!membre_id || !date_travail) {
      return res.status(400).json({ error: 'membre_id et date_travail requis' });
    }

    // Récupérer heures théoriques depuis le contrat
    const { data: membre } = await supabase
      .from('rh_membres')
      .select('heures_hebdo, jours_travailles')
      .eq('id', membre_id)
      .eq('tenant_id', tenantId)
      .single();

    const heuresHebdo = membre?.heures_hebdo || 35;
    const joursTravailles = membre?.jours_travailles || ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
    const heuresTheoriques = heuresHebdo / joursTravailles.length;

    const { data: pointage, error } = await supabase
      .from('rh_pointage')
      .upsert({
        tenant_id: tenantId,
        membre_id,
        date_travail,
        heure_debut: emptyToNull(heure_debut),
        heure_fin: emptyToNull(heure_fin),
        pause_minutes: pause_minutes || 60,
        heures_theoriques: heuresTheoriques,
        notes: emptyToNull(notes),
        source: source || 'manuel'
      }, {
        onConflict: 'tenant_id,membre_id,date_travail'
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, pointage });
  } catch (error) {
    console.error('[RH POINTAGE] Erreur création:', error);
    res.status(500).json({ error: 'Erreur création pointage' });
  }
});

/**
 * PUT /api/admin/rh/pointage/:id
 * Modifier une entrée de pointage
 */
router.put('/pointage/:id', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { heure_debut, heure_fin, pause_minutes, notes, validated } = req.body;

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (heure_debut !== undefined) updateData.heure_debut = emptyToNull(heure_debut);
    if (heure_fin !== undefined) updateData.heure_fin = emptyToNull(heure_fin);
    if (pause_minutes !== undefined) updateData.pause_minutes = pause_minutes;
    if (notes !== undefined) updateData.notes = emptyToNull(notes);
    if (validated !== undefined) {
      updateData.validated = validated;
      if (validated) {
        updateData.validated_at = new Date().toISOString();
      }
    }

    const { data: pointage, error } = await supabase
      .from('rh_pointage')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, pointage });
  } catch (error) {
    console.error('[RH POINTAGE] Erreur modification:', error);
    res.status(500).json({ error: 'Erreur modification pointage' });
  }
});

/**
 * POST /api/admin/rh/pointage/valider-lot
 * Valider plusieurs entrées de pointage
 */
router.post('/pointage/valider-lot', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'IDs requis' });
    }

    const { data, error } = await supabase
      .from('rh_pointage')
      .update({
        validated: true,
        validated_at: new Date().toISOString()
      })
      .in('id', ids)
      .eq('tenant_id', tenantId)
      .select();

    if (error) throw error;

    res.json({ success: true, count: data?.length || 0 });
  } catch (error) {
    console.error('[RH POINTAGE] Erreur validation lot:', error);
    res.status(500).json({ error: 'Erreur validation lot' });
  }
});

/**
 * POST /api/admin/rh/pointage/generer-depuis-planning
 * Générer le pointage depuis les réservations terminées
 */
router.post('/pointage/generer-depuis-planning', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { date_debut, date_fin } = req.body;

    if (!date_debut || !date_fin) {
      return res.status(400).json({ error: 'date_debut et date_fin requis' });
    }

    // Récupérer toutes les réservations terminées avec un membre assigné
    // Note: la table reservations utilise 'date', 'heure' et 'duree_minutes'
    const { data: reservations, error: resError } = await supabase
      .from('reservations')
      .select('id, date, heure, membre_id, duree_minutes')
      .eq('tenant_id', tenantId)
      .eq('statut', 'termine')
      .not('membre_id', 'is', null)
      .gte('date', date_debut)
      .lte('date', date_fin);

    if (resError) throw resError;

    console.log(`[RH POINTAGE] ${reservations?.length || 0} réservations trouvées pour ${date_debut} - ${date_fin}`);

    // Debug: afficher quelques réservations
    if (reservations?.length > 0) {
      console.log('[RH POINTAGE] Exemple réservation:', JSON.stringify(reservations[0]));
    }

    // Grouper par membre et date
    const pointageParJour = {};
    (reservations || []).forEach(r => {
      const key = `${r.membre_id}-${r.date}`;
      if (!pointageParJour[key]) {
        pointageParJour[key] = {
          membre_id: r.membre_id,
          date_travail: r.date,
          heures: 0,
          reservations: []
        };
      }
      // Calculer durée en heures (duree_minutes ou 60 par défaut)
      const dureeHeures = (r.duree_minutes || 60) / 60;
      pointageParJour[key].heures += dureeHeures;
      pointageParJour[key].reservations.push(r.id);
    });

    // Récupérer infos employés pour heures théoriques
    const membreIds = [...new Set(Object.values(pointageParJour).map(p => p.membre_id))];
    const { data: membres } = await supabase
      .from('rh_membres')
      .select('id, heures_hebdo, jours_travailles')
      .in('id', membreIds)
      .eq('tenant_id', tenantId);

    const membresMap = {};
    (membres || []).forEach(m => {
      const jours = m.jours_travailles?.length || 5;
      membresMap[m.id] = (m.heures_hebdo || 35) / jours;
    });

    // Créer/mettre à jour les pointages
    let created = 0;
    let updated = 0;

    console.log(`[RH POINTAGE] ${Object.keys(pointageParJour).length} jours à créer pour ${membreIds.length} membres`);

    for (const p of Object.values(pointageParJour)) {
      const heuresTheoriques = membresMap[p.membre_id] || 7;

      const { data: result, error } = await supabase
        .from('rh_pointage')
        .upsert({
          tenant_id: tenantId,
          membre_id: p.membre_id,
          date_travail: p.date_travail,
          heures_travaillees: p.heures,
          heures_theoriques: heuresTheoriques,
          heures_supp: Math.max(0, p.heures - heuresTheoriques),
          source: 'planning',
          notes: `Généré depuis ${p.reservations.length} RDV`
        }, {
          onConflict: 'tenant_id,membre_id,date_travail'
        });

      if (error) {
        console.error('[RH POINTAGE] Erreur upsert:', error.message, 'pour membre', p.membre_id, 'date', p.date_travail);
      } else {
        created++;
      }
    }

    res.json({
      success: true,
      message: `${created} entrées de pointage générées`,
      count: created
    });
  } catch (error) {
    console.error('[RH POINTAGE] Erreur génération:', error);
    res.status(500).json({ error: 'Erreur génération pointage' });
  }
});

// ════════════════════════════════════════════════════════════════════
// CALCUL HEURES SUPPLEMENTAIRES MENSUELLES
// ════════════════════════════════════════════════════════════════════

/**
 * POST /api/admin/rh/heures-supp/calculer
 * Calculer les heures supplémentaires pour une période
 */
router.post('/heures-supp/calculer', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { periode, membre_id } = req.body; // periode: 'YYYY-MM'

    if (!periode) {
      return res.status(400).json({ error: 'Période requise (YYYY-MM)' });
    }

    const [annee, mois] = periode.split('-');
    const dateDebut = `${annee}-${mois}-01`;
    const lastDay = new Date(parseInt(annee), parseInt(mois), 0).getDate();
    const dateFin = `${annee}-${mois}-${String(lastDay).padStart(2, '0')}`;

    // Récupérer pointages validés
    let query = supabase
      .from('rh_pointage')
      .select(`
        membre_id,
        date_travail,
        heures_supp,
        membre:rh_membres!rh_pointage_membre_id_fkey (
          id, nom, prenom, salaire_mensuel, heures_hebdo
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('validated', true)
      .gte('date_travail', dateDebut)
      .lte('date_travail', dateFin);

    if (membre_id) query = query.eq('membre_id', membre_id);

    const { data: pointages, error: pError } = await query;
    if (pError) throw pError;

    // Grouper par employé et semaine pour calcul 25%/50%
    const parEmploye = {};
    (pointages || []).forEach(p => {
      if (!parEmploye[p.membre_id]) {
        parEmploye[p.membre_id] = {
          membre_id: p.membre_id,
          salaire_mensuel: p.membre?.salaire_mensuel || 0,
          heures_hebdo: p.membre?.heures_hebdo || 35,
          heures_supp_total: 0,
          semaines: {}
        };
      }

      // Déterminer la semaine
      const date = new Date(p.date_travail);
      const semaine = getWeekNumber(date);
      const semaineKey = `${annee}-S${semaine}`;

      if (!parEmploye[p.membre_id].semaines[semaineKey]) {
        parEmploye[p.membre_id].semaines[semaineKey] = 0;
      }
      parEmploye[p.membre_id].semaines[semaineKey] += parseFloat(p.heures_supp || 0);
      parEmploye[p.membre_id].heures_supp_total += parseFloat(p.heures_supp || 0);
    });

    // Calculer heures 25% et 50% par semaine (8 premières = 25%, au-delà = 50%)
    const resultats = [];

    for (const [membreId, data] of Object.entries(parEmploye)) {
      let heures25 = 0;
      let heures50 = 0;

      for (const [, heureSemaine] of Object.entries(data.semaines)) {
        if (heureSemaine <= 8) {
          heures25 += heureSemaine;
        } else {
          heures25 += 8;
          heures50 += heureSemaine - 8;
        }
      }

      // Calculer montants
      const tauxHoraire = data.salaire_mensuel > 0
        ? Math.round(data.salaire_mensuel / 151.67) // salaire mensuel / heures mensuelles standard
        : 0;

      const montant25 = Math.round(heures25 * tauxHoraire * 1.25);
      const montant50 = Math.round(heures50 * tauxHoraire * 1.50);

      // Récupérer cumul annuel
      const { data: cumulData } = await supabase
        .from('rh_heures_supp_mensuel')
        .select('heures_total')
        .eq('tenant_id', tenantId)
        .eq('membre_id', membreId)
        .like('periode', `${annee}-%`)
        .neq('periode', periode);

      const cumulPrecedent = (cumulData || []).reduce((sum, h) => sum + parseFloat(h.heures_total || 0), 0);
      const cumulAnnuel = cumulPrecedent + heures25 + heures50;
      const alerteContingent = cumulAnnuel >= 198; // 90% de 220h

      // Repos compensateur si dépassement contingent
      let rcGenere = 0;
      if (cumulAnnuel > 220) {
        rcGenere = (cumulAnnuel - 220) / 8; // 1 jour de repos par 8h au-delà
      }

      // Sauvegarder
      const { error: upsertError } = await supabase
        .from('rh_heures_supp_mensuel')
        .upsert({
          tenant_id: tenantId,
          membre_id: parseInt(membreId),
          periode,
          heures_25: heures25,
          heures_50: heures50,
          heures_total: heures25 + heures50,
          taux_horaire: tauxHoraire,
          montant_25: montant25,
          montant_50: montant50,
          montant_total: montant25 + montant50,
          cumul_annuel: cumulAnnuel,
          alerte_contingent: alerteContingent,
          rc_genere: rcGenere,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'tenant_id,membre_id,periode'
        });

      if (upsertError) {
        console.error('[RH HS] Erreur upsert:', upsertError);
      } else {
        resultats.push({
          membre_id: parseInt(membreId),
          heures_25: heures25,
          heures_50: heures50,
          montant_total: montant25 + montant50,
          cumul_annuel: cumulAnnuel,
          alerte_contingent: alerteContingent
        });
      }
    }

    res.json({
      success: true,
      periode,
      resultats
    });
  } catch (error) {
    console.error('[RH HS] Erreur calcul:', error);
    res.status(500).json({ error: 'Erreur calcul heures supplémentaires' });
  }
});

// Helper: numéro de semaine ISO
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ════════════════════════════════════════════════════════════════════
// PARAMETRES PAIE
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/rh/parametres-paie
 * Récupérer les paramètres de paie du tenant
 */
router.get('/parametres-paie', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;

    let { data: params, error } = await supabase
      .from('rh_parametres_paie')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) throw error;

    // Créer avec valeurs par défaut si n'existe pas
    if (!params) {
      const { data: newParams, error: insertError } = await supabase
        .from('rh_parametres_paie')
        .insert({ tenant_id: tenantId })
        .select()
        .single();

      if (insertError) throw insertError;
      params = newParams;
    }

    res.json(params);
  } catch (error) {
    console.error('[RH PARAMS] Erreur:', error);
    res.status(500).json({ error: 'Erreur récupération paramètres' });
  }
});

/**
 * PUT /api/admin/rh/parametres-paie
 * Mettre à jour les paramètres de paie
 */
router.put('/parametres-paie', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const updates = req.body;

    // Exclure les champs non modifiables
    delete updates.id;
    delete updates.tenant_id;

    updates.updated_at = new Date().toISOString();

    const { data: params, error } = await supabase
      .from('rh_parametres_paie')
      .upsert({
        tenant_id: tenantId,
        ...updates
      }, {
        onConflict: 'tenant_id'
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, params });
  } catch (error) {
    console.error('[RH PARAMS] Erreur mise à jour:', error);
    res.status(500).json({ error: 'Erreur mise à jour paramètres' });
  }
});

// ════════════════════════════════════════════════════════════════════
// BULLETINS DE PAIE
// ════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/rh/bulletins
 * Liste des bulletins de paie
 */
router.get('/bulletins', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { membre_id, periode, statut } = req.query;

    let query = supabase
      .from('rh_bulletins_paie')
      .select(`
        *,
        membre:rh_membres!rh_bulletins_paie_membre_id_fkey (
          id, nom, prenom
        )
      `)
      .eq('tenant_id', tenantId)
      .order('periode', { ascending: false });

    if (membre_id) query = query.eq('membre_id', membre_id);
    if (periode) query = query.eq('periode', periode);
    if (statut) query = query.eq('statut', statut);

    const { data: bulletins, error } = await query.limit(50);

    if (error) throw error;

    res.json({ bulletins: bulletins || [] });
  } catch (error) {
    console.error('[RH BULLETINS] Erreur liste:', error);
    res.status(500).json({ error: 'Erreur récupération bulletins' });
  }
});

/**
 * POST /api/admin/rh/bulletins/generer
 * Générer un bulletin de paie pour un employé et une période
 */
router.post('/bulletins/generer', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { membre_id, periode } = req.body;

    if (!membre_id || !periode) {
      return res.status(400).json({ error: 'membre_id et periode requis' });
    }

    // Récupérer infos employé
    const { data: membre, error: mError } = await supabase
      .from('rh_membres')
      .select('*')
      .eq('id', membre_id)
      .eq('tenant_id', tenantId)
      .single();

    if (mError || !membre) {
      return res.status(404).json({ error: 'Employé non trouvé' });
    }

    // Récupérer heures supplémentaires du mois
    const { data: heuresSupp } = await supabase
      .from('rh_heures_supp_mensuel')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('membre_id', membre_id)
      .eq('periode', periode)
      .maybeSingle();

    // Récupérer paramètres paie
    const { data: params } = await supabase
      .from('rh_parametres_paie')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const plafondSS = params?.plafond_ss_mensuel || TAUX_COTISATIONS.plafond_ss_mensuel; // 4005€ en 2026

    // Calcul du bulletin
    const salaireBrut = membre.salaire_mensuel || 0;
    const heuresNormales = membre.heures_mensuelles || 151.67;
    const hs25 = heuresSupp?.heures_25 || 0;
    const hs50 = heuresSupp?.heures_50 || 0;
    const montantHS25 = heuresSupp?.montant_25 || 0;
    const montantHS50 = heuresSupp?.montant_50 || 0;

    const brutTotal = salaireBrut + montantHS25 + montantHS50;

    // Calcul cotisations (taux 2025-2026 France)
    const baseSS = Math.min(brutTotal, plafondSS);
    const baseCSG = Math.round(brutTotal * 0.9825); // 98.25% du brut

    // Cotisations SALARIALES (taux 2026 - URSSAF)
    const cotisationsSalariales = [
      { nom: 'Sécurité sociale - Maladie', base: brutTotal, taux: TAUX_COTISATIONS.maladie_salarie, montant: 0 }, // 0% depuis 2018
      { nom: 'Sécurité sociale - Vieillesse (plafonnée)', base: baseSS, taux: TAUX_COTISATIONS.vieillesse_plafonnee_salarie, montant: Math.round(baseSS * TAUX_COTISATIONS.vieillesse_plafonnee_salarie / 100) },
      { nom: 'Sécurité sociale - Vieillesse (déplaf.)', base: brutTotal, taux: TAUX_COTISATIONS.vieillesse_deplafonnee_salarie, montant: Math.round(brutTotal * TAUX_COTISATIONS.vieillesse_deplafonnee_salarie / 100) },
      { nom: 'Retraite complémentaire T1', base: baseSS, taux: TAUX_COTISATIONS.retraite_t1_salarie, montant: Math.round(baseSS * TAUX_COTISATIONS.retraite_t1_salarie / 100) },
      { nom: 'CEG T1', base: baseSS, taux: TAUX_COTISATIONS.ceg_t1_salarie, montant: Math.round(baseSS * TAUX_COTISATIONS.ceg_t1_salarie / 100) },
      { nom: 'Assurance chômage', base: baseSS, taux: TAUX_COTISATIONS.chomage_salarie, montant: 0 }, // 0% salarié depuis 2019
      { nom: 'CSG déductible', base: baseCSG, taux: TAUX_COTISATIONS.csg_deductible, montant: Math.round(baseCSG * TAUX_COTISATIONS.csg_deductible / 100) },
      { nom: 'CSG non déductible', base: baseCSG, taux: TAUX_COTISATIONS.csg_non_deductible, montant: Math.round(baseCSG * TAUX_COTISATIONS.csg_non_deductible / 100) },
      { nom: 'CRDS', base: baseCSG, taux: TAUX_COTISATIONS.crds, montant: Math.round(baseCSG * TAUX_COTISATIONS.crds / 100) }
    ];

    // Cotisations PATRONALES (taux 2026 - URSSAF)
    const cotisationsPatronales = [
      { nom: 'Sécurité sociale - Maladie', base: brutTotal, taux: TAUX_COTISATIONS.maladie_employeur, montant: Math.round(brutTotal * TAUX_COTISATIONS.maladie_employeur / 100) },
      { nom: 'Sécurité sociale - Vieillesse (plafonnée)', base: baseSS, taux: TAUX_COTISATIONS.vieillesse_plafonnee_employeur, montant: Math.round(baseSS * TAUX_COTISATIONS.vieillesse_plafonnee_employeur / 100) },
      { nom: 'Sécurité sociale - Vieillesse (déplaf.)', base: brutTotal, taux: TAUX_COTISATIONS.vieillesse_deplafonnee_employeur, montant: Math.round(brutTotal * TAUX_COTISATIONS.vieillesse_deplafonnee_employeur / 100) },
      { nom: 'Allocations familiales', base: brutTotal, taux: TAUX_COTISATIONS.allocations_familiales_reduit, montant: Math.round(brutTotal * TAUX_COTISATIONS.allocations_familiales_reduit / 100) },
      { nom: 'Accidents du travail', base: brutTotal, taux: TAUX_COTISATIONS.accidents_travail, montant: Math.round(brutTotal * TAUX_COTISATIONS.accidents_travail / 100) },
      { nom: 'FNAL', base: baseSS, taux: TAUX_COTISATIONS.fnal_moins_50, montant: Math.round(baseSS * TAUX_COTISATIONS.fnal_moins_50 / 100) },
      { nom: 'CSA', base: brutTotal, taux: TAUX_COTISATIONS.csa, montant: Math.round(brutTotal * TAUX_COTISATIONS.csa / 100) },
      { nom: 'Retraite complémentaire T1', base: baseSS, taux: TAUX_COTISATIONS.retraite_t1_employeur, montant: Math.round(baseSS * TAUX_COTISATIONS.retraite_t1_employeur / 100) },
      { nom: 'CEG T1', base: baseSS, taux: TAUX_COTISATIONS.ceg_t1_employeur, montant: Math.round(baseSS * TAUX_COTISATIONS.ceg_t1_employeur / 100) },
      { nom: 'Assurance chômage', base: baseSS, taux: TAUX_COTISATIONS.chomage_employeur, montant: Math.round(baseSS * TAUX_COTISATIONS.chomage_employeur / 100) },
      { nom: 'AGS', base: baseSS, taux: TAUX_COTISATIONS.ags, montant: Math.round(baseSS * TAUX_COTISATIONS.ags / 100) },
      { nom: 'Formation professionnelle', base: brutTotal, taux: TAUX_COTISATIONS.formation_moins_11, montant: Math.round(brutTotal * TAUX_COTISATIONS.formation_moins_11 / 100) },
      { nom: 'Taxe d\'apprentissage', base: brutTotal, taux: TAUX_COTISATIONS.taxe_apprentissage, montant: Math.round(brutTotal * TAUX_COTISATIONS.taxe_apprentissage / 100) }
    ];

    const totalCotisationsSalariales = cotisationsSalariales.reduce((sum, c) => sum + c.montant, 0);
    const totalCotisationsPatronales = cotisationsPatronales.reduce((sum, c) => sum + c.montant, 0);
    const netAvantIR = brutTotal - totalCotisationsSalariales;

    // Prélèvement à la source (taux par défaut ou taux employé)
    const tauxIR = membre.taux_ir || params?.taux_ir_defaut || 0;
    const montantIR = Math.round(netAvantIR * (tauxIR / 100));
    const netAPayer = netAvantIR - montantIR;

    // Net imposable (sans CSG/CRDS non déductibles)
    const netImposable = netAvantIR + cotisationsSalariales.find(c => c.nom.includes('non déductible'))?.montant +
                         cotisationsSalariales.find(c => c.nom === 'CRDS')?.montant;

    // Récupérer compteur congés
    const annee = parseInt(periode.split('-')[0]);
    const { data: compteur } = await supabase
      .from('rh_compteurs_conges')
      .select('cp_acquis, cp_pris')
      .eq('tenant_id', tenantId)
      .eq('membre_id', membre_id)
      .eq('annee', annee)
      .maybeSingle();

    // Calculer ancienneté
    const dateEmbauche = new Date(membre.date_embauche);
    const datePeriode = new Date(periode + '-01');
    const ancienneteMois = Math.floor((datePeriode - dateEmbauche) / (1000 * 60 * 60 * 24 * 30.44));

    // Sauvegarder le bulletin
    const { data: bulletin, error: bError } = await supabase
      .from('rh_bulletins_paie')
      .upsert({
        tenant_id: tenantId,
        membre_id,
        periode,
        employe_nom: membre.nom,
        employe_prenom: membre.prenom,
        employe_nir: membre.nir,
        employe_adresse: [membre.adresse_rue, membre.adresse_cp, membre.adresse_ville].filter(Boolean).join(', '),
        employe_poste: membre.poste || membre.role,
        employe_classification: membre.classification_niveau,
        type_contrat: membre.type_contrat,
        date_embauche: membre.date_embauche,
        anciennete_mois: ancienneteMois,
        salaire_base: salaireBrut,
        heures_normales: heuresNormales,
        heures_supp_25: hs25,
        montant_hs_25: montantHS25,
        heures_supp_50: hs50,
        montant_hs_50: montantHS50,
        brut_total: brutTotal,
        cotisations_salariales: cotisationsSalariales,
        cotisations_patronales: cotisationsPatronales,
        total_cotisations_salariales: totalCotisationsSalariales,
        total_cotisations_patronales: totalCotisationsPatronales,
        net_avant_ir: netAvantIR,
        taux_ir: tauxIR,
        montant_ir: montantIR,
        net_a_payer: netAPayer,
        net_imposable: netImposable,
        cp_acquis: compteur?.cp_acquis || 0,
        cp_pris: compteur?.cp_pris || 0,
        cp_solde: (compteur?.cp_acquis || 0) - (compteur?.cp_pris || 0),
        statut: 'brouillon',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'tenant_id,membre_id,periode'
      })
      .select()
      .single();

    if (bError) throw bError;

    res.json({ success: true, bulletin });
  } catch (error) {
    console.error('[RH BULLETINS] Erreur génération:', error);
    res.status(500).json({ error: 'Erreur génération bulletin' });
  }
});

/**
 * PUT /api/admin/rh/bulletins/:id/valider
 * Valider un bulletin de paie
 */
router.put('/bulletins/:id/valider', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data: bulletin, error } = await supabase
      .from('rh_bulletins_paie')
      .update({
        statut: 'valide',
        valide_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, bulletin });
  } catch (error) {
    console.error('[RH BULLETINS] Erreur validation:', error);
    res.status(500).json({ error: 'Erreur validation bulletin' });
  }
});

/**
 * PUT /api/admin/rh/bulletins/:id/statut
 * Changer le statut d'un bulletin de paie
 */
router.put('/bulletins/:id/statut', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;
    const { statut } = req.body;

    const statutsValides = ['brouillon', 'valide', 'envoye'];
    if (!statutsValides.includes(statut)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    const updateData = {
      statut,
      updated_at: new Date().toISOString()
    };

    // Ajouter la date de validation si on passe en validé
    if (statut === 'valide') {
      updateData.valide_at = new Date().toISOString();
    }

    const { data: bulletin, error } = await supabase
      .from('rh_bulletins_paie')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, bulletin });
  } catch (error) {
    console.error('[RH BULLETINS] Erreur changement statut:', error);
    res.status(500).json({ error: 'Erreur changement statut bulletin' });
  }
});

/**
 * GET /api/admin/rh/bulletins/:id/pdf
 * Générer le PDF d'un bulletin de paie - Format simplifié français sur 1 page
 */
router.get('/bulletins/:id/pdf', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Récupérer le bulletin
    const { data: bulletin, error } = await supabase
      .from('rh_bulletins_paie')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !bulletin) {
      return res.status(404).json({ error: 'Bulletin non trouvé' });
    }

    // Récupérer les infos tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, settings')
      .eq('id', tenantId)
      .single();

    // Récupérer les paramètres DSN
    const { data: dsnParams } = await supabase
      .from('rh_dsn_parametres')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    // Helpers
    const fmt = (cents) => {
      if (!cents) return '0,00';
      const e = (cents / 100).toFixed(2).split('.');
      e[0] = e[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      return e.join(',');
    };
    const fmtE = (cents) => fmt(cents) + ' €';

    const formatPeriode = (p) => {
      const [y, m] = p.split('-');
      return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    };

    // Créer le document PDF
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const filename = `bulletin_${bulletin.employe_nom}_${bulletin.employe_prenom}_${bulletin.periode}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    doc.pipe(res);

    const W = doc.page.width - 80;
    const L = 40; // left margin
    let y = 35;

    // ===== TITRE =====
    doc.font('Helvetica-Bold').fontSize(16);
    doc.text('BULLETIN DE PAIE', L, y, { width: W, align: 'center' });
    y += 30;

    // ===== EN-TÊTE EMPLOYEUR / SALARIÉ =====
    doc.rect(L, y, W/2 - 10, 90).stroke('#ccc');
    doc.rect(L + W/2 + 10, y, W/2 - 10, 90).stroke('#ccc');

    // Employeur (gauche)
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('EMPLOYEUR', L + 8, y + 8);
    doc.font('Helvetica').fontSize(9);
    doc.text(dsnParams?.raison_sociale || tenant?.name || 'Entreprise', L + 8, y + 24, { width: W/2 - 25 });
    if (dsnParams?.siret) doc.text(`SIRET: ${dsnParams.siret}`, L + 8, y + 38);
    if (dsnParams?.code_naf) doc.text(`Code NAF: ${dsnParams.code_naf}`, L + 8, y + 52);
    const adresse = [dsnParams?.adresse_etablissement, `${dsnParams?.code_postal_etablissement || ''} ${dsnParams?.ville_etablissement || ''}`].filter(Boolean).join(', ');
    if (adresse.trim()) doc.text(adresse, L + 8, y + 66, { width: W/2 - 25 });

    // Salarié (droite)
    const R = L + W/2 + 18;
    doc.font('Helvetica-Bold').fontSize(10);
    doc.text('SALARIÉ', R, y + 8);
    doc.font('Helvetica').fontSize(9);
    doc.text(`${bulletin.employe_prenom || ''} ${bulletin.employe_nom || ''}`, R, y + 24);
    doc.text(`N° Sécurité sociale: ${bulletin.employe_nir || '-'}`, R, y + 38);
    doc.text(`Emploi: ${bulletin.employe_poste || '-'}`, R, y + 52);
    doc.text(`Contrat: ${bulletin.type_contrat?.toUpperCase() || 'CDI'}`, R, y + 66);
    if (bulletin.date_embauche) doc.text(`Entrée: ${new Date(bulletin.date_embauche).toLocaleDateString('fr-FR')}`, R + 100, y + 66);

    y += 100;

    // ===== PÉRIODE =====
    doc.rect(L, y, W, 28).fill('#f8f9fa').stroke('#dee2e6');
    doc.fill('#000').font('Helvetica-Bold').fontSize(12);
    doc.text(`Période: ${formatPeriode(bulletin.periode).toUpperCase()}`, L + 10, y + 8, { width: W - 20, align: 'center' });
    y += 38;

    // ===== RÉMUNÉRATION BRUTE =====
    doc.rect(L, y, W, 22).fill('#e9ecef').stroke('#dee2e6');
    doc.fill('#000').font('Helvetica-Bold').fontSize(9);
    doc.text('RÉMUNÉRATION', L + 8, y + 6);
    doc.text('Base', L + 260, y + 6, { width: 60, align: 'right' });
    doc.text('Taux', L + 330, y + 6, { width: 50, align: 'right' });
    doc.text('Salarié', L + 390, y + 6, { width: 60, align: 'right' });
    doc.text('Employeur', L + 455, y + 6, { width: 60, align: 'right' });
    y += 22;

    doc.font('Helvetica').fontSize(9);

    // Salaire de base
    doc.text('Salaire de base', L + 8, y + 6);
    doc.text(`${bulletin.heures_normales || 151.67} h`, L + 260, y + 6, { width: 60, align: 'right' });
    doc.text(fmtE(bulletin.salaire_base), L + 390, y + 6, { width: 60, align: 'right' });
    y += 18;

    // Heures supp
    if (bulletin.heures_supp_25 > 0) {
      doc.text('Heures supplémentaires 25%', L + 8, y + 6);
      doc.text(`${bulletin.heures_supp_25} h`, L + 260, y + 6, { width: 60, align: 'right' });
      doc.text('125%', L + 330, y + 6, { width: 50, align: 'right' });
      doc.text(fmtE(bulletin.montant_hs_25), L + 390, y + 6, { width: 60, align: 'right' });
      y += 18;
    }
    if (bulletin.heures_supp_50 > 0) {
      doc.text('Heures supplémentaires 50%', L + 8, y + 6);
      doc.text(`${bulletin.heures_supp_50} h`, L + 260, y + 6, { width: 60, align: 'right' });
      doc.text('150%', L + 330, y + 6, { width: 50, align: 'right' });
      doc.text(fmtE(bulletin.montant_hs_50), L + 390, y + 6, { width: 60, align: 'right' });
      y += 18;
    }

    // Total brut
    y += 4;
    doc.rect(L, y, W, 20).fill('#d4edda').stroke('#28a745');
    doc.fill('#000').font('Helvetica-Bold').fontSize(10);
    doc.text('SALAIRE BRUT', L + 8, y + 5);
    doc.text(fmtE(bulletin.brut_total), L + 390, y + 5, { width: 60, align: 'right' });
    y += 28;

    // ===== COTISATIONS =====
    doc.rect(L, y, W, 22).fill('#e9ecef').stroke('#dee2e6');
    doc.fill('#000').font('Helvetica-Bold').fontSize(9);
    doc.text('COTISATIONS ET CONTRIBUTIONS', L + 8, y + 6);
    doc.text('Base', L + 260, y + 6, { width: 60, align: 'right' });
    doc.text('Taux S/P', L + 330, y + 6, { width: 50, align: 'right' });
    doc.text('Salarié', L + 390, y + 6, { width: 60, align: 'right' });
    doc.text('Employeur', L + 455, y + 6, { width: 60, align: 'right' });
    y += 22;

    const brut = bulletin.brut_total || 0;
    const plafond = 400500; // PMSS 2026
    const basePlaf = Math.min(brut, plafond);
    const baseCSG = Math.round(brut * 0.9825);

    // Cotisations groupées par catégorie - Taux 2026
    const categories = [
      { nom: 'Santé - Maladie, maternité, invalidité, décès', base: brut, txS: 0, txP: 7.00 },
      { nom: 'Accidents du travail - Maladies professionnelles', base: brut, txS: 0, txP: 2.08 },
      { nom: 'Retraite Sécurité sociale plafonnée', base: basePlaf, txS: 6.90, txP: 8.55 },
      { nom: 'Retraite Sécurité sociale déplafonnée', base: brut, txS: 0.40, txP: 2.11 },
      { nom: 'Retraite complémentaire Tranche 1', base: basePlaf, txS: 3.15, txP: 4.72 },
      { nom: 'Famille', base: brut, txS: 0, txP: 3.45 },
      { nom: 'Assurance chômage', base: basePlaf, txS: 0, txP: 4.05 },
      { nom: 'AGS (garantie salaires)', base: basePlaf, txS: 0, txP: 0.20 },
      { nom: 'CSG déductible de l\'impôt sur le revenu', base: baseCSG, txS: 6.80, txP: 0 },
      { nom: 'CSG/CRDS non déductible', base: baseCSG, txS: 2.90, txP: 0 },
      { nom: 'FNAL, formation professionnelle, autres', base: brut, txS: 0, txP: 1.38 }
    ];

    let totalS = 0, totalP = 0;
    doc.font('Helvetica').fontSize(8);
    for (const cat of categories) {
      const mS = Math.round(cat.base * cat.txS / 100);
      const mP = Math.round(cat.base * cat.txP / 100);
      totalS += mS;
      totalP += mP;

      doc.text(cat.nom, L + 8, y + 5, { width: 245 });
      doc.text(fmt(cat.base), L + 260, y + 5, { width: 60, align: 'right' });
      const taux = cat.txS > 0 && cat.txP > 0 ? `${cat.txS}/${cat.txP}` : (cat.txS > 0 ? `${cat.txS}` : `${cat.txP}`);
      doc.text(taux + '%', L + 330, y + 5, { width: 50, align: 'right' });
      doc.text(mS > 0 ? fmt(mS) : '-', L + 390, y + 5, { width: 60, align: 'right' });
      doc.text(mP > 0 ? fmt(mP) : '-', L + 455, y + 5, { width: 60, align: 'right' });
      y += 16;
    }

    // Total cotisations
    y += 2;
    doc.rect(L, y, W, 20).fill('#f8d7da').stroke('#dc3545');
    doc.fill('#000').font('Helvetica-Bold').fontSize(9);
    doc.text('TOTAL COTISATIONS', L + 8, y + 5);
    doc.text(fmtE(totalS), L + 390, y + 5, { width: 60, align: 'right' });
    doc.text(fmtE(totalP), L + 455, y + 5, { width: 60, align: 'right' });
    y += 28;

    // ===== MONTANT NET SOCIAL =====
    doc.rect(L, y, W, 22).fill('#e7f1ff').stroke('#0d6efd');
    doc.fill('#000').font('Helvetica-Bold').fontSize(10);
    const netSocial = brut - totalS;
    doc.text('MONTANT NET SOCIAL', L + 8, y + 6);
    doc.text(fmtE(netSocial), L + 390, y + 6, { width: 60, align: 'right' });
    y += 30;

    // ===== NET AVANT IMPÔT =====
    const netAvantIR = bulletin.net_avant_ir || netSocial;
    doc.rect(L, y, W, 22).fill('#cce5ff').stroke('#0d6efd');
    doc.fill('#000').font('Helvetica-Bold').fontSize(10);
    doc.text('NET À PAYER AVANT IMPÔT SUR LE REVENU', L + 8, y + 6);
    doc.text(fmtE(netAvantIR), L + 390, y + 6, { width: 60, align: 'right' });
    y += 28;

    // ===== IMPÔT SUR LE REVENU =====
    const tauxIR = bulletin.taux_ir || 0;
    const montantIR = bulletin.montant_ir || 0;
    doc.font('Helvetica').fontSize(9);
    doc.text(`Impôt sur le revenu - Prélèvement à la source (${tauxIR}%)`, L + 8, y + 4);
    doc.text(montantIR > 0 ? `- ${fmtE(montantIR)}` : '-', L + 390, y + 4, { width: 60, align: 'right' });
    y += 20;

    // ===== NET À PAYER =====
    const netAPayer = bulletin.net_a_payer || (netAvantIR - montantIR);
    doc.rect(L, y, W, 28).fill('#198754').stroke('#198754');
    doc.fill('#fff').font('Helvetica-Bold').fontSize(14);
    doc.text('NET À PAYER', L + 10, y + 7);
    doc.text(fmtE(netAPayer), L + 380, y + 7, { width: 80, align: 'right' });
    y += 36;

    // ===== COÛT EMPLOYEUR =====
    const coutEmployeur = brut + totalP;
    doc.fill('#000').font('Helvetica').fontSize(9);
    doc.text(`Total versé par l'employeur (brut + charges patronales): ${fmtE(coutEmployeur)}`, L + 8, y + 4);
    y += 25;

    // ===== CUMULS & CONGÉS =====
    doc.rect(L, y, W/2 - 10, 50).stroke('#dee2e6');
    doc.rect(L + W/2 + 10, y, W/2 - 10, 50).stroke('#dee2e6');

    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('CUMULS ANNUELS', L + 8, y + 8);
    doc.font('Helvetica').fontSize(8);
    doc.text(`Brut cumulé: ${fmtE(bulletin.cumul_brut || brut)}`, L + 8, y + 24);
    doc.text(`Net imposable cumulé: ${fmtE(bulletin.cumul_net_imposable || netAvantIR)}`, L + 8, y + 38);

    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('CONGÉS PAYÉS', L + W/2 + 18, y + 8);
    doc.font('Helvetica').fontSize(8);
    doc.text(`Acquis: ${bulletin.cp_acquis || 0} jours`, L + W/2 + 18, y + 24);
    doc.text(`Pris: ${bulletin.cp_pris || 0} jours`, L + W/2 + 100, y + 24);
    doc.text(`Solde: ${bulletin.cp_solde || 0} jours`, L + W/2 + 18, y + 38);
    y += 60;

    // ===== MENTIONS LÉGALES =====
    doc.rect(L, y, W, 55).stroke('#ccc');
    doc.font('Helvetica').fontSize(7).fillColor('#555');
    doc.text('Dans votre intérêt, conservez ce bulletin de paie sans limitation de durée.', L + 8, y + 8, { width: W - 16 });
    doc.text('Le montant net social correspond au revenu net après déduction de l\'ensemble des prélèvements sociaux obligatoires. Plus d\'informations sur www.mesdroitssociaux.gouv.fr', L + 8, y + 20, { width: W - 16 });
    doc.text('Pour toute question concernant ce bulletin, adressez-vous au service des ressources humaines.', L + 8, y + 36, { width: W - 16 });
    doc.fontSize(6).fillColor('#888');
    doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} | NEXUS SIRH | Plafond mensuel Sécurité sociale 2026: 4 005 €`, L + 8, y + 46, { width: W - 16 });

    doc.end();

  } catch (error) {
    console.error('[RH BULLETINS] Erreur génération PDF:', error);
    res.status(500).json({ error: 'Erreur génération PDF' });
  }
});

// ============================================
// DOCUMENTS RH
// ============================================

/**
 * Liste des modèles de documents disponibles
 * GET /rh/documents/modeles
 */
router.get('/documents/modeles', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'tenant_id requis' });
    }

    const modeles = await getOrCreateModeles(tenantId);
    res.json(modeles);
  } catch (error) {
    console.error('[RH DOCUMENTS] Erreur liste modèles:', error);
    res.status(500).json({ error: 'Erreur récupération modèles' });
  }
});

/**
 * Types de documents disponibles
 * GET /rh/documents/types
 */
router.get('/documents/types', authenticateAdmin, async (req, res) => {
  try {
    res.json(Object.keys(MODELES_DEFAUT).map(type => ({
      type,
      nom: MODELES_DEFAUT[type].nom,
      description: MODELES_DEFAUT[type].description,
      variables: MODELES_DEFAUT[type].variables
    })));
  } catch (error) {
    console.error('[RH DOCUMENTS] Erreur liste types:', error);
    res.status(500).json({ error: 'Erreur récupération types' });
  }
});

/**
 * Documents d'un membre
 * GET /rh/membres/:id/documents
 */
router.get('/membres/:id/documents', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'tenant_id requis' });
    }

    const membreId = parseInt(req.params.id);

    const { data: documents, error } = await supabase
      .from('rh_documents')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('membre_id', membreId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(documents || []);
  } catch (error) {
    console.error('[RH DOCUMENTS] Erreur liste documents membre:', error);
    res.status(500).json({ error: 'Erreur récupération documents' });
  }
});

/**
 * Liste tous les documents
 * GET /rh/documents
 */
router.get('/documents', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id || req.tenantId;
    console.log('[RH DOCUMENTS] GET /documents - tenantId:', tenantId);
    if (!tenantId) {
      return res.status(403).json({ error: 'tenant_id requis' });
    }

    const { type, statut, membre_id, limit = 50 } = req.query;

    let query = supabase
      .from('rh_documents')
      .select(`
        *,
        membre:membre_id (
          id, nom, prenom, email
        )
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (type) query = query.eq('type', type);
    if (statut) query = query.eq('statut', statut);
    if (membre_id) query = query.eq('membre_id', parseInt(membre_id));

    const { data: documents, error } = await query;

    if (error) throw error;

    res.json(documents || []);
  } catch (error) {
    console.error('[RH DOCUMENTS] Erreur liste documents:', error);
    res.status(500).json({ error: 'Erreur récupération documents' });
  }
});

/**
 * Générer un document
 * POST /rh/documents/generer
 */
router.post('/documents/generer', authenticateAdmin, async (req, res) => {
  console.log('[RH DOCUMENTS] POST /documents/generer - body:', req.body);
  try {
    const tenantId = req.admin?.tenant_id || req.tenantId;
    console.log('[RH DOCUMENTS] tenantId:', tenantId);
    if (!tenantId) {
      return res.status(403).json({ error: 'tenant_id requis' });
    }

    const { membre_id, type, donnees_supplementaires } = req.body;
    console.log('[RH DOCUMENTS] membre_id:', membre_id, 'type:', type);

    if (!membre_id || !type) {
      return res.status(400).json({ error: 'membre_id et type requis' });
    }

    // Vérifier que le type est valide
    if (!MODELES_DEFAUT[type]) {
      return res.status(400).json({ error: `Type de document invalide: ${type}` });
    }

    // Récupérer les infos du membre
    const { data: membre, error: errMembre } = await supabase
      .from('rh_membres')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', membre_id)
      .single();

    if (errMembre || !membre) {
      return res.status(404).json({ error: 'Membre non trouvé' });
    }

    // Générer le document (le service récupère les params entreprise lui-même)
    const result = await genererDocument(tenantId, type, membre_id, donnees_supplementaires || {});

    res.json({
      success: true,
      document: result.document
    });
  } catch (error) {
    console.error('[RH DOCUMENTS] Erreur génération:', error);
    res.status(500).json({ error: 'Erreur génération document' });
  }
});

/**
 * Récupérer un document spécifique
 * GET /rh/documents/:id
 */
router.get('/documents/:id', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'tenant_id requis' });
    }

    const documentId = parseInt(req.params.id);

    const { data: document, error } = await supabase
      .from('rh_documents')
      .select(`
        *,
        membre:membre_id (
          id, nom, prenom, email
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('id', documentId)
      .single();

    if (error || !document) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    res.json(document);
  } catch (error) {
    console.error('[RH DOCUMENTS] Erreur récupération:', error);
    res.status(500).json({ error: 'Erreur récupération document' });
  }
});

/**
 * Télécharger le PDF d'un document
 * GET /rh/documents/:id/pdf
 */
router.get('/documents/:id/pdf', authenticateAdmin, async (req, res) => {
  console.log('[RH DOCUMENTS] GET /documents/:id/pdf - id:', req.params.id);
  try {
    const tenantId = req.admin?.tenant_id || req.tenantId;
    console.log('[RH DOCUMENTS] PDF tenantId:', tenantId);
    if (!tenantId) {
      return res.status(403).json({ error: 'tenant_id requis' });
    }

    const documentId = parseInt(req.params.id);

    // Récupérer le document
    const { data: document, error } = await supabase
      .from('rh_documents')
      .select(`
        *,
        membre:membre_id (
          id, nom, prenom, email, date_naissance, nir,
          date_embauche, poste, type_contrat,
          salaire_mensuel, heures_hebdo,
          adresse_rue, adresse_cp, adresse_ville
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('id', documentId)
      .single();

    console.log('[RH DOCUMENTS] Document trouvé:', document ? 'oui' : 'non', 'error:', error);
    if (error || !document) {
      console.log('[RH DOCUMENTS] 404 - Document non trouvé');
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    // Si donnees stockées, régénérer le PDF à partir de celles-ci
    console.log('[RH DOCUMENTS] Donnees:', document.donnees ? 'présentes' : 'absentes');
    if (!document.donnees) {
      console.log('[RH DOCUMENTS] 400 - Données non disponibles');
      return res.status(400).json({ error: 'Données du document non disponibles' });
    }

    // Régénérer le PDF
    console.log('[RH DOCUMENTS] Génération PDF pour type:', document.type);
    const pdfBuffer = await regenererPDF(document.type, document.donnees);
    console.log('[RH DOCUMENTS] PDF généré, taille:', pdfBuffer?.length);

    // Envoyer le PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${document.fichier_nom || `document_${documentId}.pdf`}"`);
    console.log('[RH DOCUMENTS] Envoi du PDF...');
    res.send(pdfBuffer);

  } catch (error) {
    console.error('[RH DOCUMENTS] Erreur téléchargement PDF:', error);
    res.status(500).json({ error: 'Erreur téléchargement PDF' });
  }
});

/**
 * Mettre à jour le statut d'un document
 * PATCH /rh/documents/:id
 */
router.patch('/documents/:id', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'tenant_id requis' });
    }

    const documentId = parseInt(req.params.id);
    const updates = {};

    // Champs modifiables
    const allowedFields = [
      'statut', 'notes',
      'signe_employeur', 'date_signature_employeur',
      'signe_salarie', 'date_signature_salarie',
      'envoye_par_email', 'date_envoi', 'email_destinataire'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }

    updates.updated_at = new Date().toISOString();

    const { data: document, error } = await supabase
      .from('rh_documents')
      .update(updates)
      .eq('tenant_id', tenantId)
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;

    res.json(document);
  } catch (error) {
    console.error('[RH DOCUMENTS] Erreur mise à jour:', error);
    res.status(500).json({ error: 'Erreur mise à jour document' });
  }
});

/**
 * Supprimer un document (brouillon uniquement)
 * DELETE /rh/documents/:id
 */
router.delete('/documents/:id', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'tenant_id requis' });
    }

    const documentId = parseInt(req.params.id);

    // Vérifier que le document est en brouillon
    const { data: existing, error: errCheck } = await supabase
      .from('rh_documents')
      .select('statut')
      .eq('tenant_id', tenantId)
      .eq('id', documentId)
      .single();

    if (errCheck || !existing) {
      return res.status(404).json({ error: 'Document non trouvé' });
    }

    if (existing.statut !== 'brouillon') {
      return res.status(400).json({ error: 'Seuls les documents en brouillon peuvent être supprimés' });
    }

    const { error } = await supabase
      .from('rh_documents')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('id', documentId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('[RH DOCUMENTS] Erreur suppression:', error);
    res.status(500).json({ error: 'Erreur suppression document' });
  }
});

// ============================================
// DPAE (Déclaration Préalable à l'Embauche)
// ============================================

/**
 * Liste des DPAE
 * GET /rh/dpae
 */
router.get('/dpae', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'tenant_id requis' });
    }

    const { statut, limit = 50 } = req.query;

    let query = supabase
      .from('rh_dpae')
      .select(`
        *,
        membre:membre_id (
          id, nom, prenom, email, date_embauche, type_contrat
        )
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (statut) query = query.eq('statut', statut);

    const { data: dpaeList, error } = await query;

    if (error) throw error;

    res.json(dpaeList || []);
  } catch (error) {
    console.error('[RH DPAE] Erreur liste:', error);
    res.status(500).json({ error: 'Erreur récupération DPAE' });
  }
});

/**
 * Créer une DPAE
 * POST /rh/dpae
 */
router.post('/dpae', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'tenant_id requis' });
    }

    const {
      membre_id,
      date_embauche,
      heure_embauche,
      type_contrat,
      duree_periode_essai,
      notes
    } = req.body;

    if (!membre_id || !date_embauche || !type_contrat) {
      return res.status(400).json({ error: 'membre_id, date_embauche et type_contrat requis' });
    }

    // Vérifier si DPAE existe déjà pour ce membre et cette date
    const { data: existing } = await supabase
      .from('rh_dpae')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('membre_id', membre_id)
      .eq('date_embauche', date_embauche)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Une DPAE existe déjà pour ce membre à cette date' });
    }

    const { data: dpae, error } = await supabase
      .from('rh_dpae')
      .insert({
        tenant_id: tenantId,
        membre_id,
        date_embauche,
        heure_embauche: heure_embauche || '09:00',
        type_contrat,
        duree_periode_essai: duree_periode_essai || null,
        notes: notes || null,
        statut: 'a_declarer'
      })
      .select()
      .single();

    if (error) throw error;

    // Générer le document DPAE associé
    try {
      await genererDocument(tenantId, 'dpae', membre_id, {
        date_embauche,
        heure_embauche: heure_embauche || '09:00',
        type_contrat,
        duree_periode_essai
      });
    } catch (docErr) {
      console.error('[RH DPAE] Erreur génération document DPAE:', docErr);
      // On ne bloque pas la création de la DPAE si le document échoue
    }

    res.json(dpae);
  } catch (error) {
    console.error('[RH DPAE] Erreur création:', error);
    res.status(500).json({ error: 'Erreur création DPAE' });
  }
});

/**
 * Mettre à jour une DPAE
 * PATCH /rh/dpae/:id
 */
router.patch('/dpae/:id', authenticateAdmin, async (req, res) => {
  try {
    const tenantId = req.admin?.tenant_id || req.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'tenant_id requis' });
    }

    const dpaeId = parseInt(req.params.id);
    const updates = {};

    const allowedFields = [
      'statut', 'numero_declaration', 'date_declaration',
      'accuse_reception_url', 'notes'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
    }

    updates.updated_at = new Date().toISOString();

    const { data: dpae, error } = await supabase
      .from('rh_dpae')
      .update(updates)
      .eq('tenant_id', tenantId)
      .eq('id', dpaeId)
      .select()
      .single();

    if (error) throw error;

    res.json(dpae);
  } catch (error) {
    console.error('[RH DPAE] Erreur mise à jour:', error);
    res.status(500).json({ error: 'Erreur mise à jour DPAE' });
  }
});

export default router;
