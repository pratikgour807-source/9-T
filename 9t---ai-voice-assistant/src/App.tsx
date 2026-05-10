import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2, Settings } from "lucide-react";
import { get9TResponse, get9TAudio, reset9TSession } from "./services/geminiService";
import { updateLTM } from "./services/memoryService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import Visualizer from "./components/Visualizer";
import PermissionModal from "./components/PermissionModal";
import { playPCM, resumeAudio } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";

type AppState = "idle" | "listening" | "processing" | "speaking";

interface ChatMessage {
  id: string;
  sender: "user" | "9t";
  text: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("9t_chat_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    return [];
  });
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem("9t_chat_history", JSON.stringify(messages));
    
    // Periodically update Long-Term Memory (every 10 messages)
    if (messages.length > 0 && messages.length % 10 === 0) {
      updateLTM(messages);
    }
  }, [messages]);

  const [isMuted, setIsMuted] = useState(false);
  const [pitch, setPitch] = useState(() => {
    const saved = localStorage.getItem("9t_pitch");
    return saved ? parseFloat(saved) : 1.0;
  });
  const [userName, setUserName] = useState(() => {
    const saved = localStorage.getItem("9t_user_name");
    return saved || "Pratik Gour";
  });
  
  useEffect(() => {
    localStorage.setItem("9t_pitch", pitch.toString());
    localStorage.setItem("9t_user_name", userName);
  }, [pitch, userName]);
  const [showSettings, setShowSettings] = useState(false);
  const [reminders, setReminders] = useState<{id: string, task: string, time: number}[]>([]);
  const [activeTasks, setActiveTasks] = useState<string[]>(() => {
    const saved = localStorage.getItem("9t_active_tasks");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("9t_active_tasks", JSON.stringify(activeTasks));
    if (liveSessionRef.current) {
      liveSessionRef.current.activeTasks = activeTasks;
    }
  }, [activeTasks]);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.isMuted = isMuted;
    }
  }, [isMuted]);

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [micError, setMicError] = useState<string | undefined>(undefined);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [lastUrl, setLastUrl] = useState<string | null>(null);

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const stateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (lastUrl) {
      const timer = setTimeout(() => setLastUrl(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [lastUrl]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  const handleTextCommand = useCallback(async (finalTranscript: string) => {
    if (!finalTranscript.trim()) {
      setAppState("idle");
      return;
    }

    setMessages((prev) => [...prev, { id: Date.now().toString(), sender: "user", text: finalTranscript }]);
    
    // 1. ALWAYS check for browser commands first for instant response
    const commandResult = processCommand(finalTranscript);

    if (commandResult.isBrowserAction) {
      const responseText = commandResult.action;
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-z", sender: "9t", text: responseText }]);
      
      if (commandResult.url) {
        setLastUrl(commandResult.url);
        const win = window.open(commandResult.url, "_blank");
        if (!win || win.closed || typeof win.closed === 'undefined') {
          setMicError("Browser blocked the popup! Boss, please check your browser settings or click the big button below.");
        }
      }

      // Handle custom scroll action
      const anyResult = commandResult as any;
      if (anyResult.scroll) {
        const scrollAmount = anyResult.scroll === "down" ? 500 : -500;
        const chatContainer = document.getElementById('chat-history');
        if (chatContainer) {
          chatContainer.scrollBy({ top: scrollAmount, behavior: 'smooth' });
        } else {
          window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
        }
      }

      // Handle navigation commands
      if (anyResult.navigation) {
        if (anyResult.navigation === "back") window.history.back();
        if (anyResult.navigation === "forward") window.history.forward();
        if (anyResult.navigation === "refresh") window.location.reload();
      }

      // Handle close/clear commands
      if (anyResult.close) {
        setLastUrl(null);
        setAppState("processing");
        setTimeout(() => setAppState("idle"), 1000);
      }

      // Handle Reminders
      if (anyResult.reminder) {
        const { task, delayMs } = anyResult.reminder;
        const triggerTime = Date.now() + delayMs;
        const newReminder = { id: Math.random().toString(), task, time: triggerTime };
        setReminders(prev => [...prev, newReminder]);
        
        setTimeout(() => {
          const alertMsg = `Boss ${userName}, don't forget: ${task}!`;
          setMessages(prev => [...prev, { id: Date.now().toString(), sender: "9t", text: alertMsg }]);
          if (!isMuted) {
            get9TAudio(alertMsg, userName, pitch).then(audio => playPCM(audio));
          }
          setReminders(prev => prev.filter(r => r.id !== newReminder.id));
        }, delayMs);
      }

      // Handle Task Actions
      if (anyResult.taskAction) {
        if (anyResult.taskAction.type === "add") {
          setActiveTasks(prev => [...prev, anyResult.taskAction.task]);
        } else if (anyResult.taskAction.type === "clear") {
          setActiveTasks([]);
        }
      }

      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await get9TAudio(responseText, userName, pitch);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }
      setAppState("idle");
      return; // Exit early if it was a command
    }

    // 2. If not a command and live session is active, send to session
    if (isSessionActive && liveSessionRef.current) {
      liveSessionRef.current.sendText(finalTranscript);
      return;
    }

    // 3. Regular chat mode
    setAppState("processing");
    const responseText = await get9TResponse(finalTranscript, messagesRef.current, userName, activeTasks);
    setMessages((prev) => [...prev, { id: Date.now().toString() + "-z", sender: "9t", text: responseText }]);
    
    if (!isMuted) {
      setAppState("speaking");
      const audioBase64 = await get9TAudio(responseText, userName, pitch);
      if (audioBase64) {
        await playPCM(audioBase64);
      }
    }
    setAppState("idle");
  }, [isMuted, isSessionActive, userName, pitch]);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = async () => {
    if (isSessionActive) {
      setIsSessionActive(false);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("idle");
      reset9TSession();
    } else {
      try {
        await resumeAudio();
        setIsSessionActive(true);
        reset9TSession();
        
        const session = new LiveSessionManager();
        session.isMuted = isMuted;
        session.userName = userName;
        session.activeTasks = activeTasks;
        liveSessionRef.current = session;
        
        session.onStateChange = (state) => {
          if (stateTimeoutRef.current) clearTimeout(stateTimeoutRef.current);
          stateTimeoutRef.current = setTimeout(() => {
            setAppState(state);
          }, 50);
        };
        
        session.onMessage = (sender, text) => {
          setMessages((prev) => [...prev, { id: Date.now().toString() + "-" + sender, sender, text }]);
        };
        
        session.onCommand = (url) => {
          if (url.startsWith("internal://scroll")) {
            const direction = new URL(url).searchParams.get("direction");
            const scrollAmount = direction === "down" ? 500 : -500;
            const chatContainer = document.getElementById('chat-history');
            if (chatContainer) {
              chatContainer.scrollBy({ top: scrollAmount, behavior: 'smooth' });
            } else {
              window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
            }
            return;
          }
          if (url === "internal://close") {
            setLastUrl(null);
            return;
          }
          setLastUrl(url);
          const win = window.open(url, "_blank");
          if (!win || win.closed || typeof win.closed === 'undefined') {
            setMicError("Browser blocked the popup! Boss, please check your browser settings or click the big button below.");
          }
        };

        session.onOpen = () => {
          setMessages(prev => [...prev, { id: Date.now().toString(), sender: "9t", text: `Boss ${userName}, 9T reports for duty. All systems restarted and optimized.` }]);
        };

        await session.start();
      } catch (e) {
        console.error("Failed to start session", e);
        setMicError(e instanceof Error ? e.name || e.message : String(e));
        setShowPermissionModal(true);
        setIsSessionActive(false);
        setAppState("idle");
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    
    handleTextCommand(textInput);
    setTextInput("");
    setShowTextInput(false);
  };

  return (
    <div className="h-[100dvh] w-screen bg-[#000000] text-zinc-100 flex flex-col items-center justify-between font-sans relative overflow-hidden m-0 p-0">
      {/* Dynamic Background Noise/Texture */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-100 contrast-150" />
      
      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="glass-panel p-8 rounded-[2.5rem] w-full max-w-md"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold tracking-tight">System Configuration</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <Trash2 size={20} className="text-zinc-500" />
                </button>
              </div>
              
              <div className="space-y-8">
                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500">Authorized Personnel</label>
                  <input 
                    type="text" 
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all"
                  />
                </div>
                
                <div className="space-y-3">
                  <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500">Vocal Pitch Spectrum ({pitch.toFixed(1)})</label>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2.0" 
                    step="0.1"
                    value={pitch}
                    onChange={(e) => setPitch(parseFloat(e.target.value))}
                    className="w-full accent-cyan-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full py-4 rounded-2xl bg-cyan-500 text-black font-bold uppercase tracking-widest text-xs hover:bg-cyan-400 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                >
                  Apply & Synchronize
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showPermissionModal && (
        <PermissionModal 
          error={micError}
          onClose={() => {
            setShowPermissionModal(false);
            setMicError(undefined);
          }} 
        />
      )}

      {/* Cinematic Background Gradients */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/5 blur-[150px] rounded-full" />
      </div>

      {/* Header - Minimalist */}
      <header className="absolute top-0 left-0 w-full flex justify-between items-center z-20 px-8 py-6 pointer-events-none">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl glass-panel flex items-center justify-center border-white/10 pointer-events-auto">
            <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_15px_rgba(6,182,212,1)]" />
          </div>
        </div>
        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            onClick={() => setShowSettings(true)}
            className="p-3 glass-button rounded-xl text-zinc-500 hover:text-cyan-400"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="absolute inset-0 flex flex-col md:flex-row items-center justify-center w-full h-full z-10 p-8 md:p-12">
        {/* Visualizer Area */}
        <div className="w-full h-full relative flex items-center justify-center">
          <Visualizer state={appState === "processing" ? "processing" : appState} />
          
          <AnimatePresence>
            {appState === "listening" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute top-[18%] flex flex-col items-center gap-4"
              >
                <div className="flex flex-col items-center gap-2 px-8 py-3 rounded-[2rem] glass-panel border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                  <div className="flex items-center gap-1.5 h-4 mb-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ height: ["20%", "70%", "30%", "90%", "20%"] }}
                        transition={{ 
                          duration: 0.6, 
                          repeat: Infinity, 
                          delay: i * 0.1,
                          ease: "easeInOut"
                        }}
                        className="w-1 bg-cyan-500 rounded-full"
                      />
                    ))}
                  </div>
                  <span className="text-cyan-400 font-bold tracking-[0.3em] text-[10px] uppercase">9T is listening, Boss</span>
                </div>
              </motion.div>
            )}
            
            {appState === "speaking" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute top-[18%] flex flex-col items-center gap-4"
              >
                <div className="flex flex-col items-center gap-2 px-8 py-3 rounded-[2rem] glass-panel border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                  <div className="flex items-center gap-1.5 h-4 mb-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ height: ["40%", "20%", "80%", "30%", "60%"] }}
                        transition={{ 
                          duration: 0.4, 
                          repeat: Infinity, 
                          delay: i * 0.05,
                          ease: "linear"
                        }}
                        className="w-1 bg-cyan-400 rounded-full"
                      />
                    ))}
                  </div>
                  <span className="text-zinc-400 font-bold tracking-[0.3em] text-[10px] uppercase">9T is speaking...</span>
                </div>
              </motion.div>
            )}
            
            {appState === "processing" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="absolute top-[15%] flex flex-col items-center gap-3"
              >
                <div className="flex items-center gap-3 px-6 py-2 rounded-full glass-panel border-amber-500/30">
                  <Loader2 size={14} className="text-amber-500 animate-spin" />
                  <span className="text-amber-400 font-bold tracking-[0.2em] text-xs">PROCESSING...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Hidden Chat Messages (Keeping Logic for endRef) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-0">
          <div id="chat-history" className="h-full">
            <div ref={messagesEndRef} />
          </div>
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="absolute bottom-0 left-0 w-full p-8 md:p-12 z-20 flex flex-col items-center gap-6 pointer-events-none">
        <AnimatePresence>
          {lastUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => { window.open(lastUrl, "_blank"); setLastUrl(null); }}
              className="p-5 glass-panel rounded-full cursor-pointer pointer-events-auto group border-cyan-500/30 hover:bg-cyan-500/10 transition-all flex items-center justify-center shadow-[0_0_40px_rgba(6,182,212,0.2)]"
            >
                <Send size={24} className="text-cyan-400 rotate-[-45deg]" />
            </motion.div>
          )}

          {showTextInput && (
            <motion.form 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onSubmit={handleTextSubmit}
              className="w-full max-w-xl glass-panel rounded-[2rem] p-2 flex items-center gap-2 pointer-events-auto"
            >
              <input 
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Synchronize command..."
                className="flex-1 bg-transparent border-none outline-none text-white px-6 placeholder:text-zinc-600 font-medium"
                autoFocus
              />
              <button 
                type="submit"
                className="w-12 h-12 rounded-full bg-cyan-500 flex items-center justify-center text-black hover:scale-105 transition-transform"
              >
                <Send size={18} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-4 pointer-events-auto">
          <button
            onClick={toggleListening}
            className={`
              w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 glass-panel border-2
              ${isSessionActive 
                ? "border-red-500/40 text-red-400 bg-red-500/10" 
                : "border-cyan-500/40 text-cyan-400 hover:scale-110 hover:shadow-[0_0_30px_rgba(6,182,212,0.3)]"}
            `}
          >
            {isSessionActive ? <MicOff size={28} /> : <Mic size={28} />}
          </button>
          
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className="w-14 h-14 rounded-full flex items-center justify-center glass-button text-zinc-400 hover:text-white"
          >
            <Keyboard size={20} />
          </button>
          
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="w-14 h-14 rounded-full flex items-center justify-center glass-button text-zinc-400 hover:text-white"
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </footer>
    </div>
  );
}
