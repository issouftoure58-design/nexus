/**
 * IA Admin - Configuration des agents IA
 * Gestion des assistants vocaux et chatbots
 */

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  Phone,
  MessageSquare,
  Volume2,
  Settings,
  RefreshCw,
  AlertCircle,
  Check,
  Play,
  Save,
  Mic
} from 'lucide-react';

interface Agent {
  id: string;
  agent_type: string;
  custom_name: string;
  voice_id: string | null;
  voice_gender: string;
  voice_style: string;
  tone: string;
  proactivity_level: number;
  detail_level: number;
  greeting_message: string;
  signature_phrase: string;
  business_type: string;
  vocabulary: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

const AGENT_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  web: { label: 'Chatbot Web', icon: MessageSquare, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  phone: { label: 'Assistant Vocal', icon: Phone, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  whatsapp: { label: 'WhatsApp Bot', icon: MessageSquare, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
};

const VOICE_STYLES = [
  { value: 'professional', label: 'Professionnel' },
  { value: 'friendly', label: 'Amical' },
  { value: 'casual', label: 'Decontracte' },
  { value: 'formal', label: 'Formel' },
];

const TONES = [
  { value: 'warm', label: 'Chaleureux' },
  { value: 'neutral', label: 'Neutre' },
  { value: 'energetic', label: 'Energique' },
  { value: 'calm', label: 'Calme' },
];

export default function IAAdmin() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [saving, setSaving] = useState(false);
  const [playingVoice, setPlayingVoice] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Agent>>({});

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/agents', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });

      if (response.status === 403) {
        setError('Cette fonctionnalite necessite le module Agent IA');
        return;
      }

      if (!response.ok) throw new Error('Erreur lors du chargement');

      const result = await response.json();
      setAgents(result.agents || []);
      if (result.agents?.length > 0 && !selectedAgent) {
        selectAgent(result.agents[0]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setEditForm({
      custom_name: agent.custom_name,
      voice_style: agent.voice_style,
      tone: agent.tone,
      proactivity_level: agent.proactivity_level,
      detail_level: agent.detail_level,
      greeting_message: agent.greeting_message,
      signature_phrase: agent.signature_phrase,
      active: agent.active,
    });
  };

  const handleSave = async () => {
    if (!selectedAgent) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/agents/${selectedAgent.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });

      if (!response.ok) throw new Error('Erreur lors de la sauvegarde');

      const result = await response.json();
      setAgents(agents.map(a => a.id === selectedAgent.id ? result.agent : a));
      setSelectedAgent(result.agent);
    } catch (err: any) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestVoice = async () => {
    if (!selectedAgent?.voice_id) return;
    setPlayingVoice(true);
    try {
      const response = await fetch(`/api/admin/agents/${selectedAgent.id}/test-voice`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: editForm.greeting_message || 'Bonjour, comment puis-je vous aider?' })
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.onended = () => setPlayingVoice(false);
        audio.play();
      } else {
        setPlayingVoice(false);
      }
    } catch (err) {
      console.error('Voice test error:', err);
      setPlayingVoice(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Configuration IA</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Button onClick={fetchAgents}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reessayer
          </Button>
        </Card>
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <Card className="p-8 text-center">
          <Bot className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Aucun agent IA configure</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Les agents IA seront crees automatiquement lors de l'activation du module.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configuration IA</h1>
          <p className="text-gray-600 dark:text-gray-400">Personnalisez vos assistants intelligents</p>
        </div>
        <Button onClick={fetchAgents}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent List */}
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Vos Agents
          </h2>
          {agents.map((agent) => {
            const config = AGENT_TYPE_CONFIG[agent.agent_type] || AGENT_TYPE_CONFIG.web;
            const Icon = config.icon;
            const isSelected = selectedAgent?.id === agent.id;
            return (
              <button
                key={agent.id}
                onClick={() => selectAgent(agent)}
                className={`w-full p-4 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                    : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {agent.custom_name || config.label}
                      </span>
                      {agent.active ? (
                        <Badge variant="default" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Actif
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactif</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{config.label}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Agent Config */}
        {selectedAgent && (
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-cyan-500" />
                  Configuration
                </h2>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Sauvegarder
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nom personnalise
                  </label>
                  <input
                    type="text"
                    value={editForm.custom_name || ''}
                    onChange={(e) => setEditForm({ ...editForm, custom_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    placeholder="Ex: Sophie, votre assistante"
                  />
                </div>

                {/* Active Toggle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Statut
                  </label>
                  <button
                    onClick={() => setEditForm({ ...editForm, active: !editForm.active })}
                    className={`w-full px-4 py-2 rounded-md border transition-colors flex items-center justify-center gap-2 ${
                      editForm.active
                        ? 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-400'
                        : 'bg-gray-100 border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {editForm.active ? <Check className="w-4 h-4" /> : null}
                    {editForm.active ? 'Actif' : 'Inactif'}
                  </button>
                </div>

                {/* Voice Style */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Style de communication
                  </label>
                  <select
                    value={editForm.voice_style || 'professional'}
                    onChange={(e) => setEditForm({ ...editForm, voice_style: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                  >
                    {VOICE_STYLES.map((style) => (
                      <option key={style.value} value={style.value}>{style.label}</option>
                    ))}
                  </select>
                </div>

                {/* Tone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ton
                  </label>
                  <select
                    value={editForm.tone || 'neutral'}
                    onChange={(e) => setEditForm({ ...editForm, tone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                  >
                    {TONES.map((tone) => (
                      <option key={tone.value} value={tone.value}>{tone.label}</option>
                    ))}
                  </select>
                </div>

                {/* Proactivity Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Niveau de proactivite: {editForm.proactivity_level || 5}/10
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={editForm.proactivity_level || 5}
                    onChange={(e) => setEditForm({ ...editForm, proactivity_level: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Passif</span>
                    <span>Proactif</span>
                  </div>
                </div>

                {/* Detail Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Niveau de detail: {editForm.detail_level || 5}/10
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={editForm.detail_level || 5}
                    onChange={(e) => setEditForm({ ...editForm, detail_level: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Concis</span>
                    <span>Detaille</span>
                  </div>
                </div>

                {/* Greeting Message */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Message d'accueil
                  </label>
                  <textarea
                    value={editForm.greeting_message || ''}
                    onChange={(e) => setEditForm({ ...editForm, greeting_message: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                    placeholder="Bonjour ! Comment puis-je vous aider aujourd'hui ?"
                  />
                </div>

                {/* Signature Phrase */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Phrase de signature
                  </label>
                  <input
                    type="text"
                    value={editForm.signature_phrase || ''}
                    onChange={(e) => setEditForm({ ...editForm, signature_phrase: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
                    placeholder="A bientot chez [Nom du salon] !"
                  />
                </div>
              </div>
            </Card>

            {/* Voice Preview (for phone agent) */}
            {selectedAgent.agent_type === 'phone' && selectedAgent.voice_id && (
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-900/30">
                      <Mic className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">Apercu Vocal</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Ecoutez comment votre assistant sonne
                      </p>
                    </div>
                  </div>
                  <Button onClick={handleTestVoice} disabled={playingVoice}>
                    {playingVoice ? (
                      <>
                        <Volume2 className="w-4 h-4 mr-2 animate-pulse" />
                        Lecture...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Tester la voix
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
