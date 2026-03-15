/**
 * Environment Manager Service
 *
 * Gère les environnements de Halimah et fournit des données mock en dev
 */

import {
  Environments,
  getCurrentEnvironment,
  getConfig,
  getConfigValue,
  setEnvironment,
  isProduction,
  isDevelopment,
  isStaging,
  isFeatureEnabled,
  getEnvironmentInfo,
  listEnvironments,
  canPerformAction
} from '../config/environments.js';
import fs from 'fs';
import path from 'path';

// ============ DONNÉES MOCK POUR DEV ============

const mockData = {
  clients: [
    { id: 'mock_1', name: 'Marie Dupont', phone: '+33600000001', email: 'marie@test.com', lastVisit: '2026-01-15' },
    { id: 'mock_2', name: 'Fatima Diallo', phone: '+33600000002', email: 'fatima@test.com', lastVisit: '2026-01-20' },
    { id: 'mock_3', name: 'Sophie Martin', phone: '+33600000003', email: 'sophie@test.com', lastVisit: '2026-01-10' },
    { id: 'mock_4', name: 'Aminata Sy', phone: '+33600000004', email: 'aminata@test.com', lastVisit: '2026-01-18' },
    { id: 'mock_5', name: 'Claire Dubois', phone: '+33600000005', email: 'claire@test.com', lastVisit: '2026-01-22' }
  ],
  bookings: [
    { id: 'book_1', clientId: 'mock_1', clientName: 'Marie Dupont', service: 'Locks', date: '2026-01-25', time: '10:00', status: 'confirmed', price: 150 },
    { id: 'book_2', clientId: 'mock_2', clientName: 'Fatima Diallo', service: 'Tresses', date: '2026-01-26', time: '14:00', status: 'pending', price: 80 },
    { id: 'book_3', clientId: 'mock_3', clientName: 'Sophie Martin', service: 'Soins', date: '2026-01-27', time: '11:00', status: 'confirmed', price: 40 },
    { id: 'book_4', clientId: 'mock_4', clientName: 'Aminata Sy', service: 'Box Braids', date: '2026-01-28', time: '09:00', status: 'pending', price: 120 }
  ],
  services: [
    { id: 'srv_1', name: 'Création Locks', price: 150, duration: 180, category: 'locks' },
    { id: 'srv_2', name: 'Entretien Locks', price: 60, duration: 90, category: 'locks' },
    { id: 'srv_3', name: 'Tresses classiques', price: 80, duration: 120, category: 'tresses' },
    { id: 'srv_4', name: 'Box Braids', price: 120, duration: 180, category: 'tresses' },
    { id: 'srv_5', name: 'Nattes collées', price: 50, duration: 90, category: 'nattes' },
    { id: 'srv_6', name: 'Soins hydratants', price: 40, duration: 60, category: 'soins' }
  ],
  stats: {
    ca_jour: 280,
    ca_semaine: 1450,
    ca_mois: 5200,
    rdv_aujourdhui: 3,
    rdv_semaine: 12,
    clients_total: 47,
    service_populaire: 'Locks'
  }
};

// ============ ENVIRONMENT MANAGER ============

export const EnvironmentManager = {

  // ============ INFO ============

  /**
   * Récupère l'environnement actuel et ses infos
   */
  getCurrent() {
    return getEnvironmentInfo();
  },

  /**
   * Liste tous les environnements
   */
  list() {
    return listEnvironments();
  },

  // ============ SWITCH ============

  /**
   * Change d'environnement
   */
  switchTo(env) {
    // Vérification de sécurité
    if (env === Environments.PRODUCTION) {
      console.warn('[ENV] ⚠️  Passage en PRODUCTION demandé');
      console.warn('[ENV]    Toutes les actions seront réelles !');
    }

    const success = setEnvironment(env);

    return {
      success,
      environment: success ? getEnvironmentInfo() : null,
      message: success
        ? `Environnement changé vers ${env}`
        : `Échec du changement vers ${env}`
    };
  },

  /**
   * Raccourcis
   */
  switchToDev() {
    return this.switchTo(Environments.DEVELOPMENT);
  },

  switchToStaging() {
    return this.switchTo(Environments.STAGING);
  },

  switchToProduction() {
    return this.switchTo(Environments.PRODUCTION);
  },

  // ============ VÉRIFICATIONS ============

  /**
   * Vérifie si une action est autorisée
   */
  canDo(action) {
    const allowed = canPerformAction(action);
    return {
      allowed,
      action,
      environment: getCurrentEnvironment(),
      reason: allowed
        ? 'Action autorisée'
        : `Action "${action}" non autorisée en ${getCurrentEnvironment()}`
    };
  },

  /**
   * Vérifie si une fonctionnalité est active
   */
  isEnabled(feature) {
    return {
      feature,
      enabled: isFeatureEnabled(feature),
      environment: getCurrentEnvironment()
    };
  },

  // ============ DONNÉES ============

  /**
   * Récupère des données selon l'environnement
   * En dev: données mock
   * En staging/prod: vraies données
   */
  async getData(type) {
    if (isDevelopment()) {
      console.log(`[ENV] 🔧 [DEV] Utilisation des données mock pour: ${type}`);
      return {
        source: 'mock',
        environment: 'development',
        data: mockData[type] || [],
        message: `Données mock pour ${type} (${(mockData[type] || []).length} éléments)`
      };
    }

    // En staging/prod, on utilise la vraie DB
    console.log(`[ENV] 📦 [${getCurrentEnvironment().toUpperCase()}] Données réelles pour: ${type}`);
    return {
      source: 'database',
      environment: getCurrentEnvironment(),
      data: null,  // Les vraies données viennent de la DB
      message: `Utilisez les outils de base de données pour récupérer les vraies données`
    };
  },

  /**
   * Récupère la config pour une feature
   */
  getFeatureConfig(feature) {
    return getConfigValue(feature);
  },

  // ============ SIMULATION RÉPONSES ============

  /**
   * Simule une réponse d'API en dev
   */
  mockApiResponse(api, action) {
    if (!isDevelopment() && !isFeatureEnabled('mock')) {
      return null;  // Pas de mock hors dev
    }

    const mockResponses = {
      instagram: {
        post: {
          success: true,
          postId: 'mock_post_' + Date.now(),
          url: 'https://instagram.com/p/mock123',
          message: '[MOCK] Post Instagram simulé avec succès'
        },
        login: {
          success: true,
          username: 'test_nexus',
          message: '[MOCK] Connexion Instagram simulée'
        },
        stats: {
          success: true,
          followers: 1234,
          posts: 45,
          engagement: '4.5%',
          message: '[MOCK] Stats Instagram simulées'
        }
      },
      facebook: {
        post: {
          success: true,
          postId: 'mock_fb_' + Date.now(),
          url: 'https://facebook.com/post/mock123',
          message: '[MOCK] Post Facebook simulé avec succès'
        },
        login: {
          success: true,
          message: '[MOCK] Connexion Facebook simulée'
        }
      },
      tiktok: {
        post: {
          success: true,
          videoId: 'mock_tiktok_' + Date.now(),
          message: '[MOCK] Vidéo TikTok simulée avec succès'
        },
        login: {
          success: true,
          message: '[MOCK] Connexion TikTok simulée'
        }
      },
      dalle: {
        generate: {
          success: true,
          url: 'https://via.placeholder.com/1024x1024.png?text=MOCK+IMAGE',
          localPath: '/generated/mock-image-' + Date.now() + '.png',
          message: '[MOCK] Image DALL-E simulée (placeholder)',
          mock: true
        }
      },
      whatsapp: {
        send: {
          success: true,
          messageId: 'mock_wa_' + Date.now(),
          message: '[MOCK] Message WhatsApp simulé'
        }
      },
      email: {
        send: {
          success: true,
          messageId: 'mock_email_' + Date.now(),
          message: '[MOCK] Email simulé'
        }
      },
      sms: {
        send: {
          success: true,
          messageId: 'mock_sms_' + Date.now(),
          message: '[MOCK] SMS simulé'
        }
      },
      tavily: {
        search: {
          success: true,
          results: [
            { title: '[MOCK] Résultat 1', url: 'https://example.com/1', snippet: 'Description mock...' },
            { title: '[MOCK] Résultat 2', url: 'https://example.com/2', snippet: 'Description mock...' }
          ],
          message: '[MOCK] Recherche web simulée'
        }
      }
    };

    return mockResponses[api]?.[action] || { success: true, message: '[MOCK] Action simulée', mock: true };
  },

  /**
   * Wrapper pour exécuter une action avec mock en dev
   */
  async executeWithMock(api, action, realAction) {
    // En dev, retourner le mock
    if (isDevelopment()) {
      this.log('info', `[MOCK] ${api}.${action}`, { api, action });
      return this.mockApiResponse(api, action);
    }

    // Sinon, exécuter l'action réelle
    try {
      return await realAction();
    } catch (error) {
      this.log('error', `Erreur ${api}.${action}`, { error: error.message });
      throw error;
    }
  },

  // ============ LOGS ============

  /**
   * Log une action avec contexte environnement
   */
  log(level, message, data = {}) {
    const config = getConfig();
    const env = getCurrentEnvironment();
    const emoji = config.emoji;

    const logEntry = {
      timestamp: new Date().toISOString(),
      environment: env,
      level,
      message,
      data
    };

    // Afficher selon le niveau de log configuré
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(config.debug.logLevel);
    const messageLevel = levels.indexOf(level);

    if (messageLevel >= configLevel) {
      const levelEmojis = { debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌' };
      console.log(`${emoji} [${env.toUpperCase()}] ${levelEmojis[level] || ''} ${message}`);
      if (Object.keys(data).length > 0 && config.debug.verbose) {
        console.log('   Data:', JSON.stringify(data, null, 2));
      }
    }

    // Sauvegarder si configuré
    if (config.debug.saveAllRequests) {
      this.saveLog(logEntry);
    }

    return logEntry;
  },

  /**
   * Sauvegarde un log
   */
  saveLog(logEntry) {
    try {
      const logsDir = path.join(process.cwd(), 'data', 'logs', logEntry.environment);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(logsDir, `${today}.json`);

      let logs = [];
      if (fs.existsSync(logFile)) {
        try {
          logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
        } catch {
          logs = [];
        }
      }

      logs.push(logEntry);
      fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('[ENV] Erreur sauvegarde log:', error.message);
    }
  },

  // ============ COMPARAISON ============

  /**
   * Compare les configs entre environnements
   */
  compareEnvironments(env1, env2) {
    // Sauvegarder l'environnement actuel
    const current = getCurrentEnvironment();

    // Récupérer les configs
    setEnvironment(env1);
    const config1 = getEnvironmentInfo();

    setEnvironment(env2);
    const config2 = getEnvironmentInfo();

    // Revenir à l'environnement initial
    setEnvironment(current);

    const differences = this.findDifferences(config1.features, config2.features, 'features');

    return {
      env1: { id: env1, ...config1 },
      env2: { id: env2, ...config2 },
      differences,
      summary: `${differences.length} différence(s) entre ${env1} et ${env2}`
    };
  },

  findDifferences(obj1, obj2, basePath = '') {
    const diffs = [];

    const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);

    for (const key of allKeys) {
      const fullPath = basePath ? `${basePath}.${key}` : key;
      const val1 = obj1?.[key];
      const val2 = obj2?.[key];

      if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
        diffs.push(...this.findDifferences(val1, val2, fullPath));
      } else if (val1 !== val2) {
        diffs.push({
          path: fullPath,
          value1: val1,
          value2: val2
        });
      }
    }

    return diffs;
  },

  // ============ HELPERS ============

  /**
   * Affiche un résumé de l'environnement au démarrage
   */
  printStartupSummary() {
    const config = getConfig();
    const env = getCurrentEnvironment();

    console.log('\n' + '='.repeat(50));
    console.log(`${config.emoji} HALIMAH démarrée en mode: ${config.name}`);
    console.log(`   ${config.description}`);
    console.log('='.repeat(50));

    console.log('\nFeatures activées:');
    console.log(`  - Réseaux sociaux: ${config.social.enabled ? '✅' : '❌'} ${config.social.mockResponses ? '(mock)' : ''}`);
    console.log(`  - DALL-E: ${config.apis.dalleEnabled ? '✅' : '❌'}`);
    console.log(`  - Tavily: ${config.apis.tavilyEnabled ? '✅' : '❌'}`);
    console.log(`  - WhatsApp: ${config.notifications.whatsapp ? '✅' : '❌'}`);
    console.log(`  - Email: ${config.notifications.email ? '✅' : '❌'}`);
    console.log(`  - Paiements live: ${!config.payments.stripe.testMode ? '✅' : '❌ (test)'}`);

    console.log('\nLimites:');
    console.log(`  - Posts/jour: ${config.limits.maxPostsPerDay}`);
    console.log(`  - Appels API: ${config.limits.maxApiCalls}`);

    console.log('\nDebug:');
    console.log(`  - Log level: ${config.debug.logLevel}`);
    console.log(`  - Verbose: ${config.debug.verbose ? '✅' : '❌'}`);
    console.log('');
  }
};

export default EnvironmentManager;
