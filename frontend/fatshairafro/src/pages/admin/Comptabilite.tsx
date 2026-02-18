import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  PiggyBank,
  Wallet,
  CreditCard,
  Building2,
  Fuel,
  Phone,
  Shield,
  Car,
  Megaphone,
  GraduationCap,
  Laptop,
  FileText,
  HelpCircle,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Send,
  SendHorizonal,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { PieChart as RechartsPI, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';

// Types
interface Depense {
  id: string;
  libelle: string;
  description?: string;
  montant: number;
  montant_euros: string;
  montant_ttc: number;
  montant_ttc_euros: string;
  montant_tva: number;
  montant_tva_euros: string;
  taux_tva: number;
  deductible_tva: boolean;
  categorie: string;
  date_depense: string;
  recurrence: string;
  notes?: string;
  justificatif_url?: string;
}

interface Resume {
  mois: string;
  total_euros: string;
  par_categorie: {
    categorie: string;
    montant_euros: string;
    pourcentage: string;
  }[];
}

interface CompteResultat {
  mois: string;
  compte_resultat: {
    chiffre_affaires: { total_euros: string };
    charges: {
      total_euros: string;
      detail: { categorie: string; montant_euros: string }[];
    };
    resultat_net: { total_euros: string; marge_nette: string; positif: boolean };
  };
}

interface TVAData {
  mois: string;
  tva: {
    collectee: {
      base_ht_euros: string;
      tva_euros: string;
      nb_operations: number;
      detail_par_taux: { taux: number; base_ht_euros: string; tva_euros: string; nb_operations: number }[];
    };
    deductible: {
      base_ht_euros: string;
      tva_euros: string;
      nb_operations: number;
      detail_par_taux: { taux: number; base_ht_euros: string; tva_euros: string }[];
    };
    solde: {
      montant_euros: string;
      a_payer: boolean;
      credit: boolean;
    };
  };
}

interface Facture {
  id: string;
  numero: string;
  client_nom: string;
  client_email?: string;
  service_nom: string;
  date_prestation: string;
  date_facture: string;
  montant_ht: number;
  montant_ht_euros: string;
  montant_tva: number;
  montant_tva_euros: string;
  montant_ttc: number;
  montant_ttc_euros: string;
  taux_tva: number;
  statut: 'generee' | 'envoyee' | 'payee' | 'annulee';
  date_envoi?: string;
  date_paiement?: string;
  niveau_relance?: number;
  date_echeance?: string;
}

interface FacturesData {
  factures: Facture[];
  stats: {
    total: number;
    total_ttc_euros: string;
    total_tva_euros: string;
    nb_envoyees: number;
    nb_en_attente: number;
  };
}

const CATEGORIES = [
  { id: 'fournitures', label: 'Fournitures', icon: Receipt },
  { id: 'loyer', label: 'Loyer', icon: Building2 },
  { id: 'charges', label: 'Charges', icon: Fuel },
  { id: 'telecom', label: 'Télécom', icon: Phone },
  { id: 'assurance', label: 'Assurance', icon: Shield },
  { id: 'transport', label: 'Transport', icon: Car },
  { id: 'marketing', label: 'Marketing', icon: Megaphone },
  { id: 'bancaire', label: 'Frais bancaires', icon: CreditCard },
  { id: 'formation', label: 'Formation', icon: GraduationCap },
  { id: 'materiel', label: 'Matériel', icon: Laptop },
  { id: 'logiciel', label: 'Logiciel', icon: Laptop },
  { id: 'comptabilite', label: 'Comptabilité', icon: FileText },
  { id: 'taxes', label: 'Taxes', icon: Receipt },
  { id: 'autre', label: 'Autre', icon: HelpCircle },
];

const CATEGORY_COLORS: Record<string, string> = {
  fournitures: '#f59e0b',
  loyer: '#ef4444',
  charges: '#f97316',
  telecom: '#3b82f6',
  assurance: '#8b5cf6',
  transport: '#10b981',
  marketing: '#ec4899',
  bancaire: '#6366f1',
  formation: '#14b8a6',
  materiel: '#f43f5e',
  logiciel: '#06b6d4',
  comptabilite: '#84cc16',
  taxes: '#dc2626',
  autre: '#6b7280',
};

export default function Comptabilite() {
  const [activeTab, setActiveTab] = useState<'apercu' | 'depenses' | 'resultat' | 'tva' | 'facturation'>('apercu');
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [resume, setResume] = useState<Resume | null>(null);
  const [compteResultat, setCompteResultat] = useState<CompteResultat | null>(null);
  const [tvaData, setTvaData] = useState<TVAData | null>(null);
  const [facturesData, setFacturesData] = useState<FacturesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Depense | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingFacture, setSendingFacture] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [selectedMois, setSelectedMois] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    loadData();
  }, [selectedMois]);

  const loadData = async () => {
    setLoading(true);
    const token = localStorage.getItem('admin_token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [depensesRes, resumeRes, compteRes, tvaRes, facturesRes] = await Promise.all([
        fetch(`/api/depenses?mois=${selectedMois}`, { headers }).then(r => r.json()).catch(() => ({ depenses: [] })),
        fetch(`/api/depenses/resume?mois=${selectedMois}`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`/api/depenses/compte-resultat?mois=${selectedMois}`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`/api/depenses/tva?mois=${selectedMois}`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`/api/factures?mois=${selectedMois}`, { headers }).then(r => r.json()).catch(() => ({ factures: [], stats: {} })),
      ]);

      setDepenses(depensesRes.depenses || []);
      setResume(resumeRes);
      setCompteResultat(compteRes);
      setTvaData(tvaRes);
      setFacturesData(facturesRes.success ? facturesRes : null);
    } catch (error) {
      console.error('Erreur chargement comptabilité:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDepense = async (data: Partial<Depense> & { montant_ttc_input?: string; taux_tva_input?: string; deductible_tva_input?: string }) => {
    setSaving(true);
    const token = localStorage.getItem('admin_token');

    try {
      const url = selectedItem?.id ? `/api/depenses/${selectedItem.id}` : '/api/depenses';
      const method = selectedItem?.id ? 'PUT' : 'POST';

      // Convertir le montant TTC en centimes
      const montantTTC = Math.round(parseFloat(data.montant_ttc_input || '0') * 100);
      const tauxTVA = parseFloat(data.taux_tva_input || '20');
      const deductibleTVA = data.deductible_tva_input === 'true';

      // Calculer le montant HT
      const montantHT = tauxTVA > 0 ? Math.round(montantTTC / (1 + tauxTVA / 100)) : montantTTC;

      await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...data,
          montant: montantHT,
          montant_ttc: montantTTC,
          taux_tva: tauxTVA,
          deductible_tva: deductibleTVA,
        }),
      });

      setShowModal(false);
      setSelectedItem(null);
      loadData();
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette dépense ?')) return;
    const token = localStorage.getItem('admin_token');

    try {
      await fetch(`/api/depenses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      loadData();
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  };

  const openModal = (item?: Depense) => {
    setSelectedItem(item || null);
    setShowModal(true);
  };

  const getCategoryIcon = (cat: string) => {
    const found = CATEGORIES.find(c => c.id === cat);
    return found ? found.icon : HelpCircle;
  };

  const getCategoryLabel = (cat: string) => {
    const found = CATEGORIES.find(c => c.id === cat);
    return found ? found.label : cat;
  };

  // Données pour le graphique Pie
  const pieData = resume?.par_categorie.map(c => ({
    name: getCategoryLabel(c.categorie),
    value: parseFloat(c.montant_euros),
    color: CATEGORY_COLORS[c.categorie] || '#6b7280',
  })) || [];

  // KPI Cards
  const renderKPIs = () => {
    const ca = parseFloat(compteResultat?.compte_resultat.chiffre_affaires.total_euros || '0');
    const charges = parseFloat(compteResultat?.compte_resultat.charges.total_euros || '0');
    const resultat = parseFloat(compteResultat?.compte_resultat.resultat_net.total_euros || '0');
    const marge = parseFloat(compteResultat?.compte_resultat.resultat_net.marge_nette || '0');
    const positif = compteResultat?.compte_resultat.resultat_net.positif ?? true;

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <span className="text-xs text-white/60">Chiffre d'affaires</span>
          </div>
          <p className="text-2xl font-bold text-white">{ca.toFixed(2)}€</p>
        </div>

        <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 border border-red-500/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <span className="text-xs text-white/60">Total charges</span>
          </div>
          <p className="text-2xl font-bold text-white">{charges.toFixed(2)}€</p>
        </div>

        <div className={`bg-gradient-to-br ${positif ? 'from-blue-600/20 to-blue-800/20 border-blue-500/30' : 'from-orange-600/20 to-orange-800/20 border-orange-500/30'} border rounded-2xl p-4`}>
          <div className="flex items-center gap-2 mb-2">
            <Wallet className={`w-5 h-5 ${positif ? 'text-blue-400' : 'text-orange-400'}`} />
            <span className="text-xs text-white/60">Résultat net</span>
          </div>
          <p className={`text-2xl font-bold ${positif ? 'text-white' : 'text-orange-400'}`}>
            {positif ? '+' : ''}{resultat.toFixed(2)}€
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Percent className="w-5 h-5 text-purple-400" />
            <span className="text-xs text-white/60">Marge nette</span>
          </div>
          <p className={`text-2xl font-bold ${marge >= 0 ? 'text-white' : 'text-orange-400'}`}>
            {marge}%
          </p>
        </div>
      </div>
    );
  };

  // Tab: Aperçu
  const renderApercu = () => (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Répartition des charges */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-amber-400" />
            Répartition des charges
          </h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPI>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(2)}€`}
                  contentStyle={{ backgroundColor: '#27272a', border: '1px solid #3f3f46', borderRadius: '12px' }}
                />
                <Legend />
              </RechartsPI>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-white/40">
              Aucune dépense ce mois
            </div>
          )}
        </div>

        {/* Top catégories */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            Top catégories
          </h3>
          <div className="space-y-3">
            {resume?.par_categorie.slice(0, 6).map((cat) => {
              const Icon = getCategoryIcon(cat.categorie);
              return (
                <div key={cat.categorie} className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${CATEGORY_COLORS[cat.categorie]}20` }}
                  >
                    <Icon size={18} style={{ color: CATEGORY_COLORS[cat.categorie] }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white text-sm">{getCategoryLabel(cat.categorie)}</span>
                      <span className="text-white font-medium">{cat.montant_euros}€</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${cat.pourcentage}%`,
                          backgroundColor: CATEGORY_COLORS[cat.categorie],
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {(!resume?.par_categorie || resume.par_categorie.length === 0) && (
              <div className="text-center text-white/40 py-8">
                Aucune dépense ce mois
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dernières dépenses */}
      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            Dernières dépenses
          </h3>
          <button
            onClick={() => setActiveTab('depenses')}
            className="text-sm text-amber-400 hover:text-amber-300 transition"
          >
            Voir tout →
          </button>
        </div>
        <div className="space-y-2">
          {depenses.slice(0, 5).map((dep) => {
            const Icon = getCategoryIcon(dep.categorie);
            return (
              <div key={dep.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${CATEGORY_COLORS[dep.categorie]}20` }}
                >
                  <Icon size={18} style={{ color: CATEGORY_COLORS[dep.categorie] }} />
                </div>
                <div className="flex-1">
                  <p className="text-white text-sm">{dep.libelle || dep.description}</p>
                  <p className="text-white/40 text-xs">{getCategoryLabel(dep.categorie)}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-medium">{dep.montant_ttc_euros || dep.montant_euros}€</p>
                  <p className="text-amber-400/60 text-xs">TVA: {dep.montant_tva_euros || '0.00'}€</p>
                </div>
              </div>
            );
          })}
          {depenses.length === 0 && (
            <div className="text-center text-white/40 py-8">
              Aucune dépense ce mois
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Tab: Dépenses
  const renderDepenses = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Dépenses ({depenses.length})</h2>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/30 transition-all"
        >
          <Plus size={18} />
          Nouvelle dépense
        </button>
      </div>

      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="text-left p-4 text-white/60 font-medium">Description</th>
              <th className="text-left p-4 text-white/60 font-medium">Catégorie</th>
              <th className="text-left p-4 text-white/60 font-medium">Date</th>
              <th className="text-right p-4 text-white/60 font-medium">TTC</th>
              <th className="text-right p-4 text-white/60 font-medium">TVA</th>
              <th className="text-right p-4 text-white/60 font-medium">HT</th>
              <th className="text-right p-4 text-white/60 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {depenses.map((dep) => {
              const Icon = getCategoryIcon(dep.categorie);
              return (
                <tr key={dep.id} className="border-t border-white/5">
                  <td className="p-4">
                    <div>
                      <span className="text-white">{dep.libelle || dep.description}</span>
                      {dep.recurrence && dep.recurrence !== 'ponctuelle' && (
                        <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                          dep.recurrence === 'mensuelle' ? 'bg-blue-500/20 text-blue-400' :
                          dep.recurrence === 'trimestrielle' ? 'bg-purple-500/20 text-purple-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {dep.recurrence}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="flex items-center gap-2">
                      <Icon size={16} style={{ color: CATEGORY_COLORS[dep.categorie] }} />
                      <span className="text-white/80">{getCategoryLabel(dep.categorie)}</span>
                    </span>
                  </td>
                  <td className="p-4 text-white/60">
                    {new Date(dep.date_depense).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="p-4 text-right text-white font-medium">
                    {dep.montant_ttc_euros || dep.montant_euros}€
                  </td>
                  <td className="p-4 text-right">
                    <div>
                      <span className="text-amber-400">{dep.montant_tva_euros || '0.00'}€</span>
                      <span className="text-white/40 text-xs ml-1">({dep.taux_tva || 0}%)</span>
                    </div>
                    {!dep.deductible_tva && (
                      <span className="text-xs text-red-400/80">Non déductible</span>
                    )}
                  </td>
                  <td className="p-4 text-right text-white/80">{dep.montant_euros}€</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openModal(dep)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition text-white/60 hover:text-amber-400"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(dep.id)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition text-white/60 hover:text-red-400"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {depenses.length === 0 && (
          <div className="text-center text-white/40 py-12">
            Aucune dépense ce mois
          </div>
        )}
      </div>

      {/* Total */}
      {depenses.length > 0 && (
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-4 flex justify-between items-center">
          <span className="text-white/60">Total des dépenses</span>
          <span className="text-2xl font-bold text-white">{resume?.total_euros || '0'}€</span>
        </div>
      )}
    </div>
  );

  // Tab: Compte de résultat
  const renderResultat = () => {
    const cr = compteResultat?.compte_resultat;
    if (!cr) {
      return (
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-12 text-center">
          <DollarSign className="w-12 h-12 mx-auto mb-4 text-white/30" />
          <p className="text-white/60">Données insuffisantes pour le compte de résultat</p>
        </div>
      );
    }

    const ca = parseFloat(cr.chiffre_affaires.total_euros);
    const charges = parseFloat(cr.charges.total_euros);
    const resultat = parseFloat(cr.resultat_net.total_euros);
    const positif = cr.resultat_net.positif;

    return (
      <div className="space-y-6">
        {/* Résumé visuel */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">Compte de résultat - {compteResultat?.mois}</h3>

          <div className="space-y-4">
            {/* CA */}
            <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <div className="flex items-center gap-3">
                <ArrowUpRight className="w-6 h-6 text-green-400" />
                <span className="text-white font-medium">Chiffre d'affaires</span>
              </div>
              <span className="text-2xl font-bold text-green-400">+{ca.toFixed(2)}€</span>
            </div>

            {/* Charges */}
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <ArrowDownRight className="w-6 h-6 text-red-400" />
                  <span className="text-white font-medium">Charges</span>
                </div>
                <span className="text-2xl font-bold text-red-400">-{charges.toFixed(2)}€</span>
              </div>

              {/* Détail des charges */}
              <div className="space-y-2 ml-9">
                {cr.charges.detail.map((item) => {
                  const Icon = getCategoryIcon(item.categorie);
                  return (
                    <div key={item.categorie} className="flex justify-between text-sm">
                      <span className="flex items-center gap-2 text-white/60">
                        <Icon size={14} style={{ color: CATEGORY_COLORS[item.categorie] }} />
                        {getCategoryLabel(item.categorie)}
                      </span>
                      <span className="text-white/80">{item.montant_euros}€</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ligne de séparation */}
            <div className="border-t border-white/20 my-2" />

            {/* Résultat net */}
            <div className={`flex items-center justify-between p-4 rounded-xl ${
              positif
                ? 'bg-blue-500/10 border border-blue-500/20'
                : 'bg-orange-500/10 border border-orange-500/20'
            }`}>
              <div className="flex items-center gap-3">
                <Wallet className={`w-6 h-6 ${positif ? 'text-blue-400' : 'text-orange-400'}`} />
                <div>
                  <span className="text-white font-medium">Résultat net</span>
                  <p className="text-xs text-white/40">Marge: {cr.resultat_net.marge_nette}%</p>
                </div>
              </div>
              <span className={`text-3xl font-bold ${positif ? 'text-blue-400' : 'text-orange-400'}`}>
                {positif ? '+' : ''}{resultat.toFixed(2)}€
              </span>
            </div>
          </div>
        </div>

        {/* Message de contexte */}
        <div className={`p-4 rounded-xl ${
          positif ? 'bg-green-500/10 border border-green-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'
        }`}>
          <p className={`${positif ? 'text-green-400' : 'text-yellow-400'}`}>
            {positif
              ? `Excellent ! Votre activité est rentable ce mois avec une marge nette de ${cr.resultat_net.marge_nette}%.`
              : `Attention : vos charges dépassent vos revenus ce mois. Analysez vos dépenses pour identifier les postes à optimiser.`
            }
          </p>
        </div>
      </div>
    );
  };

  // Tab: TVA
  const renderTVA = () => {
    const tva = tvaData?.tva;

    if (!tva) {
      return (
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-12 text-center">
          <Percent className="w-12 h-12 mx-auto mb-4 text-white/30" />
          <p className="text-white/60">Données TVA indisponibles</p>
        </div>
      );
    }

    const tvaCollectee = parseFloat(tva.collectee.tva_euros);
    const tvaDeductible = parseFloat(tva.deductible.tva_euros);
    const solde = parseFloat(tva.solde.montant_euros);

    return (
      <div className="space-y-6">
        {/* En-tête */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-6">
            Déclaration TVA - {tvaData?.mois}
          </h3>

          <div className="space-y-4">
            {/* TVA Collectée */}
            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <ArrowUpRight className="w-6 h-6 text-green-400" />
                  <div>
                    <span className="text-white font-medium">TVA Collectée</span>
                    <p className="text-xs text-white/40">Sur ventes ({tva.collectee.nb_operations} opérations)</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-green-400">{tvaCollectee.toFixed(2)}€</span>
              </div>
              <div className="ml-9 text-sm text-white/60">
                Base HT: {tva.collectee.base_ht_euros}€
              </div>
              {/* Détail par taux */}
              {tva.collectee.detail_par_taux && tva.collectee.detail_par_taux.length > 0 && (
                <div className="ml-9 mt-2 space-y-1">
                  {tva.collectee.detail_par_taux.map((d) => (
                    <div key={d.taux} className="flex justify-between text-xs text-white/50">
                      <span>Taux {d.taux}% ({d.nb_operations} ventes)</span>
                      <span>{d.tva_euros}€ (sur {d.base_ht_euros}€ HT)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TVA Déductible */}
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <ArrowDownRight className="w-6 h-6 text-red-400" />
                  <div>
                    <span className="text-white font-medium">TVA Déductible</span>
                    <p className="text-xs text-white/40">Sur achats ({tva.deductible.nb_operations} opérations)</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-red-400">-{tvaDeductible.toFixed(2)}€</span>
              </div>
              <div className="ml-9 text-sm text-white/60">
                Base HT: {tva.deductible.base_ht_euros}€
              </div>
              {/* Détail par taux */}
              {tva.deductible.detail_par_taux.length > 0 && (
                <div className="ml-9 mt-2 space-y-1">
                  {tva.deductible.detail_par_taux.map((d) => (
                    <div key={d.taux} className="flex justify-between text-xs text-white/50">
                      <span>Taux {d.taux}%</span>
                      <span>{d.tva_euros}€ (sur {d.base_ht_euros}€ HT)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ligne de séparation */}
            <div className="border-t border-white/20 my-2" />

            {/* Solde TVA */}
            <div className={`p-4 rounded-xl ${
              tva.solde.a_payer
                ? 'bg-amber-500/10 border border-amber-500/20'
                : 'bg-blue-500/10 border border-blue-500/20'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Wallet className={`w-6 h-6 ${tva.solde.a_payer ? 'text-amber-400' : 'text-blue-400'}`} />
                  <div>
                    <span className="text-white font-medium">
                      {tva.solde.a_payer ? 'TVA à payer' : 'Crédit de TVA'}
                    </span>
                    <p className="text-xs text-white/40">
                      {tva.solde.a_payer ? 'À reverser à l\'État' : 'Reportable sur période suivante'}
                    </p>
                  </div>
                </div>
                <span className={`text-3xl font-bold ${tva.solde.a_payer ? 'text-amber-400' : 'text-blue-400'}`}>
                  {Math.abs(solde).toFixed(2)}€
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Message explicatif */}
        <div className={`p-4 rounded-xl ${
          tva.solde.a_payer
            ? 'bg-amber-500/10 border border-amber-500/30'
            : 'bg-blue-500/10 border border-blue-500/30'
        }`}>
          <p className={tva.solde.a_payer ? 'text-amber-300' : 'text-blue-300'}>
            {tva.solde.a_payer
              ? `Vous devez reverser ${Math.abs(solde).toFixed(2)}€ de TVA à l'État pour ce mois.`
              : solde === 0
                ? 'Votre TVA collectée et déductible s\'équilibrent ce mois.'
                : `Vous avez un crédit de TVA de ${Math.abs(solde).toFixed(2)}€ reportable.`
            }
          </p>
        </div>

        {/* Rappel */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-4">
          <p className="text-white/50 text-sm">
            <strong className="text-white/70">Rappel :</strong> La TVA collectée est calculée sur vos prestations de services
            (taux de 20%). La TVA déductible correspond à la TVA sur vos achats professionnels
            (uniquement sur les dépenses marquées "TVA déductible").
          </p>
        </div>
      </div>
    );
  };

  // Envoi facture individuelle
  const handleSendFacture = async (id: string) => {
    setSendingFacture(id);
    const token = localStorage.getItem('admin_token');

    try {
      const res = await fetch(`/api/factures/${id}/envoyer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        loadData();
      } else {
        alert(data.error || 'Erreur envoi');
      }
    } catch (error) {
      console.error('Erreur envoi facture:', error);
    } finally {
      setSendingFacture(null);
    }
  };

  // Envoi toutes les factures en attente
  const handleSendAllFactures = async () => {
    if (!confirm('Envoyer toutes les factures en attente par email ?')) return;
    setSendingAll(true);
    const token = localStorage.getItem('admin_token');

    try {
      const res = await fetch('/api/factures/envoyer-toutes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mois: selectedMois }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`${data.nb_envoyees} facture(s) envoyée(s)`);
        loadData();
      } else {
        alert(data.error || 'Erreur envoi');
      }
    } catch (error) {
      console.error('Erreur envoi factures:', error);
    } finally {
      setSendingAll(false);
    }
  };

  // Générer les factures manquantes
  const handleGenerateMissing = async () => {
    const token = localStorage.getItem('admin_token');

    try {
      const res = await fetch('/api/factures/generer-manquantes', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        alert(`${data.nb_creees} facture(s) générée(s)`);
        loadData();
      }
    } catch (error) {
      console.error('Erreur génération:', error);
    }
  };

  // Changer le statut d'une facture
  const handleChangeFactureStatus = async (id: string, statut: string) => {
    const token = localStorage.getItem('admin_token');

    try {
      await fetch(`/api/factures/${id}/statut`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ statut }),
      });
      loadData();
    } catch (error) {
      console.error('Erreur changement statut:', error);
    }
  };

  // Tab: Facturation
  const renderFacturation = () => {
    const factures = facturesData?.factures || [];
    const stats = facturesData?.stats;

    const getStatutBadge = (statut: string) => {
      switch (statut) {
        case 'generee':
          return (
            <span className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-500/20 text-amber-400 rounded-full">
              <Clock size={12} />
              En attente
            </span>
          );
        case 'envoyee':
          return (
            <span className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded-full">
              <Send size={12} />
              Envoyée
            </span>
          );
        case 'payee':
          return (
            <span className="flex items-center gap-1 px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full">
              <CheckCircle2 size={12} />
              Payée
            </span>
          );
        case 'annulee':
          return (
            <span className="flex items-center gap-1 px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-full">
              <XCircle size={12} />
              Annulée
            </span>
          );
        default:
          return null;
      }
    };

    const getRelanceBadge = (niveau: number | undefined) => {
      if (!niveau || niveau === 0) return null;
      const configs: { [key: number]: { label: string; color: string } } = {
        1: { label: '1', color: 'bg-blue-500/30 text-blue-300 border-blue-500/50' },
        2: { label: '2', color: 'bg-orange-500/30 text-orange-300 border-orange-500/50' },
        3: { label: '3', color: 'bg-red-500/30 text-red-300 border-red-500/50' },
        4: { label: '4', color: 'bg-purple-500/30 text-purple-300 border-purple-500/50' },
      };
      const config = configs[niveau];
      if (!config) return null;
      return (
        <span className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold rounded-full border ${config.color}`}>
          {config.label}
        </span>
      );
    };

    return (
      <div className="space-y-6">
        {/* Stats factures */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-4">
              <p className="text-white/60 text-sm">Total factures</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-4">
              <p className="text-white/60 text-sm">Montant TTC</p>
              <p className="text-2xl font-bold text-green-400">{stats.total_ttc_euros}€</p>
            </div>
            <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-4">
              <p className="text-white/60 text-sm">En attente d'envoi</p>
              <p className="text-2xl font-bold text-amber-400">{stats.nb_en_attente}</p>
            </div>
            <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-4">
              <p className="text-white/60 text-sm">Envoyées</p>
              <p className="text-2xl font-bold text-blue-400">{stats.nb_envoyees}</p>
            </div>
          </div>
        )}

        {/* Actions globales */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSendAllFactures}
            disabled={sendingAll || !stats?.nb_en_attente}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/30 transition-all disabled:opacity-50"
          >
            {sendingAll ? <Loader2 size={18} className="animate-spin" /> : <SendHorizonal size={18} />}
            Envoyer toutes ({stats?.nb_en_attente || 0})
          </button>
          <button
            onClick={handleGenerateMissing}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-white/80 rounded-xl hover:bg-zinc-700 transition"
          >
            <RefreshCw size={18} />
            Générer manquantes
          </button>
        </div>

        {/* Liste des factures */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="text-left p-4 text-white/60 font-medium">N° Facture</th>
                <th className="text-left p-4 text-white/60 font-medium">Client</th>
                <th className="text-left p-4 text-white/60 font-medium">Service</th>
                <th className="text-left p-4 text-white/60 font-medium">Date</th>
                <th className="text-right p-4 text-white/60 font-medium">TTC</th>
                <th className="text-center p-4 text-white/60 font-medium">Statut</th>
                <th className="text-center p-4 text-white/60 font-medium">Relance</th>
                <th className="text-right p-4 text-white/60 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {factures.map((f) => (
                <tr key={f.id} className="border-t border-white/5">
                  <td className="p-4">
                    <span className="text-white font-mono text-sm">{f.numero}</span>
                  </td>
                  <td className="p-4">
                    <div>
                      <p className="text-white">{f.client_nom}</p>
                      {f.client_email && (
                        <p className="text-white/40 text-xs">{f.client_email}</p>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-white/80">{f.service_nom}</td>
                  <td className="p-4 text-white/60">
                    {new Date(f.date_prestation).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="p-4 text-right">
                    <div>
                      <p className="text-white font-medium">{f.montant_ttc_euros}€</p>
                      <p className="text-white/40 text-xs">TVA: {f.montant_tva_euros}€</p>
                    </div>
                  </td>
                  <td className="p-4 text-center">{getStatutBadge(f.statut)}</td>
                  <td className="p-4 text-center">{getRelanceBadge(f.niveau_relance)}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-1">
                      {f.statut === 'generee' && f.client_email && (
                        <button
                          onClick={() => handleSendFacture(f.id)}
                          disabled={sendingFacture === f.id}
                          className="flex items-center gap-1 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition text-sm disabled:opacity-50"
                        >
                          {sendingFacture === f.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Send size={14} />
                          )}
                          Envoyer
                        </button>
                      )}
                      {f.statut === 'envoyee' && (
                        <button
                          onClick={() => handleChangeFactureStatus(f.id, 'payee')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition text-sm"
                        >
                          <CheckCircle2 size={14} />
                          Marquer payée
                        </button>
                      )}
                      {!f.client_email && f.statut === 'generee' && (
                        <span className="text-xs text-red-400/80 px-2 py-1">Pas d'email</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {factures.length === 0 && (
            <div className="text-center text-white/40 py-12">
              Aucune facture ce mois
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-4">
          <p className="text-white/50 text-sm">
            <strong className="text-white/70">Info :</strong> Les factures sont générées automatiquement
            lorsqu'une réservation passe au statut "Terminé". Vous pouvez ensuite les envoyer
            par email au client (PDF joint).
          </p>
        </div>
      </div>
    );
  };

  // Modal
  const renderModal = () => {
    if (!showModal) return null;

    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-white/10 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white">
              {selectedItem ? 'Modifier la dépense' : 'Nouvelle dépense'}
            </h3>
            <button
              onClick={() => { setShowModal(false); setSelectedItem(null); }}
              className="p-2 hover:bg-white/10 rounded-lg transition"
            >
              <X size={20} className="text-white/60" />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const data = Object.fromEntries(formData.entries());
              // Gérer la checkbox TVA déductible (non envoyée si non cochée)
              if (!formData.has('deductible_tva_input')) {
                (data as any).deductible_tva_input = 'false';
              }
              handleSaveDepense(data as any);
            }}
            className="p-6 space-y-4"
          >
            <div>
              <label className="block text-sm text-white/60 mb-1">Description *</label>
              <input
                type="text"
                name="description"
                defaultValue={selectedItem?.description}
                required
                placeholder="Ex: Achat produits coiffure"
                className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">Montant TTC (€) *</label>
                <input
                  type="number"
                  name="montant_ttc_input"
                  defaultValue={selectedItem?.montant_ttc ? (selectedItem.montant_ttc / 100).toFixed(2) : undefined}
                  required
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">Taux TVA *</label>
                <select
                  name="taux_tva_input"
                  defaultValue={selectedItem?.taux_tva?.toString() || '20'}
                  className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                >
                  <option value="20">20% (Taux normal)</option>
                  <option value="10">10% (Taux intermédiaire)</option>
                  <option value="5.5">5.5% (Taux réduit)</option>
                  <option value="2.1">2.1% (Taux super-réduit)</option>
                  <option value="0">0% (Exonéré)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">Date *</label>
                <input
                  type="date"
                  name="date_depense"
                  defaultValue={selectedItem?.date_depense || new Date().toISOString().split('T')[0]}
                  required
                  className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
                />
              </div>
              <div className="flex items-center pt-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="deductible_tva_input"
                    value="true"
                    defaultChecked={selectedItem?.deductible_tva !== false}
                    className="w-5 h-5 rounded bg-zinc-800 border border-white/10 text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-white/80 text-sm">TVA déductible</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1">Catégorie *</label>
              <select
                name="categorie"
                defaultValue={selectedItem?.categorie || 'autre'}
                required
                className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1">Récurrence</label>
              <select
                name="recurrence"
                defaultValue={selectedItem?.recurrence || 'ponctuelle'}
                className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
              >
                <option value="ponctuelle">Ponctuelle</option>
                <option value="mensuelle">Mensuelle</option>
                <option value="trimestrielle">Trimestrielle</option>
                <option value="annuelle">Annuelle</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1">Notes</label>
              <textarea
                name="notes"
                defaultValue={selectedItem?.notes}
                rows={2}
                placeholder="Notes additionnelles..."
                className="w-full px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => { setShowModal(false); setSelectedItem(null); }}
                className="px-4 py-2 bg-white/10 text-white rounded-xl hover:bg-white/20 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl hover:shadow-lg hover:shadow-amber-500/30 transition-all disabled:opacity-50"
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              Comptabilité
            </h1>
            <p className="text-white/60 mt-1">Suivi des dépenses et compte de résultat</p>
          </div>
          <input
            type="month"
            value={selectedMois}
            onChange={(e) => setSelectedMois(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-white/10 rounded-xl text-white"
          />
        </div>

        {/* KPIs */}
        {renderKPIs()}

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'apercu', label: 'Aperçu', icon: PieChart },
            { id: 'depenses', label: 'Dépenses', icon: Receipt },
            { id: 'facturation', label: 'Facturation', icon: FileText },
            { id: 'resultat', label: 'Compte de résultat', icon: BarChart3 },
            { id: 'tva', label: 'TVA', icon: Percent },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30'
                  : 'bg-zinc-800/50 text-white/60 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : (
          <>
            {activeTab === 'apercu' && renderApercu()}
            {activeTab === 'depenses' && renderDepenses()}
            {activeTab === 'facturation' && renderFacturation()}
            {activeTab === 'resultat' && renderResultat()}
            {activeTab === 'tva' && renderTVA()}
          </>
        )}

        {/* Modal */}
        {renderModal()}
      </div>
    </AdminLayout>
  );
}
