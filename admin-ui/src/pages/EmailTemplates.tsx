/**
 * Email Templates — CRUD templates email marketing
 * Consomme les endpoints /api/marketing/email-templates
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketingApi, type EmailTemplate } from '@/lib/marketingApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, Trash2, X, Loader2, FileText, Eye, Copy, Mail
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EmailTemplates() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form
  const [formNom, setFormNom] = useState('');
  const [formSujet, setFormSujet] = useState('');
  const [formCorps, setFormCorps] = useState('');

  const notify = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: marketingApi.getTemplates,
  });

  const createMutation = useMutation({
    mutationFn: marketingApi.createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setShowCreateModal(false);
      setFormNom('');
      setFormSujet('');
      setFormCorps('');
      notify('success', 'Template créé');
    },
    onError: (err: Error) => notify('error', err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: marketingApi.deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      notify('success', 'Template supprimé');
    },
    onError: (err: Error) => notify('error', err.message),
  });

  const handleCreate = () => {
    if (!formNom.trim() || !formSujet.trim() || !formCorps.trim()) return;
    createMutation.mutate({ nom: formNom, sujet: formSujet, corps: formCorps });
  };

  const templates = data?.templates || [];
  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR');

  // Variables disponibles dans les templates
  const VARIABLES = [
    '{{prenom}}', '{{nom}}', '{{email}}', '{{business_name}}',
    '{{date_rdv}}', '{{service}}', '{{lien_confirmation}}'
  ];

  const insertVariable = (v: string) => {
    setFormCorps(prev => prev + v);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates Email</h1>
          <p className="text-gray-500 mt-1">Créez des modèles réutilisables pour vos campagnes</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nouveau template
        </Button>
      </div>

      {notification && (
        <div className={cn(
          'px-4 py-3 rounded-lg text-sm font-medium',
          notification.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        )}>
          {notification.message}
        </div>
      )}

      {/* Templates grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="font-medium">Aucun template</p>
            <p className="text-sm mt-1">Créez votre premier modèle email</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Mail className="w-4 h-4 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 truncate">{t.nom}</h3>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">Sujet:</span> {t.sujet}
                </p>
                <p className="text-sm text-gray-400 line-clamp-2 mb-3">{t.corps}</p>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{formatDate(t.created_at)}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreviewTemplate(t)}
                      title="Aperçu"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(t.corps);
                        notify('success', 'Corps copié');
                      }}
                      title="Copier"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMutation.mutate(t.id)}
                      title="Supprimer"
                      className="text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full mx-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">Nouveau template email</h2>
              <button onClick={() => setShowCreateModal(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du template *</label>
                <Input value={formNom} onChange={e => setFormNom(e.target.value)} placeholder="Ex: Confirmation RDV" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sujet de l'email *</label>
                <Input value={formSujet} onChange={e => setFormSujet(e.target.value)} placeholder="Ex: Confirmation de votre rendez-vous" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Corps du message *</label>
                <textarea
                  value={formCorps}
                  onChange={e => setFormCorps(e.target.value)}
                  placeholder="Bonjour {{prenom}},&#10;&#10;Votre rendez-vous est confirmé..."
                  rows={10}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">Variables disponibles :</p>
                  <div className="flex flex-wrap gap-1">
                    {VARIABLES.map(v => (
                      <button
                        key={v}
                        onClick={() => insertVariable(v)}
                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 transition-colors"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>Annuler</Button>
              <Button
                onClick={handleCreate}
                disabled={!formNom.trim() || !formSujet.trim() || !formCorps.trim() || createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Créer le template
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full mx-4 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold">Aperçu : {previewTemplate.nom}</h2>
              <button onClick={() => setPreviewTemplate(null)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <div className="border rounded-lg p-6">
                <div className="border-b pb-3 mb-4">
                  <p className="text-sm text-gray-500">Sujet:</p>
                  <p className="font-semibold text-gray-900">{previewTemplate.sujet}</p>
                </div>
                <div className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
                  {previewTemplate.corps}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
