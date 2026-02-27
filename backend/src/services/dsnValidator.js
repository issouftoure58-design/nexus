/**
 * Service de validation DSN - Contrôles NEODeS 2026
 * Basé sur le cahier technique DSN 2026.1
 */

// Codes des blocs DSN obligatoires
const BLOCS_OBLIGATOIRES = {
  'S10.G00.00': 'Envoi',
  'S10.G00.01': 'Emetteur',
  'S20.G00.05': 'Déclaration',
  'S21.G00.06': 'Entreprise',
  'S21.G00.11': 'Etablissement',
  'S90.G00.90': 'Total envoi'
};

// Rubriques obligatoires par bloc
const RUBRIQUES_OBLIGATOIRES = {
  'S10.G00.00.001': { nom: 'Nom du logiciel', format: 'string', maxLength: 100 },
  'S10.G00.00.006': { nom: 'Version norme', format: 'string', pattern: /^P\d{2}V\d{2}$/ },
  'S10.G00.01.001': { nom: 'SIREN émetteur', format: 'siren' },
  'S20.G00.05.001': { nom: 'Nature déclaration', format: 'code', values: ['01', '02', '03', '04', '05'] },
  'S21.G00.06.001': { nom: 'SIREN entreprise', format: 'siren' },
  'S21.G00.11.001': { nom: 'NIC établissement', format: 'nic' },
  'S21.G00.30.001': { nom: 'NIR salarié', format: 'nir' },
  'S21.G00.30.002': { nom: 'Nom salarié', format: 'string', maxLength: 80 },
  'S21.G00.40.001': { nom: 'Date début contrat', format: 'date' },
  'S21.G00.40.007': { nom: 'Nature contrat', format: 'code', values: ['01', '02', '03', '04', '05', '07', '08', '09', '10', '29', '32', '50', '60', '70', '80', '81', '82', '89', '90', '91', '92', '93'] },
  'S90.G00.90.001': { nom: 'Nombre rubriques', format: 'number' }
};

// Patterns de validation
const PATTERNS = {
  siren: /^\d{9}$/,
  siret: /^\d{14}$/,
  nic: /^\d{5}$/,
  nir: /^\d{13}$|^\d{15}$/,
  date: /^\d{8}$/, // AAAAMMJJ
  dateMMAAAA: /^\d{6}$/, // MMAAAA ou AAAAMM
  montant: /^\d+$/,
  taux: /^\d+(\.\d{1,5})?$/
};

/**
 * Valide un fichier DSN
 * @param {string} contenuDSN - Contenu du fichier DSN
 * @returns {Object} Résultat de validation avec erreurs et avertissements
 */
function validerDSN(contenuDSN) {
  const resultat = {
    valide: true,
    erreurs: [],
    avertissements: [],
    stats: {
      nb_rubriques: 0,
      nb_salaries: 0,
      blocs_trouves: [],
      rubriques_manquantes: []
    }
  };

  if (!contenuDSN || typeof contenuDSN !== 'string') {
    resultat.valide = false;
    resultat.erreurs.push({
      code: 'DSN-000',
      type: 'STRUCTURE',
      message: 'Contenu DSN vide ou invalide'
    });
    return resultat;
  }

  // Parser le contenu DSN
  const lignes = contenuDSN.split('\n').filter(l => l.trim());
  const rubriques = new Map();
  const blocsPresents = new Set();

  lignes.forEach((ligne, index) => {
    const match = ligne.match(/^([A-Z]\d{2}\.G\d{2}\.\d{2}\.\d{3}),'(.*)'/);
    if (match) {
      const [, code, valeur] = match;
      resultat.stats.nb_rubriques++;

      // Extraire le bloc (format: S10.G00.00 = 10 caractères)
      const bloc = code.substring(0, 10);
      blocsPresents.add(bloc);

      // Stocker la rubrique
      if (!rubriques.has(code)) {
        rubriques.set(code, []);
      }
      rubriques.get(code).push({ valeur, ligne: index + 1 });

      // Compter les salariés (bloc S21.G00.30)
      if (code === 'S21.G00.30.001') {
        resultat.stats.nb_salaries++;
      }
    } else if (ligne.trim()) {
      resultat.avertissements.push({
        code: 'DSN-001',
        type: 'FORMAT',
        ligne: index + 1,
        message: `Ligne mal formatée: ${ligne.substring(0, 50)}...`
      });
    }
  });

  resultat.stats.blocs_trouves = Array.from(blocsPresents);

  // Vérifier les blocs obligatoires
  Object.entries(BLOCS_OBLIGATOIRES).forEach(([bloc, nom]) => {
    if (!blocsPresents.has(bloc)) {
      resultat.valide = false;
      resultat.erreurs.push({
        code: 'DSN-100',
        type: 'STRUCTURE',
        message: `Bloc obligatoire manquant: ${bloc} (${nom})`
      });
    }
  });

  // Vérifier les rubriques obligatoires
  Object.entries(RUBRIQUES_OBLIGATOIRES).forEach(([code, spec]) => {
    // Certaines rubriques sont obligatoires par salarié
    const estRubriqueSalarie = code.startsWith('S21.G00.30') || code.startsWith('S21.G00.40');

    if (!estRubriqueSalarie && !rubriques.has(code)) {
      resultat.stats.rubriques_manquantes.push(code);
      resultat.avertissements.push({
        code: 'DSN-101',
        type: 'COMPLETUDE',
        message: `Rubrique recommandée manquante: ${code} (${spec.nom})`
      });
    }
  });

  // Valider le format des rubriques présentes
  rubriques.forEach((occurrences, code) => {
    occurrences.forEach(({ valeur, ligne }) => {
      const erreur = validerRubrique(code, valeur, ligne);
      if (erreur) {
        if (erreur.niveau === 'erreur') {
          resultat.valide = false;
          resultat.erreurs.push(erreur);
        } else {
          resultat.avertissements.push(erreur);
        }
      }
    });
  });

  // Vérifier la cohérence des totaux
  const nbRubriquesDeclarees = rubriques.get('S90.G00.90.001')?.[0]?.valeur;
  if (nbRubriquesDeclarees) {
    const nbReel = resultat.stats.nb_rubriques;
    const nbDeclare = parseInt(nbRubriquesDeclarees);
    // Le nombre déclaré inclut la rubrique S90 elle-même
    if (Math.abs(nbReel - nbDeclare) > 1) {
      resultat.avertissements.push({
        code: 'DSN-200',
        type: 'COHERENCE',
        message: `Nombre de rubriques incohérent: déclaré=${nbDeclare}, réel=${nbReel}`
      });
    }
  }

  // Vérifier qu'il y a au moins un salarié
  if (resultat.stats.nb_salaries === 0) {
    resultat.avertissements.push({
      code: 'DSN-201',
      type: 'COHERENCE',
      message: 'Aucun salarié trouvé dans la DSN (bloc S21.G00.30 absent)'
    });
  }

  return resultat;
}

/**
 * Valide une rubrique individuelle
 */
function validerRubrique(code, valeur, ligne) {
  // Vérifications spécifiques par type de rubrique
  const spec = RUBRIQUES_OBLIGATOIRES[code];

  // Valeur vide
  if (!valeur && spec) {
    return {
      code: 'DSN-300',
      type: 'VALEUR',
      niveau: 'avertissement',
      ligne,
      rubrique: code,
      message: `Valeur vide pour ${code} (${spec.nom})`
    };
  }

  // SIREN
  if (code.includes('.001') && (code.includes('S10.G00.01') || code.includes('S21.G00.06'))) {
    if (valeur && !PATTERNS.siren.test(valeur)) {
      return {
        code: 'DSN-301',
        type: 'FORMAT',
        niveau: 'erreur',
        ligne,
        rubrique: code,
        message: `SIREN invalide: "${valeur}" (doit être 9 chiffres)`
      };
    }
  }

  // NIC
  if (code === 'S21.G00.11.001') {
    if (valeur && !PATTERNS.nic.test(valeur)) {
      return {
        code: 'DSN-302',
        type: 'FORMAT',
        niveau: 'erreur',
        ligne,
        rubrique: code,
        message: `NIC invalide: "${valeur}" (doit être 5 chiffres)`
      };
    }
  }

  // NIR
  if (code === 'S21.G00.30.001') {
    if (valeur && !PATTERNS.nir.test(valeur)) {
      return {
        code: 'DSN-303',
        type: 'FORMAT',
        niveau: 'erreur',
        ligne,
        rubrique: code,
        message: `NIR invalide: "${valeur}" (doit être 13 ou 15 chiffres)`
      };
    }
    // Vérifier clé NIR (optionnel)
    if (valeur && valeur.length === 15) {
      const nir13 = valeur.substring(0, 13);
      const cle = valeur.substring(13);
      const cleCalculee = 97 - (parseInt(nir13) % 97);
      if (parseInt(cle) !== cleCalculee) {
        return {
          code: 'DSN-304',
          type: 'FORMAT',
          niveau: 'avertissement',
          ligne,
          rubrique: code,
          message: `Clé NIR potentiellement incorrecte (calculée: ${cleCalculee.toString().padStart(2, '0')})`
        };
      }
    }
  }

  // Dates (format AAAAMMJJ)
  if (code.includes('.001') && code.includes('S21.G00.40')) {
    if (valeur && !PATTERNS.date.test(valeur)) {
      return {
        code: 'DSN-305',
        type: 'FORMAT',
        niveau: 'erreur',
        ligne,
        rubrique: code,
        message: `Date invalide: "${valeur}" (format attendu: AAAAMMJJ)`
      };
    }
    // Vérifier que c'est une date valide
    if (valeur && PATTERNS.date.test(valeur)) {
      const annee = parseInt(valeur.substring(0, 4));
      const mois = parseInt(valeur.substring(4, 6));
      const jour = parseInt(valeur.substring(6, 8));
      if (mois < 1 || mois > 12 || jour < 1 || jour > 31) {
        return {
          code: 'DSN-306',
          type: 'FORMAT',
          niveau: 'erreur',
          ligne,
          rubrique: code,
          message: `Date invalide: ${jour}/${mois}/${annee}`
        };
      }
    }
  }

  // Nature contrat
  if (code === 'S21.G00.40.007') {
    const spec = RUBRIQUES_OBLIGATOIRES[code];
    if (valeur && spec.values && !spec.values.includes(valeur)) {
      return {
        code: 'DSN-307',
        type: 'VALEUR',
        niveau: 'avertissement',
        ligne,
        rubrique: code,
        message: `Code nature contrat non standard: "${valeur}"`
      };
    }
  }

  // Sexe
  if (code === 'S21.G00.30.006') {
    if (valeur && !['01', '02'].includes(valeur)) {
      return {
        code: 'DSN-308',
        type: 'VALEUR',
        niveau: 'erreur',
        ligne,
        rubrique: code,
        message: `Code sexe invalide: "${valeur}" (01=Homme, 02=Femme)`
      };
    }
  }

  return null;
}

/**
 * Génère un rapport de validation lisible
 */
function genererRapport(resultat) {
  let rapport = '='.repeat(60) + '\n';
  rapport += '  RAPPORT DE VALIDATION DSN - NEODeS 2026\n';
  rapport += '='.repeat(60) + '\n\n';

  rapport += `Statut: ${resultat.valide ? '✓ VALIDE' : '✗ INVALIDE'}\n`;
  rapport += `Rubriques analysées: ${resultat.stats.nb_rubriques}\n`;
  rapport += `Salariés déclarés: ${resultat.stats.nb_salaries}\n\n`;

  if (resultat.erreurs.length > 0) {
    rapport += '-'.repeat(40) + '\n';
    rapport += `ERREURS (${resultat.erreurs.length})\n`;
    rapport += '-'.repeat(40) + '\n';
    resultat.erreurs.forEach((e, i) => {
      rapport += `${i + 1}. [${e.code}] ${e.message}\n`;
      if (e.ligne) rapport += `   Ligne: ${e.ligne}\n`;
    });
    rapport += '\n';
  }

  if (resultat.avertissements.length > 0) {
    rapport += '-'.repeat(40) + '\n';
    rapport += `AVERTISSEMENTS (${resultat.avertissements.length})\n`;
    rapport += '-'.repeat(40) + '\n';
    resultat.avertissements.forEach((a, i) => {
      rapport += `${i + 1}. [${a.code}] ${a.message}\n`;
    });
    rapport += '\n';
  }

  if (resultat.valide && resultat.erreurs.length === 0) {
    rapport += '\n✓ La DSN est conforme aux contrôles de base.\n';
    rapport += '  Vous pouvez la soumettre à DSN-Val pour validation complète.\n';
  }

  return rapport;
}

export {
  validerDSN,
  genererRapport
};
