/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║                    TOOLS REGISTRY - SOURCE UNIQUE DE VÉRITÉ                   ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║                                                                               ║
 * ║   Ce fichier définit TOUS les outils disponibles pour l'IA Halimah.           ║
 * ║                                                                               ║
 * ║   ARCHITECTURE:                                                               ║
 * ║   • TOOLS_CLIENT (9 outils) - WhatsApp, Téléphone, Chat Web                   ║
 * ║   • TOOLS_ADMIN (50+ outils) - Halimah Pro (inclut TOOLS_CLIENT)              ║
 * ║                                                                               ║
 * ║   RÈGLE: Tous les canaux DOIVENT importer depuis ce fichier.                  ║
 * ║                                                                               ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 */

// ============================================
// OUTILS CLIENT - Pour WhatsApp, Téléphone, Chat Web
// ============================================

export const TOOLS_CLIENT = [
  {
    name: "parse_date",
    description: "OBLIGATOIRE : Convertit une date relative ('demain', 'samedi prochain', 'lundi') en format YYYY-MM-DD.",
    input_schema: {
      type: "object",
      properties: {
        date_text: {
          type: "string",
          description: "La date en langage naturel (ex: 'demain', 'samedi prochain')"
        },
        heure: {
          type: "integer",
          description: "L'heure demandée (9-18), optionnel"
        }
      },
      required: ["date_text"]
    }
  },
  {
    name: "get_services",
    description: "Récupère la liste de tous les services avec leurs prix EXACTS.",
    input_schema: {
      type: "object",
      properties: {
        categorie: {
          type: "string",
          description: "Filtrer par catégorie: 'locks', 'soins', 'tresses', 'coloration', ou 'all'",
          enum: ["locks", "soins", "tresses", "coloration", "all"]
        }
      },
      required: []
    }
  },
  {
    name: "get_price",
    description: "Récupère le prix EXACT d'un service spécifique.",
    input_schema: {
      type: "object",
      properties: {
        service_name: {
          type: "string",
          description: "Nom du service (ex: 'création crochet locks', 'shampoing')"
        }
      },
      required: ["service_name"]
    }
  },
  {
    name: "check_availability",
    description: "Vérifie si une date/heure est disponible pour un service.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date au format YYYY-MM-DD" },
        heure: { type: "string", description: "Heure au format HH:MM" },
        service_name: { type: "string", description: "Nom du service" }
      },
      required: ["date", "heure", "service_name"]
    }
  },
  {
    name: "get_available_slots",
    description: "Retourne tous les créneaux disponibles pour une date et un service.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date au format YYYY-MM-DD" },
        service_name: { type: "string", description: "Nom du service" }
      },
      required: ["date", "service_name"]
    }
  },
  {
    name: "calculate_travel_fee",
    description: "Calcule les frais de déplacement selon la distance.",
    input_schema: {
      type: "object",
      properties: {
        distance_km: { type: "number", description: "Distance en kilomètres" }
      },
      required: ["distance_km"]
    }
  },
  {
    name: "create_booking",
    description: "Crée une réservation quand TOUTES les infos sont confirmées. Supporte plusieurs services en un seul RDV via le paramètre 'services' (tableau). Pour un restaurant: nb_couverts est OBLIGATOIRE.",
    input_schema: {
      type: "object",
      properties: {
        service_name: { type: "string", description: "Nom du service (si un seul service). Utiliser 'services' si plusieurs." },
        services: {
          type: "array",
          description: "Liste des services demandés (si le client veut plusieurs prestations en un RDV). Chaque élément a un champ 'name'.",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Nom du service" }
            },
            required: ["name"]
          }
        },
        date: { type: "string", description: "YYYY-MM-DD" },
        heure: { type: "string", description: "HH:MM" },
        lieu: { type: "string", enum: ["domicile", "salon", "restaurant"] },
        adresse: { type: "string", description: "Adresse si domicile" },
        client_nom: { type: "string" },
        client_prenom: { type: "string" },
        client_telephone: { type: "string" },
        client_email: { type: "string", description: "Email du client (optionnel par telephone — le demander seulement si le client le propose spontanement)" },
        nb_couverts: { type: "integer", description: "Nombre de personnes (restaurant uniquement)" },
        zone_preference: { type: "string", description: "Zone préférée (interieur, terrasse, salon_prive)" }
      },
      required: ["date", "heure", "lieu", "client_nom", "client_telephone"]
    }
  },
  {
    name: "check_table_availability",
    description: "Vérifie la disponibilité des tables du restaurant pour une date/heure et un nombre de personnes. OBLIGATOIRE avant create_booking pour les restaurants.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date au format YYYY-MM-DD" },
        heure: { type: "string", description: "Heure au format HH:MM" },
        nb_couverts: { type: "integer", description: "Nombre de personnes" }
      },
      required: ["date", "heure", "nb_couverts"]
    }
  },
  {
    name: "find_appointment",
    description: "Recherche les rendez-vous d'un client par numéro de téléphone. Utilise cet outil quand un client veut annuler, modifier ou vérifier son RDV.",
    input_schema: {
      type: "object",
      properties: {
        telephone: { type: "string", description: "Numéro de téléphone du client (10 chiffres)" }
      },
      required: ["telephone"]
    }
  },
  {
    name: "cancel_appointment",
    description: "Annule un rendez-vous existant. Utilise UNIQUEMENT après avoir trouvé le RDV avec find_appointment ET obtenu la confirmation du client.",
    input_schema: {
      type: "object",
      properties: {
        appointment_id: { type: "number", description: "ID du rendez-vous à annuler" },
        reason: { type: "string", description: "Raison de l'annulation (optionnel)" }
      },
      required: ["appointment_id"]
    }
  },
  {
    name: "get_restaurant_info",
    description: "Récupère les informations du restaurant renseignées par le gérant : carte, spécialités, menu du jour, politique allergènes, hygiène, traçabilité, ambiance, etc. OBLIGATOIRE pour répondre aux questions sur le restaurant (hors réservation).",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_menu",
    description: "Récupère la carte complète du restaurant depuis la base de données : catégories, plats, prix, allergènes et régimes alimentaires. Utilise cet outil quand un client demande la carte détaillée, les prix exacts ou les options alimentaires.",
    input_schema: {
      type: "object",
      properties: {
        categorie: { type: "string", description: "Filtrer par catégorie (ex: 'Entrées', 'Plats', 'Desserts')" },
        service: { type: "string", enum: ["midi", "soir"], description: "Filtrer par service (midi ou soir)" },
        regime: { type: "string", enum: ["vegetarien", "vegan", "halal", "casher", "sans_gluten"], description: "Filtrer par régime alimentaire" }
      },
      required: []
    }
  },
  {
    name: "get_menu_du_jour",
    description: "Récupère le menu du jour avec les formules et plats sélectionnés. Utilise cet outil quand un client demande 'le menu du jour', 'les suggestions', 'le plat du jour'.",
    input_schema: {
      type: "object",
      properties: {
        service: { type: "string", enum: ["midi", "soir"], description: "Service (midi ou soir). Par défaut: selon l'heure actuelle." }
      },
      required: []
    }
  },
  {
    name: "check_allergenes",
    description: "Vérifie les allergènes d'un plat spécifique ou cherche des plats sans un allergène donné. Utilise quand un client a des restrictions alimentaires.",
    input_schema: {
      type: "object",
      properties: {
        plat_nom: { type: "string", description: "Nom du plat à vérifier" },
        allergene_a_eviter: { type: "string", description: "Allergène à éviter (gluten, lactose, arachides, crustaces, oeufs, poisson, soja, fruits_a_coque, celeri, moutarde, sesame, sulfites)" }
      },
      required: []
    }
  },
  {
    name: "get_hotel_info",
    description: "Récupère les informations de l'hôtel renseignées par le gérant : services, équipements, politique d'annulation, petit-déjeuner, parking, accès PMR, check-in/check-out, animaux, ambiance, etc. OBLIGATOIRE pour répondre aux questions sur l'établissement (hors réservation de chambre).",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_chambres_disponibles",
    description: "Liste les types de chambres de l'hôtel avec leurs caractéristiques (capacité, étage, vue, équipements, prix). Utilise quand un client demande les chambres, les prix ou les équipements.",
    input_schema: {
      type: "object",
      properties: {
        type_chambre: { type: "string", description: "Filtrer par type (simple, double, twin, suite, familiale)" },
        nb_personnes: { type: "integer", description: "Nombre de personnes (filtre capacité minimum)" }
      },
      required: []
    }
  },
  {
    name: "check_room_availability",
    description: "Vérifie la disponibilité des chambres pour des dates données. Retourne les chambres libres avec leurs prix (tarifs saisonniers inclus). OBLIGATOIRE avant de proposer une réservation hôtel.",
    input_schema: {
      type: "object",
      properties: {
        date_arrivee: { type: "string", description: "Date d'arrivée (YYYY-MM-DD)" },
        date_depart: { type: "string", description: "Date de départ (YYYY-MM-DD)" },
        nb_personnes: { type: "integer", description: "Nombre de personnes" },
        type_chambre: { type: "string", description: "Type de chambre souhaité (optionnel)" }
      },
      required: ["date_arrivee", "date_depart"]
    }
  },
  {
    name: "get_salon_info",
    description: "Récupère les informations du salon (adresse, horaires, téléphone).",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "get_business_hours",
    description: "Récupère les horaires d'ouverture de la semaine.",
    input_schema: {
      type: "object",
      properties: {
        jour: {
          type: "string",
          description: "Jour de la semaine (optionnel)",
          enum: ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"]
        }
      },
      required: []
    }
  },
  {
    name: "get_upcoming_days",
    description: "OBLIGATOIRE pour les disponibilités : Retourne les prochains jours avec leurs dates EXACTES et horaires. Utilise cet outil AVANT de parler des disponibilités. IMPORTANT : si le client demande une date dans plus de 2 semaines (mois prochain, juin, juillet...), utilise nb_jours=60 pour voir plus loin.",
    input_schema: {
      type: "object",
      properties: {
        nb_jours: {
          type: "integer",
          description: "Nombre de jours à retourner (défaut: 14, max: 60). Utiliser 30 pour le mois en cours, 60 pour le mois suivant ou dates éloignées."
        }
      },
      required: []
    }
  }
];

// ============================================
// OUTILS ADMIN - Gestion RDV et Clients
// ============================================

const TOOLS_ADMIN_GESTION = [
  {
    name: "get_stats",
    description: "Obtient les statistiques du salon (RDV, CA, clients).",
    input_schema: {
      type: "object",
      properties: {
        periode: {
          type: "string",
          enum: ["jour", "semaine", "mois", "annee"],
          description: "Période pour les statistiques"
        }
      },
      required: []
    }
  },
  {
    name: "get_rdv",
    description: "Récupère les rendez-vous.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date au format YYYY-MM-DD" },
        statut: { type: "string", enum: ["demande", "confirme", "annule", "termine"] },
        client_id: { type: "integer" }
      },
      required: []
    }
  },
  {
    name: "update_rdv",
    description: "Met à jour un rendez-vous existant.",
    input_schema: {
      type: "object",
      properties: {
        rdv_id: { type: "integer", description: "ID du RDV à modifier" },
        statut: { type: "string", enum: ["demande", "confirme", "annule", "termine", "no_show"] },
        notes: { type: "string" },
        date: { type: "string" },
        heure: { type: "string" }
      },
      required: ["rdv_id"]
    }
  },
  {
    name: "send_message",
    description: "Envoie un message SMS, WhatsApp ou Email à un client.",
    input_schema: {
      type: "object",
      properties: {
        telephone: { type: "string", description: "Téléphone du destinataire (requis si canal=sms ou whatsapp)" },
        message: { type: "string", description: "Contenu du message" },
        canal: { type: "string", enum: ["sms", "whatsapp", "email"], description: "Canal d'envoi (défaut: whatsapp)" },
        email: { type: "string", description: "Email du destinataire (requis si canal=email)" },
        objet: { type: "string", description: "Objet de l'email (requis si canal=email)" }
      },
      required: ["message"]
    }
  },
  {
    name: "get_client_info",
    description: "Récupère les informations complètes d'un client.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "integer" },
        telephone: { type: "string" }
      },
      required: []
    }
  },
  {
    name: "search_clients",
    description: "Recherche des clients par nom, prénom ou téléphone.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Terme de recherche" }
      },
      required: ["query"]
    }
  },
  {
    name: "create_client",
    description: "Crée un nouveau client dans la base de données.",
    input_schema: {
      type: "object",
      properties: {
        prenom: { type: "string", description: "Prénom du client" },
        nom: { type: "string", description: "Nom du client" },
        telephone: { type: "string", description: "Téléphone du client" },
        email: { type: "string", description: "Email du client (optionnel)" },
        adresse: { type: "string", description: "Adresse du client (optionnel)" },
        notes: { type: "string", description: "Notes sur le client (optionnel)" }
      },
      required: ["prenom", "nom", "telephone"]
    }
  },
  {
    name: "update_client",
    description: "Met à jour les informations d'un client existant.",
    input_schema: {
      type: "object",
      properties: {
        client_id: { type: "integer", description: "ID du client à modifier" },
        prenom: { type: "string", description: "Nouveau prénom" },
        nom: { type: "string", description: "Nouveau nom" },
        telephone: { type: "string", description: "Nouveau téléphone" },
        email: { type: "string", description: "Nouvel email" },
        adresse: { type: "string", description: "Nouvelle adresse" },
        notes: { type: "string", description: "Nouvelles notes" }
      },
      required: ["client_id"]
    }
  }
];

// ============================================
// OUTILS ADMIN - Marketing & SEO
// ============================================

const TOOLS_ADMIN_SEO = [
  {
    name: "seo_analyze",
    description: "Analyse SEO d'une page ou du site.",
    input_schema: {
      type: "object",
      properties: {
        aspect: { type: "string", description: "Aspect à analyser (global, technique, contenu)" }
      },
      required: []
    }
  },
  {
    name: "seo_keywords",
    description: "Suggère des mots-clés SEO pour le salon.",
    input_schema: {
      type: "object",
      properties: {
        service: { type: "string", description: "Service pour les mots-clés" },
        localisation: { type: "string", description: "Zone géographique" }
      },
      required: []
    }
  },
  {
    name: "seo_meta_generate",
    description: "Génère des meta descriptions et titres SEO.",
    input_schema: {
      type: "object",
      properties: {
        page: { type: "string", description: "Page cible (accueil, services, contact)" }
      },
      required: ["page"]
    }
  }
];

const TOOLS_ADMIN_MARKETING = [
  {
    name: "marketing_generer_post",
    description: "Génère un post pour réseaux sociaux (Instagram, Facebook) adapté au business. Sauvegarde en brouillon automatiquement.",
    input_schema: {
      type: "object",
      properties: {
        plateforme: {
          type: "string",
          enum: ["instagram", "facebook", "linkedin", "twitter"],
          description: "Plateforme cible (défaut: instagram)"
        },
        occasion: {
          type: "string",
          enum: ["promo", "nouveaute", "evenement", "inspiration", "temoignage", "conseil"],
          description: "Type de post / occasion"
        },
        tone: {
          type: "string",
          enum: ["professionnel", "fun", "inspirant", "informatif"],
          description: "Ton du message"
        },
        details: {
          type: "string",
          description: "Détails spécifiques (ex: promo -20%, nouveau service locks, etc.)"
        }
      },
      required: ["occasion"]
    }
  },
  {
    name: "marketing_lister_posts",
    description: "Liste les posts marketing générés avec filtres optionnels.",
    input_schema: {
      type: "object",
      properties: {
        statut: {
          type: "string",
          enum: ["brouillon", "publie", "programme", "archive"],
          description: "Filtrer par statut"
        },
        type: {
          type: "string",
          enum: ["instagram", "facebook", "linkedin", "twitter"],
          description: "Filtrer par plateforme"
        },
        limit: {
          type: "integer",
          description: "Nombre de posts à retourner (défaut: 10)"
        }
      }
    }
  },
  {
    name: "marketing_publier_post",
    description: "Marque un post comme publié.",
    input_schema: {
      type: "object",
      properties: {
        post_id: {
          type: "string",
          description: "ID du post à publier"
        }
      },
      required: ["post_id"]
    }
  },
  {
    name: "generate_social_post",
    description: "Génère un post pour les réseaux sociaux (alias legacy).",
    input_schema: {
      type: "object",
      properties: {
        sujet: { type: "string", description: "Sujet du post" },
        plateforme: { type: "string", enum: ["instagram", "facebook", "tiktok"] },
        inclure_emojis: { type: "boolean" }
      },
      required: ["sujet"]
    }
  },
  {
    name: "marketing_campaign",
    description: "Crée une campagne marketing.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string" },
        objectif: { type: "string" },
        budget: { type: "number" },
        duree: { type: "string" }
      },
      required: ["objectif"]
    }
  },
  {
    name: "marketing_promo",
    description: "Crée une promotion ou offre spéciale.",
    input_schema: {
      type: "object",
      properties: {
        type_promo: { type: "string", enum: ["reduction", "offre", "parrainage"] },
        service: { type: "string" },
        valeur: { type: "number" },
        conditions: { type: "string" }
      },
      required: ["type_promo"]
    }
  },
  {
    name: "marketing_email",
    description: "Génère un email marketing.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["promo", "newsletter", "relance", "fidelite"] },
        cible: { type: "string" },
        sujet: { type: "string" }
      },
      required: ["type"]
    }
  },
  {
    name: "marketing_sms",
    description: "Génère un SMS marketing.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["promo", "rappel", "anniversaire"] },
        message: { type: "string" }
      },
      required: ["type"]
    }
  }
];

// ============================================
// OUTILS ADMIN - Stratégie Business
// ============================================

const TOOLS_ADMIN_STRATEGIE = [
  {
    name: "strategie_analyze",
    description: "Analyse stratégique du business (SWOT, concurrence).",
    input_schema: {
      type: "object",
      properties: {
        aspect: { type: "string", enum: ["swot", "concurrence", "marche", "global"] }
      },
      required: []
    }
  },
  {
    name: "strategie_pricing",
    description: "Analyse et optimise les tarifs.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["analyser", "optimiser", "comparer"] },
        service: { type: "string" }
      },
      required: []
    }
  },
  {
    name: "strategie_objectifs",
    description: "Définit et suit les objectifs business.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["voir", "definir", "suivre"] },
        periode: { type: "string" },
        type_objectif: { type: "string" }
      },
      required: []
    }
  },
  {
    name: "strategie_rapport",
    description: "Génère un rapport stratégique.",
    input_schema: {
      type: "object",
      properties: {
        periode: { type: "string" },
        format: { type: "string", enum: ["resume", "complet", "executif"] }
      },
      required: []
    }
  }
];

// ============================================
// OUTILS ADMIN - Analytics & Prédictions IA
// ============================================

const TOOLS_ADMIN_ANALYTICS = [
  {
    name: "analytics_kpi",
    description: "Métriques clés période (CA, RDV, clients, évolution, top services). Utilise pour les bilans et rapports.",
    input_schema: {
      type: "object",
      properties: {
        debut: { type: "string", description: "Date début YYYY-MM-DD (défaut: début du mois)" },
        fin: { type: "string", description: "Date fin YYYY-MM-DD (défaut: aujourd'hui)" }
      },
      required: []
    }
  },
  {
    name: "analytics_predictions",
    description: "Prédictions IA: CA et RDV du mois prochain, services en hausse, périodes creuses, recommandations.",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "analytics_anomalies",
    description: "Détecte les anomalies: taux annulation élevé, baisse d'activité, baisse CA, concentration horaire.",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "analytics_evolution",
    description: "Évolution temporelle CA et RDV (série chronologique pour graphiques).",
    input_schema: {
      type: "object",
      properties: {
        debut: { type: "string", description: "Date début YYYY-MM-DD" },
        fin: { type: "string", description: "Date fin YYYY-MM-DD" },
        granularite: { type: "string", enum: ["jour", "semaine", "mois"], description: "Niveau de détail" }
      },
      required: []
    }
  },
  {
    name: "analytics_rapport",
    description: "Rapport complet: KPI + évolution + prédictions + anomalies en un seul appel.",
    input_schema: {
      type: "object",
      properties: {
        debut: { type: "string", description: "Date début YYYY-MM-DD" },
        fin: { type: "string", description: "Date fin YYYY-MM-DD" }
      },
      required: []
    }
  },
  {
    name: "analytics_comparaison",
    description: "Compare deux périodes (ex: ce mois vs mois dernier).",
    input_schema: {
      type: "object",
      properties: {
        debut1: { type: "string", description: "Début période 1" },
        fin1: { type: "string", description: "Fin période 1" },
        debut2: { type: "string", description: "Début période 2" },
        fin2: { type: "string", description: "Fin période 2" }
      },
      required: ["debut1", "fin1", "debut2", "fin2"]
    }
  }
];

// ============================================
// OUTILS ADMIN - Réseaux Sociaux
// ============================================

const TOOLS_ADMIN_SOCIAL = [
  {
    name: "social_publish",
    description: "Publie directement sur les réseaux sociaux.",
    input_schema: {
      type: "object",
      properties: {
        platforms: { type: "array", items: { type: "string" }, description: "Plateformes cibles" },
        content: { type: "string", description: "Contenu du post" },
        image_url: { type: "string", description: "URL de l'image (optionnel)" },
        confirm: { type: "boolean", description: "Confirmation de publication" }
      },
      required: ["platforms", "content"]
    }
  },
  {
    name: "social_schedule",
    description: "Programme un post pour plus tard.",
    input_schema: {
      type: "object",
      properties: {
        platforms: { type: "array", items: { type: "string" } },
        content: { type: "string" },
        image_url: { type: "string" },
        scheduled_time: { type: "string", description: "Date/heure de publication" }
      },
      required: ["platforms", "content", "scheduled_time"]
    }
  },
  {
    name: "social_status",
    description: "Vérifie le statut des plateformes et posts programmés.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["check_platforms", "list_scheduled", "cancel_scheduled"] },
        post_id: { type: "string" }
      },
      required: ["action"]
    }
  },
  {
    name: "social_generate_content",
    description: "Génère du contenu optimisé pour les réseaux sociaux.",
    input_schema: {
      type: "object",
      properties: {
        sujet: { type: "string" },
        type: { type: "string", enum: ["promo", "inspiration", "avant_apres", "conseil"] },
        platforms: { type: "array", items: { type: "string" } }
      },
      required: ["sujet"]
    }
  }
];

// ============================================
// OUTILS ADMIN - Scripts Vidéo Viraux
// ============================================

const TOOLS_ADMIN_VIDEO = [
  {
    name: "script_video_viral",
    description: "Génère un script de vidéo virale pour TikTok, Instagram Reels ou YouTube Shorts. Inclut hook 3s, storytelling, CTA, hashtags tendance, et 3 variantes (humour/émotion/choc).",
    input_schema: {
      type: "object",
      properties: {
        service_produit: {
          type: "string",
          description: "Le service ou produit à promouvoir (ex: 'création locks', 'nouveau shampoing', 'offre fidélité')"
        },
        plateforme: {
          type: "string",
          enum: ["tiktok", "instagram_reels", "youtube_shorts"],
          description: "Plateforme cible (défaut: tiktok)"
        },
        style: {
          type: "string",
          enum: ["viral", "educatif", "divertissement", "emotion", "humour", "choc"],
          description: "Style de contenu souhaité (défaut: viral)"
        },
        duree_secondes: {
          type: "integer",
          enum: [15, 30, 60],
          description: "Durée vidéo en secondes (défaut: 30)"
        }
      },
      required: ["service_produit"]
    }
  }
];

// ============================================
// OUTILS ADMIN - Création de Contenu
// ============================================

const TOOLS_ADMIN_CONTENU = [
  {
    name: "creer_image",
    description: "Génère une image avec DALL-E pour les réseaux sociaux.",
    input_schema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Description de l'image" },
        style: { type: "string", enum: ["african", "modern", "elegant", "vibrant"] },
        format: { type: "string", enum: ["square", "portrait", "landscape"] }
      },
      required: ["prompt"]
    }
  },
  {
    name: "creer_legende",
    description: "Génère une légende optimisée pour un post.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["promo", "avant_apres", "citation", "star_semaine", "temoignage"] },
        platform: { type: "string", enum: ["instagram", "facebook", "tiktok"] },
        service: { type: "string" },
        prix: { type: "number" },
        prixPromo: { type: "number" },
        reduction: { type: "number" },
        theme: { type: "string" },
        prenom: { type: "string" },
        avis: { type: "string" }
      },
      required: ["type"]
    }
  },
  {
    name: "creer_post_complet",
    description: "Crée un post complet (image + légende) à partir d'un template.",
    input_schema: {
      type: "object",
      properties: {
        template: { type: "string", description: "Nom du template" },
        platform: { type: "string", enum: ["instagram", "facebook", "tiktok", "stories"] },
        service: { type: "string" },
        prix: { type: "number" },
        reduction: { type: "number" },
        theme: { type: "string" },
        style: { type: "string" }
      },
      required: ["template", "platform"]
    }
  },
  {
    name: "lister_templates",
    description: "Liste les templates de contenu disponibles.",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "lister_images_generees",
    description: "Liste les images générées récemment.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Nombre d'images à retourner" }
      },
      required: []
    }
  }
];

// ============================================
// OUTILS ADMIN - Mémoire & Contexte
// ============================================

const TOOLS_ADMIN_MEMOIRE = [
  {
    name: "memoriser",
    description: "Mémorise une information sur un client ou le salon.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["preference", "learning", "fact", "insight"] },
        category: { type: "string", enum: ["admin", "client", "business", "content"] },
        key: { type: "string", description: "Clé du souvenir" },
        value: { type: "string", description: "Valeur à mémoriser" },
        clientId: { type: "string" }
      },
      required: ["key", "value"]
    }
  },
  {
    name: "se_souvenir",
    description: "Récupère des souvenirs sur un sujet.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Mot-clé de recherche" },
        type: { type: "string" },
        category: { type: "string", enum: ["admin", "client", "business", "content", "all"] },
        key: { type: "string" },
        clientId: { type: "string" }
      },
      required: []
    }
  },
  {
    name: "tout_savoir_sur_client",
    description: "Récupère toutes les informations mémorisées sur un client.",
    input_schema: {
      type: "object",
      properties: {
        clientId: { type: "string", description: "ID ou téléphone du client" }
      },
      required: ["clientId"]
    }
  },
  {
    name: "noter_insight",
    description: "Note une observation ou tendance importante.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["observation", "tendance", "recommandation", "alerte"] },
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "integer", description: "Priorité de 1 à 10" }
      },
      required: ["title", "description"]
    }
  },
  {
    name: "voir_insights",
    description: "Liste les observations en attente.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "integer" }
      },
      required: []
    }
  },
  {
    name: "oublier",
    description: "Supprime un souvenir de la mémoire.",
    input_schema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Clé du souvenir à oublier" },
        category: { type: "string" }
      },
      required: ["key"]
    }
  },
  {
    name: "memory_stats",
    description: "Affiche les statistiques de la mémoire.",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  }
];

// ============================================
// OUTILS ADMIN - Planification & Tâches
// ============================================

const TOOLS_ADMIN_PLANIFICATION = [
  {
    name: "planifier_post",
    description: "Planifie un post pour les réseaux sociaux.",
    input_schema: {
      type: "object",
      properties: {
        platform: { type: "string", enum: ["instagram", "facebook", "tiktok"] },
        template: { type: "string" },
        when: { type: "string", description: "Quand publier (demain 10h, dans 2h, tous les mardis)" },
        service: { type: "string" },
        customText: { type: "string" },
        imagePrompt: { type: "string" }
      },
      required: ["platform", "when"]
    }
  },
  {
    name: "voir_taches_planifiees",
    description: "Liste toutes les tâches planifiées.",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "annuler_tache",
    description: "Annule une tâche planifiée.",
    input_schema: {
      type: "object",
      properties: {
        taskId: { type: "string", description: "ID de la tâche" },
        recurring: { type: "boolean", description: "Si c'est une tâche récurrente" }
      },
      required: ["taskId"]
    }
  },
  {
    name: "planifier_rappel",
    description: "Planifie un rappel de RDV pour un client.",
    input_schema: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        bookingId: { type: "integer" },
        reminderDate: { type: "string", description: "Date du rappel" },
        channel: { type: "string", enum: ["whatsapp", "sms", "email"] }
      },
      required: ["clientId", "reminderDate"]
    }
  },
  {
    name: "planifier_relance",
    description: "Planifie une relance pour un client inactif.",
    input_schema: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        delayDays: { type: "integer", description: "Délai en jours avant relance" }
      },
      required: ["clientId"]
    }
  },
  {
    name: "stats_queue",
    description: "Affiche les statistiques de la queue de tâches.",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  }
];

// ============================================
// CATÉGORIE SUPPRIMÉE: COMPUTER_USE (10 outils)
// Raison: Pas de browser server-side
// ============================================

// ============================================
// CATÉGORIE SUPPRIMÉE: SANDBOX (12 outils)
// Raison: Système de simulation non construit
// ============================================

// ============================================
// CATÉGORIE SUPPRIMÉE: ENVIRONNEMENTS (10 outils)
// Raison: Concept non applicable aux tenants SaaS
// ============================================

// ============================================
// CATÉGORIE SUPPRIMÉE: FICHIERS (9 outils)
// Raison: Dangereux en multi-tenant
// ============================================

// ============================================
// CATÉGORIE SUPPRIMÉE: GDRIVE (10 outils)
// Raison: OAuth Google non implémenté
// ============================================

// ============================================
// OUTILS ADMIN - Agent Autonome
// ============================================

const TOOLS_ADMIN_AGENT = [
  {
    name: "agent_plan",
    description: "Décompose une demande complexe en étapes.",
    input_schema: {
      type: "object",
      properties: {
        request: { type: "string", description: "La demande à décomposer" }
      },
      required: ["request"]
    }
  },
  {
    name: "agent_execute",
    description: "Exécute une tâche planifiée.",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "integer" }
      },
      required: ["task_id"]
    }
  },
  {
    name: "agent_confirm",
    description: "Confirme et continue une tâche en attente.",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "integer" }
      },
      required: ["task_id"]
    }
  },
  {
    name: "agent_cancel",
    description: "Annule une tâche.",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "integer" }
      },
      required: ["task_id"]
    }
  },
  {
    name: "agent_status",
    description: "Vérifie le statut des tâches.",
    input_schema: {
      type: "object",
      properties: {
        task_id: { type: "integer" }
      },
      required: []
    }
  },
  {
    name: "agent_history",
    description: "Affiche l'historique des tâches.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "integer" }
      },
      required: []
    }
  }
];

// ============================================
// OUTILS ADMIN - Recherche Web
// ============================================

const TOOLS_ADMIN_RECHERCHE = [
  {
    name: "recherche_web",
    description: "Effectue une recherche web générale.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Terme de recherche" },
        max_results: { type: "integer" }
      },
      required: ["query"]
    }
  },
  {
    name: "recherche_actualites",
    description: "Recherche les actualités récentes.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        domaine: { type: "string", enum: ["beaute", "coiffure", "mode", "business"] }
      },
      required: ["query"]
    }
  },
  {
    name: "recherche_concurrent",
    description: "Recherche des informations sur un concurrent.",
    input_schema: {
      type: "object",
      properties: {
        nom: { type: "string", description: "Nom du salon concurrent" },
        localisation: { type: "string" }
      },
      required: ["nom"]
    }
  },
  {
    name: "recherche_tendances",
    description: "Recherche les tendances coiffure afro.",
    input_schema: {
      type: "object",
      properties: {
        theme: { type: "string", enum: ["locks", "tresses", "braids", "naturel", "coloration"] }
      },
      required: []
    }
  }
];

// ============================================
// OUTILS ADMIN - Comptabilité & Commercial
// ============================================

// ============================================
// OUTILS ADMIN - Commercial
// ============================================

const TOOLS_ADMIN_COMMERCIAL = [
  {
    name: "commercial_devis",
    description: "Génère un devis.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["creer", "voir", "envoyer"] },
        client_id: { type: "integer" },
        services: { type: "array", items: { type: "string" } },
        notes: { type: "string" }
      },
      required: []
    }
  },
  {
    name: "commercial_ventes",
    description: "Analyse les ventes.",
    input_schema: {
      type: "object",
      properties: {
        periode: { type: "string" },
        type_analyse: { type: "string", enum: ["service", "client", "global"] },
        comparer: { type: "boolean" }
      },
      required: []
    }
  },
  {
    name: "commercial_relances",
    description: "Gère les relances clients.",
    input_schema: {
      type: "object",
      properties: {
        type_relance: { type: "string", enum: ["devis", "inactif", "anniversaire"] },
        action: { type: "string", enum: ["lister", "envoyer"] }
      },
      required: []
    }
  },
  {
    name: "commercial_performance",
    description: "Analyse les performances commerciales.",
    input_schema: {
      type: "object",
      properties: {
        indicateurs: { type: "array", items: { type: "string" } },
        periode: { type: "string" }
      },
      required: []
    }
  },
  // ========= NOUVEAUX OUTILS RELANCE CLIENTS =========
  {
    name: "commercial_detecter_inactifs",
    description: "Détecte les clients inactifs avec scoring (VIP/Fidèle/Standard) et niveau d'inactivité (3/6/12 mois). Retourne une liste de clients à relancer avec offres suggérées.",
    input_schema: {
      type: "object",
      properties: {
        niveau_inactivite: {
          type: "string",
          enum: ["leger", "moyen", "fort", "tous"],
          description: "Niveau d'inactivité: leger (3 mois), moyen (6 mois), fort (12 mois), tous"
        },
        segment: {
          type: "string",
          enum: ["vip", "fidele", "standard", "tous"],
          description: "Filtrer par segment client"
        },
        limit: {
          type: "integer",
          description: "Nombre max de clients à retourner (défaut: 20)"
        }
      },
      required: []
    }
  },
  {
    name: "commercial_generer_relance",
    description: "Génère un message de relance personnalisé pour un client inactif. Utilise l'historique du client pour personnaliser le message et l'offre.",
    input_schema: {
      type: "object",
      properties: {
        client_id: {
          type: "integer",
          description: "ID du client à relancer"
        },
        canal: {
          type: "string",
          enum: ["sms", "whatsapp", "email"],
          description: "Canal d'envoi du message"
        },
        offre_type: {
          type: "string",
          enum: ["reduction_pourcentage", "reduction_euros", "service_gratuit"],
          description: "Type d'offre à proposer"
        },
        offre_valeur: {
          type: "number",
          description: "Valeur de l'offre (ex: 20 pour 20%, 10 pour 10€)"
        }
      },
      required: ["client_id", "canal"]
    }
  },
  {
    name: "commercial_stats_relances",
    description: "Affiche les statistiques des campagnes de relance (taux ouverture, clics, conversions).",
    input_schema: {
      type: "object",
      properties: {
        periode: {
          type: "string",
          description: "Période d'analyse (mois, trimestre, annee)"
        },
        campagne_id: {
          type: "string",
          description: "ID d'une campagne spécifique (optionnel)"
        }
      },
      required: []
    }
  },
  {
    name: "commercial_lister_campagnes",
    description: "Liste les campagnes de relance avec leurs performances.",
    input_schema: {
      type: "object",
      properties: {
        statut: {
          type: "string",
          enum: ["brouillon", "planifie", "en_cours", "termine", "annule", "tous"],
          description: "Filtrer par statut de campagne"
        },
        limit: {
          type: "integer",
          description: "Nombre de campagnes à retourner (défaut: 10)"
        }
      },
      required: []
    }
  }
];

// ============================================
// OUTILS ADMIN - Comptabilité
// ============================================

const TOOLS_ADMIN_COMPTABLE = [
  {
    name: "comptable_facturation",
    description: "Génère et gère les factures. Actions: lister (filtrer par statut/client/date), creer (à partir d'un rdv_id ou générer toutes les manquantes), exporter (obtenir le lien PDF par facture_id ou numero).",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["creer", "lister", "exporter"] },
        periode: { type: "string" },
        rdv_id: { type: "integer", description: "ID du RDV pour créer sa facture" },
        facture_id: { type: "integer", description: "ID de la facture à exporter" },
        numero: { type: "string", description: "Numéro de facture (ex: FAC-2026-00001)" },
        statut: { type: "string", enum: ["brouillon", "generee", "envoyee", "payee", "annulee"] },
        client_id: { type: "integer" },
        format: { type: "string", enum: ["pdf", "csv"] },
        limit: { type: "integer" }
      },
      required: []
    }
  },
  {
    name: "comptable_depenses",
    description: "Gère les dépenses.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["ajouter", "lister", "analyser"] },
        categorie: { type: "string" },
        montant: { type: "number" },
        description: { type: "string" },
        periode: { type: "string" }
      },
      required: []
    }
  },
  {
    name: "comptable_tresorerie",
    description: "Analyse la trésorerie.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["voir", "prevision", "flux"] },
        periode: { type: "string" }
      },
      required: []
    }
  },
  {
    name: "comptable_fiscal",
    description: "Gestion fiscale (TVA, URSSAF).",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["tva", "urssaf", "cotisations"] },
        periode: { type: "string" },
        action: { type: "string", enum: ["calculer", "echeances", "declarer"] }
      },
      required: []
    }
  },
  {
    name: "comptable_rapport",
    description: "Génère un rapport comptable.",
    input_schema: {
      type: "object",
      properties: {
        type_rapport: { type: "string", enum: ["mensuel", "trimestriel", "annuel"] },
        periode: { type: "string" },
        format: { type: "string", enum: ["resume", "complet"] }
      },
      required: []
    }
  }
];

// ============================================
// OUTILS ADMIN PRO - Capabilities avancées (Pro/Business uniquement)
// ============================================

const TOOLS_ADMIN_PRO = [
  {
    name: "executeAdvancedQuery",
    description: `Execute une requête avancée sur les données du tenant en langage naturel.
      Exemples:
      - "Tous les clients inactifs depuis plus de 90 jours"
      - "Top 5 des services les plus réservés ce mois"
      - "Clients qui ont dépensé plus de 500€ cette année"
      - "Taux d'annulation par jour de la semaine"
      - "Chiffre d'affaires du mois"`,
    input_schema: {
      type: "object",
      properties: {
        query_description: {
          type: "string",
          description: "Description en langage naturel de la requête souhaitée"
        }
      },
      required: ["query_description"]
    }
  },
  {
    name: "createAutomation",
    description: `Crée une automation (workflow automatique).
      Exemples:
      - "Relancer automatiquement les clients sans RDV depuis 60 jours"
      - "Envoyer SMS de rappel 24h avant chaque RDV"
      - "Ajouter tag VIP aux clients avec + de 10 RDV"
      - "Envoyer email d'anniversaire aux clients"`,
    input_schema: {
      type: "object",
      properties: {
        automation_description: {
          type: "string",
          description: "Description de l'automation à créer"
        }
      },
      required: ["automation_description"]
    }
  },
  {
    name: "scheduleTask",
    description: `Planifie une tâche à exécuter régulièrement.
      Exemples:
      - "Envoyer promo -20% tous les lundis à 9h"
      - "Exporter liste clients tous les 1er du mois"
      - "Rappel stock bas tous les vendredis"
      - "Rapport hebdomadaire chaque dimanche"`,
    input_schema: {
      type: "object",
      properties: {
        task_description: {
          type: "string",
          description: "Description de la tâche à planifier"
        }
      },
      required: ["task_description"]
    }
  },
  {
    name: "analyzePattern",
    description: `Analyse des patterns dans les données métier.
      Exemples:
      - "Quel service marche le mieux le samedi ?"
      - "Quand est-ce qu'on a le plus d'annulations ?"
      - "Quel est le profil type de nos clients VIP ?"
      - "Quels créneaux horaires sont les plus demandés ?"`,
    input_schema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "Question d'analyse métier"
        }
      },
      required: ["question"]
    }
  }
];

// ============================================
// OUTILS ADMIN - RH (Ressources Humaines)
// ============================================

const TOOLS_ADMIN_RH = [
  // ========= NOUVEAUX OUTILS RH BASE DE DONNÉES =========
  {
    name: "rh_liste_equipe",
    description: "Liste tous les membres de l'équipe avec leurs informations (rôle, contrat, heures/semaine, statut actif).",
    input_schema: {
      type: "object",
      properties: {
        actif: {
          type: "boolean",
          description: "Filtrer par statut actif (true/false). Par défaut: tous"
        },
        role: {
          type: "string",
          description: "Filtrer par rôle (coiffeuse, manager, etc.)"
        }
      },
      required: []
    }
  },
  {
    name: "rh_heures_mois",
    description: "Récupère les heures travaillées d'un membre ou de toute l'équipe sur un mois donné. Inclut heures normales, supplémentaires, et écart vs heures attendues.",
    input_schema: {
      type: "object",
      properties: {
        membre_id: {
          type: "string",
          description: "UUID du membre. Si non spécifié, retourne les heures de toute l'équipe"
        },
        mois: {
          type: "string",
          description: "Mois au format YYYY-MM (ex: 2026-02). Par défaut: mois en cours"
        }
      },
      required: []
    }
  },
  {
    name: "rh_absences",
    description: "Liste les absences (congés, maladies, RTT) avec filtres optionnels. Peut aussi créer ou valider une absence.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["lister", "creer", "valider", "refuser"],
          description: "Action à effectuer. Par défaut: lister"
        },
        membre_id: {
          type: "string",
          description: "UUID du membre (pour filtrer ou créer)"
        },
        statut: {
          type: "string",
          enum: ["en_attente", "approuve", "refuse", "annule", "tous"],
          description: "Filtrer par statut d'absence"
        },
        type_absence: {
          type: "string",
          enum: ["conge_paye", "rtt", "maladie", "maternite", "paternite", "sans_solde", "formation", "evenement_familial", "autre"],
          description: "Type d'absence (pour création ou filtre)"
        },
        date_debut: {
          type: "string",
          description: "Date début absence YYYY-MM-DD (pour création ou filtre)"
        },
        date_fin: {
          type: "string",
          description: "Date fin absence YYYY-MM-DD (pour création ou filtre)"
        },
        absence_id: {
          type: "string",
          description: "UUID de l'absence (pour validation/refus)"
        },
        motif: {
          type: "string",
          description: "Motif de l'absence (pour création)"
        },
        commentaire_refus: {
          type: "string",
          description: "Commentaire en cas de refus"
        }
      },
      required: []
    }
  },
  {
    name: "rh_stats",
    description: "Statistiques RH globales: effectif actif, heures travaillées totales, heures supplémentaires, jours d'absence par type, absences en attente.",
    input_schema: {
      type: "object",
      properties: {
        mois: {
          type: "string",
          description: "Mois au format YYYY-MM. Par défaut: mois en cours"
        }
      },
      required: []
    }
  },
  // ========= OUTILS RH EXISTANTS =========
  {
    name: "rh_planning",
    description: "Gère le planning de travail (shifts).",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["voir", "modifier", "optimiser"] },
        semaine: { type: "string", description: "Semaine au format YYYY-WXX (ex: 2026-W06)" },
        modifications: { type: "object" }
      },
      required: []
    }
  },
  {
    name: "rh_temps_travail",
    description: "Analyse le temps de travail.",
    input_schema: {
      type: "object",
      properties: {
        periode: { type: "string" },
        type: { type: "string", enum: ["heures", "productivite", "repartition"] }
      },
      required: []
    }
  },
  {
    name: "rh_conges",
    description: "Gère les congés et jours de repos.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["poser", "voir", "annuler"] },
        date_debut: { type: "string" },
        date_fin: { type: "string" },
        motif: { type: "string" }
      },
      required: []
    }
  },
  {
    name: "rh_objectifs",
    description: "Définit et suit les objectifs personnels.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["voir", "definir", "suivre"] },
        type_objectif: { type: "string" },
        periode: { type: "string" }
      },
      required: []
    }
  },
  {
    name: "rh_formation",
    description: "Recherche et planifie des formations.",
    input_schema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["rechercher", "planifier", "historique"] },
        domaine: { type: "string" }
      },
      required: []
    }
  },
  {
    name: "rh_bien_etre",
    description: "Conseils sur l'équilibre travail/vie.",
    input_schema: {
      type: "object",
      properties: {
        aspect: { type: "string", enum: ["stress", "equilibre", "organisation", "global"] }
      },
      required: []
    }
  }
];

// ============================================
// OUTILS ADMIN - Agenda Personnel (Événements business)
// ============================================

const TOOLS_ADMIN_AGENDA = [
  {
    name: "agenda_creer_evenement",
    description: `Crée un événement dans l'agenda personnel de l'entrepreneur (meeting, appel, rappel, tâche).

IMPORTANT - CALCUL DE DATE:
- TOUJOURS utiliser get_upcoming_days AVANT cet outil pour obtenir la date exacte
- Exemple: si l'utilisateur dit "le 24", utilise get_upcoming_days pour trouver 2026-02-24
- Ne PAS deviner la date, TOUJOURS vérifier avec get_upcoming_days

IMPORTANT - HEURE DE FIN:
- Si l'utilisateur dit "de 10h à 11h30", tu DOIS passer heure="10:00" ET heure_fin="11:30"
- Ne pas oublier heure_fin quand une plage horaire est indiquée`,
    input_schema: {
      type: "object",
      properties: {
        titre: {
          type: "string",
          description: "Titre de l'événement (ex: 'RDV avec Sophie Sanchez')"
        },
        date: {
          type: "string",
          description: "Date au format YYYY-MM-DD. OBLIGATOIRE: utilise get_upcoming_days pour obtenir la date exacte"
        },
        heure: {
          type: "string",
          description: "Heure de début au format HH:MM (ex: 10:00)"
        },
        heure_fin: {
          type: "string",
          description: "Heure de fin au format HH:MM. OBLIGATOIRE si l'utilisateur indique une plage horaire (ex: 'de 10h à 11h30' → heure_fin='11:30')"
        },
        type: {
          type: "string",
          enum: ["meeting", "call", "task", "reminder", "personal", "other"],
          description: "Type d'événement (défaut: meeting)"
        },
        lieu: {
          type: "string",
          description: "Lieu de l'événement (optionnel)"
        },
        description: {
          type: "string",
          description: "Description ou notes (optionnel)"
        },
        participants: {
          type: "string",
          description: "Participants (optionnel, ex: 'Sophie Sanchez, Jean Dupont')"
        }
      },
      required: ["titre", "date", "heure"]
    }
  },
  {
    name: "agenda_lister_evenements",
    description: "Liste les événements de l'agenda personnel. Peut filtrer par période ou date spécifique.",
    input_schema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Date spécifique YYYY-MM-DD"
        },
        debut: {
          type: "string",
          description: "Date début de période YYYY-MM-DD"
        },
        fin: {
          type: "string",
          description: "Date fin de période YYYY-MM-DD"
        },
        type: {
          type: "string",
          enum: ["meeting", "call", "task", "reminder", "personal", "other", "all"],
          description: "Filtrer par type"
        }
      },
      required: []
    }
  },
  {
    name: "agenda_aujourdhui",
    description: "Récupère les événements de l'agenda pour aujourd'hui. Pratique pour le briefing du matin.",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "agenda_prochains",
    description: "Récupère les prochains événements à venir (non terminés).",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Nombre d'événements à retourner (défaut: 10)"
        }
      },
      required: []
    }
  },
  {
    name: "agenda_modifier_evenement",
    description: "Modifie un événement existant de l'agenda.",
    input_schema: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "ID de l'événement à modifier"
        },
        titre: { type: "string" },
        date: { type: "string" },
        heure: { type: "string" },
        heure_fin: { type: "string" },
        type: { type: "string" },
        lieu: { type: "string" },
        description: { type: "string" },
        participants: { type: "string" },
        completed: { type: "boolean", description: "Marquer comme terminé" }
      },
      required: ["event_id"]
    }
  },
  {
    name: "agenda_supprimer_evenement",
    description: "Supprime un événement de l'agenda.",
    input_schema: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "ID de l'événement à supprimer"
        }
      },
      required: ["event_id"]
    }
  },
  {
    name: "agenda_marquer_termine",
    description: "Marque un événement comme terminé ou non terminé.",
    input_schema: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "ID de l'événement"
        },
        termine: {
          type: "boolean",
          description: "true pour marquer comme terminé, false pour non terminé (défaut: true)"
        }
      },
      required: ["event_id"]
    }
  }
];

// ============================================
// ASSEMBLAGE DES OUTILS ADMIN
// ============================================

export const TOOLS_ADMIN = [
  // Inclut tous les outils clients
  ...TOOLS_CLIENT,
  // Outils de gestion
  ...TOOLS_ADMIN_GESTION,
  // SEO
  ...TOOLS_ADMIN_SEO,
  // Marketing
  ...TOOLS_ADMIN_MARKETING,
  // Stratégie Business
  ...TOOLS_ADMIN_STRATEGIE,
  // Analytics & Prédictions
  ...TOOLS_ADMIN_ANALYTICS,
  // Réseaux sociaux
  ...TOOLS_ADMIN_SOCIAL,
  // Commercial
  ...TOOLS_ADMIN_COMMERCIAL,
  // Comptabilité
  ...TOOLS_ADMIN_COMPTABLE,
  // RH
  ...TOOLS_ADMIN_RH,
  // Création de contenu
  ...TOOLS_ADMIN_CONTENU,
  // Scripts vidéo viraux
  ...TOOLS_ADMIN_VIDEO,
  // Mémoire
  ...TOOLS_ADMIN_MEMOIRE,
  // Planification
  ...TOOLS_ADMIN_PLANIFICATION,
  // Agent autonome
  ...TOOLS_ADMIN_AGENT,
  // Recherche web
  ...TOOLS_ADMIN_RECHERCHE,
  // PRO/BUSINESS - Capabilities avancées
  ...TOOLS_ADMIN_PRO,
  // Agenda personnel entrepreneur
  ...TOOLS_ADMIN_AGENDA
  // SUPPRIMÉS: FICHIERS (9), GDRIVE (10), COMPUTER_USE (10), SANDBOX (12), ENVIRONNEMENTS (10)
];

// ============================================
// OUTILS PAR PLAN (modele 2026 : Free, Starter, Pro, Business, Enterprise)
// ============================================

/**
 * Retourne les outils disponibles selon le plan du tenant
 * Modele 2026 — revision 30 avril 2026 (voir memory/business-model-2026.md):
 * - Free       : outils de gestion de base UNIQUEMENT (pas d'IA — fonctions IA bloquees)
 * - Starter    : 69€/mois, TOUS les outils, 4 000 credits IA inclus/mois
 * - Pro        : 199€/mois, TOUS les outils, 20 000 credits IA inclus/mois
 * - Business   : 499€/mois, TOUS les outils, 50 000 credits IA inclus/mois
 * - Enterprise : 899€/mois, TOUS les outils, 100 000 credits IA inclus/mois
 *
 * NOTE: 'basic' est conserve comme alias retro-compat de 'starter'
 */
export function getToolsForPlan(plan) {
  const rawPlan = plan?.toLowerCase() || 'free';
  // Normalisation legacy (basic→starter retro-compat)
  const basePlan = rawPlan === 'basic' ? 'starter' : rawPlan;

  // Outils de gestion (sans IA) — disponibles meme en Free
  const baseTools = [
    ...TOOLS_CLIENT,
    ...TOOLS_ADMIN_GESTION,
    ...TOOLS_ADMIN_COMPTABLE,
    ...TOOLS_ADMIN_PLANIFICATION,
    ...TOOLS_ADMIN_AGENDA
  ];

  // Plan Free (0€): outils de gestion uniquement, IA bloquee
  if (basePlan === 'free') {
    return baseTools;
  }

  // Plans payants (Starter/Pro/Business): TOUS les outils
  // Starter = 1 000 credits, Pro = 5 000, Business = 20 000 credits inclus/mois
  if (basePlan === 'starter' || basePlan === 'pro' || basePlan === 'business' || basePlan === 'enterprise') {
    return TOOLS_ADMIN;
  }

  // Fallback: free (le plus restrictif)
  return baseTools;
}

// ============================================
// FILTRAGE OUTILS PAR TYPE DE BUSINESS
// ============================================

const RESTAURANT_ONLY_TOOLS = [
  'get_restaurant_info', 'get_menu', 'get_menu_du_jour',
  'check_allergenes', 'check_table_availability'
];
const HOTEL_ONLY_TOOLS = [
  'get_hotel_info', 'get_chambres_disponibles', 'check_room_availability'
];
const DOMICILE_ONLY_TOOLS = ['calculate_travel_fee'];

const BUSINESS_TOOLS_INCLUDE = {
  restaurant: RESTAURANT_ONLY_TOOLS,
  hotel: HOTEL_ONLY_TOOLS,
  service_domicile: DOMICILE_ONLY_TOOLS,
  salon: [],
  commerce: [],    // future: order management tools
  security: [],    // future: devis/mission tools
  service: [],     // generic tools only (rdv, facturation)
};

const ALL_BUSINESS_SPECIFIC = [
  ...RESTAURANT_ONLY_TOOLS, ...HOTEL_ONLY_TOOLS, ...DOMICILE_ONLY_TOOLS
];

/**
 * Retourne les outils filtrés par plan ET type de business
 * Un salon ne voit pas les outils restaurant/hotel/domicile, etc.
 */
export function getToolsForPlanAndBusiness(plan, businessType) {
  const planTools = getToolsForPlan(plan);
  const type = businessType?.toLowerCase() || 'salon';
  const include = BUSINESS_TOOLS_INCLUDE[type] || [];

  return planTools.filter(t => {
    // Outils génériques → toujours inclus
    if (!ALL_BUSINESS_SPECIFIC.includes(t.name)) return true;
    // Outils métier → inclus seulement si le business type le requiert
    return include.includes(t.name);
  });
}

/**
 * Vérifie si un outil est disponible pour un plan donné
 */
export function isToolAvailableForPlan(toolName, plan) {
  const availableTools = getToolsForPlan(plan);
  return availableTools.some(t => t.name === toolName);
}

// Export des outils PRO pour import externe
export { TOOLS_ADMIN_PRO };

// ============================================
// HELPERS
// ============================================

/**
 * Récupère les outils par catégorie
 */
export function getToolsByCategory(category) {
  const categories = {
    client: TOOLS_CLIENT,
    gestion: TOOLS_ADMIN_GESTION,
    seo: TOOLS_ADMIN_SEO,
    marketing: TOOLS_ADMIN_MARKETING,
    strategie: TOOLS_ADMIN_STRATEGIE,
    analytics: TOOLS_ADMIN_ANALYTICS,
    social: TOOLS_ADMIN_SOCIAL,
    commercial: TOOLS_ADMIN_COMMERCIAL,
    comptable: TOOLS_ADMIN_COMPTABLE,
    rh: TOOLS_ADMIN_RH,
    contenu: TOOLS_ADMIN_CONTENU,
    video: TOOLS_ADMIN_VIDEO,
    memoire: TOOLS_ADMIN_MEMOIRE,
    planification: TOOLS_ADMIN_PLANIFICATION,
    agent: TOOLS_ADMIN_AGENT,
    recherche: TOOLS_ADMIN_RECHERCHE,
    agenda: TOOLS_ADMIN_AGENDA,
    admin: TOOLS_ADMIN
  };
  return categories[category] || [];
}

/**
 * Récupère un outil par son nom
 */
export function getToolByName(name) {
  return TOOLS_ADMIN.find(t => t.name === name);
}

/**
 * Liste tous les noms d'outils disponibles
 */
export function listToolNames(type = 'admin') {
  const tools = type === 'client' ? TOOLS_CLIENT : TOOLS_ADMIN;
  return tools.map(t => t.name);
}

// ============================================
// STATISTIQUES
// ============================================

export const TOOLS_STATS = {
  client: TOOLS_CLIENT.length,
  gestion: TOOLS_ADMIN_GESTION.length,
  seo: TOOLS_ADMIN_SEO.length,
  marketing: TOOLS_ADMIN_MARKETING.length,
  strategie: TOOLS_ADMIN_STRATEGIE.length,
  analytics: TOOLS_ADMIN_ANALYTICS.length,
  social: TOOLS_ADMIN_SOCIAL.length,
  commercial: TOOLS_ADMIN_COMMERCIAL.length,
  comptable: TOOLS_ADMIN_COMPTABLE.length,
  rh: TOOLS_ADMIN_RH.length,
  contenu: TOOLS_ADMIN_CONTENU.length,
  video: TOOLS_ADMIN_VIDEO.length,
  memoire: TOOLS_ADMIN_MEMOIRE.length,
  planification: TOOLS_ADMIN_PLANIFICATION.length,
  agent: TOOLS_ADMIN_AGENT.length,
  recherche: TOOLS_ADMIN_RECHERCHE.length,
  agenda: TOOLS_ADMIN_AGENDA.length,
  admin_total: TOOLS_ADMIN.length
};

console.log(`[TOOLS REGISTRY] Chargé: ${TOOLS_CLIENT.length} outils client, ${TOOLS_ADMIN.length} outils admin`);

export default {
  TOOLS_CLIENT,
  TOOLS_ADMIN,
  getToolsByCategory,
  getToolByName,
  getToolsForPlanAndBusiness,
  listToolNames,
  TOOLS_STATS
};
