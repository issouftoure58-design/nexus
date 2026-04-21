import React, { createContext, useContext, useReducer, useMemo, ReactNode } from 'react';
import { apiFetch } from '@/lib/api-config';

// Types
export interface Service {
  id: string;
  nom: string;
  description?: string;
  duree: number;       // minutes
  prix: number;        // centimes
  blocksDays?: number;
}

export interface ClientInfo {
  nom: string;
  prenom: string;
  telephone: string;
  email?: string;
}

export interface DayAvailability {
  jour: string;
  label: string;
  slots: string[];
  allSlots: string[];
  closed: boolean;
  isPast?: boolean;
}

export interface WeekAvailability {
  [date: string]: DayAvailability;
}

export type BookingStage = 'idle' | 'service' | 'date' | 'client' | 'payment' | 'processing' | 'confirmed' | 'deposit_pending' | 'error';
export type PaymentMethod = 'sur_place' | 'stripe' | 'paypal';

export interface BookingState {
  stage: BookingStage;
  service: Service | null;     // Backward compat — premier service ou null
  services: Service[];          // Multi-service: tous les services sélectionnés
  selectedDate: string | null;
  selectedTime: string | null;
  weekAvailability: WeekAvailability | null;
  weekStartDate: string | null;
  clientInfo: ClientInfo;
  paymentMethod: PaymentMethod | null;
  orderId: string | null;
  error: string | null;
}

// Actions
type BookingAction =
  | { type: 'START_BOOKING' }
  | { type: 'SELECT_SERVICE'; payload: Service }
  | { type: 'TOGGLE_SERVICE'; payload: Service }
  | { type: 'DONE_SELECTING' }
  | { type: 'SET_WEEK_AVAILABILITY'; payload: { week: WeekAvailability; startDate: string } }
  | { type: 'SELECT_DATETIME'; payload: { date: string; time: string } }
  | { type: 'SET_CLIENT_INFO'; payload: ClientInfo }
  | { type: 'SELECT_PAYMENT'; payload: PaymentMethod }
  | { type: 'PROCESSING' }
  | { type: 'CONFIRMED'; payload: string }
  | { type: 'DEPOSIT_PENDING'; payload: string }
  | { type: 'ERROR'; payload: string }
  | { type: 'RESET' }
  | { type: 'GO_BACK' };

// Initial state
const initialState: BookingState = {
  stage: 'idle',
  service: null,
  services: [],
  selectedDate: null,
  selectedTime: null,
  weekAvailability: null,
  weekStartDate: null,
  clientInfo: { nom: '', prenom: '', telephone: '' },
  paymentMethod: null,
  orderId: null,
  error: null,
};

// Reducer
function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  switch (action.type) {
    case 'START_BOOKING':
      return { ...initialState, stage: 'service' };

    case 'SELECT_SERVICE':
      // Backward compat: single select → services array of 1, move to date
      return {
        ...state,
        service: action.payload,
        services: [action.payload],
        stage: 'date',
      };

    case 'TOGGLE_SERVICE': {
      const exists = state.services.find(s => s.id === action.payload.id);
      const newServices = exists
        ? state.services.filter(s => s.id !== action.payload.id)
        : [...state.services, action.payload];
      return {
        ...state,
        services: newServices,
        service: newServices.length > 0 ? newServices[0] : null,
      };
    }

    case 'DONE_SELECTING':
      // Move from service selection to date when ≥1 service selected
      if (state.services.length === 0) return state;
      return {
        ...state,
        stage: 'date',
      };

    case 'SET_WEEK_AVAILABILITY':
      return {
        ...state,
        weekAvailability: action.payload.week,
        weekStartDate: action.payload.startDate,
      };

    case 'SELECT_DATETIME':
      return {
        ...state,
        selectedDate: action.payload.date,
        selectedTime: action.payload.time,
        stage: 'client',
      };

    case 'SET_CLIENT_INFO':
      return {
        ...state,
        clientInfo: action.payload,
        stage: 'payment',
      };

    case 'SELECT_PAYMENT':
      return {
        ...state,
        paymentMethod: action.payload,
      };

    case 'PROCESSING':
      return {
        ...state,
        stage: 'processing',
      };

    case 'CONFIRMED':
      return {
        ...state,
        stage: 'confirmed',
        orderId: action.payload,
      };

    case 'DEPOSIT_PENDING':
      return {
        ...state,
        stage: 'deposit_pending',
        orderId: action.payload,
      };

    case 'ERROR':
      return {
        ...state,
        stage: 'error',
        error: action.payload,
      };

    case 'RESET':
      return initialState;

    case 'GO_BACK':
      switch (state.stage) {
        case 'date':
          return { ...state, stage: 'service', service: null, services: [] };
        case 'client':
          return { ...state, stage: 'date', selectedDate: null, selectedTime: null };
        case 'payment':
          return { ...state, stage: 'client' };
        default:
          return state;
      }

    default:
      return state;
  }
}

// Context type
interface BookingContextType extends BookingState {
  startBooking: () => void;
  selectService: (service: Service) => void;
  toggleService: (service: Service) => void;
  doneSelecting: () => void;
  fetchWeekAvailability: (startDate: string) => Promise<void>;
  selectDateTime: (date: string, time: string) => void;
  setClientInfo: (info: ClientInfo) => void;
  selectPaymentMethod: (method: PaymentMethod) => void;
  createOrder: (paiementId?: string, paymentMethodOverride?: PaymentMethod) => Promise<void>;
  resetBooking: () => void;
  goBack: () => void;
  formatPrice: (cents: number) => string;
  formatDuration: (minutes: number) => string;
  totalDuration: number;
  totalPrice: number;
}

const BookingContext = createContext<BookingContextType | null>(null);

// Provider
export function ChatBookingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(bookingReducer, initialState);

  // Computed totals for multi-service
  const totalDuration = useMemo(() => state.services.reduce((sum, s) => sum + s.duree, 0), [state.services]);
  const totalPrice = useMemo(() => state.services.reduce((sum, s) => sum + s.prix, 0), [state.services]);

  const actions = useMemo(() => ({
    startBooking: () => dispatch({ type: 'START_BOOKING' }),

    selectService: (service: Service) => {
      dispatch({ type: 'SELECT_SERVICE', payload: service });
    },

    toggleService: (service: Service) => {
      dispatch({ type: 'TOGGLE_SERVICE', payload: service });
    },

    doneSelecting: () => {
      dispatch({ type: 'DONE_SELECTING' });
    },

    fetchWeekAvailability: async (startDate: string) => {
      if (state.services.length === 0) return;

      try {
        // Utiliser la durée TOTALE de tous les services sélectionnés
        const duration = state.services.reduce((sum, s) => sum + s.duree, 0);
        const blocksDays = Math.max(...state.services.map(s => s.blocksDays || 1));

        const response = await apiFetch(
          `/api/orders/checkout/week-availability?startDate=${startDate}&duration=${duration}&blocksDays=${blocksDays}`
        );
        const data = await response.json();

        if (data.success) {
          dispatch({
            type: 'SET_WEEK_AVAILABILITY',
            payload: { week: data.week, startDate },
          });
        }
      } catch (error) {
        console.error('Erreur fetch disponibilités:', error);
      }
    },

    selectDateTime: (date: string, time: string) => {
      dispatch({ type: 'SELECT_DATETIME', payload: { date, time } });
    },

    setClientInfo: (info: ClientInfo) => {
      dispatch({ type: 'SET_CLIENT_INFO', payload: info });
    },

    selectPaymentMethod: (method: PaymentMethod) => {
      dispatch({ type: 'SELECT_PAYMENT', payload: method });
    },

    createOrder: async (paiementId?: string, paymentMethodOverride?: PaymentMethod) => {
      if (state.services.length === 0 || !state.selectedDate || !state.selectedTime) {
        dispatch({ type: 'ERROR', payload: 'Informations manquantes' });
        return;
      }

      // Utiliser l'override si fourni (évite le bug de timing React où
      // state.paymentMethod n'est pas encore mis à jour après dispatch)
      const effectivePaymentMethod = paymentMethodOverride || state.paymentMethod;

      dispatch({ type: 'PROCESSING' });

      try {
        const items = state.services.map((s, i) => ({
          serviceNom: s.nom,
          serviceDescription: s.description || '',
          dureeMinutes: s.duree,
          prix: s.prix,
          ordre: i,
        }));

        const sousTotal = state.services.reduce((sum, s) => sum + s.prix, 0);

        const orderData = {
          items,
          clientId: null,
          lieu: 'chez_fatou',  // Par défaut dans le chat
          adresseClient: null,
          distanceKm: null,
          dateRdv: state.selectedDate,
          heureDebut: state.selectedTime,
          sousTotal,
          fraisDeplacement: 0,
          total: sousTotal,
          clientNom: state.clientInfo.nom,
          clientPrenom: state.clientInfo.prenom,
          clientTelephone: state.clientInfo.telephone,
          clientEmail: state.clientInfo.email || null,
          paiementMethode: effectivePaymentMethod,
          ...(paiementId && { paiementId }),
        };

        const response = await apiFetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
        });

        const result = await response.json();

        if (result.success) {
          if (result.depositRequired) {
            dispatch({ type: 'DEPOSIT_PENDING', payload: result.orderId });
          } else {
            dispatch({ type: 'CONFIRMED', payload: result.orderId });
          }
        } else {
          dispatch({ type: 'ERROR', payload: result.error || 'Erreur création commande' });
        }
      } catch (error: any) {
        dispatch({ type: 'ERROR', payload: error.message || 'Erreur réseau' });
      }
    },

    resetBooking: () => dispatch({ type: 'RESET' }),

    goBack: () => dispatch({ type: 'GO_BACK' }),

    formatPrice: (cents: number) => {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
      }).format(cents / 100);
    },

    formatDuration: (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hours === 0) return `${mins}min`;
      if (mins === 0) return `${hours}h`;
      return `${hours}h${mins}`;
    },
  }), [state.services, state.selectedDate, state.selectedTime, state.clientInfo, state.paymentMethod]);

  const value = useMemo(() => ({
    ...state,
    ...actions,
    totalDuration,
    totalPrice,
  }), [state, actions, totalDuration, totalPrice]);

  return (
    <BookingContext.Provider value={value}>
      {children}
    </BookingContext.Provider>
  );
}

// Hook
export function useChatBooking() {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useChatBooking must be used within ChatBookingProvider');
  }
  return context;
}
