/**
 * NEXUS AI — Proprietary & Confidential
 * Copyright (c) 2026 NEXUS AI — Issouf Toure. All rights reserved.
 * Unauthorized copying, modification, or distribution is strictly prohibited.
 */

import { useState, useEffect } from 'react'
import {
  Phone, MessageCircle, Calendar,
  Sparkles, ChevronRight, Play, Menu, X,
  Volume2, VolumeX, Image as ImageIcon, Film,
  Users, Receipt, Megaphone
} from 'lucide-react'

// Components
import StarfieldBackground from './components/StarfieldBackground'
import GallerySlideshow from './components/GallerySlideshow'
import DemosSection from './components/DemosSection'
import NexusRobot from './components/NexusRobot'
import NexusChat from './components/NexusChat'
import PricingSection from './components/PricingSection'
import CreditsSimulator from './components/CreditsSimulator'
import TestimonialsSection from './components/TestimonialsSection'
import TrustBadges from './components/TrustBadges'
import FAQSection from './components/FAQSection'
import ContactForm from './components/ContactForm'
import CookieBanner from './components/CookieBanner'
import MentionsLegales from './components/MentionsLegales'
import LandingCGV from './components/LandingCGV'
import Confidentialite from './components/Confidentialite'

// Hooks
import useNexusAudio from './hooks/useNexusAudio'
import useTextToSpeech from './hooks/useTextToSpeech'
import useSoundEffects from './hooks/useSoundEffects'
import useSpeechRecognition from './hooks/useSpeechRecognition'
import useSpaceAmbient from './hooks/useSpaceAmbient'

// Utils
import cleanTextForTTS from './utils/cleanTextForTTS'
import { MESSAGES_CONFIG } from './utils/messages'
import { initGA, trackEvent } from './utils/analytics'

function App() {
  const [robotState, setRobotState] = useState('entering')
  const [messages, setMessages] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [showStartButton, setShowStartButton] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [legalModal, setLegalModal] = useState(null)
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

  // Initialiser Google Analytics 4
  useEffect(() => {
    initGA(import.meta.env.VITE_GA_MEASUREMENT_ID)
  }, [])

  // Tracker le scroll vers la section tarifs
  useEffect(() => {
    const pricingSection = document.getElementById('pricing')
    if (!pricingSection) return
    let tracked = false
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !tracked) {
        tracked = true
        trackEvent('pricing_view', 'engagement', 'scroll_to_pricing')
      }
    }, { threshold: 0.3 })
    observer.observe(pricingSection)
    return () => observer.disconnect()
  }, [])

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

  // API URL pour l'agent commercial (relatif → passe par le proxy server.js)
  const API_URL = ''

  // Gerer l'envoi d'un message utilisateur - Appel API avec streaming + TTS
  const handleSend = async (text) => {
    stopAudio()
    stopTTS()

    // Tracker la première interaction chat
    if (messages.filter(m => m.role === 'user').length === 0) {
      trackEvent('chat_started', 'engagement', 'nexus_agent')
    }

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
      <header>
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
              <a href="https://app.nexus-ai-saas.com/login" className="text-gray-400 hover:text-white transition hidden sm:block">
                Connexion
              </a>
              <a
                href="https://app.nexus-ai-saas.com/signup"
                className="bg-gradient-to-r from-neon-cyan to-primary-500 text-white font-semibold py-2 px-5 rounded-xl hover:opacity-90 transition-opacity"
                onClick={() => trackEvent('signup_click', 'cta', 'header_cta')}
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
              <a href="https://app.nexus-ai-saas.com/login" className="block text-gray-300 hover:text-white py-2">Connexion</a>
            </div>
          </div>
        )}
      </nav>
      </header>

      <main>
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
            L'IA qui repond au telephone, gere vos messages et prend vos reservations
          </p>
          <p className="text-gray-500 text-sm md:text-base max-w-2xl mx-auto mt-3">
            NEXUS repond a vos appels 24h/24, gere vos messages WhatsApp et prend les reservations automatiquement. Vos clients sont toujours accueillis, meme quand vous etes occupes. Facturation, CRM et bien plus inclus. Adapte aux salons de coiffure, restaurants, hotels, commerces et services.
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
      <section className="py-16 px-4 bg-dark-900/50" id="features">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Une IA qui travaille pour vous,{' '}
              <span className="bg-gradient-to-r from-neon-cyan to-primary-400 bg-clip-text text-transparent">
                24h/24
              </span>
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Pendant que vous exercez votre metier, NEXUS repond au telephone, gere vos messages WhatsApp, prend les reservations et envoie les factures. Une seule plateforme propulsee par l'IA, adaptee a votre metier.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-2xl bg-dark-800/50 border border-white/5">
              <div className="w-14 h-14 bg-gradient-to-br from-neon-cyan/20 to-primary-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Phone className="w-7 h-7 text-neon-cyan" />
              </div>
              <h3 className="text-xl font-bold mb-2">Telephone IA</h3>
              <p className="text-sm text-neon-cyan mb-2">Repondez a 100% de vos appels</p>
              <p className="text-gray-400 text-sm">L'assistant vocal IA decroche automatiquement vos appels 24h/24, prend les reservations, repond aux questions et gere les modifications. Vos clients sont toujours accueillis, meme a 3h du matin ou pendant vos rendez-vous.</p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-dark-800/50 border border-white/5">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500/20 to-green-600/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">WhatsApp IA</h3>
              <p className="text-sm text-green-400 mb-2">Reponses instantanees sur WhatsApp</p>
              <p className="text-gray-400 text-sm">Connectez votre WhatsApp Business et laissez l'IA repondre automatiquement. Prise de rendez-vous, informations tarifaires, confirmations et rappels — tout est gere sans intervention manuelle sur le canal prefere de vos clients.</p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-dark-800/50 border border-white/5">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-7 h-7 text-orange-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Reservations en ligne</h3>
              <p className="text-sm text-orange-400 mb-2">Vos clients reservent 24/7</p>
              <p className="text-gray-400 text-sm">Systeme de reservation adapte a votre metier : rendez-vous pour salons, tables pour restaurants, chambres pour hotels. Gestion de la disponibilite en temps reel, confirmations automatiques et rappels SMS pour prevenir les no-shows.</p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-dark-800/50 border border-white/5">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500/20 to-blue-600/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">CRM client integre</h3>
              <p className="text-sm text-blue-400 mb-2">Connaissez chaque client</p>
              <p className="text-gray-400 text-sm">Centralisez toutes les interactions client : reservations, appels, messages WhatsApp, preferences et historique des visites. Segmentez votre base et envoyez des campagnes ciblees pour fideliser et augmenter votre chiffre d'affaires.</p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-dark-800/50 border border-white/5">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Receipt className="w-7 h-7 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Facturation automatique</h3>
              <p className="text-sm text-purple-400 mb-2">Factures generees en un clic</p>
              <p className="text-gray-400 text-sm">Generez vos factures automatiquement apres chaque reservation, suivez les paiements et relancez les impayes. Devis, avoir, exports comptables — tout est gere sans saisie manuelle pour vous faire gagner du temps.</p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-dark-800/50 border border-white/5">
              <div className="w-14 h-14 bg-gradient-to-br from-pink-500/20 to-pink-600/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Megaphone className="w-7 h-7 text-pink-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Et bien plus inclus</h3>
              <p className="text-sm text-pink-400 mb-2">Tout pour gerer votre activite</p>
              <p className="text-gray-400 text-sm">Comptabilite, gestion des stocks, programme de fidelite, marketing automatise, workflows, equipe — tout est inclus dans votre abonnement. Des outils que vous decouvrirez au fur et a mesure de vos besoins.</p>
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
      <section className="text-center px-4 pt-16 -mb-8">
        <p className="text-gray-400 max-w-2xl mx-auto text-sm">
          Demarrez gratuitement avec le plan Free, sans carte bancaire. Passez a Starter 69€/mois pour debloquer toutes les IA, Pro 199€/mois pour le multi-sites illimite, Business 499€/mois pour le SEO et la compta, ou Enterprise 899€/mois pour l'offre complete avec RH, Sentinel, white-label et account manager. Aucun engagement, aucun frais cache.
        </p>
      </section>
      <PricingSection />

      {/* Credits IA Simulator */}
      <CreditsSimulator />

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
                href="https://app.nexus-ai-saas.com/signup"
                className="inline-flex items-center gap-2 bg-white text-dark-900 font-semibold py-4 px-10 rounded-xl hover:bg-gray-100 transition-colors"
                onClick={() => trackEvent('signup_click', 'cta', 'footer_cta')}
              >
                Demarrer l'essai gratuit
                <ChevronRight className="w-5 h-5" />
              </a>
              <a
                href="https://calendly.com/nexus-saas/demo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 border border-neon-cyan/50 text-neon-cyan font-semibold py-4 px-10 rounded-xl hover:bg-neon-cyan/10 transition-colors"
                onClick={() => trackEvent('demo_click', 'cta', 'footer_cta')}
              >
                <Calendar className="w-5 h-5" />
                Reserver une demo
              </a>
            </div>
          </div>
        </div>
      </section>

      </main>

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
              <p className="text-sm text-gray-500 mb-4">
                Automatisez votre business avec l'intelligence artificielle.
              </p>
              <div className="flex items-center gap-3">
                <a href="https://www.facebook.com/profile.php?id=61574335416419" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition" aria-label="Facebook">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href="https://www.instagram.com/nexus.saas.ai/" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition" aria-label="Instagram">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
                <a href="https://www.tiktok.com/@nexus.ai.saas" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition" aria-label="TikTok">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                </a>
              </div>
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
                <li><button onClick={() => setLegalModal('cgv')} className="hover:text-white transition">CGV</button></li>
                <li><button onClick={() => setLegalModal('confidentialite')} className="hover:text-white transition">Confidentialite</button></li>
                <li><button onClick={() => setLegalModal('mentions')} className="hover:text-white transition">Mentions legales</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/5 pt-8 text-center text-sm text-gray-500">
            <p>© 2026 NEXUS. Tous droits reserves.</p>
          </div>
        </div>
      </footer>
      </div>{/* Fin du contenu principal z-10 */}

      {/* Legal Modal */}
      {legalModal && (
        <div className="fixed inset-0 z-[9000] bg-dark-950/90 backdrop-blur-sm flex items-start justify-center overflow-y-auto">
          <div className="w-full max-w-3xl mx-4 my-8 bg-dark-900 border border-white/10 rounded-2xl p-6 md:p-10 relative">
            <button
              onClick={() => setLegalModal(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition p-2"
            >
              <X className="w-6 h-6" />
            </button>
            {legalModal === 'cgv' && <LandingCGV />}
            {legalModal === 'confidentialite' && <Confidentialite />}
            {legalModal === 'mentions' && <MentionsLegales />}
          </div>
        </div>
      )}

      {/* Cookie Banner */}
      <CookieBanner />
    </div>
  )
}

export default App
