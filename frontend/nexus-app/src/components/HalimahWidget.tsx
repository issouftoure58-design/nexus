import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, Volume2, VolumeX, Mic, MicOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiUrl, getTenantFromHostname } from '@/lib/api-config';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// Types pour Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

type VoiceInputStatus = 'inactive' | 'listening' | 'processing';

// Timeout auto-stop (10 secondes max d'écoute)
const VOICE_TIMEOUT_MS = 10000;

export default function HalimahWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Bonjour ! Je suis Halimah, l'assistante virtuelle de Fat's Hair-Afro. Comment puis-je vous aider aujourd'hui ? Vous pouvez me poser des questions sur nos services, nos tarifs, ou réserver un rendez-vous."
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('halimah_session_id');
    }
    return null;
  });
  const [showPulse, setShowPulse] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceInputStatus, setVoiceInputStatus] = useState<VoiceInputStatus>('inactive');
  const [isVoiceInputSupported, setIsVoiceInputSupported] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Vérifier si Web Speech API est supportée
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsVoiceInputSupported(!!SpeechRecognition);
  }, []);

  // Démarrer/Arrêter la reconnaissance vocale
  const toggleVoiceInput = useCallback(() => {
    if (voiceInputStatus !== 'inactive') {
      // Arrêter
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setVoiceInputStatus('inactive');
      return;
    }

    // Démarrer
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setVoiceInputStatus('listening');
      // Auto-stop après timeout
      timeoutRef.current = setTimeout(() => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
          console.log('[HALIMAH WIDGET] Timeout: arrêt automatique');
        }
      }, VOICE_TIMEOUT_MS);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript) {
        setInput(finalTranscript.trim());
        setVoiceInputStatus('processing');
        recognition.stop();
      } else if (interimTranscript) {
        setInput(interimTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[HALIMAH WIDGET] Erreur reconnaissance vocale:', event.error);
      setVoiceInputStatus('inactive');
      recognitionRef.current = null;

      // Messages d'erreur clairs selon le type
      switch (event.error) {
        case 'not-allowed':
          alert('🎤 Microphone non autorisé\n\nVeuillez autoriser l\'accès au microphone dans les paramètres de votre navigateur.');
          break;
        case 'no-speech':
          // Silencieux - pas d'erreur affichée
          break;
        case 'network':
          alert('🌐 Erreur réseau\n\nVérifiez votre connexion internet et réessayez.');
          break;
        case 'aborted':
          // L'utilisateur a annulé - pas d'erreur
          break;
        case 'audio-capture':
          alert('🎤 Microphone non détecté\n\nVérifiez que votre microphone est branché et fonctionne.');
          break;
        case 'service-not-allowed':
          alert('🔒 Service non disponible\n\nLa reconnaissance vocale nécessite une connexion sécurisée (HTTPS).');
          break;
        default:
          console.warn('[HALIMAH WIDGET] Erreur vocale non gérée:', event.error);
      }
    };

    recognition.onend = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setVoiceInputStatus('inactive');
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [voiceInputStatus]);

  // Scroll automatique vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cacher le pulse après ouverture
  useEffect(() => {
    if (isOpen) setShowPulse(false);
  }, [isOpen]);

  // Nettoyage texte pour TTS
  const cleanTextForSpeech = (text: string): string => {
    return text
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/[*#_~`]/g, '')
      .replace(/(\d+)h(\d+)/gi, '$1 heures $2')
      .replace(/(\d+)h\b/gi, '$1 heures')
      .replace(/€/g, ' euros ')
      .replace(/\n+/g, '. ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  // Synthèse vocale ElevenLabs
  const speak = useCallback(async (text: string) => {
    if (!voiceEnabled || !text) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const cleanedText = cleanTextForSpeech(text);
    if (!cleanedText) return;

    setIsSpeaking(true);

    try {
      const response = await fetch(apiUrl('/api/tts/elevenlabs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanedText })
      });

      if (!response.ok) throw new Error('TTS error');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
      console.error('[HALIMAH WIDGET] TTS error:', error);
      setIsSpeaking(false);
    }
  }, [voiceEnabled]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Create empty assistant message for streaming
    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: ''
    }]);

    try {
      const response = await fetch(apiUrl('/api/chat/stream'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': getTenantFromHostname(),
        },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: sessionId,
          isFirstMessage: messages.length === 1
        })
      });

      if (!response.ok || !response.body) {
        throw new Error('Stream failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(part.slice(6));

            if (data.type === 'text') {
              fullText += data.content;
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: fullText } : m
              ));
            } else if (data.type === 'done') {
              if (data.sessionId && data.sessionId !== sessionId) {
                setSessionId(data.sessionId);
                sessionStorage.setItem('halimah_session_id', data.sessionId);
              }
            } else if (data.type === 'error') {
              fullText = data.content || "Désolée, je n'ai pas compris. Pouvez-vous reformuler ?";
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: fullText } : m
              ));
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // Audio désactivé sur web chat - uniquement texte
      // speak() réservé au canal téléphone (Twilio)
    } catch (error) {
      console.error('Erreur:', error);
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: "Désolée, une erreur s'est produite. Veuillez réessayer." }
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Bulle flottante */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 group"
          aria-label="Ouvrir le chat avec Halimah"
        >
          {/* Pulse animation */}
          {showPulse && (
            <span className="absolute inset-0 rounded-full bg-amber-500 animate-ping opacity-75" />
          )}

          {/* Bouton principal */}
          <div className="relative flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 rounded-full shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all duration-300 hover:scale-110">
            <MessageCircle className="w-7 h-7 text-white" />
          </div>

          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <div className="bg-zinc-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg whitespace-nowrap">
              Besoin d'aide ? Je suis Halimah !
              <div className="absolute top-full right-6 w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-zinc-900" />
            </div>
          </div>
        </button>
      )}

      {/* Fenêtre de chat */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] h-[600px] max-h-[calc(100vh-6rem)] bg-white rounded-2xl shadow-2xl border border-amber-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-xl">👩🏾‍🦱</span>
              </div>
              <div>
                <h3 className="text-white font-semibold">Halimah</h3>
                <p className="text-amber-100 text-xs flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  En ligne
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Bouton voix masqué - audio désactivé sur web chat */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-amber-50/50 to-white">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-br-md'
                      : 'bg-white border border-amber-100 text-zinc-800 rounded-bl-md shadow-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-amber-100 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                    <span className="text-sm text-zinc-500">Halimah réfléchit...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-amber-100 bg-white">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={voiceInputStatus === 'listening' ? '🎤 Parlez maintenant...' : 'Écrivez votre message...'}
                className={`flex-1 px-4 py-3 bg-amber-50 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder:text-amber-400 transition-colors ${
                  voiceInputStatus === 'listening' ? 'border-red-400 bg-red-50' : 'border-amber-200'
                }`}
                disabled={isLoading || voiceInputStatus === 'listening'}
              />
              {/* Bouton Micro */}
              {isVoiceInputSupported && (
                <Button
                  type="button"
                  onClick={toggleVoiceInput}
                  disabled={isLoading}
                  className={`h-12 w-12 rounded-xl shadow-md transition-all ${
                    voiceInputStatus === 'listening'
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                      : voiceInputStatus === 'processing'
                      ? 'bg-orange-500 hover:bg-orange-600'
                      : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-600'
                  }`}
                  title={voiceInputStatus === 'inactive' ? 'Commande vocale' : 'Arrêter'}
                >
                  {voiceInputStatus === 'inactive' ? (
                    <Mic className="w-5 h-5" />
                  ) : (
                    <MicOff className="w-5 h-5 text-white" />
                  )}
                </Button>
              )}
              {/* Bouton Envoyer */}
              <Button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="h-12 w-12 bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 rounded-xl shadow-md"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-xs text-zinc-400 text-center mt-2">
              Propulsé par l'IA • Fat's Hair-Afro
            </p>
          </div>
        </div>
      )}
    </>
  );
}
