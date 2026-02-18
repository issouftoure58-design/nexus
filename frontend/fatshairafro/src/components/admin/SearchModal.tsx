import { useState, useEffect, useRef } from 'react';
import { Search, X, User, Calendar, Scissors } from 'lucide-react';
import { Link } from 'wouter';

interface SearchResults {
  clients: Array<{ id: number; nom: string; prenom: string; telephone: string; email?: string }>;
  reservations: Array<{ id: number; date: string; heure: string; service_nom: string; statut: string; clients?: { nom: string; prenom: string; telephone: string } }>;
  services: Array<{ id: number; nom: string; duree: number; prix: number }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function SearchModal({ open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults(null);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) { setResults(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('admin_token');
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) setResults(data.results);
      } catch { /* ignore */ }
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const hasResults = results && (results.clients.length > 0 || results.reservations.length > 0 || results.services.length > 0);

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh] z-50" onClick={onClose}>
      <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[60vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10">
          <Search className="w-5 h-5 text-amber-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher clients, RDV, services..."
            className="flex-1 bg-transparent outline-none text-white text-lg placeholder:text-white/40"
          />
          <kbd className="hidden sm:block px-2 py-0.5 text-xs text-white/40 bg-white/10 rounded border border-white/10">ESC</kbd>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition"><X className="w-5 h-5 text-white/50" /></button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading && <div className="text-center py-8 text-white/50">Recherche...</div>}

          {!loading && query.length >= 2 && !hasResults && (
            <div className="text-center py-8 text-white/50">Aucun résultat pour "{query}"</div>
          )}

          {!loading && hasResults && (
            <div className="space-y-4">
              {/* Clients */}
              {results!.clients.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 px-2">Clients</h3>
                  {results!.clients.map(c => (
                    <Link key={c.id} href="/admin/clients" onClick={onClose}
                      className="flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl transition cursor-pointer">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white text-sm">{c.prenom} {c.nom}</div>
                        <div className="text-xs text-white/50 truncate">{c.telephone}{c.email ? ` · ${c.email}` : ''}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Reservations */}
              {results!.reservations.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 px-2">Rendez-vous</h3>
                  {results!.reservations.map(r => (
                    <Link key={r.id} href="/admin/planning" onClick={onClose}
                      className="flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl transition cursor-pointer">
                      <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-green-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white text-sm">{formatDate(r.date)} à {r.heure}</div>
                        <div className="text-xs text-white/50 truncate">
                          {r.clients ? `${r.clients.prenom} ${r.clients.nom} · ` : ''}{r.service_nom}
                        </div>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.statut === 'confirme' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {r.statut}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Services */}
              {results!.services.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 px-2">Services</h3>
                  {results!.services.map(s => (
                    <Link key={s.id} href="/admin/services" onClick={onClose}
                      className="flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl transition cursor-pointer">
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Scissors className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white text-sm">{s.nom}</div>
                        <div className="text-xs text-white/50">{s.prix}€ · {s.duree}min</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
