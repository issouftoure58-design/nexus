import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import {
  Loader2, AlertCircle, Lock, Mail, Building2, User, Phone,
  Sparkles, ArrowRight, ArrowLeft, Check, Scissors, UtensilsCrossed,
  Stethoscope, Car, ShoppingBag, Wrench, HelpCircle
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Types de métiers avec icônes
const BUSINESS_TYPES = [
  { id: 'salon_coiffure', name: 'Salon de coiffure', icon: Scissors, emoji: '✂️' },
  { id: 'institut_beaute', name: 'Institut de beauté', icon: Sparkles, emoji: '💅' },
  { id: 'restaurant', name: 'Restaurant', icon: UtensilsCrossed, emoji: '🍽️' },
  { id: 'medical', name: 'Cabinet médical', icon: Stethoscope, emoji: '🏥' },
  { id: 'garage', name: 'Garage auto', icon: Car, emoji: '🔧' },
  { id: 'commerce', name: 'Commerce', icon: ShoppingBag, emoji: '🛍️' },
  { id: 'artisan', name: 'Artisan', icon: Wrench, emoji: '🔨' },
  { id: 'autre', name: 'Autre', icon: HelpCircle, emoji: '📋' },
];

// Étapes du formulaire
type Step = 'business' | 'info' | 'account';

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // État du formulaire
  const [step, setStep] = useState<Step>('business');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Données du formulaire
  const [businessType, setBusinessType] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [telephone, setTelephone] = useState('');

  // Validation email
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  // Récupérer le plan depuis l'URL si présent
  const planId = searchParams.get('plan') || 'starter';

  // Vérifier disponibilité email
  useEffect(() => {
    if (!email || !email.includes('@')) {
      setEmailAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingEmail(true);
      try {
        const res = await fetch(`${API_URL}/signup/check-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        setEmailAvailable(data.available);
      } catch {
        setEmailAvailable(null);
      } finally {
        setCheckingEmail(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [email]);

  // Soumettre le formulaire
  const handleSubmit = async () => {
    setError('');

    // Validation
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_URL}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          secteur_id: businessType,
          email,
          password,
          prenom,
          nom,
          telephone,
          plan_id: planId,
          periode: 'monthly',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la création du compte');
      }

      // Stocker les infos pour l'onboarding
      localStorage.setItem('nexus_signup', JSON.stringify({
        tenant_id: data.tenant_id,
        email: data.admin.email,
        company_name: companyName,
        business_type: businessType,
      }));

      // Rediriger vers checkout Stripe ou onboarding
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        // Connexion automatique et redirection vers onboarding
        navigate('/onboarding');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création du compte');
    } finally {
      setIsLoading(false);
    }
  };

  // Navigation entre étapes
  const nextStep = () => {
    if (step === 'business' && businessType) {
      setStep('info');
    } else if (step === 'info' && companyName) {
      setStep('account');
    }
  };

  const prevStep = () => {
    if (step === 'info') setStep('business');
    if (step === 'account') setStep('info');
  };

  const canProceed = () => {
    if (step === 'business') return !!businessType;
    if (step === 'info') return !!companyName;
    if (step === 'account') {
      return email && password && confirmPassword && password === confirmPassword && emailAvailable !== false;
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-lg relative z-10 shadow-2xl border-0 bg-white/95 backdrop-blur">
        <CardHeader className="text-center pb-2">
          {/* Logo */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Créer votre compte NEXUS</CardTitle>
          <CardDescription>
            {step === 'business' && 'Quel est votre métier ?'}
            {step === 'info' && 'Parlez-nous de votre entreprise'}
            {step === 'account' && 'Créez votre compte administrateur'}
          </CardDescription>

          {/* Progress indicator */}
          <div className="flex justify-center gap-2 mt-4">
            {['business', 'info', 'account'].map((s, i) => (
              <div
                key={s}
                className={`h-2 w-16 rounded-full transition-colors ${
                  s === step
                    ? 'bg-cyan-500'
                    : i < ['business', 'info', 'account'].indexOf(step)
                    ? 'bg-cyan-300'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Étape 1: Type de business */}
          {step === 'business' && (
            <div className="grid grid-cols-2 gap-3">
              {BUSINESS_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = businessType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setBusinessType(type.id)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{type.emoji}</span>
                      <span className={`font-medium ${isSelected ? 'text-cyan-700' : 'text-gray-700'}`}>
                        {type.name}
                      </span>
                    </div>
                    {isSelected && (
                      <Check className="absolute top-2 right-2 w-5 h-5 text-cyan-500" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Étape 2: Infos entreprise */}
          {step === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de votre entreprise *
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Mon Super Salon"
                    className="pl-10"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prénom
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      value={prenom}
                      onChange={(e) => setPrenom(e.target.value)}
                      placeholder="Marie"
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom
                  </label>
                  <Input
                    type="text"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    placeholder="Dupont"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Téléphone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="tel"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    placeholder="06 12 34 56 78"
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Étape 3: Compte */}
          {step === 'account' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="marie@monsalon.fr"
                    className={`pl-10 ${
                      emailAvailable === false ? 'border-red-500' : ''
                    }`}
                    required
                    autoFocus
                  />
                  {checkingEmail && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                  )}
                  {emailAvailable === true && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                </div>
                {emailAvailable === false && (
                  <p className="text-sm text-red-600 mt-1">Cet email est déjà utilisé</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mot de passe *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum 8 caractères</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmer le mot de passe *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`pl-10 ${
                      confirmPassword && password !== confirmPassword ? 'border-red-500' : ''
                    }`}
                    required
                  />
                  {confirmPassword && password === confirmPassword && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-6 pt-4 border-t">
            {step !== 'business' ? (
              <Button variant="outline" onClick={prevStep}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
            ) : (
              <div />
            )}

            {step !== 'account' ? (
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
              >
                Continuer
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed() || isLoading}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Créer mon compte
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Lien connexion */}
          <div className="mt-6 text-center text-sm text-gray-600">
            Déjà un compte ?{' '}
            <a href="/login" className="text-cyan-600 hover:text-cyan-700 font-medium">
              Se connecter
            </a>
          </div>

          {/* Trial info */}
          <div className="mt-4 p-3 bg-cyan-50 rounded-lg text-center">
            <p className="text-sm text-cyan-700">
              <Sparkles className="inline h-4 w-4 mr-1" />
              Essai gratuit 14 jours • Sans carte bancaire
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
