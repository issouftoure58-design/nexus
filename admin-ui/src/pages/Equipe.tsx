/**
 * Equipe - Gestion basique des membres (tous plans)
 * CRUD: nom, prenom, role, email, telephone, adresse
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Edit, Trash2, UserPlus, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useProfile } from '@/contexts/ProfileContext';

interface Membre {
  id: number;
  nom: string;
  prenom: string;
  email: string | null;
  telephone: string | null;
  role: string;
  statut: string;
  adresse_rue: string | null;
  adresse_cp: string | null;
  adresse_ville: string | null;
}

const ROLES = [
  { value: 'manager', label: 'Manager' },
  { value: 'employe', label: 'Employe' },
  { value: 'coiffeur', label: 'Coiffeur' },
  { value: 'barbier', label: 'Barbier' },
  { value: 'estheticienne', label: 'Estheticienne' },
  { value: 'serveur', label: 'Serveur' },
  { value: 'cuisinier', label: 'Cuisinier' },
  { value: 'receptionniste', label: 'Receptionniste' },
  { value: 'technicien', label: 'Technicien' },
  { value: 'autre', label: 'Autre' },
];

const emptyForm = { nom: '', prenom: '', email: '', telephone: '', role: 'employe', adresse_rue: '', adresse_cp: '', adresse_ville: '' };

export default function Equipe() {
  const { t } = useProfile();
  const [membres, setMembres] = useState<Membre[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editMembre, setEditMembre] = useState<Membre | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const fetchMembres = useCallback(async () => {
    try {
      const raw = await api.get<any>('/admin/services/equipe');
      const list = Array.isArray(raw) ? raw : (raw as any).data || [];
      setMembres(list);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembres(); }, [fetchMembres]);

  const filtered = useMemo(() => {
    if (!search.trim()) return membres;
    const q = search.toLowerCase().trim();
    return membres.filter(m => {
      const full = [m.prenom, m.nom, m.role, m.email, m.telephone, m.adresse_ville]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return full.includes(q);
    });
  }, [membres, search]);

  const openNew = () => {
    setEditMembre(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (m: Membre) => {
    setEditMembre(m);
    setForm({
      nom: m.nom,
      prenom: m.prenom,
      email: m.email || '',
      telephone: m.telephone || '',
      role: m.role,
      adresse_rue: m.adresse_rue || '',
      adresse_cp: m.adresse_cp || '',
      adresse_ville: m.adresse_ville || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nom || !form.prenom) return;
    setSaving(true);
    try {
      if (editMembre) {
        await api.put(`/admin/services/equipe/${editMembre.id}`, form);
      } else {
        await api.post('/admin/services/equipe', form);
      }
      setShowForm(false);
      fetchMembres();
    } catch {
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Supprimer ce membre ?')) return;
    try {
      await api.delete(`/admin/services/equipe/${id}`);
      fetchMembres();
    } catch {
      alert('Erreur lors de la suppression');
    }
  };

  const formatAdresse = (m: Membre) => {
    const parts = [m.adresse_rue, m.adresse_cp, m.adresse_ville].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Equipe</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Gerez les membres de votre equipe pour les assigner aux {t('reservation', true).toLowerCase()}
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Ajouter
        </Button>
      </div>

      {/* Barre de recherche */}
      {membres.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, role, email, telephone, ville..."
            className="pl-10"
          />
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement...</div>
      ) : membres.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <UserPlus className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">Aucun membre dans votre equipe</p>
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" /> Ajouter un membre
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Aucun resultat pour "{search}"
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex-shrink-0 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold text-sm">
                  {m.prenom[0]}{m.nom[0]}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {m.prenom} {m.nom}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {m.role}
                    {m.telephone ? ` - ${m.telephone}` : ''}
                    {m.email ? ` - ${m.email}` : ''}
                  </p>
                  {formatAdresse(m) && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                      {formatAdresse(m)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  m.statut === 'actif'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {m.statut}
                </span>
                <button onClick={() => openEdit(m)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg" aria-label="Modifier">
                  <Edit className="w-4 h-4 text-gray-500" />
                </button>
                <button onClick={() => handleDelete(m.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" aria-label="Supprimer">
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-900 z-10">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editMembre ? 'Modifier le membre' : 'Nouveau membre'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded" aria-label="Fermer">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prenom *</label>
                  <Input value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })} placeholder="Prenom" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nom *</label>
                  <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Nom" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-2.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telephone</label>
                <Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} placeholder="06 12 34 56 78" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemple.com" type="email" />
              </div>

              <div className="border-t border-gray-200 dark:border-gray-800 pt-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Adresse</p>
                <div className="space-y-3">
                  <div>
                    <Input value={form.adresse_rue} onChange={(e) => setForm({ ...form, adresse_rue: e.target.value })} placeholder="Rue" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Input value={form.adresse_cp} onChange={(e) => setForm({ ...form, adresse_cp: e.target.value })} placeholder="CP" />
                    </div>
                    <div className="col-span-2">
                      <Input value={form.adresse_ville} onChange={(e) => setForm({ ...form, adresse_ville: e.target.value })} placeholder="Ville" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1">Annuler</Button>
                <Button onClick={handleSave} disabled={saving || !form.nom || !form.prenom} className="flex-1">
                  {saving ? 'Enregistrement...' : editMembre ? 'Modifier' : 'Ajouter'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
