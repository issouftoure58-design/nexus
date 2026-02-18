import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Hexagon } from 'lucide-react';

export default function NexusLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = 'NEXUS Operator | Connexion';
    const favicon = document.getElementById('favicon') as HTMLLinkElement;
    if (favicon) {
      favicon.href = '/favicon-nexus.svg';
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erreur de connexion');
      }

      if (data.admin.role !== 'super_admin') {
        throw new Error('Accès réservé aux opérateurs NEXUS');
      }

      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_user', JSON.stringify(data.admin));
      setLocation('/nexus/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl mb-4">
            <Hexagon size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            NEXUS Operator
          </h1>
          <p className="text-slate-500 text-sm mt-1">Panneau d'administration plateforme</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4" autoComplete="off" data-form-type="other">
          {/* Hidden honeypot fields */}
          <input type="text" name="username" autoComplete="username" style={{ position: 'absolute', left: '-9999px', opacity: 0 }} tabIndex={-1} />
          <input type="password" name="password" autoComplete="current-password" style={{ position: 'absolute', left: '-9999px', opacity: 0 }} tabIndex={-1} />

          {error && (
            <div className="p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-slate-400 mb-1">Email</label>
            <input
              type="text"
              inputMode="email"
              name="operator_id_field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} data-form-type="other" data-lpignore="true" data-1p-ignore="true"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
              placeholder="operator@nexus.dev"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Mot de passe</label>
            <input
              type="password"
              name="operator_key_field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password" data-form-type="other" data-lpignore="true" data-1p-ignore="true"
              className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg hover:from-cyan-400 hover:to-blue-500 transition disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
