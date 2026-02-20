/**
 * Script pour générer les audios de Nexus avec OpenAI TTS
 * Usage: OPENAI_API_KEY=sk-xxx node scripts/generate-audio.js
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const VOICE = 'nova'; // nova = voix féminine douce, parfait pour assistant
const MODEL = 'tts-1-hd'; // Haute qualité
const OUTPUT_DIR = path.join(__dirname, '../public/audio');

// Messages à générer
const MESSAGES = {
  'welcome': "Bonjour ! Je suis NEXUS, votre assistant IA. Je peux automatiser votre business : réservations, appels téléphoniques, WhatsApp... Posez-moi vos questions, je suis là pour vous aider !",

  'faq-prix': "Nos tarifs sont modulaires ! Vous payez uniquement ce dont vous avez besoin. Par exemple : Téléphone IA à 99 euros par mois avec 300 minutes incluses, WhatsApp IA à 49 euros par mois, Réservations à 19 euros par mois. Essai gratuit de 14 jours sans carte bancaire !",

  'faq-telephone': "Notre module Téléphone IA répond à vos appels 24 heures sur 24, 7 jours sur 7. Il peut prendre des rendez-vous, répondre aux questions fréquentes, et transférer vers un humain si nécessaire. 300 minutes incluses pour 99 euros par mois.",

  'faq-whatsapp': "Le module WhatsApp IA répond instantanément à vos clients sur WhatsApp. Il peut prendre des rendez-vous, envoyer des confirmations, et répondre aux questions. 1500 messages inclus pour 49 euros par mois.",

  'faq-reservation': "Notre système de réservations permet à vos clients de réserver en ligne 24 heures sur 24, 7 jours sur 7. Calendrier synchronisé, rappels automatiques, gestion des créneaux. Illimité pour seulement 19 euros par mois !",

  'faq-essai': "Vous pouvez essayer NEXUS gratuitement pendant 14 jours, sans carte bancaire requise. Cliquez sur Essai gratuit pour commencer !",

  'faq-default': "Je suis là pour répondre à toutes vos questions sur NEXUS ! Vous pouvez me demander des infos sur nos modules comme le téléphone, WhatsApp ou les réservations, les tarifs, ou comment démarrer votre essai gratuit."
};

async function generateAudio(openai, key, text) {
  console.log(`🎙️  Génération: ${key}...`);

  const response = await openai.audio.speech.create({
    model: MODEL,
    voice: VOICE,
    input: text,
    response_format: 'mp3'
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  const outputPath = path.join(OUTPUT_DIR, `${key}.mp3`);
  fs.writeFileSync(outputPath, buffer);

  console.log(`   ✅ Sauvegardé: ${outputPath}`);
  return outputPath;
}

async function main() {
  // Vérifier la clé API
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ Erreur: OPENAI_API_KEY non définie');
    console.log('Usage: OPENAI_API_KEY=sk-xxx node scripts/generate-audio.js');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });

  // Créer le dossier de sortie
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`📁 Dossier créé: ${OUTPUT_DIR}`);
  }

  console.log('');
  console.log('🚀 Génération des audios NEXUS avec OpenAI TTS');
  console.log(`   Voix: ${VOICE}`);
  console.log(`   Modèle: ${MODEL}`);
  console.log('');

  // Calculer le coût estimé
  const totalChars = Object.values(MESSAGES).join('').length;
  const costPer1M = MODEL === 'tts-1-hd' ? 0.030 : 0.015;
  const estimatedCost = (totalChars / 1000000) * costPer1M;
  console.log(`📊 Caractères totaux: ${totalChars}`);
  console.log(`💰 Coût estimé: $${estimatedCost.toFixed(4)}`);
  console.log('');

  // Générer chaque audio
  let success = 0;
  let failed = 0;

  for (const [key, text] of Object.entries(MESSAGES)) {
    try {
      await generateAudio(openai, key, text);
      success++;
    } catch (error) {
      console.error(`   ❌ Erreur pour ${key}:`, error.message);
      failed++;
    }
  }

  console.log('');
  console.log('═'.repeat(50));
  console.log(`✅ Terminé: ${success} audios générés, ${failed} erreurs`);
  console.log('═'.repeat(50));
}

main();
