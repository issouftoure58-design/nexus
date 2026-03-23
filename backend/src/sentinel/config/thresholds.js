/**
 * SENTINEL - Configuration des seuils d'alerte
 */

export const THRESHOLDS = {
  // Seuils de couts horaires (plateforme globale)
  hourly: {
    warning: 5,       // 5 EUR/h -> alerte email
    critical: 10,     // 10 EUR/h -> alerte SMS
  },
  // Seuils de couts journaliers
  daily: {
    warning: 15,      // 15 EUR -> alerte email
    critical: 25,     // 25 EUR -> alerte SMS
    shutdown: 100     // 100 EUR -> mode degrade
  },
  monthly: {
    warning: 500,
    critical: 800,
    shutdown: 1000
  },

  // Seuils memoire (en pourcentage)
  memory: {
    warning: 75,
    critical: 90
  },

  // Seuils latence DB (en ms)
  dbLatency: {
    warning: 1000,
    critical: 2000
  },

  // Seuils rate limiting
  rateLimit: {
    perMinute: 20,
    perHour: 200,
    perDay: 1000
  },

  // Seuils erreurs
  errors: {
    perHour: {
      warning: 10,
      critical: 50
    },
    perDay: {
      warning: 100,
      critical: 500
    }
  }
};

export const ALERT_PHONE = process.env.SENTINEL_ALERT_PHONE || null;

export default THRESHOLDS;
