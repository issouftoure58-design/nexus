import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Check,
  X,
  AlertCircle
} from 'lucide-react';

interface Horaire {
  jour: number;
  nom: string;
  heure_debut: string | null;
  heure_fin: string | null;
  is_active: boolean;
  id: string;
}

interface Conge {
  id: string;
  date_debut: string;
  date_fin: string;
  motif: string | null;
  type: string;
}

interface Bloc {
  id: string;
  date: string;
  heure_debut: string;
  heure_fin: string;
  motif: string | null;
  recurrent: boolean;
}

type TabType = 'horaires' | 'conges' | 'blocs';

export default function AdminDisponibilites() {
  const [activeTab, setActiveTab] = useState<TabType>('horaires');
  const [horaires, setHoraires] = useState<Horaire[]>([]);
  const [conges, setConges] = useState<Conge[]>([]);
  const [blocs, setBlocs] = useState<Bloc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Formulaires
  const [newConge, setNewConge] = useState({ date_debut: '', date_fin: '', motif: '' });
  const [newBloc, setNewBloc] = useState({ date: '', heure_debut: '', heure_fin: '', motif: '' });

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');

      if (activeTab === 'horaires') {
        const response = await fetch('/api/admin/disponibilites/horaires', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        setHoraires(data.horaires);
      } else if (activeTab === 'conges') {
        const response = await fetch('/api/admin/disponibilites/conges', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        setConges(data.conges);
      } else if (activeTab === 'blocs') {
        const response = await fetch('/api/admin/disponibilites/blocs', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        setBlocs(data.blocs);
      }
    } catch (error) {
      console.error('Erreur chargement données:', error);
      showMessage('error', 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: string, text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // ════════════════════════════════════════════════════════════════════
  // HORAIRES HEBDOMADAIRES
  // ════════════════════════════════════════════════════════════════════

  const handleHoraireChange = (jour: number, field: string, value: any) => {
    setHoraires(horaires.map(h =>
      h.jour === jour ? { ...h, [field]: value } : h
    ));
  };

  const saveHoraires = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/disponibilites/horaires', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ horaires })
      });

      if (!response.ok) throw new Error('Erreur sauvegarde');

      showMessage('success', 'Horaires enregistrés avec succès');
    } catch (error) {
      showMessage('error', 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════
  // CONGÉS
  // ════════════════════════════════════════════════════════════════════

  const addConge = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newConge.date_debut || !newConge.date_fin) {
      showMessage('error', 'Veuillez remplir les dates');
      return;
    }

    if (new Date(newConge.date_fin) < new Date(newConge.date_debut)) {
      showMessage('error', 'La date de fin doit être après la date de début');
      return;
    }

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/disponibilites/conges', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newConge)
      });

      if (!response.ok) throw new Error('Erreur création');

      showMessage('success', 'Congé ajouté avec succès');
      setNewConge({ date_debut: '', date_fin: '', motif: '' });
      fetchData();
    } catch (error) {
      showMessage('error', 'Erreur lors de l\'ajout du congé');
    }
  };

  const deleteConge = async (id: string) => {
    if (!confirm('Supprimer ce congé ?')) return;

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/disponibilites/conges/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Erreur suppression');

      showMessage('success', 'Congé supprimé');
      fetchData();
    } catch (error) {
      showMessage('error', 'Erreur lors de la suppression');
    }
  };

  // ════════════════════════════════════════════════════════════════════
  // BLOCS TEMPORAIRES
  // ════════════════════════════════════════════════════════════════════

  const addBloc = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newBloc.date || !newBloc.heure_debut || !newBloc.heure_fin) {
      showMessage('error', 'Veuillez remplir tous les champs');
      return;
    }

    if (newBloc.heure_fin <= newBloc.heure_debut) {
      showMessage('error', 'L\'heure de fin doit être après l\'heure de début');
      return;
    }

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/disponibilites/blocs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newBloc)
      });

      if (!response.ok) throw new Error('Erreur création');

      showMessage('success', 'Bloc ajouté avec succès');
      setNewBloc({ date: '', heure_debut: '', heure_fin: '', motif: '' });
      fetchData();
    } catch (error) {
      showMessage('error', 'Erreur lors de l\'ajout du bloc');
    }
  };

  const deleteBloc = async (id: string) => {
    if (!confirm('Supprimer ce bloc d\'indisponibilité ?')) return;

    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/disponibilites/blocs/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Erreur suppression');

      showMessage('success', 'Bloc supprimé');
      fetchData();
    } catch (error) {
      showMessage('error', 'Erreur lors de la suppression');
    }
  };

  // Helper: vérifier si un congé est en cours
  const isCongeActive = (conge: Conge) => {
    const today = new Date().toISOString().split('T')[0];
    return today >= conge.date_debut && today <= conge.date_fin;
  };

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
      <div className="p-3 md:p-6">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Disponibilités</h1>
          <p className="text-gray-600 mt-1 text-sm md:text-base">
            Gérez vos horaires, congés et indisponibilités
          </p>
        </div>

        {/* Message */}
        {message.text && (
          <div className={`
            mb-6 p-4 rounded-lg flex items-center gap-3
            ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}
          `}>
            {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 md:gap-2 mb-8 border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('horaires')}
            className={`
              px-3 md:px-6 py-2 md:py-3 font-medium transition border-b-2 text-sm md:text-base whitespace-nowrap
              ${activeTab === 'horaires'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }
            `}
          >
            <div className="flex items-center gap-1 md:gap-2">
              <Clock size={16} className="md:w-[18px] md:h-[18px]" />
              <span className="hidden sm:inline">Horaires hebdomadaires</span>
              <span className="sm:hidden">Horaires</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('conges')}
            className={`
              px-3 md:px-6 py-2 md:py-3 font-medium transition border-b-2 text-sm md:text-base whitespace-nowrap
              ${activeTab === 'conges'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }
            `}
          >
            <div className="flex items-center gap-1 md:gap-2">
              <Calendar size={16} className="md:w-[18px] md:h-[18px]" />
              Congés
            </div>
          </button>
          <button
            onClick={() => setActiveTab('blocs')}
            className={`
              px-3 md:px-6 py-2 md:py-3 font-medium transition border-b-2 text-sm md:text-base whitespace-nowrap
              ${activeTab === 'blocs'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }
            `}
          >
            <div className="flex items-center gap-1 md:gap-2">
              <X size={16} className="md:w-[18px] md:h-[18px]" />
              Blocs
            </div>
          </button>
        </div>

        {/* Content */}
        {activeTab === 'horaires' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-6">
              Horaires de la semaine
            </h2>

            <div className="space-y-3 mb-6">
              {horaires.map((horaire) => (
                <div
                  key={horaire.jour}
                  className={`
                    p-3 md:p-4 rounded-lg border-2 transition
                    ${horaire.is_active ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-gray-50'}
                  `}
                >
                  {/* Toggle + Jour */}
                  <div className="flex items-center gap-3 mb-2 md:mb-0">
                    <input
                      type="checkbox"
                      checked={horaire.is_active}
                      onChange={(e) => handleHoraireChange(horaire.jour, 'is_active', e.target.checked)}
                      className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500 flex-shrink-0"
                    />
                    <span className={`font-medium ${horaire.is_active ? 'text-gray-800' : 'text-gray-400'}`}>
                      {horaire.nom}
                    </span>
                    {!horaire.is_active && (
                      <span className="text-gray-400 italic text-sm ml-auto">Fermé</span>
                    )}
                  </div>

                  {/* Horaires - en dessous sur mobile */}
                  {horaire.is_active && (
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2 ml-8">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">De</label>
                        <input
                          type="time"
                          value={horaire.heure_debut || ''}
                          onChange={(e) => handleHoraireChange(horaire.jour, 'heure_debut', e.target.value)}
                          className="px-2 md:px-3 py-1.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm md:text-base"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">à</label>
                        <input
                          type="time"
                          value={horaire.heure_fin || ''}
                          onChange={(e) => handleHoraireChange(horaire.jour, 'heure_fin', e.target.value)}
                          className="px-2 md:px-3 py-1.5 md:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm md:text-base"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={saveHoraires}
              disabled={saving}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white py-3 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-600 transition disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les horaires'}
            </button>
          </div>
        )}

        {activeTab === 'conges' && (
          <div>
            {/* Formulaire */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">
                Ajouter un congé
              </h2>

              <form onSubmit={addConge} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de début
                    </label>
                    <input
                      type="date"
                      value={newConge.date_debut}
                      onChange={(e) => setNewConge({ ...newConge, date_debut: e.target.value })}
                      className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de fin
                    </label>
                    <input
                      type="date"
                      value={newConge.date_fin}
                      onChange={(e) => setNewConge({ ...newConge, date_fin: e.target.value })}
                      className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motif (optionnel)
                  </label>
                  <input
                    type="text"
                    value={newConge.motif}
                    onChange={(e) => setNewConge({ ...newConge, motif: e.target.value })}
                    placeholder="Ex: Vacances, Formation..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <button
                  type="submit"
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-600 transition"
                >
                  <Plus size={20} />
                  Ajouter le congé
                </button>
              </form>
            </div>

            {/* Liste */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">
                Congés planifiés ({conges.length})
              </h2>

              {conges.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  Aucun congé planifié
                </div>
              ) : (
                <div className="space-y-3">
                  {conges.map((conge) => (
                    <div
                      key={conge.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-purple-200 transition"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <Calendar size={18} className="text-purple-600" />
                          <span className="font-medium text-gray-800">
                            Du {new Date(conge.date_debut).toLocaleDateString('fr-FR')} au {new Date(conge.date_fin).toLocaleDateString('fr-FR')}
                          </span>
                          {isCongeActive(conge) && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              En cours
                            </span>
                          )}
                        </div>
                        {conge.motif && (
                          <p className="text-sm text-gray-600 mt-1 ml-9">
                            {conge.motif}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => deleteConge(conge.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'blocs' && (
          <div>
            {/* Formulaire */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">
                Ajouter un bloc d'indisponibilité
              </h2>

              <form onSubmit={addBloc} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newBloc.date}
                    onChange={(e) => setNewBloc({ ...newBloc, date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Heure de début
                    </label>
                    <input
                      type="time"
                      value={newBloc.heure_debut}
                      onChange={(e) => setNewBloc({ ...newBloc, heure_debut: e.target.value })}
                      className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Heure de fin
                    </label>
                    <input
                      type="time"
                      value={newBloc.heure_fin}
                      onChange={(e) => setNewBloc({ ...newBloc, heure_fin: e.target.value })}
                      className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motif (optionnel)
                  </label>
                  <input
                    type="text"
                    value={newBloc.motif}
                    onChange={(e) => setNewBloc({ ...newBloc, motif: e.target.value })}
                    placeholder="Ex: RDV médecin, Formation..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <button
                  type="submit"
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-600 transition"
                >
                  <Plus size={20} />
                  Ajouter le bloc
                </button>
              </form>
            </div>

            {/* Liste */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-6">
                Blocs d'indisponibilité ({blocs.length})
              </h2>

              {blocs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  Aucun bloc d'indisponibilité
                </div>
              ) : (
                <div className="space-y-3">
                  {blocs.map((bloc) => (
                    <div
                      key={bloc.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-purple-200 transition"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <Clock size={18} className="text-purple-600" />
                          <span className="font-medium text-gray-800">
                            {new Date(bloc.date).toLocaleDateString('fr-FR')} - {bloc.heure_debut} à {bloc.heure_fin}
                          </span>
                        </div>
                        {bloc.motif && (
                          <p className="text-sm text-gray-600 mt-1 ml-9">
                            {bloc.motif}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={() => deleteBloc(bloc.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
