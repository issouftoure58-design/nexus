import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Check, Shield } from 'lucide-react';
import { employeeAuthApi, employeeApiClient } from '../../lib/employeeApi';

export default function EmployeeSetupPassword() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    match: password.length > 0 && password === confirmPassword,
  };

  const allValid = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!allValid) {
      setError('Veuillez respecter tous les criteres du mot de passe');
      return;
    }

    setLoading(true);
    try {
      const result = await employeeAuthApi.setupPassword(inviteToken, password);
      if (result.token) {
        employeeApiClient.setToken(result.token);
      }
      navigate('/employee/planning');
    } catch (err: any) {
      setError(err.message || 'Erreur activation du compte');
    } finally {
      setLoading(false);
    }
  };

  if (!inviteToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center max-w-md">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Lien invalide</h2>
          <p className="text-gray-500">
            Ce lien d'activation n'est pas valide. Demandez a votre employeur de renvoyer l'invitation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Activez votre compte</h1>
          <p className="text-gray-500 mt-1">Choisissez un mot de passe pour acceder a votre espace</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg border border-red-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition pr-10"
                  placeholder="Choisir un mot de passe"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmer le mot de passe</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                placeholder="Confirmer le mot de passe"
              />
            </div>

            {/* Password checklist */}
            <div className="space-y-1.5">
              {[
                { key: 'length', label: 'Au moins 8 caracteres' },
                { key: 'upper', label: 'Une majuscule' },
                { key: 'lower', label: 'Une minuscule' },
                { key: 'number', label: 'Un chiffre' },
                { key: 'match', label: 'Les mots de passe correspondent' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <Check
                    className={`w-4 h-4 ${
                      passwordChecks[key as keyof typeof passwordChecks]
                        ? 'text-emerald-500'
                        : 'text-gray-300'
                    }`}
                  />
                  <span
                    className={
                      passwordChecks[key as keyof typeof passwordChecks]
                        ? 'text-emerald-700'
                        : 'text-gray-500'
                    }
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || !allValid}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Activer mon compte'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
