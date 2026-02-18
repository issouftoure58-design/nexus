import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  Plus,
  Edit,
  Trash2,
  Power,
  Clock,
  Euro,
  Search,
  Percent
} from 'lucide-react';

interface Service {
  id: number;
  nom: string;
  description: string | null;
  prix: number;
  duree_minutes: number;
  categorie: string | null;
  actif: boolean;
  ordre: number;
  taux_tva: number;
  prix_ht?: number;
  prix_tva?: number;
}

export default function AdminServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/services', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      setServices(data.services);
    } catch (error) {
      console.error('Erreur chargement services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (serviceId: number) => {
    try {
      const token = localStorage.getItem('admin_token');
      await fetch(`/api/admin/services/${serviceId}/toggle`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      fetchServices();
    } catch (error) {
      console.error('Erreur toggle:', error);
    }
  };

  const handleDelete = async (serviceId: number, serviceName: string) => {
    if (!confirm(`Supprimer le service "${serviceName}" ?`)) return;

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/services/${serviceId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error);
        return;
      }

      fetchServices();
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingService(null);
    setShowModal(true);
  };

  const filteredServices = services.filter(s =>
    s.nom.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">Chargement...</div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Services</h1>
            <p className="text-gray-600 mt-1">
              Gérez vos prestations et tarifs
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-600 transition"
          >
            <Plus size={20} />
            Nouveau service
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Rechercher un service..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className={`
                bg-white rounded-xl shadow-sm p-6 border-2 transition
                ${service.actif
                  ? 'border-transparent hover:border-purple-200'
                  : 'border-gray-200 opacity-60'
                }
              `}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-800">
                    {service.nom}
                  </h3>
                  {service.categorie && (
                    <span className="inline-block mt-1 px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                      {service.categorie}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleToggle(service.id)}
                  className={`
                    p-2 rounded-lg transition
                    ${service.actif
                      ? 'bg-green-100 text-green-600 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }
                  `}
                >
                  <Power size={18} />
                </button>
              </div>

              {/* Description */}
              {service.description && (
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {service.description}
                </p>
              )}

              {/* Infos */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-gray-700">
                  <Euro size={16} className="text-purple-600" />
                  <span className="font-semibold">{(service.prix / 100).toFixed(2)}€ TTC</span>
                  <span className="text-xs text-gray-400">
                    ({((service.prix_ht || service.prix) / 100).toFixed(2)}€ HT)
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Clock size={16} className="text-purple-600" />
                  <span>{Math.floor(service.duree_minutes / 60)}h{service.duree_minutes % 60 > 0 ? ` ${service.duree_minutes % 60}min` : ''}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <Percent size={16} className="text-purple-600" />
                  <span>TVA {service.taux_tva || 20}%</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={() => handleEdit(service)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition"
                >
                  <Edit size={16} />
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(service.id, service.nom)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredServices.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {searchTerm ? 'Aucun service trouvé' : 'Aucun service pour le moment'}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <ServiceModal
          service={editingService}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            fetchServices();
          }}
        />
      )}
    </AdminLayout>
  );
}

// ════════════════════════════════════════════════════════════════════
// MODAL CRÉATION/ÉDITION SERVICE
// ════════════════════════════════════════════════════════════════════

interface ServiceModalProps {
  service: Service | null;
  onClose: () => void;
  onSave: () => void;
}

function ServiceModal({ service, onClose, onSave }: ServiceModalProps) {
  const [formData, setFormData] = useState({
    nom: service?.nom || '',
    description: service?.description || '',
    prix: service ? (service.prix / 100).toString() : '',
    duree_heures: service ? Math.floor(service.duree_minutes / 60).toString() : '0',
    duree_minutes: service ? (service.duree_minutes % 60).toString() : '0',
    categorie: service?.categorie || 'Coiffure',
    actif: service?.actif !== false,
    taux_tva: service?.taux_tva?.toString() || '20'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const duree_minutes = parseInt(formData.duree_heures) * 60 + parseInt(formData.duree_minutes);

      if (!formData.nom || !formData.prix || duree_minutes === 0) {
        throw new Error('Veuillez remplir tous les champs obligatoires');
      }

      const token = localStorage.getItem('admin_token');
      const url = service
        ? `/api/admin/services/${service.id}`
        : '/api/admin/services';

      const method = service ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nom: formData.nom,
          description: formData.description,
          prix: parseFloat(formData.prix),
          duree_minutes,
          categorie: formData.categorie,
          actif: formData.actif,
          taux_tva: parseFloat(formData.taux_tva)
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erreur serveur');
      }

      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">
            {service ? 'Modifier le service' : 'Nouveau service'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom du service *
            </label>
            <input
              type="text"
              value={formData.nom}
              onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Ex: Tresses classiques"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Description du service..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prix TTC (€) *
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.prix}
                onChange={(e) => setFormData({ ...formData, prix: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="80.00"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Taux TVA *
              </label>
              <select
                value={formData.taux_tva}
                onChange={(e) => setFormData({ ...formData, taux_tva: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="20">20% (normal)</option>
                <option value="10">10% (intermédiaire)</option>
                <option value="5.5">5.5% (réduit)</option>
                <option value="2.1">2.1% (super-réduit)</option>
                <option value="0">0% (exonéré)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Catégorie
              </label>
              <select
                value={formData.categorie}
                onChange={(e) => setFormData({ ...formData, categorie: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option>Coiffure</option>
                <option>Tresses</option>
                <option>Soins</option>
                <option>Autre</option>
              </select>
            </div>
          </div>

          {/* Affichage calcul HT */}
          {formData.prix && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Prix HT:</span>
                <span className="font-medium">
                  {(parseFloat(formData.prix) / (1 + parseFloat(formData.taux_tva) / 100)).toFixed(2)}€
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>TVA ({formData.taux_tva}%):</span>
                <span className="font-medium">
                  {(parseFloat(formData.prix) - parseFloat(formData.prix) / (1 + parseFloat(formData.taux_tva) / 100)).toFixed(2)}€
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Durée *
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <input
                  type="number"
                  min="0"
                  max="8"
                  value={formData.duree_heures}
                  onChange={(e) => setFormData({ ...formData, duree_heures: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Heures"
                />
                <p className="text-xs text-gray-500 mt-1">Heures</p>
              </div>
              <div>
                <input
                  type="number"
                  min="0"
                  max="59"
                  step="15"
                  value={formData.duree_minutes}
                  onChange={(e) => setFormData({ ...formData, duree_minutes: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Minutes"
                />
                <p className="text-xs text-gray-500 mt-1">Minutes</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="actif"
              checked={formData.actif}
              onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
              className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <label htmlFor="actif" className="text-sm font-medium text-gray-700">
              Service actif (visible pour les clients)
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-pink-600 transition disabled:opacity-50"
            >
              {loading ? 'Enregistrement...' : (service ? 'Modifier' : 'Créer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
