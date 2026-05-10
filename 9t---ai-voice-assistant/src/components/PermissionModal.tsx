import React from 'react';
import { motion } from 'motion/react';
import { MicOff } from 'lucide-react';

interface Props {
  onClose: () => void;
  error?: string;
}

export default function PermissionModal({ onClose, error }: Props) {
  const getErrorInfo = () => {
    if (!error) return {
      title: "Microphone Blocked",
      message: "Your browser has blocked microphone access for this site. 9T cannot hear you until you allow it.",
      steps: [
        "Click the lock icon (🔒) or tune icon (⚙️) next to the URL bar.",
        "Find Microphone and change it to Allow.",
        "Refresh this page."
      ]
    };

    const errStr = error.toString().toLowerCase();
    
    if (errStr.includes("denied") || errStr.includes("permission denied") || errStr.includes("notallowederror")) {
      return {
        title: "Microphone Access Denied",
        message: "Boss, you've denied microphone access. 9T needs your voice to function with high-fidelity precision. My auditory sensors are currently offline.",
        steps: [
          "Click the lock icon (🔒) or settings icon in your browser address bar.",
          "Reset the microphone permission to 'Allow'.",
          "If on Mobile, go to Settings > Privacy > Microphone and enable access for this browser.",
          "Refresh the page once access is granted."
        ]
      };
    }
    
    if (errStr.includes("notfounderror") || errStr.includes("devicesnotfounderror") || errStr.includes("no such device")) {
      return {
        title: "Microphone Not Found",
        message: "I couldn't find a microphone connected to your ecosystem, Boss Pratik.",
        steps: [
          "Check if your microphone is properly plugged in.",
          "Check System Settings (Sound/Input) to see if a device is recognized.",
          "If using a headset, make sure it's turned on and connected.",
          "Try reconnecting the hardware."
        ]
      };
    }
    
    if (errStr.includes("notreadableerror") || errStr.includes("trackstarterror") || errStr.includes("abort") || errStr.includes("could not start")) {
      return {
        title: "Microphone Is Busy",
        message: "Another process is hogging the microphone. My logic is being blocked, Boss.",
        steps: [
          "Close other apps like Zoom, Teams, or Skype.",
          "Check if another browser tab is already using the mic.",
          "Restart your browser or even the laptop to reset the audio stack.",
          "Ensure your OS hasn't 'Muted' the mic at the hardware level."
        ]
      };
    }

    if (errStr.includes("security") || errStr.includes("unsafe") || errStr.includes("feature-policy")) {
      return {
        title: "Security Restriction",
        message: "The browser's security architecture is blocking my voice interface.",
        steps: [
          "Ensure you are using a secure connection (HTTPS).",
          "Check if the site is running inside an restricted iframe.",
          "Try opening the app in a new, direct tab.",
          "Review your browser's advanced privacy settings."
        ]
      };
    }

    if (errStr.includes("overconstrained") || errStr.includes("constraint")) {
      return {
        title: "Hardware Mismatch",
        message: "The microphone doesn't meet the high-fidelity requirements I need, Boss.",
        steps: [
          "Try a different microphone if available.",
          "Unplug and replug your audio device.",
          "Check for driver updates in your device manager.",
          "Select a standard 44.1kHz or 48kHz input device."
        ]
      };
    }

    if (errStr.includes("network error") || errStr.includes("failed to connect") || errStr.includes("websocket") || errStr.includes("deadline exceeded")) {
      return {
        title: "Network & Connection Error",
        message: "Boss, I can't reach the live AI bridge. The connection is unstable, timed out, or WebSockets are being blocked by your network architecture.",
        steps: [
          "Check your internet speed and stability.",
          "Try using a paid Google Cloud API key if you have one.",
          "Ensure no VPN or Firewall is blocking WebSocket traffic.",
          "Refresh the page to re-establish the neural uplink."
        ],
        showKeySelection: true
      };
    }

    return {
      title: "Sync Error",
      message: `An unexpected logic error occurred: ${error}. My systems are confused, Boss Pratik.`,
      steps: [
        "Check your browser site permissions.",
        "Ensure no other hardware is conflicting with the mic.",
        "A full browser restart usually clears these technical glitches.",
        "Check your internet stability."
      ],
      showKeySelection: errStr.includes("403") || errStr.includes("401") || errStr.includes("key")
    };
  };

  const info = getErrorInfo();
  const isNetworkOrKeyError = info.showKeySelection;

  const handleSelectKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      window.location.reload(); // Reload to apply new key
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#111] border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />
        
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
          <MicOff size={32} className="text-red-400" />
        </div>
        
        <h2 className="text-2xl font-serif font-medium text-white mb-3">{info.title}</h2>
        <p className="text-white/60 text-sm mb-6 leading-relaxed">
          {info.message}
        </p>
        
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left w-full mb-8">
          <p className="text-sm text-white/80 font-medium mb-2">Technical Guidance:</p>
          <ol className="text-xs text-white/60 list-decimal pl-4 space-y-2">
            {info.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
        
        <div className="flex flex-col w-full gap-3">
          {isNetworkOrKeyError && (window as any).aistudio?.openSelectKey && (
            <button 
              onClick={handleSelectKey}
              className="w-full py-3 px-4 bg-cyan-500 text-black font-bold rounded-xl hover:bg-cyan-400 transition-colors uppercase text-xs tracking-widest"
            >
              Select Paid API Key
            </button>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 bg-white text-black font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            Refresh Page
          </button>
          <button 
            onClick={onClose}
            className="w-full py-3 px-4 bg-white/5 text-white/70 font-medium rounded-xl hover:bg-white/10 transition-colors"
          >
            Close Dialog
          </button>
        </div>
      </motion.div>
    </div>
  );
}
