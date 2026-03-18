/**
 * Page Instagram Setter — Dashboard conversations de qualification IA
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Instagram,
  MessageCircle,
  Target,
  UserCheck,
  UserX,
  Clock,
  RefreshCw,
  ChevronRight,
  TrendingUp,
  X,
} from 'lucide-react';
import { api } from '../lib/api';

interface Conversation {
  id: string;
  instagram_user_id: string;
  sender_username: string;
  sender_name: string | null;
  status: string;
  current_step: number;
  score: number;
  responses: Record<string, string>;
  relance_count: number;
  qualified_at: string | null;
  created_at: string;
}

interface ConversationMessage {
  id: string;
  direction: string;
  content: string;
  type: string;
  timestamp: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  new: { label: 'Nouveau', color: 'bg-blue-100 text-blue-700', icon: MessageCircle },
  pending_first_contact: { label: 'Contact programmé', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  qualifying: { label: 'En qualification', color: 'bg-purple-100 text-purple-700', icon: Target },
  qualified: { label: 'Qualifié', color: 'bg-green-100 text-green-700', icon: UserCheck },
  not_qualified: { label: 'Non qualifié', color: 'bg-gray-100 text-gray-600', icon: UserX },
  nurture: { label: 'Nurture', color: 'bg-orange-100 text-orange-700', icon: TrendingUp },
};

export default function InstagramSetter() {
  const [selectedConv, setSelectedConv] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ig-setter-conversations'],
    queryFn: () =>
      api.get<{ conversations: Conversation[]; total: number }>(
        '/api/admin/ig-setter/conversations'
      ),
  });

  const { data: messagesData } = useQuery({
    queryKey: ['ig-setter-messages', selectedConv],
    queryFn: () =>
      api.get<{ messages: ConversationMessage[] }>(
        `/api/admin/ig-setter/conversations/${selectedConv}/messages`
      ),
    enabled: !!selectedConv,
  });

  const conversations = data?.conversations || [];
  const messages = messagesData?.messages || [];
  const total = data?.total || 0;

  const stats = {
    total,
    qualifying: conversations.filter(c => c.status === 'qualifying' || c.status === 'pending_first_contact').length,
    qualified: conversations.filter(c => c.status === 'qualified').length,
    avgScore: conversations.length > 0
      ? Math.round(conversations.reduce((sum, c) => sum + c.score, 0) / conversations.length)
      : 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                <Instagram className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle>Setter IA Instagram</CardTitle>
                <CardDescription>
                  Qualification automatique des prospects via DMs
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
          { label: 'Conversations', value: stats.total, icon: MessageCircle, color: 'text-blue-600' },
          { label: 'En cours', value: stats.qualifying, icon: Target, color: 'text-purple-600' },
          { label: 'Qualifiés', value: stats.qualified, icon: UserCheck, color: 'text-green-600' },
          { label: 'Score moyen', value: stats.avgScore, icon: TrendingUp, color: 'text-orange-600' },
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

      {/* Conversations list + Detail */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* List */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Instagram className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">Aucune conversation</p>
                <p className="text-sm mt-1">Les DMs Instagram apparaitront ici automatiquement.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {conversations.map(conv => {
                  const statusInfo = STATUS_MAP[conv.status] || STATUS_MAP.new;
                  const StatusIcon = statusInfo.icon;

                  return (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConv(conv.id === selectedConv ? null : conv.id)}
                      className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left ${
                        selectedConv === conv.id ? 'bg-purple-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                          {(conv.sender_name || conv.sender_username || '?')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {conv.sender_name || `@${conv.sender_username}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            @{conv.sender_username} · Étape {conv.current_step}/4 · Score {conv.score}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={statusInfo.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusInfo.label}
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

        {/* Detail panel */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedConv ? 'Détail conversation' : 'Sélectionnez une conversation'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedConv ? (
              <div className="space-y-4">
                {/* Responses */}
                {(() => {
                  const conv = conversations.find(c => c.id === selectedConv);
                  if (!conv) return null;
                  return (
                    <>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">Réponses</p>
                        {Object.entries(conv.responses || {}).map(([key, val]) => (
                          <div key={key} className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs font-medium text-gray-500 uppercase">{key}</p>
                            <p className="text-sm text-gray-900 mt-1">{val}</p>
                          </div>
                        ))}
                        {Object.keys(conv.responses || {}).length === 0 && (
                          <p className="text-sm text-gray-400">Pas encore de réponses</p>
                        )}
                      </div>

                      <div className="border-t pt-3 space-y-1 text-sm">
                        <p><span className="text-gray-500">Score :</span> <span className="font-medium">{conv.score} pts</span></p>
                        <p><span className="text-gray-500">Relances :</span> {conv.relance_count}/2</p>
                        <p><span className="text-gray-500">Créé le :</span> {new Date(conv.created_at).toLocaleDateString('fr-FR')}</p>
                        {conv.qualified_at && (
                          <p><span className="text-gray-500">Qualifié le :</span> {new Date(conv.qualified_at).toLocaleDateString('fr-FR')}</p>
                        )}
                      </div>
                    </>
                  );
                })()}

                {/* Messages */}
                <div className="border-t pt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Messages</p>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {messages.length === 0 ? (
                      <p className="text-sm text-gray-400">Aucun message</p>
                    ) : (
                      messages.map(msg => (
                        <div
                          key={msg.id}
                          className={`rounded-lg p-2.5 text-sm ${
                            msg.direction === 'incoming'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-purple-100 text-purple-800 ml-4'
                          }`}
                        >
                          <p>{msg.content}</p>
                          <p className="text-xs mt-1 opacity-60">
                            {new Date(msg.timestamp).toLocaleString('fr-FR')}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setSelectedConv(null)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Fermer
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <MessageCircle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Cliquez sur une conversation pour voir les détails</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
