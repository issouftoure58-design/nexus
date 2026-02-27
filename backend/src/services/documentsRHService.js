/**
 * Service de génération de documents RH
 * DPAE, Contrats, Certificats, Attestations
 */

import PDFDocument from 'pdfkit';
import { supabase } from '../config/supabase.js';

// ============================================
// MODÈLES DE DOCUMENTS PAR DÉFAUT
// ============================================

const MODELES_DEFAUT = {
  dpae: {
    nom: 'Déclaration Préalable à l\'Embauche (DPAE)',
    description: 'Déclaration obligatoire avant toute embauche',
    variables: [
      { nom: 'employeur_raison_sociale', description: 'Raison sociale de l\'entreprise' },
      { nom: 'employeur_siret', description: 'SIRET de l\'établissement' },
      { nom: 'employeur_adresse', description: 'Adresse de l\'établissement' },
      { nom: 'salarie_nom', description: 'Nom du salarié' },
      { nom: 'salarie_prenom', description: 'Prénom du salarié' },
      { nom: 'salarie_nir', description: 'Numéro de sécurité sociale' },
      { nom: 'salarie_date_naissance', description: 'Date de naissance' },
      { nom: 'date_embauche', description: 'Date d\'embauche' },
      { nom: 'heure_embauche', description: 'Heure d\'embauche' },
      { nom: 'type_contrat', description: 'Type de contrat' }
    ]
  },

  contrat_cdi: {
    nom: 'Contrat de travail à durée indéterminée (CDI)',
    description: 'Contrat CDI standard',
    variables: [
      { nom: 'employeur_raison_sociale', description: 'Raison sociale' },
      { nom: 'employeur_siret', description: 'SIRET' },
      { nom: 'employeur_adresse', description: 'Adresse' },
      { nom: 'salarie_nom', description: 'Nom du salarié' },
      { nom: 'salarie_prenom', description: 'Prénom' },
      { nom: 'salarie_adresse', description: 'Adresse du salarié' },
      { nom: 'salarie_nir', description: 'N° SS' },
      { nom: 'poste', description: 'Intitulé du poste' },
      { nom: 'classification', description: 'Classification conventionnelle' },
      { nom: 'date_debut', description: 'Date de début' },
      { nom: 'salaire_brut', description: 'Salaire mensuel brut' },
      { nom: 'heures_hebdo', description: 'Heures hebdomadaires' },
      { nom: 'periode_essai', description: 'Durée période d\'essai' },
      { nom: 'convention_collective', description: 'Convention collective applicable' },
      { nom: 'lieu_travail', description: 'Lieu de travail' }
    ]
  },

  contrat_cdd: {
    nom: 'Contrat de travail à durée déterminée (CDD)',
    description: 'Contrat CDD avec motif de recours',
    variables: [
      { nom: 'employeur_raison_sociale', description: 'Raison sociale' },
      { nom: 'employeur_siret', description: 'SIRET' },
      { nom: 'salarie_nom', description: 'Nom' },
      { nom: 'salarie_prenom', description: 'Prénom' },
      { nom: 'poste', description: 'Poste' },
      { nom: 'date_debut', description: 'Date de début' },
      { nom: 'date_fin', description: 'Date de fin' },
      { nom: 'motif_recours', description: 'Motif du CDD' },
      { nom: 'salaire_brut', description: 'Salaire brut' },
      { nom: 'prime_precarite', description: 'Prime de précarité (10%)' }
    ]
  },

  certificat_travail: {
    nom: 'Certificat de travail',
    description: 'Document obligatoire remis à la fin du contrat',
    variables: [
      { nom: 'employeur_raison_sociale', description: 'Raison sociale' },
      { nom: 'employeur_siret', description: 'SIRET' },
      { nom: 'employeur_adresse', description: 'Adresse' },
      { nom: 'salarie_nom', description: 'Nom' },
      { nom: 'salarie_prenom', description: 'Prénom' },
      { nom: 'date_entree', description: 'Date d\'entrée' },
      { nom: 'date_sortie', description: 'Date de sortie' },
      { nom: 'postes_occupes', description: 'Liste des postes occupés' },
      { nom: 'solde_cp', description: 'Solde de congés payés' }
    ]
  },

  attestation_employeur: {
    nom: 'Attestation employeur',
    description: 'Attestation de travail pour démarches administratives',
    variables: [
      { nom: 'employeur_raison_sociale', description: 'Raison sociale' },
      { nom: 'employeur_siret', description: 'SIRET' },
      { nom: 'salarie_nom', description: 'Nom' },
      { nom: 'salarie_prenom', description: 'Prénom' },
      { nom: 'poste', description: 'Poste actuel' },
      { nom: 'date_embauche', description: 'Date d\'embauche' },
      { nom: 'type_contrat', description: 'Type de contrat' },
      { nom: 'salaire_brut', description: 'Salaire mensuel brut' }
    ]
  },

  solde_tout_compte: {
    nom: 'Reçu pour solde de tout compte',
    description: 'Document récapitulatif des sommes versées à la fin du contrat',
    variables: [
      { nom: 'employeur_raison_sociale', description: 'Raison sociale' },
      { nom: 'salarie_nom', description: 'Nom' },
      { nom: 'salarie_prenom', description: 'Prénom' },
      { nom: 'date_sortie', description: 'Date de sortie' },
      { nom: 'salaire_du', description: 'Salaire restant dû' },
      { nom: 'indemnite_cp', description: 'Indemnité compensatrice CP' },
      { nom: 'indemnite_preavis', description: 'Indemnité de préavis' },
      { nom: 'indemnite_licenciement', description: 'Indemnité de licenciement' },
      { nom: 'prime_precarite', description: 'Prime de précarité (CDD)' },
      { nom: 'total', description: 'Total net à payer' }
    ]
  }
};

/**
 * Récupère ou crée les modèles par défaut pour un tenant
 */
export async function getOrCreateModeles(tenantId) {
  const { data: existing } = await supabase
    .from('rh_documents_modeles')
    .select('type')
    .eq('tenant_id', tenantId);

  const typesExistants = new Set((existing || []).map(m => m.type));
  const modeles = [];

  for (const [type, config] of Object.entries(MODELES_DEFAUT)) {
    if (!typesExistants.has(type)) {
      // Créer le modèle par défaut
      const { data: nouveau } = await supabase
        .from('rh_documents_modeles')
        .insert({
          tenant_id: tenantId,
          type,
          nom: config.nom,
          description: config.description,
          variables: config.variables,
          contenu_html: '' // Sera généré à la demande
        })
        .select()
        .single();

      if (nouveau) modeles.push(nouveau);
    }
  }

  // Récupérer tous les modèles
  const { data: tous } = await supabase
    .from('rh_documents_modeles')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('actif', true);

  return tous || [];
}

/**
 * Génère un document PDF
 */
export async function genererDocument(tenantId, type, membreId, options = {}) {
  // Récupérer les infos du membre
  const { data: membre, error: errMembre } = await supabase
    .from('rh_membres')
    .select('*')
    .eq('id', membreId)
    .eq('tenant_id', tenantId)
    .single();

  if (errMembre || !membre) {
    throw new Error('Membre non trouvé');
  }

  // Récupérer les infos entreprise
  const { data: dsnParams } = await supabase
    .from('rh_dsn_parametres')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, settings')
    .eq('id', tenantId)
    .single();

  // Préparer les données
  const donnees = preparerDonnees(type, membre, dsnParams, tenant, options);

  // Générer le PDF selon le type
  const pdfBuffer = await genererPDF(type, donnees);

  // Sauvegarder le document
  const titre = genererTitre(type, membre);
  const fichierNom = `${type}_${membre.nom}_${membre.prenom}_${new Date().toISOString().split('T')[0]}.pdf`;

  const { data: doc, error: errDoc } = await supabase
    .from('rh_documents')
    .insert({
      tenant_id: tenantId,
      membre_id: membreId,
      type,
      titre,
      fichier_nom: fichierNom,
      donnees,
      statut: 'brouillon',
      date_document: new Date().toISOString().split('T')[0],
      date_effet: options.date_effet || null,
      genere_par: options.genere_par || null
    })
    .select()
    .single();

  if (errDoc) {
    throw new Error('Erreur sauvegarde document: ' + errDoc.message);
  }

  return {
    document: doc,
    pdf: pdfBuffer
  };
}

/**
 * Prépare les données pour le document
 */
function preparerDonnees(type, membre, dsnParams, tenant, options) {
  const entreprise = {
    raison_sociale: dsnParams?.raison_sociale || tenant?.name || 'Entreprise',
    siret: dsnParams?.siret || '',
    adresse: [
      dsnParams?.adresse_etablissement || dsnParams?.adresse_siege,
      `${dsnParams?.code_postal_etablissement || dsnParams?.code_postal_siege || ''} ${dsnParams?.ville_etablissement || dsnParams?.ville_siege || ''}`
    ].filter(Boolean).join(', '),
    convention: dsnParams?.convention_libelle || ''
  };

  const salarie = {
    nom: membre.nom || '',
    prenom: membre.prenom || '',
    nom_complet: `${membre.prenom || ''} ${membre.nom || ''}`.trim(),
    nir: membre.nir || '',
    date_naissance: formatDate(membre.date_naissance),
    adresse: [
      membre.adresse_rue,
      `${membre.adresse_cp || ''} ${membre.adresse_ville || ''}`
    ].filter(Boolean).join(', '),
    email: membre.email || '',
    telephone: membre.telephone || ''
  };

  const contrat = {
    type: membre.type_contrat || 'cdi',
    type_label: getTypeContratLabel(membre.type_contrat),
    date_debut: formatDate(membre.date_embauche),
    date_fin: formatDate(membre.date_fin_contrat),
    poste: membre.poste || membre.role || '',
    classification: membre.classification_niveau || '',
    salaire_brut: formatMontant(membre.salaire_base),
    heures_hebdo: membre.heures_hebdo || 35,
    heures_mensuelles: membre.heures_mensuelles || 151.67,
    lieu_travail: entreprise.adresse
  };

  return {
    entreprise,
    salarie,
    contrat,
    date_generation: formatDate(new Date()),
    ...options.donnees_supplementaires
  };
}

/**
 * Génère le PDF du document
 */
async function genererPDF(type, donnees) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 100;
    let y = 50;

    // En-tête entreprise
    doc.font('Helvetica-Bold').fontSize(14);
    doc.text(donnees.entreprise.raison_sociale, 50, y);
    y += 20;
    doc.font('Helvetica').fontSize(10);
    if (donnees.entreprise.siret) doc.text(`SIRET: ${donnees.entreprise.siret}`, 50, y);
    y += 15;
    if (donnees.entreprise.adresse) doc.text(donnees.entreprise.adresse, 50, y, { width: W/2 });
    y += 40;

    // Titre du document
    const titres = {
      dpae: 'DÉCLARATION PRÉALABLE À L\'EMBAUCHE',
      contrat_cdi: 'CONTRAT DE TRAVAIL À DURÉE INDÉTERMINÉE',
      contrat_cdd: 'CONTRAT DE TRAVAIL À DURÉE DÉTERMINÉE',
      certificat_travail: 'CERTIFICAT DE TRAVAIL',
      attestation_employeur: 'ATTESTATION EMPLOYEUR',
      solde_tout_compte: 'REÇU POUR SOLDE DE TOUT COMPTE'
    };

    doc.font('Helvetica-Bold').fontSize(16);
    doc.text(titres[type] || type.toUpperCase(), 50, y, { width: W, align: 'center' });
    y += 40;

    // Contenu selon le type
    doc.font('Helvetica').fontSize(11);

    switch (type) {
      case 'dpae':
        genererDPAE(doc, donnees, y, W);
        break;
      case 'contrat_cdi':
        genererContratCDI(doc, donnees, y, W);
        break;
      case 'contrat_cdd':
        genererContratCDD(doc, donnees, y, W);
        break;
      case 'certificat_travail':
        genererCertificatTravail(doc, donnees, y, W);
        break;
      case 'attestation_employeur':
        genererAttestationEmployeur(doc, donnees, y, W);
        break;
      case 'solde_tout_compte':
        genererSoldeToutCompte(doc, donnees, y, W);
        break;
      default:
        doc.text('Document non pris en charge', 50, y);
    }

    doc.end();
  });
}

// ============================================
// GÉNÉRATEURS DE DOCUMENTS SPÉCIFIQUES
// ============================================

function genererDPAE(doc, donnees, y, W) {
  doc.text(`Je soussigné(e), représentant légal de l'entreprise ${donnees.entreprise.raison_sociale},`, 50, y, { width: W });
  y += 30;
  doc.text(`certifie avoir procédé à la déclaration préalable à l'embauche de :`, 50, y, { width: W });
  y += 30;

  // Infos salarié
  doc.font('Helvetica-Bold');
  doc.text(`${donnees.salarie.nom_complet}`, 50, y);
  y += 20;
  doc.font('Helvetica');
  doc.text(`N° de Sécurité sociale : ${donnees.salarie.nir || 'À compléter'}`, 50, y);
  y += 15;
  doc.text(`Date de naissance : ${donnees.salarie.date_naissance || 'À compléter'}`, 50, y);
  y += 30;

  // Infos embauche
  doc.text(`Date d'embauche prévue : ${donnees.contrat.date_debut}`, 50, y);
  y += 15;
  doc.text(`Heure d'embauche : 09:00`, 50, y);
  y += 15;
  doc.text(`Type de contrat : ${donnees.contrat.type_label}`, 50, y);
  y += 40;

  // Mentions
  doc.fontSize(9).fillColor('#666');
  doc.text(`Cette déclaration doit être effectuée auprès de l'URSSAF au plus tard dans les instants qui précèdent l'embauche effective.`, 50, y, { width: W });
  y += 30;
  doc.text(`Déclaration à effectuer sur : https://www.net-entreprises.fr`, 50, y);

  // Signature
  y += 60;
  doc.fillColor('#000').fontSize(11);
  doc.text(`Fait à ........................., le ${donnees.date_generation}`, 50, y);
  y += 40;
  doc.text(`Signature de l'employeur :`, 50, y);
}

function genererContratCDI(doc, donnees, y, W) {
  doc.text(`Entre les soussignés :`, 50, y);
  y += 25;

  // Employeur
  doc.font('Helvetica-Bold').text(`L'EMPLOYEUR :`, 50, y);
  y += 15;
  doc.font('Helvetica');
  doc.text(`${donnees.entreprise.raison_sociale}`, 50, y);
  y += 12;
  doc.text(`SIRET : ${donnees.entreprise.siret}`, 50, y);
  y += 12;
  doc.text(`Adresse : ${donnees.entreprise.adresse}`, 50, y, { width: W });
  y += 25;

  // Salarié
  doc.font('Helvetica-Bold').text(`LE SALARIÉ :`, 50, y);
  y += 15;
  doc.font('Helvetica');
  doc.text(`${donnees.salarie.nom_complet}`, 50, y);
  y += 12;
  doc.text(`N° SS : ${donnees.salarie.nir || 'À compléter'}`, 50, y);
  y += 12;
  doc.text(`Adresse : ${donnees.salarie.adresse || 'À compléter'}`, 50, y, { width: W });
  y += 30;

  doc.text(`Il a été convenu ce qui suit :`, 50, y);
  y += 25;

  // Articles
  const articles = [
    { titre: 'Article 1 - Engagement', contenu: `${donnees.salarie.nom_complet} est engagé(e) en qualité de ${donnees.contrat.poste} à compter du ${donnees.contrat.date_debut}.` },
    { titre: 'Article 2 - Durée du contrat', contenu: `Le présent contrat est conclu pour une durée indéterminée. Il prendra effet le ${donnees.contrat.date_debut}.` },
    { titre: 'Article 3 - Période d\'essai', contenu: `Le présent contrat est soumis à une période d'essai de 2 mois, renouvelable une fois.` },
    { titre: 'Article 4 - Rémunération', contenu: `En contrepartie de son travail, le salarié percevra une rémunération mensuelle brute de ${donnees.contrat.salaire_brut} pour ${donnees.contrat.heures_mensuelles} heures mensuelles.` },
    { titre: 'Article 5 - Durée du travail', contenu: `La durée hebdomadaire de travail est fixée à ${donnees.contrat.heures_hebdo} heures.` },
    { titre: 'Article 6 - Lieu de travail', contenu: `Le lieu de travail principal est fixé à : ${donnees.contrat.lieu_travail}` },
    { titre: 'Article 7 - Convention collective', contenu: `Le présent contrat est régi par la convention collective ${donnees.entreprise.convention || 'applicable à l\'entreprise'}.` }
  ];

  for (const art of articles) {
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
    doc.font('Helvetica-Bold').text(art.titre, 50, y);
    y += 15;
    doc.font('Helvetica').text(art.contenu, 50, y, { width: W });
    y += doc.heightOfString(art.contenu, { width: W }) + 15;
  }

  // Signatures
  y += 30;
  doc.text(`Fait en deux exemplaires originaux, à ........................., le ${donnees.date_generation}`, 50, y, { width: W });
  y += 40;

  doc.text(`L'Employeur`, 50, y);
  doc.text(`Le Salarié`, 350, y);
  y += 15;
  doc.fontSize(9).text(`(signature précédée de la mention "Lu et approuvé")`, 50, y);
  doc.text(`(signature précédée de la mention "Lu et approuvé")`, 350, y);
}

function genererContratCDD(doc, donnees, y, W) {
  doc.text(`Entre les soussignés :`, 50, y);
  y += 25;

  doc.font('Helvetica-Bold').text(`L'EMPLOYEUR : ${donnees.entreprise.raison_sociale}`, 50, y);
  y += 20;
  doc.font('Helvetica').text(`SIRET : ${donnees.entreprise.siret}`, 50, y);
  y += 25;

  doc.font('Helvetica-Bold').text(`LE SALARIÉ : ${donnees.salarie.nom_complet}`, 50, y);
  y += 20;
  doc.font('Helvetica').text(`N° SS : ${donnees.salarie.nir || 'À compléter'}`, 50, y);
  y += 30;

  doc.text(`Il a été convenu le contrat de travail à durée déterminée suivant :`, 50, y);
  y += 25;

  doc.font('Helvetica-Bold').text(`Motif du recours au CDD :`, 50, y);
  y += 15;
  doc.font('Helvetica').text(`Accroissement temporaire d'activité`, 50, y);
  y += 25;

  doc.text(`Poste : ${donnees.contrat.poste}`, 50, y);
  y += 15;
  doc.text(`Date de début : ${donnees.contrat.date_debut}`, 50, y);
  y += 15;
  doc.text(`Date de fin : ${donnees.contrat.date_fin || 'À définir'}`, 50, y);
  y += 15;
  doc.text(`Rémunération brute mensuelle : ${donnees.contrat.salaire_brut}`, 50, y);
  y += 25;

  doc.fontSize(10).text(`À l'issue du contrat, le salarié percevra une indemnité de fin de contrat égale à 10% de la rémunération totale brute.`, 50, y, { width: W });

  // Signatures
  y += 60;
  doc.fontSize(11).text(`Fait en deux exemplaires, le ${donnees.date_generation}`, 50, y);
  y += 40;
  doc.text(`L'Employeur`, 50, y);
  doc.text(`Le Salarié`, 350, y);
}

function genererCertificatTravail(doc, donnees, y, W) {
  doc.text(`Je soussigné(e), représentant légal de l'entreprise :`, 50, y);
  y += 20;
  doc.font('Helvetica-Bold').text(donnees.entreprise.raison_sociale, 50, y);
  y += 15;
  doc.font('Helvetica').text(`SIRET : ${donnees.entreprise.siret}`, 50, y);
  y += 15;
  doc.text(`Adresse : ${donnees.entreprise.adresse}`, 50, y, { width: W });
  y += 35;

  doc.text(`Certifie que :`, 50, y);
  y += 25;

  doc.font('Helvetica-Bold').fontSize(12);
  doc.text(donnees.salarie.nom_complet, 50, y);
  y += 20;
  doc.font('Helvetica').fontSize(11);
  doc.text(`N° de Sécurité sociale : ${donnees.salarie.nir || 'Non renseigné'}`, 50, y);
  y += 30;

  doc.text(`A été employé(e) dans notre entreprise :`, 50, y);
  y += 20;
  doc.text(`Du ${donnees.contrat.date_debut} au ${donnees.contrat.date_fin || 'ce jour'}`, 70, y);
  y += 20;
  doc.text(`En qualité de : ${donnees.contrat.poste}`, 70, y);
  y += 35;

  doc.text(`${donnees.salarie.prenom} ${donnees.salarie.nom} nous quitte libre de tout engagement.`, 50, y, { width: W });
  y += 30;

  doc.fontSize(10).fillColor('#666');
  doc.text(`En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.`, 50, y, { width: W });

  // Signature
  y += 50;
  doc.fillColor('#000').fontSize(11);
  doc.text(`Fait à ........................., le ${donnees.date_generation}`, 50, y);
  y += 40;
  doc.text(`Signature et cachet de l'employeur :`, 50, y);
}

function genererAttestationEmployeur(doc, donnees, y, W) {
  doc.text(`Je soussigné(e), représentant légal de l'entreprise ${donnees.entreprise.raison_sociale},`, 50, y, { width: W });
  y += 15;
  doc.text(`SIRET : ${donnees.entreprise.siret}`, 50, y);
  y += 30;

  doc.text(`Atteste que :`, 50, y);
  y += 25;

  doc.font('Helvetica-Bold').fontSize(12);
  doc.text(donnees.salarie.nom_complet, 50, y);
  y += 25;

  doc.font('Helvetica').fontSize(11);
  doc.text(`Est employé(e) au sein de notre entreprise depuis le ${donnees.contrat.date_debut}`, 50, y, { width: W });
  y += 20;
  doc.text(`en qualité de ${donnees.contrat.poste}`, 50, y);
  y += 20;
  doc.text(`sous contrat ${donnees.contrat.type_label}`, 50, y);
  y += 20;
  doc.text(`pour une rémunération mensuelle brute de ${donnees.contrat.salaire_brut}`, 50, y);
  y += 40;

  doc.text(`Cette attestation est délivrée à la demande de l'intéressé(e) pour servir et valoir ce que de droit.`, 50, y, { width: W });

  // Signature
  y += 50;
  doc.text(`Fait à ........................., le ${donnees.date_generation}`, 50, y);
  y += 40;
  doc.text(`Signature et cachet de l'employeur :`, 50, y);
}

function genererSoldeToutCompte(doc, donnees, y, W) {
  doc.text(`Je soussigné(e) :`, 50, y);
  y += 20;
  doc.font('Helvetica-Bold').text(donnees.salarie.nom_complet, 50, y);
  y += 15;
  doc.font('Helvetica').text(`demeurant : ${donnees.salarie.adresse || 'À compléter'}`, 50, y, { width: W });
  y += 30;

  doc.text(`Reconnais avoir reçu de mon employeur :`, 50, y);
  y += 20;
  doc.font('Helvetica-Bold').text(donnees.entreprise.raison_sociale, 50, y);
  y += 30;

  doc.font('Helvetica');
  doc.text(`La somme de : .................................. euros`, 50, y);
  y += 20;
  doc.text(`En paiement de toutes les sommes qui m'étaient dues au titre de l'exécution et de la cessation de mon contrat de travail, soit :`, 50, y, { width: W });
  y += 35;

  // Tableau des sommes
  const lignes = [
    'Salaire du mois de départ : .......................... €',
    'Indemnité compensatrice de congés payés : .......................... €',
    'Indemnité compensatrice de préavis : .......................... €',
    'Indemnité de licenciement / rupture : .......................... €',
    'Prime de précarité (CDD) : .......................... €',
    'Autres : .......................... €',
    '',
    'TOTAL NET : .......................... €'
  ];

  for (const ligne of lignes) {
    doc.text(ligne, 70, y);
    y += 18;
  }

  y += 20;
  doc.fontSize(9).fillColor('#666');
  doc.text(`Ce reçu peut être dénoncé dans les six mois qui suivent sa signature, par lettre recommandée.`, 50, y, { width: W });
  doc.text(`Passé ce délai, il devient libératoire pour l'employeur.`, 50, y + 12, { width: W });

  // Signature
  y += 50;
  doc.fillColor('#000').fontSize(11);
  doc.text(`Fait à ........................., le ${donnees.date_generation}`, 50, y);
  y += 30;
  doc.text(`Signature du salarié`, 50, y);
  doc.text(`(précédée de "Pour solde de tout compte")`, 50, y + 12);
}

// ============================================
// HELPERS
// ============================================

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR');
}

function formatMontant(cents) {
  if (!cents) return '0,00 €';
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

function getTypeContratLabel(type) {
  const labels = {
    cdi: 'CDI (Contrat à Durée Indéterminée)',
    cdd: 'CDD (Contrat à Durée Déterminée)',
    alternance: 'Contrat d\'alternance',
    stage: 'Convention de stage',
    interim: 'Contrat d\'intérim'
  };
  return labels[type] || type?.toUpperCase() || 'CDI';
}

function genererTitre(type, membre) {
  const titres = {
    dpae: `DPAE - ${membre.prenom} ${membre.nom}`,
    contrat_cdi: `Contrat CDI - ${membre.prenom} ${membre.nom}`,
    contrat_cdd: `Contrat CDD - ${membre.prenom} ${membre.nom}`,
    certificat_travail: `Certificat de travail - ${membre.prenom} ${membre.nom}`,
    attestation_employeur: `Attestation - ${membre.prenom} ${membre.nom}`,
    solde_tout_compte: `Solde tout compte - ${membre.prenom} ${membre.nom}`
  };
  return titres[type] || `Document - ${membre.prenom} ${membre.nom}`;
}

/**
 * Régénère un PDF à partir des données stockées (sans créer de nouveau document)
 */
export async function regenererPDF(type, donnees) {
  return genererPDF(type, donnees);
}

export { MODELES_DEFAUT };

export default {
  getOrCreateModeles,
  genererDocument,
  regenererPDF,
  MODELES_DEFAUT
};
