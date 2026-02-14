/**
 * VOICE ROUTES - API endpoints pour la synthèse vocale optimisée
 *
 * Routes avec routing intelligent entre providers:
 * - OpenAI TTS (défaut): $0.015/1000 chars - 16x moins cher
 * - ElevenLabs (premium): $0.30/1000 chars - voix clonées
 *
 * @module routes/voice
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import ttsService from '../services/ttsService.js';
import voiceService from '../services/voiceService.js'; // Pour CACHE_DIR et compatibilité

const router = express.Router();

// ============================================
// AUDIO SERVING (pour Twilio <Play>)
// ============================================

/**
 * GET /api/voice/audio/:filename
 * Sert un fichier MP3 depuis le cache vocal
 */
router.get('/audio/:filename', (req, res) => {
  const { filename } = req.params;

  // Sécurité : empêcher traversée de répertoire
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: 'Nom de fichier invalide' });
  }

  const filePath = path.join(voiceService.CACHE_DIR, filename);

  if (!fs.existsSync(filePath)) {
    console.error(`[VOICE AUDIO] Fichier introuvable: ${filename}`);
    return res.status(404).json({ error: 'Audio non trouvé' });
  }

  res.set({
    'Content-Type': 'audio/mpeg',
    'Cache-Control': 'public, max-age=3600'
  });
  res.sendFile(filePath);
});

// ============================================
// ROUTES PRINCIPALES
// ============================================

/**
 * POST /api/voice/synthesize
 * Convertir texte en audio (avec optimisation et cache)
 *
 * Body:
 * - text: string (texte à convertir)
 * - voiceId: string (optionnel - ID de la voix)
 * - useCache: boolean (optionnel - utiliser le cache, défaut: true)
 * - optimize: boolean (optionnel - optimiser le texte, défaut: true)
 *
 * Response: audio/mpeg avec headers X-From-Cache et X-Characters-Used
 */
router.post('/synthesize', async (req, res) => {
  try {
    const { text, voiceId, voice, useCache = true, optimize = true, provider } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Texte requis' });
    }

    if (!ttsService.isConfigured()) {
      return res.status(503).json({
        error: 'Service vocal non configuré',
        message: 'OPENAI_API_KEY ou ELEVENLABS_API_KEY requis'
      });
    }

    const result = await ttsService.textToSpeech(text, {
      voiceId: voiceId || voice,
      useCache,
      optimize,
      forceProvider: provider
    });

    if (result.success) {
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': result.audio.length,
        'X-From-Cache': result.fromCache ? 'true' : 'false',
        'X-Characters-Used': (result.characters || 0).toString(),
        'X-Provider': result.provider || 'unknown',
        'Cache-Control': 'no-cache'
      });
      res.send(result.audio);
    } else {
      res.status(500).json({ error: result.error });
    }

  } catch (error) {
    console.error('[VOICE ROUTE] Erreur synthesize:', error.message);
    res.status(500).json({ error: 'Erreur de synthèse vocale', details: error.message });
  }
});

/**
 * POST /api/voice/smart
 * Convertir réponse complète (découpe en segments, utilise le cache)
 *
 * Body:
 * - text: string (texte complet à convertir)
 * - voiceId: string (optionnel)
 *
 * Response: audio/mpeg avec header X-Stats
 */
router.post('/smart', async (req, res) => {
  try {
    const { text, voiceId, voice, provider } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Texte requis' });
    }

    if (!ttsService.isConfigured()) {
      return res.status(503).json({
        error: 'Service vocal non configuré',
        message: 'OPENAI_API_KEY ou ELEVENLABS_API_KEY requis'
      });
    }

    const result = await ttsService.textToSpeechSmart(text, {
      voiceId: voiceId || voice,
      forceProvider: provider
    });

    if (result.success) {
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': result.audio.length,
        'X-Stats': JSON.stringify(result.stats || {}),
        'X-Provider': result.provider || 'unknown',
        'Cache-Control': 'no-cache'
      });
      res.send(result.audio);
    } else {
      res.status(500).json({ error: result.error });
    }

  } catch (error) {
    console.error('[VOICE ROUTE] Erreur smart:', error.message);
    res.status(500).json({ error: 'Erreur de synthèse', details: error.message });
  }
});

/**
 * POST /api/voice/stream
 * Synthèse en streaming
 */
router.post('/stream', async (req, res) => {
  try {
    const { text, voiceId, voice, provider } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Le texte est requis' });
    }

    if (!ttsService.isConfigured()) {
      return res.status(503).json({
        error: 'Service vocal non configuré',
        message: 'OPENAI_API_KEY ou ELEVENLABS_API_KEY requis'
      });
    }

    const audioStream = await ttsService.textToSpeechStream(text, {
      voiceId: voiceId || voice,
      forceProvider: provider
    });

    if (!audioStream) {
      return res.status(500).json({ error: 'Erreur de streaming vocal' });
    }

    res.set({
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache'
    });

    const reader = audioStream.getReader();

    async function pump() {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        return;
      }
      res.write(Buffer.from(value));
      return pump();
    }

    await pump();

  } catch (error) {
    console.error('[VOICE ROUTE] Erreur stream:', error.message);
    res.status(500).json({ error: 'Erreur de streaming', details: error.message });
  }
});

// ============================================
// GESTION DU CACHE
// ============================================

/**
 * GET /api/voice/cache/stats
 * Statistiques unifiées de tous les providers
 */
router.get('/cache/stats', (req, res) => {
  try {
    const stats = ttsService.getStats();
    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    console.error('[VOICE ROUTE] Erreur cache stats:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/voice/cache
 * Vider tous les caches audio
 */
router.delete('/cache', (req, res) => {
  try {
    const result = ttsService.clearAllCaches();
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('[VOICE ROUTE] Erreur clear cache:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PRÉ-GÉNÉRATION
// ============================================

/**
 * POST /api/voice/pregenerate
 * Pré-générer toutes les phrases courantes
 */
router.post('/pregenerate', async (req, res) => {
  try {
    if (!ttsService.isConfigured()) {
      return res.status(503).json({
        error: 'Service vocal non configuré',
        message: 'OPENAI_API_KEY ou ELEVENLABS_API_KEY requis'
      });
    }

    const { voiceId, voice, provider } = req.body;
    const result = await ttsService.pregenerateCommonPhrases({
      voiceId: voiceId || voice,
      forceProvider: provider
    });

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('[VOICE ROUTE] Erreur pregenerate:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/voice/phrases
 * Liste des phrases pré-générées disponibles
 */
router.get('/phrases', (req, res) => {
  res.json({
    success: true,
    phrases: voiceService.PREGENERATED_PHRASES,
    count: Object.keys(voiceService.PREGENERATED_PHRASES).length
  });
});

// ============================================
// UTILITAIRES
// ============================================

/**
 * GET /api/voice/status
 * Statut du service vocal unifié
 */
router.get('/status', (req, res) => {
  const stats = ttsService.getStats();
  res.json({
    configured: ttsService.isConfigured(),
    defaultProvider: ttsService.DEFAULT_PROVIDER,
    providers: stats.providers,
    unified: stats.unified,
    recommendation: 'OpenAI TTS est 16x moins cher qu\'ElevenLabs'
  });
});

/**
 * GET /api/voice/quota
 * Quota ElevenLabs restant
 */
router.get('/quota', async (req, res) => {
  try {
    const quota = await voiceService.getQuota();
    res.json(quota);
  } catch (error) {
    console.error('[VOICE ROUTE] Erreur quota:', error.message);
    res.status(500).json({ error: 'Erreur vérification quota', details: error.message });
  }
});

/**
 * GET /api/voice/voices
 * Liste des voix disponibles (tous providers)
 */
router.get('/voices', async (req, res) => {
  try {
    const voices = await ttsService.listVoices();
    res.json({
      success: true,
      voices,
      openaiVoices: ttsService.OPENAI_VOICES,
      defaultProvider: ttsService.DEFAULT_PROVIDER
    });
  } catch (error) {
    console.error('[VOICE ROUTE] Erreur voices:', error.message);
    res.status(500).json({ error: 'Erreur récupération voix', details: error.message });
  }
});

/**
 * POST /api/voice/reset-stats
 * Réinitialiser les statistiques de session
 */
router.post('/reset-stats', (req, res) => {
  try {
    const stats = ttsService.resetStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('[VOICE ROUTE] Erreur reset stats:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/voice/optimize
 * Optimiser un texte (debug/test)
 */
router.post('/optimize', (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Texte requis' });
    }

    const optimized = voiceService.optimizeText(text);
    const pregenMatch = voiceService.findPregeneratedMatch(text);

    res.json({
      success: true,
      original: text,
      originalLength: text.length,
      optimized,
      optimizedLength: optimized.length,
      saved: text.length - optimized.length,
      percentSaved: Math.round(((text.length - optimized.length) / text.length) * 100),
      pregeneratedMatch: pregenMatch
    });

  } catch (error) {
    console.error('[VOICE ROUTE] Erreur optimize:', error.message);
    res.status(500).json({ error: 'Erreur optimisation', details: error.message });
  }
});

/**
 * GET /api/voice/test
 * Test rapide de la synthèse vocale
 */
router.get('/test', async (req, res) => {
  try {
    if (!ttsService.isConfigured()) {
      return res.status(503).json({
        error: 'Service vocal non configuré',
        message: 'OPENAI_API_KEY ou ELEVENLABS_API_KEY requis'
      });
    }

    const testText = "Bonjour ! Ceci est un test du service vocal.";

    const result = await ttsService.textToSpeech(testText);

    if (result.success) {
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': result.audio.length,
        'X-From-Cache': result.fromCache ? 'true' : 'false',
        'X-Characters-Used': (result.characters || 0).toString(),
        'X-Provider': result.provider || 'unknown'
      });
      res.send(result.audio);
    } else {
      res.status(500).json({ error: result.error });
    }

  } catch (error) {
    console.error('[VOICE ROUTE] Erreur test:', error.message);
    res.status(500).json({ error: 'Erreur de test', details: error.message });
  }
});

// ============================================
// EXPORT
// ============================================

export default router;
