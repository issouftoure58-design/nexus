import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useCart } from '@/contexts/CartContext';
import { apiUrl, apiFetch } from '@/lib/api-config';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import StripePaymentForm from '@/components/checkout/StripePaymentForm';
import PayPalButton from '@/components/checkout/PayPalButton';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import {
  ArrowLeft,
  ArrowRight,
  ShoppingBag,
  Trash2,
  MapPin,
  Home,
  Calendar,
  Clock,
  CreditCard,
  CheckCircle2,
  Loader2,
  User,
  Mail,
  Lock,
  Phone,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  Gift,
} from 'lucide-react';

type Step = 'panier' | 'lieu' | 'date' | 'compte' | 'paiement' | 'confirmation';

// Formatage durée
function formatDuree(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}`;
}

// Formatage prix
function formatPrix(euros: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(euros);
}

export default function PanierPage() {
  const {
    cart,
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
  } = useCart();

  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>('panier');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [clientId, setClientId] = useState<number | null>(null);
  const [clientInfo, setClientInfo] = useState({
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
  });
  const [paiementMethode, setPaiementMethode] = useState<'stripe' | 'paypal' | 'sur_place'>('sur_place');

  // État pour le formulaire de connexion/inscription
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    password: '',
    confirmPassword: '',
  });

  // État pour Stripe
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [showStripeForm, setShowStripeForm] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);

  // État pour PayPal
  const [showPayPalButton, setShowPayPalButton] = useState(false);

  // État pour sauvegarder les données de confirmation (avant clearCart)
  const [confirmationData, setConfirmationData] = useState<{
    dateRdv: string;
    heureDebut: string;
    lieu: 'domicile' | 'chez_fatou' | null;
    adresse: string;
    items: typeof cart.items;
    total: number;
    fraisDeplacement: number;
  } | null>(null);

  // État pour les créneaux disponibles (ancien système)
  const [availableDates, setAvailableDates] = useState<Array<{ value: string; jour: string; label: string }>>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // État pour le nouveau calendrier semaine
  interface DayAvailability {
    jour: string;
    label: string;
    slots: string[];
    allSlots: string[];
    closed: boolean;
  }
  interface WeekAvailability {
    [date: string]: DayAvailability;
  }

  const [weekStartDate, setWeekStartDate] = useState<Date>(() => {
    // Trouver le lundi de la semaine courante ou prochaine
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    // Si dimanche (0), on va au lendemain (lundi)
    // Sinon, on va au lundi de cette semaine
    if (day === 0) {
      monday.setDate(today.getDate() + 1);
    } else {
      monday.setDate(today.getDate() - day + 1);
    }
    return monday;
  });
  const [weekAvailability, setWeekAvailability] = useState<WeekAvailability | null>(null);
  const [loadingWeek, setLoadingWeek] = useState(false);

  // Config checkout (domicile activé/désactivé)
  const [checkoutConfig, setCheckoutConfig] = useState<{
    domicileEnabled: boolean;
    domicileDisabledMessage: string;
  }>({ domicileEnabled: true, domicileDisabledMessage: '' });

  // Charger la config checkout au montage
  useEffect(() => {
    const fetchCheckoutConfig = async () => {
      try {
        const response = await apiFetch('/api/orders/checkout/config');
        const data = await response.json();
        if (data.success && data.config) {
          setCheckoutConfig(data.config);
          // Si domicile désactivé et le lieu actuel est domicile, forcer chez_fatou
          if (!data.config.domicileEnabled && cart.lieu === 'domicile') {
            setLieu('chez_fatou');
          }
        }
      } catch (error) {
        console.error('Erreur chargement config checkout:', error);
      }
    };
    fetchCheckoutConfig();
  }, []);

  // Vérifier si l'utilisateur est connecté au chargement
  useEffect(() => {
    const token = localStorage.getItem('client_token');
    const userData = localStorage.getItem('client_user');

    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        setIsLoggedIn(true);
        setClientId(user.id);
        setClientInfo({
          nom: user.nom || '',
          prenom: user.prenom || '',
          telephone: user.telephone || '',
          email: user.email || '',
        });
      } catch (e) {
        console.error('Erreur parsing user data:', e);
      }
    }
  }, []);

  // Charger les disponibilités de la semaine quand on arrive à l'étape date
  useEffect(() => {
    if (step === 'date' && dureeTotaleAvecTrajet > 0) {
      fetchWeekAvailability();
    }
  }, [step, weekStartDate, dureeTotaleAvecTrajet, blocksDaysTotal]);

  // Récupérer les disponibilités de la semaine
  const fetchWeekAvailability = async () => {
    setLoadingWeek(true);
    try {
      const startDateStr = `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, '0')}-${String(weekStartDate.getDate()).padStart(2, '0')}`;
      const response = await apiFetch(`/api/orders/checkout/week-availability?startDate=${startDateStr}&duration=${dureeTotaleAvecTrajet}&blocksDays=${blocksDaysTotal}`);
      const data = await response.json();
      if (data.success) {
        setWeekAvailability(data.week);
      }
    } catch (error) {
      console.error('Erreur chargement semaine:', error);
    } finally {
      setLoadingWeek(false);
    }
  };

  // Navigation semaine
  const handlePrevWeek = () => {
    const newStart = new Date(weekStartDate);
    newStart.setDate(newStart.getDate() - 7);
    setWeekStartDate(newStart);
  };

  const handleNextWeek = () => {
    const newStart = new Date(weekStartDate);
    newStart.setDate(newStart.getDate() + 7);
    setWeekStartDate(newStart);
  };

  // Peut-on aller à la semaine précédente ?
  const canGoPrevWeek = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const prevMonday = new Date(weekStartDate);
    prevMonday.setDate(prevMonday.getDate() - 7);
    return prevMonday >= today;
  };

  // Charger les dates disponibles quand on arrive à l'étape date (ancien système - conservé pour compatibilité)
  useEffect(() => {
    if (step === 'date' && dureeTotaleAvecTrajet > 0) {
      fetchAvailableDates();
    }
  }, [step, dureeTotaleAvecTrajet]);

  // Charger les créneaux quand une date est sélectionnée (ancien système - conservé pour compatibilité)
  useEffect(() => {
    if (cart.dateRdv && dureeTotaleAvecTrajet > 0) {
      fetchAvailableSlots(cart.dateRdv);
    }
  }, [cart.dateRdv, dureeTotaleAvecTrajet]);

  // Récupérer les dates disponibles (durée prestation + trajet si domicile)
  const fetchAvailableDates = async () => {
    setLoadingDates(true);
    try {
      const response = await apiFetch(`/api/orders/checkout/available-dates?duration=${dureeTotaleAvecTrajet}&days=14`);
      const data = await response.json();
      if (data.success) {
        setAvailableDates(data.dates);
      }
    } catch (error) {
      console.error('Erreur chargement dates:', error);
    } finally {
      setLoadingDates(false);
    }
  };

  // Récupérer les créneaux disponibles pour une date
  const fetchAvailableSlots = async (date: string) => {
    setLoadingSlots(true);
    setAvailableSlots([]);
    try {
      const response = await apiFetch(`/api/orders/checkout/available-slots?date=${date}&duration=${dureeTotaleAvecTrajet}`);
      const data = await response.json();
      if (data.success) {
        setAvailableSlots(data.slots);
      }
    } catch (error) {
      console.error('Erreur chargement créneaux:', error);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Calculer les frais de déplacement et le temps de trajet quand l'adresse change
  const calculateTravelInfo = async (adresse: string) => {
    if (!adresse || cart.lieu !== 'domicile') {
      setFraisDeplacement(0, 0, 0);
      return;
    }

    try {
      const response = await apiFetch('/api/orders/checkout/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.items,
          lieu: 'domicile',
          adresse,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Convertir centimes en euros pour les frais
        const fraisEuros = data.fraisDeplacement / 100;
        setFraisDeplacement(fraisEuros, data.distanceKm, data.dureeTrajetMinutes || 0);
      }
    } catch (error) {
      console.error('Erreur calcul trajet:', error);
    }
  };

  // Étapes du checkout (compte est conditionnel)
  const steps: { id: Step; label: string; icon: React.ReactNode }[] = [
    { id: 'panier', label: 'Panier', icon: <ShoppingBag className="h-4 w-4" /> },
    { id: 'lieu', label: 'Lieu', icon: <MapPin className="h-4 w-4" /> },
    { id: 'date', label: 'Date', icon: <Calendar className="h-4 w-4" /> },
    ...(isLoggedIn ? [] : [{ id: 'compte' as Step, label: 'Compte', icon: <User className="h-4 w-4" /> }]),
    { id: 'paiement', label: 'Paiement', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'confirmation', label: 'Confirmation', icon: <CheckCircle2 className="h-4 w-4" /> },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === step);

  // Navigation entre étapes
  const goToStep = (newStep: Step) => {
    setStep(newStep);
    window.scrollTo(0, 0);
  };

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      goToStep(steps[nextIndex].id);
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      goToStep(steps[prevIndex].id);
    }
  };

  // Valider l'étape panier
  const validatePanier = () => {
    if (itemCount === 0) {
      toast({
        title: 'Panier vide',
        description: 'Ajoutez des services à votre panier pour continuer.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  // Valider l'étape lieu
  const validateLieu = () => {
    if (!cart.lieu) {
      toast({
        title: 'Lieu requis',
        description: 'Veuillez choisir où vous souhaitez être coiffé(e).',
        variant: 'destructive',
      });
      return false;
    }
    if (cart.lieu === 'domicile' && !cart.adresse) {
      toast({
        title: 'Adresse requise',
        description: 'Veuillez saisir votre adresse pour le service à domicile.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  // Valider l'étape date
  const validateDate = () => {
    if (!cart.dateRdv || !cart.heureDebut) {
      toast({
        title: 'Date et heure requises',
        description: 'Veuillez choisir une date et une heure pour votre rendez-vous.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  // Valider infos client (toujours valide si connecté)
  const validateClientInfo = () => {
    if (!isLoggedIn) {
      toast({
        title: 'Connexion requise',
        description: 'Veuillez vous connecter pour finaliser votre réservation.',
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  // Connexion
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      const response = await apiFetch('/api/client/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur de connexion');
      }

      // Stocker les tokens
      localStorage.setItem('client_token', data.accessToken);
      localStorage.setItem('client_refresh_token', data.refreshToken);
      localStorage.setItem('client_user', JSON.stringify(data.client));

      // Mettre à jour l'état
      setIsLoggedIn(true);
      setClientId(data.client.id);
      setClientInfo({
        nom: data.client.nom || '',
        prenom: data.client.prenom || '',
        telephone: data.client.telephone || '',
        email: data.client.email || '',
      });

      toast({
        title: 'Connexion réussie',
        description: `Bienvenue ${data.client.prenom || data.client.nom} !`,
      });

      // Passer directement à l'étape paiement
      goToStep('paiement');
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setAuthLoading(false);
    }
  };

  // Inscription
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (registerForm.password !== registerForm.confirmPassword) {
      toast({
        title: 'Erreur',
        description: 'Les mots de passe ne correspondent pas',
        variant: 'destructive',
      });
      return;
    }

    if (!acceptTerms) {
      toast({
        title: 'Erreur',
        description: 'Veuillez accepter les conditions générales',
        variant: 'destructive',
      });
      return;
    }

    setAuthLoading(true);

    try {
      const response = await apiFetch('/api/client/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: registerForm.nom,
          prenom: registerForm.prenom,
          email: registerForm.email,
          telephone: registerForm.telephone,
          password: registerForm.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur lors de l\'inscription');
      }

      toast({
        title: 'Compte créé !',
        description: `Vous avez reçu ${data.bonusPoints} points de bienvenue !`,
      });

      // Connexion automatique après inscription
      const loginResponse = await apiFetch('/api/client/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerForm.email,
          password: registerForm.password,
        }),
      });

      const loginData = await loginResponse.json();

      if (loginResponse.ok) {
        localStorage.setItem('client_token', loginData.accessToken);
        localStorage.setItem('client_refresh_token', loginData.refreshToken);
        localStorage.setItem('client_user', JSON.stringify(loginData.client));

        setIsLoggedIn(true);
        setClientId(loginData.client.id);
        setClientInfo({
          nom: loginData.client.nom || '',
          prenom: loginData.client.prenom || '',
          telephone: loginData.client.telephone || '',
          email: loginData.client.email || '',
        });

        goToStep('paiement');
      }
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setAuthLoading(false);
    }
  };

  // Préparer les données de commande
  const getOrderData = () => ({
    items: cart.items.map((item, index) => ({
      serviceNom: item.serviceNom,
      serviceDescription: item.description,
      dureeMinutes: item.duree,
      prix: Math.round(item.prix * 100), // Convertir en centimes
      ordre: index,
    })),
    clientId: clientId,
    lieu: cart.lieu,
    adresseClient: cart.adresse || null,
    distanceKm: cart.distanceKm || null,
    dateRdv: cart.dateRdv,
    heureDebut: cart.heureDebut,
    sousTotal: Math.round(sousTotal * 100),
    fraisDeplacement: Math.round(cart.fraisDeplacement * 100),
    total: Math.round(total * 100),
    clientNom: clientInfo.nom,
    clientPrenom: clientInfo.prenom || null,
    clientTelephone: clientInfo.telephone.replace(/\s/g, ''),
    clientEmail: clientInfo.email || null,
    paiementMethode,
  });

  // Créer la commande (sur place ou après paiement Stripe)
  const createOrder = async (paiementId?: string) => {
    const token = localStorage.getItem('client_token');
    const orderData = {
      ...getOrderData(),
      ...(paiementId && { paiementId }),
    };

    const response = await apiFetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify(orderData),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || 'Erreur création commande');
    }
    return result;
  };

  // Initier le paiement Stripe
  const initiateStripePayment = async () => {
    setStripeLoading(true);
    try {
      const amountInCents = Math.round(total * 100);

      // Validation du montant
      if (!amountInCents || amountInCents < 50) {
        throw new Error(`Montant invalide: ${amountInCents} centimes (minimum 50)`);
      }

      console.log('[Stripe] Initialisation paiement:', { amountInCents, total, items: cart.items.length });

      const response = await apiFetch('/api/payment/order/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountInCents,
          clientEmail: clientInfo.email,
          clientName: `${clientInfo.prenom} ${clientInfo.nom}`.trim(),
          items: cart.items,
        }),
      });

      const result = await response.json();
      console.log('[Stripe] Reponse:', result);

      if (!result.success) {
        throw new Error(result.error || 'Erreur creation paiement');
      }

      setStripeClientSecret(result.clientSecret);
      setShowStripeForm(true);
    } catch (error: any) {
      console.error('Erreur Stripe:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible d\'initialiser le paiement. Veuillez reessayer.',
        variant: 'destructive',
      });
    } finally {
      setStripeLoading(false);
    }
  };

  // Callback succès paiement Stripe
  const handleStripeSuccess = async (paymentIntentId: string) => {
    setIsLoading(true);
    try {
      // Créer la commande avec le paiement confirmé
      await createOrder(paymentIntentId);

      toast({
        title: 'Paiement réussi !',
        description: 'Votre réservation est confirmée.',
      });

      // Sauvegarder les données AVANT de vider le panier
      setConfirmationData({
        dateRdv: cart.dateRdv,
        heureDebut: cart.heureDebut,
        lieu: cart.lieu,
        adresse: cart.adresse,
        items: [...cart.items],
        total,
        fraisDeplacement: cart.fraisDeplacement,
      });

      setShowStripeForm(false);
      clearCart();
      setWeekAvailability(null); // Reset pour forcer refresh au prochain passage
      goToStep('confirmation');
    } catch (error) {
      console.error('Erreur après paiement:', error);
      toast({
        title: 'Erreur',
        description: 'Paiement réussi mais erreur lors de la création de la commande. Contactez-nous.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Callback erreur paiement Stripe
  const handleStripeError = (error: string) => {
    toast({
      title: 'Erreur de paiement',
      description: error,
      variant: 'destructive',
    });
  };

  // Annuler le paiement Stripe
  const handleStripeCancel = () => {
    setShowStripeForm(false);
    setStripeClientSecret(null);
  };

  // Callback succès paiement PayPal
  const handlePayPalSuccess = async (captureId: string, orderId: string) => {
    setIsLoading(true);
    try {
      // Créer la commande avec le paiement PayPal confirmé
      await createOrder(orderId);

      toast({
        title: 'Paiement PayPal réussi !',
        description: 'Votre réservation est confirmée.',
      });

      // Sauvegarder les données AVANT de vider le panier
      setConfirmationData({
        dateRdv: cart.dateRdv,
        heureDebut: cart.heureDebut,
        lieu: cart.lieu,
        adresse: cart.adresse,
        items: [...cart.items],
        total,
        fraisDeplacement: cart.fraisDeplacement,
      });

      setShowPayPalButton(false);
      clearCart();
      setWeekAvailability(null); // Reset pour forcer refresh au prochain passage
      goToStep('confirmation');
    } catch (error) {
      console.error('Erreur après paiement PayPal:', error);
      toast({
        title: 'Erreur',
        description: 'Paiement réussi mais erreur lors de la création de la commande. Contactez-nous.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Callback erreur paiement PayPal
  const handlePayPalError = (error: string) => {
    toast({
      title: 'Erreur PayPal',
      description: error,
      variant: 'destructive',
    });
    setShowPayPalButton(false);
  };

  // Annuler le paiement PayPal
  const handlePayPalCancel = () => {
    setShowPayPalButton(false);
    toast({
      title: 'Paiement annulé',
      description: 'Vous pouvez choisir un autre mode de paiement.',
    });
  };

  // Soumettre la commande
  const submitOrder = async () => {
    if (!validateClientInfo()) return;

    // Debug: log du montant
    console.log('[submitOrder] Total:', total, '| Items:', cart.items.length, '| Methode:', paiementMethode);

    // Si Stripe, initier le paiement
    if (paiementMethode === 'stripe') {
      await initiateStripePayment();
      return;
    }

    // Si PayPal, afficher le bouton PayPal
    if (paiementMethode === 'paypal') {
      console.log('[PayPal] Affichage bouton, montant:', Math.round(total * 100), 'centimes');
      setShowPayPalButton(true);
      return;
    }

    // Paiement sur place - créer directement la commande
    setIsLoading(true);
    try {
      await createOrder();

      toast({
        title: 'Commande confirmée !',
        description: 'Vous recevrez une confirmation par SMS.',
      });

      // Sauvegarder les données AVANT de vider le panier
      setConfirmationData({
        dateRdv: cart.dateRdv,
        heureDebut: cart.heureDebut,
        lieu: cart.lieu,
        adresse: cart.adresse,
        items: [...cart.items],
        total,
        fraisDeplacement: cart.fraisDeplacement,
      });

      clearCart();
      setWeekAvailability(null); // Reset pour forcer refresh au prochain passage
      goToStep('confirmation');
    } catch (error) {
      console.error('Erreur commande:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de valider la commande. Veuillez réessayer.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Rendu de l'indicateur d'étapes
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {steps.map((s, index) => (
        <div key={s.id} className="flex items-center">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors ${
              index < currentStepIndex
                ? 'bg-amber-500 border-amber-500 text-white'
                : index === currentStepIndex
                ? 'bg-amber-500 border-amber-500 text-white'
                : 'border-zinc-300 text-zinc-400'
            }`}
          >
            {index < currentStepIndex ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              s.icon
            )}
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-8 h-0.5 mx-1 ${
                index < currentStepIndex ? 'bg-amber-500' : 'bg-zinc-300'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  // Rendu étape Panier
  const renderPanierStep = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zinc-900">Votre panier</h2>

      {itemCount === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingBag className="h-16 w-16 mx-auto text-zinc-300 mb-4" />
            <p className="text-zinc-500 mb-4">Votre panier est vide</p>
            <Link href="/services">
              <Button className="bg-amber-500 hover:bg-amber-600">
                Voir nos services
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {cart.items.map(item => (
              <Card key={item.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-zinc-900">{item.serviceNom}</h3>
                      <p className="text-sm text-zinc-500">{item.description}</p>
                      <p className="text-sm text-zinc-400 mt-1">
                        Durée: {formatDuree(item.duree)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-amber-600">
                        {formatPrix(item.prix)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-zinc-600">Durée totale estimée</span>
                <span className="font-medium">{formatDuree(dureeTotale)}</span>
              </div>
              <Separator className="my-2 bg-amber-200" />
              <div className="flex justify-between items-center">
                <span className="font-semibold text-zinc-900">Sous-total</span>
                <span className="font-bold text-xl text-amber-600">
                  {formatPrix(sousTotal)}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                * Frais de déplacement en supplément si service à domicile
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={clearCart}>
              Vider le panier
            </Button>
            <Button
              onClick={() => validatePanier() && nextStep()}
              className="bg-amber-500 hover:bg-amber-600"
            >
              Continuer
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );

  // Rendu étape Lieu
  const renderLieuStep = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zinc-900">Où souhaitez-vous être coiffé(e) ?</h2>

      <RadioGroup
        value={cart.lieu || ''}
        onValueChange={(value) => setLieu(value as 'domicile' | 'chez_fatou')}
        className="space-y-4"
      >
        <Card
          className={`cursor-pointer transition-all ${
            cart.lieu === 'chez_fatou' ? 'ring-2 ring-amber-500 bg-amber-50' : ''
          }`}
          onClick={() => setLieu('chez_fatou')}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <RadioGroupItem value="chez_fatou" id="chez_fatou" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="chez_fatou" className="text-lg font-semibold cursor-pointer">
                  Chez Fatou à Franconville
                </Label>
                <p className="text-sm text-zinc-500 mt-1">
                  8 rue des Monts Rouges, 95130 Franconville
                </p>
                <p className="text-sm text-green-600 font-medium mt-2">
                  Pas de frais de déplacement
                </p>
              </div>
              <Home className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        {/* Option domicile - uniquement si activée dans la config */}
        {checkoutConfig.domicileEnabled && (
          <Card
            className={`cursor-pointer transition-all ${
              cart.lieu === 'domicile' ? 'ring-2 ring-amber-500 bg-amber-50' : ''
            }`}
            onClick={() => setLieu('domicile')}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <RadioGroupItem value="domicile" id="domicile" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="domicile" className="text-lg font-semibold cursor-pointer">
                    À domicile
                  </Label>
                  <p className="text-sm text-zinc-500 mt-1">
                    Fatou se déplace chez vous en Île-de-France
                  </p>
                  <p className="text-sm text-amber-600 font-medium mt-2">
                    Frais de déplacement selon distance
                  </p>
                </div>
                <MapPin className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        )}
      </RadioGroup>

      {/* Message si domicile désactivé */}
      {!checkoutConfig.domicileEnabled && checkoutConfig.domicileDisabledMessage && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <p>{checkoutConfig.domicileDisabledMessage}</p>
        </div>
      )}

      {cart.lieu === 'domicile' && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <Label htmlFor="adresse">Votre adresse complète</Label>
            <AddressAutocomplete
              id="adresse"
              placeholder="Ex: 15 rue de la Paix, 75002 Paris"
              value={cart.adresse}
              onChange={(value) => setAdresse(value)}
              onSelect={(address) => calculateTravelInfo(address)}
            />
            {cart.dureeTrajet > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Distance :</span>
                  <span className="font-medium">{cart.distanceKm.toFixed(1)} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Temps de trajet :</span>
                  <span className="font-medium">{cart.dureeTrajet} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">Frais de déplacement :</span>
                  <span className="font-medium text-amber-600">{formatPrix(cart.fraisDeplacement)}</span>
                </div>
              </div>
            )}
            <p className="text-xs text-zinc-500">
              Les frais et le temps de trajet sont calculés automatiquement.
              Le temps de trajet est pris en compte pour les disponibilités.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <Button
          onClick={() => validateLieu() && nextStep()}
          className="bg-amber-500 hover:bg-amber-600"
        >
          Continuer
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  // Rendu étape Date - Calendrier Semaine
  const renderDateStep = () => {
    // Obtenir le mois et l'année de la semaine affichée
    const getMonthYear = () => {
      const middleOfWeek = new Date(weekStartDate);
      middleOfWeek.setDate(middleOfWeek.getDate() + 3);
      return middleOfWeek.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    };

    // Formater le jour et le mois (ex: "26 janv.")
    const formatDayMonth = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    };

    // Récupérer tous les créneaux uniques pour aligner les lignes
    const getAllUniqueSlots = () => {
      if (!weekAvailability) return [];
      const dates = Object.keys(weekAvailability).sort();
      const allSlots = new Set<string>();
      dates.forEach(d => {
        weekAvailability[d].allSlots.forEach(slot => allSlots.add(slot));
      });
      return Array.from(allSlots).sort();
    };

    const allUniqueSlots = getAllUniqueSlots();
    const dates = weekAvailability ? Object.keys(weekAvailability).sort() : [];

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-zinc-900">Choisissez votre créneau</h2>

        {/* Info durée */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-zinc-700">
            <span className="font-medium">Durée d'intervention estimée :</span>{' '}
            {formatDuree(dureeTotaleAvecTrajet)}
            {cart.dureeTrajet > 0 && (
              <span className="text-zinc-500">
                {' '}(dont {cart.dureeTrajet} min de trajet)
              </span>
            )}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {loadingWeek ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                <span className="ml-3 text-zinc-500">Chargement des disponibilités...</span>
              </div>
            ) : !weekAvailability ? (
              <div className="text-center py-12 text-zinc-500">
                <Calendar className="h-12 w-12 mx-auto mb-2 text-zinc-300" />
                <p>Erreur lors du chargement des disponibilités.</p>
              </div>
            ) : (
              <>
                {/* Navigation semaine */}
                <div className="flex justify-between items-center mb-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevWeek}
                    disabled={!canGoPrevWeek()}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Sem. préc.
                  </Button>
                  <span className="font-semibold text-zinc-800 capitalize">
                    {getMonthYear()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextWeek}
                  >
                    Sem. suiv.
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                {/* Grille semaine - scrollable sur mobile */}
                <div className="overflow-x-auto -mx-4 px-4">
                  <div className="min-w-[700px]">
                    {/* En-têtes des jours */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {dates.map(date => {
                        const day = weekAvailability[date];
                        const isToday = date === new Date().toISOString().split('T')[0];
                        return (
                          <div
                            key={date}
                            className={`text-center p-2 rounded-t-lg ${
                              isToday ? 'bg-amber-100' : 'bg-zinc-100'
                            }`}
                          >
                            <div className="text-xs uppercase font-medium text-zinc-500">
                              {day.jour}.
                            </div>
                            <div className={`font-semibold ${isToday ? 'text-amber-600' : 'text-zinc-800'}`}>
                              {formatDayMonth(date)}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Créneaux */}
                    {allUniqueSlots.length === 0 ? (
                      <div className="text-center py-8 text-zinc-500">
                        <Clock className="h-10 w-10 mx-auto mb-2 text-zinc-300" />
                        <p>Aucun créneau disponible cette semaine.</p>
                      </div>
                    ) : (
                      allUniqueSlots.map(slot => (
                        <div key={slot} className="grid grid-cols-7 gap-1 mb-1">
                          {dates.map(date => {
                            const day = weekAvailability[date];
                            const isAvailable = day.slots.includes(slot);
                            const isInRange = day.allSlots.includes(slot);
                            const isSelected = cart.dateRdv === date && cart.heureDebut === slot;
                            const isClosed = day.closed;

                            // Cellule vide si hors des horaires de ce jour
                            if (!isInRange && !isClosed) {
                              return (
                                <div
                                  key={`${date}-${slot}`}
                                  className="h-10"
                                />
                              );
                            }

                            // Jour fermé
                            if (isClosed) {
                              return (
                                <div
                                  key={`${date}-${slot}`}
                                  className="h-10 flex items-center justify-center bg-zinc-50 rounded text-zinc-300 text-xs"
                                >
                                  —
                                </div>
                              );
                            }

                            return (
                              <button
                                key={`${date}-${slot}`}
                                disabled={!isAvailable}
                                onClick={() => {
                                  if (isAvailable) {
                                    setDateRdv(date);
                                    setHeureDebut(slot);
                                  }
                                }}
                                className={`h-10 rounded text-sm font-medium transition-all ${
                                  isSelected
                                    ? 'bg-amber-500 text-white shadow-md'
                                    : isAvailable
                                    ? 'bg-green-50 text-green-700 border border-green-300 hover:bg-green-100 hover:border-green-400'
                                    : 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                                }`}
                              >
                                {slot}
                              </button>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Légende */}
                <div className="flex justify-center gap-6 mt-6 text-xs text-zinc-500">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-50 border border-green-300"></div>
                    <span>Disponible</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-zinc-100"></div>
                    <span>Indisponible</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-amber-500"></div>
                    <span>Sélectionné</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Récapitulatif de la sélection */}
        {cart.dateRdv && cart.heureDebut && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">
              <span className="font-medium">Rendez-vous sélectionné :</span>{' '}
              {new Date(cart.dateRdv + 'T00:00:00').toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}{' '}
              à <span className="font-semibold">{cart.heureDebut}</span>
            </p>
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={prevStep}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          <Button
            onClick={() => validateDate() && nextStep()}
            className="bg-amber-500 hover:bg-amber-600"
            disabled={!cart.dateRdv || !cart.heureDebut}
          >
            Continuer
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Rendu étape Compte (authentification)
  const renderCompteStep = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zinc-900">Connexion requise</h2>
      <p className="text-zinc-500">
        Pour finaliser votre réservation, veuillez vous connecter ou créer un compte.
      </p>

      {/* Toggle Login/Register */}
      <div className="flex gap-2 p-1 bg-zinc-100 rounded-lg">
        <button
          onClick={() => setAuthMode('login')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            authMode === 'login'
              ? 'bg-white text-amber-600 shadow-sm'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <LogIn className="h-4 w-4 inline mr-2" />
          Connexion
        </button>
        <button
          onClick={() => setAuthMode('register')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            authMode === 'register'
              ? 'bg-white text-amber-600 shadow-sm'
              : 'text-zinc-600 hover:text-zinc-900'
          }`}
        >
          <UserPlus className="h-4 w-4 inline mr-2" />
          Inscription
        </button>
      </div>

      {authMode === 'login' ? (
        // Formulaire de connexion
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="votre@email.com"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Votre mot de passe"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="text-right">
                <Link
                  href="/mon-compte/mot-de-passe-oublie"
                  className="text-sm text-amber-600 hover:text-amber-700"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <Button
                type="submit"
                disabled={authLoading}
                className="w-full bg-amber-500 hover:bg-amber-600"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connexion...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-4 w-4" />
                    Se connecter
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        // Formulaire d'inscription
        <Card>
          <CardContent className="p-6">
            {/* Bonus de bienvenue */}
            <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-lg">
                <Gift className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-amber-700">50 points offerts</p>
                <p className="text-sm text-amber-600">Bonus de bienvenue à l'inscription</p>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="register-nom">Nom *</Label>
                  <Input
                    id="register-nom"
                    placeholder="Diallo"
                    value={registerForm.nom}
                    onChange={(e) => setRegisterForm({ ...registerForm, nom: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-prenom">Prénom</Label>
                  <Input
                    id="register-prenom"
                    placeholder="Aminata"
                    value={registerForm.prenom}
                    onChange={(e) => setRegisterForm({ ...registerForm, prenom: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-email">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="votre@email.com"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-telephone">Téléphone *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    id="register-telephone"
                    type="tel"
                    placeholder="06 12 34 56 78"
                    value={registerForm.telephone}
                    onChange={(e) => setRegisterForm({ ...registerForm, telephone: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">Mot de passe *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 8 caractères"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-confirm">Confirmer le mot de passe *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    id="register-confirm"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirmez votre mot de passe"
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="accept-terms"
                  checked={acceptTerms}
                  onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                  className="mt-1"
                />
                <Label htmlFor="accept-terms" className="text-sm text-zinc-600 leading-relaxed">
                  J'accepte les{' '}
                  <Link href="/cgv" className="text-amber-600 hover:underline">
                    conditions générales
                  </Link>{' '}
                  et la{' '}
                  <Link href="/confidentialite" className="text-amber-600 hover:underline">
                    politique de confidentialité
                  </Link>
                </Label>
              </div>
              <Button
                type="submit"
                disabled={authLoading}
                className="w-full bg-amber-500 hover:bg-amber-600"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Création en cours...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Créer mon compte
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
      </div>
    </div>
  );

  // Rendu étape Paiement
  const renderPaiementStep = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-zinc-900">Récapitulatif & paiement</h2>

      {/* Message de bienvenue si connecté */}
      {isLoggedIn && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800">
                Connecté en tant que {clientInfo.prenom || clientInfo.nom}
              </p>
              <p className="text-sm text-green-600">{clientInfo.email}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informations client (lecture seule depuis compte) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-amber-500" />
            Vos coordonnées
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-zinc-500">Nom</Label>
              <p className="font-medium">{clientInfo.nom || '-'}</p>
            </div>
            <div>
              <Label className="text-zinc-500">Prénom</Label>
              <p className="font-medium">{clientInfo.prenom || '-'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-zinc-500">Téléphone</Label>
              <p className="font-medium">{clientInfo.telephone || '-'}</p>
            </div>
            <div>
              <Label className="text-zinc-500">Email</Label>
              <p className="font-medium">{clientInfo.email || '-'}</p>
            </div>
          </div>
          <p className="text-xs text-zinc-400 pt-2">
            Ces informations proviennent de votre compte.{' '}
            <Link href="/mon-compte" className="text-amber-600 hover:underline">
              Modifier mon profil
            </Link>
          </p>
        </CardContent>
      </Card>

      {/* Récapitulatif */}
      <Card className="bg-zinc-50">
        <CardHeader>
          <CardTitle className="text-lg">Récapitulatif</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-zinc-600">Services ({itemCount})</span>
            <span>{formatPrix(sousTotal)}</span>
          </div>
          {cart.fraisDeplacement > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600">Frais de déplacement</span>
              <span>{formatPrix(cart.fraisDeplacement)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span className="text-amber-600">{formatPrix(total)}</span>
          </div>
          <div className="text-sm text-zinc-500 pt-2">
            <p>
              <Calendar className="h-4 w-4 inline mr-1" />
              {new Date(cart.dateRdv).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })} à {cart.heureDebut}
            </p>
            <p>
              <MapPin className="h-4 w-4 inline mr-1" />
              {cart.lieu === 'chez_fatou' ? 'Chez Fatou à Franconville' : cart.adresse}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Mode de paiement */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-amber-500" />
            Mode de paiement
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Formulaire Stripe affiché */}
          {showStripeForm && stripeClientSecret ? (
            <div className="space-y-4">
              <StripePaymentForm
                clientSecret={stripeClientSecret}
                amount={Math.round(total * 100)}
                onSuccess={handleStripeSuccess}
                onError={handleStripeError}
                onCancel={handleStripeCancel}
              />
            </div>
          ) : showPayPalButton ? (
            /* Bouton PayPal affiché */
            <div className="space-y-4">
              <PayPalButton
                amount={Math.round(total * 100)}
                onSuccess={handlePayPalSuccess}
                onError={handlePayPalError}
                onCancel={handlePayPalCancel}
              />
              <Button
                variant="outline"
                onClick={() => setShowPayPalButton(false)}
                className="w-full"
              >
                Choisir un autre mode de paiement
              </Button>
            </div>
          ) : (
            /* Sélection du mode de paiement */
            <RadioGroup
              value={paiementMethode}
              onValueChange={(value) => setPaiementMethode(value as 'stripe' | 'paypal' | 'sur_place')}
              className="space-y-3"
            >
              <div
                className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-all ${
                  paiementMethode === 'stripe' ? 'border-amber-500 bg-amber-50' : 'border-zinc-200 hover:border-zinc-300'
                }`}
                onClick={() => setPaiementMethode('stripe')}
              >
                <RadioGroupItem value="stripe" id="stripe" />
                <Label htmlFor="stripe" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Carte bancaire</p>
                      <p className="text-sm text-zinc-500">Visa, Mastercard, CB</p>
                    </div>
                    <div className="flex gap-1">
                      <img src="https://cdn.jsdelivr.net/gh/nicepay-dev/nicepay-static@master/img/visa.svg" alt="Visa" className="h-6" />
                      <img src="https://cdn.jsdelivr.net/gh/nicepay-dev/nicepay-static@master/img/mastercard.svg" alt="Mastercard" className="h-6" />
                    </div>
                  </div>
                </Label>
              </div>

              <div
                className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-all ${
                  paiementMethode === 'paypal' ? 'border-amber-500 bg-amber-50' : 'border-zinc-200 hover:border-zinc-300'
                }`}
                onClick={() => setPaiementMethode('paypal')}
              >
                <RadioGroupItem value="paypal" id="paypal" />
                <Label htmlFor="paypal" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">PayPal</p>
                      <p className="text-sm text-zinc-500">Paiement sécurisé</p>
                    </div>
                    <img src="https://www.paypalobjects.com/webstatic/mktg/Logo/pp-logo-100px.png" alt="PayPal" className="h-6" />
                  </div>
                </Label>
              </div>

              <div
                className={`flex items-center space-x-3 p-4 border rounded-lg cursor-pointer transition-all ${
                  paiementMethode === 'sur_place' ? 'border-amber-500 bg-amber-50' : 'border-zinc-200 hover:border-zinc-300'
                }`}
                onClick={() => setPaiementMethode('sur_place')}
              >
                <RadioGroupItem value="sur_place" id="sur_place" />
                <Label htmlFor="sur_place" className="flex-1 cursor-pointer">
                  <div>
                    <p className="font-medium">Paiement sur place</p>
                    <p className="text-sm text-zinc-500">Espèces, CB ou virement le jour du RDV</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          )}

          {/* Loading Stripe */}
          {stripeLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500 mr-2" />
              <span className="text-zinc-600">Initialisation du paiement...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Boutons d'action */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={prevStep}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <Button
          onClick={submitOrder}
          disabled={isLoading}
          className="bg-amber-500 hover:bg-amber-600"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Validation...
            </>
          ) : (
            <>
              Confirmer la réservation
              <CheckCircle2 className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // Rendu étape Confirmation
  const renderConfirmationStep = () => {
    // Utiliser les données sauvegardées ou fallback sur le cart (au cas où)
    const data = confirmationData || {
      dateRdv: cart.dateRdv,
      heureDebut: cart.heureDebut,
      lieu: cart.lieu,
      adresse: cart.adresse,
      items: cart.items,
      total,
      fraisDeplacement: cart.fraisDeplacement,
    };

    return (
      <div className="text-center space-y-6 py-8">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-zinc-900">Réservation confirmée !</h2>
          <p className="text-zinc-500 mt-2">
            Vous recevrez une confirmation par SMS et un rappel 24h avant votre rendez-vous.
          </p>
        </div>

        <Card className="text-left">
          <CardContent className="p-6 space-y-4">
            <div>
              <p className="text-sm text-zinc-500">Date et heure</p>
              <p className="font-medium">
                {data.dateRdv ? new Date(data.dateRdv + 'T00:00:00').toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                }) : 'Date non disponible'} à {data.heureDebut || '--:--'}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Lieu</p>
              <p className="font-medium">
                {data.lieu === 'chez_fatou'
                  ? '8 rue des Monts Rouges, 95130 Franconville'
                  : data.adresse || 'Adresse non disponible'}
              </p>
            </div>
            <div>
              <p className="text-sm text-zinc-500">Services</p>
              {data.items && data.items.length > 0 ? (
                data.items.map(item => (
                  <p key={item.id} className="font-medium">{item.serviceNom}</p>
                ))
              ) : (
                <p className="font-medium text-zinc-400">Services réservés</p>
              )}
            </div>
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span className="text-amber-600">{formatPrix(data.total)}</span>
            </div>
            {paiementMethode === 'sur_place' && (
              <p className="text-sm text-amber-600">
                À régler sur place le jour du rendez-vous
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/">
            <Button variant="outline">
              Retour à l'accueil
            </Button>
          </Link>
          <Link href="/services">
            <Button className="bg-amber-500 hover:bg-amber-600">
              Voir nos services
            </Button>
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <Navigation />

      <main className="pt-24 pb-16">
        <div className="max-w-2xl mx-auto px-4">
          {step !== 'confirmation' && renderStepIndicator()}

          {step === 'panier' && renderPanierStep()}
          {step === 'lieu' && renderLieuStep()}
          {step === 'date' && renderDateStep()}
          {step === 'compte' && renderCompteStep()}
          {step === 'paiement' && renderPaiementStep()}
          {step === 'confirmation' && renderConfirmationStep()}
        </div>
      </main>

      {step === 'confirmation' && <Footer />}
    </div>
  );
}
