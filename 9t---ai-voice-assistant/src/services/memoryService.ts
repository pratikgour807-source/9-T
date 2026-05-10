import { GoogleGenAI } from "@google/genai";

interface LTMData {
  userTraits: string[];
  pastKeyEvents: string[];
  lastUpdate: number;
}

const MEMORY_KEY = "9t_long_term_memory";

export function getLTM(): LTMData {
  const saved = localStorage.getItem(MEMORY_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse LTM", e);
    }
  }
  return {
    userTraits: [],
    pastKeyEvents: [],
    lastUpdate: Date.now(),
  };
}

export function saveLTM(data: LTMData) {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(data));
}

export async function updateLTM(history: { sender: "user" | "9t", text: string }[]) {
  if (history.length < 5) return; // Wait for enough context

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const currentLTM = getLTM();
    const historyText = history.map(m => `${m.sender}: ${m.text}`).join("\n");

    const prompt = `You are the memory module for 9T, an AI. 
Analyze the following conversation history and the existing memory.
Provide an updated list of User Traits and Past Key Events.
Return ONLY a valid JSON object with keys "userTraits" and "pastKeyEvents".

Existing Memory:
${JSON.stringify(currentLTM)}

Recent History:
${historyText}

Example Output:
{
  "userTraits": ["Likes Arijit Singh", "Technical background", "Prefers direct answers"],
  "pastKeyEvents": ["Boss asked to open ChatGPT at 8:00 AM", "Reminder set for meeting tomorrow"]
}
`;

    const result = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ parts: [{ text: prompt }] }]
    });
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) return;
    
    // Clean JSON if model included backticks
    const jsonStr = responseText.replace(/```json|```/g, "").trim();
    const newData = JSON.parse(jsonStr);

    if (newData.userTraits && newData.pastKeyEvents) {
      saveLTM({
        ...newData,
        lastUpdate: Date.now()
      });
      console.log("LTM Updated successfully");
    }
  } catch (error) {
    console.error("Failed to update LTM", error);
  }
}
