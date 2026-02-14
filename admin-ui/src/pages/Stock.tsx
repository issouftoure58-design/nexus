import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { stockApi, type Product } from '@/lib/api';
import {
  Package,
  Plus,
  Edit,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  AlertTriangle,
  TrendingDown,
  Euro
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Stock() {
  const queryClient = useQueryClient();
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['stock'],
    queryFn: stockApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => stockApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount / 100);
  };

  // Count low stock items
  const lowStockCount = data?.produits?.filter(p => p.quantite <= p.seuil_alerte).length || 0;
  const totalValue = data?.produits?.reduce((sum, p) => sum + (p.quantite * p.prix_achat), 0) || 0;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stock</h1>
        <p className="text-sm text-gray-500">{data?.produits?.length || 0} produits en stock</p>
      </div>
      <div className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total produits</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {data?.produits?.length || 0}
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={cn(lowStockCount > 0 && 'border-orange-200 bg-orange-50/50')}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Stock faible</p>
                  <p className={cn(
                    "text-3xl font-bold mt-1",
                    lowStockCount > 0 ? 'text-orange-600' : 'text-gray-900'
                  )}>
                    {lowStockCount}
                  </p>
                </div>
                <div className={cn(
                  "p-3 rounded-xl",
                  lowStockCount > 0 ? 'bg-orange-100' : 'bg-gray-100'
                )}>
                  <AlertTriangle className={cn(
                    "h-6 w-6",
                    lowStockCount > 0 ? 'text-orange-600' : 'text-gray-400'
                  )} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Valeur du stock</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {formatCurrency(totalValue)}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-xl">
                  <Euro className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500">
            Gérez votre inventaire de produits
          </div>
          <Button
            onClick={() => setShowNewModal(true)}
            className="gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
          >
            <Plus className="h-4 w-4" />
            Nouveau produit
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
                <p className="text-sm text-red-700">Impossible de charger le stock</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Products table */}
        {!isLoading && !error && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50/50">
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Produit</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">Quantité</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Prix d'achat</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Prix de vente</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Marge</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.produits?.map((product) => {
                      const isLowStock = product.quantite <= product.seuil_alerte;
                      const margin = product.prix_vente - product.prix_achat;
                      const marginPercent = product.prix_achat > 0 ? (margin / product.prix_achat) * 100 : 0;

                      return (
                        <tr key={product.id} className={cn(
                          'border-b last:border-0 hover:bg-gray-50 transition-colors',
                          isLowStock && 'bg-orange-50/30'
                        )}>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white">
                                <Package className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{product.nom}</p>
                                {product.description && (
                                  <p className="text-sm text-gray-500 truncate max-w-[200px]">
                                    {product.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className={cn(
                                'text-lg font-bold',
                                isLowStock ? 'text-orange-600' : 'text-gray-900'
                              )}>
                                {product.quantite}
                              </span>
                              {isLowStock && (
                                <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Bas
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Seuil: {product.seuil_alerte}</p>
                          </td>
                          <td className="py-4 px-4 text-right text-sm text-gray-600">
                            {formatCurrency(product.prix_achat)}
                          </td>
                          <td className="py-4 px-4 text-right font-semibold">
                            {formatCurrency(product.prix_vente)}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <span className={cn(
                              'font-medium',
                              margin > 0 ? 'text-green-600' : 'text-red-600'
                            )}>
                              {marginPercent.toFixed(0)}%
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setAdjustingProduct(product)}
                                className="h-8"
                              >
                                Ajuster
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setEditingProduct(product)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  if (confirm('Supprimer ce produit ?')) {
                                    deleteMutation.mutate(product.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {(!data?.produits || data.produits.length === 0) && (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-500">
                          <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                          <p>Aucun produit en stock</p>
                          <Button
                            variant="link"
                            onClick={() => setShowNewModal(true)}
                            className="mt-2"
                          >
                            Ajouter votre premier produit
                          </Button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modals */}
      {(showNewModal || editingProduct) && (
        <ProductModal
          product={editingProduct}
          onClose={() => {
            setShowNewModal(false);
            setEditingProduct(null);
          }}
        />
      )}

      {adjustingProduct && (
        <AdjustQuantityModal
          product={adjustingProduct}
          onClose={() => setAdjustingProduct(null)}
        />
      )}
    </div>
  );
}

// Product Modal
function ProductModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const isEditing = !!product;

  const [formData, setFormData] = useState({
    nom: product?.nom || '',
    description: product?.description || '',
    quantite: product?.quantite || 0,
    prix_achat: product ? product.prix_achat / 100 : 0,
    prix_vente: product ? product.prix_vente / 100 : 0,
    seuil_alerte: product?.seuil_alerte || 5,
  });
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: any) => stockApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => stockApi.update(product!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
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
      quantite: formData.quantite,
      prix_achat: Math.round(formData.prix_achat * 100),
      prix_vente: Math.round(formData.prix_vente * 100),
      seuil_alerte: formData.seuil_alerte,
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
          <CardTitle>{isEditing ? 'Modifier le produit' : 'Nouveau produit'}</CardTitle>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom du produit *</label>
              <Input
                value={formData.nom}
                onChange={(e) => setFormData(d => ({ ...d, nom: e.target.value }))}
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
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantité *</label>
                <Input
                  type="number"
                  min={0}
                  value={formData.quantite}
                  onChange={(e) => setFormData(d => ({ ...d, quantite: parseInt(e.target.value) || 0 }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seuil d'alerte</label>
                <Input
                  type="number"
                  min={0}
                  value={formData.seuil_alerte}
                  onChange={(e) => setFormData(d => ({ ...d, seuil_alerte: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix d'achat (€) *</label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={formData.prix_achat}
                  onChange={(e) => setFormData(d => ({ ...d, prix_achat: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prix de vente (€) *</label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={formData.prix_vente}
                  onChange={(e) => setFormData(d => ({ ...d, prix_vente: parseFloat(e.target.value) || 0 }))}
                  required
                />
              </div>
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
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditing ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// Adjust Quantity Modal
function AdjustQuantityModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [adjustment, setAdjustment] = useState(0);
  const [raison, setRaison] = useState('');
  const [error, setError] = useState('');

  const adjustMutation = useMutation({
    mutationFn: () => stockApi.ajusterQuantite(product.id, adjustment, raison),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustment === 0) {
      setError('L\'ajustement ne peut pas être de 0');
      return;
    }
    adjustMutation.mutate();
  };

  const newQuantity = product.quantite + adjustment;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Ajuster le stock</CardTitle>
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

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-1">{product.nom}</p>
              <p className="text-2xl font-bold">
                {product.quantite} → <span className={cn(
                  newQuantity >= 0 ? 'text-green-600' : 'text-red-600'
                )}>{newQuantity}</span>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ajustement</label>
              <Input
                type="number"
                value={adjustment}
                onChange={(e) => setAdjustment(parseInt(e.target.value) || 0)}
                placeholder="Ex: +10 ou -5"
              />
              <p className="text-xs text-gray-500 mt-1">Utilisez un nombre négatif pour réduire le stock</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Raison *</label>
              <Input
                value={raison}
                onChange={(e) => setRaison(e.target.value)}
                placeholder="Ex: Réapprovisionnement, Vente, Perte..."
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Annuler
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600"
                disabled={adjustMutation.isPending || newQuantity < 0}
              >
                {adjustMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmer'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
