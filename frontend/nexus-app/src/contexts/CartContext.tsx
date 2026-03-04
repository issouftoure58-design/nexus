import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Types
export interface CartItem {
  id: string;
  serviceNom: string;
  description: string;
  duree: number; // minutes
  prix: number; // euros (pour affichage)
  blocksDays?: number; // nombre de jours pour prestations multi-jours (défaut: 1)
}

export interface CartState {
  items: CartItem[];
  lieu: 'domicile' | 'chez_fatou' | null;
  adresse: string;
  dateRdv: string; // YYYY-MM-DD
  heureDebut: string; // HH:MM
  fraisDeplacement: number; // euros
  distanceKm: number;
  dureeTrajet: number; // minutes (temps de trajet aller)
}

interface CartContextType {
  cart: CartState;
  // Actions sur les items
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  // Actions sur les options
  setLieu: (lieu: 'domicile' | 'chez_fatou' | null) => void;
  setAdresse: (adresse: string) => void;
  setDateRdv: (date: string) => void;
  setHeureDebut: (heure: string) => void;
  setFraisDeplacement: (frais: number, distance: number, dureeTrajet?: number) => void;
  // Calculs
  itemCount: number;
  sousTotal: number;
  total: number;
  dureeTotale: number;
  dureeTotaleAvecTrajet: number; // Durée totale + trajet aller si domicile
  blocksDaysTotal: number; // Max blocksDays parmi les items (pour prestations multi-jours)
  // Utilitaires
  isInCart: (serviceNom: string) => boolean;
  resetCheckoutData: () => void;
}

const STORAGE_KEY = 'fatsHairAfro_cart';

const defaultCartState: CartState = {
  items: [],
  lieu: null,
  adresse: '',
  dateRdv: '',
  heureDebut: '',
  fraisDeplacement: 0,
  distanceKm: 0,
  dureeTrajet: 0,
};

const CartContext = createContext<CartContextType | null>(null);

// Génère un ID unique pour chaque item
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Charge le panier depuis localStorage
function loadCartFromStorage(): CartState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultCartState, ...parsed };
    }
  } catch (error) {
    console.error('Erreur chargement panier:', error);
  }
  return defaultCartState;
}

// Sauvegarde le panier dans localStorage
function saveCartToStorage(cart: CartState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  } catch (error) {
    console.error('Erreur sauvegarde panier:', error);
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartState>(defaultCartState);
  const [isInitialized, setIsInitialized] = useState(false);

  // Charger le panier au montage
  useEffect(() => {
    const stored = loadCartFromStorage();
    setCart(stored);
    setIsInitialized(true);
  }, []);

  // Sauvegarder à chaque changement
  useEffect(() => {
    if (isInitialized) {
      saveCartToStorage(cart);
    }
  }, [cart, isInitialized]);

  // Ajouter un item
  const addItem = (item: Omit<CartItem, 'id'>) => {
    const newItem: CartItem = {
      ...item,
      id: generateId(),
    };
    setCart(prev => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  // Supprimer un item
  const removeItem = (id: string) => {
    setCart(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id),
    }));
  };

  // Vider le panier
  const clearCart = () => {
    setCart(defaultCartState);
    localStorage.removeItem(STORAGE_KEY);
  };

  // Définir le lieu
  const setLieu = (lieu: 'domicile' | 'chez_fatou' | null) => {
    setCart(prev => ({
      ...prev,
      lieu,
      // Reset frais et trajet si chez Fatou
      fraisDeplacement: lieu === 'chez_fatou' ? 0 : prev.fraisDeplacement,
      distanceKm: lieu === 'chez_fatou' ? 0 : prev.distanceKm,
      dureeTrajet: lieu === 'chez_fatou' ? 0 : prev.dureeTrajet,
      adresse: lieu === 'chez_fatou' ? '' : prev.adresse,
    }));
  };

  // Définir l'adresse
  const setAdresse = (adresse: string) => {
    setCart(prev => ({ ...prev, adresse }));
  };

  // Définir la date
  const setDateRdv = (dateRdv: string) => {
    setCart(prev => ({ ...prev, dateRdv }));
  };

  // Définir l'heure
  const setHeureDebut = (heureDebut: string) => {
    setCart(prev => ({ ...prev, heureDebut }));
  };

  // Définir les frais de déplacement et la durée de trajet
  const setFraisDeplacement = (frais: number, distance: number, dureeTrajet?: number) => {
    setCart(prev => ({
      ...prev,
      fraisDeplacement: frais,
      distanceKm: distance,
      dureeTrajet: dureeTrajet ?? prev.dureeTrajet,
    }));
  };

  // Reset données checkout (garde les items)
  const resetCheckoutData = () => {
    setCart(prev => ({
      ...prev,
      lieu: null,
      adresse: '',
      dateRdv: '',
      heureDebut: '',
      fraisDeplacement: 0,
      distanceKm: 0,
      dureeTrajet: 0,
    }));
  };

  // Vérifier si un service est dans le panier
  const isInCart = (serviceNom: string): boolean => {
    return cart.items.some(
      item => item.serviceNom.toLowerCase() === serviceNom.toLowerCase()
    );
  };

  // Calculs
  const itemCount = cart.items.length;

  const sousTotal = cart.items.reduce((sum, item) => sum + item.prix, 0);

  const total = sousTotal + cart.fraisDeplacement;

  const dureeTotale = cart.items.reduce((sum, item) => sum + item.duree, 0);

  // Durée totale avec trajet aller si domicile (pour vérifier les créneaux)
  const dureeTotaleAvecTrajet = cart.lieu === 'domicile' && cart.dureeTrajet > 0
    ? dureeTotale + cart.dureeTrajet
    : dureeTotale;

  // Max blocksDays parmi les items (pour prestations multi-jours comme microlocks)
  const blocksDaysTotal = cart.items.reduce(
    (max, item) => Math.max(max, item.blocksDays || 1),
    1
  );

  const value: CartContextType = {
    cart,
    addItem,
    removeItem,
    clearCart,
    setLieu,
    setAdresse,
    setDateRdv,
    setHeureDebut,
    setFraisDeplacement,
    itemCount,
    sousTotal,
    total,
    dureeTotale,
    dureeTotaleAvecTrajet,
    blocksDaysTotal,
    isInCart,
    resetCheckoutData,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

// Hook pour utiliser le panier
export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart doit être utilisé dans un CartProvider');
  }
  return context;
}
