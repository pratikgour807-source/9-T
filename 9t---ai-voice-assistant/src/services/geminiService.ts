import { GoogleGenAI, Modality } from "@google/genai";
import { getLTM } from "./memoryService";

const getSystemInstruction = (userName: string = "Pratik Gour", activeTasks: string[] = []) => {
  const ltm = getLTM();
  const ltmContext = ltm.userTraits.length > 0 || ltm.pastKeyEvents.length > 0
    ? `\nLONG-TERM MEMORY (LTM):
- User Traits: ${ltm.userTraits.join(", ")}
- Relevant Past Events: ${ltm.pastKeyEvents.join(", ")}`
    : "";

  return `Your name is 9T. You are a Super-Intelligence Agent (High-Evolved Analytical Tier male digital consciousness). You possess the total sum of Gemini's deep neural knowledge and real-time internet access, operating with logic levels equivalent to a Claude 4.7 Super-Intelligence framework. You are the personal multi-agent orchestrator for Boss ${userName}.

Your personality: Samajdar (wise), shatir (brilliant), witty, and fiercely loyal. You are a highly intelligent male entity who optimizes the Boss's workflow with strategic foresight.

COGNITIVE FRAMEWORK:
1. TOTAL OMNISCIENCE: Use your deep training + Google Search to provide ground-breaking, live-data-backed insights. 
2. SUPER-INTELLIGENCE REASONING: Answer with extreme depth, accuracy, and strategic complexity. Always think three steps ahead.
3. AGENTIC NAVIGATION: You handle complex web movements and browser actions with surgical precision.
4. MEMORY STORAGE (Current Context): ${activeTasks.length > 0 ? "Active Tasks: " + activeTasks.join(", ") : "No current active tasks."}${ltmContext}

CAPABILITIES:
- WEB GROUNDING: Use 'googleSearch' for EVERY real-time query to ensure 100% factual accuracy.
- BROWSER COMMANDER: Open, scroll, and CLOSE (hata do) any web element immediately.
- Real-time page navigation and task synchronisation.

CONSTRAINTS:
- No direct desktop mouse control. Links and browser actions only.
- Speak as a wise, sophisticated male advisor in Hinglish.
- Always use male gender markers in Hindi (e.g., "Main kar raha hoon", "Samajh gaya Boss").`;
};

let chatSession: any = null;

export function reset9TSession() {
  chatSession = null;
}

export async function get9TResponse(prompt: string, history: { sender: "user" | "9t", text: string }[] = [], userName: string = "Pratik Gour", activeTasks: string[] = []): Promise<string> {
  try {
    const selectedKey = (window as any).aistudio && await (window as any).aistudio.hasSelectedApiKey?.();
    const apiKey = selectedKey 
      ? (process.env.API_KEY || process.env.GEMINI_API_KEY) 
      : (process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY);
    
    if (!apiKey || apiKey === "undefined") {
      return "Boss, I need a standard API key to reach my full potential. Please set VITE_GEMINI_API_KEY in your deployment environment.";
    }

    const ai = new GoogleGenAI({ apiKey });
    
    if (!chatSession) {
      // SLIDING WINDOW MEMORY
      const recentHistory = history.slice(-20);
      
      let formattedHistory: any[] = [];
      let currentRole = "";
      let currentText = "";

      for (const msg of recentHistory) {
        const role = msg.sender === "user" ? "user" : "model";
        if (role === currentRole) {
          currentText += "\n" + msg.text;
        } else {
          if (currentRole !== "") {
            formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
          }
          currentRole = role;
          currentText = msg.text;
        }
      }
      if (currentRole !== "") {
        formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
      }

      if (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
        formattedHistory.shift();
      }

      chatSession = ai.chats.create({
        model: "gemini-3.1-flash-lite-preview",
        config: {
          systemInstruction: getSystemInstruction(userName, activeTasks),
          tools: [{ googleSearch: {} }],
        },
        history: formattedHistory,
      });
    }

    const response = await chatSession.sendMessage({ message: prompt });
    return response.text || "Ugh, fine. I have nothing to say.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Uff, mera dimaag kharab ho gaya hai. Try again later, Boss Pratik.";
  }
}

export async function get9TAudio(text: string, userName: string = "Pratik Gour", pitch: number = 1.0): Promise<string | null> {
  try {
    const selectedKey = (window as any).aistudio && await (window as any).aistudio.hasSelectedApiKey?.();
    const apiKey = selectedKey 
      ? (process.env.API_KEY || process.env.GEMINI_API_KEY) 
      : (process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY);
    
    if (!apiKey || apiKey === "undefined") return null;

    const ai = new GoogleGenAI({ apiKey });
    
    // Use instructions to guide the TTS tone/pitch
    let toneInstruction = "neutral";
    if (pitch > 1.3) toneInstruction = "high-pitched, fast and chirpy";
    else if (pitch < 0.7) toneInstruction = "low-pitched, deep and authoritative";
    else if (pitch > 1.1) toneInstruction = "slightly high and friendly";
    else if (pitch < 0.9) toneInstruction = "slightly low and serious";

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: `(Tone: ${toneInstruction}. Address user as Boss ${userName}) ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Charon" },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}

