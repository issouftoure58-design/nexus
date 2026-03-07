/**
 * Home - Page d'accueil NEXUS Admin
 * Chat IA plein page + Sentinel Live Feed + Multi-conversations
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send, Bot, User, Loader2, Sparkles, Shield, TrendingUp,
  AlertCircle, CheckCircle, Zap, RefreshCw, ChevronDown,
  Calendar, Users, DollarSign, MessageSquare, Settings,
  Plus, Trash2, Clock, ChevronLeft, Menu, X,
  Activity, Target, Cpu, FileText
} from 'lucide-react';
import { api } from '../lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

interface SentinelEvent {
  id: string;
  type: 'success' | 'warning' | 'info' | 'action' | 'money' | 'seo' | 'marketing' | 'anomaly' | 'roi';
  category: 'activity' | 'finance' | 'seo' | 'marketing' | 'recommendation' | 'cost' | 'anomaly';
  message: string;
  detail?: string;
  value?: number;
  timestamp: Date;
}

interface SentinelStats {
  // Données réelles du P&L
  ca_mois: number;
  depenses_mois: number;
  resultat_net: number;
  marge_nette: string;
  // Alertes
  anomalies: number;
  // Automation réelle
  workflows_actifs: number;
  executions_mois: number;
  notifications_mois: number;
  taches_completees: number;
  // Clients à risque
  clients_risque: number;
}

// API response types
interface ApiConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  messageCount?: number;
}

interface ApiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface ActivityItem {
  type?: string;
  message: string;
  time?: string;
}

interface ActivityResponse {
  activities: ActivityItem[];
}

interface OverviewResponse {
  ca_total: number;
  ca_variation: number;
}

interface PnlResponse {
  revenus?: { total: string };
  depenses?: { total: string };
  resultat?: { net: string; margeNette: string };
}

interface AutomationResponse {
  workflows?: { actifs: number; executions_mois: number };
  notifications?: { total_mois: number };
  taches?: { completees_mois: number };
}

interface SeoRecommendation {
  titre?: string;
  title?: string;
  description?: string;
}

interface ChurnResponse {
  high_risk: number;
}

// Quick action suggestions - Actions PUISSANTES
const QUICK_ACTIONS = [
  { label: 'Répondre à mes emails', prompt: 'Montre-moi mes emails en attente et propose des réponses', icon: Send },
  { label: 'Créer un post réseaux', prompt: 'Crée un post engageant pour mes réseaux sociaux pour promouvoir mon activité', icon: Sparkles },
  { label: 'Générer une facture PDF', prompt: 'Aide-moi à créer une facture PDF pour mon dernier client', icon: FileText },
  { label: 'Relancer mes clients', prompt: 'Identifie les clients à relancer et prépare les messages de relance', icon: Users },
];

// Secondary actions
const SECONDARY_ACTIONS = [
  { label: 'Booster rentabilité', prompt: 'Comment augmenter ma rentabilité aujourd\'hui ?' },
  { label: 'Améliorer rentabilité', prompt: 'Analyse ma rentabilité et propose des actions pour améliorer ma marge' },
  { label: 'Actions urgentes', prompt: 'Quelles actions urgentes dois-je faire ?' },
  { label: 'Créer un document', prompt: 'Aide-moi à créer un document professionnel' },
];

export function Home() {
  const navigate = useNavigate();

  // Conversations state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Sentinel state
  const [sentinelEvents, setSentinelEvents] = useState<SentinelEvent[]>([]);
  const [sentinelStats, setSentinelStats] = useState<SentinelStats | null>(null);
  const [sentinelExpanded, setSentinelExpanded] = useState(false);
  const [sentinelLoading, setSentinelLoading] = useState(false);

  // (BusinessKPIs supprimé — données fabriquées remplacées par SentinelStats réels)

  // Error toast
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const showError = useCallback((msg: string) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 4000);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load conversations and last conversation on mount
  useEffect(() => {
    loadConversations();
    fetchSentinelActivity();

    // Auto-refresh Sentinel every 2 min, only when tab is visible
    const interval = setInterval(() => {
      if (!document.hidden) fetchSentinelActivity();
    }, 120000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversations = async () => {
    try {
      const data = await api.get<{ conversations: ApiConversation[] }>('/admin/chat/conversations');
      const convs = (data.conversations || []).map((c: ApiConversation) => ({
        id: c.id,
        title: c.title || 'Nouvelle conversation',
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt || c.createdAt),
        messageCount: c.messageCount || 0
      }));

      setConversations(convs);
      setMessages([]);
      setCurrentConversationId(null);
    } catch (err) {
      showError('Impossible de charger les conversations');
      setMessages([]);
    }
  };

  const loadConversation = async (convId: string) => {
    try {
      const data = await api.get<{ messages: ApiMessage[] }>(`/admin/chat/conversations/${convId}/messages`);
      const msgs = (data.messages || []).map((m: ApiMessage) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: new Date(m.createdAt)
      }));

      setCurrentConversationId(convId);
      setMessages(msgs.length > 0 ? msgs : [{
        id: 'welcome',
        role: 'assistant',
        content: 'Bonjour ! Comment puis-je vous aider ?',
        timestamp: new Date()
      }]);
    } catch (err) {
      showError('Impossible de charger la conversation');
    }
  };

  // Create new conversation - show welcome screen
  const createNewConversation = async () => {
    setCurrentConversationId(null);
    setMessages([]); // Empty = welcome screen
    setSidebarOpen(false);
  };

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Supprimer cette conversation ?')) return;

    try {
      await api.delete(`/admin/chat/conversations/${convId}`);
      setConversations(prev => prev.filter(c => c.id !== convId));

      if (currentConversationId === convId) {
        createNewConversation();
      }
    } catch (err) {
      showError('Impossible de supprimer la conversation');
    }
  };

  // Fetch Sentinel activity — données réelles uniquement
  const fetchSentinelActivity = useCallback(async () => {
    setSentinelLoading(true);
    try {
      const allEvents: SentinelEvent[] = [];

      // 4 appels légers (pas d'appels IA SEO/churn à chaque refresh)
      const [activityData, overviewData, pnlData, automationData] = await Promise.all([
        api.get<ActivityResponse>('/admin/stats/activity').catch(() => null),
        api.get<OverviewResponse>('/admin/analytics/overview').catch(() => null),
        api.get<PnlResponse>('/admin/compta/pnl').catch(() => null),
        api.get<AutomationResponse>('/admin/stats/automation').catch(() => null)
      ]);

      // Appels IA couteux : seulement au premier chargement, pas à chaque refresh
      const isFirstLoad = sentinelEvents.length === 0;
      const [seoData, churnData] = isFirstLoad
        ? await Promise.all([
            api.get<{ recommendations: SeoRecommendation[] }>('/admin/seo/recommendations').catch(() => null),
            api.get<ChurnResponse>('/admin/analytics/churn').catch(() => null)
          ])
        : [null, null];

      // Variables réelles
      let caTotal = 0;
      let depensesTotal = 0;
      let resultatNet = 0;
      let margeNette = '0';
      let workflowsActifs = 0;
      let executionsMois = 0;
      let notificationsMois = 0;
      let tachesCompletees = 0;
      let clientsRisque = 0;

      // Process activity events (vrais events récents)
      if (activityData) {
        const activities = activityData.activities || [];
        activities.slice(0, 5).forEach((a: ActivityItem, i: number) => {
          allEvents.push({
            id: `activity-${i}`,
            category: 'activity',
            type: a.type?.includes('confirm') ? 'success' : a.type?.includes('alert') ? 'warning' : 'info',
            message: a.message,
            timestamp: new Date(a.time || Date.now())
          });
        });
      }

      // Process financial stats (CA, variation)
      if (overviewData) {
        caTotal = overviewData.ca_total || 0;

        if (overviewData.ca_variation < -15) {
          allEvents.unshift({
            id: 'anomaly-ca',
            category: 'anomaly',
            type: 'anomaly',
            message: `CA en baisse de ${Math.abs(overviewData.ca_variation)}%`,
            detail: 'Action corrective recommandée',
            value: overviewData.ca_variation,
            timestamp: new Date()
          });
        }
      }

      // P&L réel
      if (pnlData) {
        resultatNet = parseFloat(pnlData.resultat?.net ?? '0') || 0;
        depensesTotal = parseFloat(pnlData.depenses?.total ?? '0') || 0;
        margeNette = pnlData.resultat?.margeNette || '0';
        caTotal = parseFloat(pnlData.revenus?.total ?? '0') || caTotal;

        if (resultatNet > 0) {
          allEvents.push({
            id: 'pnl-positive',
            category: 'finance',
            type: 'roi',
            message: `Résultat positif: +${resultatNet.toFixed(0)}€`,
            detail: `Marge nette: ${margeNette}%`,
            value: resultatNet,
            timestamp: new Date()
          });
        } else if (resultatNet < 0) {
          allEvents.unshift({
            id: 'pnl-negative',
            category: 'anomaly',
            type: 'anomaly',
            message: `Perte détectée: ${resultatNet.toFixed(0)}€`,
            detail: 'Optimisation des coûts nécessaire',
            value: resultatNet,
            timestamp: new Date()
          });
        }
      }

      // Automation réelle
      if (automationData) {
        workflowsActifs = automationData.workflows?.actifs || 0;
        executionsMois = automationData.workflows?.executions_mois || 0;
        notificationsMois = automationData.notifications?.total_mois || 0;
        tachesCompletees = automationData.taches?.completees_mois || 0;
      }

      // SEO (seulement au premier chargement)
      if (seoData) {
        const recommendations = seoData.recommendations || seoData || [];
        if (Array.isArray(recommendations)) {
          recommendations.slice(0, 2).forEach((rec: SeoRecommendation, i: number) => {
            allEvents.push({
              id: `seo-${i}`,
              category: 'seo',
              type: 'seo',
              message: `${rec.titre || rec.title || 'Conseil SEO'}`,
              detail: rec.description,
              timestamp: new Date()
            });
          });
        }
      }

      // Churn (seulement au premier chargement)
      if (churnData && churnData.high_risk > 0) {
        clientsRisque = churnData.high_risk;
        allEvents.unshift({
          id: 'churn-alert',
          category: 'anomaly',
          type: 'warning',
          message: `${churnData.high_risk} clients à risque de départ`,
          detail: 'Relance recommandée',
          value: churnData.high_risk,
          timestamp: new Date()
        });
      }

      setSentinelStats({
        ca_mois: caTotal,
        depenses_mois: depensesTotal,
        resultat_net: resultatNet,
        marge_nette: margeNette,
        anomalies: allEvents.filter(e => e.category === 'anomaly').length,
        workflows_actifs: workflowsActifs,
        executions_mois: executionsMois,
        notifications_mois: notificationsMois,
        taches_completees: tachesCompletees,
        clients_risque: clientsRisque
      });

      setSentinelEvents(allEvents);
    } catch {
      // Sentinel errors are non-critical, fail silently
    } finally {
      setSentinelLoading(false);
    }
  }, []);

  const ensureConversation = useCallback(async (): Promise<string> => {
    if (currentConversationId) return currentConversationId;

    const data = await api.post<{ conversation: ApiConversation }>('/admin/chat/conversations', {
      title: 'Conversation du ' + new Date().toLocaleDateString('fr-FR')
    });
    const convId = data.conversation?.id;
    if (!convId) throw new Error('Failed to create conversation');
    setCurrentConversationId(convId);

    setConversations(prev => [{
      id: convId,
      title: data.conversation?.title || 'Nouvelle conversation',
      createdAt: new Date(),
      updatedAt: new Date(),
      messageCount: 0
    }, ...prev]);

    return convId;
  }, [currentConversationId]);

  // Send message with streaming
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const assistantId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    }]);

    try {
      const convId = await ensureConversation();
      // SSE streaming necessite raw fetch pour ReadableStream
      const token = localStorage.getItem('nexus_admin_token');
      const response = await fetch(`/api/admin/chat/conversations/${convId}/messages/stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify({ content: content.trim() })
      });

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!response.ok) throw new Error('Stream failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let sseBuffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n');
          // Keep last (potentially incomplete) line in buffer
          sseBuffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'text') {
                  fullContent += data.content;
                  setMessages(prev => prev.map(m =>
                    m.id === assistantId ? { ...m, content: fullContent } : m
                  ));
                } else if (data.type === 'done') {
                  setMessages(prev => prev.map(m =>
                    m.id === assistantId ? { ...m, isStreaming: false } : m
                  ));
                } else if (data.type === 'error') {
                  throw new Error(data.message || 'Erreur streaming');
                }
              } catch (parseErr) {
                if (parseErr instanceof SyntaxError) continue;
                throw parseErr;
              }
            }
          }
        }
      }

      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, updatedAt: new Date(), messageCount: c.messageCount + 2 } : c
      ));

    } catch (err) {
      // Fallback non-streaming via api wrapper
      try {
        const convId = currentConversationId || await ensureConversation();
        const data = await api.post<{ response?: string }>(`/admin/chat/conversations/${convId}/messages`, {
          content: content.trim()
        });
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: data.response || 'Reponse recue', isStreaming: false }
            : m
        ));
      } catch {
        showError('Erreur de communication avec l\'IA');
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'Desole, une erreur est survenue. Veuillez reessayer.', isStreaming: false }
            : m
        ));
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentConversationId, isLoading, ensureConversation, showError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
      case 'warning': return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />;
      case 'anomaly': return <AlertCircle className="w-3.5 h-3.5 text-red-500 animate-pulse" />;
      case 'money': return <DollarSign className="w-3.5 h-3.5 text-emerald-500" />;
      case 'roi': return <TrendingUp className="w-3.5 h-3.5 text-green-400" />;
      case 'seo': return <Target className="w-3.5 h-3.5 text-purple-500" />;
      case 'marketing': return <Sparkles className="w-3.5 h-3.5 text-pink-500" />;
      default: return <Zap className="w-3.5 h-3.5 text-cyan-500" />;
    }
  };

  // Génère le message d'accueil dynamique basé sur les données réelles
  const getDynamicWelcome = () => {
    if (!sentinelStats) {
      return {
        title: 'Votre assistant intelligent',
        subtitle: 'Emails, réseaux sociaux, documents, relances... déléguez-moi vos tâches répétitives'
      };
    }

    const workflows = sentinelStats.workflows_actifs;
    const notifs = sentinelStats.notifications_mois;

    if (workflows >= 5) {
      return {
        title: `${workflows} workflows actifs pour vous`,
        subtitle: `${notifs} notification${notifs > 1 ? 's' : ''} envoyée${notifs > 1 ? 's' : ''} ce mois. Que dois-je faire maintenant ?`
      };
    } else if (workflows >= 1) {
      return {
        title: 'Je peux faire plus pour vous',
        subtitle: 'Emails, réseaux sociaux, documents, relances... déléguez-moi vos tâches répétitives'
      };
    } else {
      return {
        title: 'Libérez-vous des tâches chronophages',
        subtitle: 'Je réponds aux emails, crée vos posts, génère vos documents. Essayez maintenant.'
      };
    }
  };

  return (
    <div className="flex h-[calc(100vh-56px)] bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Error toast */}
      {errorToast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white text-sm rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {errorToast}
        </div>
      )}
      {/* Sidebar - Conversations */}
      <div className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${sidebarCollapsed ? 'md:w-0 md:overflow-hidden' : 'md:w-72'}
        md:translate-x-0 fixed md:relative z-40 w-72 h-full
        bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl
        border-r border-gray-200/50 dark:border-gray-700/50
        shadow-xl shadow-gray-200/20 dark:shadow-black/20
        flex flex-col transition-all duration-300
      `}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-cyan-500/5 to-blue-500/5">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Conversations</span>
          <div className="flex items-center gap-1">
            <button
              onClick={createNewConversation}
              className="p-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 rounded-lg transition-all shadow-lg shadow-cyan-500/25"
              title="Nouvelle conversation"
            >
              <Plus className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg hidden md:block transition-colors"
              title="Masquer"
            >
              <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg md:hidden transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {conversations.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
              <p className="text-gray-400 dark:text-gray-500 text-sm">Aucune conversation</p>
              <p className="text-gray-300 dark:text-gray-600 text-xs mt-1">Démarrez une nouvelle discussion</p>
            </div>
          ) : (
            conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => { loadConversation(conv.id); setSidebarOpen(false); }}
                className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                  currentConversationId === conv.id
                    ? 'bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 shadow-md shadow-cyan-500/10'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800/50 border border-transparent'
                }`}
              >
                <div className={`p-2 rounded-lg ${currentConversationId === conv.id ? 'bg-cyan-500/20' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <MessageSquare className={`w-4 h-4 ${currentConversationId === conv.id ? 'text-cyan-500' : 'text-gray-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${currentConversationId === conv.id ? 'text-cyan-700 dark:text-cyan-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {conv.title}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {conv.updatedAt.toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <button
                  onClick={(e) => deleteConversation(conv.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* KPIs Bar - Score d'automatisation & Gain vs humain */}
        <div className="flex-shrink-0 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-cyan-500/20">
          <div className="px-4 py-2">
            <div className="flex items-center justify-between gap-4">
              {/* Mobile menu */}
              <button onClick={() => setSidebarOpen(true)} className="p-1.5 hover:bg-white/10 rounded-lg md:hidden">
                <Menu className="w-4 h-4 text-gray-400" />
              </button>

              {/* Desktop sidebar toggle */}
              {sidebarCollapsed && (
                <button onClick={() => setSidebarCollapsed(false)} className="p-2 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg hidden md:block">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                </button>
              )}

              {/* KPIs — données réelles uniquement */}
              <div className="flex-1 flex items-center justify-center gap-4 md:gap-6 lg:gap-8">
                {/* CA du mois */}
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">CA mois</p>
                    <p className="text-lg font-bold text-emerald-400">{(sentinelStats?.ca_mois || 0).toLocaleString()}€</p>
                  </div>
                </div>

                {/* Résultat net */}
                <div className="flex items-center gap-2">
                  <TrendingUp className={`w-5 h-5 ${(sentinelStats?.resultat_net || 0) >= 0 ? 'text-cyan-400' : 'text-red-400'}`} />
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Résultat</p>
                    <p className={`text-lg font-bold ${(sentinelStats?.resultat_net || 0) >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                      {(sentinelStats?.resultat_net || 0) >= 0 ? '+' : ''}{(sentinelStats?.resultat_net || 0).toFixed(0)}€
                    </p>
                  </div>
                </div>

                {/* Workflows actifs */}
                <div className="hidden md:flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Workflows</p>
                    <p className="text-lg font-bold text-purple-400">{sentinelStats?.workflows_actifs || 0}</p>
                  </div>
                </div>

                {/* Notifications envoyées */}
                <div className="hidden lg:flex items-center gap-2">
                  <Activity className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Notifs</p>
                    <p className="text-lg font-bold text-amber-400">{sentinelStats?.notifications_mois || 0}</p>
                  </div>
                </div>
              </div>

              {/* Refresh */}
              <button onClick={fetchSentinelActivity} disabled={sentinelLoading} className="p-1.5 hover:bg-white/10 rounded-lg">
                <RefreshCw className={`w-4 h-4 text-gray-400 ${sentinelLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Sentinel Command Center */}
        <div className="flex-shrink-0 bg-gradient-to-r from-gray-900 via-slate-800 to-gray-900 border-b border-slate-700/50">
          <div className="px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center gap-2 cursor-pointer group"
                  onClick={() => setSentinelExpanded(!sentinelExpanded)}
                >
                  <div className={`p-1.5 rounded-lg shadow-lg ${sentinelStats?.anomalies ? 'bg-gradient-to-br from-red-500 to-orange-600 shadow-red-500/30 animate-pulse' : 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/30'}`}>
                    <Shield className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-xs font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">SENTINEL</span>
                  {sentinelStats?.anomalies ? (
                    <span className="px-1.5 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-[10px] text-red-400 font-bold animate-pulse">
                      {sentinelStats.anomalies} ALERTE{sentinelStats.anomalies > 1 ? 'S' : ''}
                    </span>
                  ) : (
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-lg shadow-green-400/50" />
                  )}
                </div>

                {/* Scrolling logs */}
                <div className="hidden md:flex items-center gap-2 flex-1 overflow-hidden max-w-xl">
                  <div className="flex items-center gap-6 animate-marquee whitespace-nowrap">
                    {sentinelEvents.slice(0, 5).map((event) => (
                      <span key={event.id} className={`flex items-center gap-1.5 text-xs ${event.type === 'anomaly' ? 'text-red-400' : 'text-gray-400'}`}>
                        {getEventIcon(event.type)}
                        <span>{event.message}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={() => setSentinelExpanded(!sentinelExpanded)} className="p-1.5 hover:bg-white/10 rounded-lg">
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${sentinelExpanded ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {sentinelExpanded && (
              <div className="mt-3 pt-3 border-t border-white/10">
                {sentinelStats && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      {/* Dépenses du mois */}
                      <div className="bg-gradient-to-br from-orange-500/20 to-red-600/10 border border-orange-500/30 rounded-xl px-4 py-3 backdrop-blur-sm shadow-lg">
                        <p className="text-xs text-orange-300/80 font-medium flex items-center gap-1">
                          <DollarSign className="w-3 h-3" /> Dépenses
                        </p>
                        <p className="text-xl font-bold text-orange-400">{sentinelStats.depenses_mois.toFixed(0)}€</p>
                        <p className="text-xs text-orange-400/60">Ce mois</p>
                      </div>

                      {/* Marge nette */}
                      <div className={`bg-gradient-to-br ${sentinelStats.resultat_net >= 0 ? 'from-emerald-500/20 to-green-600/10 border-emerald-500/30' : 'from-red-500/20 to-red-600/10 border-red-500/30'} border rounded-xl px-4 py-3 backdrop-blur-sm shadow-lg`}>
                        <p className={`text-xs ${sentinelStats.resultat_net >= 0 ? 'text-emerald-300/80' : 'text-red-300/80'} font-medium flex items-center gap-1`}>
                          <TrendingUp className="w-3 h-3" /> Marge nette
                        </p>
                        <p className={`text-xl font-bold ${sentinelStats.resultat_net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {sentinelStats.marge_nette}%
                        </p>
                        {sentinelStats.resultat_net < 0 && (
                          <button
                            onClick={() => sendMessage('Analyse ma rentabilité et propose des actions concrètes pour améliorer ma marge')}
                            className="mt-1 px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all"
                          >
                            Optimiser
                          </button>
                        )}
                      </div>

                      {/* Exécutions workflows */}
                      <div className="bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border border-cyan-500/30 rounded-xl px-4 py-3 backdrop-blur-sm shadow-lg">
                        <p className="text-xs text-cyan-300/80 font-medium flex items-center gap-1">
                          <Zap className="w-3 h-3" /> Exécutions
                        </p>
                        <p className="text-xl font-bold text-cyan-400">{sentinelStats.executions_mois}</p>
                        <p className="text-xs text-cyan-400/60">{sentinelStats.taches_completees} tâches terminées</p>
                      </div>

                      {/* Anomalies */}
                      <div className={`bg-gradient-to-br ${sentinelStats.anomalies > 0 ? 'from-red-500/20 to-red-600/10 border-red-500/30' : 'from-green-500/20 to-green-600/10 border-green-500/30'} border rounded-xl px-4 py-3 backdrop-blur-sm shadow-lg`}>
                        <p className={`text-xs ${sentinelStats.anomalies > 0 ? 'text-red-300/80' : 'text-green-300/80'} font-medium flex items-center gap-1`}>
                          <AlertCircle className="w-3 h-3" /> Anomalies
                        </p>
                        <p className={`text-xl font-bold ${sentinelStats.anomalies > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {sentinelStats.anomalies > 0 ? sentinelStats.anomalies : '✓'}
                        </p>
                        <p className={`text-xs ${sentinelStats.anomalies > 0 ? 'text-red-400/60' : 'text-green-400/60'}`}>
                          {sentinelStats.anomalies > 0 ? 'Action requise' : 'Tout va bien'}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Activité récente */}
                <div className="bg-gray-950/50 rounded-xl border border-white/10 p-3 font-mono text-xs max-h-40 overflow-y-auto shadow-inner">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/10">
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-lg shadow-red-500/50" />
                      <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full shadow-lg shadow-yellow-500/50" />
                      <span className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-lg shadow-green-500/50" />
                    </div>
                    <span className="text-white/50 font-medium">Activité récente</span>
                    <span className="text-white/30 text-[10px] ml-auto">Cliquez pour plus de détails</span>
                  </div>
                  {sentinelEvents.filter(e => ['finance', 'activity', 'marketing', 'recommendation', 'anomaly'].includes(e.category)).length > 0 ? (
                    sentinelEvents.filter(e => ['finance', 'activity', 'marketing', 'recommendation', 'anomaly'].includes(e.category)).map((event, i) => (
                      <div
                        key={event.id}
                        onClick={() => {
                          const prompt = `Donne-moi plus de détails sur: "${event.message}"${event.detail ? ` (${event.detail})` : ''}`;
                          sendMessage(prompt);
                          setSentinelExpanded(false);
                        }}
                        className="flex items-start gap-2 py-1.5 px-2 hover:bg-cyan-500/10 rounded cursor-pointer transition-all group"
                      >
                        <span className="text-slate-500 w-8 select-none group-hover:text-cyan-400">{String(i + 1).padStart(2, '0')}</span>
                        <span className="text-cyan-500/70">[{event.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}]</span>
                        {getEventIcon(event.type)}
                        <span className="text-white/80 group-hover:text-white">{event.message}</span>
                        {event.value && <span className="text-emerald-400 font-bold">{event.value > 0 ? '+' : ''}{event.value}€</span>}
                        {event.detail && <span className="text-white/40 italic group-hover:text-white/60">— {event.detail}</span>}
                        <MessageSquare className="w-3 h-3 text-cyan-400 opacity-0 group-hover:opacity-100 ml-auto transition-opacity" />
                      </div>
                    ))
                  ) : (
                    <div className="text-white/40 py-3 text-center">Aucune activité récente</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-hidden flex flex-col bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
          {/* Welcome Screen or Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6">
            {messages.length === 0 ? (
              /* Welcome Screen - Dynamic & Powerful */
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <div className="mb-8">
                  {/* Bot icon */}
                  <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-cyan-500/30">
                    <Bot className="w-10 h-10 text-white" />
                  </div>

                  <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mb-3 max-w-lg mx-auto leading-tight">
                    {getDynamicWelcome().title}
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400 text-base max-w-md mx-auto">
                    {getDynamicWelcome().subtitle}
                  </p>

                  {/* Résumé rapide basé sur données réelles */}
                  {sentinelStats && (
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-lg">
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                        <div className="text-left">
                          <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">CA du mois</p>
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{sentinelStats.ca_mois.toLocaleString()}€</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg">
                        <Zap className="w-4 h-4 text-cyan-500" />
                        <div className="text-left">
                          <p className="text-[10px] text-cyan-600/70 dark:text-cyan-400/70">Workflows actifs</p>
                          <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400">{sentinelStats.workflows_actifs}</p>
                        </div>
                      </div>
                      {sentinelStats.clients_risque > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-lg">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          <div className="text-left">
                            <p className="text-[10px] text-red-600/70 dark:text-red-400/70">Clients à risque</p>
                            <p className="text-sm font-bold text-red-600 dark:text-red-400">{sentinelStats.clients_risque}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions principales - Ce que je FAIS pour vous */}
                <div className="w-full max-w-2xl">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-3 font-medium">Ce que je peux faire maintenant</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {QUICK_ACTIONS.map((action, i) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={i}
                          onClick={() => sendMessage(action.prompt)}
                          disabled={isLoading}
                          className="flex flex-col items-center gap-2 p-4 bg-white dark:bg-gray-800 hover:bg-gradient-to-br hover:from-cyan-50 hover:to-blue-50 dark:hover:from-cyan-900/20 dark:hover:to-blue-900/20 border border-gray-200 dark:border-gray-700 rounded-xl text-center transition-all shadow-sm hover:shadow-lg hover:border-cyan-400 dark:hover:border-cyan-500 hover:scale-105 disabled:opacity-50 group"
                        >
                          <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/25 group-hover:shadow-cyan-500/40 transition-all group-hover:scale-110">
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                            {action.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Actions secondaires */}
                <div className="flex flex-wrap justify-center gap-2 mt-6">
                  {SECONDARY_ACTIONS.map((action, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(action.prompt)}
                      disabled={isLoading}
                      className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded-full border border-gray-200 dark:border-gray-700 hover:border-cyan-300 transition-all"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>

                {/* Previous conversations hint */}
                {conversations.length > 0 && (
                  <p className="mt-6 text-sm text-gray-400 dark:text-gray-500">
                    <button
                      onClick={() => setSidebarCollapsed(false)}
                      className="text-cyan-500 hover:text-cyan-600 underline"
                    >
                      {conversations.length} conversation{conversations.length > 1 ? 's' : ''} précédente{conversations.length > 1 ? 's' : ''}
                    </button>
                  </p>
                )}
              </div>
            ) : (
              /* Messages list */
              <div className="space-y-4">
                {messages.map(message => (
                  <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-lg ${
                      message.role === 'user'
                        ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/25'
                        : 'bg-gradient-to-br from-purple-500 to-pink-600 shadow-purple-500/25'
                    }`}>
                      {message.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
                    </div>

                    <div className={`max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}>
                      <div className={`inline-block px-4 py-2.5 rounded-2xl shadow-md ${
                        message.role === 'user'
                          ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-tr-sm shadow-cyan-500/20'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-tl-sm border border-gray-100 dark:border-gray-700 shadow-gray-200/50 dark:shadow-black/20'
                      }`}>
                        {message.role === 'user' ? (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <div className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-2 prose-table:text-xs prose-th:px-2 prose-td:px-2">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                          </div>
                        )}
                        {message.isStreaming && <span className="inline-block w-2 h-4 bg-cyan-500 animate-pulse ml-1 rounded-sm" />}
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {message.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Quick Actions - only show when there are messages but few */}
          {messages.length > 0 && messages.length <= 2 && (
            <div className="px-4 pb-3 flex flex-wrap gap-2 justify-center">
              {QUICK_ACTIONS.map((action, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(action.prompt)}
                  disabled={isLoading}
                  className="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-full text-xs text-gray-600 dark:text-gray-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all shadow-sm hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-600 disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3 inline mr-1.5 text-cyan-500" />
                  {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="flex-shrink-0 p-4 bg-gradient-to-t from-white via-white to-transparent dark:from-gray-900 dark:via-gray-900">
            <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto">
              <div className="relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg shadow-gray-200/50 dark:shadow-black/30 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/20 transition-all">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Posez une question..."
                  rows={1}
                  className="w-full bg-transparent text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 px-4 py-3 pr-12 resize-none focus:outline-none text-sm"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 bottom-2 p-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 dark:disabled:from-gray-700 dark:disabled:to-gray-600 rounded-lg transition-all shadow-md shadow-cyan-500/25 disabled:shadow-none"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Bottom Nav */}
        <div className="flex-shrink-0 border-t border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <div className="flex items-center justify-center gap-1 py-2">
            {[
              { path: '/reservations', icon: Calendar, label: 'Prestations' },
              { path: '/clients', icon: Users, label: 'Clients' },
              { path: '/comptabilite', icon: DollarSign, label: 'Compta' },
              { path: '/parametres', icon: Settings, label: 'Config' },
            ].map(({ path, icon: Icon, label }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
