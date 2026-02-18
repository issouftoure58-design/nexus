import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { motion } from "framer-motion";
import { User, Download, FileText, Image as ImageIcon } from "lucide-react";
import type { Message } from "@/hooks/use-chat";

interface ChatMessageProps {
  message: Message;
  onQuickReply?: (text: string) => void;
}

export function ChatMessage({ message, onQuickReply }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex w-full gap-4 p-6 first:pt-0 last:pb-8",
        isUser ? "bg-white/5" : "bg-gradient-to-r from-amber-500/5 to-orange-500/5"
      )}
    >
      <div className="mx-auto flex max-w-3xl w-full gap-4 md:gap-6">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full border-2 shadow-md",
            isUser
              ? "bg-white/10 text-white/70 border-white/20"
              : "bg-gradient-to-br from-amber-500 to-orange-500 text-white border-amber-400/50 shadow-amber-500/30"
          )}
        >
          {isUser ? (
            <User className="h-5 w-5" />
          ) : (
            <span className="text-lg">👩🏾‍🦱</span>
          )}
        </div>

        <div className="flex-1 space-y-2 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm font-semibold",
              isUser ? "text-white" : "text-amber-400"
            )}>
              {isUser ? "Vous" : "Halimah"}
            </span>
            <span className="text-xs text-white/40">
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className={cn(
            "prose prose-invert max-w-none break-words text-sm md:text-base leading-7",
            "prose-p:text-white/80 prose-strong:text-amber-400 prose-a:text-amber-400 prose-a:no-underline hover:prose-a:underline",
            "prose-ul:text-white/80 prose-ol:text-white/80 prose-li:text-white/80",
            "prose-code:bg-white/10 prose-code:text-amber-300 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded",
            "prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-white/10"
          )}>
            <ReactMarkdown
              components={{
                // Afficher les images avec un style amélioré
                img: ({ src, alt }) => (
                  <div className="my-4 rounded-lg overflow-hidden border border-white/10 bg-white/5">
                    <img
                      src={src}
                      alt={alt || "Image"}
                      className="max-w-full h-auto max-h-80 object-contain mx-auto"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.parentElement!.innerHTML = `
                          <div class="flex items-center gap-2 p-4 text-white/60">
                            <span>Image non disponible: ${alt || src}</span>
                          </div>
                        `;
                      }}
                    />
                    {alt && (
                      <div className="px-3 py-2 text-xs text-white/50 bg-white/5 border-t border-white/10">
                        {alt}
                      </div>
                    )}
                  </div>
                ),
                // Afficher les liens vers les fichiers avec un style spécial
                a: ({ href, children }) => {
                  // Détecter si c'est un fichier du workspace
                  const isWorkspaceFile = href?.includes('/halimah-workspace/');
                  const isImage = href?.match(/\.(png|jpg|jpeg|gif|webp)$/i);
                  const isDocument = href?.match(/\.(txt|md|csv|json|pdf)$/i);

                  if (isWorkspaceFile && (isImage || isDocument)) {
                    return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-1.5 my-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg text-amber-400 no-underline transition-colors"
                      >
                        {isImage ? <ImageIcon size={14} /> : <FileText size={14} />}
                        <span>{children}</span>
                        <Download size={12} className="opacity-60" />
                      </a>
                    );
                  }

                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  );
                }
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>

          {/* Quick Replies */}
          {!isUser && message.quickReplies && message.quickReplies.length > 0 && onQuickReply && (
            <div className="flex flex-wrap gap-2 pt-3">
              {message.quickReplies.map((qr, i) => (
                <button
                  key={i}
                  onClick={() => onQuickReply(qr.value || qr.label)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200",
                    "hover:scale-105 active:scale-95",
                    qr.type === 'service'
                      ? "bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50"
                      : qr.type === 'timeslot'
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50"
                      : "bg-white/5 border-white/20 text-white/80 hover:bg-white/10 hover:border-white/30"
                  )}
                >
                  {qr.type === 'service' && '\u{1F487}\u200D\u2640\uFE0F '}
                  {qr.type === 'timeslot' && '\u{1F4C5} '}
                  {qr.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
