import { useState, useEffect, useRef } from 'react'
import { Send, Mic, Sparkles, Volume2, VolumeX } from 'lucide-react'
import { clsx } from 'clsx'

export default function NexusChat({
  messages,
  onSend,
  isTyping,
  inputDisabled,
  disableAutoScroll = false,
  voiceEnabled = false,
  isListening = false,
  transcript = '',
  onStartVoice,
  onStopVoice,
  isSpeaking = false
}) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const chatContainerRef = useRef(null)

  // Auto-scroll only within the chat container, not the page
  useEffect(() => {
    if (!disableAutoScroll && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages, disableAutoScroll])

  // Mettre à jour l'input avec le transcript vocal
  useEffect(() => {
    if (transcript) {
      setInput(transcript)
    }
  }, [transcript])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (input.trim() && !inputDisabled) {
      onSend(input.trim())
      setInput('')
    }
  }

  const handleVoiceClick = () => {
    if (isListening) {
      onStopVoice?.()
      if (input.trim()) {
        setTimeout(() => {
          onSend(input.trim())
          setInput('')
        }, 300)
      }
    } else {
      onStartVoice?.()
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-dark-900/80 backdrop-blur-xl border border-neon-cyan/20 rounded-2xl overflow-hidden shadow-2xl">
        {/* Messages area */}
        <div ref={chatContainerRef} className="h-48 md:h-56 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={clsx(
                'flex animate-slide-up',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className={clsx(
                'max-w-[80%] rounded-2xl px-4 py-3',
                msg.role === 'user'
                  ? 'bg-primary-600 text-white rounded-br-md'
                  : 'bg-dark-700 text-gray-100 rounded-bl-md border border-neon-cyan/10'
              )}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 bg-gradient-to-br from-neon-cyan to-primary-500 rounded-full flex items-center justify-center">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs text-neon-cyan font-medium">NEXUS</span>
                  </div>
                )}
                <p className="text-sm md:text-base leading-relaxed">
                  {msg.content}
                  {msg.isStreaming && (
                    <span className="inline-block w-2 h-4 bg-neon-cyan ml-1 animate-typing" />
                  )}
                </p>
              </div>
            </div>
          ))}

          {isTyping && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-dark-700 rounded-2xl rounded-bl-md px-4 py-3 border border-neon-cyan/10">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <div className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-neon-cyan rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <form onSubmit={handleSubmit} className="border-t border-neon-cyan/10 p-4">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Je vous écoute..." : "Posez votre question..."}
              disabled={inputDisabled || isListening}
              className={clsx(
                "flex-1 bg-dark-800 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-all disabled:opacity-50",
                isListening
                  ? "border-red-500/50 ring-2 ring-red-500/30 animate-pulse"
                  : "border-dark-600 focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30"
              )}
            />
            {voiceEnabled && (
              <button
                type="button"
                onClick={handleVoiceClick}
                disabled={inputDisabled || isSpeaking}
                className={clsx(
                  "p-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                  isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : "bg-dark-700 text-gray-400 hover:bg-dark-600 hover:text-white border border-dark-600"
                )}
                title={isListening ? "Arrêter l'écoute" : "Parler"}
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
            <button
              type="submit"
              disabled={!input.trim() || inputDisabled || isListening}
              className="p-3 bg-gradient-to-r from-neon-cyan to-primary-500 rounded-xl text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            {isSpeaking ? (
              <span className="text-neon-cyan flex items-center justify-center gap-2">
                <Volume2 className="w-3 h-3 animate-pulse" /> NEXUS parle...
              </span>
            ) : isListening ? (
              <span className="text-red-400 flex items-center justify-center gap-2">
                <Mic className="w-3 h-3 animate-pulse" /> Parlez maintenant...
              </span>
            ) : voiceEnabled ? (
              "Tapez ou cliquez sur le micro pour parler"
            ) : (
              "NEXUS peut répondre à toutes vos questions"
            )}
          </p>
        </form>
      </div>
    </div>
  )
}
