import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import {
  MessageSquare,
  Plus,
  Send,
  Loader2,
  Trash2,
  Bot,
  User,
  Sparkles,
  ArrowLeft,
  PanelLeftClose,
  PanelLeft
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api-config';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  streaming?: boolean;
  created_at?: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export default function AdminChat() {
  const [, setLocation] = useLocation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getToken = () => localStorage.getItem('admin_token');

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

  const loadConversations = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/chat/conversations`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/chat/conversations/${conversationId}/messages`, {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (err) {
      console.error('Error loading messages:', err);
    }
  };

  const createConversation = async (title?: string): Promise<string | null> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/chat/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ title: title || 'Nouvelle conversation' })
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(prev => [data.conversation, ...prev]);
        setCurrentConversation(data.conversation.id);
        setMessages([]);
        if (isMobile) setSidebarOpen(false);
        return data.conversation.id;
      }
      return null;
    } catch (err) {
      console.error('Error creating conversation:', err);
      return null;
    }
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Supprimer cette conversation ?')) return;

    try {
      await fetch(`${API_BASE_URL}/api/admin/chat/conversations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (currentConversation === id) {
        setCurrentConversation(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  const selectConversation = (conv: Conversation) => {
    setCurrentConversation(conv.id);
    loadMessages(conv.id);
    if (isMobile) setSidebarOpen(false);
  };

  // Fonction sendMessage avec streaming + fallback
  const sendMessage = useCallback(async (messageContent?: string) => {
    const contentToSend = messageContent || input.trim();
    if (!contentToSend || isLoading) return;

    // Clear input immediately
    if (!messageContent) {
      setInput('');
    }
    setIsLoading(true);

    // Create conversation if none selected
    let convId = currentConversation;
    if (!convId) {
      convId = await createConversation(contentToSend.substring(0, 50));
      if (!convId) {
        setIsLoading(false);
        return;
      }
    }

    // Add user message to UI
    const userMsgId = `user-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: userMsgId,
      role: 'user',
      content: contentToSend
    }]);

    // Add empty assistant message that will be filled
    const assistantMsgId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      streaming: true
    }]);

    try {
      // Essayer d'abord le streaming
      const streamUrl = `${API_BASE_URL}/api/admin/chat/conversations/${convId}/messages/stream`;

      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ content: contentToSend })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Check if response is SSE
      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        // Read SSE stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim();
                if (dataStr === '[DONE]') continue;

                try {
                  const data = JSON.parse(dataStr);

                  if (data.type === 'text' && data.content) {
                    setMessages(prev => prev.map(msg =>
                      msg.id === assistantMsgId
                        ? { ...msg, content: msg.content + data.content }
                        : msg
                    ));
                  }

                  if (data.type === 'done') {
                    setMessages(prev => prev.map(msg =>
                      msg.id === assistantMsgId
                        ? { ...msg, streaming: false }
                        : msg
                    ));
                  }

                  if (data.type === 'error') {
                    throw new Error(data.message || 'Erreur serveur');
                  }
                } catch {
                  // Ignore parse errors
                }
              }
            }
          }
        }
      } else {
        // Fallback: response is JSON (non-streaming)
        const data = await response.json();
        if (data.success && data.response) {
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMsgId
              ? { ...msg, content: data.response, streaming: false }
              : msg
          ));
        } else {
          throw new Error(data.error || 'Erreur inconnue');
        }
      }

      // Mark as complete
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMsgId
          ? { ...msg, streaming: false }
          : msg
      ));

      // Update conversation title if first message
      const conv = conversations.find(c => c.id === convId);
      if (conv && conv.title === 'Nouvelle conversation') {
        setConversations(prev => prev.map(c =>
          c.id === convId ? { ...c, title: contentToSend.substring(0, 50) } : c
        ));
      }

    } catch (err: any) {
      console.error('[AdminChat] Erreur:', err);

      // Try fallback to non-streaming endpoint
      try {
        const fallbackUrl = `${API_BASE_URL}/api/admin/chat/conversations/${convId}/messages`;
        const fallbackRes = await fetch(fallbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`
          },
          body: JSON.stringify({ content: contentToSend })
        });

        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          if (data.success && data.response) {
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMsgId
                ? { ...msg, content: data.response, streaming: false }
                : msg
            ));
            return;
          }
        }
      } catch {
        // Fallback also failed
      }

      // Update assistant message with error
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMsgId
          ? { ...msg, content: `Erreur: ${err.message}. Veuillez réessayer.`, streaming: false }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, currentConversation, conversations]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    sendMessage(suggestion);
  }, [sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // FIX 3: Fonction retour dashboard
  const goBackToDashboard = () => {
    setLocation('/admin/dashboard');
  };

  return (
    <div className="fixed inset-0 flex bg-zinc-950">
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        ${isMobile
          ? `fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
          : `relative transition-all duration-300 ease-in-out ${sidebarOpen ? 'w-72' : 'w-0'}`
        }
        bg-zinc-900 border-r border-zinc-800 flex flex-col flex-shrink-0 overflow-hidden
      `}>
        {/* Sidebar Header with toggle */}
        <div className="flex items-center justify-between p-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-lg flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="font-semibold text-white">NEXUS AI</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white"
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        {/* New conversation button */}
        <div className="p-3">
          <button
            onClick={() => createConversation()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-cyan-500/20 text-sm"
          >
            <Plus size={18} />
            Nouvelle conversation
          </button>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          {conversations.map(conv => (
            <div
              key={conv.id}
              onClick={() => selectConversation(conv)}
              className={`
                group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all
                ${currentConversation === conv.id
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
                }
              `}
            >
              <MessageSquare size={16} className="flex-shrink-0" />
              <span className="flex-1 truncate text-sm">{conv.title}</span>
              <button
                onClick={(e) => deleteConversation(conv.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="text-center text-zinc-500 py-8 text-sm">
              Aucune conversation
            </div>
          )}
        </div>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-zinc-800 text-xs text-zinc-500">
          Claude Sonnet 4
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-zinc-800 flex items-center px-4 gap-3 flex-shrink-0 bg-zinc-900/50">
          {/* Toggle sidebar button (visible when sidebar is closed) */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
              title="Afficher la sidebar"
            >
              <PanelLeft size={20} />
            </button>
          )}

          {/* Back to dashboard button */}
          <button
            onClick={goBackToDashboard}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
            title="Retour au dashboard"
          >
            <ArrowLeft size={20} />
          </button>

          <h1 className="text-white font-medium truncate flex-1">
            {currentConversation
              ? conversations.find(c => c.id === currentConversation)?.title || 'Chat'
              : 'Nouveau chat'
            }
          </h1>
        </header>

        {/* FIX 2: Messages centrés avec conteneur explicite */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 && !currentConversation ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4 py-8">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-cyan-500/20">
                <Bot size={32} className="text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">NEXUS AI Assistant</h2>
              <p className="text-zinc-400 max-w-md mb-8">
                Je suis votre assistant IA. Posez-moi des questions sur votre activité,
                vos rendez-vous, vos clients, ou demandez-moi de l'aide.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
                {[
                  "Montre-moi les rendez-vous d'aujourd'hui",
                  "Quels sont mes meilleurs clients ?",
                  "Analyse mes revenus du mois",
                  "Aide-moi à rédiger un message"
                ].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(suggestion)}
                    disabled={isLoading}
                    className="px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-500/50 rounded-xl text-left text-sm text-zinc-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Messages list - Style Claude.ai : user à droite, assistant à gauche */
            <div className="w-full flex flex-col items-center">
              <div className="w-full max-w-3xl px-4 md:px-6 py-6 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Assistant message : avatar à gauche + texte */}
                    {msg.role === 'assistant' && (
                      <div className="flex gap-3 max-w-[85%]">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                          <Bot size={16} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3 text-white whitespace-pre-wrap break-words leading-relaxed">
                            {msg.content || (msg.streaming ? '' : '...')}
                            {msg.streaming && (
                              <span className="inline-block w-2 h-4 bg-cyan-400 ml-1 animate-pulse" />
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* User message : bulle à droite */}
                    {msg.role === 'user' && (
                      <div className="max-w-[85%]">
                        <div className="bg-gradient-to-r from-cyan-500 to-blue-600 rounded-2xl rounded-tr-sm px-4 py-3 text-white whitespace-pre-wrap break-words leading-relaxed">
                          {msg.content}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Loading indicator quand on attend la réponse */}
                {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
                  <div className="flex justify-start">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center flex-shrink-0">
                        <Bot size={16} className="text-white" />
                      </div>
                      <div className="bg-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 text-zinc-400">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-sm">Réflexion en cours...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          )}
        </div>

        {/* FIX 2: Input centré */}
        <div className="border-t border-zinc-800 p-4 flex-shrink-0">
          <div className="w-full flex justify-center">
            <div className="w-full max-w-4xl">
              <div className="relative bg-zinc-800 rounded-2xl border border-zinc-700 focus-within:border-cyan-500/50 transition-colors">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Écrivez votre message..."
                  rows={1}
                  className="w-full bg-transparent text-white placeholder-zinc-500 px-4 py-3 pr-14 resize-none focus:outline-none max-h-[200px]"
                  disabled={isLoading}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 bottom-2 w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-zinc-600 disabled:to-zinc-600 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-all"
                >
                  {isLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
              <p className="text-xs text-zinc-500 text-center mt-2">
                Entrée pour envoyer · Maj+Entrée pour saut de ligne
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
