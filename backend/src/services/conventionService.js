/**
 * Service Convention Collective
 * Gestion des grilles salariales, primes obligatoires et conges speciaux par IDCC
 */

import { supabase } from '../config/supabase.js';

// Cache en memoire (conventions changent rarement)
const conventionCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 heure

/**
 * Recupere une convention collective par IDCC
 * @param {string} idcc - Code IDCC (ex: "2596")
 * @returns {Object|null} Convention config
 */
export async function getConvention(idcc) {
  if (!idcc) return null;

  // Verifier cache
  const cached = conventionCache.get(idcc);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  const { data, error } = await supabase
    .from('rh_conventions_collectives')
    .select('*')
    .eq('idcc', idcc)
    .maybeSingle();

  if (error || !data) return null;

  // Parser les JSONB si necessaire
  const convention = {
    id: data.id,
    idcc: data.idcc,
    nom: data.nom,
    grilleSalaires: data.grille_salaires || [],
    primesObligatoires: data.primes_obligatoires || [],
    congesSpeciaux: data.conges_speciaux || [],
    preavis: data.preavis || {},
    tauxSpecifiques: data.taux_specifiques || {},
    dateEffet: data.date_effet,
  };

  conventionCache.set(idcc, { data: convention, ts: Date.now() });
  return convention;
}

/**
 * Recupere le salaire minimum conventionnel
 * @param {string} idcc
 * @param {string} niveau
 * @param {number} echelon
 * @returns {number} Montant en centimes
 */
export async function getSalaireMinimum(idcc, niveau, echelon = 1) {
  const convention = await getConvention(idcc);
  if (!convention) return 0;

  const grille = convention.grilleSalaires;

  // Chercher dans la grille (plusieurs formats selon convention)
  const match = grille.find(g => {
    if (g.niveau && g.echelon) {
      return g.niveau === niveau && g.echelon === echelon;
    }
    if (g.niveau) {
      return g.niveau === niveau;
    }
    if (g.categorie) {
      return g.categorie === niveau;
    }
    if (g.groupe) {
      return g.groupe === niveau;
    }
    return false;
  });

  return match?.minima_brut || 0;
}

/**
 * Recupere les primes obligatoires applicables a un employe
 * @param {string} idcc
 * @param {Object} membre - Donnees employe (anciennete_mois, etc.)
 * @returns {Array} Liste de primes avec montants calcules
 */
export async function getPrimesObligatoires(idcc, membre) {
  const convention = await getConvention(idcc);
  if (!convention) return [];

  const primes = [];
  const ancienneteMois = membre.anciennete_mois || 0;

  for (const prime of convention.primesObligatoires) {
    // Verifier la condition
    if (prime.condition) {
      // Parser conditions simples: "anciennete >= 60" (60 mois = 5 ans)
      const condMatch = prime.condition.match(/anciennete\s*(>=|>|==)\s*(\d+)/);
      if (condMatch) {
        const op = condMatch[1];
        const val = parseInt(condMatch[2]);
        if (op === '>=' && ancienneteMois < val) continue;
        if (op === '>' && ancienneteMois <= val) continue;
        if (op === '==' && ancienneteMois !== val) continue;
      }

      // Condition travail de nuit
      if (prime.condition === 'travail_nuit' && !membre.travail_nuit) continue;
    }

    let montant = 0;

    switch (prime.calcul) {
      case 'pourcentage_base':
        montant = Math.round((membre.salaire_mensuel || 0) * (prime.taux || 0));
        break;

      case 'forfait':
        montant = prime.montant || 0;
        break;

      case 'points':
        // Ex: animation — points par annee * valeur du point
        if (prime.points_par_annee && prime.valeur_point) {
          const anneesAnciennete = Math.floor(ancienneteMois / 12);
          montant = anneesAnciennete * prime.points_par_annee * prime.valeur_point;
        }
        break;

      default:
        montant = prime.montant || 0;
    }

    if (montant > 0) {
      primes.push({
        code: prime.code,
        nom: prime.nom,
        montant,
        calcul: prime.calcul,
        source: 'convention',
        idcc,
      });
    }
  }

  return primes;
}

/**
 * Recupere les conges speciaux pour un motif donne
 * @param {string} idcc
 * @param {string} motif - Ex: "mariage", "deces_conjoint"
 * @returns {number} Nombre de jours
 */
export async function getCongesSpeciaux(idcc, motif) {
  const convention = await getConvention(idcc);
  if (!convention) return 0;

  const conge = convention.congesSpeciaux.find(c => c.motif === motif);
  return conge?.jours || 0;
}

/**
 * Valide qu'un salaire respecte les minima conventionnels
 * @param {string} idcc
 * @param {string} niveau
 * @param {number} salaireBrut - En centimes
 * @param {number} echelon
 * @returns {{ valide: boolean, minimaConventionnel: number, ecart: number }}
 */
export async function validateSalaire(idcc, niveau, salaireBrut, echelon = 1) {
  const minima = await getSalaireMinimum(idcc, niveau, echelon);

  if (minima === 0) {
    // Pas de grille trouvee, on ne peut pas valider
    return { valide: true, minimaConventionnel: 0, ecart: 0, message: 'Grille non trouvee pour ce niveau' };
  }

  const valide = salaireBrut >= minima;
  const ecart = salaireBrut - minima;

  return {
    valide,
    minimaConventionnel: minima,
    ecart,
    message: valide
      ? `Salaire conforme (${ecart} centimes au-dessus du minimum)`
      : `ALERTE: Salaire inferieur au minimum conventionnel de ${Math.abs(ecart)} centimes`,
  };
}

/**
 * Liste toutes les conventions disponibles
 * @returns {Array}
 */
export async function listConventions() {
  const { data, error } = await supabase
    .from('rh_conventions_collectives')
    .select('idcc, nom, date_effet')
    .order('idcc');

  if (error) throw error;
  return data || [];
}

/**
 * Vide le cache (utilise apres mise a jour)
 */
export function clearCache() {
  conventionCache.clear();
}

export default {
  getConvention,
  getSalaireMinimum,
  getPrimesObligatoires,
  getCongesSpeciaux,
  validateSalaire,
  listConventions,
  clearCache,
};
