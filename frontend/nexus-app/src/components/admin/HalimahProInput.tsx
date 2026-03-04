import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Mic, MicOff } from 'lucide-react';

// Types pour Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

type VoiceStatus = 'inactive' | 'listening' | 'processing';

// Timeout auto-stop (10 secondes)
const VOICE_TIMEOUT_MS = 10000;

interface HalimahProInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function HalimahProInput({
  onSend,
  disabled = false,
  placeholder = "Demande quelque chose à Halimah..."
}: HalimahProInputProps) {
  const [message, setMessage] = useState('');
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('inactive');
  const [isVoiceSupported, setIsVoiceSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Vérifier support Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsVoiceSupported(!!SpeechRecognition);
  }, []);

  // Démarrer/Arrêter la reconnaissance vocale
  const toggleVoice = useCallback(() => {
    if (voiceStatus !== 'inactive') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
      setVoiceStatus('inactive');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setVoiceStatus('listening');
      timeoutRef.current = setTimeout(() => {
        if (recognitionRef.current) recognitionRef.current.stop();
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
        setMessage(finalTranscript.trim());
        setVoiceStatus('processing');
        recognition.stop();
      } else if (interimTranscript) {
        setMessage(interimTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[HALIMAH PRO] Erreur vocale:', event.error);
      setVoiceStatus('inactive');
      if (event.error === 'not-allowed') {
        alert('🎤 Veuillez autoriser l\'accès au microphone.');
      }
    };

    recognition.onend = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setVoiceStatus('inactive');
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [voiceStatus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={voiceStatus === 'listening' ? '🎤 Parlez maintenant...' : placeholder}
        disabled={disabled || voiceStatus === 'listening'}
        rows={1}
        className={`
          flex-1 px-4 py-3 bg-gray-50 border rounded-2xl
          resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          text-sm placeholder:text-gray-400 transition-colors
          ${voiceStatus === 'listening' ? 'border-red-400 bg-red-50' : 'border-gray-200'}
        `}
        style={{
          minHeight: '48px',
          maxHeight: '120px'
        }}
      />
      {/* Bouton Micro */}
      {isVoiceSupported && (
        <button
          type="button"
          onClick={toggleVoice}
          disabled={disabled}
          className={`
            w-12 h-12 rounded-full flex items-center justify-center transition-all
            ${voiceStatus === 'listening'
              ? 'bg-red-500 hover:bg-red-600 animate-pulse'
              : voiceStatus === 'processing'
              ? 'bg-orange-500 hover:bg-orange-600'
              : 'bg-gray-200 hover:bg-gray-300 text-gray-600'}
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
          title={voiceStatus === 'inactive' ? 'Commande vocale' : 'Arrêter'}
        >
          {voiceStatus === 'inactive' ? (
            <Mic className="w-5 h-5" />
          ) : (
            <MicOff className="w-5 h-5 text-white" />
          )}
        </button>
      )}
      {/* Bouton Envoyer */}
      <button
        type="submit"
        disabled={disabled || !message.trim()}
        className="
          w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600
          flex items-center justify-center
          hover:shadow-lg transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
        "
      >
        <Send className="w-5 h-5 text-white" />
      </button>
    </form>
  );
}
