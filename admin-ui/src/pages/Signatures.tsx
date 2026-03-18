/**
 * Page Signatures — Gestion des signatures électroniques Yousign
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileSignature,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Mail,
} from 'lucide-react';
import { api } from '../lib/api';

interface Signature {
  id: string;
  yousign_request_id: string;
  document_name: string;
  signer_email: string;
  status: string;
  signed_at: string | null;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700', icon: Clock },
  ongoing: { label: 'En attente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  signed: { label: 'Signé', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  done: { label: 'Terminé', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  declined: { label: 'Refusé', color: 'bg-red-100 text-red-700', icon: XCircle },
  expired: { label: 'Expiré', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
};

export default function Signatures() {
  const [page] = useState(1);
  const limit = 20;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['signatures', page],
    queryFn: () =>
      api.get<{ success: boolean; signatures: Signature[]; total: number }>(
        `/api/admin/signatures?limit=${limit}&offset=${(page - 1) * limit}`
      ),
  });

  const signatures = data?.signatures || [];
  const total = data?.total || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <FileSignature className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Signatures Electroniques</CardTitle>
                <CardDescription>
                  {total} signature{total !== 1 ? 's' : ''} — Yousign
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
          { label: 'En attente', count: signatures.filter(s => s.status === 'ongoing').length, color: 'text-yellow-600' },
          { label: 'Signées', count: signatures.filter(s => s.status === 'done' || s.status === 'signed').length, color: 'text-green-600' },
          { label: 'Refusées', count: signatures.filter(s => s.status === 'declined').length, color: 'text-red-600' },
          { label: 'Total', count: total, color: 'text-gray-600' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : signatures.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileSignature className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Aucune signature</p>
              <p className="text-sm mt-1">Les signatures apparaitront ici quand elles seront creees via le workflow closing.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {signatures.map(sig => {
                const statusInfo = STATUS_MAP[sig.status] || STATUS_MAP.draft;
                const StatusIcon = statusInfo.icon;

                return (
                  <div key={sig.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                        <FileSignature className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{sig.document_name || 'Document'}</p>
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                          <Mail className="w-3.5 h-3.5" />
                          <span>{sig.signer_email}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={statusInfo.color}>
                        <StatusIcon className="w-3.5 h-3.5 mr-1" />
                        {statusInfo.label}
                      </Badge>
                      <div className="text-xs text-gray-400 text-right">
                        {sig.signed_at ? (
                          <p>Signé le {new Date(sig.signed_at).toLocaleDateString('fr-FR')}</p>
                        ) : (
                          <p>Créé le {new Date(sig.created_at).toLocaleDateString('fr-FR')}</p>
                        )}
                      </div>
                      {sig.yousign_request_id && !sig.yousign_request_id.startsWith('sim_') && (
                        <a
                          href={`https://app.yousign.com/signature-requests/${sig.yousign_request_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-purple-500 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
