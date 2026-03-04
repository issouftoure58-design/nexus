import { useState, useRef, useEffect } from "react";
import { SendHorizontal, Loader2, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
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

type SpeechRecognitionStatus = "inactive" | "listening" | "processing";

// Timeout auto-stop (10 secondes max d'écoute)
const VOICE_TIMEOUT_MS = 10000;

export function ChatInput({ onSend, isLoading }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<SpeechRecognitionStatus>("inactive");
  const [isVoiceSupported, setIsVoiceSupported] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Vérifier si Web Speech API est supportée
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsVoiceSupported(!!SpeechRecognition);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim() && !isLoading) {
      onSend(input);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  // Démarrer/Arrêter la reconnaissance vocale
  const toggleVoiceRecognition = () => {
    if (voiceStatus !== "inactive") {
      // Arrêter
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setVoiceStatus("inactive");
      return;
    }

    // Démarrer
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("La reconnaissance vocale n'est pas supportée par votre navigateur.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = false; // Une seule phrase à la fois
    recognition.interimResults = true; // Résultats en temps réel pour feedback immédiat

    recognition.onstart = () => {
      setVoiceStatus("listening");
      // Auto-stop après timeout
      timeoutRef.current = setTimeout(() => {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
          console.log("Timeout: arrêt automatique de l'écoute");
        }
      }, VOICE_TIMEOUT_MS);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      // Parcourir tous les résultats pour obtenir le texte en temps réel
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Afficher le texte en temps réel (final ou interim)
      if (finalTranscript) {
        setInput(finalTranscript.trim());
        setVoiceStatus("processing");
        // Arrêter après résultat final
        recognition.stop();
      } else if (interimTranscript) {
        // Afficher le texte temporaire pendant que l'utilisateur parle
        setInput(interimTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Erreur reconnaissance vocale:", event.error);
      setVoiceStatus("inactive");
      recognitionRef.current = null;

      // Messages d'erreur clairs selon le type
      switch (event.error) {
        case "not-allowed":
          alert("🎤 Microphone non autorisé\n\nVeuillez autoriser l'accès au microphone dans les paramètres de votre navigateur.");
          break;
        case "no-speech":
          // Silencieux - pas d'erreur affichée
          console.log("Aucune parole détectée");
          break;
        case "network":
          alert("🌐 Erreur réseau\n\nVérifiez votre connexion internet et réessayez.");
          break;
        case "aborted":
          // L'utilisateur a annulé - pas d'erreur
          break;
        case "audio-capture":
          alert("🎤 Microphone non détecté\n\nVérifiez que votre microphone est branché et fonctionne.");
          break;
        case "service-not-allowed":
          alert("🔒 Service non disponible\n\nLa reconnaissance vocale n'est pas autorisée sur ce site (HTTPS requis).");
          break;
        default:
          console.warn("Erreur vocale non gérée:", event.error);
      }
    };

    recognition.onend = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setVoiceStatus("inactive");
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-zinc-950 via-zinc-950/95 to-transparent pb-8 pt-12 px-4 z-20">
      <div className="mx-auto max-w-3xl">
        <div className="relative flex items-end w-full p-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl shadow-lg shadow-amber-500/5 ring-offset-background focus-within:ring-2 focus-within:ring-amber-500/30 focus-within:border-amber-500/50 transition-all duration-200">
          {/* Corner decorations */}
          <div className="absolute top-1 left-1 w-3 h-3 border-l border-t border-amber-500/30 rounded-tl" />
          <div className="absolute top-1 right-1 w-3 h-3 border-r border-t border-amber-500/30 rounded-tr" />
          <div className="absolute bottom-1 left-1 w-3 h-3 border-l border-b border-amber-500/30 rounded-bl" />
          <div className="absolute bottom-1 right-1 w-3 h-3 border-r border-b border-amber-500/30 rounded-br" />

          <Textarea
            ref={textareaRef}
            tabIndex={0}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrivez votre message..."
            className="min-h-[44px] w-full resize-none border-0 bg-transparent py-3 px-3 focus-visible:ring-0 focus-visible:ring-offset-0 text-base max-h-[200px] text-white placeholder:text-white/40"
            disabled={isLoading}
          />
          <div className="flex gap-1 pb-1.5 pr-1.5">
            {/* Bouton Micro */}
            {isVoiceSupported && (
              <Button
                type="button"
                onClick={toggleVoiceRecognition}
                disabled={isLoading}
                size="icon"
                variant="ghost"
                className={cn(
                  "h-9 w-9 rounded-xl transition-all duration-200 shrink-0",
                  voiceStatus === "listening" && "bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse border border-red-500/30",
                  voiceStatus === "processing" && "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30",
                  voiceStatus === "inactive" && "text-white/50 hover:text-amber-400 hover:bg-amber-500/10"
                )}
                title={voiceStatus === "inactive" ? "Commande vocale" : "Arrêter l'écoute"}
              >
                {voiceStatus === "inactive" ? (
                  <Mic className="h-4 w-4" />
                ) : (
                  <MicOff className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {voiceStatus === "inactive" ? "Activer le micro" : "Désactiver le micro"}
                </span>
              </Button>
            )}

            {/* Bouton Envoyer */}
            <Button
              onClick={() => handleSubmit()}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-9 w-9 rounded-xl transition-all duration-200 shrink-0 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-500/30 disabled:opacity-50 disabled:shadow-none"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="h-4 w-4" />
              )}
              <span className="sr-only">Envoyer le message</span>
            </Button>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-white/40">
          Halimah peut faire des erreurs. Vérifiez les informations importantes.
        </p>
      </div>
    </div>
  );
}
