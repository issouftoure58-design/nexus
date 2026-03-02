/**
 * TarifsSaisonniers - Gestion des tarifs saisonniers hôtel
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Euro,
  Plus,
  Edit2,
  Trash2,
  Calendar,
  Sun,
  Snowflake,
  Palmtree,
  Leaf,
  AlertCircle,
  X,
  Check,
  Bed,
  Coffee,
  Moon,
  Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface Tarif {
  id: number;
  tenant_id: string;
  service_id: number;
  nom: string;
  date_debut: string;
  date_fin: string;
  prix_nuit: number;
  prix_weekend: number | null;
  prix_semaine: number | null;
  petit_dejeuner_inclus: boolean;
  prix_petit_dejeuner: number;
  duree_min_nuits: number;
  actif: boolean;
  service?: {
    id: number;
    nom: string;
    type_chambre: string;
  };
}

interface Chambre {
  id: number;
  nom: string;
  type_chambre: string;
  capacite: number;
  prix: number;
}

// Saisons prédéfinies
const SAISONS_PREDEFINES = [
  { nom: 'Haute saison été', icon: Sun, color: 'orange' },
  { nom: 'Basse saison', icon: Snowflake, color: 'blue' },
  { nom: 'Vacances scolaires', icon: Palmtree, color: 'green' },
  { nom: 'Printemps', icon: Leaf, color: 'emerald' },
  { nom: 'Noël / Nouvel An', icon: Snowflake, color: 'red' },
  { nom: 'Événement local', icon: Calendar, color: 'purple' },
];

export default function TarifsSaisonniers() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingTarif, setEditingTarif] = useState<Tarif | null>(null);
  const [filterChambre, setFilterChambre] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch tarifs
  const { data: tarifs, isLoading } = useQuery<Tarif[]>({
    queryKey: ['hotel-tarifs'],
    queryFn: () => api.get<Tarif[]>('/admin/hotel/tarifs')
  });

  // Fetch chambres pour le select
  const { data: chambres } = useQuery<Chambre[]>({
    queryKey: ['hotel-chambres'],
    queryFn: () => api.get<Chambre[]>('/admin/hotel/chambres')
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Partial<Tarif>) => api.post('/admin/hotel/tarifs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-tarifs'] });
      setShowModal(false);
      setEditingTarif(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<Tarif> & { id: number }) =>
      api.put(`/admin/hotel/tarifs/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-tarifs'] });
      setShowModal(false);
      setEditingTarif(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/hotel/tarifs/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-tarifs'] });
    }
  });

  // Filtrer les tarifs
  const filteredTarifs = tarifs?.filter(tarif => {
    if (filterChambre && tarif.service_id !== parseInt(filterChambre)) return false;
    if (searchTerm && !tarif.nom.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  // Grouper par chambre
  const tarifsByChambre = filteredTarifs?.reduce((acc, tarif) => {
    const chambreNom = tarif.service?.nom || 'Inconnu';
    if (!acc[chambreNom]) acc[chambreNom] = [];
    acc[chambreNom].push(tarif);
    return acc;
  }, {} as Record<string, Tarif[]>);

  // Ouvrir le modal d'édition
  const handleEdit = (tarif: Tarif) => {
    setEditingTarif(tarif);
    setShowModal(true);
  };

  // Supprimer un tarif
  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce tarif saisonnier ?')) return;
    deleteMutation.mutate(id);
  };

  // Toggle actif
  const handleToggleActif = (tarif: Tarif) => {
    updateMutation.mutate({ id: tarif.id, actif: !tarif.actif });
  };

  // Formater le prix
  const formatPrice = (cents: number) => {
    return (cents / 100).toLocaleString('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    });
  };

  // Formater les dates
  const formatDateRange = (debut: string, fin: string) => {
    const d1 = new Date(debut);
    const d2 = new Date(fin);
    return `${d1.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} - ${d2.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  // Vérifier si un tarif est actif (dates valides)
  const isCurrentlyActive = (tarif: Tarif) => {
    const today = new Date().toISOString().slice(0, 10);
    return tarif.actif && today >= tarif.date_debut && today <= tarif.date_fin;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Euro className="w-7 h-7 text-cyan-600" />
            Tarifs Saisonniers
          </h1>
          <p className="text-gray-500 mt-1">
            Gérez les prix selon les saisons et événements
          </p>
        </div>

        <button
          onClick={() => {
            setEditingTarif(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:from-cyan-600 hover:to-blue-700 transition-all shadow-lg"
        >
          <Plus className="w-5 h-5" />
          Nouveau tarif
        </button>
      </div>

      {/* Filtres */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une saison..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>

        <select
          value={filterChambre}
          onChange={(e) => setFilterChambre(e.target.value)}
          className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500"
        >
          <option value="">Toutes les chambres</option>
          {chambres?.map(chambre => (
            <option key={chambre.id} value={chambre.id}>
              {chambre.nom}
            </option>
          ))}
        </select>
      </div>

      {/* Liste des tarifs */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !tarifs || tarifs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <Euro className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucun tarif saisonnier
          </h3>
          <p className="text-gray-500 mb-4">
            Créez des tarifs pour vos différentes saisons et événements
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600"
          >
            <Plus className="w-4 h-4" />
            Créer un tarif
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(tarifsByChambre || {}).map(([chambreNom, chambreTarifs]) => (
            <div key={chambreNom} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b flex items-center gap-2">
                <Bed className="w-5 h-5 text-gray-400" />
                <h3 className="font-semibold text-gray-900">{chambreNom}</h3>
                <span className="text-sm text-gray-500">
                  ({chambreTarifs.length} tarif{chambreTarifs.length > 1 ? 's' : ''})
                </span>
              </div>

              <div className="divide-y">
                {chambreTarifs.map(tarif => {
                  const isActive = isCurrentlyActive(tarif);
                  const saisonIcon = SAISONS_PREDEFINES.find(s => s.nom === tarif.nom);
                  const Icon = saisonIcon?.icon || Calendar;

                  return (
                    <div
                      key={tarif.id}
                      className={cn(
                        'p-4 flex items-center gap-4',
                        !tarif.actif && 'opacity-50'
                      )}
                    >
                      {/* Icône saison */}
                      <div className={cn(
                        'w-12 h-12 rounded-lg flex items-center justify-center',
                        isActive ? 'bg-green-100' : 'bg-gray-100'
                      )}>
                        <Icon className={cn(
                          'w-6 h-6',
                          isActive ? 'text-green-600' : 'text-gray-400'
                        )} />
                      </div>

                      {/* Infos */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{tarif.nom}</h4>
                          {isActive && (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                              En cours
                            </span>
                          )}
                          {!tarif.actif && (
                            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">
                              Désactivé
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDateRange(tarif.date_debut, tarif.date_fin)}
                          </span>
                          {tarif.petit_dejeuner_inclus && (
                            <span className="flex items-center gap-1 text-orange-600">
                              <Coffee className="w-3 h-3" />
                              PDJ inclus
                            </span>
                          )}
                          {tarif.duree_min_nuits > 1 && (
                            <span className="flex items-center gap-1">
                              <Moon className="w-3 h-3" />
                              Min {tarif.duree_min_nuits} nuits
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Prix */}
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">
                          {formatPrice(tarif.prix_nuit)}
                          <span className="text-sm font-normal text-gray-500">/nuit</span>
                        </div>
                        {tarif.prix_weekend && (
                          <div className="text-sm text-gray-500">
                            WE: {formatPrice(tarif.prix_weekend)}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActif(tarif)}
                          className={cn(
                            'p-2 rounded-lg transition-colors',
                            tarif.actif
                              ? 'bg-green-100 text-green-600 hover:bg-green-200'
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          )}
                          title={tarif.actif ? 'Désactiver' : 'Activer'}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(tarif)}
                          className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(tarif.id)}
                          className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal création/édition */}
      {showModal && (
        <TarifModal
          tarif={editingTarif}
          chambres={chambres || []}
          onClose={() => {
            setShowModal(false);
            setEditingTarif(null);
          }}
          onSave={(data) => {
            if (editingTarif) {
              updateMutation.mutate({ id: editingTarif.id, ...data });
            } else {
              createMutation.mutate(data);
            }
          }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  );
}

// Modal de création/édition
function TarifModal({
  tarif,
  chambres,
  onClose,
  onSave,
  isLoading
}: {
  tarif: Tarif | null;
  chambres: Chambre[];
  onClose: () => void;
  onSave: (data: Partial<Tarif>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    service_id: tarif?.service_id || '' as string | number,
    nom: tarif?.nom || '',
    date_debut: tarif?.date_debut || '',
    date_fin: tarif?.date_fin || '',
    prix_nuit: tarif ? tarif.prix_nuit / 100 : '' as string | number,
    prix_weekend: tarif?.prix_weekend ? tarif.prix_weekend / 100 : '' as string | number,
    prix_semaine: tarif?.prix_semaine ? tarif.prix_semaine / 100 : '' as string | number,
    petit_dejeuner_inclus: tarif?.petit_dejeuner_inclus || false,
    prix_petit_dejeuner: tarif ? tarif.prix_petit_dejeuner / 100 : 0 as string | number,
    duree_min_nuits: tarif?.duree_min_nuits || 1 as string | number
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSave({
      service_id: Number(formData.service_id),
      nom: formData.nom,
      date_debut: formData.date_debut,
      date_fin: formData.date_fin,
      prix_nuit: Math.round(Number(formData.prix_nuit) * 100),
      prix_weekend: formData.prix_weekend ? Math.round(Number(formData.prix_weekend) * 100) : null,
      prix_semaine: formData.prix_semaine ? Math.round(Number(formData.prix_semaine) * 100) : null,
      petit_dejeuner_inclus: formData.petit_dejeuner_inclus,
      prix_petit_dejeuner: Math.round(Number(formData.prix_petit_dejeuner) * 100),
      duree_min_nuits: Number(formData.duree_min_nuits)
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">
            {tarif ? 'Modifier le tarif' : 'Nouveau tarif saisonnier'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Chambre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Chambre *
            </label>
            <select
              value={formData.service_id}
              onChange={(e) => setFormData(f => ({ ...f, service_id: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Sélectionner une chambre</option>
              {chambres.map(chambre => (
                <option key={chambre.id} value={chambre.id}>
                  {chambre.nom} ({chambre.type_chambre})
                </option>
              ))}
            </select>
          </div>

          {/* Nom de la saison */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom de la période *
            </label>
            <input
              type="text"
              value={formData.nom}
              onChange={(e) => setFormData(f => ({ ...f, nom: e.target.value }))}
              placeholder="Ex: Haute saison été"
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500"
            />
            {/* Suggestions */}
            <div className="flex flex-wrap gap-2 mt-2">
              {SAISONS_PREDEFINES.map(saison => (
                <button
                  key={saison.nom}
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, nom: saison.nom }))}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                >
                  {saison.nom}
                </button>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date début *
              </label>
              <input
                type="date"
                value={formData.date_debut}
                onChange={(e) => setFormData(f => ({ ...f, date_debut: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date fin *
              </label>
              <input
                type="date"
                value={formData.date_fin}
                onChange={(e) => setFormData(f => ({ ...f, date_fin: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Prix */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prix / nuit *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.prix_nuit}
                  onChange={(e) => setFormData(f => ({ ...f, prix_nuit: e.target.value }))}
                  required
                  className="w-full pl-3 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500"
                />
                <Euro className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prix weekend
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.prix_weekend}
                  onChange={(e) => setFormData(f => ({ ...f, prix_weekend: e.target.value }))}
                  placeholder="Optionnel"
                  className="w-full pl-3 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500"
                />
                <Euro className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prix semaine
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.prix_semaine}
                  onChange={(e) => setFormData(f => ({ ...f, prix_semaine: e.target.value }))}
                  placeholder="7 nuits"
                  className="w-full pl-3 pr-8 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500"
                />
                <Euro className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Petit déjeuner */}
          <div className="flex items-center gap-4 py-2 border-t border-b">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.petit_dejeuner_inclus}
                onChange={(e) => setFormData(f => ({ ...f, petit_dejeuner_inclus: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-sm text-gray-700">Petit-déjeuner inclus</span>
            </label>
            {!formData.petit_dejeuner_inclus && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">ou</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.prix_petit_dejeuner}
                  onChange={(e) => setFormData(f => ({ ...f, prix_petit_dejeuner: e.target.value }))}
                  placeholder="Prix PDJ"
                  className="w-24 px-2 py-1 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500"
                />
                <Euro className="w-4 h-4 text-gray-400" />
              </div>
            )}
          </div>

          {/* Durée minimum */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Durée minimum de séjour
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={formData.duree_min_nuits}
                onChange={(e) => setFormData(f => ({ ...f, duree_min_nuits: e.target.value }))}
                className="w-20 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-500"
              />
              <span className="text-gray-500">nuit(s)</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 transition-all"
            >
              {isLoading ? 'Enregistrement...' : tarif ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export { TarifsSaisonniers };
