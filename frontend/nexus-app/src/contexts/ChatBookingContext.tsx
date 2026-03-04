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

export type BookingStage = 'idle' | 'service' | 'date' | 'client' | 'payment' | 'processing' | 'confirmed' | 'error';
export type PaymentMethod = 'sur_place' | 'stripe' | 'paypal';

export interface BookingState {
  stage: BookingStage;
  service: Service | null;
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
  | { type: 'SET_WEEK_AVAILABILITY'; payload: { week: WeekAvailability; startDate: string } }
  | { type: 'SELECT_DATETIME'; payload: { date: string; time: string } }
  | { type: 'SET_CLIENT_INFO'; payload: ClientInfo }
  | { type: 'SELECT_PAYMENT'; payload: PaymentMethod }
  | { type: 'PROCESSING' }
  | { type: 'CONFIRMED'; payload: string }
  | { type: 'ERROR'; payload: string }
  | { type: 'RESET' }
  | { type: 'GO_BACK' };

// Initial state
const initialState: BookingState = {
  stage: 'idle',
  service: null,
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
      return {
        ...state,
        service: action.payload,
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
          return { ...state, stage: 'service', service: null };
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
  fetchWeekAvailability: (startDate: string) => Promise<void>;
  selectDateTime: (date: string, time: string) => void;
  setClientInfo: (info: ClientInfo) => void;
  selectPaymentMethod: (method: PaymentMethod) => void;
  createOrder: (paiementId?: string) => Promise<void>;
  resetBooking: () => void;
  goBack: () => void;
  formatPrice: (cents: number) => string;
  formatDuration: (minutes: number) => string;
}

const BookingContext = createContext<BookingContextType | null>(null);

// Provider
export function ChatBookingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(bookingReducer, initialState);

  const actions = useMemo(() => ({
    startBooking: () => dispatch({ type: 'START_BOOKING' }),

    selectService: (service: Service) => {
      dispatch({ type: 'SELECT_SERVICE', payload: service });
    },

    fetchWeekAvailability: async (startDate: string) => {
      if (!state.service) return;

      try {
        const duration = state.service.duree;
        const blocksDays = state.service.blocksDays || 1;

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

    createOrder: async (paiementId?: string) => {
      if (!state.service || !state.selectedDate || !state.selectedTime) {
        dispatch({ type: 'ERROR', payload: 'Informations manquantes' });
        return;
      }

      dispatch({ type: 'PROCESSING' });

      try {
        const orderData = {
          items: [{
            serviceNom: state.service.nom,
            serviceDescription: state.service.description || '',
            dureeMinutes: state.service.duree,
            prix: state.service.prix,
            ordre: 0,
          }],
          clientId: null,
          lieu: 'chez_fatou',  // Par défaut dans le chat
          adresseClient: null,
          distanceKm: null,
          dateRdv: state.selectedDate,
          heureDebut: state.selectedTime,
          sousTotal: state.service.prix,
          fraisDeplacement: 0,
          total: state.service.prix,
          clientNom: state.clientInfo.nom,
          clientPrenom: state.clientInfo.prenom,
          clientTelephone: state.clientInfo.telephone,
          clientEmail: state.clientInfo.email || null,
          paiementMethode: state.paymentMethod,
          ...(paiementId && { paiementId }),
        };

        const response = await apiFetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData),
        });

        const result = await response.json();

        if (result.success) {
          dispatch({ type: 'CONFIRMED', payload: result.orderId });
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
  }), [state.service, state.selectedDate, state.selectedTime, state.clientInfo, state.paymentMethod]);

  const value = useMemo(() => ({
    ...state,
    ...actions,
  }), [state, actions]);

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
