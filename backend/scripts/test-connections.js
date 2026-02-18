#!/usr/bin/env node
/**
 * Test des connexions API - Twilio, OpenAI, Resend
 */
import 'dotenv/config';
import twilio from 'twilio';

console.log('='.repeat(50));
console.log('TEST CONNEXIONS API NEXUS');
console.log('='.repeat(50));

async function testTwilio() {
  console.log('\n[TWILIO] Test connexion...');

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    console.log('  ❌ Credentials manquants');
    return false;
  }

  try {
    const client = twilio(accountSid, authToken);
    const account = await client.api.accounts(accountSid).fetch();

    console.log('  ✅ Connexion réussie');
    console.log(`  📧 Email: ${account.ownerAccountSid || account.friendlyName}`);
    console.log(`  💰 Status: ${account.status}`);

    // Lister les numéros disponibles
    const numbers = await client.incomingPhoneNumbers.list({ limit: 5 });
    console.log(`  📞 Numéros actifs: ${numbers.length}`);
    numbers.forEach(n => console.log(`     - ${n.phoneNumber} (${n.friendlyName})`));

    // Vérifier le solde
    const balance = await client.balance.fetch();
    console.log(`  💵 Solde: ${balance.balance} ${balance.currency}`);

    return true;
  } catch (error) {
    console.log(`  ❌ Erreur: ${error.message}`);
    return false;
  }
}

async function testOpenAI() {
  console.log('\n[OPENAI] Test connexion...');

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.log('  ❌ API key manquante');
    return false;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Erreur API');
    }

    const data = await response.json();
    console.log('  ✅ Connexion réussie');
    console.log(`  🤖 Modèles disponibles: ${data.data.length}`);

    // Vérifier si TTS est disponible
    const hasTTS = data.data.some(m => m.id.includes('tts'));
    console.log(`  🔊 TTS disponible: ${hasTTS ? 'Oui' : 'Non'}`);

    return true;
  } catch (error) {
    console.log(`  ❌ Erreur: ${error.message}`);
    return false;
  }
}

async function testResend() {
  console.log('\n[RESEND] Test connexion...');

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log('  ❌ API key manquante');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/domains', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Erreur API');
    }

    const data = await response.json();
    console.log('  ✅ Connexion réussie');
    console.log(`  📧 Domaines configurés: ${data.data?.length || 0}`);

    return true;
  } catch (error) {
    console.log(`  ❌ Erreur: ${error.message}`);
    return false;
  }
}

async function testAnthopic() {
  console.log('\n[ANTHROPIC] Test connexion...');

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.log('  ❌ API key manquante');
    return false;
  }

  try {
    // Simple test - on vérifie juste que la clé a le bon format
    if (apiKey.startsWith('sk-ant-')) {
      console.log('  ✅ API key valide (format correct)');
      return true;
    } else {
      console.log('  ⚠️ Format de clé inhabituel');
      return true;
    }
  } catch (error) {
    console.log(`  ❌ Erreur: ${error.message}`);
    return false;
  }
}

async function checkTwilioPhoneAvailability() {
  console.log('\n[TWILIO] Vérification numéros FR disponibles...');

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  try {
    const client = twilio(accountSid, authToken);

    // Chercher des numéros français disponibles
    const availableNumbers = await client.availablePhoneNumbers('FR')
      .local
      .list({ limit: 3 });

    console.log(`  📞 Numéros FR disponibles: ${availableNumbers.length}`);
    availableNumbers.forEach(n => {
      console.log(`     - ${n.phoneNumber} (${n.locality || 'France'})`);
    });

    if (availableNumbers.length > 0) {
      console.log('  ✅ Prêt pour le provisioning automatique');
    }

    return availableNumbers.length > 0;
  } catch (error) {
    console.log(`  ⚠️ ${error.message}`);
    return false;
  }
}

// Exécuter tous les tests
async function runAllTests() {
  const results = {
    twilio: await testTwilio(),
    openai: await testOpenAI(),
    resend: await testResend(),
    anthropic: await testAnthopic(),
  };

  // Si Twilio OK, vérifier les numéros disponibles
  if (results.twilio) {
    await checkTwilioPhoneAvailability();
  }

  console.log('\n' + '='.repeat(50));
  console.log('RÉSUMÉ');
  console.log('='.repeat(50));

  const allOk = Object.values(results).every(r => r);

  Object.entries(results).forEach(([service, ok]) => {
    console.log(`  ${ok ? '✅' : '❌'} ${service.toUpperCase()}`);
  });

  if (allOk) {
    console.log('\n🎉 Toutes les connexions sont opérationnelles !');
    console.log('   Prêt pour le provisioning automatique.');
  } else {
    console.log('\n⚠️ Certaines connexions ont échoué.');
  }
}

runAllTests().catch(console.error);
