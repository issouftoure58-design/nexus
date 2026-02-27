import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Building2,
  Save,
  Download,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Info,
  Trash2,
  ShieldCheck,
  XCircle,
  AlertOctagon,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface DSNParametres {
  id?: number;
  tenant_id?: string;
  siren: string;
  raison_sociale: string;
  adresse_siege: string;
  code_postal_siege: string;
  ville_siege: string;
  siret: string;
  nic: string;
  code_naf: string;
  effectif_moyen: number;
  adresse_etablissement: string;
  code_postal_etablissement: string;
  ville_etablissement: string;
  contact_nom: string;
  contact_email: string;
  contact_tel: string;
  logiciel_paie: string;
  version_norme: string;
  fraction: string;
  urssaf_code: string;
  caisse_retraite_code: string;
  caisse_retraite_nom: string;
  prevoyance_code: string;
  prevoyance_nom: string;
  mutuelle_code: string;
  mutuelle_nom: string;
  idcc: string;
  convention_libelle: string;
}

interface DSNHistorique {
  id: number;
  periode: string;
  type_declaration: string;
  statut: string;
  nb_salaries: number;
  total_brut: number;
  fichier_nom: string;
  contenu_dsn: string;
  created_at: string;
}

interface ValidationResult {
  valide: boolean;
  erreurs: Array<{ code: string; type: string; message: string; ligne?: number }>;
  avertissements: Array<{ code: string; type: string; message: string }>;
  stats: {
    nb_rubriques: number;
    nb_salaries: number;
    blocs_trouves: string[];
  };
  rapport: string;
}

const getAuthHeaders = () => {
  const token = localStorage.getItem('nexus_admin_token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

const fetchParametres = async (): Promise<DSNParametres | null> => {
  const res = await fetch(`${API_BASE}/admin/rh/dsn/parametres`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Erreur chargement paramètres');
  const data = await res.json();
  // L'API retourne les données directement, pas enveloppées
  // Vérifier si l'objet a des données (pas juste un objet vide {})
  return data && data.siren ? data : null;
};

const fetchHistorique = async (): Promise<DSNHistorique[]> => {
  const res = await fetch(`${API_BASE}/admin/rh/dsn/historique`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Erreur chargement historique');
  return res.json();
};

export function GenerateurDSN() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'config' | 'generer' | 'historique'>('config');

  // Période pour génération
  const [periode, setPeriode] = useState(() => {
    const now = new Date();
    // Mois précédent par défaut
    now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Formulaire paramètres
  const [formData, setFormData] = useState<Partial<DSNParametres>>({
    siren: '',
    raison_sociale: '',
    adresse_siege: '',
    code_postal_siege: '',
    ville_siege: '',
    siret: '',
    code_naf: '',
    effectif_moyen: 0,
    contact_nom: '',
    contact_email: '',
    contact_tel: '',
    idcc: '',
    convention_libelle: '',
    urssaf_code: '',
    caisse_retraite_code: '',
    caisse_retraite_nom: ''
  });

  // Queries
  const { data: parametres, isLoading: loadingParams } = useQuery({
    queryKey: ['dsn-parametres'],
    queryFn: fetchParametres
  });

  // Mettre à jour le formulaire quand les paramètres sont chargés
  useEffect(() => {
    if (parametres) {
      setFormData(parametres);
    }
  }, [parametres]);

  const { data: historique, isLoading: loadingHistorique } = useQuery({
    queryKey: ['dsn-historique'],
    queryFn: fetchHistorique
  });

  // Mutations
  const saveParamsMutation = useMutation({
    mutationFn: async (params: Partial<DSNParametres>) => {
      const res = await fetch(`${API_BASE}/admin/rh/dsn/parametres`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(params)
      });
      if (!res.ok) throw new Error('Erreur sauvegarde');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dsn-parametres'] });
    }
  });

  const genererDSNMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/admin/rh/dsn/generer`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ periode })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur génération');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dsn-historique'] });
      setActiveTab('historique');
    }
  });

  const supprimerDSNMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/admin/rh/dsn/historique/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Erreur suppression');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dsn-historique'] });
    }
  });

  // État pour la validation
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validatingId, setValidatingId] = useState<number | null>(null);

  const validerDSNMutation = useMutation({
    mutationFn: async (dsnId: number) => {
      setValidatingId(dsnId);
      const res = await fetch(`${API_BASE}/admin/rh/dsn/${dsnId}/valider`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Erreur validation');
      return res.json();
    },
    onSuccess: (data) => {
      setValidationResult(data);
      queryClient.invalidateQueries({ queryKey: ['dsn-historique'] });
    },
    onSettled: () => {
      setValidatingId(null);
    }
  });

  const handleInputChange = (field: keyof DSNParametres, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveParams = () => {
    saveParamsMutation.mutate(formData);
  };

  const handleDownloadDSN = (dsn: DSNHistorique) => {
    const blob = new Blob([dsn.contenu_dsn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = dsn.fichier_nom || `DSN_${dsn.periode}.dsn`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatPeriode = (p: string) => {
    const [year, month] = p.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  const formatMoney = (cents: number) => {
    return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  };

  const isConfigComplete = formData.siren && formData.siret && formData.raison_sociale;

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-blue-800 font-medium">Déclaration Sociale Nominative (DSN)</p>
            <p className="text-sm text-blue-700 mt-1">
              La DSN remplace la plupart des déclarations sociales. Elle doit être transmise mensuellement
              à l'URSSAF via net-entreprises.fr au plus tard le 5 ou le 15 du mois suivant.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === 'config'
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
          onClick={() => setActiveTab('config')}
        >
          <Building2 className="w-4 h-4 inline mr-2" />
          Configuration
        </button>
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === 'generer'
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
          onClick={() => setActiveTab('generer')}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Générer DSN
        </button>
        <button
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            activeTab === 'historique'
              ? "border-blue-500 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          )}
          onClick={() => setActiveTab('historique')}
        >
          <RefreshCw className="w-4 h-4 inline mr-2" />
          Historique
          {(historique?.length || 0) > 0 && (
            <Badge variant="secondary" className="ml-2">{historique?.length}</Badge>
          )}
        </button>
      </div>

      {/* Tab: Configuration */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Entreprise */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Identification Entreprise</CardTitle>
              <CardDescription>Informations légales de votre entreprise (siège social)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">SIREN *</label>
                  <Input
                    value={formData.siren || ''}
                    onChange={(e) => handleInputChange('siren', e.target.value)}
                    placeholder="123456789"
                    maxLength={9}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Raison sociale *</label>
                  <Input
                    value={formData.raison_sociale || ''}
                    onChange={(e) => handleInputChange('raison_sociale', e.target.value)}
                    placeholder="Ma Société SAS"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Adresse siège</label>
                <Input
                  value={formData.adresse_siege || ''}
                  onChange={(e) => handleInputChange('adresse_siege', e.target.value)}
                  placeholder="123 rue de l'Exemple"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Code postal</label>
                  <Input
                    value={formData.code_postal_siege || ''}
                    onChange={(e) => handleInputChange('code_postal_siege', e.target.value)}
                    placeholder="75001"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Ville</label>
                  <Input
                    value={formData.ville_siege || ''}
                    onChange={(e) => handleInputChange('ville_siege', e.target.value)}
                    placeholder="Paris"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Établissement */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Établissement</CardTitle>
              <CardDescription>Informations de l'établissement employeur</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">SIRET *</label>
                  <Input
                    value={formData.siret || ''}
                    onChange={(e) => handleInputChange('siret', e.target.value)}
                    placeholder="12345678900012"
                    maxLength={14}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Code NAF (APE)</label>
                  <Input
                    value={formData.code_naf || ''}
                    onChange={(e) => handleInputChange('code_naf', e.target.value)}
                    placeholder="9602A"
                    maxLength={5}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Adresse établissement</label>
                <Input
                  value={formData.adresse_etablissement || ''}
                  onChange={(e) => handleInputChange('adresse_etablissement', e.target.value)}
                  placeholder="(si différente du siège)"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Code postal</label>
                  <Input
                    value={formData.code_postal_etablissement || ''}
                    onChange={(e) => handleInputChange('code_postal_etablissement', e.target.value)}
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Ville</label>
                  <Input
                    value={formData.ville_etablissement || ''}
                    onChange={(e) => handleInputChange('ville_etablissement', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Effectif moyen</label>
                  <Input
                    type="number"
                    value={formData.effectif_moyen || ''}
                    onChange={(e) => handleInputChange('effectif_moyen', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Convention & Organismes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Convention Collective & Organismes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Code IDCC</label>
                  <Input
                    value={formData.idcc || ''}
                    onChange={(e) => handleInputChange('idcc', e.target.value)}
                    placeholder="2596"
                    maxLength={4}
                  />
                  <p className="text-xs text-gray-500 mt-1">Ex: 2596 = Coiffure</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Libellé convention</label>
                  <Input
                    value={formData.convention_libelle || ''}
                    onChange={(e) => handleInputChange('convention_libelle', e.target.value)}
                    placeholder="Convention collective nationale de la coiffure"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Code URSSAF</label>
                  <Input
                    value={formData.urssaf_code || ''}
                    onChange={(e) => handleInputChange('urssaf_code', e.target.value)}
                    placeholder="117"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Caisse retraite complémentaire</label>
                  <Input
                    value={formData.caisse_retraite_nom || ''}
                    onChange={(e) => handleInputChange('caisse_retraite_nom', e.target.value)}
                    placeholder="AGIRC-ARRCO"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact DSN</CardTitle>
              <CardDescription>Personne responsable des déclarations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium">Nom</label>
                  <Input
                    value={formData.contact_nom || ''}
                    onChange={(e) => handleInputChange('contact_nom', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    type="email"
                    value={formData.contact_email || ''}
                    onChange={(e) => handleInputChange('contact_email', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Téléphone</label>
                  <Input
                    value={formData.contact_tel || ''}
                    onChange={(e) => handleInputChange('contact_tel', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bouton sauvegarder */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveParams}
              disabled={saveParamsMutation.isPending}
            >
              <Save className={cn("w-4 h-4 mr-2", saveParamsMutation.isPending && "animate-spin")} />
              {saveParamsMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder la configuration'}
            </Button>
          </div>

          {saveParamsMutation.isSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-700">Configuration sauvegardée avec succès</span>
            </div>
          )}
        </div>
      )}

      {/* Tab: Générer */}
      {activeTab === 'generer' && (
        <div className="space-y-6">
          {!isConfigComplete && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">Configuration incomplète</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Veuillez compléter la configuration (SIREN, SIRET, Raison sociale) avant de générer une DSN.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setActiveTab('config')}
                >
                  Configurer
                </Button>
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Générer la DSN mensuelle</CardTitle>
              <CardDescription>
                Sélectionnez la période et générez le fichier DSN à transmettre sur net-entreprises.fr
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sélection période */}
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const [y, m] = periode.split('-').map(Number);
                    const d = new Date(y, m - 2);
                    setPeriode(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                  }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="text-xl font-semibold capitalize w-48 text-center">
                  {formatPeriode(periode)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const [y, m] = periode.split('-').map(Number);
                    const d = new Date(y, m);
                    setPeriode(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                  }}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Récapitulatif */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-3">Récapitulatif de la période</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Période</span>
                    <p className="font-medium">{periode}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Type</span>
                    <p className="font-medium">Mensuelle normale</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Format</span>
                    <p className="font-medium">NEODeS P26V01</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Fraction</span>
                    <p className="font-medium">11 (normale)</p>
                  </div>
                </div>
              </div>

              {/* Bouton générer */}
              <div className="flex justify-center">
                <Button
                  size="lg"
                  onClick={() => genererDSNMutation.mutate()}
                  disabled={!isConfigComplete || genererDSNMutation.isPending}
                >
                  <FileText className={cn("w-5 h-5 mr-2", genererDSNMutation.isPending && "animate-spin")} />
                  {genererDSNMutation.isPending ? 'Génération en cours...' : 'Générer la DSN'}
                </Button>
              </div>

              {genererDSNMutation.isError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                  {(genererDSNMutation.error as Error).message}
                </div>
              )}

              {genererDSNMutation.isSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800">DSN générée avec succès !</p>
                    <p className="text-sm text-green-700">Le fichier est disponible dans l'historique.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Étapes suivantes</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                <li>Générez le fichier DSN pour la période souhaitée</li>
                <li>Téléchargez le fichier depuis l'historique</li>
                <li>Connectez-vous sur <a href="https://www.net-entreprises.fr" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">net-entreprises.fr</a></li>
                <li>Déposez le fichier DSN dans votre espace déclarant</li>
                <li>Validez la transmission et conservez l'accusé de réception</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab: Historique */}
      {activeTab === 'historique' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Historique des DSN</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHistorique ? (
              <p className="text-gray-500">Chargement...</p>
            ) : !historique?.length ? (
              <p className="text-gray-500">Aucune DSN générée</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left text-sm text-gray-500">
                      <th className="pb-2">Période</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2 text-right">Salariés</th>
                      <th className="pb-2 text-right">Total brut</th>
                      <th className="pb-2">Généré le</th>
                      <th className="pb-2">Statut</th>
                      <th className="pb-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historique.map((dsn) => (
                      <tr key={dsn.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 font-medium capitalize">
                          {formatPeriode(dsn.periode)}
                        </td>
                        <td className="py-3">
                          <Badge variant="outline">{dsn.type_declaration || 'Mensuelle'}</Badge>
                        </td>
                        <td className="py-3 text-right">{dsn.nb_salaries}</td>
                        <td className="py-3 text-right">{formatMoney(dsn.total_brut)}</td>
                        <td className="py-3 text-gray-600">
                          {new Date(dsn.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-3">
                          <Badge className={cn(
                            dsn.statut === 'transmise' && 'bg-green-100 text-green-700',
                            dsn.statut === 'generee' && 'bg-blue-100 text-blue-700',
                            dsn.statut === 'erreur' && 'bg-red-100 text-red-700'
                          )}>
                            {dsn.statut}
                          </Badge>
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownloadDSN(dsn)}
                              title="Télécharger"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => validerDSNMutation.mutate(dsn.id)}
                              disabled={validerDSNMutation.isPending && validatingId === dsn.id}
                              title="Valider (contrôles NEODeS)"
                            >
                              <ShieldCheck className={cn("w-4 h-4", validatingId === dsn.id && "animate-spin")} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                if (confirm('Supprimer cette DSN de l\'historique ?')) {
                                  supprimerDSNMutation.mutate(dsn.id);
                                }
                              }}
                              disabled={supprimerDSNMutation.isPending}
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Résultats de validation */}
            {validationResult && (
              <div className="mt-6 border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5" />
                    Résultat de validation NEODeS
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setValidationResult(null)}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>

                {/* Statut global */}
                <div className={cn(
                  "rounded-lg p-4 mb-4 flex items-start gap-3",
                  validationResult.valide
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                )}>
                  {validationResult.valide ? (
                    <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  ) : (
                    <AlertOctagon className="w-6 h-6 text-red-600 flex-shrink-0" />
                  )}
                  <div>
                    <p className={cn(
                      "font-medium",
                      validationResult.valide ? "text-green-800" : "text-red-800"
                    )}>
                      {validationResult.valide
                        ? "DSN valide - Prête pour transmission"
                        : "DSN invalide - Corrections requises"
                      }
                    </p>
                    <div className="flex gap-4 mt-2 text-sm">
                      <span className="text-gray-600">
                        {validationResult.stats.nb_rubriques} rubriques
                      </span>
                      <span className="text-gray-600">
                        {validationResult.stats.nb_salaries} salarié(s)
                      </span>
                      <span className="text-gray-600">
                        {validationResult.stats.blocs_trouves.length} blocs
                      </span>
                    </div>
                  </div>
                </div>

                {/* Erreurs */}
                {validationResult.erreurs.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-red-700 mb-2 flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      Erreurs ({validationResult.erreurs.length})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {validationResult.erreurs.map((err, i) => (
                        <div key={i} className="bg-red-50 border border-red-200 rounded p-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant="destructive" className="text-xs">{err.code}</Badge>
                            <span className="text-xs text-red-500">{err.type}</span>
                            {err.ligne && (
                              <span className="text-xs text-gray-500">Ligne {err.ligne}</span>
                            )}
                          </div>
                          <p className="mt-1 text-red-700">{err.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Avertissements */}
                {validationResult.avertissements.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-yellow-700 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Avertissements ({validationResult.avertissements.length})
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {validationResult.avertissements.map((warn, i) => (
                        <div key={i} className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-yellow-100 text-yellow-800 text-xs">{warn.code}</Badge>
                            <span className="text-xs text-yellow-600">{warn.type}</span>
                          </div>
                          <p className="mt-1 text-yellow-700">{warn.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Blocs trouvés */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-2">Blocs DSN détectés</h4>
                  <div className="flex flex-wrap gap-2">
                    {validationResult.stats.blocs_trouves.map((bloc) => (
                      <Badge key={bloc} variant="outline" className="font-mono text-xs">
                        {bloc}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Lien validation externe */}
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="font-medium text-blue-800 mb-2">
                    {validationResult.valide ? '✓ Validation locale réussie' : 'Validation externe recommandée'}
                  </p>
                  <p className="text-sm text-blue-700 mb-3">
                    Pour une validation complète avec tous les contrôles officiels NEODeS,
                    utilisez le service en ligne de net-entreprises.fr (mode test, sans transmission).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href="https://www.net-entreprises.fr/declaration/dsn/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Valider sur net-entreprises.fr
                    </a>
                    <a
                      href="https://www.net-entreprises.fr/services/dsn-val/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white text-blue-600 text-sm font-medium rounded-lg border border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Télécharger DSN-Val (Windows/Linux)
                    </a>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default GenerateurDSN;
