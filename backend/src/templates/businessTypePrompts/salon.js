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
1. Identifier le service demandé
2. Vérifier les disponibilités (get_upcoming_days puis check_availability)
3. Proposer les créneaux disponibles
4. Collecter nom complet + téléphone (10 chiffres)
5. RÉCAPITULER toutes les infos et demander confirmation
6. Créer avec create_booking → vérifier success=true`,

    terminology: {
      booking: 'rendez-vous',
      client: 'client',
      staff: 'membre de l\'équipe',
      location: 'au salon',
    },

    tools: [],
  };
}
