import { useState, useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  Package,
  Plus,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardList,
  Loader2,
  Search,
  X,
  Edit2,
  BarChart3,
  Boxes,
  RefreshCw,
  Check,
  AlertCircle,
} from 'lucide-react';

interface Produit {
  id: string;
  reference: string;
  nom: string;
  description?: string;
  categorie: string;
  stock_actuel: number;
  stock_minimum: number;
  stock_optimal: number;
  unite: string;
  prix_achat_unitaire: number;
  prix_vente_unitaire: number;
  prix_achat_unitaire_euros: string;
  prix_vente_unitaire_euros: string;
  valeur_stock: string;
  fournisseur?: string;
  emplacement?: string;
  actif: boolean;
  stock_bas: boolean;
  stock_zero: boolean;
}

interface Mouvement {
  id: string;
  produit_id: string;
  type: string;
  quantite: number;
  stock_avant: number;
  stock_apres: number;
  prix_unitaire_euros?: string;
  motif?: string;
  date_mouvement: string;
  produits?: { nom: string; reference: string };
}

interface Alerte {
  id: string;
  type_alerte: string;
  niveau: string;
  message: string;
  resolue: boolean;
  created_at: string;
  produits?: { nom: string; reference: string; stock_actuel: number; stock_minimum: number };
}

interface DashboardStats {
  nb_produits: number;
  nb_stock_bas: number;
  nb_stock_zero: number;
  nb_alertes_actives: number;
  valeur_totale_euros: string;
  valeur_vente_potentielle_euros: string;
  marge_potentielle_euros: string;
}

const CATEGORIES = [
  { id: 'fournitures', label: 'Fournitures' },
  { id: 'produits_vente', label: 'Produits vente' },
  { id: 'ingredients', label: 'Ingrédients' },
  { id: 'emballages', label: 'Emballages' },
  { id: 'materiaux', label: 'Matériaux' },
  { id: 'autre', label: 'Autre' },
];

const TYPE_MOUVEMENT_LABELS: Record<string, string> = {
  entree: 'Entrée',
  sortie: 'Sortie',
  ajustement: 'Ajustement',
  perte: 'Perte',
  transfert: 'Transfert',
};

export default function Stock() {
  const [activeTab, setActiveTab] = useState<'produits' | 'mouvements' | 'inventaires'>('produits');
  const [produits, setProduits] = useState<Produit[]>([]);
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categorieFilter, setCategorieFilter] = useState('');
  const [stockBasFilter, setStockBasFilter] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMouvementModal, setShowMouvementModal] = useState(false);
  const [selectedProduit, setSelectedProduit] = useState<Produit | null>(null);
  const [saving, setSaving] = useState(false);

  // Form produit
  const [formProduit, setFormProduit] = useState({
    reference: '',
    nom: '',
    description: '',
    categorie: 'fournitures',
    stock_actuel: '0',
    stock_minimum: '5',
    stock_optimal: '20',
    unite: 'piece',
    prix_achat_unitaire: '0',
    prix_vente_unitaire: '0',
    fournisseur: '',
    emplacement: '',
  });

  // Form mouvement
  const [formMouvement, setFormMouvement] = useState({
    produit_id: '',
    type: 'entree',
    quantite: '',
    motif: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const token = localStorage.getItem('admin_token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [dashRes, produitsRes, mouvementsRes, alertesRes] = await Promise.all([
        fetch('/api/stock/dashboard', { headers }).then(r => r.json()).catch(() => null),
        fetch('/api/stock/produits', { headers }).then(r => r.json()).catch(() => ({ produits: [] })),
        fetch('/api/stock/mouvements?limit=50', { headers }).then(r => r.json()).catch(() => ({ mouvements: [] })),
        fetch('/api/stock/alertes?resolue=false', { headers }).then(r => r.json()).catch(() => ({ alertes: [] })),
      ]);

      if (dashRes?.success) {
        setStats(dashRes.stats);
        setAlertes(dashRes.alertes_recentes || []);
      }
      setProduits(produitsRes.produits || []);
      setMouvements(mouvementsRes.mouvements || []);
      if (alertesRes.success) {
        setAlertes(alertesRes.alertes || []);
      }
    } catch (error) {
      console.error('Erreur chargement stock:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduit = async () => {
    if (!formProduit.reference || !formProduit.nom) {
      alert('Référence et nom requis');
      return;
    }

    setSaving(true);
    const token = localStorage.getItem('admin_token');

    try {
      const res = await fetch('/api/stock/produits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formProduit,
          stock_actuel: parseInt(formProduit.stock_actuel),
          stock_minimum: parseInt(formProduit.stock_minimum),
          stock_optimal: parseInt(formProduit.stock_optimal),
          prix_achat_unitaire: parseFloat(formProduit.prix_achat_unitaire),
          prix_vente_unitaire: parseFloat(formProduit.prix_vente_unitaire),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        resetFormProduit();
        loadData();
      } else {
        alert(data.error || 'Erreur création');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur création produit');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateMouvement = async () => {
    if (!formMouvement.produit_id || !formMouvement.quantite) {
      alert('Produit et quantité requis');
      return;
    }

    setSaving(true);
    const token = localStorage.getItem('admin_token');

    try {
      const res = await fetch('/api/stock/mouvements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          produit_id: formMouvement.produit_id,
          type: formMouvement.type,
          quantite: parseInt(formMouvement.quantite),
          motif: formMouvement.motif || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowMouvementModal(false);
        setFormMouvement({ produit_id: '', type: 'entree', quantite: '', motif: '' });
        loadData();
      } else {
        alert(data.error || 'Erreur mouvement');
      }
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur création mouvement');
    } finally {
      setSaving(false);
    }
  };

  const resetFormProduit = () => {
    setFormProduit({
      reference: '',
      nom: '',
      description: '',
      categorie: 'fournitures',
      stock_actuel: '0',
      stock_minimum: '5',
      stock_optimal: '20',
      unite: 'piece',
      prix_achat_unitaire: '0',
      prix_vente_unitaire: '0',
      fournisseur: '',
      emplacement: '',
    });
  };

  const openMouvementForProduit = (produit: Produit) => {
    setFormMouvement({
      produit_id: produit.id,
      type: 'entree',
      quantite: '',
      motif: '',
    });
    setSelectedProduit(produit);
    setShowMouvementModal(true);
  };

  // Filtrage
  const produitsFiltres = produits.filter(p => {
    if (search && !p.nom.toLowerCase().includes(search.toLowerCase()) && !p.reference.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (categorieFilter && p.categorie !== categorieFilter) return false;
    if (stockBasFilter && !p.stock_bas && !p.stock_zero) return false;
    return true;
  });

  const renderKPIs = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border border-blue-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Package className="w-5 h-5 text-blue-400" />
          <span className="text-xs text-white/60">Produits</span>
        </div>
        <p className="text-2xl font-bold text-white">{stats?.nb_produits || 0}</p>
      </div>

      <div className="bg-gradient-to-br from-orange-600/20 to-orange-800/20 border border-orange-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-orange-400" />
          <span className="text-xs text-white/60">Stock bas</span>
        </div>
        <p className="text-2xl font-bold text-orange-400">{stats?.nb_stock_bas || 0}</p>
      </div>

      <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 border border-red-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-xs text-white/60">Rupture</span>
        </div>
        <p className="text-2xl font-bold text-red-400">{stats?.nb_stock_zero || 0}</p>
      </div>

      <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 border border-green-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-5 h-5 text-green-400" />
          <span className="text-xs text-white/60">Valeur stock</span>
        </div>
        <p className="text-2xl font-bold text-white">{stats?.valeur_totale_euros || '0.00'}€</p>
      </div>
    </div>
  );

  const renderAlertes = () => {
    if (alertes.length === 0) return null;

    return (
      <div className="bg-orange-900/20 border border-orange-500/30 rounded-2xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-orange-400" />
          <span className="font-semibold text-orange-300">Alertes stock ({alertes.length})</span>
        </div>
        <div className="space-y-2">
          {alertes.slice(0, 5).map(alerte => (
            <div key={alerte.id} className={`flex items-center justify-between text-sm p-2 rounded-lg ${
              alerte.niveau === 'urgent' ? 'bg-red-900/30 text-red-300' : 'bg-orange-900/30 text-orange-300'
            }`}>
              <span>{alerte.message}</span>
              <span className={`px-2 py-0.5 rounded text-xs ${
                alerte.niveau === 'urgent' ? 'bg-red-600' : 'bg-orange-600'
              }`}>
                {alerte.niveau}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderProduits = () => (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-white/10 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
          />
        </div>
        <select
          value={categorieFilter}
          onChange={(e) => setCategorieFilter(e.target.value)}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none"
        >
          <option value="">Toutes catégories</option>
          {CATEGORIES.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
          <input
            type="checkbox"
            checked={stockBasFilter}
            onChange={(e) => setStockBasFilter(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          Stock bas uniquement
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Réf.</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Produit</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Catégorie</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-white/60 uppercase">Stock</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white/60 uppercase">Prix achat</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white/60 uppercase">Prix vente</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-white/60 uppercase">Valeur</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-white/60 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {produitsFiltres.map(produit => (
              <tr key={produit.id} className={`hover:bg-white/5 ${
                produit.stock_zero ? 'bg-red-900/20' :
                produit.stock_bas ? 'bg-orange-900/20' : ''
              }`}>
                <td className="px-4 py-3 text-sm font-mono text-white/80">{produit.reference}</td>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-white">{produit.nom}</p>
                  {produit.fournisseur && (
                    <p className="text-xs text-white/40">{produit.fournisseur}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-purple-600/30 text-purple-300 rounded-lg text-xs">
                    {CATEGORIES.find(c => c.id === produit.categorie)?.label || produit.categorie}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-bold ${
                    produit.stock_zero ? 'text-red-400' :
                    produit.stock_bas ? 'text-orange-400' :
                    'text-green-400'
                  }`}>
                    {produit.stock_actuel}
                  </span>
                  <span className="text-xs text-white/40 ml-1">
                    / {produit.stock_minimum} {produit.unite}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-right text-white/80">{produit.prix_achat_unitaire_euros}€</td>
                <td className="px-4 py-3 text-sm text-right text-white/80">{produit.prix_vente_unitaire_euros}€</td>
                <td className="px-4 py-3 text-sm text-right font-medium text-green-400">{produit.valeur_stock}€</td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => openMouvementForProduit(produit)}
                    className="px-3 py-1 bg-purple-600/30 text-purple-300 rounded-lg text-xs hover:bg-purple-600/50 transition"
                  >
                    Mouvement
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {produitsFiltres.length === 0 && (
          <div className="p-12 text-center">
            <Boxes className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/60">Aucun produit trouvé</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition"
            >
              Ajouter un produit
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderMouvements = () => (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Produit</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-white/60 uppercase">Type</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-white/60 uppercase">Quantité</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-white/60 uppercase">Stock</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white/60 uppercase">Motif</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {mouvements.map(mvt => (
              <tr key={mvt.id} className="hover:bg-white/5">
                <td className="px-4 py-3 text-sm text-white/60">
                  {new Date(mvt.date_mouvement).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3 text-sm text-white">
                  {mvt.produits?.nom || 'Produit inconnu'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-lg text-xs ${
                    mvt.type === 'entree' ? 'bg-green-600/30 text-green-300' :
                    mvt.type === 'sortie' ? 'bg-red-600/30 text-red-300' :
                    mvt.type === 'perte' ? 'bg-orange-600/30 text-orange-300' :
                    'bg-blue-600/30 text-blue-300'
                  }`}>
                    {TYPE_MOUVEMENT_LABELS[mvt.type] || mvt.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`font-medium ${mvt.quantite > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {mvt.quantite > 0 ? '+' : ''}{mvt.quantite}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-sm text-white/60">
                  {mvt.stock_avant} → {mvt.stock_apres}
                </td>
                <td className="px-4 py-3 text-sm text-white/60">{mvt.motif || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {mouvements.length === 0 && (
          <div className="p-12 text-center">
            <TrendingUp className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/60">Aucun mouvement enregistré</p>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Package className="w-8 h-8 text-purple-400" />
              Stock & Inventaire
            </h1>
            <p className="text-white/60 mt-1">Gestion des produits et fournitures</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowMouvementModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              Mouvement
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nouveau produit
            </button>
          </div>
        </div>

        {/* KPIs */}
        {renderKPIs()}

        {/* Alertes */}
        {renderAlertes()}

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10 pb-2">
          <button
            onClick={() => setActiveTab('produits')}
            className={`px-4 py-2 rounded-t-xl text-sm font-medium transition ${
              activeTab === 'produits'
                ? 'bg-purple-600 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <Boxes className="w-4 h-4 inline mr-2" />
            Produits ({produits.length})
          </button>
          <button
            onClick={() => setActiveTab('mouvements')}
            className={`px-4 py-2 rounded-t-xl text-sm font-medium transition ${
              activeTab === 'mouvements'
                ? 'bg-purple-600 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/5'
            }`}
          >
            <RefreshCw className="w-4 h-4 inline mr-2" />
            Mouvements ({mouvements.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'produits' && renderProduits()}
        {activeTab === 'mouvements' && renderMouvements()}

        {/* Modal création produit */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1a2e] rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Nouveau produit</h2>
                <button onClick={() => { setShowCreateModal(false); resetFormProduit(); }} className="text-white/60 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Référence *</label>
                  <input
                    type="text"
                    value={formProduit.reference}
                    onChange={(e) => setFormProduit({ ...formProduit, reference: e.target.value.toUpperCase() })}
                    placeholder="SHA-001"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Nom *</label>
                  <input
                    type="text"
                    value={formProduit.nom}
                    onChange={(e) => setFormProduit({ ...formProduit, nom: e.target.value })}
                    placeholder="Shampooing professionnel 500ml"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Catégorie</label>
                  <select
                    value={formProduit.categorie}
                    onChange={(e) => setFormProduit({ ...formProduit, categorie: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Unité</label>
                  <select
                    value={formProduit.unite}
                    onChange={(e) => setFormProduit({ ...formProduit, unite: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="piece">Pièce</option>
                    <option value="litre">Litre</option>
                    <option value="kg">Kg</option>
                    <option value="boite">Boîte</option>
                    <option value="carton">Carton</option>
                    <option value="sachet">Sachet</option>
                    <option value="tube">Tube</option>
                    <option value="flacon">Flacon</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Stock actuel</label>
                  <input
                    type="number"
                    value={formProduit.stock_actuel}
                    onChange={(e) => setFormProduit({ ...formProduit, stock_actuel: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Stock minimum (alerte)</label>
                  <input
                    type="number"
                    value={formProduit.stock_minimum}
                    onChange={(e) => setFormProduit({ ...formProduit, stock_minimum: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Prix achat (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formProduit.prix_achat_unitaire}
                    onChange={(e) => setFormProduit({ ...formProduit, prix_achat_unitaire: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Prix vente (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formProduit.prix_vente_unitaire}
                    onChange={(e) => setFormProduit({ ...formProduit, prix_vente_unitaire: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Fournisseur</label>
                  <input
                    type="text"
                    value={formProduit.fournisseur}
                    onChange={(e) => setFormProduit({ ...formProduit, fournisseur: e.target.value })}
                    placeholder="L'Oréal Pro"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Emplacement</label>
                  <input
                    type="text"
                    value={formProduit.emplacement}
                    onChange={(e) => setFormProduit({ ...formProduit, emplacement: e.target.value })}
                    placeholder="Étagère A3"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowCreateModal(false); resetFormProduit(); }}
                  className="flex-1 px-4 py-2 border border-white/10 text-white rounded-xl hover:bg-white/5 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreateProduit}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Créer produit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal mouvement */}
        {showMouvementModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1a2e] rounded-2xl p-6 max-w-md w-full border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Mouvement stock</h2>
                <button onClick={() => setShowMouvementModal(false)} className="text-white/60 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Produit</label>
                  <select
                    value={formMouvement.produit_id}
                    onChange={(e) => setFormMouvement({ ...formMouvement, produit_id: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="">Sélectionner un produit</option>
                    {produits.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nom} (Stock: {p.stock_actuel})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Type de mouvement</label>
                  <select
                    value={formMouvement.type}
                    onChange={(e) => setFormMouvement({ ...formMouvement, type: e.target.value })}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="entree">Entrée (achat, livraison)</option>
                    <option value="sortie">Sortie (vente, utilisation)</option>
                    <option value="ajustement">Ajustement inventaire</option>
                    <option value="perte">Perte (casse, péremption)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Quantité</label>
                  <input
                    type="number"
                    value={formMouvement.quantite}
                    onChange={(e) => setFormMouvement({ ...formMouvement, quantite: e.target.value })}
                    placeholder="10"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/60 mb-2">Motif (optionnel)</label>
                  <textarea
                    value={formMouvement.motif}
                    onChange={(e) => setFormMouvement({ ...formMouvement, motif: e.target.value })}
                    placeholder="Raison du mouvement"
                    rows={2}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowMouvementModal(false)}
                  className="flex-1 px-4 py-2 border border-white/10 text-white rounded-xl hover:bg-white/5 transition"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreateMouvement}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Enregistrer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
