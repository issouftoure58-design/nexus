import { useState, useCallback } from "react";
import { apiUrl, getTenantFromHostname } from "@/lib/api-config";

export type QuickReply = {
  label: string;
  value?: string;
  type: 'service' | 'timeslot' | 'confirm';
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  quickReplies?: QuickReply[] | null;
};

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('halimah_session_id');
    }
    return null;
  });

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    setError(null);
    setIsLoading(true);

    // 1. Add user message immediately
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    // 2. Create empty assistant message for streaming
    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    }]);

    try {
      const isFirstMessage = messages.length === 0;

      const res = await fetch(apiUrl('/api/chat/stream'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': getTenantFromHostname(),
        },
        body: JSON.stringify({
          message: messageText,
          sessionId,
          isFirstMessage,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Failed to send message");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: m.content + data.content }
                  : m
              ));
            } else if (data.type === 'done') {
              if (data.quickReplies) {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, quickReplies: data.quickReplies }
                    : m
                ));
              }
              if (data.sessionId && data.sessionId !== sessionId) {
                setSessionId(data.sessionId);
                sessionStorage.setItem('halimah_session_id', data.sessionId);
              }
            } else if (data.type === 'error') {
              setMessages(prev => prev.map(m =>
                m.id === assistantId
                  ? { ...m, content: data.content || "Désolée, une erreur s'est produite." }
                  : m
              ));
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: "Désolée, une erreur s'est produite. Veuillez réessayer." }
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  }, [messages.length, sessionId, isLoading]);

  return {
    messages,
    sendMessage,
    isLoading,
    error,
  };
}
