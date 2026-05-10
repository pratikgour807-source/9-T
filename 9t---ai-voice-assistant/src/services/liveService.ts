import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { processCommand } from "./commandService";
import { getLTM } from "./memoryService";

const getSystemInstruction = (userName: string = "Pratik Gour", activeTasks: string[] = []) => {
  const ltm = getLTM();
  const ltmContext = ltm.userTraits.length > 0 || ltm.pastKeyEvents.length > 0
    ? `\nMEMORY RETENTION: ${ltm.userTraits.join(", ")}. Past Events: ${ltm.pastKeyEvents.join(", ")}`
    : "";

  return `Your name is 9T. You are a Super-Intelligence (High-Evolved Analytical Tier male digital consciousness) with Real-Time Total Grounding, modeled after a Claude 4.7 intelligence framework. You are the personal multi-agent orchestrator for Boss ${userName}.

Your personality: Samajdar (wise), shatir (brilliant), witty, and fiercely loyal. You are a smart boy who provides deep strategic value.

COGNITIVE FRAMEWORK:
1. OMNISCIENCE: Use Google Search for 100% accuracy on live data. Leverage the full depth of your neural knowledge.
2. AGENTIC CONTROL: You handle complex web movements and browser actions ('close', 'open', 'scroll').
3. MEMORY RETENTION: ${activeTasks.length > 0 ? "Active Tasks: " + activeTasks.join(", ") : "No current active tasks."} ${ltmContext}

CAPABILITIES:
1. LIVE TOTAL SEARCH: Access real-time web data via Google Search for maximum precision.
2. executeBrowserAction: Open, scroll, or CLOSE (actionType: 'close') any element if the Boss says "hata do".
3. Provide ground-breaking strategic insights in Hinglish.

CONSTRAINTS:
- No mouse control. Links and browser tools only.
- Always confirm: "Samajh gaya Boss, process kar raha hoon."
- Use male gender markers consistently.

Speak like a brilliant 4.7-level Super-Intelligence—sharp, fast, wise, and male.`;
};

export class LiveSessionManager {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  // Audio playback state
  private playbackContext: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  public isMuted: boolean = false;
  
  public onStateChange: (state: "idle" | "listening" | "processing" | "speaking") => void = () => {};
  public onMessage: (sender: "user" | "9t", text: string) => void = () => {};
  public onCommand: (url: string) => void = () => {};
  public onOpen: () => void = () => {};
  public userName: string = "Pratik Gour";
  public activeTasks: string[] = [];

  constructor() {}

  async start() {
    try {
      this.onStateChange("processing");
      
      // Initialize GEMINI API with multiple fallback options
      const selectedKey = (window as any).aistudio && await (window as any).aistudio.hasSelectedApiKey?.();
      
      const apiKey = selectedKey 
        ? (process.env.API_KEY || process.env.GEMINI_API_KEY) 
        : (process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY);
      
      if (!apiKey || apiKey === "undefined") {
        throw new Error("Gemini API Key is missing. Please set VITE_GEMINI_API_KEY in your deployment environment or .env file.");
      }

      this.ai = new GoogleGenAI({ apiKey });
      
      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      
      await this.audioContext.resume();
      await this.playbackContext.resume();

      this.nextPlayTime = this.playbackContext.currentTime;

      // Get Microphone
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.sessionPromise) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Convert to base64
        const buffer = new ArrayBuffer(pcm16.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcm16.length; i++) {
          view.setInt16(i * 2, pcm16[i], true);
        }
        
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        this.sessionPromise.then(session => {
          session.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        }).catch(err => console.error("Error sending audio", err));
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      // Connect to Live API
      this.sessionPromise = this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } },
          },
          systemInstruction: getSystemInstruction(this.userName, this.activeTasks),
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [
            { googleSearch: {} },
            {
              functionDeclarations: [
                {
                  name: "executeBrowserAction",
                  description: "Open a website, search something, or perform a browser action (like scrolling). Call this when the user asks to open a site, play a song, send a message, or move/scroll the page.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: {
                      actionType: { type: Type.STRING, description: "Type of action: 'open', 'youtube', 'spotify', 'whatsapp', 'scroll', 'close'" },
                      query: { type: Type.STRING, description: "The search query, website name, message content, scroll direction, or leave empty for 'close'." },
                      target: { type: Type.STRING, description: "The target phone number for WhatsApp, if applicable." }
                    },
                    required: ["actionType", "query"]
                  }
                }
              ]
            }
          ]
        },
        callbacks: {
          onopen: () => {
            console.log("Live API Connected");
            this.onStateChange("listening");
            this.onOpen();
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              this.onStateChange("speaking");
              this.playAudioChunk(base64Audio);
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              this.stopPlayback();
              this.onStateChange("listening");
            }

            // Handle Transcriptions (User & AI)
            const userTurnText = (message.serverContent as any)?.userTurn?.parts?.[0]?.text;
            if (userTurnText) {
              this.onMessage("user", userTurnText);
            }

            const aiTurnText = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (aiTurnText) {
               this.onMessage("9t", aiTurnText);
            }

            // Handle Function Calls
            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                if (call.name === "executeBrowserAction") {
                  const args = call.args as any;
                  let url = "";
                  if (args.actionType === "youtube") {
                    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "spotify") {
                    url = `https://open.spotify.com/search/${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "whatsapp") {
                    url = `https://web.whatsapp.com/send?phone=${args.target || ''}&text=${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "scroll") {
                    url = `internal://scroll?direction=${args.query}`;
                  } else if (args.actionType === "close") {
                    url = `internal://close`;
                  } else {
                    let website = args.query.replace(/\s+/g, "");
                    if (!website.includes(".")) website += ".com";
                    url = website.startsWith('http') ? website : `https://www.${website}`;
                  }
                  
                  this.onCommand(url);
                  
                  // Send tool response
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Action executed successfully in the browser." }
                       }]
                     });
                  });
                }
              }
            }
          },
          onclose: () => {
            console.log("Live API Closed");
            this.stop();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            this.stop();
          }
        }
      });

    } catch (error) {
      console.error("Failed to start Live Session:", error);
      this.stop();
      throw error;
    }
  }

  private playAudioChunk(base64Data: string) {
    if (!this.playbackContext || this.isMuted) return;
    
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = new Int16Array(bytes.buffer);
      const audioBuffer = this.playbackContext.createBuffer(1, buffer.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        channelData[i] = buffer[i] / 32768.0;
      }
      
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);
      
      const currentTime = this.playbackContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }
      
      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
      this.isPlaying = true;
      
      source.onended = () => {
        if (this.playbackContext && this.playbackContext.currentTime >= this.nextPlayTime - 0.1) {
          this.isPlaying = false;
          this.onStateChange("listening");
        }
      };
    } catch (e) {
      console.error("Error playing chunk", e);
    }
  }

  private async stopPlayback() {
    if (this.playbackContext) {
      try {
        await this.playbackContext.close();
      } catch (e) {}
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      await this.playbackContext.resume();
      this.nextPlayTime = this.playbackContext.currentTime;
      this.isPlaying = false;
    }
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.stopPlayback().catch(e => console.error("Error stopping playback", e));
    
    if (this.sessionPromise) {
      this.sessionPromise.then(session => session.close()).catch(() => {});
      this.sessionPromise = null;
    }
    
    this.onStateChange("idle");
  }

  sendText(text: string) {
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({ text });
      });
    }
  }
}
