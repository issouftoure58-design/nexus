/**
 * Onboarding NEXUS - Configuration automatique par métier
 *
 * Étapes:
 * 1. Choix du métier (salon, restaurant, médical, etc.)
 * 2. Informations établissement (nom, adresse, téléphone)
 * 3. Services (pré-remplis selon métier, modifiables)
 * 4. Horaires (pré-remplis selon métier, modifiables)
 * 5. Activation canaux IA + Plan suggéré
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  Scissors,
  UtensilsCrossed,
  Stethoscope,
  Building2,
  Sparkles,
  Car,
  Wrench,
  Store,
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  MapPin,
  Phone,
  Clock,
  Plus,
  Trash2,
  MessageCircle,
  PhoneCall,
  Globe,
  Zap,
} from 'lucide-react';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

interface BusinessTemplate {
  id: string;
  name: string;
  icon: string;
  emoji: string;
  description: string;
  recommendedModules: string[];
  suggestedPlan: string;
  estimatedMonthlyPrice: number;
  servicesCount: number;
}

interface TemplatePreview {
  id: string;
  name: string;
  defaultServices: Array<{
    name: string;
    duration: number;
    price: number;
    category: string;
  }>;
  defaultHours: Record<string, any>;
  iaConfig: Record<string, any>;
  recommendedModules: string[];
  suggestedPlan: string;
  estimatedMonthlyPrice: number;
}

interface Service {
  name: string;
  duration: number;
  price: number;
  category: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════════════════════

const ICON_MAP: Record<string, React.ElementType> = {
  scissors: Scissors,
  sparkles: Sparkles,
  utensils: UtensilsCrossed,
  stethoscope: Stethoscope,
  car: Car,
  wrench: Wrench,
  store: Store,
  building: Building2,
};

const DAY_LABELS: Record<string, string> = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
};

const PLAN_INFO: Record<string, { name: string; description: string; color: string }> = {
  essential: {
    name: 'Essentiel',
    description: 'Pour démarrer avec l\'IA',
    color: 'from-blue-500 to-cyan-500',
  },
  business: {
    name: 'Business',
    description: 'Pour les professionnels actifs',
    color: 'from-cyan-500 to-emerald-500',
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Solution complète',
    color: 'from-purple-500 to-pink-500',
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// API
// ══════════════════════════════════════════════════════════════════════════════

// API_URL: utilise le proxy Vite (/api) ou l'URL complète en prod
const API_URL = import.meta.env.VITE_API_URL || '/api';

async function fetchBusinessTemplates(): Promise<BusinessTemplate[]> {
  const res = await fetch(`${API_URL}/tenants/business-templates`);
  if (!res.ok) throw new Error('Erreur chargement templates');
  const data = await res.json();
  return data.templates;
}

async function fetchTemplatePreview(type: string): Promise<TemplatePreview> {
  const res = await fetch(`${API_URL}/tenants/template-preview/${type}`);
  if (!res.ok) throw new Error('Erreur chargement preview');
  const data = await res.json();
  return data.template;
}

async function setupFromTemplate(payload: {
  businessType: string;
  businessName: string;
  ownerName: string;
  address: string;
  phone: string;
  selectedServices?: Service[];
  customHours?: Record<string, any>;
}): Promise<any> {
  const token = localStorage.getItem('nexus_admin_token');
  const res = await fetch(`${API_URL}/tenants/setup-from-template`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Erreur configuration');
  }
  return res.json();
}

async function completeOnboarding(): Promise<void> {
  const token = localStorage.getItem('nexus_admin_token');
  const res = await fetch(`${API_URL}/tenants/me/complete-onboarding`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error('Erreur finalisation');
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

function StepIndicator({ currentStep, totalSteps, labels }: {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}) {
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div key={i} className="flex items-center">
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300',
              i === currentStep
                ? 'bg-cyan-500 text-white'
                : i < currentStep
                  ? 'bg-cyan-100 text-cyan-700'
                  : 'bg-gray-100 text-gray-400'
            )}
          >
            {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          {i < totalSteps - 1 && (
            <div
              className={cn(
                'w-12 h-1 mx-1 rounded transition-all',
                i < currentStep ? 'bg-cyan-400' : 'bg-gray-200'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ServiceCard({
  service,
  onUpdate,
  onRemove,
}: {
  service: Service;
  onUpdate: (service: Service) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <div className="flex-1 grid grid-cols-3 gap-2">
        <input
          type="text"
          value={service.name}
          onChange={(e) => onUpdate({ ...service, name: e.target.value })}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          placeholder="Nom du service"
        />
        <input
          type="number"
          value={service.duration}
          onChange={(e) => onUpdate({ ...service, duration: parseInt(e.target.value) || 0 })}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          placeholder="Durée (min)"
        />
        <input
          type="number"
          value={service.price}
          onChange={(e) => onUpdate({ ...service, price: parseFloat(e.target.value) || 0 })}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          placeholder="Prix (€)"
        />
      </div>
      <button
        onClick={onRemove}
        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // État de l'onboarding
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [businessInfo, setBusinessInfo] = useState({
    businessName: '',
    ownerName: '',
    address: '',
    phone: '',
  });
  const [services, setServices] = useState<Service[]>([]);
  const [hours, setHours] = useState<Record<string, any>>({});
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set(['whatsapp']));

  // Charger les templates disponibles
  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['business-templates'],
    queryFn: fetchBusinessTemplates,
  });

  // Charger le preview quand un type est sélectionné
  const { data: preview, isLoading: loadingPreview } = useQuery({
    queryKey: ['template-preview', selectedType],
    queryFn: () => fetchTemplatePreview(selectedType!),
    enabled: !!selectedType,
  });

  // Quand le preview est chargé, pré-remplir services et horaires
  useEffect(() => {
    if (preview) {
      setServices(preview.defaultServices || []);
      setHours(preview.defaultHours || {});
    }
  }, [preview]);

  // Mutation pour sauvegarder
  const setupMutation = useMutation({
    mutationFn: setupFromTemplate,
    onSuccess: async (data) => {
      console.log('Setup réussi:', data);
      // Marquer onboarding comme terminé
      await completeOnboarding();
      localStorage.setItem('nexus_onboarding_done', 'true');
      navigate('/');
    },
  });

  // Navigation
  const canProceed = () => {
    switch (step) {
      case 0: return !!selectedType;
      case 1: return businessInfo.businessName.trim() !== '';
      case 2: return services.length > 0;
      case 3: return true;
      case 4: return true;
      default: return false;
    }
  };

  const nextStep = () => {
    if (canProceed()) {
      setStep((s) => Math.min(s + 1, 4));
    }
  };

  const prevStep = () => setStep((s) => Math.max(s - 1, 0));

  const handleFinish = () => {
    setupMutation.mutate({
      businessType: selectedType!,
      businessName: businessInfo.businessName,
      ownerName: businessInfo.ownerName,
      address: businessInfo.address,
      phone: businessInfo.phone,
      selectedServices: services,
      customHours: hours,
    });
  };

  // Ajouter un service
  const addService = () => {
    setServices([...services, { name: '', duration: 30, price: 0, category: 'Service' }]);
  };

  // Mettre à jour un service
  const updateService = (index: number, service: Service) => {
    const newServices = [...services];
    newServices[index] = service;
    setServices(newServices);
  };

  // Supprimer un service
  const removeService = (index: number) => {
    setServices(services.filter((_, i) => i !== index));
  };

  // Toggle horaire d'un jour
  const toggleDay = (day: string) => {
    const newHours = { ...hours };
    if (newHours[day]) {
      newHours[day] = null;
    } else {
      newHours[day] = { open: '09:00', close: '18:00' };
    }
    setHours(newHours);
  };

  // Mettre à jour horaire d'un jour
  const updateDayHours = (day: string, field: 'open' | 'close', value: string) => {
    const newHours = { ...hours };
    if (!newHours[day]) newHours[day] = { open: '09:00', close: '18:00' };
    newHours[day][field] = value;
    setHours(newHours);
  };

  if (loadingTemplates) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
          <p className="text-white/70">Chargement...</p>
        </div>
      </div>
    );
  }

  const selectedTemplate = templates.find(t => t.id === selectedType);
  const planInfo = preview?.suggestedPlan ? PLAN_INFO[preview.suggestedPlan] : PLAN_INFO.essential;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-4 relative">
      {/* Bouton retour */}
      <a
        href="http://localhost:3000"
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="text-sm">Retour au site</span>
      </a>

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Configurez votre NEXUS</h1>
          <p className="text-white/60">
            Configuration automatique en quelques clics
          </p>
        </div>

        <StepIndicator
          currentStep={step}
          totalSteps={5}
          labels={['Métier', 'Infos', 'Services', 'Horaires', 'Canaux']}
        />

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8">

          {/* ═══════════════════════════════════════════════════════════════════
              ÉTAPE 0: Choix du métier
          ═══════════════════════════════════════════════════════════════════ */}
          {step === 0 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Quelle est votre activité ?</h2>
              <p className="text-gray-500 mb-6">
                NEXUS se configure automatiquement selon votre métier
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => {
                  const Icon = ICON_MAP[template.icon] || Building2;
                  const isSelected = selectedType === template.id;

                  return (
                    <button
                      key={template.id}
                      onClick={() => setSelectedType(template.id)}
                      className={cn(
                        'p-5 rounded-xl border-2 text-left transition-all duration-200 relative',
                        isSelected
                          ? 'border-cyan-500 bg-cyan-50 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      {isSelected && (
                        <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}

                      <div className="flex items-start gap-4">
                        <div className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
                          isSelected ? 'bg-cyan-500' : 'bg-gray-100'
                        )}>
                          {template.emoji}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{template.name}</h3>
                          <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                              {template.servicesCount} services
                            </span>
                            <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-1 rounded-full">
                              ~{template.estimatedMonthlyPrice}€/mois
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              ÉTAPE 1: Informations établissement
          ═══════════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Votre établissement</h2>
              <p className="text-gray-500 mb-6">
                Ces informations seront utilisées par votre assistant IA
              </p>

              {loadingPreview ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom de votre établissement *
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={businessInfo.businessName}
                        onChange={(e) => setBusinessInfo({ ...businessInfo, businessName: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                        placeholder={`Ex: ${selectedTemplate?.name === 'Salon de coiffure' ? "L'Atelier Coiffure" : "Mon entreprise"}`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Votre nom (optionnel)
                    </label>
                    <input
                      type="text"
                      value={businessInfo.ownerName}
                      onChange={(e) => setBusinessInfo({ ...businessInfo, ownerName: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="Ex: Marie Dupont"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Adresse (optionnel)
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={businessInfo.address}
                        onChange={(e) => setBusinessInfo({ ...businessInfo, address: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                        placeholder="12 rue de la République, Paris"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Téléphone (optionnel)
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="tel"
                        value={businessInfo.phone}
                        onChange={(e) => setBusinessInfo({ ...businessInfo, phone: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                        placeholder="06 12 34 56 78"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              ÉTAPE 2: Services
          ═══════════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Vos services</h2>
              <p className="text-gray-500 mb-6">
                Services pré-remplis selon votre métier. Ajustez si nécessaire.
              </p>

              <div className="mb-4 grid grid-cols-3 gap-2 text-xs font-medium text-gray-500 px-3">
                <span>Nom du service</span>
                <span>Durée (min)</span>
                <span>Prix (€)</span>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {services.map((service, index) => (
                  <ServiceCard
                    key={index}
                    service={service}
                    onUpdate={(s) => updateService(index, s)}
                    onRemove={() => removeService(index)}
                  />
                ))}
              </div>

              <button
                onClick={addService}
                className="mt-4 flex items-center gap-2 px-4 py-2 text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Ajouter un service
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              ÉTAPE 3: Horaires
          ═══════════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Vos horaires</h2>
              <p className="text-gray-500 mb-6">
                Horaires pré-remplis selon votre métier. Ajustez si nécessaire.
              </p>

              <div className="space-y-3">
                {Object.entries(DAY_LABELS).map(([day, label]) => {
                  const dayHours = hours[day];
                  const isOpen = dayHours && dayHours.open;

                  return (
                    <div key={day} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <button
                        onClick={() => toggleDay(day)}
                        className={cn(
                          'w-6 h-6 rounded flex items-center justify-center transition-colors',
                          isOpen ? 'bg-cyan-500 text-white' : 'bg-gray-200'
                        )}
                      >
                        {isOpen && <Check className="w-4 h-4" />}
                      </button>

                      <span className={cn(
                        'w-24 font-medium',
                        isOpen ? 'text-gray-900' : 'text-gray-400'
                      )}>
                        {label}
                      </span>

                      {isOpen ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={dayHours?.open || '09:00'}
                            onChange={(e) => updateDayHours(day, 'open', e.target.value)}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                          />
                          <span className="text-gray-400">à</span>
                          <input
                            type="time"
                            value={dayHours?.close || '18:00'}
                            onChange={(e) => updateDayHours(day, 'close', e.target.value)}
                            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                          />
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Fermé</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              ÉTAPE 4: Canaux IA + Récapitulatif
          ═══════════════════════════════════════════════════════════════════ */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Activez vos canaux IA</h2>
              <p className="text-gray-500 mb-6">
                Choisissez comment vos clients pourront vous contacter via l'IA
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {[
                  { id: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', desc: 'Réponses auto 24/7' },
                  { id: 'telephone', icon: PhoneCall, label: 'Téléphone', desc: 'Standard IA vocal' },
                  { id: 'web', icon: Globe, label: 'Chatbot Web', desc: 'Sur votre site' },
                ].map((channel) => {
                  const isSelected = selectedChannels.has(channel.id);
                  return (
                    <button
                      key={channel.id}
                      onClick={() => {
                        const newChannels = new Set(selectedChannels);
                        if (isSelected) {
                          newChannels.delete(channel.id);
                        } else {
                          newChannels.add(channel.id);
                        }
                        setSelectedChannels(newChannels);
                      }}
                      className={cn(
                        'p-4 rounded-xl border-2 text-center transition-all',
                        isSelected
                          ? 'border-cyan-500 bg-cyan-50'
                          : 'border-gray-200 hover:border-gray-300'
                      )}
                    >
                      <channel.icon className={cn(
                        'w-8 h-8 mx-auto mb-2',
                        isSelected ? 'text-cyan-500' : 'text-gray-400'
                      )} />
                      <h3 className="font-semibold text-gray-900">{channel.label}</h3>
                      <p className="text-xs text-gray-500 mt-1">{channel.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Récapitulatif */}
              <div className={cn(
                'p-6 rounded-xl bg-gradient-to-br text-white',
                planInfo.color
              )}>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-white/70 text-sm">Plan recommandé</span>
                    <h3 className="text-2xl font-bold">{planInfo.name}</h3>
                    <p className="text-white/80 text-sm mt-1">{planInfo.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-bold">{preview?.estimatedMonthlyPrice || 49}€</span>
                    <span className="text-white/70">/mois</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/20">
                  <p className="text-sm text-white/70 mb-2">Configuration automatique :</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      <span>{services.length} services configurés</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      <span>Horaires définis</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      <span>IA pré-configurée</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      <span>{selectedChannels.size} canal(aux) IA</span>
                    </div>
                  </div>
                </div>
              </div>

              {setupMutation.isError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm">
                    {setupMutation.error instanceof Error
                      ? setupMutation.error.message
                      : 'Une erreur est survenue'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
            <button
              onClick={prevStep}
              disabled={step === 0}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                step === 0
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              )}
            >
              <ArrowLeft className="w-4 h-4" />
              Précédent
            </button>

            {step < 4 ? (
              <button
                onClick={nextStep}
                disabled={!canProceed()}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all',
                  !canProceed()
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-600 hover:to-blue-700 shadow-lg hover:shadow-xl'
                )}
              >
                Suivant
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={setupMutation.isPending}
                className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
              >
                {setupMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Configuration...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Lancer mon NEXUS
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Skip option */}
        <div className="text-center mt-6">
          <button
            onClick={() => {
              localStorage.setItem('nexus_onboarding_done', 'true');
              navigate('/');
            }}
            className="text-white/50 hover:text-white/70 text-sm transition-colors"
          >
            Passer et configurer plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
