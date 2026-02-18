/**
 * Home - Page d'accueil NEXUS Admin
 * Dashboard avec activité récente et accès rapide aux modules
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Users, Scissors, Package, TrendingUp, Megaphone,
  Bot, FileText, BarChart3, Search, Plus, Filter, Clock,
  CheckCircle, AlertCircle, DollarSign, UserPlus, RefreshCw
} from 'lucide-react';
import { QuotaBar } from '../components/QuotaBar';

// Modules disponibles
const modules = [
  { id: 'reservations', icon: Calendar, label: 'Réservations', path: '/reservations', color: 'cyan' },
  { id: 'clients', icon: Users, label: 'Clients', path: '/clients', color: 'blue' },
  { id: 'services', icon: Scissors, label: 'Services', path: '/services', color: 'purple' },
  { id: 'comptabilite', icon: FileText, label: 'Comptabilité', path: '/comptabilite', color: 'green', plan: 'pro' },
  { id: 'stock', icon: Package, label: 'Stock', path: '/stock', color: 'orange', plan: 'pro' },
  { id: 'marketing', icon: Megaphone, label: 'Marketing', path: '/marketing', color: 'pink', plan: 'pro' },
  { id: 'rh', icon: Users, label: 'RH', path: '/rh', color: 'indigo', plan: 'pro' },
  { id: 'analytics', icon: BarChart3, label: 'Analytics', path: '/analytics', color: 'amber', plan: 'business' },
  { id: 'agent-ia', icon: Bot, label: 'Agent IA', path: '/agent-ia', color: 'teal' },
];

interface Activity {
  id: number;
  type: string;
  message: string;
  time: string;
}

const ACTIVITY_ICONS: Record<string, { icon: any; color: string }> = {
  rdv_confirmed: { icon: CheckCircle, color: 'green' },
  rdv_pending: { icon: Clock, color: 'amber' },
  new_client: { icon: UserPlus, color: 'blue' },
  payment: { icon: DollarSign, color: 'green' },
  alert: { icon: AlertCircle, color: 'red' },
};

export function Home() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    fetchActivity();
  }, []);

  const fetchActivity = async () => {
    setLoadingActivity(true);
    try {
      const token = localStorage.getItem('nexus_admin_token');
      const response = await fetch('/api/admin/stats/activity', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
      }
    } catch (err) {
      console.error('Activity fetch error:', err);
    } finally {
      setLoadingActivity(false);
    }
  };

  const filteredModules = modules.filter(m =>
    m.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getColorClasses = (color: string) => {
    const colors: Record<string, string> = {
      cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
      blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      pink: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
      indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      teal: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
      red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return colors[color] || colors.cyan;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar - Modules */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Mes modules</h2>
            <button className="text-xs text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 flex items-center gap-1">
              <Plus className="w-3 h-3" />
              Ajouter
            </button>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Modules List */}
          <nav className="space-y-1">
            {filteredModules.map((module) => {
              const Icon = module.icon;
              return (
                <button
                  key={module.id}
                  onClick={() => navigate(module.path)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                >
                  <div className={`p-1.5 rounded ${getColorClasses(module.color)}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                    {module.label}
                  </span>
                  {module.plan && (
                    <span className={`
                      text-xs px-1.5 py-0.5 rounded
                      ${module.plan === 'pro' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400' : ''}
                      ${module.plan === 'business' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400' : ''}
                    `}>
                      {module.plan.toUpperCase()}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Home</h1>

          {/* Quota Bar */}
          <QuotaBar className="mb-6" />

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 mb-6">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => navigate('/reservations/nouveau')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Nouveau RDV
              </button>
              <button
                onClick={() => navigate('/clients/nouveau')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Nouveau client
              </button>
              <button
                onClick={() => navigate('/agent-ia')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
              >
                <Bot className="w-4 h-4" />
                Agent IA
              </button>
              <button
                onClick={() => navigate('/analytics')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
              >
                <TrendingUp className="w-4 h-4" />
                Statistiques
              </button>
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <h2 className="font-medium text-gray-900 dark:text-white">Activité récente</h2>
              <button
                onClick={fetchActivity}
                disabled={loadingActivity}
                className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <RefreshCw className={`w-4 h-4 ${loadingActivity ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {loadingActivity ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : activities.length > 0 ? (
                activities.map((activity) => {
                  const config = ACTIVITY_ICONS[activity.type] || ACTIVITY_ICONS.alert;
                  const Icon = config.icon;
                  return (
                    <div key={activity.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <div className={`p-1.5 rounded-full ${getColorClasses(config.color)}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white">{activity.message}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{activity.time}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Aucune activité récente</p>
                </div>
              )}
            </div>
            {activities.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
                <button className="text-sm text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
                  Voir toute l'activité →
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
