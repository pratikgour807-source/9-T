export function processCommand(command: string): {
  action: string;
  url?: string;
  isBrowserAction: boolean;
} {
  const lowerCmd = command.toLowerCase().trim();

  // General Browsing: "Open [website name]" or "Kholo [website name]" or "Search [query] on Google"
  const openMatch = lowerCmd.match(/^(?:open|kholo|dikhao|go to|visit|chalao|start)\s+(.+)$/);
  const searchMatch = lowerCmd.match(/^(?:search|dhundo|pucho|google|find)\s+(.+)$/);

  if (openMatch && !lowerCmd.includes("youtube") && !lowerCmd.includes("spotify")) {
    let website = openMatch[1].trim().toLowerCase().replace(/\s+/g, "");
    const cleanName = openMatch[1].trim();

    if (!website.includes(".")) {
      // Common domains
      const domains: Record<string, string> = {
        "google": "google.com",
        "facebook": "facebook.com",
        "instagram": "instagram.com",
        "twitter": "twitter.com",
        "x": "x.com",
        "github": "github.com",
        "chatgpt": "chat.openai.com",
        "gemini": "gemini.google.com",
        "youtube": "youtube.com",
        "spotify": "spotify.com",
        "whatsapp": "web.whatsapp.com",
        "linkedin": "linkedin.com",
        "netflix": "netflix.com",
        "amazon": "amazon.in"
      };

      if (domains[website]) {
        website = domains[website];
      } else {
        // Search it if unknown
        const query = encodeURIComponent(cleanName);
        return {
          action: `Dhund raha hoon ${cleanName} Google par, Boss Pratik.`,
          url: `https://www.google.com/search?q=${query}`,
          isBrowserAction: true,
        };
      }
    }

    const finalUrl = website.startsWith("http") ? website : `https://www.${website}`;
    return {
      action: `Opening ${cleanName} for you, Boss.`,
      url: finalUrl,
      isBrowserAction: true,
    };
  }

  // Google Search
  if (searchMatch) {
    const query = encodeURIComponent(searchMatch[1].trim());
    return {
      action: `Dhund raha hoon ${searchMatch[1]} Google par. Ek minute, Boss Pratik.`,
      url: `https://www.google.com/search?q=${query}`,
      isBrowserAction: true,
    };
  }

  // Media Search: "Play [song/video] on YouTube" or "YouTube pe [song] bajao"
  const ytMatch = lowerCmd.match(/^(?:play|bajao|search)\s+(.+?)\s+(?:on|pe)\s+youtube$/) || 
                  lowerCmd.match(/^youtube\s+(?:pe|on)\s+(.+?)\s+(?:play|bajao|search)$/);
  if (ytMatch) {
    const query = encodeURIComponent(ytMatch[1].trim());
    return {
      action: `Playing ${ytMatch[1]} on YouTube. Enjoy karo, Boss!`,
      url: `https://www.youtube.com/results?search_query=${query}`,
      isBrowserAction: true,
    };
  }

  // Media Search: Spotify
  const spotifyMatch = lowerCmd.match(/^(?:search|play|bajao)\s+(.+?)\s+(?:on|pe)\s+spotify$/);
  if (spotifyMatch) {
    const query = encodeURIComponent(spotifyMatch[1].trim());
    return {
      action: `Searching ${spotifyMatch[1]} on Spotify. Sangeet ka maza lijiye, Boss Pratik.`,
      url: `https://open.spotify.com/search/${query}`,
      isBrowserAction: true,
    };
  }

  // WhatsApp Web
  const waMatch = lowerCmd.match(/^(?:send|bhejo|whatsapp)\s+(?:a\s+)?whatsapp\s+(?:message\s+)?to\s+([\d\+\s]+)\s+(?:saying|likho|pe)\s+(.+)$/);
  if (waMatch) {
    const number = waMatch[1].replace(/\s+/g, "");
    const message = encodeURIComponent(waMatch[2].trim());
    return {
      action: `Sending message to ${number}. Done, Boss Pratik.`,
      url: `https://web.whatsapp.com/send?phone=${number}&text=${message}`,
      isBrowserAction: true,
    };
  }

  // Clicking Commands (Explain limitations)
  if (lowerCmd.includes("click") || lowerCmd.includes("dabao") || lowerCmd.includes("puch karo")) {
    return {
      action: "Boss, main laptop screen par directly 'click' nahi kar sakta browser security ki wajah se, par main aapke liye links open kar sakta hoon aur scroll kar sakta hoon. Kya main koi site open karoon?",
      isBrowserAction: false
    };
  }

  // Navigation Commands
  if (lowerCmd.includes("go back") || lowerCmd.includes("piche jao")) {
    return {
      action: "Piche ja raha hoon, Boss.",
      isBrowserAction: true,
      navigation: "back"
    } as any;
  }
  if (lowerCmd.includes("go forward") || lowerCmd.includes("aage jao")) {
    return {
      action: "Aage ja raha hoon, Boss.",
      isBrowserAction: true,
      navigation: "forward"
    } as any;
  }
  if (lowerCmd.includes("refresh") || lowerCmd.includes("reload")) {
    return {
      action: "Page refresh kar raha hoon, Boss.",
      isBrowserAction: true,
      navigation: "refresh"
    } as any;
  }

  // Multi-Agent Task Management Patterns
  if (lowerCmd.includes("add task") || lowerCmd.includes("list me dalo") || lowerCmd.includes("remember that")) {
    const task = lowerCmd.replace(/add task|list me dalo|remember that/g, "").trim();
    if (task) {
      return {
        action: `Zaroor Boss, tasks list mein "${task}" add kar diya hai.`,
        isBrowserAction: false,
        taskAction: { type: "add", task }
      } as any;
    }
  }

  if (lowerCmd.includes("clear tasks") || lowerCmd.includes("tasks hata do")) {
    return {
      action: "System Memory flushed. Saare tasks clear kar diye hain, Boss.",
      isBrowserAction: false,
      taskAction: { type: "clear" }
    } as any;
  }

  // Close/Remove Command: "Hata do" or "Close everything"
  if (lowerCmd.includes("hata do") || lowerCmd.includes("close everything") || lowerCmd.includes("clear screen") || lowerCmd.includes("band karo") || lowerCmd.includes("remove it")) {
    // If it's the specific "tasks hata do", we already handle that above, but let's make sure this one is for the browser
    if (!lowerCmd.includes("tasks")) {
      return {
        action: "Samajh gaya Boss, browser reference hata raha hoon. Screen clear kar di hai.",
        isBrowserAction: true,
        close: true
      } as any;
    }
  }

  // Reminder Pattern: "Remind me to [Task] in [Time]" or "Remind me to [Task] at [Time]"
  const reminderMatch = lowerCmd.match(/remind me to (.+?)(?: in (\d+) (minutes|minute|hours|hour))?$/);
  if (reminderMatch) {
    const task = reminderMatch[1];
    const amount = parseInt(reminderMatch[2]) || 5; // Default 5 mins if not mentioned
    const unit = reminderMatch[3] || "minutes";
    
    return {
      action: `Zaroor Boss, main aapko ${task} ke bare mein ${amount} ${unit} mein yaad dilaunga.`,
      isBrowserAction: false,
      reminder: {
        task,
        delayMs: unit.includes("hour") ? amount * 3600000 : amount * 60000
      }
    } as any;
  }

  // Scrolling Commands
  if (lowerCmd.includes("scroll down") || lowerCmd.includes("niche jao") || lowerCmd.includes("niche dikhao") || lowerCmd.includes("page niche karo")) {
    return {
      action: "Niche ja raha hoon, Boss.",
      isBrowserAction: true,
      scroll: "down"
    } as any;
  }
  if (lowerCmd.includes("scroll up") || lowerCmd.includes("upar jao") || lowerCmd.includes("upar dikhao") || lowerCmd.includes("page upar karo")) {
    return {
      action: "Upar ja raha hoon, Boss.",
      isBrowserAction: true,
      scroll: "up"
    } as any;
  }

  // Final catch-all for "Open [Something]" or just "Search [Something]"
  if (lowerCmd.includes("open") || lowerCmd.includes("kholo") || lowerCmd.includes("start")) {
    const query = encodeURIComponent(command);
    return {
      action: `Opening search results for your command, Boss.`,
      url: `https://www.google.com/search?q=${query}`,
      isBrowserAction: true,
    };
  }

  return { action: "", isBrowserAction: false };
}
