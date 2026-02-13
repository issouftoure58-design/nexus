import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/layout/Layout';
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
  Power
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Services() {
  const queryClient = useQueryClient();
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['services'],
    queryFn: servicesApi.list,
  });

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
    <Layout title="Services" subtitle={`${data?.services?.length || 0} services configurés`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500">
            Gérez les services proposés à vos clients
          </div>
          <Button
            onClick={() => setShowNewModal(true)}
            className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
          >
            <Plus className="h-4 w-4" />
            Nouveau service
          </Button>
        </div>

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
            {data?.services?.map((service) => (
              <Card key={service.id} className={cn(
                'relative overflow-hidden transition-all hover:shadow-lg',
                !service.actif && 'opacity-60'
              )}>
                {/* Status indicator */}
                <div className={cn(
                  'absolute top-0 left-0 right-0 h-1',
                  service.actif ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gray-300'
                )} />

                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">{service.nom}</h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          'mt-1',
                          service.actif
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-50 text-gray-500 border-gray-200'
                        )}
                      >
                        {service.actif ? 'Actif' : 'Inactif'}
                      </Badge>
                    </div>
                    <div className="flex gap-1">
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
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="h-4 w-4 text-cyan-500" />
                      <span className="text-sm font-medium">{formatDuration(service.duree)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-900">
                      <Euro className="h-4 w-4 text-green-500" />
                      <span className="text-lg font-bold">{formatCurrency(service.prix)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {(!data?.services || data.services.length === 0) && (
              <Card className="col-span-full">
                <CardContent className="p-12 text-center">
                  <Briefcase className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500">Aucun service configuré</p>
                  <Button
                    variant="link"
                    onClick={() => setShowNewModal(true)}
                    className="mt-2"
                  >
                    Créer votre premier service
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* New/Edit Modal */}
      {(showNewModal || editingService) && (
        <ServiceModal
          service={editingService}
          onClose={() => {
            setShowNewModal(false);
            setEditingService(null);
          }}
        />
      )}
    </Layout>
  );
}

// Service Modal Component
function ServiceModal({ service, onClose }: { service: Service | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEditing = !!service;

  const [formData, setFormData] = useState({
    nom: service?.nom || '',
    description: service?.description || '',
    duree: service?.duree || 60,
    prix: service ? service.prix / 100 : 0,
    actif: service?.actif ?? true,
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

    const data = {
      nom: formData.nom,
      description: formData.description || undefined,
      duree: formData.duree,
      prix: Math.round(formData.prix * 100), // Convert to cents
      actif: formData.actif,
    };

    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{isEditing ? 'Modifier le service' : 'Nouveau service'}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du service *</label>
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
                placeholder="Description du service..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Durée (minutes) *</label>
                <Input
                  type="number"
                  min={5}
                  step={5}
                  value={formData.duree}
                  onChange={(e) => setFormData(d => ({ ...d, duree: parseInt(e.target.value) || 0 }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix (€) *</label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={formData.prix}
                  onChange={(e) => setFormData(d => ({ ...d, prix: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </div>
            </div>

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
                  'Créer le service'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
