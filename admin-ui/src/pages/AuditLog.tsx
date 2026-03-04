import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, FileText, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditLogEntry {
  id: string;
  admin_id: string;
  action: string;
  entite: string;
  entite_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

interface AuditLogResponse {
  logs: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

interface FiltersResponse {
  actions: string[];
  entites: string[];
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-50 text-green-700 border-green-200',
  update: 'bg-blue-50 text-blue-700 border-blue-200',
  delete: 'bg-red-50 text-red-700 border-red-200',
  login: 'bg-purple-50 text-purple-700 border-purple-200',
  login_2fa: 'bg-purple-50 text-purple-700 border-purple-200',
  init: 'bg-gray-50 text-gray-700 border-gray-200',
  reset: 'bg-yellow-50 text-yellow-700 border-yellow-200',
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  login: 'Connexion',
  login_2fa: 'Connexion 2FA',
  init: 'Initialisation',
  reset: 'Réinitialisation',
};

const PAGE_SIZE = 25;

export default function AuditLog() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entiteFilter, setEntiteFilter] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const queryParams = new URLSearchParams();
  queryParams.set('limit', String(PAGE_SIZE));
  queryParams.set('offset', String(page * PAGE_SIZE));
  if (search) queryParams.set('search', search);
  if (actionFilter) queryParams.set('action', actionFilter);
  if (entiteFilter) queryParams.set('entite', entiteFilter);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search, actionFilter, entiteFilter],
    queryFn: () => api.get<AuditLogResponse>(`/admin/audit-logs?${queryParams}`),
  });

  const { data: filtersData } = useQuery({
    queryKey: ['audit-log-filters'],
    queryFn: () => api.get<FiltersResponse>('/admin/audit-logs/filters'),
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;

  const resetFilters = () => {
    setSearch('');
    setActionFilter('');
    setEntiteFilter('');
    setPage(0);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Journal d'audit</h1>
        <p className="text-sm text-gray-500">Historique de toutes les actions administratives</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">
            {data ? `${data.total} entrée${data.total > 1 ? 's' : ''}` : 'Chargement...'}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-1" />
            Filtres
            {(search || actionFilter || entiteFilter) && (
              <Badge className="ml-1 bg-cyan-100 text-cyan-700 text-xs px-1">
                {[search, actionFilter, entiteFilter].filter(Boolean).length}
              </Badge>
            )}
          </Button>
        </CardHeader>

        {showFilters && (
          <div className="px-6 pb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Recherche</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                    placeholder="Action, entité..."
                    className="pl-9 h-9"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
                <select
                  value={actionFilter}
                  onChange={(e) => { setActionFilter(e.target.value); setPage(0); }}
                  className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm"
                >
                  <option value="">Toutes</option>
                  {filtersData?.actions.map(a => (
                    <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Entité</label>
                <select
                  value={entiteFilter}
                  onChange={(e) => { setEntiteFilter(e.target.value); setPage(0); }}
                  className="w-full h-9 rounded-md border border-gray-200 bg-white px-3 text-sm"
                >
                  <option value="">Toutes</option>
                  {filtersData?.entites.map(e => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
            </div>
            {(search || actionFilter || entiteFilter) && (
              <button onClick={resetFilters} className="text-xs text-cyan-600 hover:text-cyan-700">
                Réinitialiser les filtres
              </button>
            )}
          </div>
        )}

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : !data?.logs.length ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Aucune entrée dans le journal</p>
            </div>
          ) : (
            <div className="divide-y">
              {data.logs.map((log) => (
                <div key={log.id}>
                  <button
                    onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                    className="w-full px-6 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <Badge className={cn('text-xs font-medium', ACTION_COLORS[log.action] || 'bg-gray-50 text-gray-700')}>
                      {ACTION_LABELS[log.action] || log.action}
                    </Badge>
                    <span className="text-sm font-medium text-gray-900 min-w-[100px]">
                      {log.entite}
                    </span>
                    {log.entite_id && (
                      <span className="text-xs text-gray-400 font-mono truncate max-w-[120px]">
                        {log.entite_id}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('fr-FR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    {log.details ? (
                      expandedRow === log.id ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : <div className="w-4" />}
                  </button>

                  {expandedRow === log.id && log.details && (
                    <div className="px-6 pb-3">
                      <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto text-gray-600 max-h-48">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-3 border-t">
              <p className="text-xs text-gray-500">
                Page {page + 1} sur {totalPages}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
