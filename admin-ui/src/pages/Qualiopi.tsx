/**
 * Page Qualiopi — Dashboard conformite documents formation
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Users,
  ChevronRight,
  X,
  Upload,
} from 'lucide-react';
import { api } from '../lib/api';

interface Apprenant {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  conformite: {
    total: number;
    completed: number;
    percentage: number;
    missing: string[];
    documents: Array<{ document_type: string; status: string; created_at: string }>;
  };
}

interface Alerte {
  client_id: string;
  client_name: string;
  client_email: string;
  missing_count: number;
  missing_documents: string[];
  severity: 'critical' | 'warning' | 'info';
}

interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  status: string;
  uploaded_at: string | null;
  file_url: string | null;
  notes: string | null;
  version: number;
}

export default function Qualiopi() {
  const queryClient = useQueryClient();
  const [selectedClient, setSelectedClient] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['qualiopi-apprenants'],
    queryFn: () =>
      api.get<{ apprenants: Apprenant[] }>('/api/admin/qualiopi/apprenants'),
  });

  const { data: alertesData } = useQuery({
    queryKey: ['qualiopi-alertes'],
    queryFn: () =>
      api.get<{ alertes: Alerte[] }>('/api/admin/qualiopi/alertes'),
  });

  const { data: checklistData } = useQuery({
    queryKey: ['qualiopi-checklist', selectedClient],
    queryFn: () =>
      api.get<{ checklist: ChecklistItem[] }>(
        `/api/admin/qualiopi/apprenants/${selectedClient}/documents`
      ),
    enabled: !!selectedClient,
  });

  const validateMutation = useMutation({
    mutationFn: ({ clientId, docType }: { clientId: string; docType: string }) =>
      api.post(`/api/admin/qualiopi/apprenants/${clientId}/documents`, {
        document_type: docType,
        status: 'valide',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qualiopi-checklist', selectedClient] });
      queryClient.invalidateQueries({ queryKey: ['qualiopi-apprenants'] });
      queryClient.invalidateQueries({ queryKey: ['qualiopi-alertes'] });
    },
  });

  const apprenants = data?.apprenants || [];
  const alertes = alertesData?.alertes || [];
  const checklist = checklistData?.checklist || [];

  const avgConformite = apprenants.length > 0
    ? Math.round(apprenants.reduce((s, a) => s + a.conformite.percentage, 0) / apprenants.length)
    : 0;
  const criticalCount = alertes.filter(a => a.severity === 'critical').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Conformite Qualiopi</CardTitle>
                <CardDescription>
                  Checklist documentaire par apprenant
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Apprenants', value: apprenants.length, icon: Users, color: 'text-blue-600' },
          { label: 'Conformite moy.', value: `${avgConformite}%`, icon: ShieldCheck, color: 'text-green-600' },
          { label: 'Alertes critiques', value: criticalCount, icon: AlertTriangle, color: 'text-red-600' },
          { label: 'Documents types', value: 12, icon: FileText, color: 'text-gray-600' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <div>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alertes */}
      {alertes.filter(a => a.severity === 'critical').length > 0 && (
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Alertes critiques
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alertes.filter(a => a.severity === 'critical').slice(0, 5).map(alerte => (
                <div key={alerte.client_id} className="flex items-center justify-between bg-red-50 rounded-lg p-3">
                  <div>
                    <p className="font-medium text-gray-900">{alerte.client_name}</p>
                    <p className="text-xs text-gray-500">{alerte.missing_count} documents manquants</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedClient(alerte.client_id)}
                  >
                    Voir
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Apprenants + Checklist */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Apprenants</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : apprenants.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">Aucun apprenant</p>
                <p className="text-sm mt-1">Les clients tagges &quot;apprenant&quot; ou &quot;formation&quot; apparaitront ici.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {apprenants.map(a => {
                  const pct = a.conformite.percentage;
                  const barColor = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';

                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelectedClient(a.id === selectedClient ? null : a.id)}
                      className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left ${
                        selectedClient === a.id ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                          {(a.prenom?.[0] || a.nom?.[0] || '?').toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{a.prenom} {a.nom}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className={`h-full ${barColor} rounded-full`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-medium text-gray-600">{pct}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <Badge className={pct === 100 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}>
                          {a.conformite.completed}/{a.conformite.total}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Checklist detail */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedClient ? 'Checklist documents' : 'Selectionnez un apprenant'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedClient ? (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {checklist.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {doc.status === 'valide' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.label}</p>
                        <p className="text-xs text-gray-400">{doc.category}</p>
                      </div>
                    </div>
                    {doc.status !== 'valide' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-2 flex-shrink-0"
                        onClick={() => validateMutation.mutate({ clientId: selectedClient, docType: doc.id })}
                        disabled={validateMutation.isPending}
                      >
                        <Upload className="w-3.5 h-3.5 mr-1" />
                        Valider
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => setSelectedClient(null)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Fermer
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Cliquez sur un apprenant pour voir sa checklist</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
