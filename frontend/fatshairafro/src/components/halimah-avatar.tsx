import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageMessage {
  text: string;
  delay: number;
}

const PAGE_MESSAGES: Record<string, PageMessage[]> = {
  "/": [
    { text: "Bonjour ! Je suis Halimah. Besoin d'un rendez-vous ?", delay: 3000 },
    { text: "N'hésitez pas à me poser vos questions !", delay: 13000 },
  ],
  "/services": [
    { text: "Découvrez nos services ! Je peux vous aider à réserver.", delay: 3000 },
    { text: "Quel service vous intéresse ?", delay: 13000 },
  ],
  "/a-propos": [
    { text: "Envie de sublimer vos cheveux ? Je suis là pour vous !", delay: 3000 },
    { text: "Plus de 10 ans d'expertise coiffure afro !", delay: 13000 },
  ],
  "/reserver": [
    { text: "Je suis prête à vous aider ! Écrivez-moi votre demande.", delay: 3000 },
  ],
  "/admin": [],
};

export function HalimahAvatar() {
  const [location, navigate] = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");
  const [showBubble, setShowBubble] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [hasSpoken, setHasSpoken] = useState<Set<string>>(new Set());

  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const mouthIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clear all timeouts
  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    if (mouthIntervalRef.current) {
      clearInterval(mouthIntervalRef.current);
      mouthIntervalRef.current = null;
    }
  }, []);

  // Stop speaking animation
  const stopSpeaking = useCallback(() => {
    setIsSpeaking(false);
    setMouthOpen(false);
    if (mouthIntervalRef.current) {
      clearInterval(mouthIntervalRef.current);
      mouthIntervalRef.current = null;
    }
  }, []);

  // Speak function - text bubble only, no audio
  const speak = useCallback((text: string) => {
    setCurrentMessage(text);
    setShowBubble(true);
    setIsSpeaking(true);

    // Animate mouth without voice
    mouthIntervalRef.current = setInterval(() => {
      setMouthOpen(prev => !prev);
    }, 150);

    // Stop after approximate reading time
    const duration = Math.max(3000, text.length * 80);
    const timeout = setTimeout(() => {
      setIsSpeaking(false);
      setMouthOpen(false);
      if (mouthIntervalRef.current) {
        clearInterval(mouthIntervalRef.current);
        mouthIntervalRef.current = null;
      }
    }, duration);
    timeoutsRef.current.push(timeout);

    // Hide bubble after a bit longer
    const bubbleTimeout = setTimeout(() => {
      setShowBubble(false);
    }, duration + 2000);
    timeoutsRef.current.push(bubbleTimeout);
  }, []);

  // Handle page messages
  useEffect(() => {
    // Don't show on admin page or reservation page (has its own Halimah)
    if (location === "/admin" || location === "/reserver") {
      setIsVisible(false);
      return;
    }

    clearAllTimeouts();
    stopSpeaking();
    setShowBubble(false);

    // Show avatar after 3 seconds
    const showTimeout = setTimeout(() => {
      setIsVisible(true);
    }, 2000);
    timeoutsRef.current.push(showTimeout);

    // Get messages for current page
    const messages = PAGE_MESSAGES[location] || PAGE_MESSAGES["/"];
    const pageKey = `${location}-${messages[0]?.text}`;

    // Schedule messages
    messages.forEach((msg, index) => {
      // Only play first message once per session per page
      if (index === 0 && hasSpoken.has(pageKey)) {
        return;
      }

      const timeout = setTimeout(() => {
        speak(msg.text);
        if (index === 0) {
          setHasSpoken(prev => new Set([...prev, pageKey]));
        }
      }, msg.delay);
      timeoutsRef.current.push(timeout);
    });

    return () => {
      clearAllTimeouts();
      stopSpeaking();
    };
  }, [location, speak, clearAllTimeouts, stopSpeaking, hasSpoken]);


  // Handle click
  const handleClick = () => {
    if (location !== "/reserver") {
      navigate("/reserver");
    }
  };

  // Close bubble
  const closeBubble = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowBubble(false);
    stopSpeaking();
  };

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3",
        "hidden md:flex", // Hide on mobile
        "animate-in slide-in-from-bottom-10 fade-in duration-700"
      )}
    >
      {/* Speech Bubble */}
      {showBubble && currentMessage && (
        <div
          className={cn(
            "relative bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-4 max-w-[280px]",
            "border-2 border-purple-200 dark:border-purple-700",
            "animate-in fade-in slide-in-from-bottom-2 duration-300"
          )}
        >
          <button
            onClick={closeBubble}
            className="absolute -top-2 -right-2 p-1 bg-zinc-200 dark:bg-zinc-700 rounded-full hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
          <p className="text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed">
            {currentMessage}
          </p>
          {/* Triangle pointer */}
          <div className="absolute -bottom-3 right-8 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[12px] border-t-white dark:border-t-zinc-800" />
          <div className="absolute -bottom-[14px] right-8 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[12px] border-t-purple-200 dark:border-t-purple-700 -z-10" />
        </div>
      )}

      {/* Avatar Container */}
      <div
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "relative cursor-pointer transition-all duration-300",
          isHovered && "scale-105",
          isSpeaking && "animate-pulse-subtle"
        )}
      >
        {/* Avatar 3D moderne */}
        <div
          className={cn(
            "relative w-[90px] h-[90px] rounded-full overflow-hidden transition-all duration-300",
            isHovered && "rotate-3 scale-105",
            isSpeaking && "animate-pulse-subtle"
          )}
          style={{
            background: 'linear-gradient(145deg, #8B5CF6, #EC4899)',
            boxShadow: '0 8px 32px rgba(139, 92, 246, 0.4), 0 4px 16px rgba(236, 72, 153, 0.3), inset 0 2px 4px rgba(255,255,255,0.2)',
            transform: isHovered ? 'perspective(500px) rotateY(-5deg) rotateX(5deg)' : 'perspective(500px)',
          }}
        >
          {/* Inner circle with avatar */}
          <div
            className="absolute inset-[3px] rounded-full overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #E5C9A8 0%, #D4A574 30%, #C4956A 70%, #B8865C 100%)',
              boxShadow: 'inset 0 -4px 12px rgba(0,0,0,0.2), inset 0 4px 8px rgba(255,255,255,0.3)',
            }}
          >
            {/* Cheveux afro 3D */}
            <div
              className={cn(
                "absolute -top-1 -left-1 -right-1 h-[50px] rounded-t-full",
                isSpeaking && "animate-breathe"
              )}
              style={{
                background: 'radial-gradient(ellipse at 50% 80%, #2a2a2a 0%, #1a1a1a 40%, #0d0d0d 100%)',
                boxShadow: 'inset 0 -8px 16px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.3)',
              }}
            >
              {/* Texture des cheveux */}
              <div className="absolute inset-0 opacity-30" style={{
                background: 'repeating-radial-gradient(circle at 50% 100%, transparent 0px, transparent 2px, rgba(60,40,30,0.3) 2px, rgba(60,40,30,0.3) 4px)',
              }} />
              {/* Accessoires dorés */}
              <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 shadow-lg" />
              <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 shadow-lg" />
              <div className="absolute top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 shadow-lg" />
            </div>

            {/* Visage */}
            <div className="absolute top-[28px] left-1/2 -translate-x-1/2 w-[52px] h-[58px]">
              {/* Yeux */}
              <div className="absolute top-[14px] left-[8px] w-[12px] h-[9px] bg-white rounded-full shadow-inner overflow-hidden">
                <div className={cn(
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[6px] h-[6px] bg-[#2D1B0E] rounded-full transition-all",
                  isSpeaking && "animate-blink"
                )}>
                  <div className="absolute top-[1px] left-[1px] w-[2px] h-[2px] bg-white rounded-full" />
                </div>
              </div>
              <div className="absolute top-[14px] right-[8px] w-[12px] h-[9px] bg-white rounded-full shadow-inner overflow-hidden">
                <div className={cn(
                  "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[6px] h-[6px] bg-[#2D1B0E] rounded-full transition-all",
                  isSpeaking && "animate-blink"
                )}>
                  <div className="absolute top-[1px] left-[1px] w-[2px] h-[2px] bg-white rounded-full" />
                </div>
              </div>

              {/* Sourcils */}
              <div className="absolute top-[9px] left-[9px] w-[10px] h-[2px] bg-[#2D1B0E] rounded-full transform -rotate-6" />
              <div className="absolute top-[9px] right-[9px] w-[10px] h-[2px] bg-[#2D1B0E] rounded-full transform rotate-6" />

              {/* Cils */}
              <div className="absolute top-[12px] left-[6px] w-[3px] h-[1px] bg-[#2D1B0E] transform -rotate-45" />
              <div className="absolute top-[12px] right-[6px] w-[3px] h-[1px] bg-[#2D1B0E] transform rotate-45" />

              {/* Nez */}
              <div className="absolute top-[22px] left-1/2 -translate-x-1/2 w-[8px] h-[10px] rounded-full" style={{
                background: 'linear-gradient(180deg, transparent 0%, rgba(166, 123, 91, 0.3) 100%)',
              }} />

              {/* Bouche animée */}
              <div className="absolute top-[36px] left-1/2 -translate-x-1/2">
                {mouthOpen ? (
                  <div className="relative">
                    <div className="w-[18px] h-[10px] bg-[#6B2A3A] rounded-[50%] shadow-inner" />
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[14px] h-[4px] bg-white/80 rounded-t-full" />
                  </div>
                ) : (
                  <div
                    className="w-[18px] h-[8px] rounded-b-full"
                    style={{
                      background: 'linear-gradient(180deg, #E87D94, #D64D6F)',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
                    }}
                  />
                )}
              </div>

              {/* Joues roses */}
              <div className="absolute top-[24px] left-[2px] w-[10px] h-[8px] bg-pink-400/25 rounded-full blur-[2px]" />
              <div className="absolute top-[24px] right-[2px] w-[10px] h-[8px] bg-pink-400/25 rounded-full blur-[2px]" />
            </div>

            {/* Boucles d'oreilles */}
            <div className="absolute top-[42px] left-[6px] w-[6px] h-[6px] rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 shadow-lg" />
            <div className="absolute top-[42px] right-[6px] w-[6px] h-[6px] rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 shadow-lg" />
          </div>

          {/* Reflet 3D */}
          <div
            className="absolute top-0 left-0 w-full h-1/2 rounded-t-full pointer-events-none"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%)',
            }}
          />

          {/* Sparkle effects when speaking */}
          {isSpeaking && (
            <>
              <div className="absolute top-2 left-2 w-2 h-2 bg-yellow-400 rounded-full animate-ping" />
              <div className="absolute top-2 right-2 w-2 h-2 bg-yellow-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }} />
            </>
          )}
        </div>

        {/* Glow effect when speaking */}
        {isSpeaking && (
          <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-xl animate-pulse" />
        )}

        {/* Click hint */}
        {!showBubble && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium bg-white/90 dark:bg-zinc-800/90 px-2 py-0.5 rounded-full shadow">
              Cliquez pour discuter
            </span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        @keyframes pulse-subtle {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.3; }
        }
        @keyframes blink {
          0%, 90%, 100% { transform: translate(-50%, -50%) scaleY(1); }
          95% { transform: translate(-50%, -50%) scaleY(0.1); }
        }
        .animate-breathe {
          animation: breathe 3s ease-in-out infinite;
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 1.5s ease-in-out infinite;
        }
        .animate-twinkle {
          animation: twinkle 0.8s ease-in-out infinite;
        }
        .animate-blink {
          animation: blink 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
