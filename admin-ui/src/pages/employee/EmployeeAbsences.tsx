import { useState, useEffect, useCallback } from 'react';
import { Plus, Umbrella, Coffee, Stethoscope, GraduationCap, Clock, X } from 'lucide-react';
import { employeePortalApi, type AbsencesResponse, type Absence } from '../../lib/employeeApi';

const TYPES_ABSENCE = [
  { value: 'conge', label: 'Conges payes', icon: Umbrella, color: 'bg-blue-500' },
  { value: 'rtt', label: 'RTT', icon: Coffee, color: 'bg-purple-500' },
  { value: 'maladie', label: 'Maladie', icon: Stethoscope, color: 'bg-red-500' },
  { value: 'formation', label: 'Formation', icon: GraduationCap, color: 'bg-green-500' },
  { value: 'repos_compensateur', label: 'Repos compensateur', icon: Clock, color: 'bg-orange-500' },
  { value: 'sans_solde', label: 'Sans solde', icon: Clock, color: 'bg-gray-500' },
];

const STATUT_BADGES: Record<string, { label: string; class: string }> = {
  en_attente: { label: 'En attente', class: 'bg-amber-100 text-amber-700' },
  approuve: { label: 'Approuve', class: 'bg-emerald-100 text-emerald-700' },
  refuse: { label: 'Refuse', class: 'bg-red-100 text-red-700' },
  annule: { label: 'Annule', class: 'bg-gray-100 text-gray-500' },
};

export default function EmployeeAbsences() {
  const [data, setData] = useState<AbsencesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    type: 'conge',
    date_debut: '',
    date_fin: '',
    motif: '',
    demi_journee: false,
    periode: 'matin',
  });

  const fetchAbsences = useCallback(async () => {
    try {
      const result = await employeePortalApi.getAbsences();
      setData(result);
    } catch (err) {
      console.error('Erreur absences:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAbsences();
  }, [fetchAbsences]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await employeePortalApi.createAbsence({
        type: formData.type,
        date_debut: formData.date_debut,
        date_fin: formData.date_fin || undefined,
        motif: formData.motif || undefined,
        demi_journee: formData.demi_journee,
        periode: formData.demi_journee ? formData.periode : undefined,
      });
      setShowForm(false);
      setFormData({ type: 'conge', date_debut: '', date_fin: '', motif: '', demi_journee: false, periode: 'matin' });
      fetchAbsences();
    } catch (err: any) {
      setError(err.message || 'Erreur creation');
    } finally {
      setSubmitting(false);
    }
  };

  const compteurs = data?.compteurs;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Conges & Absences</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nouvelle demande</span>
          <span className="sm:hidden">Demande</span>
        </button>
      </div>

      {/* Compteurs */}
      {compteurs && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <CompteursCard label="Conges payes" solde={compteurs.cp.solde} acquis={compteurs.cp.acquis} pris={compteurs.cp.pris} color="blue" />
          <CompteursCard label="RTT" solde={compteurs.rtt.solde} acquis={compteurs.rtt.acquis} pris={compteurs.rtt.pris} color="purple" />
          <CompteursCard label="Repos comp." solde={compteurs.rc.solde} acquis={compteurs.rc.acquis} pris={compteurs.rc.pris} color="orange" />
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold text-gray-900">Nouvelle demande</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                >
                  {TYPES_ABSENCE.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date debut</label>
                  <input
                    type="date"
                    required
                    value={formData.date_debut}
                    onChange={(e) => setFormData({ ...formData, date_debut: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
                  <input
                    type="date"
                    value={formData.date_fin}
                    onChange={(e) => setFormData({ ...formData, date_fin: e.target.value })}
                    min={formData.date_debut}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.demi_journee}
                    onChange={(e) => setFormData({ ...formData, demi_journee: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700">Demi-journee</span>
                </label>
                {formData.demi_journee && (
                  <select
                    value={formData.periode}
                    onChange={(e) => setFormData({ ...formData, periode: e.target.value })}
                    className="text-sm px-2 py-1 border border-gray-300 rounded-lg"
                  >
                    <option value="matin">Matin</option>
                    <option value="apres-midi">Apres-midi</option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motif (optionnel)</label>
                <textarea
                  value={formData.motif}
                  onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                  placeholder="Raison de la demande..."
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-medium transition disabled:opacity-50"
              >
                {submitting ? 'Envoi...' : 'Envoyer la demande'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Liste absences */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data?.absences.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Umbrella className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Aucune absence enregistree</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data?.absences.map((absence) => (
            <AbsenceCard key={absence.id} absence={absence} />
          ))}
        </div>
      )}
    </div>
  );
}

function CompteursCard({ label, solde, acquis, pris, color }: {
  label: string; solde: number; acquis: number; pris: number; color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
  };

  return (
    <div className={`rounded-xl border p-3 ${colorMap[color]}`}>
      <p className="text-xs font-medium opacity-75">{label}</p>
      <p className="text-2xl font-bold mt-1">{solde}</p>
      <p className="text-xs opacity-60 mt-0.5">{acquis} acquis · {pris} pris</p>
    </div>
  );
}

function AbsenceCard({ absence }: { absence: Absence }) {
  const type = TYPES_ABSENCE.find((t) => t.value === absence.type) || TYPES_ABSENCE[0];
  const statut = STATUT_BADGES[absence.statut] || STATUT_BADGES.en_attente;
  const Icon = type.icon;

  const formatDate = (d: string) => {
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const isSameDay = absence.date_debut === absence.date_fin;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg ${type.color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-gray-900 text-sm">{type.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${statut.class}`}>{statut.label}</span>
        </div>
        <p className="text-xs text-gray-500">
          {isSameDay
            ? formatDate(absence.date_debut)
            : `${formatDate(absence.date_debut)} → ${formatDate(absence.date_fin)}`}
          {absence.demi_journee && ` (${absence.periode || 'demi-journee'})`}
        </p>
        {absence.motif && <p className="text-xs text-gray-400 mt-0.5 truncate">{absence.motif}</p>}
      </div>
    </div>
  );
}
