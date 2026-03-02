import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users, RefreshCw, MessageSquare, Mail, Download,
  ChevronDown, ChevronUp, TrendingUp, Star, AlertCircle,
  Crown, Heart, Sparkles, AlertTriangle,
  Moon, Zap, Ghost, Skull, X, Send, Loader2
} from 'lucide-react';

interface RFMSegment {
  key: string;
  nom: string;
  description: string;
  couleur: string;
  icone: string;
  action: string;
  priority: number;
  count: number;
  total_ca: string;
  percentage: string;
}

interface RFMStats {
  total_clients: number;
  clients_with_visits: number;
  total_ca: string;
  avg_rfm_score: string;
}

interface RFMClient {
  client_id: number;
  client_nom: string;
  client_email?: string;
  client_telephone?: string;
  rfm_score: string;
  recency_score: number;
  frequency_score: number;
  monetary_score: number;
  days_since_last_visit: number;
  visits_last_year: number;
  total_spent_euros: string;
}

// Mapping des icônes par segment
const segmentIcons: Record<string, typeof Users> = {
  champions: Crown,
  loyal: Heart,
  potential_loyal: Sparkles,
  new_customers: Star,
  promising: TrendingUp,
  need_attention: AlertTriangle,
  about_to_sleep: Moon,
  at_risk: Zap,
  cant_lose: AlertCircle,
  hibernating: Ghost,
  lost: Skull,
};

export function CRMSegments() {
  const [expandedSegment, setExpandedSegment] = useState<string | null>(null);
  const [campaignModal, setCampaignModal] = useState<{ segment: RFMSegment; type: 'whatsapp' | 'email' } | null>(null);
  const [campaignMessage, setCampaignMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Fetch RFM segments
  const { data: rfmData, isLoading, error, refetch, isRefetching } = useQuery<{
    success: boolean;
    segments: RFMSegment[];
    stats: RFMStats;
  }>({
    queryKey: ['rfm-segments'],
    queryFn: async () => {
      const res = await fetch('/api/admin/rfm/segments', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Plan Pro requis');
        throw new Error('Erreur chargement');
      }
      return res.json();
    },
  });

  // Fetch segment clients when expanded
  const { data: segmentClientsData, isLoading: isLoadingClients } = useQuery<{
    success: boolean;
    segment: RFMSegment;
    clients: RFMClient[];
  }>({
    queryKey: ['rfm-segment-clients', expandedSegment],
    queryFn: async () => {
      if (!expandedSegment) return { success: false, segment: null, clients: [] };
      const res = await fetch(`/api/admin/rfm/segments/${expandedSegment}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}` }
      });
      if (!res.ok) return { success: false, segment: null, clients: [] };
      return res.json();
    },
    enabled: !!expandedSegment,
  });

  // Actions
  const handleSendSMS = (segment: RFMSegment) => {
    // Template par défaut basé sur l'action recommandée du segment
    const templates: Record<string, string> = {
      champions: 'Bonjour {{prenom}} ! En tant que client VIP, bénéficiez de -15% sur votre prochaine prestation. Merci pour votre fidélité !',
      loyal: 'Bonjour {{prenom}} ! Découvrez nos nouvelles prestations exclusives. Réservez maintenant !',
      potential_loyal: 'Bonjour {{prenom}} ! Profitez de notre carte fidélité et cumulez des avantages.',
      new_customers: 'Bonjour {{prenom}} ! Bienvenue ! -15% sur votre 2ème visite avec le code BIENVENUE.',
      promising: 'Bonjour {{prenom}} ! Découvrez toute notre gamme de services.',
      need_attention: 'Bonjour {{prenom}} ! Vous nous manquez ! -20% cette semaine seulement.',
      about_to_sleep: 'Bonjour {{prenom}} ! Offre spéciale: -20% pour votre retour parmi nous.',
      at_risk: 'Bonjour {{prenom}} ! Nous aimerions vous revoir. Bénéficiez de -25% sur votre prochaine visite.',
      cant_lose: 'Bonjour {{prenom}} ! Offre exceptionnelle VIP: -30% + cadeau surprise.',
      hibernating: 'Bonjour {{prenom}} ! Dernière chance: -30% avant le fin du mois.',
      lost: 'Bonjour {{prenom}} ! Nous espérons vous revoir bientôt.',
    };
    setCampaignMessage(templates[segment.key] || 'Bonjour {{prenom}} !');
    setCampaignModal({ segment, type: 'whatsapp' });
  };

  const handleSendEmail = (segment: RFMSegment) => {
    setCampaignMessage('');
    setCampaignModal({ segment, type: 'email' });
  };

  const handleSendCampaign = async () => {
    if (!campaignModal || !campaignMessage.trim()) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/admin/rfm/segments/${campaignModal.segment.key}/campaign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('nexus_admin_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: campaignModal.type,
          message: campaignMessage
        })
      });

      const data = await res.json();
      if (data.success) {
        alert(`Campagne envoyée !\n✓ ${data.results.sent} messages envoyés\n✗ ${data.results.failed} échecs`);
        setCampaignModal(null);
        setCampaignMessage('');
      } else {
        alert(`Erreur: ${data.error}`);
      }
    } catch (err) {
      alert('Erreur lors de l\'envoi de la campagne');
    } finally {
      setIsSending(false);
    }
  };

  const handleExport = (segment: RFMSegment) => {
    const clients = segmentClientsData?.clients;
    if (!clients || clients.length === 0) {
      alert('Ouvrez d\'abord le segment pour charger les clients');
      return;
    }
    const csv = [
      'Nom,Email,Téléphone,CA Total,Nb Visites,Score RFM,Jours depuis visite',
      ...clients.map(c =>
        `${c.client_nom},${c.client_email || ''},${c.client_telephone || ''},${c.total_spent_euros},${c.visits_last_year},${c.rfm_score},${c.days_since_last_visit}`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `segment-${segment.key}.csv`;
    a.click();
  };

  // Get RFM score badge color
  const getScoreColor = (score: number) => {
    if (score >= 4) return 'bg-green-100 text-green-700';
    if (score >= 3) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded-xl"></div>
          <div className="h-48 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-700 font-medium">{(error as Error).message}</p>
          <p className="text-sm text-red-600 mt-2">La segmentation CRM nécessite le plan Pro.</p>
        </CardContent>
      </Card>
    );
  }

  const segments = rfmData?.segments || [];
  const stats = rfmData?.stats;

  return (
    <div className="space-y-6">
      {/* En-tête avec stats globales */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Analyse RFM</h1>
            <p className="text-indigo-100">
              Segmentation automatique basée sur Récence, Fréquence et Montant
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-white/20 rounded-lg px-4 py-3">
              <p className="text-indigo-100 text-sm">Clients analysés</p>
              <p className="font-bold text-2xl">{stats.total_clients}</p>
            </div>
            <div className="bg-white/20 rounded-lg px-4 py-3">
              <p className="text-indigo-100 text-sm">Avec historique</p>
              <p className="font-bold text-2xl">{stats.clients_with_visits}</p>
            </div>
            <div className="bg-white/20 rounded-lg px-4 py-3">
              <p className="text-indigo-100 text-sm">CA Total</p>
              <p className="font-bold text-2xl">{parseFloat(stats.total_ca).toLocaleString('fr-FR')}€</p>
            </div>
            <div className="bg-white/20 rounded-lg px-4 py-3">
              <p className="text-indigo-100 text-sm">Score RFM moyen</p>
              <p className="font-bold text-2xl">{stats.avg_rfm_score}/5</p>
            </div>
          </div>
        )}
      </div>

      {/* Explication RFM */}
      <Card className="bg-gradient-to-r from-slate-50 to-slate-100 border-slate-200">
        <CardContent className="p-4">
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0">R</div>
              <div>
                <p className="font-semibold text-gray-800">Récence</p>
                <p className="text-gray-600">Quand est-ce que le client est venu pour la dernière fois ?</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold shrink-0">F</div>
              <div>
                <p className="font-semibold text-gray-800">Fréquence</p>
                <p className="text-gray-600">Combien de fois est-il venu ces 12 derniers mois ?</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold shrink-0">M</div>
              <div>
                <p className="font-semibold text-gray-800">Montant</p>
                <p className="text-gray-600">Combien a-t-il dépensé au total ?</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste des segments */}
      {segments.length === 0 ? (
        <Card className="border-2 border-dashed border-gray-300">
          <CardContent className="p-8 text-center">
            <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Aucun segment trouvé</h3>
            <p className="text-gray-600">
              L'analyse RFM nécessite des clients avec un historique de rendez-vous.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">
            {segments.length} segments identifiés
          </h2>

          {segments.map((segment) => {
            const Icon = segmentIcons[segment.key] || Users;
            const isExpanded = expandedSegment === segment.key;

            return (
              <Card
                key={segment.key}
                className="overflow-hidden transition-all hover:shadow-md"
                style={{ borderLeftColor: segment.couleur, borderLeftWidth: '4px' }}
              >
                <div className="p-5">
                  {/* Header du segment */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div
                        className="p-3 rounded-xl shadow-sm"
                        style={{ backgroundColor: `${segment.couleur}20`, color: segment.couleur }}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg text-gray-900">{segment.nom}</h3>
                          <Badge variant="outline" className="text-xs">
                            {segment.percentage}%
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1 max-w-xl">{segment.description}</p>
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1 text-gray-700">
                            <Users className="h-4 w-4" />
                            <span className="font-semibold">{segment.count}</span>
                            <span className="text-gray-500">clients</span>
                          </div>
                          {parseFloat(segment.total_ca) > 0 && (
                            <div className="flex items-center gap-1 text-green-700">
                              <TrendingUp className="h-4 w-4" />
                              <span className="font-semibold">
                                {parseFloat(segment.total_ca).toLocaleString('fr-FR')}€
                              </span>
                              <span className="text-green-600">CA</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action recommandée */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-sm text-gray-600 mb-3">
                      <span className="font-medium" style={{ color: segment.couleur }}>
                        Action recommandée :
                      </span>{' '}
                      {segment.action}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => handleSendSMS(segment)}>
                        <MessageSquare className="h-3 w-3" />
                        Envoyer SMS
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => handleSendEmail(segment)}>
                        <Mail className="h-3 w-3" />
                        Envoyer Email
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => handleExport(segment)}>
                        <Download className="h-3 w-3" />
                        Exporter CSV
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 ml-auto"
                        onClick={() => setExpandedSegment(isExpanded ? null : segment.key)}
                      >
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        {isExpanded ? 'Masquer' : 'Voir les clients'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Liste des clients (expanded) */}
                {isExpanded && (
                  <div className="border-t bg-white p-4">
                    <h4 className="font-medium text-gray-700 mb-3">Clients dans ce segment</h4>

                    {isLoadingClients ? (
                      <div className="animate-pulse space-y-2">
                        {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded" />)}
                      </div>
                    ) : segmentClientsData?.clients && segmentClientsData.clients.length > 0 ? (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {segmentClientsData.clients.map((client) => {
                          // Parse name (format: "Prénom Nom")
                          const nameParts = client.client_nom.split(' ');
                          const initials = nameParts.length >= 2
                            ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`
                            : client.client_nom.substring(0, 2);

                          return (
                            <div
                              key={client.client_id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">
                                  {initials.toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{client.client_nom}</p>
                                  <p className="text-sm text-gray-500">
                                    {client.client_email || client.client_telephone || 'Pas de contact'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 text-sm">
                                {/* Scores RFM */}
                                <div className="flex gap-1">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreColor(client.recency_score)}`}>
                                    R:{client.recency_score}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreColor(client.frequency_score)}`}>
                                    F:{client.frequency_score}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreColor(client.monetary_score)}`}>
                                    M:{client.monetary_score}
                                  </span>
                                </div>
                                <span className="text-gray-500 hidden md:inline">
                                  {client.days_since_last_visit <= 0
                                    ? `Il y a ${Math.abs(client.days_since_last_visit)} jours`
                                    : `Dans ${client.days_since_last_visit} jours`}
                                </span>
                                <span className="text-gray-600">
                                  {client.visits_last_year} visites
                                </span>
                                <span className="font-semibold text-green-600 min-w-[60px] text-right">
                                  {parseFloat(client.total_spent_euros).toLocaleString('fr-FR')}€
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-center text-gray-500 py-8">Aucun client dans ce segment</p>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Campagne */}
      {campaignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-semibold text-lg">
                  {campaignModal.type === 'whatsapp' ? '📱 Campagne WhatsApp' : '📧 Campagne Email'}
                </h3>
                <p className="text-sm text-gray-500">
                  Segment: {campaignModal.segment.nom} ({campaignModal.segment.count} clients)
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCampaignModal(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Message {campaignModal.type === 'whatsapp' ? 'WhatsApp' : 'Email'}
                </label>
                <textarea
                  className="w-full border rounded-lg p-3 h-32 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Entrez votre message..."
                  value={campaignMessage}
                  onChange={(e) => setCampaignMessage(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Variables disponibles: {'{{prenom}}'}, {'{{nom}}'}, {'{{ca}}'}
                </p>
              </div>

              {campaignModal.type === 'email' && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    ⚠️ L'envoi d'emails n'est pas encore disponible. Utilisez WhatsApp pour l'instant.
                  </p>
                </div>
              )}

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  💡 Aperçu: "{campaignMessage.replace('{{prenom}}', 'Marie').replace('{{nom}}', 'Dupont').replace('{{ca}}', '250')}"
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t bg-gray-50 rounded-b-xl">
              <Button variant="outline" onClick={() => setCampaignModal(null)}>
                Annuler
              </Button>
              <Button
                onClick={handleSendCampaign}
                disabled={isSending || !campaignMessage.trim() || campaignModal.type === 'email'}
                className="gap-2"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Envoyer à {campaignModal.segment.count} clients
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
