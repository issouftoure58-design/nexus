import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import {
  Package,
  Check,
  X,
  AlertCircle,
  Loader2,
  Bot,
  MessageCircle,
  Phone,
  Globe,
  Scissors,
  UtensilsCrossed,
  Stethoscope,
  GraduationCap,
  ShoppingBag,
  Euro,
  Info,
  Lock,
  Crown,
  Zap,
  Building2
} from 'lucide-react';

// Mapping icones
const ICON_MAP: { [key: string]: any } = {
  'Bot': Bot,
  'MessageCircle': MessageCircle,
  'Phone': Phone,
  'Globe': Globe,
  'Scissors': Scissors,
  'UtensilsCrossed': UtensilsCrossed,
  'Stethoscope': Stethoscope,
  'GraduationCap': GraduationCap,
  'ShoppingBag': ShoppingBag,
  'Package': Package,
  'Building2': Building2,
};

// Noms categories
const CATEGORIE_LABELS: { [key: string]: string } = {
  'canal_ia': 'Canaux IA',
  'module_metier': 'Modules Metier',
};

interface Plan {
  id: string;
  nom: string;
  description: string;
  prix_mensuel: number;
  est_actif?: boolean;
}

interface Option {
  id: string;
  nom: string;
  description: string;
  categorie: 'canal_ia' | 'module_metier';
  type_paiement: 'mensuel' | 'one_time';
  prix: number;
  inclus_forfait?: string;
  icone: string;
  est_actif: boolean;
  peut_desactiver: boolean;
  deja_paye?: boolean;
}

interface ModulesData {
  plan: Plan | null;
  options_actives: Option[];
  module_metier: Option | null;
  pricing: {
    plan: number;
    options: number;
    total_centimes: number;
    total_euros: string;
  };
}

interface OptionsData {
  options: Option[];
  par_categorie: {
    canal_ia: Option[];
    module_metier: Option[];
  };
}

export default function MesModules() {
  const [modulesData, setModulesData] = useState<ModulesData | null>(null);
  const [optionsData, setOptionsData] = useState<OptionsData | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'options' | 'plans'>('overview');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchModules(), fetchOptions(), fetchPlans()]);
    setLoading(false);
  };

  const fetchModules = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/modules', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erreur chargement modules');
      const data = await res.json();
      setModulesData(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchOptions = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/modules/options', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOptionsData(data);
      }
    } catch (err) {
      console.error('Erreur options:', err);
    }
  };

  const fetchPlans = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/admin/modules/plans', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch (err) {
      console.error('Erreur plans:', err);
    }
  };

  const toggleOption = async (optionId: string, activate: boolean) => {
    setActionLoading(optionId);
    setError(null);
    setSuccessMessage(null);

    try {
      const token = localStorage.getItem('admin_token');
      const action = activate ? 'activate' : 'deactivate';

      const res = await fetch(`/api/admin/modules/options/${optionId}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de l\'operation');
      }

      setSuccessMessage(data.message);
      await fetchAll();

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const getIcon = (iconName: string) => {
    return ICON_MAP[iconName] || Package;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Mon Abonnement</h1>
          <p className="text-white/60">Gerez votre plan et vos options</p>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-green-500/20 border border-green-500/30 rounded-xl flex items-center gap-3">
            <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
            <p className="text-green-300">{successMessage}</p>
          </div>
        )}

        {/* Pricing Summary Card */}
        {modulesData && (
          <div className="mb-8 bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl p-6 text-white shadow-xl shadow-amber-500/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-amber-200" />
                  <span className="text-amber-100 font-medium">
                    Plan {modulesData.plan?.nom || 'Non defini'}
                  </span>
                </div>
                <p className="text-4xl font-bold">
                  {modulesData.pricing.total_euros}
                  <span className="text-lg font-normal">/mois</span>
                </p>
                <div className="mt-3 text-sm text-amber-100 space-y-1">
                  <p>Plan: {(modulesData.pricing.plan / 100).toFixed(0)}EUR</p>
                  <p>Options: +{(modulesData.pricing.options / 100).toFixed(0)}EUR</p>
                </div>
              </div>
              <Euro className="w-20 h-20 text-amber-200 opacity-40" />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
          {[
            { id: 'overview', label: 'Vue d\'ensemble', icon: Zap },
            { id: 'options', label: 'Options', icon: Package },
            { id: 'plans', label: 'Plans', icon: Crown },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-amber-500 text-white'
                    : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && modulesData && (
          <div className="space-y-6">
            {/* Plan actuel */}
            <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                Plan actuel
              </h3>
              {modulesData.plan ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-white">{modulesData.plan.nom}</p>
                    <p className="text-white/60">{modulesData.plan.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-amber-400">
                      {(modulesData.plan.prix_mensuel / 100).toFixed(0)}EUR
                      <span className="text-sm font-normal text-white/40">/mois</span>
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-white/60">Aucun plan actif</p>
              )}
            </div>

            {/* Options actives */}
            <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Options actives ({modulesData.options_actives.length})
              </h3>
              {modulesData.options_actives.length > 0 ? (
                <div className="grid gap-3">
                  {modulesData.options_actives.map((opt) => {
                    const Icon = getIcon(opt.icone);
                    return (
                      <div
                        key={opt.id}
                        className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-500/20 rounded-lg">
                            <Icon className="w-5 h-5 text-green-400" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{opt.nom}</p>
                            {opt.inclus_forfait && (
                              <p className="text-sm text-white/50">{opt.inclus_forfait}</p>
                            )}
                          </div>
                        </div>
                        <p className="text-green-400 font-medium">
                          +{(opt.prix / 100).toFixed(0)}EUR/mois
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-white/60">Aucune option active</p>
              )}
            </div>

            {/* Module metier */}
            {modulesData.module_metier && (
              <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-500" />
                  Module Metier
                </h3>
                <div className="flex items-center justify-between p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                      {(() => {
                        const Icon = getIcon(modulesData.module_metier!.icone);
                        return <Icon className="w-5 h-5 text-amber-400" />;
                      })()}
                    </div>
                    <div>
                      <p className="font-medium text-white">{modulesData.module_metier.nom}</p>
                      <p className="text-sm text-white/50">{modulesData.module_metier.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-400 font-medium">
                      {(modulesData.module_metier.prix / 100).toFixed(0)}EUR
                    </p>
                    <p className="text-xs text-green-400">Paiement unique</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'options' && optionsData && (
          <div className="space-y-8">
            {/* Canaux IA */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-400" />
                Canaux IA
                <span className="text-xs text-white/40 font-normal ml-2">Paiement mensuel</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {optionsData.par_categorie.canal_ia.map((option) => (
                  <OptionCard
                    key={option.id}
                    option={option}
                    loading={actionLoading === option.id}
                    onToggle={() => toggleOption(option.id, !option.est_actif)}
                    getIcon={getIcon}
                  />
                ))}
              </div>
            </div>

            {/* Modules Metier */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                Modules Metier
                <span className="text-xs text-white/40 font-normal ml-2">Paiement unique</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {optionsData.par_categorie.module_metier.map((option) => (
                  <OptionCard
                    key={option.id}
                    option={option}
                    loading={actionLoading === option.id}
                    onToggle={() => toggleOption(option.id, !option.est_actif)}
                    getIcon={getIcon}
                    isOneTime
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'plans' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-6 border-2 transition-all ${
                  plan.est_actif
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-white/10 bg-zinc-900/50 hover:border-white/20'
                }`}
              >
                {plan.est_actif && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Plan actuel
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white">{plan.nom}</h3>
                  <p className="text-white/50 text-sm mt-1">{plan.description}</p>
                </div>

                <div className="text-center mb-6">
                  <p className="text-4xl font-bold text-white">
                    {(plan.prix_mensuel / 100).toFixed(0)}
                    <span className="text-lg font-normal text-white/40">EUR/mois</span>
                  </p>
                </div>

                <button
                  disabled={plan.est_actif}
                  className={`w-full py-3 rounded-xl font-medium transition-all ${
                    plan.est_actif
                      ? 'bg-amber-500/20 text-amber-400 cursor-default'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {plan.est_actif ? (
                    <span className="flex items-center justify-center gap-2">
                      <Check className="w-4 h-4" />
                      Actif
                    </span>
                  ) : (
                    'Changer de plan'
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-300">Comment ca marche ?</h4>
              <p className="text-sm text-blue-200/70 mt-1">
                Votre abonnement comprend un plan de base + des options au choix.
                Les canaux IA sont factures mensuellement. Les modules metier sont un paiement unique.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

// Composant OptionCard
interface OptionCardProps {
  option: Option;
  loading: boolean;
  onToggle: () => void;
  getIcon: (name: string) => any;
  isOneTime?: boolean;
}

function OptionCard({ option, loading, onToggle, getIcon, isOneTime }: OptionCardProps) {
  const Icon = getIcon(option.icone);

  return (
    <div
      className={`relative rounded-xl border-2 p-5 transition-all ${
        option.est_actif
          ? 'border-green-500 bg-green-500/10'
          : 'border-white/10 bg-zinc-900/50 hover:border-white/20'
      }`}
    >
      {/* Badge */}
      {option.est_actif && (
        <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
          <Check className="w-3 h-3" />
          Actif
        </div>
      )}

      {option.deja_paye && (
        <div className="absolute -top-2 left-4 bg-amber-500 text-white text-xs font-medium px-2 py-1 rounded-full">
          Paye
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`p-2.5 rounded-xl ${option.est_actif ? 'bg-green-500/20' : 'bg-white/5'}`}>
          <Icon className={`w-5 h-5 ${option.est_actif ? 'text-green-400' : 'text-white/60'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white truncate">{option.nom}</h4>
          <p className="text-sm text-white/50 line-clamp-2">{option.description}</p>
        </div>
      </div>

      {/* Prix */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xl font-bold text-white">
          {(option.prix / 100).toFixed(0)}EUR
          {!isOneTime && <span className="text-sm font-normal text-white/40">/mois</span>}
        </span>
        {option.inclus_forfait && (
          <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded">
            {option.inclus_forfait}
          </span>
        )}
      </div>

      {/* Button */}
      <button
        onClick={onToggle}
        disabled={loading || (option.est_actif && !option.peut_desactiver)}
        className={`w-full py-2.5 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
          !option.peut_desactiver && option.est_actif
            ? 'bg-white/5 text-white/40 cursor-not-allowed'
            : option.est_actif
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
            : 'bg-green-500 text-white hover:bg-green-600'
        }`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : !option.peut_desactiver && option.est_actif ? (
          <>
            <Lock className="w-4 h-4" />
            Deja paye
          </>
        ) : option.est_actif ? (
          <>
            <X className="w-4 h-4" />
            Desactiver
          </>
        ) : (
          <>
            <Check className="w-4 h-4" />
            Activer
          </>
        )}
      </button>
    </div>
  );
}
