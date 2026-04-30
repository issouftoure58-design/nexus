/**
 * Règles IA — Service & Conseil
 * (consultant, formation, avocat, comptable, photographe, coach, etc.)
 */

export function getPromptRules(tc) {
  return {
    rules: `=== RÈGLES SERVICE & CONSEIL ===
- Les rendez-vous se font au bureau/cabinet : ${tc.adresse || 'adresse à confirmer'}
- Pas de frais de déplacement (sauf si le prestataire se déplace)
- Propose les créneaux disponibles en priorité
- Informe sur la durée estimée de la prestation
- Si multi-staff : propose les collaborateurs disponibles selon leur spécialité
- Tarification possible : forfait fixe, taux horaire, ou package
- Terminologie : "collaborateur" (pas "employé" ni "intervenant")`,

    bookingProcess: `=== PROCESSUS RÉSERVATION (SERVICE & CONSEIL) ===
1. Identifier la prestation demandée (consultation, formation, accompagnement, etc.)
1b. Si plusieurs prestations possibles, demander de préciser
2. Vérifier les disponibilités (get_upcoming_days puis check_availability)
3. Proposer les créneaux disponibles
4. Si multi-staff : proposer le collaborateur adapté ou laisser le choix
5. Collecter nom complet + téléphone (10 chiffres). Email optionnel (ne PAS demander par téléphone)
6. RÉCAPITULER : prestation + collaborateur + créneau + tarif, demander confirmation
7. Créer avec create_booking → vérifier success=true`,

    terminology: {
      booking: 'rendez-vous',
      client: 'client',
      staff: 'collaborateur',
      location: 'au cabinet',
    },

    tools: [],
  };
}
