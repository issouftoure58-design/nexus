import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Building2, Clock, Users, Palette, Rocket,
  Check, ChevronRight, ChevronLeft, Loader2,
  MapPin, Phone, Mail, Globe, Instagram, Facebook
} from 'lucide-react';

// Types
interface BusinessInfo {
  nom: string;
  description: string;
  adresse: string;
  telephone: string;
  email: string;
  site_web: string;
  instagram: string;
  facebook: string;
}

interface Horaires {
  [jour: string]: { ouvert: boolean; debut: string; fin: string };
}

interface Service {
  id: string;
  nom: string;
  duree: number;
  prix: number;
  description: string;
}

interface Theme {
  couleur_primaire: string;
  logo_url: string;
}

// Steps configuration
const STEPS = [
  { id: 1, title: 'Votre entreprise', icon: Building2, description: 'Informations de base' },
  { id: 2, title: 'Horaires', icon: Clock, description: 'Vos disponibilites' },
  { id: 3, title: 'Services', icon: Users, description: 'Ce que vous proposez' },
  { id: 4, title: 'Personnalisation', icon: Palette, description: 'Votre identite visuelle' },
  { id: 5, title: 'Terminé !', icon: Rocket, description: 'Pret a demarrer' },
];

const JOURS = [
  { id: 'lundi', label: 'Lundi' },
  { id: 'mardi', label: 'Mardi' },
  { id: 'mercredi', label: 'Mercredi' },
  { id: 'jeudi', label: 'Jeudi' },
  { id: 'vendredi', label: 'Vendredi' },
  { id: 'samedi', label: 'Samedi' },
  { id: 'dimanche', label: 'Dimanche' },
];

const DEFAULT_HORAIRES: Horaires = {
  lundi: { ouvert: true, debut: '09:00', fin: '18:00' },
  mardi: { ouvert: true, debut: '09:00', fin: '18:00' },
  mercredi: { ouvert: true, debut: '09:00', fin: '18:00' },
  jeudi: { ouvert: true, debut: '09:00', fin: '18:00' },
  vendredi: { ouvert: true, debut: '09:00', fin: '18:00' },
  samedi: { ouvert: true, debut: '09:00', fin: '14:00' },
  dimanche: { ouvert: false, debut: '09:00', fin: '18:00' },
};

const COULEURS_PREDEFINIES = [
  '#06B6D4', // Cyan
  '#8B5CF6', // Purple
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#14B8A6', // Teal
];

export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form data
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    nom: '',
    description: '',
    adresse: '',
    telephone: '',
    email: '',
    site_web: '',
    instagram: '',
    facebook: '',
  });

  const [horaires, setHoraires] = useState<Horaires>(DEFAULT_HORAIRES);

  const [services, setServices] = useState<Service[]>([
    { id: '1', nom: '', duree: 60, prix: 0, description: '' },
  ]);

  const [theme, setTheme] = useState<Theme>({
    couleur_primaire: '#06B6D4',
    logo_url: '',
  });

  // Load existing data if any
  useEffect(() => {
    loadExistingData();
  }, []);

  const loadExistingData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/onboarding/status', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.businessInfo) setBusinessInfo(data.businessInfo);
        if (data.horaires) setHoraires(data.horaires);
        if (data.services?.length) setServices(data.services);
        if (data.theme) setTheme(data.theme);
        if (data.currentStep) setCurrentStep(data.currentStep);
      }
    } catch (error) {
      console.error('Error loading onboarding data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveStepData = async (stepData: object, step: number) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/onboarding/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ step, data: stepData }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde');
      }

      return true;
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de sauvegarder. Reessayez.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    let stepData = {};
    let isValid = true;

    switch (currentStep) {
      case 1:
        if (!businessInfo.nom.trim()) {
          toast({
            title: 'Champ requis',
            description: 'Le nom de votre entreprise est obligatoire',
            variant: 'destructive',
          });
          isValid = false;
        }
        stepData = { businessInfo };
        break;
      case 2:
        stepData = { horaires };
        break;
      case 3:
        const validServices = services.filter(s => s.nom.trim());
        if (validServices.length === 0) {
          toast({
            title: 'Champ requis',
            description: 'Ajoutez au moins un service',
            variant: 'destructive',
          });
          isValid = false;
        }
        stepData = { services: validServices };
        break;
      case 4:
        stepData = { theme };
        break;
    }

    if (!isValid) return;

    const saved = await saveStepData(stepData, currentStep);
    if (saved && currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/onboarding/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la finalisation');
      }

      toast({
        title: 'Configuration terminee !',
        description: 'Bienvenue sur NEXUS',
      });

      navigate('/admin/dashboard');
    } catch (error) {
      console.error('Finish error:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de finaliser. Reessayez.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const addService = () => {
    setServices([
      ...services,
      { id: Date.now().toString(), nom: '', duree: 60, prix: 0, description: '' },
    ]);
  };

  const updateService = (id: string, field: keyof Service, value: string | number) => {
    setServices(services.map(s => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const removeService = (id: string) => {
    if (services.length > 1) {
      setServices(services.filter(s => s.id !== id));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Configurez votre espace NEXUS
          </h1>
          <p className="text-gray-600">
            5 etapes simples pour demarrer
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;

            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isActive
                        ? 'bg-cyan-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span
                    className={`text-xs mt-1 hidden sm:block ${
                      isActive ? 'text-cyan-600 font-semibold' : 'text-gray-500'
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`w-8 sm:w-16 h-0.5 mx-2 ${
                      currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8 mb-6">
          {/* Step 1: Business Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Informations de votre entreprise</h2>
                <p className="text-gray-600 text-sm">
                  Ces informations seront affichees sur votre page publique
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom de l'entreprise *
                  </label>
                  <Input
                    value={businessInfo.nom}
                    onChange={e => setBusinessInfo({ ...businessInfo, nom: e.target.value })}
                    placeholder="Ex: Salon Beaute Paris"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <Textarea
                    value={businessInfo.description}
                    onChange={e => setBusinessInfo({ ...businessInfo, description: e.target.value })}
                    placeholder="Decrivez votre activite en quelques lignes..."
                    rows={3}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Adresse
                  </label>
                  <Input
                    value={businessInfo.adresse}
                    onChange={e => setBusinessInfo({ ...businessInfo, adresse: e.target.value })}
                    placeholder="123 rue Example, 75001 Paris"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Telephone
                  </label>
                  <Input
                    value={businessInfo.telephone}
                    onChange={e => setBusinessInfo({ ...businessInfo, telephone: e.target.value })}
                    placeholder="06 12 34 56 78"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Mail className="w-4 h-4 inline mr-1" />
                    Email
                  </label>
                  <Input
                    type="email"
                    value={businessInfo.email}
                    onChange={e => setBusinessInfo({ ...businessInfo, email: e.target.value })}
                    placeholder="contact@exemple.fr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Globe className="w-4 h-4 inline mr-1" />
                    Site web
                  </label>
                  <Input
                    value={businessInfo.site_web}
                    onChange={e => setBusinessInfo({ ...businessInfo, site_web: e.target.value })}
                    placeholder="https://exemple.fr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Instagram className="w-4 h-4 inline mr-1" />
                    Instagram
                  </label>
                  <Input
                    value={businessInfo.instagram}
                    onChange={e => setBusinessInfo({ ...businessInfo, instagram: e.target.value })}
                    placeholder="@votrecompte"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Hours */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Vos horaires d'ouverture</h2>
                <p className="text-gray-600 text-sm">
                  Definissez quand les clients peuvent prendre RDV
                </p>
              </div>

              <div className="space-y-3">
                {JOURS.map(jour => (
                  <div
                    key={jour.id}
                    className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                  >
                    <label className="flex items-center gap-2 w-28">
                      <input
                        type="checkbox"
                        checked={horaires[jour.id]?.ouvert || false}
                        onChange={e =>
                          setHoraires({
                            ...horaires,
                            [jour.id]: { ...horaires[jour.id], ouvert: e.target.checked },
                          })
                        }
                        className="w-4 h-4 text-cyan-600 rounded"
                      />
                      <span className="font-medium">{jour.label}</span>
                    </label>

                    {horaires[jour.id]?.ouvert ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={horaires[jour.id]?.debut || '09:00'}
                          onChange={e =>
                            setHoraires({
                              ...horaires,
                              [jour.id]: { ...horaires[jour.id], debut: e.target.value },
                            })
                          }
                          className="w-28"
                        />
                        <span className="text-gray-500">a</span>
                        <Input
                          type="time"
                          value={horaires[jour.id]?.fin || '18:00'}
                          onChange={e =>
                            setHoraires({
                              ...horaires,
                              [jour.id]: { ...horaires[jour.id], fin: e.target.value },
                            })
                          }
                          className="w-28"
                        />
                      </div>
                    ) : (
                      <span className="text-gray-400 italic">Ferme</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Services */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Vos services</h2>
                <p className="text-gray-600 text-sm">
                  Ajoutez les prestations que vous proposez
                </p>
              </div>

              <div className="space-y-4">
                {services.map((service, idx) => (
                  <div key={service.id} className="p-4 bg-gray-50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">
                        Service {idx + 1}
                      </span>
                      {services.length > 1 && (
                        <button
                          onClick={() => removeService(service.id)}
                          className="text-red-500 text-sm hover:underline"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <Input
                          value={service.nom}
                          onChange={e => updateService(service.id, 'nom', e.target.value)}
                          placeholder="Nom du service *"
                        />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Input
                            type="number"
                            value={service.duree}
                            onChange={e =>
                              updateService(service.id, 'duree', parseInt(e.target.value) || 0)
                            }
                            placeholder="Duree"
                            min={15}
                            step={15}
                          />
                          <span className="text-xs text-gray-500">min</span>
                        </div>
                        <div className="flex-1">
                          <Input
                            type="number"
                            value={service.prix}
                            onChange={e =>
                              updateService(service.id, 'prix', parseFloat(e.target.value) || 0)
                            }
                            placeholder="Prix"
                            min={0}
                            step={1}
                          />
                          <span className="text-xs text-gray-500">EUR</span>
                        </div>
                      </div>
                    </div>

                    <Textarea
                      value={service.description}
                      onChange={e => updateService(service.id, 'description', e.target.value)}
                      placeholder="Description (optionnel)"
                      rows={2}
                    />
                  </div>
                ))}

                <Button variant="outline" onClick={addService} className="w-full">
                  + Ajouter un service
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Theme */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Personnalisez votre espace</h2>
                <p className="text-gray-600 text-sm">
                  Choisissez les couleurs de votre interface
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Couleur principale
                </label>
                <div className="flex flex-wrap gap-3">
                  {COULEURS_PREDEFINIES.map(couleur => (
                    <button
                      key={couleur}
                      onClick={() => setTheme({ ...theme, couleur_primaire: couleur })}
                      className={`w-10 h-10 rounded-full border-2 transition-all ${
                        theme.couleur_primaire === couleur
                          ? 'border-gray-900 scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: couleur }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ou entrez un code couleur personnalise
                </label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="color"
                    value={theme.couleur_primaire}
                    onChange={e => setTheme({ ...theme, couleur_primaire: e.target.value })}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={theme.couleur_primaire}
                    onChange={e => setTheme({ ...theme, couleur_primaire: e.target.value })}
                    placeholder="#06B6D4"
                    className="w-28"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL du logo (optionnel)
                </label>
                <Input
                  value={theme.logo_url}
                  onChange={e => setTheme({ ...theme, logo_url: e.target.value })}
                  placeholder="https://exemple.fr/logo.png"
                />
                {theme.logo_url && (
                  <div className="mt-2">
                    <img
                      src={theme.logo_url}
                      alt="Logo preview"
                      className="h-16 object-contain"
                      onError={e => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}
              </div>

              {/* Preview */}
              <div className="mt-6 p-4 border rounded-lg">
                <p className="text-sm text-gray-500 mb-2">Apercu</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: theme.couleur_primaire }}
                  >
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold">{businessInfo.nom || 'Votre entreprise'}</p>
                    <p className="text-sm text-gray-500">{businessInfo.description || 'Description'}</p>
                  </div>
                </div>
                <button
                  className="mt-4 px-6 py-2 rounded-lg text-white font-medium"
                  style={{ backgroundColor: theme.couleur_primaire }}
                >
                  Bouton exemple
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {currentStep === 5 && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Rocket className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Configuration terminee !
              </h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                Votre espace NEXUS est pret. Vous pouvez maintenant acceder a votre
                dashboard et commencer a gerer votre activite.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-lg mx-auto mb-8">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <Check className="w-5 h-5 text-green-500 mb-2" />
                  <p className="font-medium">Entreprise</p>
                  <p className="text-sm text-gray-500">{businessInfo.nom || 'Configure'}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <Check className="w-5 h-5 text-green-500 mb-2" />
                  <p className="font-medium">Services</p>
                  <p className="text-sm text-gray-500">
                    {services.filter(s => s.nom).length} services
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <Check className="w-5 h-5 text-green-500 mb-2" />
                  <p className="font-medium">Horaires</p>
                  <p className="text-sm text-gray-500">
                    {Object.values(horaires).filter(h => h.ouvert).length} jours
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1 || saving}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Precedent
          </Button>

          {currentStep < 5 ? (
            <Button
              onClick={handleNext}
              disabled={saving}
              className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  Suivant
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleFinish}
              disabled={saving}
              className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Finalisation...
                </>
              ) : (
                <>
                  Acceder au dashboard
                  <Rocket className="w-4 h-4" />
                </>
              )}
            </Button>
          )}
        </div>

        {/* Skip option */}
        <div className="text-center mt-4">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Passer la configuration (je ferai plus tard)
          </button>
        </div>
      </div>
    </div>
  );
}
