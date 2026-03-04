import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, Volume2, VolumeX, Mic, MicOff, Paperclip, Image, FileText } from 'lucide-react';

interface MessageAttachment {
  type: 'image' | 'document';
  name: string;
  url: string;
  mimeType: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: MessageAttachment[];
}

// Type pour SpeechRecognition (API Web Speech)
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export default function HalimahProChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [agentName, setAgentName] = useState('Halimah Pro');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Salut ! Je suis ton assistant IA. Comment puis-je t\'aider ?'
    }
  ]);

  // Load backoffice agent name
  useEffect(() => {
    fetch('/api/admin/agents', { headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token')}` } })
      .then(r => r.json())
      .then(d => {
        const bo = d.agents?.find((a: any) => a.agent_type === 'backoffice');
        if (bo?.custom_name) {
          setAgentName(bo.custom_name);
          setMessages([{ id: '1', role: 'assistant', content: `Salut ! Je suis ${bo.custom_name}, ton assistant IA. Comment puis-je t'aider ?` }]);
        }
      })
      .catch(() => {});
  }, []);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false); // Audio désactivé sur web
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // === NETTOYAGE TEXTE POUR SYNTHÈSE VOCALE ===
  const cleanTextForSpeech = (text: string): string => {
    return text
      // Supprimer les emojis
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Symbols & Pictographs
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport & Map
      .replace(/[\u{1F700}-\u{1F77F}]/gu, '') // Alchemical
      .replace(/[\u{1F780}-\u{1F7FF}]/gu, '') // Geometric
      .replace(/[\u{1F800}-\u{1F8FF}]/gu, '') // Supplemental Arrows
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols
      .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
      .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols Extended
      .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
      .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
      .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
      // === MARKDOWN → PAUSES ===
      // **texte** → texte avec pause
      .replace(/\*\*([^*]+)\*\*/g, '... $1 ...')
      // Titres avec 📅 → pause longue avant
      .replace(/📅/g, '... ')
      // === DATES ET HEURES ===
      // Mercredi 15 janvier 2026 → Mercredi, quinze janvier, deux mille vingt-six
      .replace(/(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/gi,
        (_, day, month, year) => `${day}, ${month}, ${year}`)
      // 09h00 → 9 heures
      .replace(/(\d{1,2})h00\b/gi, '$1 heures')
      // 10h30 → 10 heures 30
      .replace(/(\d+)h(\d+)/gi, '$1 heures $2')
      // === TÉLÉPHONES → LECTURE LENTE ===
      // 0765454321 → 07, 65, 45, 43, 21
      .replace(/Tel\s*:\s*(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/gi,
        'Téléphone... $1, $2, $3, $4, $5')
      .replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/g, '$1, $2, $3, $4, $5')
      // === RYTHME ET PAUSES NATURELLES ===
      // Slash → "ou"
      .replace(/(\w)\/(\w)/g, '$1 ou $2')
      // Tirets de liste → pause longue
      .replace(/^[-•]\s*/gm, '... ')
      .replace(/\n[-•]\s*/g, '... ')
      // Deux-points → pause
      .replace(/:\s*/g, '... ')
      // Point-virgule → pause moyenne
      .replace(/;\s*/g, '. ')
      // Guillemets → supprimer
      .replace(/[«»""'']/g, '')
      // Parenthèses → pause légère
      .replace(/\(/g, ', ')
      .replace(/\)/g, ', ')
      // === SYMBOLES → TEXTE ===
      .replace(/€/g, ' euros ')
      .replace(/&/g, ' et ')
      .replace(/%/g, ' pourcent ')
      .replace(/\+/g, ' plus ')
      .replace(/@/g, ' arobase ')
      // === STATUTS RDV ===
      .replace(/❌/g, '')
      .replace(/⏳/g, '')
      .replace(/✅/g, '')
      .replace(/Annulé/gi, '... annulé')
      .replace(/En attente de confirmation/gi, '... en attente de confirmation')
      .replace(/Confirmé/gi, '... confirmé')
      // === NETTOYAGE FINAL ===
      .replace(/-{2,}/g, '... ') // Tirets multiples → pause
      .replace(/\.{4,}/g, '... ') // Trop de points → 3 max
      .replace(/\n+/g, '... ') // Sauts de ligne → pause longue
      .replace(/[*#_~`]/g, '') // Markdown restant
      .replace(/,{2,}/g, ',') // Virgules multiples
      .replace(/\s{2,}/g, ' ') // Espaces multiples
      .replace(/\s+\./g, '.') // Espace avant point
      .replace(/\s+,/g, ',') // Espace avant virgule
      .replace(/\.+\s*\.+/g, '... ') // Points multiples
      .trim();
  };

  // === SYNTHESE VOCALE ELEVENLABS ===
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = useCallback(async (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !text) return;

    // Arrêter l'audio en cours
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Nettoyer le texte avant la synthèse
    const cleanedText = cleanTextForSpeech(text);
    if (!cleanedText) return;

    setIsSpeaking(true);
    console.log('[ELEVENLABS] Génération audio pour:', cleanedText.substring(0, 50) + '...');

    try {
      const response = await fetch('/api/tts/elevenlabs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: cleanedText })
      });

      if (!response.ok) {
        throw new Error(`TTS error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        console.error('[ELEVENLABS] Erreur lecture audio');
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
      console.log('[ELEVENLABS] ✅ Audio en lecture');

    } catch (error) {
      console.error('[ELEVENLABS] Erreur:', error);
      setIsSpeaking(false);
    }
  }, [voiceEnabled]);

  // === RECONNAISSANCE VOCALE ===
  const initRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[HALIMAH PRO] Reconnaissance vocale non supportée');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'fr-FR';

    recognition.onstart = () => {
      setIsListening(true);
      setInterimTranscript('');
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }

      if (finalTranscript) {
        setInput(prev => prev + finalTranscript);
        setInterimTranscript('');
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: Event) => {
      console.error('[HALIMAH PRO] Erreur reconnaissance vocale:', event);
      setIsListening(false);
      setInterimTranscript('');
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
    };

    return recognition;
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      // Arrêter l'écoute
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      // Démarrer l'écoute
      if (!recognitionRef.current) {
        recognitionRef.current = initRecognition();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Peut arriver si déjà en cours
          console.warn('[HALIMAH PRO] Recognition already started');
        }
      }
    }
  }, [isListening, initRecognition]);

  // === GESTION DES FICHIERS ===
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const validFiles: File[] = [];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'text/csv'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > maxSize) {
        alert(`${file.name} est trop volumineux (max 10MB)`);
        continue;
      }
      if (!allowedTypes.includes(file.type)) {
        alert(`${file.name}: type de fichier non supporté`);
        continue;
      }
      validFiles.push(file);
    }

    setAttachedFiles(prev => [...prev, ...validFiles].slice(0, 5)); // Max 5 fichiers
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (files: File[]): Promise<MessageAttachment[]> => {
    const attachments: MessageAttachment[] = [];
    const token = localStorage.getItem('admin_token');

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/admin/halimah-pro/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          attachments.push({
            type: file.type.startsWith('image/') ? 'image' : 'document',
            name: file.name,
            url: data.url,
            mimeType: file.type
          });
        }
      } catch (err) {
        console.error('[UPLOAD] Erreur:', err);
      }
    }

    return attachments;
  };

  // === ENVOI MESSAGE ===
  const sendMessage = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;

    // Arrêter l'écoute si active
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    // Upload des fichiers si présents
    let uploadedAttachments: MessageAttachment[] = [];
    if (attachedFiles.length > 0) {
      setUploadingFiles(true);
      uploadedAttachments = await uploadFiles(attachedFiles);
      setUploadingFiles(false);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim() || (uploadedAttachments.length > 0 ? `[${uploadedAttachments.length} fichier(s) joint(s)]` : ''),
      attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachedFiles([]);
    setInterimTranscript('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('admin_token');

      const response = await fetch('/api/admin/halimah-pro/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage.content,
          attachments: uploadedAttachments,
          conversationHistory: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[HALIMAH PRO] Erreur:', response.status, data);
        throw new Error(data.message || data.error || `Erreur ${response.status}`);
      }

      const responseText = data.response || 'Désolée, je n\'ai pas compris. Peux-tu reformuler ?';

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Audio désactivé sur web chat - uniquement texte
      // speak() réservé au canal téléphone (Twilio)

    } catch (error: any) {
      console.error('[HALIMAH PRO] Erreur:', error);

      let errorMsg = 'Désolée, je rencontre un problème technique. Réessaie dans un moment.';

      if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
        errorMsg = 'Je n\'arrive pas à joindre le serveur. Vérifie ta connexion.';
      } else if (error?.message?.includes('401')) {
        errorMsg = 'Ta session a expiré. Reconnecte-toi.';
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMsg
      }]);
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

  // Charger les voix au montage
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Chrome nécessite un événement pour charger les voix
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Vérifier si la reconnaissance vocale est supportée
  const speechRecognitionSupported = typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  return (
    <>
      {/* Bulle flottante */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 w-12 h-12 md:w-14 md:h-14 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform ${isSpeaking ? 'animate-pulse' : ''}`}
          style={{ zIndex: 9999 }}
          title={`Parler à ${agentName}`}
        >
          <MessageCircle className="w-6 h-6 md:w-7 md:h-7 text-white" />
        </button>
      )}

      {/* Fenêtre de chat */}
      {isOpen && (
        <div
          className="fixed bottom-0 right-0 md:bottom-6 md:right-6 z-50 w-full md:w-96 h-[85vh] md:h-[500px] bg-white md:rounded-2xl shadow-2xl flex flex-col overflow-hidden border-t md:border border-gray-200"
          style={{ zIndex: 9999 }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 bg-white/20 rounded-full flex items-center justify-center ${isSpeaking ? 'animate-pulse' : ''}`}>
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">{agentName}</h3>
                <p className="text-white/80 text-xs">
                  {isListening ? '🎤 Je t\'écoute...' : isSpeaking ? '🔊 Je parle...' : 'Assistante IA'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Bouton voix masqué - audio désactivé sur web chat */}
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-md'
                      : 'bg-white text-gray-800 shadow-md rounded-bl-md'
                  }`}
                >
                  {/* Affichage des fichiers attachés */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {msg.attachments.map((att, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          {att.type === 'image' ? (
                            <img
                              src={att.url}
                              alt={att.name}
                              className="max-w-[200px] max-h-[150px] rounded-lg object-cover"
                            />
                          ) : (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                msg.role === 'user' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              <FileText className="w-3 h-3" />
                              {att.name}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white px-4 py-2 rounded-2xl shadow-md rounded-bl-md">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Halimah réfléchit...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t bg-white">
            {/* Fichiers attachés */}
            {attachedFiles.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 px-2 py-1 bg-purple-50 rounded-lg text-xs text-purple-700"
                  >
                    {file.type.startsWith('image/') ? (
                      <Image className="w-3 h-3" />
                    ) : (
                      <FileText className="w-3 h-3" />
                    )}
                    <span className="max-w-[100px] truncate">{file.name}</span>
                    <button
                      onClick={() => removeAttachedFile(index)}
                      className="ml-1 text-purple-400 hover:text-purple-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Transcription en cours */}
            {interimTranscript && (
              <div className="mb-2 px-3 py-1 bg-purple-50 rounded-lg text-sm text-purple-600 italic">
                {interimTranscript}...
              </div>
            )}
            {/* Upload en cours */}
            {uploadingFiles && (
              <div className="mb-2 px-3 py-1 bg-blue-50 rounded-lg text-sm text-blue-600 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Upload des fichiers...
              </div>
            )}
            <div className="flex gap-2 items-center">
              {/* Input fichier caché */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.txt,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              {/* Bouton fichier */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || attachedFiles.length >= 5}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Joindre un fichier (max 5)"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              {/* Bouton micro */}
              {speechRecognitionSupported && (
                <button
                  onClick={toggleListening}
                  disabled={isLoading}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={isListening ? 'Arrêter l\'écoute' : 'Parler'}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
              )}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={isListening ? 'Parle maintenant...' : 'Écris ton message...'}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-purple-500 transition-colors"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={(!input.trim() && attachedFiles.length === 0) || isLoading}
                className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full flex items-center justify-center hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
