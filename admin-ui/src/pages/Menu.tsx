import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Edit, Trash2, X, Loader2, Search, UtensilsCrossed,
  Sun, Moon, Star, AlertCircle, Filter, RotateCcw,
  ChefHat, Leaf, Fish, Wheat, Euro
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
interface Categorie {
  id: number;
  nom: string;
  description?: string;
  ordre: number;
  actif: boolean;
}

interface Plat {
  id: number;
  nom: string;
  description?: string;
  prix: number;
  categorie_id: number | null;
  menu_categories?: { id: number; nom: string };
  allergenes: string[];
  regime: string[];
  disponible_midi: boolean;
  disponible_soir: boolean;
  plat_du_jour: boolean;
  stock_limite: boolean;
  stock_quantite: number;
  actif: boolean;
  ordre: number;
}

// Allergènes et régimes
const ALLERGENES = [
  { value: 'gluten', label: 'Gluten', icon: Wheat },
  { value: 'lactose', label: 'Lactose', icon: null },
  { value: 'oeufs', label: 'Oeufs', icon: null },
  { value: 'poisson', label: 'Poisson', icon: Fish },
  { value: 'crustaces', label: 'Crustacés', icon: null },
  { value: 'arachides', label: 'Arachides', icon: null },
  { value: 'soja', label: 'Soja', icon: null },
  { value: 'fruits_coque', label: 'Fruits à coque', icon: null },
  { value: 'celeri', label: 'Céleri', icon: null },
  { value: 'moutarde', label: 'Moutarde', icon: null },
  { value: 'sesame', label: 'Sésame', icon: null },
  { value: 'sulfites', label: 'Sulfites', icon: null },
];

const REGIMES = [
  { value: 'vegetarien', label: 'Végétarien', icon: Leaf, color: 'bg-green-100 text-green-700' },
  { value: 'vegan', label: 'Vegan', icon: Leaf, color: 'bg-green-100 text-green-700' },
  { value: 'halal', label: 'Halal', icon: null, color: 'bg-purple-100 text-purple-700' },
  { value: 'casher', label: 'Casher', icon: null, color: 'bg-blue-100 text-blue-700' },
  { value: 'sans_gluten', label: 'Sans gluten', icon: Wheat, color: 'bg-amber-100 text-amber-700' },
];

// Catégories par défaut
const CATEGORIES_DEFAUT = ['Entrées', 'Plats', 'Desserts', 'Boissons'];

export default function MenuPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'plats' | 'categories' | 'du-jour'>('plats');
  const [showPlatModal, setShowPlatModal] = useState(false);
  const [editingPlat, setEditingPlat] = useState<Plat | null>(null);
  const [showCategorieModal, setShowCategorieModal] = useState(false);
  const [editingCategorie, setEditingCategorie] = useState<Categorie | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    categorie: 'all',
    service: 'all', // all, midi, soir
    plat_du_jour: 'all', // all, true
    status: 'all' // all, actif, inactif
  });

  // Fetch catégories
  const { data: categoriesData } = useQuery<{ categories: Categorie[] }>({
    queryKey: ['menu-categories'],
    queryFn: async () => {
      const res = await fetch('/api/admin/menu/categories', {
        headers: { Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (!res.ok) throw new Error('Erreur chargement');
      return res.json();
    }
  });

  // Fetch plats
  const { data: platsData, isLoading } = useQuery<{ plats: Plat[] }>({
    queryKey: ['menu-plats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/menu/plats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (!res.ok) throw new Error('Erreur chargement');
      return res.json();
    }
  });

  // Fetch stats
  const { data: statsData } = useQuery<{ total_plats: number; total_categories: number; plats_du_jour: number }>({
    queryKey: ['menu-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/menu/stats', {
        headers: { Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (!res.ok) throw new Error('Erreur');
      return res.json();
    }
  });

  // Filtered plats
  const filteredPlats = useMemo(() => {
    if (!platsData?.plats) return [];

    return platsData.plats.filter(plat => {
      if (searchInput && !plat.nom.toLowerCase().includes(searchInput.toLowerCase())) return false;
      if (filters.categorie !== 'all' && plat.categorie_id !== parseInt(filters.categorie)) return false;
      if (filters.service === 'midi' && !plat.disponible_midi) return false;
      if (filters.service === 'soir' && !plat.disponible_soir) return false;
      if (filters.plat_du_jour === 'true' && !plat.plat_du_jour) return false;
      if (filters.status === 'actif' && !plat.actif) return false;
      if (filters.status === 'inactif' && plat.actif) return false;
      return true;
    });
  }, [platsData?.plats, searchInput, filters]);

  // Group by category
  const platsByCategory = useMemo(() => {
    const groups: Record<string, Plat[]> = {};
    filteredPlats.forEach(plat => {
      const catName = plat.menu_categories?.nom || 'Sans catégorie';
      if (!groups[catName]) groups[catName] = [];
      groups[catName].push(plat);
    });
    return groups;
  }, [filteredPlats]);

  const hasActiveFilters = filters.categorie !== 'all' || filters.service !== 'all' || filters.plat_du_jour !== 'all' || filters.status !== 'all' || searchInput;

  const resetFilters = () => {
    setFilters({ categorie: 'all', service: 'all', plat_du_jour: 'all', status: 'all' });
    setSearchInput('');
  };

  // Toggle plat du jour
  const togglePlatDuJourMutation = useMutation({
    mutationFn: async ({ id, value }: { id: number; value: boolean }) => {
      const res = await fetch(`/api/admin/menu/plats/${id}/plat-du-jour`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ plat_du_jour: value })
      });
      if (!res.ok) throw new Error('Erreur');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-plats'] });
      queryClient.invalidateQueries({ queryKey: ['menu-stats'] });
    }
  });

  // Delete plat
  const deletePlatMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/menu/plats/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (!res.ok) throw new Error('Erreur');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-plats'] });
      queryClient.invalidateQueries({ queryKey: ['menu-stats'] });
    }
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <UtensilsCrossed className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Menu</h1>
            <p className="text-sm text-gray-500">Gérez vos plats et menus du jour</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4 text-center">
            <ChefHat className="h-8 w-8 mx-auto text-blue-600 mb-2" />
            <p className="text-2xl font-bold text-blue-700">{statsData?.total_plats || 0}</p>
            <p className="text-sm text-blue-600">Plats</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4 text-center">
            <UtensilsCrossed className="h-8 w-8 mx-auto text-purple-600 mb-2" />
            <p className="text-2xl font-bold text-purple-700">{statsData?.total_categories || 0}</p>
            <p className="text-sm text-purple-600">Catégories</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardContent className="p-4 text-center">
            <Star className="h-8 w-8 mx-auto text-amber-600 mb-2" />
            <p className="text-2xl font-bold text-amber-700">{statsData?.plats_du_jour || 0}</p>
            <p className="text-sm text-amber-600">Plats du jour</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b pb-2">
        <Button
          variant={activeTab === 'plats' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('plats')}
        >
          <ChefHat className="h-4 w-4 mr-2" />
          Plats
        </Button>
        <Button
          variant={activeTab === 'categories' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('categories')}
        >
          <UtensilsCrossed className="h-4 w-4 mr-2" />
          Catégories
        </Button>
        <Button
          variant={activeTab === 'du-jour' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('du-jour')}
        >
          <Star className="h-4 w-4 mr-2" />
          Menu du jour
        </Button>
      </div>

      {/* Plats Tab */}
      {activeTab === 'plats' && (
        <>
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher un plat..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => { setEditingPlat(null); setShowPlatModal(true); }} className="gap-2">
              <Plus className="h-4 w-4" />
              Nouveau plat
            </Button>
          </div>

          {/* Filters */}
          <Card className="p-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <Filter className="w-4 h-4 text-gray-400" />

              <select
                value={filters.categorie}
                onChange={(e) => setFilters({ ...filters, categorie: e.target.value })}
                className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm"
              >
                <option value="all">Toutes catégories</option>
                {categoriesData?.categories?.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.nom}</option>
                ))}
              </select>

              <select
                value={filters.service}
                onChange={(e) => setFilters({ ...filters, service: e.target.value })}
                className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm"
              >
                <option value="all">Tous services</option>
                <option value="midi">Midi</option>
                <option value="soir">Soir</option>
              </select>

              <select
                value={filters.plat_du_jour}
                onChange={(e) => setFilters({ ...filters, plat_du_jour: e.target.value })}
                className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm"
              >
                <option value="all">Tous les plats</option>
                <option value="true">Plats du jour</option>
              </select>

              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm"
              >
                <option value="all">Tous statuts</option>
                <option value="actif">Actifs</option>
                <option value="inactif">Inactifs</option>
              </select>

              {hasActiveFilters && (
                <Button onClick={resetFilters} variant="outline" size="sm">
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Reset
                </Button>
              )}

              {hasActiveFilters && (
                <span className="text-sm text-gray-500">
                  {filteredPlats.length} / {platsData?.plats?.length || 0} plats
                </span>
              )}
            </div>
          </Card>

          {/* Plats List */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(platsByCategory).map(([catName, plats]) => (
                <div key={catName}>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <UtensilsCrossed className="h-5 w-5 text-orange-500" />
                    {catName}
                    <Badge variant="secondary">{plats.length}</Badge>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {plats.map((plat) => (
                      <Card key={plat.id} className={cn(
                        'relative overflow-hidden transition-all hover:shadow-lg',
                        !plat.actif && 'opacity-60',
                        plat.plat_du_jour && 'ring-2 ring-amber-400'
                      )}>
                        {plat.plat_du_jour && (
                          <div className="absolute top-2 right-2">
                            <Badge className="bg-amber-500 text-white">
                              <Star className="h-3 w-3 mr-1" />
                              Du jour
                            </Badge>
                          </div>
                        )}

                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-gray-900">{plat.nom}</h4>
                            <span className="text-lg font-bold text-green-600">
                              {formatCurrency(plat.prix)}
                            </span>
                          </div>

                          {plat.description && (
                            <p className="text-sm text-gray-500 mb-3 line-clamp-2">{plat.description}</p>
                          )}

                          {/* Services disponibles */}
                          <div className="flex gap-2 mb-3">
                            {plat.disponible_midi && (
                              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                                <Sun className="h-3 w-3 mr-1" />
                                Midi
                              </Badge>
                            )}
                            {plat.disponible_soir && (
                              <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                                <Moon className="h-3 w-3 mr-1" />
                                Soir
                              </Badge>
                            )}
                          </div>

                          {/* Régimes */}
                          {plat.regime && plat.regime.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-3">
                              {plat.regime.map(r => {
                                const regime = REGIMES.find(reg => reg.value === r);
                                return regime ? (
                                  <Badge key={r} variant="outline" className={cn('text-xs', regime.color)}>
                                    {regime.label}
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-2 pt-2 border-t">
                            <Button
                              size="sm"
                              variant={plat.plat_du_jour ? 'default' : 'outline'}
                              className={cn(
                                'flex-1',
                                plat.plat_du_jour && 'bg-amber-500 hover:bg-amber-600'
                              )}
                              onClick={() => togglePlatDuJourMutation.mutate({ id: plat.id, value: !plat.plat_du_jour })}
                            >
                              <Star className={cn('h-4 w-4', plat.plat_du_jour && 'fill-white')} />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setEditingPlat(plat); setShowPlatModal(true); }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => {
                                if (confirm(`Supprimer "${plat.nom}" ?`)) {
                                  deletePlatMutation.mutate(plat.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}

              {filteredPlats.length === 0 && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <ChefHat className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">
                      {hasActiveFilters ? 'Aucun plat trouvé avec ces filtres' : 'Aucun plat configuré'}
                    </p>
                    {!hasActiveFilters && (
                      <Button variant="link" onClick={() => setShowPlatModal(true)} className="mt-2">
                        Créer votre premier plat
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {/* Catégories Tab */}
      {activeTab === 'categories' && (
        <CategoriesTab
          categories={categoriesData?.categories || []}
          onEdit={(cat) => { setEditingCategorie(cat); setShowCategorieModal(true); }}
          onAdd={() => { setEditingCategorie(null); setShowCategorieModal(true); }}
        />
      )}

      {/* Menu du jour Tab */}
      {activeTab === 'du-jour' && (
        <MenuDuJourTab plats={platsData?.plats || []} categories={categoriesData?.categories || []} />
      )}

      {/* Plat Modal */}
      {showPlatModal && (
        <PlatModal
          plat={editingPlat}
          categories={categoriesData?.categories || []}
          onClose={() => { setShowPlatModal(false); setEditingPlat(null); }}
        />
      )}

      {/* Catégorie Modal */}
      {showCategorieModal && (
        <CategorieModal
          categorie={editingCategorie}
          onClose={() => { setShowCategorieModal(false); setEditingCategorie(null); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════

function CategoriesTab({ categories, onEdit, onAdd }: {
  categories: Categorie[];
  onEdit: (cat: Categorie) => void;
  onAdd: () => void;
}) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/menu/categories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (!res.ok) throw new Error('Erreur');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
      queryClient.invalidateQueries({ queryKey: ['menu-stats'] });
    }
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Catégories de plats</h2>
        <Button onClick={onAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Nouvelle catégorie
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <Card key={cat.id} className={cn(!cat.actif && 'opacity-60')}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-gray-900">{cat.nom}</h3>
                <Badge variant="outline">{cat.ordre}</Badge>
              </div>
              {cat.description && (
                <p className="text-sm text-gray-500 mb-3">{cat.description}</p>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit(cat)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Modifier
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => {
                    if (confirm(`Supprimer "${cat.nom}" ?`)) deleteMutation.mutate(cat.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {categories.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="p-12 text-center">
              <UtensilsCrossed className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">Aucune catégorie</p>
              <Button onClick={onAdd}>Créer les catégories par défaut</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function MenuDuJourTab({ plats, categories }: { plats: Plat[]; categories: Categorie[] }) {
  const platsDuJour = plats.filter(p => p.plat_du_jour && p.actif);

  // Grouper par catégorie
  const groupedPlats: Record<string, Plat[]> = {};
  platsDuJour.forEach(p => {
    const catName = p.menu_categories?.nom || 'Autres';
    if (!groupedPlats[catName]) groupedPlats[catName] = [];
    groupedPlats[catName].push(p);
  });

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold">Menu du jour</h2>
          <p className="text-sm text-gray-500">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
      </div>

      {platsDuJour.length > 0 ? (
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
              Menu du jour - {platsDuJour.length} plat(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(groupedPlats).map(([catName, catPlats]) => (
                <div key={catName}>
                  <h4 className="font-semibold text-amber-900 mb-2">{catName}</h4>
                  <div className="space-y-2">
                    {catPlats.map(plat => (
                      <div key={plat.id} className="flex justify-between items-center p-3 bg-white rounded-lg">
                        <div>
                          <span className="font-medium text-gray-900">{plat.nom}</span>
                          {plat.description && (
                            <p className="text-sm text-gray-500">{plat.description}</p>
                          )}
                        </div>
                        <span className="text-lg font-bold text-green-600">{formatCurrency(plat.prix)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Star className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">Aucun plat du jour sélectionné</p>
            <p className="text-sm text-gray-400">
              Cliquez sur l'étoile d'un plat pour le marquer comme "plat du jour"
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Modal création/édition plat
function PlatModal({ plat, categories, onClose }: {
  plat: Plat | null;
  categories: Categorie[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEditing = !!plat;

  const [formData, setFormData] = useState({
    nom: plat?.nom || '',
    description: plat?.description || '',
    prix: plat ? plat.prix / 100 : 0,
    categorie_id: plat?.categorie_id || '',
    allergenes: plat?.allergenes || [],
    regime: plat?.regime || [],
    disponible_midi: plat?.disponible_midi ?? true,
    disponible_soir: plat?.disponible_soir ?? true,
    plat_du_jour: plat?.plat_du_jour ?? false,
    actif: plat?.actif ?? true
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const url = isEditing ? `/api/admin/menu/plats/${plat.id}` : '/api/admin/menu/plats';
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          prix: Math.round(formData.prix * 100),
          categorie_id: formData.categorie_id ? parseInt(formData.categorie_id as string) : null
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-plats'] });
      queryClient.invalidateQueries({ queryKey: ['menu-stats'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message)
  });

  const toggleAllergene = (value: string) => {
    setFormData(d => ({
      ...d,
      allergenes: d.allergenes.includes(value)
        ? d.allergenes.filter(a => a !== value)
        : [...d.allergenes, value]
    }));
  };

  const toggleRegime = (value: string) => {
    setFormData(d => ({
      ...d,
      regime: d.regime.includes(value)
        ? d.regime.filter(r => r !== value)
        : [...d.regime, value]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{isEditing ? 'Modifier le plat' : 'Nouveau plat'}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <Input
                value={formData.nom}
                onChange={(e) => setFormData(d => ({ ...d, nom: e.target.value }))}
                placeholder="Ex: Boeuf bourguignon"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(d => ({ ...d, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                rows={2}
                placeholder="Description du plat..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix (€) *</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.prix}
                  onChange={(e) => setFormData(d => ({ ...d, prix: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                <select
                  value={formData.categorie_id}
                  onChange={(e) => setFormData(d => ({ ...d, categorie_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Sans catégorie</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.nom}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Disponibilité */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Disponibilité</p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.disponible_midi}
                    onChange={(e) => setFormData(d => ({ ...d, disponible_midi: e.target.checked }))}
                    className="rounded"
                  />
                  <Sun className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">Midi</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.disponible_soir}
                    onChange={(e) => setFormData(d => ({ ...d, disponible_soir: e.target.checked }))}
                    className="rounded"
                  />
                  <Moon className="h-4 w-4 text-indigo-500" />
                  <span className="text-sm">Soir</span>
                </label>
              </div>
            </div>

            {/* Régimes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Régimes alimentaires</label>
              <div className="flex flex-wrap gap-2">
                {REGIMES.map(regime => (
                  <button
                    key={regime.value}
                    type="button"
                    onClick={() => toggleRegime(regime.value)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                      formData.regime.includes(regime.value)
                        ? regime.color
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {regime.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Allergènes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Allergènes</label>
              <div className="flex flex-wrap gap-2">
                {ALLERGENES.map(allergene => (
                  <button
                    key={allergene.value}
                    type="button"
                    onClick={() => toggleAllergene(allergene.value)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium transition-colors',
                      formData.allergenes.includes(allergene.value)
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                  >
                    {allergene.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Statut */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Plat actif</p>
                <p className="text-xs text-gray-500">Visible sur le menu</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData(d => ({ ...d, actif: !d.actif }))}
                className={cn(
                  'w-12 h-6 rounded-full transition-colors relative',
                  formData.actif ? 'bg-green-500' : 'bg-gray-300'
                )}
              >
                <div className={cn(
                  'w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow',
                  formData.actif ? 'translate-x-6' : 'translate-x-0.5'
                )} />
              </button>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditing ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Modal création/édition catégorie
function CategorieModal({ categorie, onClose }: {
  categorie: Categorie | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isEditing = !!categorie;

  const [formData, setFormData] = useState({
    nom: categorie?.nom || '',
    description: categorie?.description || '',
    ordre: categorie?.ordre || 0,
    actif: categorie?.actif ?? true
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const url = isEditing ? `/api/admin/menu/categories/${categorie.id}` : '/api/admin/menu/categories';
      const res = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('nexus_admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erreur');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-categories'] });
      queryClient.invalidateQueries({ queryKey: ['menu-stats'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message)
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{isEditing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <Input
                value={formData.nom}
                onChange={(e) => setFormData(d => ({ ...d, nom: e.target.value }))}
                placeholder="Ex: Entrées"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(d => ({ ...d, description: e.target.value }))}
                placeholder="Description optionnelle..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordre d'affichage</label>
              <Input
                type="number"
                min="0"
                value={formData.ordre}
                onChange={(e) => setFormData(d => ({ ...d, ordre: parseInt(e.target.value) || 0 }))}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditing ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
