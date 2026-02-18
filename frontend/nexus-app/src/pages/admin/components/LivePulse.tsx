/**
 * NEXUS PULSE - Interface d'événements temps réel
 *
 * Affiche le flux live de tous les événements NEXUS :
 * - Conversations IA
 * - Optimisations (cache, routing, prompts)
 * - Coûts et économies
 * - Sécurité
 */

import { useState, useEffect, useRef } from 'react';

interface LiveEvent {
  id: string;
  type: string;
  category: string;
  icon: string;
  timestamp: string;
  action: string;
  [key: string]: any;
}

interface Stats {
  total: number;
  last5min: number;
  last1min: number;
  byType: Record<string, number>;
  latestTimestamp?: string;
  session?: {
    totalConversations: number;
    totalCacheHits: number;
    totalSavings: number;
    haikuCalls: number;
    sonnetCalls: number;
    haikuPercentage: string;
    uptimeMinutes: number;
  };
}

const authHeaders = () => ({
  'Authorization': `Bearer ${localStorage.getItem('admin_token')}`,
});

export default function LivePulse() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [isPaused, setIsPaused] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Charger événements initiaux
    fetchEvents();

    // Polling toutes les 2 secondes (si pas en pause)
    const interval = setInterval(() => {
      if (!isPaused) {
        fetchEvents();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isPaused, filter]);

  const fetchEvents = async () => {
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (filter !== 'all') {
        params.append('type', filter);
      }

      const response = await fetch(`/api/sentinel/live/events?${params}`, {
        headers: authHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
        setStats(data.stats);
        setIsLive(true);
      } else {
        setIsLive(false);
      }
    } catch (err) {
      setIsLive(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      ai: 'bg-purple-100 text-purple-800 border-purple-300',
      system: 'bg-blue-100 text-blue-800 border-blue-300',
      performance: 'bg-green-100 text-green-800 border-green-300',
      security: 'bg-red-100 text-red-800 border-red-300',
      financial: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      error: 'bg-red-200 text-red-900 border-red-400'
    };
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const formatTimestamp = (timestamp: string) => {
    const now = new Date();
    const eventTime = new Date(timestamp);
    const diff = Math.floor((now.getTime() - eventTime.getTime()) / 1000);

    if (diff < 5) return 'maintenant';
    if (diff < 60) return `il y a ${diff}s`;
    if (diff < 3600) return `il y a ${Math.floor(diff / 60)}min`;
    return eventTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const eventTypes = [
    { value: 'all', label: 'Tous', icon: '📊' },
    { value: 'conversation', label: 'Conversations', icon: '💬' },
    { value: 'optimization', label: 'Optimisations', icon: '⚡' },
    { value: 'cache', label: 'Cache', icon: '💾' },
    { value: 'cost', label: 'Coûts', icon: '💰' },
    { value: 'security', label: 'Sécurité', icon: '🛡️' },
    { value: 'error', label: 'Erreurs', icon: '⚠️' }
  ];

  return (
    <div className="space-y-4">
      {/* Header avec stats */}
      <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="text-5xl animate-pulse">🫀</div>
              {isLive && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
                </span>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">NEXUS PULSE</h2>
              <p className="text-purple-100 text-sm">Flux d'événements temps réel</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Live */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isLive ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-sm font-medium">{isLive ? 'LIVE' : 'Offline'}</span>
            </div>

            {/* Bouton Pause */}
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isPaused ? 'bg-yellow-500/30 text-yellow-100' : 'bg-white/10 hover:bg-white/20'
              }`}
            >
              {isPaused ? '▶️ Reprendre' : '⏸️ Pause'}
            </button>
          </div>
        </div>

        {/* Stats rapides */}
        {stats?.session && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs text-purple-200">Conversations</div>
              <div className="text-xl font-bold">{stats.session.totalConversations}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs text-purple-200">Cache Hits</div>
              <div className="text-xl font-bold">{stats.session.totalCacheHits}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs text-purple-200">Haiku %</div>
              <div className="text-xl font-bold">{stats.session.haikuPercentage}%</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs text-purple-200">Économies</div>
              <div className="text-xl font-bold text-green-300">{stats.session.totalSavings.toFixed(2)}€</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <div className="text-xs text-purple-200">Dernière 1min</div>
              <div className="text-xl font-bold">{stats.last1min} évts</div>
            </div>
          </div>
        )}
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {eventTypes.map(type => (
          <button
            key={type.value}
            onClick={() => setFilter(type.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === type.value
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {type.icon} {type.label}
            {stats?.byType?.[type.value] && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-black/10 text-xs">
                {stats.byType[type.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Feed d'événements */}
      <div
        ref={feedRef}
        className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden"
      >
        <div className="max-h-[600px] overflow-y-auto">
          {events.length === 0 ? (
            <div className="p-16 text-center text-gray-500">
              <div className="text-6xl mb-4 animate-bounce">⏳</div>
              <div className="text-lg font-medium">En attente d'événements...</div>
              <div className="text-sm mt-2">
                Les événements apparaîtront ici dès qu'une conversation aura lieu
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {events.map((event, index) => (
                <div
                  key={event.id}
                  className={`p-4 hover:bg-gray-50 transition-all ${
                    index === 0 && !isPaused ? 'animate-slideIn bg-blue-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="text-2xl flex-shrink-0 pt-0.5">{event.icon}</div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getCategoryColor(event.category)}`}>
                            {event.type}
                          </span>
                          {event.channel && (
                            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
                              {event.channel}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatTimestamp(event.timestamp)}
                        </span>
                      </div>

                      <div className="font-medium text-gray-900 mb-1">
                        {event.action}
                      </div>

                      {/* Détails selon le type */}
                      <div className="text-sm text-gray-600 space-y-0.5">
                        {event.question && (
                          <div className="text-gray-500 truncate italic">
                            "{event.question}..."
                          </div>
                        )}
                        {event.model && (
                          <div className="flex items-center gap-1">
                            <span className={`inline-block w-2 h-2 rounded-full ${
                              event.model === 'Haiku' ? 'bg-green-500' : 'bg-purple-500'
                            }`} />
                            Modèle: {event.model}
                          </div>
                        )}
                        {event.tokens !== undefined && event.tokens > 0 && (
                          <div>🎯 {event.tokens.toLocaleString()} tokens</div>
                        )}
                        {event.responseTime && (
                          <div>⏱️ {event.responseTime}</div>
                        )}
                        {event.cost !== undefined && parseFloat(event.cost) > 0 && (
                          <div className="font-semibold text-purple-600">
                            💳 Coût: {event.cost}€
                          </div>
                        )}
                        {event.saving !== undefined && parseFloat(event.saving) > 0 && (
                          <div className="font-semibold text-green-600">
                            💚 Économie: {event.saving}€ ({event.percentage}%)
                          </div>
                        )}
                        {event.tokensSaved !== undefined && event.tokensSaved > 0 && (
                          <div className="text-green-600">
                            ✂️ -{event.tokensSaved} tokens ({event.percentage}%)
                          </div>
                        )}
                        {event.reason && (
                          <div className="text-xs text-gray-400 mt-1">
                            💡 {event.reason}
                          </div>
                        )}
                        {event.cacheHits !== undefined && (
                          <div className="text-cyan-600">
                            📊 {event.cacheHits} hits précédents
                          </div>
                        )}
                        {event.errorMessage && (
                          <div className="text-red-600 text-xs bg-red-50 p-2 rounded mt-1">
                            {event.errorMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
