import { useState, useEffect } from 'react'
import {
  Phone, MessageCircle, Calendar,
  Sparkles, ChevronRight, Play, Menu, X,
  Volume2, VolumeX, Image as ImageIcon, Film
} from 'lucide-react'

// Components
import StarfieldBackground from './components/StarfieldBackground'
import GallerySlideshow from './components/GallerySlideshow'
import DemosSection from './components/DemosSection'
import NexusRobot from './components/NexusRobot'
import NexusChat from './components/NexusChat'
import PricingSection from './components/PricingSection'
import TestimonialsSection from './components/TestimonialsSection'
import TrustBadges from './components/TrustBadges'
import FAQSection from './components/FAQSection'
import ContactForm from './components/ContactForm'

// Hooks
import useNexusAudio from './hooks/useNexusAudio'
import useTextToSpeech from './hooks/useTextToSpeech'
import useSoundEffects from './hooks/useSoundEffects'
import useSpeechRecognition from './hooks/useSpeechRecognition'
import useSpaceAmbient from './hooks/useSpaceAmbient'

// Utils
import cleanTextForTTS from './utils/cleanTextForTTS'
import { MESSAGES_CONFIG } from './utils/messages'

function App() {
  const [robotState, setRobotState] = useState('entering')
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [showStartButton, setShowStartButton] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { playAudio, stopAudio, isPlaying, audioEnabled, setAudioEnabled } = useNexusAudio()
  const { speak: speakTTS, stop: stopTTS, isSpeaking } = useTextToSpeech()
  const { playRobotBeeps, playConfirmBeep } = useSoundEffects()
  const {
    isListening,
    transcript,
    isSupported: voiceSupported,
    startListening,
    stopListening
  } = useSpeechRecognition()

  // Activer l'ambiance spatiale quand le son est activé
  useSpaceAmbient(audioEnabled && hasStarted)

  // Sequence d'entree - Robot arrive puis attend le clic
  useEffect(() => {
    setTimeout(() => {
      setRobotState('idle')
      setShowStartButton(true)
    }, 1500)
  }, [])

  // Fonction pour démarrer l'expérience (appelée au clic)
  const startExperience = async () => {
    setShowStartButton(false)
    setRobotState('talking')
    await speakMessage('welcome')
  }

  // Fonction pour faire parler Nexus (audio + texte synchronisé)
  const speakMessage = async (messageKey) => {
    const config = MESSAGES_CONFIG[messageKey]
    if (!config) return

    setIsTyping(true)
    setHasStarted(true)
    setRobotState('talking')

    setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }])

    const audioPromise = playAudio(config.audio)

    const estimatedAudioDuration = config.text.length / 25 * 1000
    const charDelay = estimatedAudioDuration / config.text.length

    for (let i = 0; i <= config.text.length; i++) {
      await new Promise(resolve => setTimeout(resolve, Math.max(charDelay, 15)))
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: config.text.slice(0, i)
        }
        return updated
      })
    }

    await audioPromise

    setMessages(prev => {
      const updated = [...prev]
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        isStreaming: false
      }
      return updated
    })

    setIsTyping(false)
    setRobotState('idle')
  }

  // API URL pour l'agent commercial
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

  // Gerer l'envoi d'un message utilisateur - Appel API avec streaming + TTS
  const handleSend = async (text) => {
    stopAudio()
    stopTTS()

    setMessages(prev => [...prev, { role: 'user', content: text }])

    setRobotState('listening')
    setHasStarted(true)

    if (audioEnabled) {
      playRobotBeeps()
    }

    await new Promise(resolve => setTimeout(resolve, 400))

    const chatHistory = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }))

    chatHistory.push({ role: 'user', content: text })

    setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }])
    setIsTyping(true)
    setRobotState('talking')

    let fullResponse = ''
    let spokenText = ''
    let sentenceBuffer = ''

    const speakSentence = (sentence) => {
      if (!audioEnabled || !sentence.trim()) return
      const cleanSentence = cleanTextForTTS(sentence)
      if (cleanSentence && cleanSentence !== spokenText) {
        speakTTS(cleanSentence)
        spokenText += cleanSentence
      }
    }

    try {
      const response = await fetch(`${API_URL}/api/landing/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory, stream: true })
      })

      if (!response.ok) throw new Error('API error')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.text) {
                fullResponse += parsed.text
                sentenceBuffer += parsed.text

                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: fullResponse
                  }
                  return updated
                })

                const sentenceMatch = sentenceBuffer.match(/^(.+?[.!?])\s*/)
                if (sentenceMatch) {
                  speakSentence(sentenceMatch[1])
                  sentenceBuffer = sentenceBuffer.slice(sentenceMatch[0].length)
                }
              }
            } catch (e) {
              // Ignorer les erreurs de parsing JSON
            }
          }
        }
      }

      if (sentenceBuffer.trim()) {
        speakSentence(sentenceBuffer)
      }

      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          isStreaming: false
        }
        return updated
      })

      if (audioEnabled) {
        await new Promise(resolve => {
          const checkSpeaking = setInterval(() => {
            if (!window.speechSynthesis.speaking) {
              clearInterval(checkSpeaking)
              playConfirmBeep()
              resolve()
            }
          }, 100)
          setTimeout(() => {
            clearInterval(checkSpeaking)
            resolve()
          }, 30000)
        })
      }

    } catch (error) {
      console.error('Chat API error:', error)
      const errorMsg = "Désolé, je rencontre un problème technique. Vous pouvez me contacter directement via le formulaire de contact ou essayer de nouveau dans quelques instants."
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          role: 'assistant',
          content: errorMsg,
          isStreaming: false
        }
        return updated
      })

      if (audioEnabled) {
        speakTTS(errorMsg)
      }
    }

    setIsTyping(false)
    setRobotState('idle')
  }

  return (
    <div className="min-h-screen bg-dark-950 text-white overflow-x-hidden">
      {/* Starfield Background */}
      <div className="fixed inset-0 z-0">
        <StarfieldBackground />
      </div>

      {/* Contenu principal */}
      <div className="relative z-10">

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-neon-cyan to-primary-500 rounded-xl flex items-center justify-center animate-pulse-glow">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                NEXUS
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#gallery" className="text-gray-400 hover:text-white transition">Galerie</a>
              <a href="#demo" className="text-gray-400 hover:text-white transition">Demo</a>
              <a href="#pricing" className="text-gray-400 hover:text-white transition">Tarifs</a>
            </div>

            <div className="flex items-center gap-4">
              <a href="https://nexus-admin-yedu.onrender.com/login" className="text-gray-400 hover:text-white transition hidden sm:block">
                Connexion
              </a>
              <a
                href="https://nexus-admin-yedu.onrender.com/signup"
                className="bg-gradient-to-r from-neon-cyan to-primary-500 text-white font-semibold py-2 px-5 rounded-xl hover:opacity-90 transition-opacity"
              >
                Essai gratuit
              </a>
              <button
                className="md:hidden p-2"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-dark-900 border-t border-white/5 animate-slide-up">
            <div className="px-4 py-4 space-y-3">
              <a href="#gallery" className="block text-gray-300 hover:text-white py-2" onClick={() => setMobileMenuOpen(false)}>Galerie</a>
              <a href="#demo" className="block text-gray-300 hover:text-white py-2" onClick={() => setMobileMenuOpen(false)}>Demo</a>
              <a href="#pricing" className="block text-gray-300 hover:text-white py-2" onClick={() => setMobileMenuOpen(false)}>Tarifs</a>
              <a href="https://nexus-admin-yedu.onrender.com/login" className="block text-gray-300 hover:text-white py-2">Connexion</a>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section - Robot + Chat Central */}
      <section className="min-h-screen flex flex-col items-center pt-20 pb-8 px-4 relative">
        <div className="text-center mb-4 animate-fade-in">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-2">
            <span className="bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
              Rencontrez
            </span>{' '}
            <span className="bg-gradient-to-r from-neon-cyan to-primary-400 bg-clip-text text-transparent">
              NEXUS
            </span>
          </h1>
          <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto">
            Votre assistant IA qui automatise tout votre business
          </p>
        </div>

        <div className="mb-4 scale-90 md:scale-100 relative">
          <NexusRobot state={robotState} />
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={`absolute -bottom-2 right-0 p-2 rounded-full border transition-all ${
              audioEnabled
                ? 'bg-neon-cyan/20 border-neon-cyan/50 text-neon-cyan'
                : 'bg-dark-800/80 border-white/10 text-gray-500'
            }`}
            title={audioEnabled ? 'Couper le son' : 'Activer le son'}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

        {showStartButton && (
          <button
            onClick={startExperience}
            className="mb-6 px-8 py-4 bg-gradient-to-r from-neon-cyan to-primary-500 text-white font-bold text-lg rounded-2xl hover:opacity-90 transition-all animate-pulse-glow flex items-center gap-3"
          >
            <Play className="w-6 h-6" />
            Cliquez pour parler avec NEXUS
          </button>
        )}

        {hasStarted && (
          <NexusChat
            messages={messages}
            onSend={handleSend}
            isTyping={isTyping}
            inputDisabled={isTyping || isSpeaking}
            voiceEnabled={voiceSupported && audioEnabled}
            isListening={isListening}
            transcript={transcript}
            onStartVoice={startListening}
            onStopVoice={stopListening}
            isSpeaking={isSpeaking}
          />
        )}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronRight className="w-5 h-5 text-gray-500 rotate-90" />
        </div>
      </section>

      {/* Features highlight */}
      <section className="py-16 px-4 bg-dark-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-2xl bg-dark-800/50 border border-white/5">
              <div className="w-14 h-14 bg-gradient-to-br from-neon-cyan/20 to-primary-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Phone className="w-7 h-7 text-neon-cyan" />
              </div>
              <h3 className="text-xl font-bold mb-2">Telephone IA</h3>
              <p className="text-gray-400">Repondez a 100% de vos appels, meme a 3h du matin</p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-dark-800/50 border border-white/5">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">WhatsApp IA</h3>
              <p className="text-gray-400">Reponses instantanees sur le canal prefere de vos clients</p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-dark-800/50 border border-white/5">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-7 h-7 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Reservations</h3>
              <p className="text-gray-400">Vos clients reservent 24/7, vous ne ratez plus rien</p>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-neon-cyan/10 text-neon-cyan px-4 py-2 rounded-full text-sm font-medium mb-4">
              <ImageIcon className="w-4 h-4" />
              Apercu de la plateforme
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Decouvrez
              </span>{' '}
              <span className="bg-gradient-to-r from-neon-cyan to-primary-400 bg-clip-text text-transparent">
                l'interface
              </span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Une interface moderne et intuitive, concue pour les professionnels qui veulent gagner du temps.
            </p>
          </div>
          <GallerySlideshow />
        </div>
      </section>

      {/* Demos Section */}
      <section id="demos" className="py-20 px-4 bg-dark-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-neon-purple/10 text-purple-400 px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Film className="w-4 h-4" />
              Démonstrations
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                NEXUS en
              </span>{' '}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                action
              </span>
            </h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Découvrez comment NEXUS automatise les tâches quotidiennes de votre business.
            </p>
          </div>
          <DemosSection />
        </div>
      </section>

      {/* Pricing */}
      <PricingSection />

      {/* Testimonials */}
      <TestimonialsSection />

      {/* Trust Badges */}
      <TrustBadges />

      {/* FAQ */}
      <FAQSection />

      {/* Contact */}
      <ContactForm />

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-r from-neon-cyan/10 to-primary-500/10 border border-neon-cyan/20 rounded-3xl p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Pret a automatiser votre{' '}
              <span className="bg-gradient-to-r from-neon-cyan to-primary-400 bg-clip-text text-transparent">
                business
              </span>{' '}?
            </h2>
            <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
              Rejoignez des centaines de professionnels qui gagnent du temps chaque jour grace a NEXUS.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://nexus-admin-yedu.onrender.com/signup"
                className="inline-flex items-center gap-2 bg-white text-dark-900 font-semibold py-4 px-10 rounded-xl hover:bg-gray-100 transition-colors"
              >
                Demarrer l'essai gratuit
                <ChevronRight className="w-5 h-5" />
              </a>
              <a
                href="https://calendly.com/nexus-saas/demo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-neon-cyan/50 text-neon-cyan font-semibold py-4 px-10 rounded-xl hover:bg-neon-cyan/10 transition-colors"
              >
                <Calendar className="w-5 h-5" />
                Reserver une demo
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-neon-cyan to-primary-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">NEXUS</span>
              </div>
              <p className="text-sm text-gray-500">
                Automatisez votre business avec l'intelligence artificielle.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produit</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#pricing" className="hover:text-white transition">Tarifs</a></li>
                <li><a href="#demos" className="hover:text-white transition">Démos</a></li>
                <li><a href="#gallery" className="hover:text-white transition">Galerie</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-white transition">Centre d'aide</a></li>
                <li><a href="#" className="hover:text-white transition">Contact</a></li>
                <li><a href="#" className="hover:text-white transition">API</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li><a href="#" className="hover:text-white transition">CGV</a></li>
                <li><a href="#" className="hover:text-white transition">Confidentialite</a></li>
                <li><a href="#" className="hover:text-white transition">Mentions legales</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 text-center text-sm text-gray-500">
            <p>© 2026 NEXUS. Tous droits reserves.</p>
          </div>
        </div>
      </footer>
      </div>{/* Fin du contenu principal z-10 */}
    </div>
  )
}

export default App
