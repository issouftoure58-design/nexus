/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   TOOL DISPATCHER — Point d'entrée unique pour tous les outils    ║
 * ║   105 outils, 0 crash, O(1) lookup                                ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import logger from '../../config/logger.js';

// Import de tous les handlers
import { statsHandlers } from './statsHandler.js';
import { dateHandlers } from './dateHandler.js';
import { rdvHandlers } from './rdvHandler.js';
import { clientHandlers } from './clientHandler.js';
import { serviceHandlers } from './serviceHandler.js';
import { comptaHandlers } from './comptaHandler.js';
import { marketingHandlers } from './marketingHandler.js';
import { commercialHandlers } from './commercialHandler.js';
import { rhHandlers } from './rhHandler.js';
import { analyticsHandlers } from './analyticsHandler.js';
import { agendaHandlers } from './agendaHandler.js';
import { memoireHandlers } from './memoireHandler.js';
import { planificationHandlers } from './planificationHandler.js';
import { seoHandlers } from './seoHandler.js';
import { strategieHandlers } from './strategieHandler.js';
import { socialHandlers } from './socialHandler.js';
import { agentHandlers } from './agentHandler.js';
import { rechercheHandlers } from './rechercheHandler.js';
import { contenuHandlers } from './contenuHandler.js';
import { videoHandlers } from './videoHandler.js';
import { proHandlers } from './proHandler.js';

// Map O(1) : toolName → handler function
const TOOL_HANDLERS = {
  ...statsHandlers,
  ...dateHandlers,
  ...rdvHandlers,
  ...clientHandlers,
  ...serviceHandlers,
  ...comptaHandlers,
  ...marketingHandlers,
  ...commercialHandlers,
  ...rhHandlers,
  ...analyticsHandlers,
  ...agendaHandlers,
  ...memoireHandlers,
  ...planificationHandlers,
  ...seoHandlers,
  ...strategieHandlers,
  ...socialHandlers,
  ...agentHandlers,
  ...rechercheHandlers,
  ...contenuHandlers,
  ...videoHandlers,
  ...proHandlers
};

/**
 * Execute un outil par son nom
 * @param {string} toolName - Nom de l'outil
 * @param {Object} toolInput - Paramètres de l'outil
 * @param {string} tenantId - ID du tenant (OBLIGATOIRE)
 * @param {string} adminId - ID de l'admin (pour outils agenda, etc.)
 * @returns {Object} Résultat de l'exécution
 */
export async function executeTool(toolName, toolInput, tenantId, adminId = null) {
  // TENANT SHIELD: tenant_id obligatoire
  if (!tenantId) {
    throw new Error('TENANT_SHIELD: tenant_id requis');
  }

  logger.info(`Execution outil: ${toolName}`, { tag: 'ADMIN CHAT', tenantId });

  const handler = TOOL_HANDLERS[toolName];

  if (!handler) {
    logger.warn(`[ADMIN CHAT] Outil non disponible: ${toolName}`, { tenantId });
    return {
      success: false,
      error: `L'outil "${toolName}" n'est pas disponible. Utilisez un outil du registre.`
    };
  }

  try {
    return await handler(toolInput, tenantId, adminId);
  } catch (error) {
    logger.error(`[ADMIN CHAT] Erreur outil ${toolName}:`, error);
    return {
      success: false,
      error: `Erreur lors de l'exécution de ${toolName}: ${error.message}`
    };
  }
}

// Export pour diagnostics
export const REGISTERED_TOOLS = Object.keys(TOOL_HANDLERS);
export const TOOL_COUNT = REGISTERED_TOOLS.length;
