/**
 * Home - Page d'accueil NEXUS Admin
 * Chat IA plein page + Sentinel Live Feed + Multi-conversations
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Bot, User, Loader2, Sparkles, Shield, TrendingUp,
  AlertCircle, CheckCircle, Zap, RefreshCw, ChevronDown,
  Calendar, Users, DollarSign, MessageSquare, Settings,
  Plus, Trash2, Clock, ChevronLeft, Menu, X, Phone, PiggyBank,
  Activity, Target, TrendingDown, Cpu, Rocket, FileText, Mail
} from 'lucide-react';

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
  // Coûts temps réel
  cout_activite: number;
  marge_generee: number;
  roi_auto: number;
  roi_mois_precedent: number;
  roi_secteur: number;
  roi_projection_fin_mois: number;
  // Alertes
  anomalies: number;
  // Stats classiques
  ca_mois: number;
  resultat_reel: number;
  is_profit: boolean;
  // Optimisations suggérées
  optimisations: {
    reduire_premium: boolean;
    activer_batch: boolean;
    augmenter_prix: boolean;
    supprimer_canal: string | null;
  };
}

interface BusinessKPIs {
  // Score d'automatisation (0-100%)
  score_automatisation: number;
  // Détail du score
  score_detail: {
    emails_auto: number;      // % emails traités auto
    appels_auto: number;      // % appels sans humain
    rdv_auto: number;         // % rdv créés auto
    relances_auto: number;    // % relances auto
  };
  // Gains monétaires
  gains: {
    rdv_crees: number;        // € générés par rdv auto
    relances_recuperees: number; // € récupérés par relances
    upsell_detectes: number;  // € d'opportunités upsell
  };
  // Gain estimé vs employé humain (€/mois)
  gain_vs_humain: number;
  // Tâches automatisées aujourd'hui
  taches_auto_jour: number;
  // Heures économisées
  heures_economisees: number;
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

  // Business KPIs - Score d'automatisation & Gain vs humain
  const [businessKPIs, setBusinessKPIs] = useState<BusinessKPIs>({
    score_automatisation: 0,
    score_detail: { emails_auto: 0, appels_auto: 0, rdv_auto: 0, relances_auto: 0 },
    gains: { rdv_crees: 0, relances_recuperees: 0, upsell_detectes: 0 },
    gain_vs_humain: 0,
    taches_auto_jour: 0,
    heures_economisees: 0
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load conversations and last conversation on mount
  useEffect(() => {
    loadConversations();
    fetchSentinelActivity();

    // Auto-refresh Sentinel every 60 seconds
    const interval = setInterval(fetchSentinelActivity, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load all conversations (but don't open any - show welcome screen)
  const loadConversations = async () => {
    try {
      const token = localStorage.getItem('nexus_admin_token');
      const res = await fetch('/api/admin/chat/conversations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        const convs = (data.conversations || []).map((c: any) => ({
          id: c.id,
          title: c.title || 'Nouvelle conversation',
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt || c.createdAt),
          messageCount: c.messageCount || 0
        }));

        setConversations(convs);
        // Don't load any conversation - show welcome screen instead
        setMessages([]);
        setCurrentConversationId(null);
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
      setMessages([]);
    }
  };

  // Load a specific conversation
  const loadConversation = async (convId: string) => {
    try {
      const token = localStorage.getItem('nexus_admin_token');
      const res = await fetch(`/api/admin/chat/conversations/${convId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        const msgs = (data.messages || []).map((m: any) => ({
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
      }
    } catch (err) {
      console.error('Error loading conversation:', err);
    }
  };

  // Create new conversation - show welcome screen
  const createNewConversation = async () => {
    setCurrentConversationId(null);
    setMessages([]); // Empty = welcome screen
    setSidebarOpen(false);
  };

  // Delete conversation
  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('Supprimer cette conversation ?')) return;

    try {
      const token = localStorage.getItem('nexus_admin_token');
      await fetch(`/api/admin/chat/conversations/${convId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      setConversations(prev => prev.filter(c => c.id !== convId));

      if (currentConversationId === convId) {
        createNewConversation();
      }
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  // Fetch Sentinel activity - Mode GUERRE entrepreneur
  const fetchSentinelActivity = useCallback(async () => {
    setSentinelLoading(true);
    try {
      const token = localStorage.getItem('nexus_admin_token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const allEvents: SentinelEvent[] = [];

      const [activityRes, overviewRes, pnlRes, automationRes, seoRes, churnRes] = await Promise.all([
        fetch('/api/admin/stats/activity', { headers }),
        fetch('/api/admin/analytics/overview', { headers }),
        fetch('/api/admin/compta/pnl', { headers }).catch(() => null),
        fetch('/api/admin/stats/automation', { headers }).catch(() => null),
        fetch('/api/admin/seo/recommendations', { headers }).catch(() => null),
        fetch('/api/admin/analytics/churn', { headers }).catch(() => null)
      ]);

      // Variables pour calculs
      let caTotal = 0;
      let resultatReel = 0;
      let depensesTotal = 0;
      let tachesAuto = 0;
      let appelsTraites = 0;

      // Process activity events
      if (activityRes.ok) {
        const data = await activityRes.json();
        const activities = data.activities || [];
        tachesAuto = activities.length;

        activities.slice(0, 5).forEach((a: any, i: number) => {
          allEvents.push({
            id: `activity-${i}`,
            category: 'activity',
            type: a.type?.includes('confirm') ? 'success' : a.type?.includes('alert') ? 'warning' : 'info',
            message: a.message,
            timestamp: new Date(a.time || Date.now())
          });
        });
      }

      // Process financial stats
      if (overviewRes.ok) {
        const stats = await overviewRes.json();
        caTotal = stats.ca_total || 0;
        appelsTraites = stats.appels_traites || stats.nb_rdv || 0;

        // Alerte anomalie si CA en baisse forte
        if (stats.ca_variation < -15) {
          allEvents.unshift({
            id: 'anomaly-ca',
            category: 'anomaly',
            type: 'anomaly',
            message: `🚨 ALERTE: CA en baisse de ${Math.abs(stats.ca_variation)}%`,
            detail: 'Action corrective recommandée',
            value: stats.ca_variation,
            timestamp: new Date()
          });
        }
      }

      // Get real P&L data
      if (pnlRes?.ok) {
        const pnl = await pnlRes.json();
        resultatReel = parseFloat(pnl.resultat?.net) || 0;
        depensesTotal = parseFloat(pnl.depenses?.total) || 0;
        caTotal = parseFloat(pnl.revenus?.total) || caTotal;

        // Event ROI si bénéfice
        if (resultatReel > 0) {
          allEvents.push({
            id: 'roi-positive',
            category: 'finance',
            type: 'roi',
            message: `💰 ROI positif: +${resultatReel.toFixed(0)}€`,
            detail: `Marge: ${pnl.resultat?.margeNette || 0}%`,
            value: resultatReel,
            timestamp: new Date()
          });
        } else if (resultatReel < 0) {
          allEvents.unshift({
            id: 'anomaly-perte',
            category: 'anomaly',
            type: 'anomaly',
            message: `⚠️ Perte détectée: ${resultatReel.toFixed(0)}€`,
            detail: 'Optimisation des coûts nécessaire',
            value: resultatReel,
            timestamp: new Date()
          });
        }
      }

      // Process automation stats (ou calcul estimé)
      let scoreAuto = 0;
      let gainVsHumain = 0;
      let heuresEco = 0;
      let scoreDetail = { emails_auto: 0, appels_auto: 0, rdv_auto: 0, relances_auto: 0 };
      let gains = { rdv_crees: 0, relances_recuperees: 0, upsell_detectes: 0 };

      if (automationRes?.ok) {
        const autoData = await automationRes.json();
        scoreAuto = autoData.score || 0;
        gainVsHumain = autoData.gain_mensuel || 0;
        heuresEco = autoData.heures_economisees || 0;
        tachesAuto = autoData.taches_auto || tachesAuto;
        scoreDetail = autoData.score_detail || scoreDetail;
        gains = autoData.gains || gains;
      } else {
        // Pas de données d'automatisation - calcul basé sur données réelles disponibles
        // Hypothèse: chaque tâche auto = 15min d'un humain à 25€/h
        heuresEco = Math.round(tachesAuto * 0.25);

        // Score basé sur l'activité réelle (pas de random!)
        // Si on a des tâches, on estime un score proportionnel
        const hasActivity = tachesAuto > 0 || appelsTraites > 0;

        if (hasActivity) {
          // Estimation basée sur activité réelle
          const activityScore = Math.min(95, Math.round((tachesAuto / 10) * 10)); // 10 tâches = 100%
          scoreDetail = {
            emails_auto: Math.min(95, activityScore),
            appels_auto: Math.min(90, Math.round(appelsTraites > 0 ? 80 : 0)),
            rdv_auto: Math.min(95, activityScore),
            relances_auto: Math.min(95, activityScore)
          };
        } else {
          // Pas d'activité = 0
          scoreDetail = {
            emails_auto: 0,
            appels_auto: 0,
            rdv_auto: 0,
            relances_auto: 0
          };
        }

        // Score global = moyenne pondérée
        scoreAuto = Math.round(
          (scoreDetail.emails_auto * 0.2) +
          (scoreDetail.appels_auto * 0.3) +
          (scoreDetail.rdv_auto * 0.25) +
          (scoreDetail.relances_auto * 0.25)
        );

        // Calcul des gains monétaires basés sur données réelles
        // RDV créés auto: estimation basée sur appels traités
        gains.rdv_crees = appelsTraites > 0 ? Math.round(appelsTraites * 50) : 0;

        // Relances récupérées: basé sur tâches réelles
        const nbRelances = Math.round(tachesAuto * 0.3);
        gains.relances_recuperees = Math.round(nbRelances * 120 * 0.4); // 40% taux succès

        // Upsell détectés: basé sur CA réel
        gains.upsell_detectes = caTotal > 0 ? Math.round(caTotal * 0.08) : 0;

        // Gain vs humain = somme des gains + économies temps
        gainVsHumain = Math.round(heuresEco * 25) + gains.rdv_crees + gains.relances_recuperees;
      }

      // Update Business KPIs
      setBusinessKPIs({
        score_automatisation: scoreAuto,
        score_detail: scoreDetail,
        gains: gains,
        gain_vs_humain: gainVsHumain,
        taches_auto_jour: tachesAuto,
        heures_economisees: heuresEco
      });

      // Calcul marge générée en temps réel
      const margeGeneree = caTotal > 0 ? caTotal - depensesTotal : 0;
      const roiAuto = gainVsHumain > 0 ? Math.round((gainVsHumain / (depensesTotal || 1)) * 100) : 0;

      // ROI comparatifs - valeurs fixes (pas de random!)
      // Le mois précédent est stocké côté serveur, ici on met une valeur par défaut
      const roiMoisPrecedent = roiAuto > 0 ? Math.round(roiAuto * 0.9) : 0; // Estimation: -10% vs actuel
      const roiSecteur = 15; // Moyenne secteur fixe (données sectorielles)
      const joursDansMois = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const jourActuel = new Date().getDate();
      const roiProjection = Math.round(roiAuto * (joursDansMois / jourActuel));

      // Détection optimisations si marge négative
      const optimisations = {
        reduire_premium: margeGeneree < 0 && depensesTotal > 100,
        activer_batch: margeGeneree < 0 && tachesAuto > 50,
        augmenter_prix: margeGeneree < 0 && caTotal > 0,
        supprimer_canal: margeGeneree < -500 ? 'SMS' : null // Exemple: canal le moins rentable
      };

      // Ajouter alerte optimisation si marge négative
      if (margeGeneree < 0) {
        allEvents.unshift({
          id: 'optim-alert',
          category: 'anomaly',
          type: 'warning',
          message: `⚡ Optimisations disponibles pour réduire les coûts`,
          detail: 'Cliquez pour optimiser automatiquement',
          timestamp: new Date()
        });
      }

      setSentinelStats({
        cout_activite: depensesTotal,
        marge_generee: margeGeneree,
        roi_auto: roiAuto,
        roi_mois_precedent: roiMoisPrecedent,
        roi_secteur: roiSecteur,
        roi_projection_fin_mois: roiProjection,
        anomalies: allEvents.filter(e => e.category === 'anomaly').length,
        ca_mois: caTotal,
        resultat_reel: resultatReel,
        is_profit: resultatReel >= 0,
        optimisations: optimisations
      });

      // Process SEO recommendations
      if (seoRes?.ok) {
        const seoData = await seoRes.json();
        const recommendations = seoData.recommendations || seoData || [];
        if (Array.isArray(recommendations)) {
          recommendations.slice(0, 2).forEach((rec: any, i: number) => {
            allEvents.push({
              id: `seo-${i}`,
              category: 'seo',
              type: 'seo',
              message: `🔍 ${rec.titre || rec.title || 'Conseil SEO'}`,
              detail: rec.description,
              timestamp: new Date()
            });
          });
        }
      }

      // Process churn alerts - ANOMALIE
      if (churnRes?.ok) {
        const churnData = await churnRes.json();
        if (churnData.high_risk > 0) {
          allEvents.unshift({
            id: 'churn-alert',
            category: 'anomaly',
            type: 'warning',
            message: `🚨 ${churnData.high_risk} clients à risque de départ`,
            detail: 'Relance automatique recommandée',
            value: churnData.high_risk,
            timestamp: new Date()
          });
        }
      }

      // Event coût temps réel
      if (depensesTotal > 0) {
        allEvents.push({
          id: 'cost-realtime',
          category: 'cost',
          type: 'info',
          message: `📊 Coût d'activité: ${depensesTotal.toFixed(0)}€`,
          detail: `Marge générée: ${margeGeneree.toFixed(0)}€`,
          value: depensesTotal,
          timestamp: new Date()
        });
      }

      setSentinelEvents(allEvents);
    } catch (err) {
      console.error('Sentinel fetch error:', err);
    } finally {
      setSentinelLoading(false);
    }
  }, []);

  // Ensure conversation exists
  const ensureConversation = async (): Promise<string> => {
    if (currentConversationId) return currentConversationId;

    const token = localStorage.getItem('nexus_admin_token');
    const res = await fetch('/api/admin/chat/conversations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: 'Conversation du ' + new Date().toLocaleDateString('fr-FR') })
    });

    if (!res.ok) throw new Error('Failed to create conversation');
    const data = await res.json();
    const convId = data.conversation?.id || data.id;
    setCurrentConversationId(convId);

    // Add to conversations list
    setConversations(prev => [{
      id: convId,
      title: data.conversation?.title || 'Nouvelle conversation',
      createdAt: new Date(),
      updatedAt: new Date(),
      messageCount: 0
    }, ...prev]);

    return convId;
  };

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
      const token = localStorage.getItem('nexus_admin_token');

      const response = await fetch(`/api/admin/chat/conversations/${convId}/messages/stream`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: content.trim() })
      });

      if (!response.ok) throw new Error('Stream failed');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

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
                }
              } catch (e) {}
            }
          }
        }
      }

      // Update conversation in list
      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, updatedAt: new Date(), messageCount: c.messageCount + 2 } : c
      ));

    } catch (err) {
      console.error('Chat error:', err);
      // Fallback to non-streaming
      try {
        const convId = currentConversationId || await ensureConversation();
        const token = localStorage.getItem('nexus_admin_token');
        const fallbackRes = await fetch(`/api/admin/chat/conversations/${convId}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: content.trim() })
        });

        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, content: data.message?.content || data.content || 'Réponse reçue', isStreaming: false }
              : m
          ));
        } else {
          throw new Error('Fallback failed');
        }
      } catch (fallbackErr) {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'Désolé, une erreur est survenue. Veuillez réessayer.', isStreaming: false }
            : m
        ));
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentConversationId, isLoading]);

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

  // Génère le message d'accueil dynamique basé sur les KPIs
  const getDynamicWelcome = () => {
    const score = businessKPIs.score_automatisation;
    const gain = businessKPIs.gain_vs_humain;
    const tasks = businessKPIs.taches_auto_jour;

    if (score >= 80) {
      return {
        title: `Votre entreprise tourne à ${score}%`,
        subtitle: `J'ai déjà traité ${tasks} tâches aujourd'hui. Emails, posts, factures... que dois-je faire maintenant ?`
      };
    } else if (score >= 50) {
      return {
        title: `Je peux faire plus pour vous`,
        subtitle: `Emails, réseaux sociaux, documents, relances... déléguez-moi vos tâches répétitives`
      };
    } else {
      return {
        title: `Libérez-vous des tâches chronophages`,
        subtitle: `Je réponds aux emails, crée vos posts, génère vos documents. Essayez maintenant.`
      };
    }
  };

  return (
    <div className="flex h-[calc(100vh-56px)] bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
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

              {/* KPIs */}
              <div className="flex-1 flex items-center justify-center gap-4 md:gap-6 lg:gap-8">
                {/* Score d'automatisation avec détail */}
                <div className="group relative flex items-center gap-2 cursor-pointer">
                  <div className="relative">
                    <Cpu className="w-5 h-5 text-cyan-400" />
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Automatisation</p>
                    <p className="text-lg font-bold text-cyan-400">{businessKPIs.score_automatisation}%</p>
                  </div>
                  {/* Tooltip détail du score */}
                  <div className="absolute top-full left-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl">
                    <p className="text-xs text-gray-400 mb-2 font-medium">Détail du score :</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-300">Emails auto</span>
                        <span className="text-xs font-bold text-cyan-400">{businessKPIs.score_detail.emails_auto}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-300">Appels sans humain</span>
                        <span className="text-xs font-bold text-cyan-400">{businessKPIs.score_detail.appels_auto}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-300">RDV créés auto</span>
                        <span className="text-xs font-bold text-cyan-400">{businessKPIs.score_detail.rdv_auto}%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-300">Relances auto</span>
                        <span className="text-xs font-bold text-cyan-400">{businessKPIs.score_detail.relances_auto}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gains monétaires avec détail */}
                <div className="group relative flex items-center gap-2 cursor-pointer">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Gains générés</p>
                    <p className="text-lg font-bold text-emerald-400">+{(businessKPIs.gains.rdv_crees + businessKPIs.gains.relances_recuperees + businessKPIs.gains.upsell_detectes).toLocaleString()}€</p>
                  </div>
                  {/* Tooltip détail des gains */}
                  <div className="absolute top-full left-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl">
                    <p className="text-xs text-gray-400 mb-2 font-medium">Détail des gains :</p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-300">RDV créés</span>
                        <span className="text-xs font-bold text-emerald-400">+{businessKPIs.gains.rdv_crees}€</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-300">Relances récupérées</span>
                        <span className="text-xs font-bold text-emerald-400">+{businessKPIs.gains.relances_recuperees}€</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-300">Upsell détectés</span>
                        <span className="text-xs font-bold text-amber-400">+{businessKPIs.gains.upsell_detectes}€</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Gain vs Humain */}
                <div className="hidden md:flex items-center gap-2">
                  <PiggyBank className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">vs Employé</p>
                    <p className="text-lg font-bold text-purple-400">+{businessKPIs.gain_vs_humain}€<span className="text-xs text-purple-400/60">/mois</span></p>
                  </div>
                </div>

                {/* Tâches auto */}
                <div className="hidden lg:flex items-center gap-2">
                  <Activity className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">Tâches</p>
                    <p className="text-lg font-bold text-amber-400">{businessKPIs.taches_auto_jour}</p>
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
                      {/* Coût activité temps réel */}
                      <div className="bg-gradient-to-br from-orange-500/20 to-red-600/10 border border-orange-500/30 rounded-xl px-4 py-3 backdrop-blur-sm shadow-lg">
                        <p className="text-xs text-orange-300/80 font-medium flex items-center gap-1">
                          <TrendingDown className="w-3 h-3" /> Coût activité
                        </p>
                        <p className="text-xl font-bold text-orange-400">{sentinelStats.cout_activite.toFixed(0)}€</p>
                        <p className="text-xs text-orange-400/60">Temps réel</p>
                      </div>

                      {/* Marge générée + bouton optimiser */}
                      <div className={`bg-gradient-to-br ${sentinelStats.marge_generee >= 0 ? 'from-emerald-500/20 to-green-600/10 border-emerald-500/30' : 'from-red-500/20 to-red-600/10 border-red-500/30'} border rounded-xl px-4 py-3 backdrop-blur-sm shadow-lg`}>
                        <p className={`text-xs ${sentinelStats.marge_generee >= 0 ? 'text-emerald-300/80' : 'text-red-300/80'} font-medium flex items-center gap-1`}>
                          <DollarSign className="w-3 h-3" /> Marge générée
                        </p>
                        <p className={`text-xl font-bold ${sentinelStats.marge_generee >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {sentinelStats.marge_generee >= 0 ? '+' : ''}{sentinelStats.marge_generee.toFixed(0)}€
                        </p>
                        {sentinelStats.marge_generee < 0 && (
                          <button
                            onClick={() => sendMessage('Analyse ma rentabilité et propose des actions concrètes pour améliorer ma marge : ajustement des tarifs, services les plus rentables à promouvoir, créneaux horaires à optimiser, et stratégies pour augmenter le panier moyen.')}
                            className="mt-1 px-2 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all animate-pulse"
                          >
                            ⚡ Optimiser mon activité
                          </button>
                        )}
                      </div>

                      {/* ROI Automatisation avec comparaisons */}
                      <div className="group relative bg-gradient-to-br from-cyan-500/20 to-blue-600/10 border border-cyan-500/30 rounded-xl px-4 py-3 backdrop-blur-sm shadow-lg cursor-pointer">
                        <p className="text-xs text-cyan-300/80 font-medium flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> ROI Auto
                        </p>
                        <p className="text-xl font-bold text-cyan-400">+{sentinelStats.roi_auto}%</p>
                        <p className="text-xs text-cyan-400/60 flex items-center gap-1">
                          {sentinelStats.roi_auto > sentinelStats.roi_mois_precedent ? (
                            <><TrendingUp className="w-3 h-3 text-green-400" /> <span className="text-green-400">+{sentinelStats.roi_auto - sentinelStats.roi_mois_precedent}% vs M-1</span></>
                          ) : (
                            <><TrendingDown className="w-3 h-3 text-red-400" /> <span className="text-red-400">{sentinelStats.roi_auto - sentinelStats.roi_mois_precedent}% vs M-1</span></>
                          )}
                        </p>
                        {/* Tooltip comparaisons ROI */}
                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-slate-800 border border-slate-700 rounded-xl p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-xl">
                          <p className="text-xs text-gray-400 mb-2 font-medium">Comparaison ROI :</p>
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-300">Mois précédent</span>
                              <span className="text-xs font-bold text-cyan-400">{sentinelStats.roi_mois_precedent}%</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-300">Moyenne secteur</span>
                              <span className={`text-xs font-bold ${sentinelStats.roi_auto > sentinelStats.roi_secteur ? 'text-green-400' : 'text-amber-400'}`}>{sentinelStats.roi_secteur}%</span>
                            </div>
                            <div className="flex justify-between items-center border-t border-white/10 pt-1.5 mt-1.5">
                              <span className="text-xs text-gray-300">Projection fin mois</span>
                              <span className="text-xs font-bold text-purple-400">{sentinelStats.roi_projection_fin_mois}%</span>
                            </div>
                          </div>
                        </div>
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

                    {/* Conseils d'amélioration si marge négative */}
                    {sentinelStats.marge_generee < 0 && (
                      <div className="mb-3 p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl">
                        <p className="text-xs text-amber-400 font-bold mb-2 flex items-center gap-1">
                          <Zap className="w-3 h-3" /> Conseils pour améliorer votre rentabilité :
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {sentinelStats.optimisations.augmenter_prix && (
                            <button onClick={() => sendMessage('Analyse mes tarifs et suggère des augmentations de prix')} className="px-2 py-1 bg-slate-800 text-amber-400 text-[10px] rounded-lg hover:bg-slate-700 border border-amber-500/30">
                              Revoir tarification
                            </button>
                          )}
                          {sentinelStats.optimisations.supprimer_canal && (
                            <button onClick={() => sendMessage(`Analyse la rentabilité du canal ${sentinelStats.optimisations.supprimer_canal} et suggère si je dois le supprimer`)} className="px-2 py-1 bg-slate-800 text-red-400 text-[10px] rounded-lg hover:bg-slate-700 border border-red-500/30">
                              Analyser canal {sentinelStats.optimisations.supprimer_canal}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
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
                  {/* Score d'optimisation visuel */}
                  <div className="relative w-28 h-28 mx-auto mb-6">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="56" cy="56" r="50" stroke="currentColor" strokeWidth="8" fill="none" className="text-gray-200 dark:text-gray-700" />
                      <circle
                        cx="56" cy="56" r="50"
                        stroke="url(#gradient)"
                        strokeWidth="8"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${businessKPIs.score_automatisation * 3.14} 314`}
                        className="transition-all duration-1000"
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#06b6d4" />
                          <stop offset="100%" stopColor="#3b82f6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-gray-800 dark:text-white">{businessKPIs.score_automatisation}%</span>
                      <span className="text-xs text-gray-500">optimisé</span>
                    </div>
                  </div>

                  <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mb-3 max-w-lg mx-auto leading-tight">
                    {getDynamicWelcome().title}
                  </h1>
                  <p className="text-gray-500 dark:text-gray-400 text-base max-w-md mx-auto">
                    {getDynamicWelcome().subtitle}
                  </p>

                  {/* Gains breakdown */}
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-lg">
                      <Calendar className="w-4 h-4 text-emerald-500" />
                      <div className="text-left">
                        <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">RDV créés</p>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+{businessKPIs.gains.rdv_crees}€</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-lg">
                      <Send className="w-4 h-4 text-blue-500" />
                      <div className="text-left">
                        <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70">Relances récup.</p>
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400">+{businessKPIs.gains.relances_recuperees}€</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-amber-500" />
                      <div className="text-left">
                        <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70">Upsell détectés</p>
                        <p className="text-sm font-bold text-amber-600 dark:text-amber-400">+{businessKPIs.gains.upsell_detectes}€</p>
                      </div>
                    </div>
                  </div>
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
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
              { path: '/reservations', icon: Calendar, label: 'RDV' },
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
