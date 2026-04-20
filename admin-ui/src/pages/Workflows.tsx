import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Plus, Play, Pause, Trash2, Settings,
  Zap, Mail, MessageSquare, Tag, CheckSquare, Eye, Clock, AlertCircle, X,
  Upload, FileText, XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { useBusinessTypeChecks } from '@/contexts/ProfileContext';

interface Workflow {
  id: number;
  nom: string;
  description: string;
  trigger_type: string;
  actif: boolean;
  config: {
    conditions?: Array<{ field: string; operator: string; value: string }>;
    actions?: Array<{ type: string; [key: string]: unknown }>;
  };
  executions_count: number;
  executions_total: number;
  last_execution_at: string | null;
  created_at: string;
}

interface Template {
  id: string;
  nom: string;
  description: string;
  trigger_type: string;
}

interface WorkflowStats {
  total_workflows: number;
  active_workflows: number;
  executions_this_month: number;
  success_rate: number;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]); // Remove data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getTriggerLabels(isCommerce: boolean, isSecurity: boolean, isHotel: boolean, isRestaurant: boolean): Record<string, string> {
  const completedLabel = isCommerce ? 'Commande complétée' : isSecurity ? 'Mission terminée' : isHotel ? 'Check-out effectué' : isRestaurant ? 'Service terminé' : 'Prestation terminée';
  const cancelledLabel = isCommerce ? 'Commande annulée' : isSecurity ? 'Mission annulée' : 'Prestation annulée';
  return {
    new_client: 'Nouveau client',
    rdv_completed: completedLabel,
    rdv_cancelled: cancelledLabel,
    facture_payee: 'Facture payee',
    facture_en_retard: 'Facture en retard',
    client_inactive: 'Client inactif',
    anniversaire: 'Anniversaire',
  };
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  send_email: <Mail className="h-4 w-4" />,
  send_sms: <MessageSquare className="h-4 w-4" />,
  send_whatsapp: <MessageSquare className="h-4 w-4" />,
  add_tag: <Tag className="h-4 w-4" />,
  remove_tag: <Tag className="h-4 w-4" />,
  create_task: <CheckSquare className="h-4 w-4" />,
};

interface WorkflowDocument {
  name: string;
  fileName: string;
  fileBase64: string;
  size: number;
}

interface WorkflowExecution {
  id: number;
  workflow_id: number;
  entity_type: string;
  entity_id: number;
  statut: string;
  details: Record<string, unknown>;
  executed_at: string;
}

interface WorkflowDetail {
  workflow: Workflow;
  executions: WorkflowExecution[];
}

export default function WorkflowsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isCommerce, isSecurity, isHotel, isRestaurant } = useBusinessTypeChecks();
  const TRIGGER_LABELS = getTriggerLabels(isCommerce, isSecurity, isHotel, isRestaurant);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Fetch workflows
  const { data: workflows, isLoading, error } = useQuery<Workflow[]>({
    queryKey: ['workflows'],
    queryFn: () => api.get('/admin/workflows'),
  });

  // Fetch templates
  const { data: templatesData } = useQuery<{ templates: Template[] }>({
    queryKey: ['workflow-templates'],
    queryFn: async () => {
      try {
        return await api.get<{ templates: Template[] }>('/admin/workflows/templates');
      } catch {
        return { templates: [] };
      }
    },
    enabled: showTemplates,
  });

  // Fetch stats
  const { data: stats } = useQuery<WorkflowStats | null>({
    queryKey: ['workflow-stats'],
    queryFn: async () => {
      try {
        return await api.get<WorkflowStats>('/admin/workflows/stats/summary');
      } catch {
        return null;
      }
    },
  });

  // Fetch workflow detail
  const { data: workflowDetail } = useQuery<WorkflowDetail>({
    queryKey: ['workflow-detail', selectedWorkflowId],
    queryFn: () => api.get(`/admin/workflows/${selectedWorkflowId}`),
    enabled: !!selectedWorkflowId,
  });

  // Toggle workflow mutation
  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.patch(`/admin/workflows/${id}/toggle`, {});
    },
    onSuccess: () => {
      setMutationError(null);
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-stats'] });
    },
    onError: (err: Error) => setMutationError(err.message),
  });

  // Create from template mutation
  const createFromTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return api.post('/admin/workflows', { template_id: templateId });
    },
    onSuccess: () => {
      setMutationError(null);
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setShowTemplates(false);
    },
    onError: (err: Error) => setMutationError(err.message),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete(`/admin/workflows/${id}`);
    },
    onSuccess: () => {
      setMutationError(null);
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-stats'] });
    },
    onError: (err: Error) => setMutationError(err.message),
  });

  // Update workflow config mutation (for PDF upload)
  const updateConfigMutation = useMutation({
    mutationFn: async ({ id, config }: { id: number; config: Workflow['config'] }) => {
      return api.put(`/admin/workflows/${id}`, { config });
    },
    onSuccess: () => {
      setMutationError(null);
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-detail', selectedWorkflowId] });
    },
    onError: (err: Error) => setMutationError(err.message),
  });

  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 Mo
  const MAX_FILES = 5;

  const handlePdfUpload = async (workflow: Workflow, actionIndex: number, files: FileList) => {
    const actions = [...(workflow.config.actions || [])];
    const action = { ...actions[actionIndex] };
    const currentDocs = (action.documents as WorkflowDocument[] || []);

    if (currentDocs.length + files.length > MAX_FILES) {
      setMutationError(`Maximum ${MAX_FILES} fichiers par action`);
      return;
    }

    const newDocs: WorkflowDocument[] = [...currentDocs];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_SIZE) {
        setMutationError(`${file.name} depasse la limite de 2 Mo`);
        return;
      }
      if (file.type !== 'application/pdf') {
        setMutationError(`${file.name} n'est pas un PDF`);
        return;
      }
      const base64 = await fileToBase64(file);
      newDocs.push({ name: file.name.replace('.pdf', ''), fileName: file.name, fileBase64: base64, size: file.size });
    }

    action.documents = newDocs;
    actions[actionIndex] = action;
    updateConfigMutation.mutate({ id: workflow.id, config: { ...workflow.config, actions } });
  };

  const handleRemoveDoc = (workflow: Workflow, actionIndex: number, docIndex: number) => {
    const actions = [...(workflow.config.actions || [])];
    const action = { ...actions[actionIndex] };
    const docs = [...(action.documents as WorkflowDocument[] || [])];
    docs.splice(docIndex, 1);
    action.documents = docs;
    actions[actionIndex] = action;
    updateConfigMutation.mutate({ id: workflow.id, config: { ...workflow.config, actions } });
  };

  if (isLoading) {
    return (
      <div className="p-3 sm:p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 sm:p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Marketing Automation</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Cette fonctionnalite est disponible a partir du plan Basic (29€/mois).
            </p>
            <Button onClick={() => navigate('/subscription')}>Passer au plan Basic</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Marketing Automation</h1>
            <p className="text-sm text-gray-500">
              Automatisez vos communications et taches repetitives
            </p>
          </div>
          <Button onClick={() => setShowTemplates(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouveau workflow
          </Button>
        </div>
      </div>

        {/* Mutation Error */}
        {mutationError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {mutationError}
            </div>
            <button onClick={() => setMutationError(null)} className="text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Zap className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total_workflows}</p>
                    <p className="text-xs text-gray-500">Workflows</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Play className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.active_workflows}</p>
                    <p className="text-xs text-gray-500">Actifs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Clock className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.executions_this_month}</p>
                    <p className="text-xs text-gray-500">Executions/mois</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <CheckSquare className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.success_rate}%</p>
                    <p className="text-xs text-gray-500">Taux succes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Templates Modal */}
        {showTemplates && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Choisir un template</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setShowTemplates(false)}>
                  Fermer
                </Button>
              </div>
              <CardDescription>
                Selectionnez un template pour creer rapidement un workflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {templatesData?.templates?.map((template: Template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer hover:border-primary-300 transition-colors"
                    onClick={() => createFromTemplateMutation.mutate(template.id)}
                  >
                    <CardContent className="p-4">
                      <h4 className="font-semibold mb-1">{template.nom}</h4>
                      <p className="text-sm text-gray-500 mb-2">{template.description}</p>
                      <Badge variant="secondary">
                        {TRIGGER_LABELS[template.trigger_type] || template.trigger_type}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Workflows List */}
        <Card>
          <CardHeader>
            <CardTitle>Vos workflows</CardTitle>
          </CardHeader>
          <CardContent>
            {workflows && workflows.length === 0 ? (
              <div className="text-center py-12">
                <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Aucun workflow cree</p>
                <p className="text-sm text-gray-500 mb-4">
                  Creez votre premier workflow pour automatiser vos taches
                </p>
                <Button onClick={() => setShowTemplates(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Creer un workflow
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {workflows?.map((workflow) => (
                  <div
                    key={workflow.id}
                    className="border rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div
                        className={`p-2 rounded-lg ${
                          workflow.actif ? 'bg-green-100' : 'bg-gray-100'
                        }`}
                      >
                        {workflow.actif ? (
                          <Play className="h-5 w-5 text-green-600" />
                        ) : (
                          <Pause className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{workflow.nom}</h3>
                          <Badge variant="secondary">
                            {TRIGGER_LABELS[workflow.trigger_type] || workflow.trigger_type}
                          </Badge>
                        </div>
                        {workflow.description && (
                          <p className="text-sm text-gray-500">{workflow.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            {workflow.config.actions?.map((action, i) => (
                              <span key={i} className="flex items-center">
                                {ACTION_ICONS[action.type] || <Settings className="h-3 w-3" />}
                              </span>
                            ))}
                            <span className="ml-1">
                              {workflow.config.actions?.length || 0} action(s)
                            </span>
                          </span>
                          <span>{workflow.executions_total || 0} executions</span>
                          {workflow.last_execution_at && (
                            <span>
                              Derniere:{' '}
                              {new Date(workflow.last_execution_at).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={workflow.actif}
                        onCheckedChange={() => toggleMutation.mutate(workflow.id)}
                        disabled={toggleMutation.isPending}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setSelectedWorkflowId(workflow.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Supprimer le workflow "${workflow.nom}" ?`)) {
                            deleteMutation.mutate(workflow.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Modal Detail Workflow */}
        {selectedWorkflowId && workflowDetail && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 rounded-xl border border-white/10 w-full max-w-2xl max-h-[80vh] overflow-hidden">
              <div className="p-3 sm:p-6 border-b border-white/10 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white">{workflowDetail.workflow.nom}</h2>
                  <p className="text-sm text-white/60">{workflowDetail.workflow.description}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setSelectedWorkflowId(null)}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="p-3 sm:p-6 overflow-y-auto max-h-[60vh]">
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-white/70 mb-2">Configuration</h3>
                  <div className="bg-zinc-800/50 rounded-lg p-4 text-sm">
                    <p className="text-white/80">
                      <span className="text-white/50">Trigger:</span>{' '}
                      {TRIGGER_LABELS[workflowDetail.workflow.trigger_type] || workflowDetail.workflow.trigger_type}
                    </p>
                    <p className="text-white/80 mt-1">
                      <span className="text-white/50">Statut:</span>{' '}
                      <Badge variant={workflowDetail.workflow.actif ? 'default' : 'secondary'}>
                        {workflowDetail.workflow.actif ? 'Actif' : 'Inactif'}
                      </Badge>
                    </p>
                  </div>
                </div>

                {/* Upload PDF pour actions create_signature */}
                {workflowDetail.workflow.config.actions?.map((action, actionIdx) => {
                  if (action.type !== 'create_signature') return null;
                  const docs = (action.documents as WorkflowDocument[]) || [];
                  return (
                    <div key={actionIdx} className="mb-6">
                      <h3 className="text-sm font-medium text-white/70 mb-2">
                        Documents a signer (action #{actionIdx + 1})
                      </h3>
                      <div className="bg-zinc-800/50 rounded-lg p-4">
                        {/* Liste des documents uploades */}
                        {docs.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {docs.map((doc, docIdx) => (
                              <div key={docIdx} className="flex items-center justify-between bg-zinc-700/50 rounded-lg px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-red-400" />
                                  <span className="text-sm text-white">{doc.fileName}</span>
                                  <span className="text-xs text-white/40">{formatFileSize(doc.size)}</span>
                                </div>
                                <button
                                  onClick={() => handleRemoveDoc(workflowDetail.workflow, actionIdx, docIdx)}
                                  className="text-white/40 hover:text-red-400"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Zone upload */}
                        {docs.length < MAX_FILES && (
                          <label className="flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-lg p-4 cursor-pointer hover:border-white/40 transition-colors">
                            <Upload className="h-6 w-6 text-white/40 mb-1" />
                            <span className="text-sm text-white/60">
                              Glissez ou cliquez pour ajouter des PDF
                            </span>
                            <span className="text-xs text-white/30 mt-1">
                              Max {MAX_FILES} fichiers, 2 Mo chacun
                            </span>
                            <input
                              type="file"
                              accept=".pdf,application/pdf"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.length) {
                                  handlePdfUpload(workflowDetail.workflow, actionIdx, e.target.files);
                                  e.target.value = '';
                                }
                              }}
                            />
                          </label>
                        )}

                        {docs.length === 0 && (
                          <p className="text-xs text-white/40 mt-2">
                            Uploadez les contrats/documents que le client devra signer.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div>
                  <h3 className="text-sm font-medium text-white/70 mb-2">
                    Historique des executions ({workflowDetail.executions?.length || 0})
                  </h3>
                  {workflowDetail.executions?.length > 0 ? (
                    <div className="space-y-2">
                      {workflowDetail.executions.map((exec) => (
                        <div
                          key={exec.id}
                          className="bg-zinc-800/50 rounded-lg p-3 flex justify-between items-center"
                        >
                          <div>
                            <p className="text-sm text-white">
                              {exec.entity_type} #{exec.entity_id}
                            </p>
                            <p className="text-xs text-white/50">
                              {new Date(exec.executed_at).toLocaleString('fr-FR')}
                            </p>
                          </div>
                          <Badge
                            variant={exec.statut === 'success' ? 'default' : 'destructive'}
                            className={exec.statut === 'success' ? 'bg-green-600' : ''}
                          >
                            {exec.statut === 'success' ? 'Succes' : 'Echec'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-white/50 text-center py-4">
                      Aucune execution pour ce workflow
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
