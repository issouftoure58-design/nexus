/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   WORKFLOWS - Marketing Automation Builder                         ║
 * ╠═══════════════════════════════════════════════════════════════════╣
 * ║   - Création/édition workflows                                     ║
 * ║   - Triggers automatiques (8 types)                                ║
 * ║   - Actions multi-canaux (email, SMS, tag, notification)          ║
 * ║   - Stats et historique                                            ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  Zap,
  Plus,
  Trash2,
  Power,
  Eye,
  Play,
  X,
  Mail,
  MessageSquare,
  Tag,
  Bell,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

interface WorkflowAction {
  type: 'email' | 'sms' | 'tag' | 'notification';
  delay_minutes: number;
  message?: string;
  template_id?: string;
  tag_id?: string;
}

interface Workflow {
  id: string;
  nom: string;
  description: string;
  trigger_type: string;
  trigger_config: Record<string, any>;
  actions: WorkflowAction[];
  actif: boolean;
  nb_executions: number;
  derniere_execution: string | null;
  created_at: string;
}

interface WorkflowStats {
  total_workflows: number;
  workflows_actifs: number;
  total_executions: number;
  executions_reussies: number;
  executions_erreur: number;
}

const TRIGGERS: Record<string, string> = {
  nouveau_client: 'Nouveau client créé',
  apres_rdv: 'Après un RDV terminé',
  rdv_annule: 'RDV annulé',
  inactif_X_jours: 'Client inactif X jours',
  anniversaire_client: 'Anniversaire client',
  panier_abandonne: 'Panier abandonné',
  objectif_ca_atteint: 'Objectif CA atteint',
  tag_ajoute: 'Tag ajouté',
};

const ACTION_TYPES: Record<string, { label: string; icon: any; color: string }> = {
  email: { label: 'Email', icon: Mail, color: 'text-blue-400 bg-blue-500/20' },
  sms: { label: 'SMS', icon: MessageSquare, color: 'text-green-400 bg-green-500/20' },
  tag: { label: 'Ajouter tag', icon: Tag, color: 'text-purple-400 bg-purple-500/20' },
  notification: { label: 'Notification', icon: Bell, color: 'text-amber-400 bg-amber-500/20' },
};

export default function Workflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [stats, setStats] = useState<WorkflowStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal création
  const [showCreate, setShowCreate] = useState(false);
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('nouveau_client');
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});
  const [actions, setActions] = useState<WorkflowAction[]>([]);

  // Modal détail
  const [showDetail, setShowDetail] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [executions, setExecutions] = useState<any[]>([]);

  useEffect(() => {
    chargerWorkflows();
    chargerStats();
  }, []);

  const chargerWorkflows = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/marketing/workflows', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setWorkflows(data.workflows);
      }
    } catch (error) {
      console.error('Erreur chargement workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const chargerStats = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/marketing/workflows/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Erreur stats:', error);
    }
  };

  const chargerDetail = async (workflow: Workflow) => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/marketing/workflows/${workflow.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setSelectedWorkflow(data.workflow);
        setExecutions(data.executions || []);
        setShowDetail(true);
      }
    } catch (error) {
      console.error('Erreur détail:', error);
    }
  };

  const ajouterAction = () => {
    setActions([...actions, { type: 'email', delay_minutes: 0 }]);
  };

  const modifierAction = (index: number, field: string, value: any) => {
    const newActions = [...actions];
    (newActions[index] as any)[field] = value;
    setActions(newActions);
  };

  const supprimerAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const creerWorkflow = async () => {
    if (!nom || actions.length === 0) {
      alert('Nom et au moins une action requis');
      return;
    }

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/marketing/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nom,
          description,
          trigger_type: triggerType,
          trigger_config: triggerConfig,
          actions,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setShowCreate(false);
        resetForm();
        chargerWorkflows();
        chargerStats();
      } else {
        alert(data.error || 'Erreur création');
      }
    } catch (error) {
      console.error('Erreur création workflow:', error);
      alert('Erreur création');
    }
  };

  const resetForm = () => {
    setNom('');
    setDescription('');
    setTriggerType('nouveau_client');
    setTriggerConfig({});
    setActions([]);
  };

  const toggleWorkflow = async (id: string) => {
    try {
      const token = localStorage.getItem('admin_token');
      await fetch(`/api/marketing/workflows/${id}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      chargerWorkflows();
    } catch (error) {
      console.error('Erreur toggle:', error);
    }
  };

  const supprimerWorkflow = async (id: string) => {
    if (!confirm('Supprimer ce workflow ?')) return;

    try {
      const token = localStorage.getItem('admin_token');
      await fetch(`/api/marketing/workflows/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      chargerWorkflows();
      chargerStats();
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              Marketing Automation
            </h1>
            <p className="text-white/60 mt-1">Automatisez vos campagnes marketing</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:opacity-90 transition font-medium"
          >
            <Plus className="w-5 h-5" />
            Nouveau workflow
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <p className="text-sm text-white/50">Total Workflows</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.total_workflows}</p>
            </div>
            <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <p className="text-sm text-white/50">Actifs</p>
              <p className="text-3xl font-bold text-emerald-400 mt-1">{stats.workflows_actifs}</p>
            </div>
            <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <p className="text-sm text-white/50">Exécutions</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.total_executions}</p>
            </div>
            <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5">
              <p className="text-sm text-white/50">Taux Réussite</p>
              <p className="text-3xl font-bold text-blue-400 mt-1">
                {stats.total_executions > 0
                  ? Math.round((stats.executions_reussies / stats.total_executions) * 100)
                  : 0}
                %
              </p>
            </div>
          </div>
        )}

        {/* Liste workflows */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
            </div>
          ) : workflows.length === 0 ? (
            <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-12 text-center">
              <Zap className="w-16 h-16 text-white/20 mx-auto mb-4" />
              <p className="text-white/60 mb-2">Aucun workflow créé</p>
              <p className="text-sm text-white/40 mb-4">
                Automatisez vos actions marketing avec des workflows
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:opacity-90 transition"
              >
                Créer un workflow
              </button>
            </div>
          ) : (
            workflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-white">{workflow.nom}</h3>
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          workflow.actif
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-white/10 text-white/50'
                        }`}
                      >
                        {workflow.actif ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    {workflow.description && (
                      <p className="text-white/50 text-sm mt-1">{workflow.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleWorkflow(workflow.id)}
                      className={`p-2 rounded-lg transition ${
                        workflow.actif
                          ? 'text-emerald-400 hover:bg-emerald-500/20'
                          : 'text-white/50 hover:bg-white/10'
                      }`}
                      title={workflow.actif ? 'Désactiver' : 'Activer'}
                    >
                      <Power className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => chargerDetail(workflow)}
                      className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition"
                      title="Détails"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => supprimerWorkflow(workflow.id)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition"
                      title="Supprimer"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-sm">
                  {/* Trigger */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/20 text-purple-400 rounded-lg">
                    <Play className="w-4 h-4" />
                    <span className="font-medium">{TRIGGERS[workflow.trigger_type] || workflow.trigger_type}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    {workflow.actions.map((action, i) => {
                      const actionConfig = ACTION_TYPES[action.type];
                      const Icon = actionConfig?.icon || Zap;
                      return (
                        <div
                          key={i}
                          className={`p-2 rounded-lg ${actionConfig?.color || 'bg-white/10 text-white/50'}`}
                          title={actionConfig?.label || action.type}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                      );
                    })}
                  </div>

                  {/* Stats */}
                  {workflow.nb_executions > 0 && (
                    <div className="text-white/50 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      {workflow.nb_executions} exécution(s)
                    </div>
                  )}

                  {workflow.derniere_execution && (
                    <div className="text-white/40 text-xs">
                      Dernière: {formatDate(workflow.derniere_execution)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal Création */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Nouveau Workflow</h2>
                <button
                  onClick={() => {
                    setShowCreate(false);
                    resetForm();
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              <div className="space-y-5">
                {/* Nom */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Nom du workflow *
                  </label>
                  <input
                    type="text"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    placeholder="Ex: Bienvenue nouveau client"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description du workflow"
                    rows={2}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>

                {/* Trigger */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Déclencheur *
                  </label>
                  <select
                    value={triggerType}
                    onChange={(e) => setTriggerType(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-amber-500/50 focus:outline-none"
                  >
                    {Object.entries(TRIGGERS).map(([key, label]) => (
                      <option key={key} value={key} className="bg-zinc-900">
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Config trigger inactif */}
                {triggerType === 'inactif_X_jours' && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Nombre de jours d'inactivité
                    </label>
                    <input
                      type="number"
                      value={triggerConfig.jours || 30}
                      onChange={(e) =>
                        setTriggerConfig({ ...triggerConfig, jours: parseInt(e.target.value) })
                      }
                      min={1}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:border-amber-500/50 focus:outline-none"
                    />
                  </div>
                )}

                {/* Actions */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-white/70">Actions *</label>
                    <button
                      onClick={ajouterAction}
                      className="text-sm text-amber-400 hover:text-amber-300 transition"
                    >
                      + Ajouter action
                    </button>
                  </div>

                  <div className="space-y-3">
                    {actions.map((action, index) => (
                      <div
                        key={index}
                        className="bg-white/5 border border-white/10 rounded-xl p-4"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <select
                            value={action.type}
                            onChange={(e) => modifierAction(index, 'type', e.target.value)}
                            className="px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white focus:outline-none"
                          >
                            {Object.entries(ACTION_TYPES).map(([key, { label }]) => (
                              <option key={key} value={key} className="bg-zinc-900">
                                {label}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => supprimerAction(index)}
                            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {action.type === 'sms' && (
                          <textarea
                            value={action.message || ''}
                            onChange={(e) => modifierAction(index, 'message', e.target.value)}
                            placeholder="Message SMS (variables: {{prenom}}, {{nom}})"
                            rows={2}
                            className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none mb-3"
                          />
                        )}

                        {action.type === 'notification' && (
                          <input
                            type="text"
                            value={action.message || ''}
                            onChange={(e) => modifierAction(index, 'message', e.target.value)}
                            placeholder="Message de notification"
                            className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none mb-3"
                          />
                        )}

                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-white/40" />
                          <input
                            type="number"
                            value={action.delay_minutes}
                            onChange={(e) =>
                              modifierAction(index, 'delay_minutes', parseInt(e.target.value) || 0)
                            }
                            min={0}
                            className="w-24 px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white focus:outline-none"
                          />
                          <span className="text-white/40 text-sm">minutes de délai</span>
                        </div>
                      </div>
                    ))}

                    {actions.length === 0 && (
                      <div className="text-center py-6 text-white/40">
                        <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Ajoutez au moins une action</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCreate(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={creerWorkflow}
                  disabled={!nom || actions.length === 0}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Créer workflow
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Détail */}
        {showDetail && selectedWorkflow && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">{selectedWorkflow.nom}</h2>
                  {selectedWorkflow.description && (
                    <p className="text-white/50 mt-1">{selectedWorkflow.description}</p>
                  )}
                </div>
                <button
                  onClick={() => setShowDetail(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              {/* Info workflow */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-sm text-white/50">Déclencheur</p>
                  <p className="text-white font-medium">
                    {TRIGGERS[selectedWorkflow.trigger_type] || selectedWorkflow.trigger_type}
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-sm text-white/50">Statut</p>
                  <p className={selectedWorkflow.actif ? 'text-emerald-400' : 'text-white/50'}>
                    {selectedWorkflow.actif ? 'Actif' : 'Inactif'}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-3">Actions</h3>
                <div className="space-y-2">
                  {selectedWorkflow.actions.map((action, i) => {
                    const config = ACTION_TYPES[action.type];
                    const Icon = config?.icon || Zap;
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 bg-white/5 rounded-xl p-3"
                      >
                        <div className={`p-2 rounded-lg ${config?.color || 'bg-white/10'}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{config?.label || action.type}</p>
                          {action.delay_minutes > 0 && (
                            <p className="text-white/40 text-sm">
                              Délai: {action.delay_minutes} min
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Historique exécutions */}
              <div>
                <h3 className="text-lg font-bold text-white mb-3">
                  Historique ({executions.length})
                </h3>
                {executions.length === 0 ? (
                  <p className="text-white/40 text-center py-6">Aucune exécution</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {executions.map((exec) => (
                      <div
                        key={exec.id}
                        className="flex items-center justify-between bg-white/5 rounded-xl p-3"
                      >
                        <div className="flex items-center gap-3">
                          {exec.statut === 'termine' ? (
                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                          ) : exec.statut === 'erreur' ? (
                            <XCircle className="w-5 h-5 text-red-400" />
                          ) : (
                            <Clock className="w-5 h-5 text-amber-400" />
                          )}
                          <div>
                            <p className="text-white">
                              {exec.clients?.prenom} {exec.clients?.nom || 'Client inconnu'}
                            </p>
                            <p className="text-white/40 text-sm">
                              {formatDate(exec.started_at)}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-1 rounded-lg text-xs ${
                            exec.statut === 'termine'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : exec.statut === 'erreur'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {exec.statut}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowDetail(false)}
                className="w-full mt-6 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
