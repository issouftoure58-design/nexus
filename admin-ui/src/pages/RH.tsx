/**
 * RH Page - Business Plan
 * Gestion equipe simplifiee
 */

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users,
  UserPlus,
  Calendar,
  TrendingUp,
  RefreshCw,
  Check,
  X,
  Edit2,
  Trash2,
  Briefcase,
  Clock,
  Award
} from 'lucide-react';

interface Membre {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  role: string;
  statut: string;
  date_embauche: string;
  notes: string;
}

interface Absence {
  id: number;
  membre_id: number;
  type: string;
  date_debut: string;
  date_fin: string;
  statut: string;
  motif: string;
  membre: { nom: string; prenom: string };
}

interface DashboardRH {
  equipe: {
    total: number;
    actifs: number;
    en_conge: number;
    roles: Record<string, number>;
  };
  absences: { en_attente: number };
  performances_mois: {
    periode: string;
    ca_total: number;
    rdv_total: number;
    objectifs_atteints: number;
    membres_evalues: number;
  };
}

type TabType = 'equipe' | 'absences' | 'performances';

export default function RH() {
  const [tab, setTab] = useState<TabType>('equipe');
  const [dashboard, setDashboard] = useState<DashboardRH | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editMembre, setEditMembre] = useState<Membre | null>(null);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    role: 'commercial',
    date_embauche: '',
    notes: ''
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` };

      const [dashRes, membresRes, absencesRes] = await Promise.all([
        fetch('/api/admin/rh/dashboard', { headers }),
        fetch('/api/admin/rh/membres', { headers }),
        fetch('/api/admin/rh/absences', { headers })
      ]);

      if (dashRes.ok) setDashboard(await dashRes.json());
      if (membresRes.ok) setMembres(await membresRes.json());
      if (absencesRes.ok) setAbsences(await absencesRes.json());
    } catch (err) {
      console.error('Erreur fetch RH:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitMembre = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
        'Content-Type': 'application/json'
      };

      const url = editMembre
        ? `/api/admin/rh/membres/${editMembre.id}`
        : '/api/admin/rh/membres';

      const method = editMembre ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowForm(false);
        setEditMembre(null);
        setFormData({ nom: '', prenom: '', email: '', telephone: '', role: 'commercial', date_embauche: '', notes: '' });
        fetchAll();
      }
    } catch (err) {
      console.error('Erreur save membre:', err);
    }
  };

  const handleDeleteMembre = async (id: number) => {
    if (!confirm('Desactiver ce membre ?')) return;
    try {
      await fetch(`/api/admin/rh/membres/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      fetchAll();
    } catch (err) {
      console.error('Erreur delete membre:', err);
    }
  };

  const handleAbsenceAction = async (id: number, action: 'approve' | 'refuse') => {
    try {
      await fetch(`/api/admin/rh/absences/${id}/${action}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` }
      });
      fetchAll();
    } catch (err) {
      console.error('Erreur action absence:', err);
    }
  };

  const openEditForm = (membre: Membre) => {
    setEditMembre(membre);
    setFormData({
      nom: membre.nom,
      prenom: membre.prenom,
      email: membre.email || '',
      telephone: membre.telephone || '',
      role: membre.role,
      date_embauche: membre.date_embauche || '',
      notes: membre.notes || ''
    });
    setShowForm(true);
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      manager: 'Manager',
      commercial: 'Commercial',
      technicien: 'Technicien',
      admin: 'Admin',
      autre: 'Autre'
    };
    return labels[role] || role;
  };

  const getStatutColor = (statut: string) => {
    switch (statut) {
      case 'actif': return 'bg-green-100 text-green-700';
      case 'conge': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getAbsenceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      conge: 'Conge',
      maladie: 'Maladie',
      formation: 'Formation',
      autre: 'Autre'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            Gestion RH
          </h1>
          <p className="text-gray-500 mt-1">Gerez votre equipe</p>
        </div>
        <Button variant="outline" onClick={fetchAll}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Actualiser
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Equipe</p>
              <p className="text-2xl font-bold">{dashboard?.equipe.total || 0}</p>
              <p className="text-xs text-gray-400">{dashboard?.equipe.actifs || 0} actifs</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">En conge</p>
              <p className="text-2xl font-bold">{dashboard?.equipe.en_conge || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Absences en attente</p>
              <p className="text-2xl font-bold text-orange-600">{dashboard?.absences.en_attente || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">CA Mois</p>
              <p className="text-2xl font-bold">{(dashboard?.performances_mois.ca_total || 0).toFixed(0)}EUR</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b">
        <button
          className={`px-4 py-2 -mb-px ${tab === 'equipe' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setTab('equipe')}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Equipe
        </button>
        <button
          className={`px-4 py-2 -mb-px ${tab === 'absences' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setTab('absences')}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          Absences
        </button>
        <button
          className={`px-4 py-2 -mb-px ${tab === 'performances' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setTab('performances')}
        >
          <Award className="w-4 h-4 inline mr-2" />
          Performances
        </button>
      </div>

      {/* Tab Equipe */}
      {tab === 'equipe' && (
        <div>
          <div className="flex justify-end mb-4">
            <Button onClick={() => { setShowForm(true); setEditMembre(null); }}>
              <UserPlus className="w-4 h-4 mr-2" />
              Ajouter membre
            </Button>
          </div>

          {showForm && (
            <Card className="p-4 mb-4">
              <h3 className="font-semibold mb-4">{editMembre ? 'Modifier' : 'Nouveau'} membre</h3>
              <form onSubmit={handleSubmitMembre} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  placeholder="Nom"
                  value={formData.nom}
                  onChange={e => setFormData({ ...formData, nom: e.target.value })}
                  required
                />
                <Input
                  placeholder="Prenom"
                  value={formData.prenom}
                  onChange={e => setFormData({ ...formData, prenom: e.target.value })}
                  required
                />
                <Input
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                />
                <Input
                  placeholder="Telephone"
                  value={formData.telephone}
                  onChange={e => setFormData({ ...formData, telephone: e.target.value })}
                />
                <select
                  className="border rounded-md px-3 py-2"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="manager">Manager</option>
                  <option value="commercial">Commercial</option>
                  <option value="technicien">Technicien</option>
                  <option value="admin">Admin</option>
                  <option value="autre">Autre</option>
                </select>
                <Input
                  type="date"
                  placeholder="Date embauche"
                  value={formData.date_embauche}
                  onChange={e => setFormData({ ...formData, date_embauche: e.target.value })}
                />
                <div className="md:col-span-2">
                  <Input
                    placeholder="Notes"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <Button type="submit">
                    <Check className="w-4 h-4 mr-2" />
                    {editMembre ? 'Modifier' : 'Ajouter'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditMembre(null); }}>
                    <X className="w-4 h-4 mr-2" />
                    Annuler
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <div className="grid gap-4">
            {membres.filter(m => m.statut !== 'inactif').map(membre => (
              <Card key={membre.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-lg font-semibold text-blue-600">
                        {membre.prenom[0]}{membre.nom[0]}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold">{membre.prenom} {membre.nom}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Briefcase className="w-3 h-3" />
                        {getRoleLabel(membre.role)}
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs ${getStatutColor(membre.statut)}`}>
                          {membre.statut}
                        </span>
                      </div>
                      {membre.email && <p className="text-sm text-gray-400">{membre.email}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEditForm(membre)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDeleteMembre(membre.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {membres.filter(m => m.statut !== 'inactif').length === 0 && (
              <Card className="p-8 text-center text-gray-500">
                Aucun membre dans l'equipe
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Tab Absences */}
      {tab === 'absences' && (
        <div className="space-y-4">
          {absences.length === 0 ? (
            <Card className="p-8 text-center text-gray-500">
              Aucune demande d'absence
            </Card>
          ) : (
            absences.map(absence => (
              <Card key={absence.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {absence.membre?.prenom} {absence.membre?.nom}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {getAbsenceTypeLabel(absence.type)} - Du {new Date(absence.date_debut).toLocaleDateString('fr-FR')} au {new Date(absence.date_fin).toLocaleDateString('fr-FR')}
                    </p>
                    {absence.motif && <p className="text-sm text-gray-400 mt-1">{absence.motif}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {absence.statut === 'en_attente' ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleAbsenceAction(absence.id, 'approve')}>
                          <Check className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleAbsenceAction(absence.id, 'refuse')}>
                          <X className="w-4 h-4 text-red-600" />
                        </Button>
                      </>
                    ) : (
                      <span className={`px-2 py-1 rounded text-xs ${
                        absence.statut === 'approuve' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {absence.statut === 'approuve' ? 'Approuve' : 'Refuse'}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Tab Performances */}
      {tab === 'performances' && (
        <div>
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Performances du mois ({dashboard?.performances_mois.periode})</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{(dashboard?.performances_mois.ca_total || 0).toFixed(0)}EUR</p>
                <p className="text-sm text-gray-500">CA Total</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{dashboard?.performances_mois.rdv_total || 0}</p>
                <p className="text-sm text-gray-500">RDV Realises</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">{dashboard?.performances_mois.objectifs_atteints || 0}</p>
                <p className="text-sm text-gray-500">Objectifs Atteints</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-600">{dashboard?.performances_mois.membres_evalues || 0}</p>
                <p className="text-sm text-gray-500">Membres Evalues</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-4 text-center">
              Les performances detaillees par membre sont disponibles dans une version ulterieure
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
