import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Leaf, Upload, Send, Bot, User, ImageIcon, Sprout, Loader2, X, RefreshCcw, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Helper to play a subtle "Success" tone using Web Audio API
const playSuccessTone = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Create a clean "ding" sound
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
  } catch (e) {
    console.warn("Audio feedback blocked:", e);
  }
};

// Visual Waveform Animation Component
const Waveform = () => (
  <div className="flex items-center gap-1 h-6">
    {[0, 1, 2, 3, 4].map((i) => (
      <motion.div
        key={i}
        animate={{ height: [4, 20, 4] }}
        transition={{ 
          repeat: Infinity, 
          duration: 0.6, 
          delay: i * 0.1,
          ease: "easeInOut"
        }}
        className="w-1 bg-leaf-500 rounded-full"
      />
    ))}
  </div>
);

interface Message {
  role: 'user' | 'bot';
  content: string;
  image?: string;
}

// Type for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Function to strip markdown for better speech
  const stripMarkdown = (text: string) => {
    return text
      .replace(/[#*`_~]/g, '') // Remove markers
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links
      .replace(/\n+/g, ' '); // Replace newlines with spaces
  };

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const handleSpeak = (text: string, index: number) => {
    if (speakingIndex === index) {
      window.speechSynthesis.cancel();
      setSpeakingIndex(null);
      return;
    }

    window.speechSynthesis.cancel();
    
    const speechContent = stripMarkdown(text);
    const utterance = new SpeechSynthesisUtterance(speechContent);
    
    // Voice selection strategy: prioritize Urdu (ur-PK) then Hindi (hi-IN)
    const preferredVoices = voices.filter(v => 
      v.lang.startsWith('ur') || v.lang.startsWith('hi')
    ).sort((a, b) => {
      // Prioritize ur-PK
      if (a.lang === 'ur-PK') return -1;
      if (b.lang === 'ur-PK') return 1;
      // Prioritize Google voices if available as they are usually better
      if (a.name.includes('Google') && !b.name.includes('Google')) return -1;
      if (b.name.includes('Google') && !a.name.includes('Google')) return 1;
      return 0;
    });

    if (preferredVoices.length > 0) {
      utterance.voice = preferredVoices[0];
      utterance.lang = preferredVoices[0].lang;
    } else {
      utterance.lang = 'ur-PK'; 
    }
    
    utterance.rate = 0.85; 
    utterance.pitch = 1.0;
    
    utterance.onend = () => {
      setSpeakingIndex(null);
    };

    utterance.onerror = () => {
      setSpeakingIndex(null);
    };

    setSpeakingIndex(index);
    window.speechSynthesis.speak(utterance);
  };

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'ur-PK'; // Urdu (Pakistan)

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        setInput(prev => prev ? `${prev} ${transcript}` : transcript);
        playSuccessTone(); // Confirmation sound
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (!recognitionRef.current) {
        alert("Aapka browser voice input support nahi karta. Baraye meherbani Chrome istemal karen.");
        return;
      }
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async () => {
    if (!input.trim() && !selectedImage) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      image: selectedImage || undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    const currentImage = selectedImage;
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    
    setIsTyping(true);

    try {
      // AI functionality has been removed as per request.
      // We simulate a response to keep the UI functional.
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const responseText = "Maf kijiyega, is waqt AI functionality band kar di gayi hai. Main abhi aapki tasveer ya sawal ka tajziya nahi kar sakta.";
      setMessages((prev) => [...prev, { role: 'bot', content: responseText }]);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { role: 'bot', content: "Mafi chahta hoon, kuch masla hai. Baraye meherbani thori dair baad dobara koshish karen." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const resetChat = () => {
    setMessages([]);
    setSelectedImage(null);
    setInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div id="app-container" className="min-h-screen flex flex-col items-center p-4 sm:p-6 md:p-8">
      {/* Header */}
      <header className="w-full max-w-2xl flex items-center justify-between mb-8 drop-shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-leaf-500 p-2.5 rounded-2xl shadow-lg ring-4 ring-leaf-500/20">
            <Sprout className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight leading-none">Kisaan Dost</h1>
            <p className="text-leaf-200 text-base font-semibold tracking-wide uppercase mt-1">Aapka Ziraat Expert</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button 
            onClick={resetChat}
            className="flex items-center gap-2 text-earth-100 hover:text-white transition-colors text-sm font-medium bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20"
            title="Nayi Guftagu"
          >
            <RefreshCcw className="w-4 h-4" />
            <span className="hidden sm:inline">Naya Safha</span>
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="w-full max-w-2xl flex-1 flex flex-col bg-white/95 backdrop-blur-sm rounded-[2rem] shadow-2xl shadow-black/30 overflow-hidden border border-white/20">
        
        {/* Welcome Message or Chat Area */}
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-linear-to-b from-leaf-500/10 to-transparent">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-32 h-32 rounded-full mb-6 ring-8 ring-leaf-50 flex items-center justify-center bg-leaf-100 shadow-2xl border-4 border-white"
            >
              <Leaf className="w-16 h-16 text-leaf-600" />
            </motion.div>
            <h2 className="text-4xl text-earth-900 mb-4 font-bold">Khushamdeed!</h2>
            <p className="text-earth-600 max-w-sm mb-8 leading-relaxed font-semibold text-lg">
              Apni fasal ki photo upload karen taake main bimari ki pehchan karkay aapko uska hal bta sakun.
            </p>
            
            <button 
              id="initial-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-3 bg-leaf-600 text-white px-8 py-4 rounded-2xl hover:bg-leaf-700 transition-all font-semibold shadow-xl shadow-leaf-500/30 group active:scale-95"
            >
              <Upload className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
              Photo Upload Karen
            </button>
          </div>
        ) : (
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-6"
          >
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${m.role === 'user' ? 'bg-earth-100 text-earth-600 border border-earth-200' : 'bg-leaf-500 text-white shadow-sm'}`}>
                      {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={`flex flex-col gap-2 relative group ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                      {m.image && (
                        <div className="rounded-2xl overflow-hidden border-4 border-white shadow-lg max-w-xs ring-1 ring-earth-200">
                          <img src={m.image} alt="Crop" className="w-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      )}
                      
                      <div className="flex items-start gap-2 max-w-full">
                        <div className={`px-4 py-3 rounded-2xl text-[15px] leading-relaxed shadow-sm relative ${
                          m.role === 'user' 
                            ? 'bg-earth-700 text-white rounded-tr-none' 
                            : 'bg-leaf-50 text-earth-900 rounded-tl-none border border-leaf-100'
                        }`}>
                          {m.role === 'user' ? (
                            m.content
                          ) : (
                            <div className="markdown-body">
                              <ReactMarkdown>
                                {m.content}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>

                        {m.role !== 'user' && (
                          <button
                            onClick={() => handleSpeak(m.content, i)}
                            className={`flex-shrink-0 p-2.5 rounded-xl shadow-sm transition-all mt-1 ${
                              speakingIndex === i 
                                ? 'bg-red-500 text-white animate-pulse scale-110' 
                                : 'bg-white text-leaf-600 hover:bg-leaf-50 border border-leaf-100'
                            }`}
                            title={speakingIndex === i ? "Urdu sunna band karen" : "Urdu main suniye"}
                          >
                            {speakingIndex === i ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-start items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-leaf-500 flex items-center justify-center text-white">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-leaf-50 border border-leaf-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-leaf-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-leaf-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-leaf-400 rounded-full animate-bounce"></div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Input Area */}
        <div className="p-4 sm:p-6 bg-earth-50/50 border-t border-earth-100 backdrop-blur-xs">
          <div className="flex flex-col gap-4">
            {/* Image Preview */}
            <AnimatePresence>
              {selectedImage && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="relative self-start"
                >
                  <img src={selectedImage} alt="Preview" className="w-20 h-20 object-cover rounded-xl border-2 border-leaf-200 shadow-md" referrerPolicy="no-referrer" />
                  <button 
                    onClick={removeSelectedImage}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600 transition-colors z-10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-earth-500 hover:bg-earth-100 rounded-xl transition-colors active:scale-90"
                title="Tasvir attach karen"
              >
                <Upload className="w-6 h-6" />
              </button>

              <button 
                onClick={toggleListening}
                className={`p-3 rounded-xl transition-all active:scale-95 relative ${
                  isListening ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'text-leaf-600 hover:bg-leaf-50'
                }`}
                title="Bool kar batayen"
              >
                {isListening ? (
                  <MicOff className="w-6 h-6" />
                ) : (
                  <Mic className="w-6 h-6" />
                )}
                {isListening && (
                  <span className="absolute inset-0 rounded-xl bg-red-400 opacity-30 animate-ping"></span>
                )}
              </button>
              
              <div className="flex-1 relative flex items-center">
                <AnimatePresence>
                  {isListening ? (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="absolute inset-0 z-10 bg-white rounded-2xl flex items-center px-5 gap-3 border border-leaf-300 shadow-inner"
                    >
                      <Waveform />
                      <span className="text-leaf-700 font-semibold text-sm animate-pulse">Boliye... Main sun raha hoon</span>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
                
                <input 
                  id="message-input"
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={messages.length === 0 ? "Kisaan Dost se poochain..." : "Mazeed sawal poochain..."}
                  className="w-full bg-white border border-earth-200 rounded-2xl px-5 py-4 focus:outline-hidden focus:border-leaf-500 focus:ring-2 focus:ring-leaf-100 transition-all text-[15px] shadow-sm"
                />
              </div>

              <button 
                id="send-btn"
                onClick={handleSend}
                disabled={(!input.trim() && !selectedImage) || isTyping}
                className={`p-4 rounded-2xl transition-all shadow-md active:scale-95 ${
                  (!input.trim() && !selectedImage) || isTyping 
                    ? 'bg-earth-200 text-earth-400 cursor-not-allowed shadow-none' 
                    : 'bg-leaf-600 text-white hover:bg-leaf-700 shadow-leaf-500/20'
                }`}
              >
                {isTyping ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
              </button>
            </div>
            
            <p className="text-[10px] text-center text-earth-400 font-bold uppercase tracking-widest bg-white/50 py-1 rounded-full">
              Ziraat Expert System • Roman Urdu
            </p>
          </div>
        </div>
      </main>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageUpload} 
        className="hidden" 
        accept="image/*"
      />
    </div>
  );
}
