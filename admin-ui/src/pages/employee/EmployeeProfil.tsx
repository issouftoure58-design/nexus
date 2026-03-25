import { useState, useEffect, useCallback } from 'react';
import { User, Phone, Briefcase, Lock, Save, Check } from 'lucide-react';
import { employeePortalApi, employeeAuthApi, type EmployeeProfil as ProfilType } from '../../lib/employeeApi';

export default function EmployeeProfil() {
  const [profil, setProfil] = useState<ProfilType | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editData, setEditData] = useState({
    telephone: '',
    adresse_rue: '',
    adresse_cp: '',
    adresse_ville: '',
    adresse_pays: '',
  });

  // Change password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwData, setPwData] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);

  const fetchProfil = useCallback(async () => {
    try {
      const data = await employeePortalApi.getProfil();
      setProfil(data);
      setEditData({
        telephone: data.telephone || '',
        adresse_rue: data.adresse_rue || '',
        adresse_cp: data.adresse_cp || '',
        adresse_ville: data.adresse_ville || '',
        adresse_pays: data.adresse_pays || '',
      });
    } catch (err) {
      console.error('Erreur profil:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfil();
  }, [fetchProfil]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await employeePortalApi.updateProfil(editData);
      setSaveSuccess(true);
      setEditing(false);
      fetchProfil();
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('Erreur save:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');

    if (pwData.newPassword.length < 8) {
      setPwError('Le mot de passe doit contenir au moins 8 caracteres');
      return;
    }
    if (pwData.newPassword !== pwData.confirm) {
      setPwError('Les mots de passe ne correspondent pas');
      return;
    }

    setPwLoading(true);
    try {
      await employeeAuthApi.changePassword(pwData.currentPassword, pwData.newPassword);
      setPwSuccess(true);
      setPwData({ currentPassword: '', newPassword: '', confirm: '' });
      setShowPasswordForm(false);
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err: any) {
      setPwError(err.message || 'Erreur modification');
    } finally {
      setPwLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profil) {
    return <p className="text-center py-12 text-gray-400">Profil non disponible</p>;
  }

  const formatDate = (d: string | null) => {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };

  const contratLabels: Record<string, string> = {
    CDI: 'CDI',
    CDD: 'CDD',
    interim: 'Interim',
    stage: 'Stage',
    alternance: 'Alternance',
    freelance: 'Freelance',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Mon Profil</h1>
        {saveSuccess && (
          <span className="flex items-center gap-1 text-sm text-emerald-600">
            <Check className="w-4 h-4" /> Sauvegarde
          </span>
        )}
      </div>

      {/* Info personnelles */}
      <Section title="Informations personnelles" icon={User}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nom" value={profil.nom} />
          <Field label="Prenom" value={profil.prenom} />
          <Field label="Email" value={profil.email} />
          <Field label="Date de naissance" value={formatDate(profil.date_naissance)} />
        </div>
      </Section>

      {/* Coordonnees (editables) */}
      <Section
        title="Coordonnees"
        icon={Phone}
        action={
          editing ? (
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="text-sm text-gray-500 hover:text-gray-700">
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg transition disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              Modifier
            </button>
          )
        }
      >
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Telephone</label>
              <input
                type="tel"
                value={editData.telephone}
                onChange={(e) => setEditData({ ...editData, telephone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Adresse</label>
              <input
                type="text"
                value={editData.adresse_rue}
                onChange={(e) => setEditData({ ...editData, adresse_rue: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                placeholder="Rue"
              />
            </div>
            <div>
              <input
                type="text"
                value={editData.adresse_cp}
                onChange={(e) => setEditData({ ...editData, adresse_cp: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                placeholder="Code postal"
              />
            </div>
            <div>
              <input
                type="text"
                value={editData.adresse_ville}
                onChange={(e) => setEditData({ ...editData, adresse_ville: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
                placeholder="Ville"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Telephone" value={profil.telephone || '—'} />
            <Field
              label="Adresse"
              value={
                [profil.adresse_rue, profil.adresse_cp, profil.adresse_ville]
                  .filter(Boolean)
                  .join(', ') || '—'
              }
            />
          </div>
        )}
      </Section>

      {/* Emploi */}
      <Section title="Emploi" icon={Briefcase}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Poste" value={profil.poste || profil.role || '—'} />
          <Field label="Contrat" value={contratLabels[profil.type_contrat] || profil.type_contrat || '—'} />
          <Field label="Date d'embauche" value={formatDate(profil.date_embauche)} />
          <Field label="Heures/semaine" value={profil.heures_hebdo ? `${profil.heures_hebdo}h` : '—'} />
          {profil.date_fin_contrat && <Field label="Fin de contrat" value={formatDate(profil.date_fin_contrat)} />}
        </div>
      </Section>

      {/* Contact urgence */}
      {profil.contact_urgence_nom && (
        <Section title="Contact d'urgence" icon={Phone}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Nom" value={profil.contact_urgence_nom} />
            <Field label="Telephone" value={profil.contact_urgence_tel || '—'} />
            <Field label="Lien" value={profil.contact_urgence_lien || '—'} />
          </div>
        </Section>
      )}

      {/* Change password */}
      <Section title="Securite" icon={Lock}>
        {pwSuccess && (
          <div className="bg-emerald-50 text-emerald-700 text-sm p-3 rounded-lg border border-emerald-200 mb-4">
            Mot de passe modifie avec succes
          </div>
        )}

        {showPasswordForm ? (
          <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
            {pwError && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">{pwError}</div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Mot de passe actuel</label>
              <input
                type="password"
                required
                value={pwData.currentPassword}
                onChange={(e) => setPwData({ ...pwData, currentPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Nouveau mot de passe</label>
              <input
                type="password"
                required
                value={pwData.newPassword}
                onChange={(e) => setPwData({ ...pwData, newPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Confirmer</label>
              <input
                type="password"
                required
                value={pwData.confirm}
                onChange={(e) => setPwData({ ...pwData, confirm: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowPasswordForm(false); setPwError(''); }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={pwLoading}
                className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition disabled:opacity-50"
              >
                {pwLoading ? 'Modification...' : 'Modifier'}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowPasswordForm(true)}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Changer mon mot de passe
          </button>
        )}
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, children, action }: {
  title: string;
  icon: typeof User;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-500" />
          <h2 className="font-medium text-gray-900 text-sm">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-sm text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
