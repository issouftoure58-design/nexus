import { useState, useEffect, useRef } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';

const authHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
  'Content-Type': 'application/json',
});

interface Agent {
  id: string;
  tenant_id: string;
  agent_type: 'reception' | 'backoffice';
  custom_name: string;
  default_name: string;
  voice_id?: string;
  voice_gender?: string;
  voice_style?: string;
  tone?: string;
  proactivity_level?: string;
  detail_level?: string;
  greeting_message?: string;
  signature_phrase?: string;
  business_type?: string;
  vocabulary?: string[];
  active: boolean;
}

export default function Team() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/admin/agents', { headers: authHeaders() });
      const data = await res.json();
      if (data.success) setAgents(data.agents);
    } catch (e) {
      console.error('Error fetching agents:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAgents(); }, []);

  const handleSave = async (agentId: string, updates: Partial<Agent>) => {
    try {
      const res = await fetch(`/api/admin/agents/${agentId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        await fetchAgents();
        setEditAgent(null);
      }
    } catch (e) {
      console.error('Error updating agent:', e);
    }
  };

  const reception = agents.find(a => a.agent_type === 'reception');
  const backoffice = agents.find(a => a.agent_type === 'backoffice');

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Votre Equipe IA</h1>
          <p className="text-sm text-white/50 mt-1">Configurez vos agents intelligents personnalises</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => <div key={i} className="h-48 bg-zinc-900 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {reception && <AgentCard agent={reception} onEdit={() => setEditAgent(reception)} />}
            {backoffice && <AgentCard agent={backoffice} onEdit={() => setEditAgent(backoffice)} />}
            {agents.length === 0 && (
              <div className="text-center py-12 text-white/40">
                Aucun agent configure. Contactez l'administrateur NEXUS.
              </div>
            )}
          </div>
        )}
      </div>

      {editAgent && (
        <AgentConfigModal
          agent={editAgent}
          onClose={() => setEditAgent(null)}
          onSave={handleSave}
        />
      )}
    </AdminLayout>
  );
}

// ─── Agent Card ─────────────────────────────────────────

function AgentCard({ agent, onEdit }: { agent: Agent; onEdit: () => void }) {
  const isReception = agent.agent_type === 'reception';
  const [testingVoice, setTestingVoice] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const testVoice = async () => {
    if (!agent.voice_id) return;
    setTestingVoice(true);
    try {
      const res = await fetch(`/api/admin/agents/${agent.id}/test-voice`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ text: agent.greeting_message || `Bonjour, je suis ${agent.custom_name}` }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (audioRef.current) { audioRef.current.pause(); }
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.play();
        audio.onended = () => URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('Voice test error:', e);
    } finally {
      setTestingVoice(false);
    }
  };

  const toneLabels: Record<string, string> = { warm: 'Chaleureux', professional: 'Professionnel', casual: 'Decontracte' };
  const proLabels: Record<string, string> = { proactive: 'Proactif', reactive: 'Reactif', balanced: 'Equilibre' };
  const detailLabels: Record<string, string> = { concise: 'Synthetique', standard: 'Standard', detailed: 'Detaille' };

  return (
    <div className="bg-zinc-900/80 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className={`px-5 py-4 flex items-center justify-between border-b ${isReception ? 'border-cyan-500/20 bg-cyan-950/20' : 'border-blue-500/20 bg-blue-950/20'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-full flex items-center justify-center text-xl ${isReception ? 'bg-cyan-500/20' : 'bg-blue-500/20'}`}>
            {isReception ? '\u{1F4DE}' : '\u{1F916}'}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">{agent.custom_name}</h2>
            <p className="text-xs text-white/40">
              {isReception ? 'Agent Reception' : 'Assistant Back-office'}
              {agent.voice_gender === 'female' ? ' \u00B7 Voix feminine' : agent.voice_gender === 'male' ? ' \u00B7 Voix masculine' : ''}
            </p>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${agent.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {agent.active ? 'Actif' : 'Inactif'}
        </span>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {isReception && (
            <>
              <InfoField label="Specialite" value={agent.business_type || 'Non defini'} />
              <InfoField label="Canaux" value="Telephone \u00B7 WhatsApp \u00B7 Web" />
              <InfoField label="Ton" value={toneLabels[agent.tone || ''] || agent.tone || 'Non defini'} />
            </>
          )}
          {!isReception && (
            <>
              <InfoField label="Proactivite" value={proLabels[agent.proactivity_level || ''] || 'Standard'} />
              <InfoField label="Detail" value={detailLabels[agent.detail_level || ''] || 'Standard'} />
              <InfoField label="Ton" value={toneLabels[agent.tone || ''] || 'Professionnel'} />
            </>
          )}
        </div>

        {isReception && agent.greeting_message && (
          <div>
            <span className="text-[10px] text-white/30 uppercase tracking-wider">Phrase d'accueil</span>
            <p className="text-sm text-white/70 italic mt-0.5">"{agent.greeting_message}"</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-3 border-t border-white/5 flex gap-2">
        <button onClick={onEdit}
          className="px-3 py-1.5 text-xs bg-white/5 border border-white/10 text-white/70 rounded-lg hover:bg-white/10 hover:text-white transition">
          Configurer
        </button>
        {isReception && agent.voice_id && (
          <button onClick={testVoice} disabled={testingVoice}
            className="px-3 py-1.5 text-xs bg-cyan-900/30 border border-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-900/50 transition disabled:opacity-50">
            {testingVoice ? 'Lecture...' : 'Tester la voix'}
          </button>
        )}
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] text-white/30 uppercase tracking-wider">{label}</span>
      <p className="text-sm text-white/70 mt-0.5">{value}</p>
    </div>
  );
}

// ─── Config Modal ───────────────────────────────────────

function AgentConfigModal({ agent, onClose, onSave }: {
  agent: Agent;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Agent>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    custom_name: agent.custom_name,
    tone: agent.tone || '',
    greeting_message: agent.greeting_message || '',
    signature_phrase: agent.signature_phrase || '',
    voice_id: agent.voice_id || '',
    voice_gender: agent.voice_gender || '',
    voice_style: agent.voice_style || '',
    proactivity_level: agent.proactivity_level || '',
    detail_level: agent.detail_level || '',
    business_type: agent.business_type || '',
    active: agent.active,
  });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'identity' | 'voice' | 'behavior'>('identity');
  const isReception = agent.agent_type === 'reception';

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(agent.id, form); } finally { setSaving(false); }
  };

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-white/10 rounded-xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Configuration de {agent.custom_name}</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl">&times;</button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 flex gap-1">
          <TabBtn label="Identite" active={tab === 'identity'} onClick={() => setTab('identity')} />
          {isReception && <TabBtn label="Voix" active={tab === 'voice'} onClick={() => setTab('voice')} />}
          <TabBtn label="Comportement" active={tab === 'behavior'} onClick={() => setTab('behavior')} />
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          {tab === 'identity' && (
            <>
              <Field label="Nom de l'agent" desc={`Nom par defaut : ${agent.default_name}`}>
                <input value={form.custom_name} onChange={e => set('custom_name', e.target.value)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none" />
              </Field>
              {isReception && (
                <>
                  <Field label="Phrase d'accueil">
                    <textarea value={form.greeting_message} onChange={e => set('greeting_message', e.target.value)} rows={3}
                      className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none resize-none"
                      placeholder="Ex: Bonjour ! C'est {nom} de {entreprise}" />
                  </Field>
                  <Field label="Signature (SMS, messages)">
                    <input value={form.signature_phrase} onChange={e => set('signature_phrase', e.target.value)}
                      className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                      placeholder="Ex: A bientot chez Fat's Hair !" />
                  </Field>
                  <Field label="Type de metier">
                    <input value={form.business_type} onChange={e => set('business_type', e.target.value)}
                      className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                      placeholder="Ex: salon_coiffure_afro" />
                  </Field>
                </>
              )}
              <Field label="Statut">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)}
                    className="w-4 h-4 rounded bg-zinc-800 border-white/20 text-amber-500 focus:ring-amber-500" />
                  <span className="text-sm text-white/70">Agent actif</span>
                </label>
              </Field>
            </>
          )}

          {tab === 'voice' && isReception && (
            <>
              <Field label="Voix ElevenLabs">
                <select value={form.voice_id} onChange={e => set('voice_id', e.target.value)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none">
                  <option value="">-- Choisir --</option>
                  <option value="21m00Tcm4TlvDq8ikWAM">Feminine douce (Rachel)</option>
                  <option value="EXAVITQu4vr4xnSDxMaL">Feminine energique (Lily)</option>
                  <option value="pNInz6obpgDQGcFmaJgB">Masculine posee (Adam)</option>
                  <option value="ErXwobaYiN019PkySvjV">Masculine dynamique (Antoni)</option>
                </select>
              </Field>
              <Field label="Genre vocal">
                <select value={form.voice_gender} onChange={e => set('voice_gender', e.target.value)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none">
                  <option value="">-- Choisir --</option>
                  <option value="female">Feminin</option>
                  <option value="male">Masculin</option>
                </select>
              </Field>
              <Field label="Style vocal">
                <select value={form.voice_style} onChange={e => set('voice_style', e.target.value)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none">
                  <option value="">-- Choisir --</option>
                  <option value="soft">Douce</option>
                  <option value="energetic">Energique</option>
                  <option value="calm">Calme</option>
                  <option value="dynamic">Dynamique</option>
                </select>
              </Field>
            </>
          )}

          {tab === 'behavior' && (
            <>
              <Field label="Ton de communication">
                <select value={form.tone} onChange={e => set('tone', e.target.value)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none">
                  <option value="">-- Choisir --</option>
                  <option value="warm">Chaleureux et convivial</option>
                  <option value="professional">Professionnel et formel</option>
                  <option value="casual">Decontracte et cool</option>
                </select>
              </Field>
              {!isReception && (
                <>
                  <Field label="Proactivite">
                    <select value={form.proactivity_level} onChange={e => set('proactivity_level', e.target.value)}
                      className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none">
                      <option value="">-- Choisir --</option>
                      <option value="proactive">Proactif (suggere des actions)</option>
                      <option value="reactive">Reactif (attend instructions)</option>
                      <option value="balanced">Equilibre</option>
                    </select>
                  </Field>
                  <Field label="Niveau de detail">
                    <select value={form.detail_level} onChange={e => set('detail_level', e.target.value)}
                      className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none">
                      <option value="">-- Choisir --</option>
                      <option value="concise">Synthetique</option>
                      <option value="standard">Standard</option>
                      <option value="detailed">Detaille</option>
                    </select>
                  </Field>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-white/50 hover:text-white transition">Annuler</button>
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg hover:opacity-90 transition disabled:opacity-50">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-lg transition ${active ? 'bg-amber-500/20 text-amber-400 font-medium' : 'text-white/40 hover:text-white/70'}`}>
      {label}
    </button>
  );
}

function Field({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-white/70">{label}</label>
      {desc && <p className="text-[10px] text-white/30 mb-1">{desc}</p>}
      <div className="mt-1">{children}</div>
    </div>
  );
}
