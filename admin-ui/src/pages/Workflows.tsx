import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  LayoutDashboard, ArrowLeft, Plus, Play, Pause, Trash2, Settings,
  Zap, Mail, MessageSquare, Tag, CheckSquare, Eye, Clock, AlertCircle
} from 'lucide-react';

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

const TRIGGER_LABELS: Record<string, string> = {
  new_client: 'Nouveau client',
  rdv_completed: 'RDV termine',
  rdv_cancelled: 'RDV annule',
  facture_payee: 'Facture payee',
  facture_en_retard: 'Facture en retard',
  client_inactive: 'Client inactif',
  anniversaire: 'Anniversaire',
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  send_email: <Mail className="h-4 w-4" />,
  send_sms: <MessageSquare className="h-4 w-4" />,
  send_whatsapp: <MessageSquare className="h-4 w-4" />,
  add_tag: <Tag className="h-4 w-4" />,
  remove_tag: <Tag className="h-4 w-4" />,
  create_task: <CheckSquare className="h-4 w-4" />,
};

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const [showTemplates, setShowTemplates] = useState(false);

  // Fetch workflows
  const { data: workflows, isLoading, error } = useQuery<Workflow[]>({
    queryKey: ['workflows'],
    queryFn: async () => {
      const res = await fetch('/api/admin/workflows', {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Plan Pro requis');
        throw new Error('Erreur chargement');
      }
      return res.json();
    },
  });

  // Fetch templates
  const { data: templatesData } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: async () => {
      const res = await fetch('/api/admin/workflows/templates', {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
      });
      if (!res.ok) return { templates: [] };
      return res.json();
    },
    enabled: showTemplates,
  });

  // Fetch stats
  const { data: stats } = useQuery<WorkflowStats>({
    queryKey: ['workflow-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/workflows/stats/summary', {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Toggle workflow mutation
  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/workflows/${id}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
      });
      if (!res.ok) throw new Error('Erreur toggle');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-stats'] });
    },
  });

  // Create from template mutation
  const createFromTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch('/api/admin/workflows', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ template_id: templateId }),
      });
      if (!res.ok) throw new Error('Erreur creation');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      setShowTemplates(false);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/workflows/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
      });
      if (!res.ok) throw new Error('Erreur suppression');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-stats'] });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Marketing Automation</h2>
              <p className="text-gray-600 mb-4">
                Cette fonctionnalite est disponible a partir du plan Pro.
              </p>
              <Button>Passer au Plan Pro</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Button variant="ghost" asChild className="mb-4">
            <Link to="/" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Retour au dashboard
            </Link>
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Marketing Automation</h1>
              <p className="text-gray-600 mt-1">
                Automatisez vos communications et taches repetitives
              </p>
            </div>
            <Button onClick={() => setShowTemplates(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nouveau workflow
            </Button>
          </div>
        </div>

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
                      <Button size="icon" variant="ghost">
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
      </main>
    </div>
  );
}

function Header() {
  return (
    <header className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary-600" />
            <span className="text-xl font-bold">NEXUS Admin</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link to="/" className="text-gray-600 hover:text-gray-900">
              Dashboard
            </Link>
            <Link to="/segments" className="text-gray-600 hover:text-gray-900">
              Segments
            </Link>
            <Link to="/workflows" className="text-primary-600 font-medium">
              Workflows
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
