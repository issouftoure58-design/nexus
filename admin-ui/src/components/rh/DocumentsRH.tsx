import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Download,
  Plus,
  Send,
  Trash2,
  CheckCircle,
  Clock,
  PenTool,
  RefreshCw,
  Filter,
  Search,
  AlertTriangle,
  X
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Types
interface DocumentType {
  type: string;
  nom: string;
  description: string;
  variables: Array<{ nom: string; description: string; exemple: string }>;
}

interface Membre {
  id: number;
  nom: string;
  prenom: string;
  email: string;
}

interface Document {
  id: number;
  tenant_id: string;
  membre_id: number;
  type: string;
  titre: string;
  fichier_url?: string;
  fichier_nom?: string;
  statut: 'brouillon' | 'finalise' | 'signe' | 'envoye';
  signe_employeur: boolean;
  date_signature_employeur?: string;
  signe_salarie: boolean;
  date_signature_salarie?: string;
  envoye_par_email: boolean;
  date_envoi?: string;
  email_destinataire?: string;
  date_document?: string;
  date_effet?: string;
  notes?: string;
  created_at: string;
  membre?: Membre;
}

interface DPAE {
  id: number;
  membre_id: number;
  date_embauche: string;
  heure_embauche: string;
  type_contrat: string;
  duree_periode_essai?: number;
  statut: 'a_declarer' | 'declaree' | 'confirmee' | 'erreur';
  numero_declaration?: string;
  date_declaration?: string;
  notes?: string;
  created_at: string;
  membre?: Membre;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('nexus_admin_token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

// Fetchers
const fetchDocumentTypes = async (): Promise<DocumentType[]> => {
  const res = await fetch(`${API_BASE}/admin/rh/documents/types`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Erreur chargement types');
  return res.json();
};

const fetchDocuments = async (filters: { type?: string; statut?: string; membre_id?: number }): Promise<Document[]> => {
  const params = new URLSearchParams();
  if (filters.type) params.append('type', filters.type);
  if (filters.statut) params.append('statut', filters.statut);
  if (filters.membre_id) params.append('membre_id', String(filters.membre_id));

  const res = await fetch(`${API_BASE}/admin/rh/documents?${params}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Erreur chargement documents');
  return res.json();
};

const fetchMembres = async (): Promise<Membre[]> => {
  const res = await fetch(`${API_BASE}/admin/rh/membres`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Erreur chargement membres');
  return res.json();
};

const fetchDPAE = async (): Promise<DPAE[]> => {
  const res = await fetch(`${API_BASE}/admin/rh/dpae`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Erreur chargement DPAE');
  return res.json();
};

// Helpers
const getStatutBadge = (statut: string) => {
  switch (statut) {
    case 'brouillon':
      return <Badge variant="outline" className="text-gray-600"><Clock className="w-3 h-3 mr-1" /> Brouillon</Badge>;
    case 'finalise':
      return <Badge variant="outline" className="text-blue-600"><CheckCircle className="w-3 h-3 mr-1" /> Finalisé</Badge>;
    case 'signe':
      return <Badge variant="outline" className="text-green-600"><PenTool className="w-3 h-3 mr-1" /> Signé</Badge>;
    case 'envoye':
      return <Badge className="bg-green-100 text-green-800"><Send className="w-3 h-3 mr-1" /> Envoyé</Badge>;
    default:
      return <Badge variant="outline">{statut}</Badge>;
  }
};

const getDPAEStatutBadge = (statut: string) => {
  switch (statut) {
    case 'a_declarer':
      return <Badge variant="outline" className="text-orange-600"><AlertTriangle className="w-3 h-3 mr-1" /> À déclarer</Badge>;
    case 'declaree':
      return <Badge variant="outline" className="text-blue-600"><Clock className="w-3 h-3 mr-1" /> Déclarée</Badge>;
    case 'confirmee':
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" /> Confirmée</Badge>;
    case 'erreur':
      return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded"><AlertTriangle className="w-3 h-3 inline mr-1" /> Erreur</span>;
    default:
      return <Badge variant="outline">{statut}</Badge>;
  }
};

const getTypeName = (type: string): string => {
  const names: Record<string, string> = {
    'dpae': 'DPAE',
    'contrat_cdi': 'Contrat CDI',
    'contrat_cdd': 'Contrat CDD',
    'avenant': 'Avenant',
    'certificat_travail': 'Certificat de travail',
    'attestation_employeur': 'Attestation employeur',
    'solde_tout_compte': 'Solde de tout compte'
  };
  return names[type] || type;
};

export function DocumentsRH() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'tous' | 'dpae'>('tous');
  const [showGenererModal, setShowGenererModal] = useState(false);
  const [filters, setFilters] = useState<{ type?: string; statut?: string; search?: string }>({});

  // Form state pour génération
  const [genererForm, setGenererForm] = useState({
    membre_id: '',
    type: '',
    notes: ''
  });

  // Queries
  const { data: documentTypes = [], isError: typesError, error: typesErrorMsg } = useQuery({
    queryKey: ['document-types'],
    queryFn: fetchDocumentTypes
  });

  // Debug: log types
  console.log('[DocumentsRH] documentTypes:', documentTypes, 'error:', typesError, typesErrorMsg);

  const { data: documents = [], isLoading: loadingDocs, refetch: refetchDocs } = useQuery({
    queryKey: ['rh-documents', filters],
    queryFn: () => fetchDocuments(filters)
  });

  const { data: membres = [] } = useQuery({
    queryKey: ['rh-membres-list'],
    queryFn: fetchMembres
  });

  const { data: dpaeList = [], isLoading: loadingDPAE, refetch: refetchDPAE } = useQuery({
    queryKey: ['rh-dpae'],
    queryFn: fetchDPAE
  });

  // Mutations
  const genererMutation = useMutation({
    mutationFn: async (data: { membre_id: number; type: string; donnees_supplementaires?: Record<string, unknown> }) => {
      console.log('[DocumentsRH] Generating document:', data);
      const res = await fetch(`${API_BASE}/admin/rh/documents/generer`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
      });
      console.log('[DocumentsRH] Response status:', res.status);
      if (!res.ok) {
        const err = await res.json();
        console.error('[DocumentsRH] Generation error:', err);
        throw new Error(err.error || 'Erreur génération');
      }
      return res.json();
    },
    onSuccess: (data) => {
      console.log('[DocumentsRH] Document generated:', data);
      queryClient.invalidateQueries({ queryKey: ['rh-documents'] });
      setShowGenererModal(false);
      setGenererForm({ membre_id: '', type: '', notes: '' });
    },
    onError: (error) => {
      console.error('[DocumentsRH] Mutation error:', error);
      alert('Erreur: ' + (error as Error).message);
    }
  });

  const downloadPDF = async (documentId: number, filename: string) => {
    console.log('[DocumentsRH] Downloading PDF:', documentId, filename);
    try {
      const fetchUrl = `${API_BASE}/admin/rh/documents/${documentId}/pdf`;
      console.log('[DocumentsRH] Fetch URL:', fetchUrl);
      const res = await fetch(fetchUrl, {
        headers: getAuthHeaders()
      });
      console.log('[DocumentsRH] Response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[DocumentsRH] Download error:', errorText);
        throw new Error('Erreur téléchargement: ' + errorText);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename || `document_${documentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      a.remove();
    } catch (error) {
      console.error('Erreur téléchargement PDF:', error);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/admin/rh/documents/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur suppression');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-documents'] });
    }
  });

  const updateStatutMutation = useMutation({
    mutationFn: async ({ id, statut }: { id: number; statut: string }) => {
      const res = await fetch(`${API_BASE}/admin/rh/documents/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ statut })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur mise à jour');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-documents'] });
    }
  });

  // Filter documents by search
  const filteredDocuments = documents.filter(doc => {
    if (!filters.search) return true;
    const search = filters.search.toLowerCase();
    const membreNom = doc.membre ? `${doc.membre.nom} ${doc.membre.prenom}`.toLowerCase() : '';
    return membreNom.includes(search) || doc.titre?.toLowerCase().includes(search);
  });

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={activeTab === 'tous' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('tous')}
          className="gap-2"
        >
          <FileText className="w-4 h-4" />
          Tous les documents
        </Button>
        <Button
          variant={activeTab === 'dpae' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('dpae')}
          className="gap-2"
        >
          <AlertTriangle className="w-4 h-4" />
          DPAE
          {dpaeList.filter(d => d.statut === 'a_declarer').length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
              {dpaeList.filter(d => d.statut === 'a_declarer').length}
            </span>
          )}
        </Button>
      </div>

      {/* Tab: Tous les documents */}
      {activeTab === 'tous' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Documents RH
            </h3>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchDocs()}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => setShowGenererModal(true)}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Générer un document
              </Button>
            </div>
          </div>

          {/* Filtres */}
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Rechercher par nom..."
                className="pl-10"
                value={filters.search || ''}
                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              />
            </div>
            <select
              className="px-3 py-2 border rounded-lg min-w-[180px]"
              value={filters.type || ''}
              onChange={(e) => setFilters(f => ({ ...f, type: e.target.value || undefined }))}
            >
              <option value="">Tous les types</option>
              {documentTypes.map(dt => (
                <option key={dt.type} value={dt.type}>{dt.nom}</option>
              ))}
            </select>
            <select
              className="px-3 py-2 border rounded-lg min-w-[140px]"
              value={filters.statut || ''}
              onChange={(e) => setFilters(f => ({ ...f, statut: e.target.value || undefined }))}
            >
              <option value="">Tous statuts</option>
              <option value="brouillon">Brouillon</option>
              <option value="finalise">Finalisé</option>
              <option value="signe">Signé</option>
              <option value="envoye">Envoyé</option>
            </select>
          </div>

          {/* Table des documents */}
          {loadingDocs ? (
            <div className="text-center py-8 text-gray-500">Chargement...</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Aucun document trouvé</p>
              <p className="text-sm mt-2">Cliquez sur "Générer un document" pour créer un nouveau document</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salarié</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Titre</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredDocuments.map(doc => (
                    <tr key={doc.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        {doc.membre ? `${doc.membre.prenom} ${doc.membre.nom}` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{getTypeName(doc.type)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">{doc.titre}</td>
                      <td className="px-4 py-3">{getStatutBadge(doc.statut)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadPDF(doc.id, doc.fichier_nom || `${doc.type}_${doc.id}.pdf`)}
                            title="Télécharger PDF"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          {doc.statut === 'brouillon' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updateStatutMutation.mutate({ id: doc.id, statut: 'finalise' })}
                                title="Finaliser"
                                className="text-blue-600"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm('Supprimer ce document ?')) {
                                    deleteMutation.mutate(doc.id);
                                  }
                                }}
                                title="Supprimer"
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {doc.statut === 'finalise' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateStatutMutation.mutate({ id: doc.id, statut: 'signe' })}
                              title="Marquer comme signé"
                              className="text-green-600"
                            >
                              <PenTool className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Tab: DPAE */}
      {activeTab === 'dpae' && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                DPAE - Déclarations Préalables à l'Embauche
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Obligatoire au plus tard 8 jours avant l'embauche
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchDPAE()}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {loadingDPAE ? (
            <div className="text-center py-8 text-gray-500">Chargement...</div>
          ) : dpaeList.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-30 text-green-500" />
              <p>Aucune DPAE en attente</p>
              <p className="text-sm mt-2">Les DPAE sont générées automatiquement lors de la création d'un nouvel employé</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Salarié</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date embauche</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Heure</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type contrat</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Période essai</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° déclaration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dpaeList.map(dpae => (
                    <tr key={dpae.id} className={dpae.statut === 'a_declarer' ? 'bg-orange-50' : ''}>
                      <td className="px-4 py-3 text-sm font-medium">
                        {dpae.membre ? `${dpae.membre.prenom} ${dpae.membre.nom}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(dpae.date_embauche).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 text-sm">{dpae.heure_embauche}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">
                          {dpae.type_contrat.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {dpae.duree_periode_essai ? `${dpae.duree_periode_essai} jours` : '-'}
                      </td>
                      <td className="px-4 py-3">{getDPAEStatutBadge(dpae.statut)}</td>
                      <td className="px-4 py-3 font-mono text-sm">
                        {dpae.numero_declaration || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Info DPAE */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">Comment déclarer une DPAE ?</h4>
            <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
              <li>Téléchargez le document DPAE généré depuis l'onglet "Tous les documents"</li>
              <li>Connectez-vous sur <a href="https://www.net-entreprises.fr" target="_blank" rel="noopener noreferrer" className="underline">net-entreprises.fr</a> ou <a href="https://www.urssaf.fr" target="_blank" rel="noopener noreferrer" className="underline">urssaf.fr</a></li>
              <li>Effectuez la déclaration en ligne avec les informations du document</li>
              <li>Notez le numéro de déclaration et mettez à jour le statut</li>
            </ol>
          </div>
        </Card>
      )}

      {/* Modal: Générer un document */}
      {showGenererModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Générer un document</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowGenererModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Salarié</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg"
                  value={genererForm.membre_id}
                  onChange={(e) => setGenererForm(f => ({ ...f, membre_id: e.target.value }))}
                >
                  <option value="">Sélectionner un salarié...</option>
                  {membres.map(m => (
                    <option key={m.id} value={String(m.id)}>
                      {m.prenom} {m.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Type de document</label>
                <select
                  className="w-full px-3 py-2 border rounded-lg"
                  value={genererForm.type}
                  onChange={(e) => setGenererForm(f => ({ ...f, type: e.target.value }))}
                >
                  <option value="">Sélectionner un type...</option>
                  {documentTypes.map(dt => (
                    <option key={dt.type} value={dt.type}>
                      {dt.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes (optionnel)</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={3}
                  placeholder="Remarques ou informations complémentaires..."
                  value={genererForm.notes}
                  onChange={(e) => setGenererForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="outline" onClick={() => setShowGenererModal(false)}>
                Annuler
              </Button>
              <Button
                onClick={() => {
                  if (genererForm.membre_id && genererForm.type) {
                    genererMutation.mutate({
                      membre_id: parseInt(genererForm.membre_id),
                      type: genererForm.type,
                      donnees_supplementaires: genererForm.notes ? { notes: genererForm.notes } : undefined
                    });
                  }
                }}
                disabled={!genererForm.membre_id || !genererForm.type || genererMutation.isPending}
              >
                {genererMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Génération...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Générer
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
