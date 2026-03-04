import { useEffect, useRef } from "react";
import { useChat } from "@/hooks/use-chat";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import { Navigation } from "@/components/navigation";
import { ChatBookingProvider, useChatBooking } from "@/contexts/ChatBookingContext";
import InteractiveMessage from "@/components/halimah/InteractiveMessage";
import {
  MessageCircle,
  Calendar,
  Scissors,
  Clock,
  XCircle,
  Sparkles,
  Star,
  Heart,
  Send
} from "lucide-react";

function ChatPageInner() {
  const { messages, sendMessage, isLoading } = useChat();
  const { stage, startBooking } = useChatBooking();
  const isBookingActive = stage !== 'idle';
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 font-sans">
      <Navigation />

      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 african-pattern opacity-5" />
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />

        {/* Floating icons */}
        <div className="absolute top-32 left-[8%] animate-float-slow opacity-10">
          <MessageCircle className="h-16 w-16 text-amber-500" />
        </div>
        <div className="absolute top-48 right-[10%] animate-float-medium opacity-10">
          <Calendar className="h-14 w-14 text-amber-500" />
        </div>
        <div className="absolute bottom-40 left-[15%] animate-float-fast opacity-10">
          <Scissors className="h-12 w-12 text-amber-500" />
        </div>
        <div className="absolute bottom-32 right-[12%] animate-float-slow opacity-10">
          <Star className="h-14 w-14 text-amber-500" />
        </div>
      </div>

      {/* Letterbox bars */}
      <div className="fixed top-0 left-0 right-0 h-4 bg-black z-30" />
      <div className="fixed bottom-0 left-0 right-0 h-4 bg-black z-30" />

      {/* Corner frames */}
      <div className="fixed top-8 left-6 w-12 h-12 border-l-2 border-t-2 border-amber-500/30 z-20 pointer-events-none" />
      <div className="fixed top-8 right-6 w-12 h-12 border-r-2 border-t-2 border-amber-500/30 z-20 pointer-events-none" />
      <div className="fixed bottom-8 left-6 w-12 h-12 border-l-2 border-b-2 border-amber-500/30 z-20 pointer-events-none" />
      <div className="fixed bottom-8 right-6 w-12 h-12 border-r-2 border-b-2 border-amber-500/30 z-20 pointer-events-none" />

      {/* Main Chat Area */}
      <main className="flex-1 pt-20 pb-44 relative z-10">
        {messages.length === 0 && !isBookingActive ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 animate-in fade-in duration-500">
            {/* Header badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-8">
              <MessageCircle className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300 text-sm font-medium">Réservation en ligne</span>
            </div>

            {/* Assistant Halimah Card */}
            <div className="relative bg-white/5 backdrop-blur-sm rounded-3xl p-8 border border-white/10 max-w-lg w-full mb-10 overflow-hidden">
              {/* Corner decorations */}
              <div className="absolute top-4 left-4 w-6 h-6 border-l-2 border-t-2 border-amber-500/50 rounded-tl-lg" />
              <div className="absolute top-4 right-4 w-6 h-6 border-r-2 border-t-2 border-amber-500/50 rounded-tr-lg" />
              <div className="absolute bottom-4 left-4 w-6 h-6 border-l-2 border-b-2 border-amber-500/50 rounded-bl-lg" />
              <div className="absolute bottom-4 right-4 w-6 h-6 border-r-2 border-b-2 border-amber-500/50 rounded-br-lg" />

              {/* Avatar and info */}
              <div className="flex items-center gap-5 mb-6">
                {/* Animated avatar */}
                <div className="relative">
                  <div className="absolute -inset-2 bg-gradient-to-r from-amber-500/30 to-orange-500/30 rounded-full blur-lg animate-pulse" />
                  <div className="relative flex flex-col items-center">
                    <span className="text-5xl">👩🏾‍🦱</span>
                    <div className="absolute -right-1 top-0 animate-wave origin-bottom-left">
                      <span className="text-2xl">👋🏾</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-xl text-white">Halimah</h3>
                  <p className="text-sm text-white/50">Assistante virtuelle de Fatou</p>
                </div>

                <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-emerald-500/20 rounded-full border border-emerald-500/30">
                  <span className="h-2 w-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  <span className="text-xs text-emerald-400 font-medium">En ligne</span>
                </div>
              </div>

              <p className="text-white/70 leading-relaxed">
                Bonjour ! Je suis Halimah, votre assistante coiffure chez Fat's Hair-Afro. Je peux vous aider à prendre rendez-vous, consulter nos services ou répondre à vos questions. Comment puis-je vous aider aujourd'hui ?
              </p>

              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-500/5 rounded-3xl pointer-events-none" />
            </div>

            {/* Suggestions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
              {/* Bouton principal de réservation rapide */}
              <button
                onClick={startBooking}
                className="col-span-1 md:col-span-2 group relative bg-gradient-to-r from-amber-500/20 to-orange-500/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-amber-500/30 hover:border-amber-500/60 transition-all duration-300 text-left flex items-center gap-4"
              >
                <div className="flex items-center justify-center w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div>
                  <span className="text-white font-semibold text-lg block">Prendre rendez-vous</span>
                  <span className="text-white/50 text-sm">Reservation rapide en quelques clics</span>
                </div>
                <Send className="ml-auto h-5 w-5 text-amber-400 group-hover:translate-x-1 transition-transform" />
              </button>

              {[
                { text: "Quels sont vos services ?", icon: <Scissors className="h-5 w-5" />, color: "from-pink-500 to-rose-500" },
                { text: "Quels sont vos horaires ?", icon: <Clock className="h-5 w-5" />, color: "from-emerald-500 to-teal-500" },
                { text: "Je veux annuler mon RDV", icon: <XCircle className="h-5 w-5" />, color: "from-violet-500 to-purple-500" },
              ].map((suggestion, index) => (
                <button
                  key={suggestion.text}
                  onClick={() => sendMessage(suggestion.text)}
                  className="group relative bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10 hover:bg-white/10 hover:border-amber-500/30 transition-all duration-300 text-left flex items-center gap-4"
                >
                  <div className={`flex items-center justify-center w-12 h-12 bg-gradient-to-br ${suggestion.color} rounded-xl shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <div className="text-white">{suggestion.icon}</div>
                  </div>
                  <span className="text-white/80 group-hover:text-white transition-colors">{suggestion.text}</span>

                  {/* Arrow indicator */}
                  <Send className="ml-auto h-4 w-4 text-white/0 group-hover:text-amber-400 transition-all duration-300 group-hover:translate-x-1" />

                  {/* Corner accents on hover */}
                  <div className="absolute top-2 right-2 w-4 h-4 border-t border-r border-amber-500/0 group-hover:border-amber-500/50 transition-colors duration-300 rounded-tr" />
                  <div className="absolute bottom-2 left-2 w-4 h-4 border-b border-l border-amber-500/0 group-hover:border-amber-500/50 transition-colors duration-300 rounded-bl" />
                </button>
              ))}
            </div>

            {/* Tip */}
            <div className="mt-10 flex items-center gap-3 text-white/40 text-sm">
              <Sparkles className="h-4 w-4 text-amber-500/50" />
              <span>Vous pouvez aussi utiliser le micro pour dicter votre message</span>
              <Sparkles className="h-4 w-4 text-amber-500/50" />
            </div>

            {/* Decorative line */}
            <div className="mt-8 flex items-center justify-center gap-4">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-amber-500/30" />
              <Heart className="h-4 w-4 text-amber-500/30" />
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-amber-500/30" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col w-full">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} onQuickReply={sendMessage} />
            ))}

            {/* Flow de réservation interactif */}
            {isBookingActive && (
              <div className="w-full p-6">
                <div className="mx-auto max-w-3xl">
                  <InteractiveMessage />
                </div>
              </div>
            )}

            {isLoading && !isBookingActive && (
              <div className="w-full p-6 animate-pulse">
                <div className="mx-auto max-w-3xl flex gap-6">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-500/30 shrink-0 border border-amber-500/20" />
                  <div className="space-y-3 flex-1 pt-1">
                    <div className="h-4 bg-white/10 rounded w-3/4" />
                    <div className="h-4 bg-white/10 rounded w-1/2" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} className="h-4" />
          </div>
        )}
      </main>

      {/* Input Area */}
      <ChatInput onSend={sendMessage} isLoading={isLoading} />
    </div>
  );
}

// Export avec le provider de booking
export default function ChatPage() {
  return (
    <ChatBookingProvider>
      <ChatPageInner />
    </ChatBookingProvider>
  );
}
