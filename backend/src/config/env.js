/**
 * Chargement des variables d'environnement
 * CE FICHIER DOIT ÊTRE IMPORTÉ EN PREMIER dans index.js
 *
 * Cherche .env dans l'ordre :
 * 1. backend/.env (si existe)
 * 2. racine du projet/.env
 */

import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Chemins possibles pour .env
const paths = [
  resolve(__dirname, '..', '..', '.env'),           // backend/.env
  resolve(__dirname, '..', '..', '..', '.env'),     // racine/.env
];

let loaded = false;

for (const envPath of paths) {
  if (existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`[ENV] ✓ Chargé depuis: ${envPath}`);
      loaded = true;
      break;
    }
  }
}

if (!loaded) {
  console.warn('[ENV] ⚠️ Aucun fichier .env trouvé');
  console.warn('[ENV] Chemins recherchés:', paths);
}

// Validation des variables critiques
const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('[ENV] ❌ Variables manquantes:', missing.join(', '));
  console.error('[ENV] Vérifiez votre fichier .env');
}

export default loaded;
