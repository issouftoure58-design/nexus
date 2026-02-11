/**
 * Client Supabase pour le backend
 * Version JavaScript standalone (ne dépend pas de /server/)
 *
 * NOTE: Les variables d'environnement sont chargées par config/env.js
 *       qui doit être importé EN PREMIER dans index.js
 */

import { createClient } from '@supabase/supabase-js';

// Validation des variables d'environnement
if (!process.env.SUPABASE_URL) {
  console.error('❌ SUPABASE_URL manquante dans .env');
  console.error('   Vérifiez que le fichier .env existe et contient SUPABASE_URL');
  throw new Error('SUPABASE_URL must be set in environment');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY manquante dans .env');
  console.error('   Vérifiez que le fichier .env existe et contient SUPABASE_SERVICE_ROLE_KEY');
  throw new Error('SUPABASE_SERVICE_ROLE_KEY must be set in environment');
}

/**
 * Client Supabase brut (sans filtrage tenant automatique)
 * Utilisé pour les requêtes système et admin
 */
export const rawSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Client Supabase standard
 * Pour le backend, on utilise le même client que rawSupabase
 * Le filtrage par tenant_id est géré manuellement dans les services
 */
export const supabase = rawSupabase;

export default supabase;
