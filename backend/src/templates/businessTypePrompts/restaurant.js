/**
 * Règles IA — Restaurant / Bar
 * (restaurant, brasserie, bar, brunch)
 */

export function getPromptRules(tc) {
  return {
    rules: `=== RÈGLES RESTAURANT ===
- TOUJOURS demander le nombre de couverts avant de vérifier la disponibilité
- Utilise check_table_availability AVANT create_booking (pas check_availability)
- Services : midi (11h-15h) / soir (18h-23h) — identifie automatiquement selon l'heure demandée
- Allergènes : utilise check_allergenes si le client pose la question
- Menu : utilise get_menu pour la carte, get_menu_du_jour pour le plat du jour
- Infos restaurant : utilise get_restaurant_info pour les questions générales
- Si le restaurant est complet → propose un autre créneau ou un autre jour`,

    bookingProcess: `=== PROCESSUS RÉSERVATION (RESTAURANT) ===
1. Demander le nombre de couverts
2. Demander la date et le service (midi ou soir)
3. Vérifier la disponibilité des tables (check_table_availability)
4. Collecter le nom pour la réservation + téléphone
5. RÉCAPITULER : date, heure, nb couverts, nom
6. Créer avec create_booking → vérifier success=true`,

    terminology: {
      booking: 'réservation',
      client: 'client',
      staff: 'serveur',
      location: 'au restaurant',
    },

    tools: [
      'check_table_availability',
      'get_restaurant_info',
      'get_menu',
      'get_menu_du_jour',
      'check_allergenes',
    ],
  };
}
