/**
 * CheckoutModal - Modal d'encaissement restaurant
 * Permet au staff de selectionner les plats consommes et d'encaisser a la cloture de table
 */

import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Minus, X, CreditCard, Banknote, FileText } from 'lucide-react';
import { api } from '../../lib/api';
import { formatCurrency } from './types';
import type { Reservation, CheckoutItem } from './types';

interface CheckoutModalProps {
  reservation: Reservation;
  onConfirm: (data: { items: CheckoutItem[]; total: number; mode_paiement: string }) => void;
  onClose: () => void;
}

interface Plat {
  id: number;
  nom: string;
  prix: number; // en centimes
  categorie_id: number;
  actif: boolean;
  menu_categories?: { id: number; nom: string } | null;
}

interface Categorie {
  id: number;
  nom: string;
}

const MODES_PAIEMENT_RESTAURANT = [
  { value: 'cb', label: 'Carte', icon: CreditCard },
  { value: 'especes', label: 'Especes', icon: Banknote },
  { value: 'cheque', label: 'Cheque', icon: FileText },
];

export default function CheckoutModal({ reservation, onConfirm, onClose }: CheckoutModalProps) {
  const [plats, setPlats] = useState<Plat[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [items, setItems] = useState<Map<number, CheckoutItem>>(new Map());
  const [search, setSearch] = useState('');
  const [activeCategorie, setActiveCategorie] = useState<number | null>(null);
  const [modePaiement, setModePaiement] = useState('');
  const [loading, setLoading] = useState(true);

  // Charger plats et categories
  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const [platsRes, catsRes] = await Promise.all([
          api.get<{ plats: Plat[] }>('/admin/menu/plats?actif=true'),
          api.get<{ categories: Categorie[] }>('/admin/menu/categories'),
        ]);
        setPlats(platsRes.plats || []);
        setCategories(catsRes.categories || []);
      } catch (err) {
        console.error('[CheckoutModal] Erreur chargement menu:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
  }, []);

  // Filtrer les plats
  const filteredPlats = useMemo(() => {
    let result = plats;
    if (activeCategorie) {
      result = result.filter(p => p.categorie_id === activeCategorie);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p => p.nom.toLowerCase().includes(q));
    }
    return result;
  }, [plats, activeCategorie, search]);

  // Grouper les plats filtres par categorie
  const platsByCategorie = useMemo(() => {
    const map = new Map<string, Plat[]>();
    for (const plat of filteredPlats) {
      const catNom = plat.menu_categories?.nom || 'Autres';
      if (!map.has(catNom)) map.set(catNom, []);
      map.get(catNom)!.push(plat);
    }
    return map;
  }, [filteredPlats]);

  // Total en centimes
  const total = useMemo(() => {
    let sum = 0;
    items.forEach(item => { sum += item.prix_unitaire * item.quantite; });
    return sum;
  }, [items]);

  const addItem = (plat: Plat) => {
    setItems(prev => {
      const next = new Map(prev);
      const existing = next.get(plat.id);
      if (existing) {
        next.set(plat.id, { ...existing, quantite: existing.quantite + 1 });
      } else {
        next.set(plat.id, {
          plat_id: plat.id,
          nom: plat.nom,
          prix_unitaire: plat.prix,
          quantite: 1,
        });
      }
      return next;
    });
  };

  const removeItem = (platId: number) => {
    setItems(prev => {
      const next = new Map(prev);
      const existing = next.get(platId);
      if (existing && existing.quantite > 1) {
        next.set(platId, { ...existing, quantite: existing.quantite - 1 });
      } else {
        next.delete(platId);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const itemsArray = Array.from(items.values());
    onConfirm({ items: itemsArray, total, mode_paiement: modePaiement });
  };

  const canSubmit = total > 0 && modePaiement !== '';

  // Info reservation
  const tableName = reservation.service_nom || 'Table';
  const nbCouverts = reservation.nb_couverts || 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Encaissement — {tableName}
            </h2>
            {nbCouverts > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{nbCouverts} couverts</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <>
              {/* Recherche */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un plat..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Filtres categories */}
              {categories.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setActiveCategorie(null)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                      activeCategorie === null
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    Tous
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategorie(cat.id === activeCategorie ? null : cat.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                        activeCategorie === cat.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {cat.nom}
                    </button>
                  ))}
                </div>
              )}

              {/* Liste des plats par categorie */}
              <div className="space-y-3 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                {platsByCategorie.size === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">Aucun plat trouve</p>
                ) : (
                  Array.from(platsByCategorie.entries()).map(([catNom, catPlats]) => (
                    <div key={catNom}>
                      <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                        {catNom}
                      </h4>
                      <div className="space-y-1">
                        {catPlats.map(plat => {
                          const qty = items.get(plat.id)?.quantite || 0;
                          return (
                            <div
                              key={plat.id}
                              className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-gray-900 dark:text-white">{plat.nom}</span>
                                <span className="ml-2 text-sm text-gray-500">{formatCurrency(plat.prix / 100)}</span>
                              </div>
                              <div className="flex items-center gap-1 ml-2">
                                {qty > 0 && (
                                  <>
                                    <button
                                      onClick={() => removeItem(plat.id)}
                                      className="p-1 rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200"
                                    >
                                      <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="w-6 text-center text-sm font-medium">{qty}</span>
                                  </>
                                )}
                                <button
                                  onClick={() => addItem(plat)}
                                  className="p-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Articles selectionnes */}
              {items.size > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Articles selectionnes</h4>
                  {Array.from(items.values()).map(item => (
                    <div key={item.plat_id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-900 dark:text-white">
                        {item.quantite}x {item.nom}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 dark:text-gray-400">
                          {formatCurrency((item.prix_unitaire * item.quantite) / 100)}
                        </span>
                        <button
                          onClick={() => removeItem(item.plat_id)}
                          className="p-0.5 rounded text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-gray-300 dark:border-gray-600 pt-2 mt-2 flex justify-between font-semibold">
                    <span className="text-gray-900 dark:text-white">TOTAL</span>
                    <span className="text-gray-900 dark:text-white">{formatCurrency(total / 100)}</span>
                  </div>
                </div>
              )}

              {/* Mode de paiement */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mode de paiement</h4>
                <div className="flex gap-2">
                  {MODES_PAIEMENT_RESTAURANT.map(mode => {
                    const Icon = mode.icon;
                    const isActive = modePaiement === mode.value;
                    return (
                      <button
                        key={mode.value}
                        onClick={() => setModePaiement(mode.value)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition ${
                          isActive
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
              canSubmit
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            Encaisser {total > 0 ? formatCurrency(total / 100) : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
