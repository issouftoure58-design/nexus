import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Settings,
  Store,
  Calculator,
  CreditCard,
  XCircle,
  MessageSquare,
  Save,
  RotateCcw,
  Eye,
  AlertCircle
} from 'lucide-react';

interface Parametre {
  id: number;
  cle: string;
  valeur: string;
  description: string;
  updated_at: string;
}

interface ParametresGroupes {
  [categorie: string]: Parametre[];
}

type SectionId = 'salon' | 'tarification' | 'paiement' | 'annulation' | 'messages';

export default function Parametres() {
  const { toast } = useToast();

  // États
  const [parametres, setParametres] = useState<ParametresGroupes>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('salon');

  // Valeurs éditées
  const [editedValues, setEditedValues] = useState<{ [cle: string]: string }>({});

  const sections = [
    { id: 'salon' as SectionId, name: 'Infos Fatou', icon: Store },
    { id: 'tarification' as SectionId, name: 'Tarification', icon: Calculator },
    { id: 'paiement' as SectionId, name: 'Paiement', icon: CreditCard },
    { id: 'annulation' as SectionId, name: 'Annulation', icon: XCircle },
    { id: 'messages' as SectionId, name: 'Messages', icon: MessageSquare },
  ];

  useEffect(() => {
    fetchParametres();
  }, []);

  const fetchParametres = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/parametres', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Erreur lors du chargement');

      const data = await response.json();
      setParametres(data.parametres || {});

      // Initialiser les valeurs éditées
      const initialValues: { [cle: string]: string } = {};
      Object.values(data.parametres || {}).forEach((params: any) => {
        params.forEach((param: Parametre) => {
          initialValues[param.cle] = param.valeur;
        });
      });
      setEditedValues(initialValues);
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les paramètres',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (cle: string, valeur: string) => {
    setEditedValues({ ...editedValues, [cle]: valeur });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');

      // Préparer les paramètres modifiés
      const paramsToUpdate = Object.entries(editedValues).map(([cle, valeur]) => ({
        cle,
        valeur
      }));

      const response = await fetch('/api/admin/parametres', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ parametres: paramsToUpdate })
      });

      if (!response.ok) throw new Error('Erreur lors de l\'enregistrement');

      toast({
        title: 'Succès',
        description: 'Paramètres enregistrés avec succès'
      });

      // Recharger les paramètres
      fetchParametres();
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'enregistrer les paramètres',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetParameter = async (cle: string) => {
    if (!confirm('Réinitialiser ce paramètre à sa valeur par défaut ?')) return;

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/parametres/${cle}/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Erreur lors du reset');

      const data = await response.json();
      setEditedValues({ ...editedValues, [cle]: data.parametre.valeur });

      toast({
        title: 'Succès',
        description: 'Paramètre réinitialisé'
      });
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de réinitialiser le paramètre',
        variant: 'destructive'
      });
    }
  };

  const handleInitialize = async () => {
    if (!confirm('Initialiser tous les paramètres par défaut ? (Les valeurs existantes ne seront pas modifiées)')) return;

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/parametres/init', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Erreur lors de l\'initialisation');

      toast({
        title: 'Succès',
        description: 'Paramètres initialisés'
      });

      fetchParametres();
    } catch (error) {
      console.error('Erreur:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible d\'initialiser les paramètres',
        variant: 'destructive'
      });
    }
  };

  const getParamValue = (cle: string): string => {
    return editedValues[cle] || '';
  };

  const calculateDeplacementExample = () => {
    const fraisBase = parseFloat(getParamValue('frais_base_deplacement')) || 0;
    const seuil = parseFloat(getParamValue('seuil_km_gratuit')) || 0;
    const tarifKm = parseFloat(getParamValue('tarif_km_supplementaire')) || 0;
    const distance = 15; // Exemple

    if (distance <= seuil) {
      return `Pour ${distance}km = ${fraisBase.toFixed(2)}€`;
    } else {
      const total = fraisBase + (distance - seuil) * tarifKm;
      return `Pour ${distance}km = ${fraisBase}€ + (${distance}-${seuil}) × ${tarifKm}€ = ${total.toFixed(2)}€`;
    }
  };

  const formatMessagePreview = (template: string) => {
    return template
      .replace('{date}', '20/01/2026')
      .replace('{heure}', '14:00')
      .replace('{client}', 'Aminata Diallo')
      .replace('{service}', 'Tresses africaines')
      .replace('{prix}', '80€');
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Chargement...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-3 md:p-8">
        {/* En-tête */}
        <div className="mb-6 md:mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 md:p-3 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg">
                <Settings className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Paramètres</h1>
                <p className="text-gray-600 text-sm md:text-base">Configuration de l'activité</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleInitialize} variant="outline" size="sm" className="text-xs md:text-sm">
                <RotateCcw className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Initialiser</span>
              </Button>
              <Button
                onClick={handleSaveAll}
                disabled={saving}
                size="sm"
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-xs md:text-sm"
              >
                <Save className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation tabs - horizontal sur mobile */}
        <div className="md:hidden mb-4 overflow-x-auto">
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg min-w-max">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`
                    flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors whitespace-nowrap text-sm
                    ${isActive
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                      : 'text-gray-700'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{section.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-6">
          {/* Navigation tabs - sidebar sur desktop */}
          <div className="hidden md:block w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow p-2 space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;

                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                      ${isActive
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{section.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contenu */}
          <div className="flex-1 bg-white rounded-lg shadow p-4 md:p-6">
            {/* Section Salon */}
            {activeSection === 'salon' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Informations de contact</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Ces informations sont utilisées pour les communications et l'affichage public.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom de l'activité
                    </label>
                    <Input
                      type="text"
                      value={getParamValue('nom_salon')}
                      onChange={(e) => handleValueChange('nom_salon', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Adresse complète
                    </label>
                    <Input
                      type="text"
                      value={getParamValue('adresse_salon')}
                      onChange={(e) => handleValueChange('adresse_salon', e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Téléphone
                      </label>
                      <Input
                        type="tel"
                        value={getParamValue('telephone_salon')}
                        onChange={(e) => handleValueChange('telephone_salon', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <Input
                        type="email"
                        value={getParamValue('email_salon')}
                        onChange={(e) => handleValueChange('email_salon', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section Tarification */}
            {activeSection === 'tarification' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Tarification déplacement</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Configuration des frais de déplacement pour les services à domicile.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Frais de base (€)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={getParamValue('frais_base_deplacement')}
                        onChange={(e) => handleValueChange('frais_base_deplacement', e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Frais fixes pour les déplacements courts
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Seuil km gratuit
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={getParamValue('seuil_km_gratuit')}
                        onChange={(e) => handleValueChange('seuil_km_gratuit', e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Distance sans supplément (km)
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tarif km supplémentaire (€/km)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={getParamValue('tarif_km_supplementaire')}
                        onChange={(e) => handleValueChange('tarif_km_supplementaire', e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Prix par km au-delà du seuil
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Distance maximale (km)
                      </label>
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        value={getParamValue('distance_max_km')}
                        onChange={(e) => handleValueChange('distance_max_km', e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Distance maximale acceptée
                      </p>
                    </div>
                  </div>

                  {/* Aperçu calcul */}
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Calculator className="w-5 h-5 text-purple-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-purple-900">Exemple de calcul</p>
                        <p className="text-sm text-purple-700 mt-1">{calculateDeplacementExample()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section Paiement */}
            {activeSection === 'paiement' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Paiement & Acompte</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Configuration des règles de paiement et d'acompte.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Montant de l'acompte (€)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={getParamValue('montant_acompte')}
                      onChange={(e) => handleValueChange('montant_acompte', e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Montant demandé pour confirmer une réservation
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Acompte obligatoire</p>
                      <p className="text-sm text-gray-600">Exiger l'acompte pour confirmer les réservations</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={getParamValue('acompte_obligatoire') === 'true'}
                        onChange={(e) => handleValueChange('acompte_obligatoire', e.target.checked ? 'true' : 'false')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Section Annulation */}
            {activeSection === 'annulation' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Politique d'annulation</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Configuration des règles d'annulation et de remboursement.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Délai d'annulation gratuite (heures)
                    </label>
                    <Input
                      type="number"
                      step="1"
                      min="1"
                      value={getParamValue('delai_annulation_heures')}
                      onChange={(e) => handleValueChange('delai_annulation_heures', e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Nombre d'heures avant le RDV pour annuler gratuitement
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Rembourser si hors délai</p>
                      <p className="text-sm text-gray-600">Rembourser l'acompte en cas d'annulation tardive</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={getParamValue('remboursement_hors_delai') === 'true'}
                        onChange={(e) => handleValueChange('remboursement_hors_delai', e.target.checked ? 'true' : 'false')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {/* Résumé */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">Résumé de la politique</p>
                        <p className="text-sm text-blue-700 mt-1">
                          Annulation gratuite jusqu'à {getParamValue('delai_annulation_heures')} heures avant le RDV.
                          {getParamValue('remboursement_hors_delai') === 'true'
                            ? ' Au-delà, l\'acompte est remboursé.'
                            : ' Au-delà, l\'acompte est conservé.'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Section Messages */}
            {activeSection === 'messages' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Templates de messages</h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Personnalisez les messages automatiques envoyés aux clients.
                  </p>
                </div>

                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
                  <p className="text-sm text-yellow-800">
                    <strong>Variables disponibles :</strong> {'{date}'}, {'{heure}'}, {'{client}'}, {'{service}'}, {'{prix}'}
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Message confirmation */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Message de confirmation
                      </label>
                      <Button
                        onClick={() => handleResetParameter('msg_confirmation')}
                        variant="ghost"
                        size="sm"
                        className="text-purple-600"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Réinitialiser
                      </Button>
                    </div>
                    <Textarea
                      value={getParamValue('msg_confirmation')}
                      onChange={(e) => handleValueChange('msg_confirmation', e.target.value)}
                      rows={2}
                    />
                    <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="flex items-start gap-2">
                        <Eye className="w-4 h-4 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-gray-700">Aperçu :</p>
                          <p className="text-sm text-gray-900 mt-1">
                            {formatMessagePreview(getParamValue('msg_confirmation'))}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message rappel */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Message de rappel (J-1)
                      </label>
                      <Button
                        onClick={() => handleResetParameter('msg_rappel_j1')}
                        variant="ghost"
                        size="sm"
                        className="text-purple-600"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Réinitialiser
                      </Button>
                    </div>
                    <Textarea
                      value={getParamValue('msg_rappel_j1')}
                      onChange={(e) => handleValueChange('msg_rappel_j1', e.target.value)}
                      rows={2}
                    />
                    <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="flex items-start gap-2">
                        <Eye className="w-4 h-4 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-gray-700">Aperçu :</p>
                          <p className="text-sm text-gray-900 mt-1">
                            {formatMessagePreview(getParamValue('msg_rappel_j1'))}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message annulation */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Message d'annulation
                      </label>
                      <Button
                        onClick={() => handleResetParameter('msg_annulation')}
                        variant="ghost"
                        size="sm"
                        className="text-purple-600"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Réinitialiser
                      </Button>
                    </div>
                    <Textarea
                      value={getParamValue('msg_annulation')}
                      onChange={(e) => handleValueChange('msg_annulation', e.target.value)}
                      rows={2}
                    />
                    <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="flex items-start gap-2">
                        <Eye className="w-4 h-4 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-gray-700">Aperçu :</p>
                          <p className="text-sm text-gray-900 mt-1">
                            {formatMessagePreview(getParamValue('msg_annulation'))}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message remerciement */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Message de remerciement (J+1)
                      </label>
                      <Button
                        onClick={() => handleResetParameter('msg_remerciement')}
                        variant="ghost"
                        size="sm"
                        className="text-purple-600"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Réinitialiser
                      </Button>
                    </div>
                    <Textarea
                      value={getParamValue('msg_remerciement')}
                      onChange={(e) => handleValueChange('msg_remerciement', e.target.value)}
                      rows={2}
                    />
                    <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="flex items-start gap-2">
                        <Eye className="w-4 h-4 text-gray-500 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-gray-700">Aperçu :</p>
                          <p className="text-sm text-gray-900 mt-1">
                            {formatMessagePreview(getParamValue('msg_remerciement'))}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
