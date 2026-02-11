import { Router } from 'express';
import { authenticateAdmin } from './adminAuth.js';
import { supabase } from '../config/supabase.js';
import { requireModule } from '../middleware/moduleProtection.js';

const router = Router();

// All routes require admin auth
router.use(authenticateAdmin);

// 🔒 MODULE PROTECTION: Toutes les routes agents IA nécessitent le module 'agent_ia_web'
router.use(requireModule('agent_ia_web'));

// GET /api/admin/agents — List agents for current tenant
router.get('/', async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { data: agents, error } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('agent_type');

    if (error) throw error;

    res.json({ success: true, agents: agents || [] });
  } catch (error) {
    console.error('[AGENTS] Error fetching:', error);
    res.status(500).json({ success: false, error: 'Erreur récupération agents' });
  }
});

// PATCH /api/admin/agents/:id — Update agent config
router.patch('/:id', async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { id } = req.params;
    const updates = req.body;

    // Whitelist allowed fields
    const allowed = [
      'custom_name', 'voice_id', 'voice_gender', 'voice_style',
      'tone', 'proactivity_level', 'detail_level',
      'greeting_message', 'signature_phrase',
      'business_type', 'vocabulary', 'active',
    ];
    const filtered = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) filtered[key] = updates[key];
    }
    filtered.updated_at = new Date().toISOString();

    // Verify agent exists for this tenant (🔒 TENANT ISOLATION)
    const { data: existing, error: fetchErr } = await supabase
      .from('ai_agents')
      .select('id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ success: false, error: 'Agent non trouvé' });
    }

    // 🔒 TENANT ISOLATION
    const { data: updated, error: updateErr } = await supabase
      .from('ai_agents')
      .update(filtered)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({ success: true, agent: updated });
  } catch (error) {
    console.error('[AGENTS] Error updating:', error);
    res.status(500).json({ success: false, error: 'Erreur mise à jour agent' });
  }
});

// POST /api/admin/agents/:id/test-voice — Generate voice sample
router.post('/:id/test-voice', async (req, res) => {
  try {
    // 🔒 TENANT ISOLATION: Utiliser tenant_id de l'admin
    const tenantId = req.admin.tenant_id;

    const { id } = req.params;
    const { text = "Bonjour, ceci est un test de voix." } = req.body;

    // 🔒 TENANT ISOLATION
    const { data: agent, error } = await supabase
      .from('ai_agents')
      .select('voice_id, custom_name')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !agent?.voice_id) {
      return res.status(404).json({ success: false, error: 'Agent ou voice_id non trouvé' });
    }

    // Call ElevenLabs API
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: 'ElevenLabs API key non configurée' });
    }

    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${agent.voice_id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!ttsRes.ok) {
      return res.status(500).json({ success: false, error: 'Erreur génération voix' });
    }

    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
    res.set({ 'Content-Type': 'audio/mpeg', 'Content-Length': audioBuffer.length });
    res.send(audioBuffer);
  } catch (error) {
    console.error('[AGENTS] Error test-voice:', error);
    res.status(500).json({ success: false, error: 'Erreur test voix' });
  }
});

export default router;
