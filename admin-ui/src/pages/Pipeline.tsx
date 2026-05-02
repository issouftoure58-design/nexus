import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus, TrendingUp, User, Search, Trash2, MapPin, Percent, Euro,
  Calendar, GripVertical, X, Check, AlertCircle, Target, FileText,
  Edit2, Trophy, XCircle, ChevronDown, ChevronUp, Clock
} from 'lucide-react';
import { useProfile, useBusinessTypeChecks } from '@/contexts/ProfileContext';
import { api } from '../lib/api';
import { splitHoursSegments, majorationBadge, type HoursSegment } from '@/lib/majorations';

interface Client {
  id: number;
  prenom: string;
  nom: string;
  email?: string;
  telephone?: string;
  raison_sociale?: string;
  type_client?: string;
  adresse?: string;
  code_postal?: string;
  ville?: string;
}

interface Service {
  id: number;
  nom: string;
  prix: number; // centimes
  duree: number; // minutes
  taxe_cnaps?: boolean;
  taux_cnaps?: number;
}

interface ServiceLigne {
  service_id: number;
  service_nom: string;
  quantite: number;
  prix_unitaire: number;
  duree_minutes: number;
  date_debut?: string;
  date_fin?: string;
  heure_debut?: string;
  heure_fin?: string;
  taux_horaire?: number;
}

interface Opportunite {
  id: number;
  nom: string;
  description?: string;
  montant: number;
  etape: string;
  probabilite: number;
  date_cloture_prevue?: string;
  priorite: string;
  clients?: Client;
  created_at: string;
}

interface EtapeStats {
  count: number;
  montantTotal: string;
  montantPondere: string;
  label: string;
  color: string;
}

interface PipelineData {
  pipeline: {
    prospect: Opportunite[];
    contact: Opportunite[];
    devis: Opportunite[];
    negociation: Opportunite[];
  };
  stats: Record<string, EtapeStats>;
  previsionCA: string;
}

const ETAPES = [
  { key: 'prospect', label: 'Prospect', color: 'bg-gray-100 border-gray-300' },
  { key: 'contact', label: 'Contact', color: 'bg-blue-50 border-blue-300' },
  { key: 'devis', label: 'Devis', color: 'bg-yellow-50 border-yellow-300' },
  { key: 'negociation', label: 'Negociation', color: 'bg-orange-50 border-orange-300' }
];

const PRIORITE_COLORS: Record<string, string> = {
  basse: 'bg-gray-100 text-gray-700',
  normale: 'bg-blue-100 text-blue-700',
  haute: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700'
};

const FRAIS_DEPLACEMENT_DEFAUT = 2000; // 20€ en centimes

// B4: Business types allowed for Pipeline
const PIPELINE_BUSINESS_TYPES = ['security', 'service', 'service_domicile'];

export default function PipelinePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t: _t, hasFeature: _hasFeature, isBusinessType } = useProfile();
  const { isServiceDomicile } = useBusinessTypeChecks();

  // B4: Runtime guard — redirect if business type not allowed
  const isAllowed = PIPELINE_BUSINESS_TYPES.some(bt => isBusinessType(bt as any));
  useEffect(() => {
    if (!isAllowed) navigate('/activites', { replace: true });
  }, [isAllowed, navigate]);

  if (!isAllowed) return null;
  const [draggedItem, setDraggedItem] = useState<Opportunite | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Opportunite | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Opportunite | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showHistorique, setShowHistorique] = useState(false);

  // Form state enrichi
  const [clientMode, setClientMode] = useState<'existant' | 'nouveau'>('existant');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [nouveauClient, setNouveauClient] = useState({ prenom: '', nom: '', telephone: '', email: '' });
  const [serviceLignes, setServiceLignes] = useState<ServiceLigne[]>([]);
  const [lieu, setLieu] = useState<'salon' | 'domicile'>('salon');
  const [adresseClient, setAdresseClient] = useState('');
  const [adresseSite, setAdresseSite] = useState('');
  const [remiseType, setRemiseType] = useState<'aucune' | 'pourcentage' | 'montant'>('aucune');
  const [remiseValeur, setRemiseValeur] = useState(0);
  const [remiseMotif, setRemiseMotif] = useState('');
  const [newOpp, setNewOpp] = useState({
    nom: '',
    description: '',
    source: 'autre',
    priorite: 'normale',
    date_debut: '',
    date_cloture_prevue: ''
  });

  // Fetch clients for search
  const { data: clientsData } = useQuery<{ data: Client[] }>({
    queryKey: ['clients-search', clientSearch],
    queryFn: async () => {
      if (!clientSearch || clientSearch.length < 2) return { data: [] };
      return api.get<{ data: Client[] }>(`/admin/clients?search=${encodeURIComponent(clientSearch)}&limit=10`);
    },
    enabled: clientSearch.length >= 2
  });

  // Fetch services
  const { data: servicesData } = useQuery<{ services: Service[] }>({
    queryKey: ['services'],
    queryFn: async () => {
      const raw = await api.get<any>('/admin/services');
      return { services: raw.services || (Array.isArray(raw.data) ? raw.data : []) };
    }
  });

  // Calcul du prix réel par ligne (taux_horaire × heures × jours + majorations)
  const calcLignePrix = (ligne: ServiceLigne): { prixTotal: number; dureeTotaleMin: number; segments: HoursSegment[] } => {
    const hasDatesHeures = ligne.date_debut && ligne.date_fin && ligne.heure_debut && ligne.heure_fin;
    if (!hasDatesHeures || ligne.duree_minutes <= 0) {
      // Fallback : prix catalogue
      return { prixTotal: ligne.prix_unitaire * ligne.quantite, dureeTotaleMin: ligne.duree_minutes * ligne.quantite, segments: [] };
    }

    // Taux horaire en centimes/h
    const tauxH = ligne.prix_unitaire / (ligne.duree_minutes / 60);

    // Itérer sur chaque jour de la plage
    let totalCentimes = 0;
    let totalMinutes = 0;
    const allSegments: HoursSegment[] = [];
    const d = new Date(ligne.date_debut + 'T12:00:00');
    const dFin = new Date(ligne.date_fin + 'T12:00:00');

    while (d <= dFin) {
      const dateStr = d.toISOString().slice(0, 10);
      const segs = splitHoursSegments(dateStr, ligne.heure_debut!, ligne.heure_fin!);

      for (const seg of segs) {
        const montant = Math.round(seg.hours * tauxH * (1 + seg.pourcentage / 100));
        totalCentimes += montant;
        totalMinutes += seg.hours * 60;

        // Agréger les segments par type
        const existing = allSegments.find(s => s.type === seg.type);
        if (existing) {
          existing.hours += seg.hours;
        } else {
          allSegments.push({ ...seg });
        }
      }

      d.setDate(d.getDate() + 1);
    }

    return { prixTotal: totalCentimes * ligne.quantite, dureeTotaleMin: Math.round(totalMinutes * ligne.quantite), segments: allSegments };
  };

  // Calcul des montants
  const calculMontants = useMemo(() => {
    let sousTotal = 0;
    let dureeTotale = 0;

    for (const l of serviceLignes) {
      const { prixTotal, dureeTotaleMin } = calcLignePrix(l);
      sousTotal += prixTotal;
      dureeTotale += dureeTotaleMin;
    }

    let fraisDeplacement = lieu === 'domicile' ? FRAIS_DEPLACEMENT_DEFAUT : 0;

    let montantHT = sousTotal + fraisDeplacement;
    let montantRemise = 0;

    if (remiseType === 'pourcentage' && remiseValeur > 0) {
      montantRemise = Math.round(montantHT * remiseValeur / 100);
    } else if (remiseType === 'montant' && remiseValeur > 0) {
      montantRemise = remiseValeur * 100; // Convertir euros en centimes
    }

    montantHT -= montantRemise;

    // CNAPS: taxe sur les services qui ont taxe_cnaps=true
    let montantCnaps = 0;
    const allServices = servicesData?.services || [];
    for (const l of serviceLignes) {
      const service = allServices.find(s => s.id === l.service_id);
      if (service?.taxe_cnaps && (service.taux_cnaps ?? 0) > 0) {
        const { prixTotal } = calcLignePrix(l);
        montantCnaps += Math.round(prixTotal * (service.taux_cnaps ?? 0) / 100);
      }
    }
    montantHT += montantCnaps;

    const montantTVA = Math.round(montantHT * 0.2);
    const montantTTC = montantHT + montantTVA;

    return { sousTotal, dureeTotale, fraisDeplacement, montantRemise, montantCnaps, montantHT, montantTVA, montantTTC };
  }, [serviceLignes, lieu, remiseType, remiseValeur, servicesData]);

  // Ajouter un service
  const handleAddService = (serviceId: number) => {
    const service = servicesData?.services?.find(s => s.id === serviceId);
    if (!service) return;

    // Vérifier si déjà présent
    const existing = serviceLignes.find(l => l.service_id === serviceId);
    if (existing) {
      setServiceLignes(prev => prev.map(l =>
        l.service_id === serviceId ? { ...l, quantite: l.quantite + 1 } : l
      ));
    } else {
      setServiceLignes(prev => [...prev, {
        service_id: service.id,
        service_nom: service.nom,
        quantite: 1,
        prix_unitaire: service.prix,
        duree_minutes: service.duree,
        date_debut: '',
        date_fin: '',
        heure_debut: '',
        heure_fin: ''
      }]);
    }
  };

  // Supprimer un service
  const handleRemoveService = (serviceId: number) => {
    setServiceLignes(prev => prev.filter(l => l.service_id !== serviceId));
  };

  // Reset form
  const resetForm = () => {
    setClientMode('existant');
    setClientSearch('');
    setSelectedClient(null);
    setNouveauClient({ prenom: '', nom: '', telephone: '', email: '' });
    setServiceLignes([]);
    setLieu('salon');
    setAdresseClient('');
    setAdresseSite('');
    setRemiseType('aucune');
    setRemiseValeur(0);
    setRemiseMotif('');
    setNewOpp({ nom: '', description: '', source: 'autre', priorite: 'normale', date_debut: '', date_cloture_prevue: '' });
  };

  // Fetch pipeline data (API returns paginated wrapper { data: PipelineData, page, limit, total })
  const { data: rawData, isLoading, error } = useQuery<PipelineData | { data: PipelineData }>({
    queryKey: ['pipeline'],
    queryFn: () => api.get('/admin/pipeline')
  });
  const data: PipelineData | undefined = rawData
    ? ('pipeline' in rawData ? rawData as PipelineData : (rawData as { data: PipelineData }).data)
    : undefined;

  // Move opportunity mutation
  const moveMutation = useMutation({
    mutationFn: async ({ id, etape }: { id: number; etape: string }) => {
      return api.patch(`/admin/pipeline/${id}/etape`, { etape });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    },
    onError: (_err: Error) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    }
  });

  // Create opportunity mutation (enrichie)
  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        nom: newOpp.nom,
        description: newOpp.description || null,
        source: newOpp.source || 'autre',
        priorite: newOpp.priorite || 'normale',
        date_debut: newOpp.date_debut || null,
        date_cloture_prevue: newOpp.date_cloture_prevue || null,
        lieu,
        adresse_client: adresseSite || (lieu === 'domicile' ? adresseClient : null),
        etape: 'prospect'
      };

      // Client
      if (clientMode === 'existant' && selectedClient) {
        payload.client_id = selectedClient.id;
      } else if (clientMode === 'nouveau' && nouveauClient.prenom && nouveauClient.nom && nouveauClient.telephone) {
        payload.nouveau_client = {
          prenom: nouveauClient.prenom,
          nom: nouveauClient.nom,
          telephone: nouveauClient.telephone,
          email: nouveauClient.email || null
        };
      }

      // Services (enrichis avec dates/horaires + prix réel calculé)
      if (serviceLignes.length > 0) {
        payload.services = serviceLignes.map(l => {
          const { prixTotal } = calcLignePrix(l);
          return {
            service_id: l.service_id,
            quantite: l.quantite,
            date_debut: l.date_debut || null,
            date_fin: l.date_fin || null,
            heure_debut: l.heure_debut || null,
            heure_fin: l.heure_fin || null,
            taux_horaire: l.duree_minutes > 0
              ? Math.round((l.prix_unitaire / 100) / (l.duree_minutes / 60))
              : null,
            prix_total_reel: prixTotal // centimes, avec majorations
          };
        });
        // Envoyer les montants calculés par le frontend
        payload.montants_calcules = {
          sous_total: calculMontants.sousTotal,
          montant_ht: calculMontants.montantHT,
          montant_tva: calculMontants.montantTVA,
          montant_ttc: calculMontants.montantTTC
        };
      }

      // Remise
      if (remiseType !== 'aucune' && remiseValeur > 0) {
        payload.remise = {
          type: remiseType,
          valeur: remiseType === 'montant' ? remiseValeur * 100 : remiseValeur, // Montant en centimes
          motif: remiseMotif || null
        };
      }

      return api.post('/admin/pipeline', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      setShowCreateForm(false);
      resetForm();
    },
    onError: () => {
      // Error handled by api wrapper (401 auto-logout)
    }
  });

  // Fetch historique (gagnées/perdues)
  const { data: historiqueData } = useQuery<any>({
    queryKey: ['pipeline-closed'],
    queryFn: async () => {
      const raw = await api.get<any>('/admin/pipeline/stats/historique?periode=365');
      return raw?.data || raw;
    },
    enabled: showHistorique
  });

  // Win/Lose mutations
  const winMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.patch(`/admin/pipeline/${id}/etape`, { etape: 'gagne' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-closed'] });
      setFeedbackMsg({ type: 'success', text: 'Opportunite marquee comme gagnee !' });
      setTimeout(() => setFeedbackMsg(null), 4000);
    },
    onError: () => {}
  });

  const loseMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.patch(`/admin/pipeline/${id}/etape`, { etape: 'perdu' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-closed'] });
      setFeedbackMsg({ type: 'error', text: 'Opportunite marquee comme perdue.' });
      setTimeout(() => setFeedbackMsg(null), 4000);
    },
    onError: () => {}
  });

  // Create devis from opportunity
  const createDevisMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.post(`/admin/pipeline/${id}/devis`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      navigate('/devis');
    },
    onError: () => {}
  });

  // Delete opportunity mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return api.delete(`/admin/pipeline/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      setDeleteConfirm(null);
    },
    onError: () => {}
  });

  // Edit opportunity mutation
  const editMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<Opportunite> }) => {
      return api.put(`/admin/pipeline/${data.id}`, data.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      setEditingOpp(null);
    },
    onError: () => {}
  });

  const handleDragStart = (opp: Opportunite) => {
    setDraggedItem(opp);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (etape: string) => {
    if (draggedItem && draggedItem.etape !== etape) {
      moveMutation.mutate({ id: draggedItem.id, etape });
    }
    setDraggedItem(null);
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
      <div className="p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Pipeline Commercial</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Cette fonctionnalite est disponible a partir du plan Starter (69€/mois).
            </p>
            <Button onClick={() => navigate('/subscription')}>Passer au plan Starter</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pipeline Commercial</h1>
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Target className="h-4 w-4" />
              Prevision CA pondere :
              <span className="font-bold text-green-600 text-lg">
                {data?.previsionCA || '0'} EUR
              </span>
            </p>
          </div>
          <Button onClick={() => setShowCreateForm(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nouvelle opportunite
          </Button>
        </div>
      </div>

        {/* Create Form Enrichi */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Nouvelle opportunite</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Nom de l'opportunite */}
                <Input
                  placeholder="Nom de l'opportunite *"
                  value={newOpp.nom}
                  onChange={(e) => setNewOpp({ ...newOpp, nom: e.target.value })}
                  className="text-lg"
                />

                {/* Section Contact */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="font-medium text-gray-700">Contact:</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={clientMode === 'existant' ? 'default' : 'outline'}
                        onClick={() => setClientMode('existant')}
                      >
                        Contact existant
                      </Button>
                      <Button
                        size="sm"
                        variant={clientMode === 'nouveau' ? 'default' : 'outline'}
                        onClick={() => setClientMode('nouveau')}
                      >
                        + Nouveau contact
                      </Button>
                    </div>
                  </div>

                  {clientMode === 'existant' ? (
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Rechercher un contact..."
                        value={clientSearch}
                        onChange={(e) => {
                          setClientSearch(e.target.value);
                          setSelectedClient(null);
                        }}
                        className="pl-10"
                      />
                      {selectedClient && (
                        <div className="mt-2 p-2 bg-blue-50 rounded flex items-center justify-between">
                          <span>{selectedClient.raison_sociale || `${selectedClient.prenom} ${selectedClient.nom}`} - {selectedClient.telephone}</span>
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedClient(null); setClientSearch(''); }}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {!selectedClient && (clientsData?.data?.length ?? 0) > 0 && (
                        <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {clientsData!.data.map((c: Client) => (
                            <button
                              key={c.id}
                              className="w-full text-left px-4 py-2 hover:bg-gray-100"
                              onClick={() => { setSelectedClient(c); setClientSearch(''); }}
                            >
                              {c.raison_sociale || `${c.prenom} ${c.nom}`} - {c.telephone}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Input placeholder="Prenom *" value={nouveauClient.prenom} onChange={(e) => setNouveauClient({ ...nouveauClient, prenom: e.target.value })} />
                      <Input placeholder="Nom *" value={nouveauClient.nom} onChange={(e) => setNouveauClient({ ...nouveauClient, nom: e.target.value })} />
                      <Input placeholder="Telephone *" value={nouveauClient.telephone} onChange={(e) => setNouveauClient({ ...nouveauClient, telephone: e.target.value })} />
                      <Input placeholder="Email" value={nouveauClient.email} onChange={(e) => setNouveauClient({ ...nouveauClient, email: e.target.value })} />
                    </div>
                  )}
                </div>

                {/* Adresse du site */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adresse du site</label>
                  {selectedClient?.adresse && (
                    <label className="flex items-center gap-2 mb-2 text-sm text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={adresseSite === [selectedClient.adresse, selectedClient.code_postal, selectedClient.ville].filter(Boolean).join(', ')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAdresseSite([selectedClient.adresse, selectedClient.code_postal, selectedClient.ville].filter(Boolean).join(', '));
                          } else {
                            setAdresseSite('');
                          }
                        }}
                      />
                      Identique à l'adresse de facturation
                    </label>
                  )}
                  <Input
                    placeholder="Adresse complete du lieu de prestation..."
                    value={adresseSite}
                    onChange={(e) => setAdresseSite(e.target.value)}
                  />
                </div>

                {/* Section Services */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-700">Services:</span>
                    <select
                      className="border rounded-lg p-2 text-sm"
                      value=""
                      onChange={(e) => { if (e.target.value) handleAddService(parseInt(e.target.value)); }}
                    >
                      <option value="">+ Ajouter un service</option>
                      {servicesData?.services?.map((s) => (
                        <option key={s.id} value={s.id}>{s.nom} - {(s.prix / 100).toFixed(2)}€</option>
                      ))}
                    </select>
                  </div>

                  {serviceLignes.length > 0 ? (
                    <div className="space-y-3">
                      {serviceLignes.map((ligne) => {
                        const ligneCalc = calcLignePrix(ligne);
                        const tauxH = ligne.duree_minutes > 0 ? Math.round((ligne.prix_unitaire / 100) / (ligne.duree_minutes / 60)) : 0;
                        return (
                        <div key={ligne.service_id} className="bg-white border rounded-lg p-3 space-y-2">
                          {/* Header: nom + quantité + prix + supprimer */}
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm flex-1">{ligne.service_nom}</span>
                            <Input
                              type="number"
                              min="1"
                              value={ligne.quantite}
                              onChange={(e) => setServiceLignes(prev => prev.map(l =>
                                l.service_id === ligne.service_id ? { ...l, quantite: parseInt(e.target.value) || 1 } : l
                              ))}
                              className="w-16 text-center"
                            />
                            <span className="text-xs text-gray-500">{ligneCalc.dureeTotaleMin} min</span>
                            <span className="text-sm font-medium w-28 text-right">{(ligneCalc.prixTotal / 100).toFixed(2)} €</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveService(ligne.service_id)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          {/* Dates par ligne */}
                          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-500">Du</span>
                            <input
                              type="date"
                              value={ligne.date_debut || ''}
                              onChange={(e) => setServiceLignes(prev => prev.map(l =>
                                l.service_id === ligne.service_id ? { ...l, date_debut: e.target.value } : l
                              ))}
                              className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-xs text-gray-500">au</span>
                            <input
                              type="date"
                              value={ligne.date_fin || ''}
                              onChange={(e) => setServiceLignes(prev => prev.map(l =>
                                l.service_id === ligne.service_id ? { ...l, date_fin: e.target.value } : l
                              ))}
                              min={ligne.date_debut || ''}
                              className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          {/* Horaires par ligne */}
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <span className="text-xs text-gray-500">Horaires:</span>
                            <input
                              type="time"
                              value={ligne.heure_debut || ''}
                              onChange={(e) => {
                                const hDebut = e.target.value;
                                // Auto-calcul heure_fin = heure_debut + duree_minutes
                                let hFin = '';
                                if (hDebut && ligne.duree_minutes) {
                                  const [h, m] = hDebut.split(':').map(Number);
                                  const totalMin = h * 60 + m + ligne.duree_minutes;
                                  const fh = Math.floor(totalMin / 60) % 24;
                                  const fm = totalMin % 60;
                                  hFin = `${String(fh).padStart(2, '0')}:${String(fm).padStart(2, '0')}`;
                                }
                                setServiceLignes(prev => prev.map(l =>
                                  l.service_id === ligne.service_id ? { ...l, heure_debut: hDebut, heure_fin: hFin || l.heure_fin } : l
                                ));
                              }}
                              className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <span className="text-gray-400">{'\u2192'}</span>
                            <input
                              type="time"
                              value={ligne.heure_fin || ''}
                              onChange={(e) => setServiceLignes(prev => prev.map(l =>
                                l.service_id === ligne.service_id ? { ...l, heure_fin: e.target.value } : l
                              ))}
                              className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          {/* Taux horaire + badges majorations */}
                          {ligne.duree_minutes > 0 && (
                            <div className="flex items-center gap-2 flex-wrap">
                              <Euro className="w-4 h-4 text-gray-400 flex-shrink-0" />
                              <span className="text-xs text-gray-500">Taux horaire:</span>
                              <span className="text-sm font-medium text-gray-700">{tauxH} €/h</span>
                              {ligneCalc.segments.filter(s => s.type !== 'jour').map(s => (
                                <span key={s.type} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-xs">
                                  {majorationBadge(s.type)} {s.label} {s.hours.toFixed(1)}h (+{s.pourcentage}%)
                                </span>
                              ))}
                              {ligneCalc.segments.some(s => s.type === 'jour') && (
                                <span className="text-xs text-gray-400">
                                  Jour: {ligneCalc.segments.find(s => s.type === 'jour')!.hours.toFixed(1)}h
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm italic">Aucun service selectionne</p>
                  )}
                </div>

                {/* Lieu et Date */}
                <div className={`grid grid-cols-1 ${isServiceDomicile ? 'md:grid-cols-3' : 'md:grid-cols-1'} gap-4`}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date debut</label>
                    <Input
                      type="date"
                      value={newOpp.date_debut}
                      onChange={(e) => setNewOpp({ ...newOpp, date_debut: e.target.value })}
                    />
                  </div>
                  {isServiceDomicile && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Lieu</label>
                        <div className="flex gap-2">
                          <Button size="sm" variant={lieu === 'salon' ? 'default' : 'outline'} onClick={() => setLieu('salon')} className="flex-1">
                            <MapPin className="h-4 w-4 mr-1" /> Salon
                          </Button>
                          <Button size="sm" variant={lieu === 'domicile' ? 'default' : 'outline'} onClick={() => setLieu('domicile')} className="flex-1">
                            <MapPin className="h-4 w-4 mr-1" /> Domicile
                          </Button>
                        </div>
                      </div>
                      {lieu === 'domicile' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Adresse client</label>
                          <Input placeholder="Adresse..." value={adresseClient} onChange={(e) => setAdresseClient(e.target.value)} />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Geste commercial */}
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="font-medium text-gray-700">Geste commercial:</span>
                    <select
                      className="border rounded-lg p-2 text-sm"
                      value={remiseType}
                      onChange={(e) => setRemiseType(e.target.value as 'aucune' | 'pourcentage' | 'montant')}
                    >
                      <option value="aucune">Aucun</option>
                      <option value="pourcentage">Remise %</option>
                      <option value="montant">Remise fixe €</option>
                    </select>
                    {remiseType !== 'aucune' && (
                      <>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            value={remiseValeur}
                            onChange={(e) => setRemiseValeur(parseFloat(e.target.value) || 0)}
                            className="w-20"
                          />
                          {remiseType === 'pourcentage' ? <Percent className="h-4 w-4" /> : <Euro className="h-4 w-4" />}
                        </div>
                        <select className="border rounded-lg p-2 text-sm" value={remiseMotif} onChange={(e) => setRemiseMotif(e.target.value)}>
                          <option value="">Motif...</option>
                          <option value="bienvenue">Bienvenue</option>
                          <option value="fidelite">Fidelite</option>
                          <option value="promo">Promo</option>
                          <option value="autre">Autre</option>
                        </select>
                      </>
                    )}
                  </div>
                </div>

                {/* Recapitulatif montants */}
                {serviceLignes.length > 0 && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <span className="text-gray-600">Sous-total services:</span>
                      <span className="text-right">{(calculMontants.sousTotal / 100).toFixed(2)} €</span>

                      {lieu === 'domicile' && (
                        <>
                          <span className="text-gray-600">Frais deplacement:</span>
                          <span className="text-right">{(calculMontants.fraisDeplacement / 100).toFixed(2)} €</span>
                        </>
                      )}

                      {calculMontants.montantRemise > 0 && (
                        <>
                          <span className="text-gray-600">Remise:</span>
                          <span className="text-right text-red-600">-{(calculMontants.montantRemise / 100).toFixed(2)} €</span>
                        </>
                      )}

                      {calculMontants.montantCnaps > 0 && (
                        <>
                          <span className="text-gray-600">Taxe CNAPS (0.50%):</span>
                          <span className="text-right">{(calculMontants.montantCnaps / 100).toFixed(2)} €</span>
                        </>
                      )}

                      <span className="text-gray-600">Total HT{calculMontants.montantCnaps > 0 ? ' (incl. CNAPS)' : ''}:</span>
                      <span className="text-right font-medium">{(calculMontants.montantHT / 100).toFixed(2)} €</span>

                      <span className="text-gray-600">TVA (20%):</span>
                      <span className="text-right">{(calculMontants.montantTVA / 100).toFixed(2)} €</span>

                      <span className="text-gray-800 font-bold text-lg">Total TTC:</span>
                      <span className="text-right font-bold text-lg text-green-600">{(calculMontants.montantTTC / 100).toFixed(2)} €</span>

                      <span className="text-gray-500 text-xs">Duree totale:</span>
                      <span className="text-right text-gray-500 text-xs">{calculMontants.dureeTotale} min</span>
                    </div>
                  </div>
                )}

                {/* Source, Priorite, Date cloture */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
                    <select className="w-full border rounded-lg p-2 text-sm" value={newOpp.source} onChange={(e) => setNewOpp({ ...newOpp, source: e.target.value })}>
                      <option value="site_web">Site Web</option>
                      <option value="recommandation">Recommandation</option>
                      <option value="reseaux_sociaux">Reseaux Sociaux</option>
                      <option value="pub">Publicite</option>
                      <option value="autre">Autre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priorite</label>
                    <select className="w-full border rounded-lg p-2 text-sm" value={newOpp.priorite} onChange={(e) => setNewOpp({ ...newOpp, priorite: e.target.value })}>
                      <option value="basse">Basse</option>
                      <option value="normale">Normale</option>
                      <option value="haute">Haute</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date cloture prevue</label>
                    <Input type="date" value={newOpp.date_cloture_prevue} onChange={(e) => setNewOpp({ ...newOpp, date_cloture_prevue: e.target.value })} />
                  </div>
                </div>

                {/* Description */}
                <textarea
                  placeholder="Notes / Description..."
                  className="w-full border rounded-lg p-3 h-20 text-sm focus:ring-2 focus:ring-blue-500"
                  value={newOpp.description}
                  onChange={(e) => setNewOpp({ ...newOpp, description: e.target.value })}
                />

                {/* Boutons */}
                <div className="flex gap-2 justify-end pt-4 border-t">
                  <Button variant="outline" onClick={() => { setShowCreateForm(false); resetForm(); }}>
                    Annuler
                  </Button>
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={!newOpp.nom || createMutation.isPending}
                  >
                    {createMutation.isPending ? 'Creation...' : 'Creer l\'opportunite'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Feedback banner */}
        {feedbackMsg && (
          <div className={`p-3 rounded-lg flex items-center gap-2 text-sm font-medium ${
            feedbackMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {feedbackMsg.type === 'success' ? <Trophy className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {feedbackMsg.text}
            <button onClick={() => setFeedbackMsg(null)} className="ml-auto p-1 hover:bg-white/50 rounded"><X className="h-3 w-3" /></button>
          </div>
        )}

        {/* Pipeline Kanban */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-h-[400px] lg:min-h-[600px]">
          {ETAPES.map((etape) => {
            const opps = data?.pipeline[etape.key as keyof typeof data.pipeline] || [];
            const stats = data?.stats[etape.key];

            return (
              <div
                key={etape.key}
                className="flex flex-col"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(etape.key)}
              >
                {/* Column Header */}
                <div className={`${etape.color} border-2 p-4 rounded-t-lg`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-800">{etape.label}</h3>
                    <Badge variant="secondary">{stats?.count || 0}</Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between text-gray-600">
                      <span>Total:</span>
                      <span className="font-medium">{stats?.montantTotal || 0} EUR</span>
                    </div>
                    <div className="flex justify-between text-green-700">
                      <span>Pondere:</span>
                      <span className="font-bold">{stats?.montantPondere || 0} EUR</span>
                    </div>
                  </div>
                </div>

                {/* Cards Container */}
                <div
                  className={`flex-1 p-2 bg-gray-50 border-x-2 border-b-2 ${etape.color.replace('bg-', 'border-').split(' ')[1]} rounded-b-lg space-y-2 overflow-y-auto`}
                >
                  {opps.map((opp) => (
                    <Card
                      key={opp.id}
                      draggable
                      onDragStart={() => handleDragStart(opp)}
                      className={`cursor-move hover:shadow-lg transition-all ${
                        draggedItem?.id === opp.id ? 'opacity-50 scale-95' : ''
                      }`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-1">
                            <GripVertical className="h-4 w-4 text-gray-400" />
                            <span className="font-medium text-sm truncate max-w-[100px]">
                              {opp.nom}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge
                              variant="secondary"
                              className={PRIORITE_COLORS[opp.priorite] || ''}
                            >
                              {opp.probabilite}%
                            </Badge>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingOpp(opp); }}
                              className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600"
                              title="Modifier"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(opp); }}
                              className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600"
                              title="Supprimer"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {opp.clients && (
                          <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                            <User className="h-3 w-3" />
                            {opp.clients.raison_sociale || `${opp.clients.prenom} ${opp.clients.nom}`}
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="font-bold text-green-600">
                            {opp.montant.toLocaleString('fr-FR')} EUR
                          </span>
                          {opp.date_cloture_prevue && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(opp.date_cloture_prevue).toLocaleDateString('fr-FR')}
                            </span>
                          )}
                        </div>

                        {/* Create devis button for prospect/contact stages */}
                        {['prospect', 'contact'].includes(opp.etape) && (
                          <div className="mt-2 pt-2 border-t">
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full text-blue-600 hover:bg-blue-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                createDevisMutation.mutate(opp.id);
                              }}
                              disabled={createDevisMutation.isPending}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Creer devis
                            </Button>
                          </div>
                        )}

                        {/* Win/Lose buttons for negociation stage */}
                        {opp.etape === 'negociation' && (
                          <div className="flex gap-1 mt-2 pt-2 border-t">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-green-600 hover:bg-green-50"
                              onClick={() => winMutation.mutate(opp.id)}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Gagne
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-red-600 hover:bg-red-50"
                              onClick={() => loseMutation.mutate(opp.id)}
                            >
                              <X className="h-3 w-3 mr-1" />
                              Perdu
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {opps.length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      Deposez une opportunite ici
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Stats */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Synthese du pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              {ETAPES.map((etape) => {
                const stats = data?.stats[etape.key];
                return (
                  <div key={etape.key} className="p-4 rounded-lg bg-gray-50">
                    <div className="text-3xl font-bold text-gray-800">{stats?.count || 0}</div>
                    <div className="text-sm text-gray-500 mb-2">{etape.label}</div>
                    <div className="text-sm font-medium text-green-600">
                      {stats?.montantTotal || 0} EUR
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Historique gagnées/perdues */}
        <div className="mt-6">
          <button
            onClick={() => setShowHistorique(!showHistorique)}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 mb-3"
          >
            {showHistorique ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Historique des opportunites cloturees
          </button>

          {showHistorique && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Gagnées */}
              <Card className="border-green-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                    <Trophy className="h-4 w-4" />
                    Gagnees ({historiqueData?.gagnees?.length || 0})
                    {historiqueData?.stats?.caGagne > 0 && (
                      <span className="ml-auto font-normal text-green-600">
                        {parseFloat(historiqueData.stats.caGagne).toLocaleString('fr-FR')} EUR
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(historiqueData?.gagnees || []).length === 0 ? (
                    <p className="text-sm text-gray-400">Aucune opportunite gagnee</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {(historiqueData?.gagnees || []).map((opp: any) => (
                        <div key={opp.id} className="flex items-center justify-between p-2 bg-green-50 rounded text-sm">
                          <div>
                            <span className="font-medium">{opp.nom}</span>
                            {opp.clients && (
                              <span className="text-gray-500 ml-2">
                                — {opp.clients.raison_sociale || `${opp.clients.prenom} ${opp.clients.nom}`}
                              </span>
                            )}
                          </div>
                          <span className="font-bold text-green-600">{parseFloat(opp.montant).toLocaleString('fr-FR')} EUR</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Perdues */}
              <Card className="border-red-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                    <XCircle className="h-4 w-4" />
                    Perdues ({historiqueData?.perdues?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(historiqueData?.perdues || []).length === 0 ? (
                    <p className="text-sm text-gray-400">Aucune opportunite perdue</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {(historiqueData?.perdues || []).map((opp: any) => (
                        <div key={opp.id} className="flex items-center justify-between p-2 bg-red-50 rounded text-sm">
                          <div>
                            <span className="font-medium">{opp.nom}</span>
                            {opp.clients && (
                              <span className="text-gray-500 ml-2">
                                — {opp.clients.raison_sociale || `${opp.clients.prenom} ${opp.clients.nom}`}
                              </span>
                            )}
                          </div>
                          <span className="font-medium text-red-600">{parseFloat(opp.montant).toLocaleString('fr-FR')} EUR</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle className="text-red-600 flex items-center gap-2">
                  <Trash2 className="h-5 w-5" />
                  Supprimer l'opportunite
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Etes-vous sur de vouloir supprimer l'opportunite <strong>{deleteConfirm.nom}</strong> ?
                  Cette action est irreversible.
                </p>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setDeleteConfirm(null)}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Edit Modal */}
        {editingOpp && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit2 className="h-5 w-5" />
                  Modifier l'opportunite
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    editMutation.mutate({
                      id: editingOpp.id,
                      updates: {
                        nom: formData.get('nom') as string,
                        description: (formData.get('description') as string) || undefined,
                        montant: parseFloat(formData.get('montant') as string) || 0,
                        priorite: formData.get('priorite') as string,
                        date_cloture_prevue: (formData.get('date_cloture_prevue') as string) || undefined
                      }
                    });
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom *
                    </label>
                    <Input
                      name="nom"
                      defaultValue={editingOpp.nom}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      name="description"
                      defaultValue={editingOpp.description || ''}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Montant (EUR)
                      </label>
                      <Input
                        name="montant"
                        type="number"
                        step="0.01"
                        defaultValue={editingOpp.montant}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Priorite
                      </label>
                      <select
                        name="priorite"
                        defaultValue={editingOpp.priorite}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="basse">Basse</option>
                        <option value="normale">Normale</option>
                        <option value="haute">Haute</option>
                        <option value="urgente">Urgente</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date de cloture prevue
                    </label>
                    <Input
                      name="date_cloture_prevue"
                      type="date"
                      defaultValue={editingOpp.date_cloture_prevue?.split('T')[0] || ''}
                    />
                  </div>

                  <div className="flex gap-2 justify-end pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingOpp(null)}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      disabled={editMutation.isPending}
                    >
                      {editMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
    </div>
  );
}
