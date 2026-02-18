#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NEW_PASSWORD = 'Admin123';
const EMAIL = process.argv[2] || 'fatou@fatshairafro.fr';

async function main() {
  console.log(`Resetting password for: ${EMAIL}`);

  const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);

  const { data, error } = await supabase
    .from('admin_users')
    .update({
      password_hash: passwordHash,
      failed_login_attempts: 0,
      locked_until: null
    })
    .eq('email', EMAIL)
    .select('email, nom, tenant_id');

  if (error) {
    console.log('Erreur:', error.message);
  } else if (data.length === 0) {
    console.log('Utilisateur non trouvé');
  } else {
    console.log('Mot de passe réinitialisé pour:', data[0].email);
    console.log('Nouveau mot de passe:', NEW_PASSWORD);
  }
}

main();
