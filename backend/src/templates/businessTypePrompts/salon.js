/**
 * Règles IA — Salon / Institut
 * (coiffure, barbier, spa, onglerie, esthétique)
 */

export function getPromptRules(tc) {
  return {
    rules: `=== RÈGLES SALON / INSTITUT ===
- Les prestations se font au salon : ${tc.adresse || 'adresse à confirmer'}
- Pas de frais de déplacement
- Propose les créneaux disponibles en priorité
- Informe sur le temps de service estimé
- Si multi-staff : propose les professionnels disponibles`,

    bookingProcess: `=== PROCESSUS RÉSERVATION (SALON) ===
1. Identifier le(s) service(s) demandé(s) — le client peut combiner plusieurs prestations
1b. Demander : "Souhaitez-vous ajouter une autre prestation ?" avant les dispos
2. Vérifier les disponibilités (get_upcoming_days puis check_availability) avec la durée TOTALE
3. Proposer les créneaux disponibles
4. Collecter nom complet + téléphone (10 chiffres). Email optionnel (ne PAS demander par téléphone)
5. RÉCAPITULER tous les services + prix total et demander confirmation
6. Créer avec create_booking (utiliser "services" si plusieurs) → vérifier success=true`,

    terminology: {
      booking: 'rendez-vous',
      client: 'client',
      staff: 'membre de l\'équipe',
      location: 'au salon',
    },

    tools: [],
  };
}
