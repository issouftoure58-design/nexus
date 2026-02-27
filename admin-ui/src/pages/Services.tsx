import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { servicesApi, type Service } from '@/lib/api';
import {
  Briefcase,
  Plus,
  Clock,
  Euro,
  Edit,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  Check,
  Power,
  Search,
  Eye,
  Users,
  Calendar,
  TrendingUp,
  Filter,
  RotateCcw,
  UtensilsCrossed,
  Bed,
  MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfile } from '@/contexts/ProfileContext';
import { PricingFields, PriceDisplay, ServiceLabel, BusinessTypeField, FeatureField } from '@/components/forms';

export default function Services() {
  const queryClient = useQueryClient();
  const { t, isPricingMode, getPricingModes, isBusinessType } = useProfile();
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filters - adaptatifs selon business type
  const [filters, setFilters] = useState({
    priceRange: 'all', // all, cheap (<25€), medium (25-50€), expensive (>50€)
    duration: 'all', // all, short (<30min), medium (30-60min), long (>60min)
    status: 'all', // all, active, inactive
    // Restaurant specific
    capacity: 'all', // all, small (1-2), medium (3-4), large (5+)
    zone: 'all', // all, interieur, terrasse, prive
    // Hotel specific
    floor: 'all', // all, rdc, 1, 2, etc.
  });

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['services'],
    queryFn: servicesApi.list,
  });

  // Filter services based on all filters
  const filteredServices = useMemo(() => {
    if (!data?.services) return [];

    return data.services.filter(service => {
      // Search filter
      if (searchInput && !service.nom.toLowerCase().includes(searchInput.toLowerCase())) {
        return false;
      }

      // Price range filter (prix is in centimes)
      const prixEuros = service.prix / 100;
      if (filters.priceRange === 'cheap' && prixEuros >= 25) return false;
      if (filters.priceRange === 'medium' && (prixEuros < 25 || prixEuros > 50)) return false;
      if (filters.priceRange === 'expensive' && prixEuros <= 50) return false;

      // Duration filter
      if (filters.duration === 'short' && service.duree >= 30) return false;
      if (filters.duration === 'medium' && (service.duree < 30 || service.duree > 60)) return false;
      if (filters.duration === 'long' && service.duree <= 60) return false;

      // Status filter
      if (filters.status === 'active' && !service.actif) return false;
      if (filters.status === 'inactive' && service.actif) return false;

      return true;
    });
  }, [data?.services, searchInput, filters]);

  // Suggestions for search
  const suggestions = searchInput.length >= 1
    ? data?.services?.filter(s => s.nom.toLowerCase().includes(searchInput.toLowerCase())).slice(0, 5)
    : [];

  const resetFilters = () => {
    setFilters({
      priceRange: 'all',
      duration: 'all',
      status: 'all',
      capacity: 'all',
      zone: 'all',
      floor: 'all',
    });
    setSearchInput('');
  };

  const hasActiveFilters = filters.priceRange !== 'all' || filters.duration !== 'all' || filters.status !== 'all' || filters.capacity !== 'all' || filters.zone !== 'all' || filters.floor !== 'all' || searchInput;

  const deleteMutation = useMutation({
    mutationFn: (id: number) => servicesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount / 100);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
  };

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('service', true)}</h1>
        <p className="text-sm text-gray-500">{data?.services?.length || 0} {t('service', true).toLowerCase()} configurés</p>
      </div>
      <div className="space-y-6">
        {/* Header with search */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md" ref={searchRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
            <Input
              type="search"
              placeholder={`Rechercher un ${t('service').toLowerCase()}...`}
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              className="pl-10"
            />
            {/* Suggestions dropdown */}
            {showSuggestions && suggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                {suggestions.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => {
                      setSearchInput(service.nom);
                      setShowSuggestions(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 border-b last:border-0"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 truncate">{service.nom}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(service.prix)} • {formatDuration(service.duree)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            onClick={() => setShowNewModal(true)}
            className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
          >
            <Plus className="h-4 w-4" />
            Nouveau {t('service').toLowerCase()}
          </Button>
        </div>

        {/* Filters - adaptatifs selon business type */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="w-4 h-4 text-gray-400" />

            {/* Salon/Service domicile: Prix + Durée */}
            {(isBusinessType('salon') || isBusinessType('service_domicile')) && (
              <>
                {/* Price range filter */}
                <select
                  value={filters.priceRange}
                  onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="all">Tous les prix</option>
                  <option value="cheap">&lt; 25€</option>
                  <option value="medium">25€ - 50€</option>
                  <option value="expensive">&gt; 50€</option>
                </select>

                {/* Duration filter */}
                <select
                  value={filters.duration}
                  onChange={(e) => setFilters({ ...filters, duration: e.target.value })}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="all">Toutes les durées</option>
                  <option value="short">&lt; 30 min</option>
                  <option value="medium">30 - 60 min</option>
                  <option value="long">&gt; 60 min</option>
                </select>
              </>
            )}

            {/* Restaurant: Capacité + Zone */}
            {isBusinessType('restaurant') && (
              <>
                {/* Capacity filter */}
                <select
                  value={filters.capacity}
                  onChange={(e) => setFilters({ ...filters, capacity: e.target.value })}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="all">Toutes capacités</option>
                  <option value="small">1-2 places</option>
                  <option value="medium">3-4 places</option>
                  <option value="large">5+ places</option>
                </select>

                {/* Zone filter */}
                <select
                  value={filters.zone}
                  onChange={(e) => setFilters({ ...filters, zone: e.target.value })}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="all">Toutes zones</option>
                  <option value="interieur">Intérieur</option>
                  <option value="terrasse">Terrasse</option>
                  <option value="prive">Privé</option>
                </select>
              </>
            )}

            {/* Hotel: Capacité + Étage + Prix */}
            {isBusinessType('hotel') && (
              <>
                {/* Capacity filter */}
                <select
                  value={filters.capacity}
                  onChange={(e) => setFilters({ ...filters, capacity: e.target.value })}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="all">Toutes capacités</option>
                  <option value="small">1-2 pers.</option>
                  <option value="medium">3-4 pers.</option>
                  <option value="large">5+ pers.</option>
                </select>

                {/* Price range filter */}
                <select
                  value={filters.priceRange}
                  onChange={(e) => setFilters({ ...filters, priceRange: e.target.value })}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="all">Tous les prix</option>
                  <option value="cheap">&lt; 100€/nuit</option>
                  <option value="medium">100-200€/nuit</option>
                  <option value="expensive">&gt; 200€/nuit</option>
                </select>
              </>
            )}

            {/* Status filter - pour tous */}
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 bg-white border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">{isBusinessType('restaurant') ? 'Disponibles' : 'Actifs'}</option>
              <option value="inactive">{isBusinessType('restaurant') ? 'Indisponibles' : 'Inactifs'}</option>
            </select>

            {hasActiveFilters && (
              <Button onClick={resetFilters} variant="outline" size="sm">
                <RotateCcw className="w-4 h-4 mr-1" />
                Reset
              </Button>
            )}

            {hasActiveFilters && (
              <span className="text-sm text-gray-500">
                {filteredServices.length} / {data?.services?.length || 0} {t('service', true).toLowerCase()}
              </span>
            )}
          </div>
        </Card>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-600" />
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6 flex items-center gap-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <div>
                <p className="font-medium text-red-900">Erreur de chargement</p>
                <p className="text-sm text-red-700">Impossible de charger les services</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Services grid */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServices.map((service) => (
              <Card
                key={service.id}
                className={cn(
                  'relative overflow-hidden transition-all hover:shadow-lg cursor-pointer',
                  !service.actif && 'opacity-60'
                )}
                onClick={() => setSelectedService(service)}
              >
                {/* Status indicator */}
                <div className={cn(
                  'absolute top-0 left-0 right-0 h-1',
                  'bg-gradient-to-r from-cyan-400 to-blue-500'
                )} />

                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">{service.nom}</h3>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setSelectedService(service)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setEditingService(service)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (confirm('Supprimer ce service ?')) {
                            deleteMutation.mutate(service.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {service.description && (
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{service.description}</p>
                  )}

                  <div className="flex items-center gap-6">
                    {/* Salon / Service domicile: Durée + Prix */}
                    {(isBusinessType('salon') || isBusinessType('service_domicile')) && (
                      <>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Clock className="h-4 w-4 text-cyan-500" />
                          <span className="text-sm font-medium">{formatDuration(service.duree)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-900">
                          <Euro className="h-4 w-4 text-green-500" />
                          <span className="text-lg font-bold">{formatCurrency(service.prix)}</span>
                        </div>
                      </>
                    )}

                    {/* Restaurant: Capacité + Zone */}
                    {isBusinessType('restaurant') && (
                      <>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Users className="h-4 w-4 text-cyan-500" />
                          <span className="text-sm font-medium">{(service as any).capacite || 4} places</span>
                        </div>
                        {(service as any).zone && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Badge variant="outline" className="text-xs">
                              {(service as any).zone}
                            </Badge>
                          </div>
                        )}
                      </>
                    )}

                    {/* Hotel: Capacité + Prix/nuit */}
                    {isBusinessType('hotel') && (
                      <>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Users className="h-4 w-4 text-cyan-500" />
                          <span className="text-sm font-medium">{(service as any).capacite_max || 2} pers.</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-900">
                          <Euro className="h-4 w-4 text-green-500" />
                          <span className="text-lg font-bold">{formatCurrency(service.prix)}/nuit</span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {filteredServices.length === 0 && hasActiveFilters && (
              <Card className="col-span-full">
                <CardContent className="p-12 text-center">
                  <Search className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Aucun {t('service').toLowerCase()} trouvé avec ces filtres</p>
                  <Button
                    variant="link"
                    onClick={resetFilters}
                    className="mt-2"
                  >
                    Effacer les filtres
                  </Button>
                </CardContent>
              </Card>
            )}

            {filteredServices.length === 0 && !hasActiveFilters && (
              <Card className="col-span-full">
                <CardContent className="p-12 text-center">
                  {isBusinessType('restaurant') ? (
                    <UtensilsCrossed className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  ) : isBusinessType('hotel') ? (
                    <Bed className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  ) : (
                    <Briefcase className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  )}
                  <p className="text-gray-500">
                    {isBusinessType('restaurant')
                      ? 'Aucune table configurée'
                      : isBusinessType('hotel')
                        ? 'Aucune chambre configurée'
                        : `Aucun ${t('service').toLowerCase()} configuré`
                    }
                  </p>
                  <Button
                    variant="link"
                    onClick={() => setShowNewModal(true)}
                    className="mt-2"
                  >
                    {isBusinessType('restaurant')
                      ? 'Créer votre première table'
                      : isBusinessType('hotel')
                        ? 'Créer votre première chambre'
                        : `Créer votre premier ${t('service').toLowerCase()}`
                    }
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      {(showNewModal || editingService) && (
        <ServiceModal
          service={editingService}
          onClose={() => {
            setShowNewModal(false);
            setEditingService(null);
          }}
        />
      )}

      {/* Detail Modal */}
      {selectedService && (
        <ServiceDetailModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
          onEdit={() => {
            setEditingService(selectedService);
            setSelectedService(null);
          }}
        />
      )}
    </div>
  );
}

// Taux de TVA courants en France
const TAUX_TVA = [
  { value: 20, label: '20% (normal)' },
  { value: 10, label: '10% (intermédiaire)' },
  { value: 5.5, label: '5,5% (réduit)' },
  { value: 2.1, label: '2,1% (super réduit)' },
  { value: 0, label: '0% (exonéré)' },
];

// Service Modal Component
function ServiceModal({ service, onClose }: { service: Service | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { t, isPricingMode, getPricingModes, hasFeature, isBusinessType } = useProfile();
  const isEditing = !!service;

  // Mode de pricing actuel
  const pricingModes = getPricingModes();
  const defaultPricingMode = isPricingMode('hourly') ? 'hourly' : isPricingMode('daily') ? 'daily' : 'fixed';

  const [formData, setFormData] = useState({
    nom: service?.nom || '',
    description: service?.description || '',
    duree: service?.duree || 60,
    prix: service ? service.prix / 100 : 0,
    taux_horaire: service?.taux_horaire ? service.taux_horaire / 100 : 0,
    pricing_mode: (service?.pricing_mode || defaultPricingMode) as 'fixed' | 'hourly' | 'daily' | 'package',
    actif: service?.actif ?? true,
    taux_tva: service?.taux_tva ?? 20,
    taxe_cnaps: service?.taxe_cnaps ?? false,
    taux_cnaps: service?.taux_cnaps ?? 0.50,
    categorie: service?.categorie || '',
    // Restaurant specific
    capacite: (service as any)?.capacite || 4,
    zone: (service as any)?.zone || 'interieur',
    // Hotel specific
    etage: (service as any)?.etage || 0,
    capacite_max: (service as any)?.capacite_max || 2,
    equipements: (service as any)?.equipements || [],
    vue: (service as any)?.vue || '',
  });
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: { nom: string; description?: string; duree: number; prix: number }) =>
      servicesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Service>) =>
      servicesApi.update(service!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Données de base
    const data: any = {
      nom: formData.nom,
      description: formData.description || undefined,
      actif: formData.actif,
    };

    // Salon / Service domicile: durée + prix + TVA
    if (isBusinessType('salon') || isBusinessType('service_domicile')) {
      data.duree = formData.duree;
      data.prix = Math.round(formData.prix * 100);
      data.taux_horaire = formData.pricing_mode === 'hourly' ? Math.round(formData.taux_horaire * 100) : undefined;
      data.pricing_mode = formData.pricing_mode;
      data.taux_tva = formData.taux_tva;
      data.taxe_cnaps = formData.taxe_cnaps;
      data.taux_cnaps = formData.taux_cnaps;
      data.categorie = formData.categorie || undefined;
    }

    // Restaurant: capacité + zone (pas de prix)
    if (isBusinessType('restaurant')) {
      data.capacite = formData.capacite;
      data.zone = formData.zone;
      data.categorie = formData.categorie || undefined;
      // Tables n'ont pas de prix ni durée
      data.prix = 0;
      data.duree = 0;
    }

    // Hotel: capacité + étage + prix/nuit + équipements
    if (isBusinessType('hotel')) {
      data.capacite_max = formData.capacite_max;
      data.etage = formData.etage;
      data.equipements = formData.equipements;
      data.vue = formData.vue;
      data.prix = Math.round(formData.prix * 100); // Prix par nuit
      data.pricing_mode = 'daily';
      data.duree = 0; // Pas de durée fixe
      data.categorie = formData.categorie || undefined;
    }

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between flex-shrink-0">
          <CardTitle>{isEditing ? `Modifier le ${t('service').toLowerCase()}` : `Nouveau ${t('service').toLowerCase()}`}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du {t('service').toLowerCase()} *</label>
              <Input
                value={formData.nom}
                onChange={(e) => setFormData(d => ({ ...d, nom: e.target.value }))}
                placeholder="Ex: Coupe femme"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(d => ({ ...d, description: e.target.value }))}
                placeholder={isBusinessType('restaurant') ? "Description de la table..." : isBusinessType('hotel') ? "Description de la chambre..." : "Description du service..."}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                rows={3}
              />
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                SALON / SERVICE DOMICILE: Durée + Prix + TVA + CNAPS
            ═══════════════════════════════════════════════════════════════ */}
            {(isBusinessType('salon') || isBusinessType('service_domicile')) && (
              <>
                {/* Durée */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('duration')} (minutes) *</label>
                  <Input
                    type="number"
                    min={5}
                    step={5}
                    value={formData.duree}
                    onChange={(e) => setFormData(d => ({ ...d, duree: parseInt(e.target.value) || 0 }))}
                    required
                  />
                </div>

                {/* Tarification avec mode adaptatif */}
                <PricingFields
                  value={formData.prix}
                  onChange={(prix) => setFormData(d => ({ ...d, prix }))}
                  tauxHoraire={formData.taux_horaire}
                  onTauxHoraireChange={(taux) => setFormData(d => ({ ...d, taux_horaire: taux }))}
                  allowModeSwitch={pricingModes.length > 1}
                  currentMode={formData.pricing_mode}
                  onModeChange={(mode) => setFormData(d => ({ ...d, pricing_mode: mode }))}
                />

                {/* TVA */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Taux de TVA</label>
                  <select
                    value={formData.taux_tva}
                    onChange={(e) => setFormData(d => ({ ...d, taux_tva: parseFloat(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    {TAUX_TVA.map((taux) => (
                      <option key={taux.value} value={taux.value}>{taux.label}</option>
                    ))}
                  </select>
                </div>

                {/* Catégorie */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                  <Input
                    value={formData.categorie}
                    onChange={(e) => setFormData(d => ({ ...d, categorie: e.target.value }))}
                    placeholder="Ex: Coiffure, Sécurité, etc."
                  />
                </div>

                {/* Taxe CNAPS (Sécurité privée) */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm text-amber-900">Taxe CNAPS</p>
                      <p className="text-xs text-amber-700">Pour les activités de sécurité privée uniquement</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData(d => ({ ...d, taxe_cnaps: !d.taxe_cnaps }))}
                      className={cn(
                        'w-12 h-6 rounded-full transition-colors relative',
                        formData.taxe_cnaps ? 'bg-amber-500' : 'bg-gray-300'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow',
                        formData.taxe_cnaps ? 'translate-x-6' : 'translate-x-0.5'
                      )} />
                    </button>
                  </div>

                  {formData.taxe_cnaps && (
                    <div>
                      <label className="block text-xs font-medium text-amber-800 mb-1">Taux CNAPS (%)</label>
                      <Input
                        type="number"
                        min={0}
                        max={5}
                        step={0.01}
                        value={formData.taux_cnaps}
                        onChange={(e) => setFormData(d => ({ ...d, taux_cnaps: parseFloat(e.target.value) || 0 }))}
                        className="bg-white"
                      />
                      <p className="text-xs text-amber-600 mt-1">
                        Taux historique : 0,40% à 0,50% (supprimée depuis 01/2020)
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                RESTAURANT: Capacité + Zone (pas de prix ni durée)
            ═══════════════════════════════════════════════════════════════ */}
            {isBusinessType('restaurant') && (
              <>
                {/* Capacité */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Capacité (places) *</label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={formData.capacite}
                    onChange={(e) => setFormData(d => ({ ...d, capacite: parseInt(e.target.value) || 1 }))}
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Nombre de couverts maximum pour cette table</p>
                </div>

                {/* Zone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
                  <select
                    value={formData.zone}
                    onChange={(e) => setFormData(d => ({ ...d, zone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="interieur">Intérieur</option>
                    <option value="terrasse">Terrasse</option>
                    <option value="prive">Salon privé</option>
                    <option value="bar">Bar</option>
                  </select>
                </div>

                {/* Catégorie */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catégorie</label>
                  <Input
                    value={formData.categorie}
                    onChange={(e) => setFormData(d => ({ ...d, categorie: e.target.value }))}
                    placeholder="Ex: Standard, VIP, etc."
                  />
                </div>
              </>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                HOTEL: Capacité + Étage + Prix/nuit + Équipements
            ═══════════════════════════════════════════════════════════════ */}
            {isBusinessType('hotel') && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {/* Capacité max */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Capacité max *</label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={formData.capacite_max}
                      onChange={(e) => setFormData(d => ({ ...d, capacite_max: parseInt(e.target.value) || 1 }))}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Personnes</p>
                  </div>

                  {/* Étage */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Étage</label>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      value={formData.etage}
                      onChange={(e) => setFormData(d => ({ ...d, etage: parseInt(e.target.value) || 0 }))}
                    />
                    <p className="text-xs text-gray-500 mt-1">0 = RDC</p>
                  </div>
                </div>

                {/* Prix par nuit */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prix par nuit (€) *</label>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    value={formData.prix}
                    onChange={(e) => setFormData(d => ({ ...d, prix: parseFloat(e.target.value) || 0 }))}
                    required
                  />
                </div>

                {/* Vue */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vue</label>
                  <select
                    value={formData.vue}
                    onChange={(e) => setFormData(d => ({ ...d, vue: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                  >
                    <option value="">Non spécifié</option>
                    <option value="mer">Mer</option>
                    <option value="montagne">Montagne</option>
                    <option value="jardin">Jardin</option>
                    <option value="piscine">Piscine</option>
                    <option value="ville">Ville</option>
                    <option value="cour">Cour intérieure</option>
                  </select>
                </div>

                {/* Équipements */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Équipements</label>
                  <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg">
                    {['WiFi', 'TV', 'Climatisation', 'Minibar', 'Coffre-fort', 'Balcon', 'Baignoire', 'Douche'].map(equip => (
                      <label key={equip} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.equipements.includes(equip)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(d => ({ ...d, equipements: [...d.equipements, equip] }));
                            } else {
                              setFormData(d => ({ ...d, equipements: d.equipements.filter((eq: string) => eq !== equip) }));
                            }
                          }}
                          className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        {equip}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Catégorie */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type de chambre</label>
                  <Input
                    value={formData.categorie}
                    onChange={(e) => setFormData(d => ({ ...d, categorie: e.target.value }))}
                    placeholder="Ex: Standard, Suite, Deluxe, etc."
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium text-sm">Service actif</p>
                <p className="text-xs text-gray-500">Visible et réservable par les clients</p>
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

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Annuler
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600"
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isEditing ? (
                  'Enregistrer'
                ) : (
                  `Créer le ${t('service').toLowerCase()}`
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Service Detail Modal Component
interface ServiceDetailResponse {
  service: Service;
  stats: {
    ca_total: number;
    nb_rdv_total: number;
    nb_rdv_termines: number;
    nb_rdv_annules: number;
    nb_clients_uniques: number;
    derniere_reservation: string | null;
  };
  top_clients: Array<{ id: number; prenom: string; nom: string; nb_rdv: number }>;
  historique_rdv: Array<{
    id: number;
    date: string;
    heure: string;
    statut: string;
    prix_total: number;
    client_nom: string;
  }>;
}

function ServiceDetailModal({
  service,
  onClose,
  onEdit
}: {
  service: Service;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { data, isLoading } = useQuery<ServiceDetailResponse>({
    queryKey: ['service-detail', service.id],
    queryFn: () => servicesApi.get(service.id),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}` : `${hours}h`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white">
              <Briefcase className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>{service.nom}</CardTitle>
              <p className="text-sm text-gray-500">
                {formatCurrency(service.prix / 100)} • {formatDuration(service.duree)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-1" />
              Modifier
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-700">{formatCurrency(data.stats.ca_total)}</p>
                  <p className="text-xs text-green-600">CA Total</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-700">{data.stats.nb_rdv_total}</p>
                  <p className="text-xs text-blue-600">Prestations</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-purple-700">{data.stats.nb_rdv_termines}</p>
                  <p className="text-xs text-purple-600">Terminées</p>
                </div>
                <div className="bg-cyan-50 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-cyan-700">{data.stats.nb_clients_uniques}</p>
                  <p className="text-xs text-cyan-600">Clients Uniques</p>
                </div>
              </div>

              {/* Dernière réservation */}
              {data.stats.derniere_reservation && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700">
                    <Calendar className="h-4 w-4 inline mr-2 text-gray-500" />
                    <span className="font-medium">Dernière réservation :</span> {formatDate(data.stats.derniere_reservation)}
                  </p>
                </div>
              )}

              {/* Top clients */}
              {data.top_clients && data.top_clients.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Clients les plus fidèles
                  </h3>
                  <div className="space-y-2">
                    {data.top_clients.map((client, index) => (
                      <div key={client.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-semibold">
                            {client.prenom[0]}{client.nom[0]}
                          </div>
                          <p className="font-medium text-sm">{client.prenom} {client.nom}</p>
                        </div>
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {client.nb_rdv} prestations
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Historique Prestations */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Dernières réservations
                </h3>
                <div className="space-y-2">
                  {data.historique_rdv.map((rdv) => (
                    <div key={rdv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{rdv.client_nom}</p>
                        <p className="text-xs text-gray-500">{formatDate(rdv.date)} à {rdv.heure}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">
                          {formatCurrency(rdv.prix_total / 100)}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            rdv.statut === 'termine' && 'bg-green-50 text-green-700 border-green-200',
                            rdv.statut === 'confirme' && 'bg-blue-50 text-blue-700 border-blue-200',
                            rdv.statut === 'annule' && 'bg-red-50 text-red-700 border-red-200'
                          )}
                        >
                          {rdv.statut}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {data.historique_rdv.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">Aucune réservation</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
