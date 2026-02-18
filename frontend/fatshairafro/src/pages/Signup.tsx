import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { ArrowLeft, ArrowRight, Check, Building2, User, Mail, Lock, Phone, Loader2 } from 'lucide-react';

interface Plan {
  id: string;
  nom: string;
  prix_mensuel: number;
  prix_annuel: number;
  features: string[];
  populaire: boolean;
}

interface Secteur {
  id: string;
  nom: string;
  description: string;
  icon: string;
}

export default function Signup() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const planFromUrl = searchParams.get('plan') || 'pro';
  const periodeFromUrl = (searchParams.get('periode') as 'monthly' | 'yearly') || 'monthly';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [secteurs, setSecteurs] = useState<Secteur[]>([]);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    company_name: '',
    secteur_id: 'salon-coiffure',
    email: '',
    password: '',
    passwordConfirm: '',
    prenom: '',
    nom: '',
    telephone: '',
    plan_id: planFromUrl,
    periode: periodeFromUrl
  });

  // Charger plans et secteurs
  useEffect(() => {
    async function loadData() {
      try {
        const [plansRes, secteursRes] = await Promise.all([
          fetch('/api/signup/plans'),
          fetch('/api/signup/secteurs')
        ]);

        const plansData = await plansRes.json();
        const secteursData = await secteursRes.json();

        if (plansData.success) setPlans(plansData.plans);
        if (secteursData.success) setSecteurs(secteursData.secteurs);
      } catch (err) {
        console.error('Erreur chargement donnees:', err);
      }
    }
    loadData();
  }, []);

  const selectedPlan = plans.find(p => p.id === formData.plan_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.passwordConfirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (formData.password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caracteres');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: formData.company_name,
          secteur_id: formData.secteur_id,
          email: formData.email,
          password: formData.password,
          prenom: formData.prenom,
          nom: formData.nom,
          telephone: formData.telephone,
          plan_id: formData.plan_id,
          periode: formData.periode
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erreur inscription');
      }

      // Si checkout Stripe disponible, rediriger
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        // Sinon, aller au dashboard
        setLocation('/admin/login?signup=success');
      }

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && (!formData.company_name || !formData.secteur_id)) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    if (step === 2 && (!formData.email || !formData.password)) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    setError('');
    setStep(step + 1);
  };

  const prevStep = () => {
    setError('');
    setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/">
            <a className="inline-flex items-center text-indigo-600 hover:text-indigo-700 mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </a>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Creez votre compte NEXUS
          </h1>
          <p className="text-gray-600">
            14 jours d'essai gratuit - Sans engagement
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-16 rounded-full transition-colors ${
                s <= step ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Step 1: Entreprise */}
            {step === 1 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <Building2 className="w-5 h-5 mr-2 text-indigo-600" />
                  Votre entreprise
                </h2>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom de l'entreprise *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.company_name}
                    onChange={e => setFormData({...formData, company_name: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Ma Super Entreprise"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Secteur d'activite *
                  </label>
                  <select
                    required
                    value={formData.secteur_id}
                    onChange={e => setFormData({...formData, secteur_id: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {secteurs.map(s => (
                      <option key={s.id} value={s.id}>{s.nom}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={nextStep}
                  className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center justify-center"
                >
                  Continuer
                  <ArrowRight className="w-5 h-5 ml-2" />
                </button>
              </div>
            )}

            {/* Step 2: Compte */}
            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2 text-indigo-600" />
                  Votre compte
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prenom *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.prenom}
                      onChange={e => setFormData({...formData, prenom: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nom *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.nom}
                      onChange={e => setFormData({...formData, nom: e.target.value})}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="w-4 h-4 inline mr-1" />
                    Email professionnel *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="contact@entreprise.fr"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="w-4 h-4 inline mr-1" />
                    Telephone
                  </label>
                  <input
                    type="tel"
                    value={formData.telephone}
                    onChange={e => setFormData({...formData, telephone: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="+33 6 12 34 56 78"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Lock className="w-4 h-4 inline mr-1" />
                    Mot de passe *
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Minimum 8 caracteres"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirmer le mot de passe *
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.passwordConfirm}
                    onChange={e => setFormData({...formData, passwordConfirm: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={prevStep}
                    className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    Retour
                  </button>
                  <button
                    type="button"
                    onClick={nextStep}
                    className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center justify-center"
                  >
                    Continuer
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Plan */}
            {step === 3 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Confirmez votre plan
                </h2>

                {/* Plan selectionne */}
                <div className="p-4 bg-indigo-50 border-2 border-indigo-600 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">
                        Plan {selectedPlan?.nom || formData.plan_id}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {formData.periode === 'yearly' ? 'Facturation annuelle' : 'Facturation mensuelle'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-indigo-600">
                        {formData.periode === 'yearly'
                          ? Math.round((selectedPlan?.prix_annuel || 0) / 12)
                          : selectedPlan?.prix_mensuel || 0}
                        EUR/mois
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {selectedPlan?.features.slice(0, 5).map((feature, i) => (
                      <div key={i} className="flex items-center text-sm text-gray-700">
                        <Check className="w-4 h-4 text-green-500 mr-2" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Toggle periode */}
                <div className="flex items-center justify-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, periode: 'monthly'})}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      formData.periode === 'monthly'
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Mensuel
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({...formData, periode: 'yearly'})}
                    className={`px-4 py-2 rounded-lg font-medium transition ${
                      formData.periode === 'yearly'
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Annuel (-17%)
                  </button>
                </div>

                {/* Resume */}
                <div className="p-4 bg-gray-50 rounded-lg text-sm">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Entreprise</span>
                    <span className="font-medium">{formData.company_name}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Email</span>
                    <span className="font-medium">{formData.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Essai gratuit</span>
                    <span className="font-medium text-green-600">14 jours</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={prevStep}
                    className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    Retour
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center justify-center disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Creation...
                      </>
                    ) : (
                      'Creer mon compte'
                    )}
                  </button>
                </div>

                <p className="text-xs text-gray-500 text-center">
                  En creant votre compte, vous acceptez nos{' '}
                  <a href="/cgv" className="text-indigo-600 hover:underline">CGV</a>
                  {' '}et{' '}
                  <a href="/confidentialite" className="text-indigo-600 hover:underline">politique de confidentialite</a>
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Login link */}
        <p className="text-center mt-6 text-gray-600">
          Deja un compte ?{' '}
          <Link href="/admin/login">
            <a className="text-indigo-600 hover:underline font-medium">
              Se connecter
            </a>
          </Link>
        </p>
      </div>
    </div>
  );
}
