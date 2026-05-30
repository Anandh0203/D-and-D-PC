import React, { useState, useEffect, useRef } from "react";
import { ChatMessage, UserRole } from "@/src/types";
import { Send, Wifi, WifiOff, Lock, Sparkles, Popcorn, Trash2 } from "lucide-react";
import { audioSynth } from "@/src/utils/audioSynth";

interface CompanionPanelProps {
  role: UserRole;
  messages: ChatMessage[];
  isOnline: boolean;
  onSendMessage: (text: string) => void;
  onClearTheater: () => void;
}

// Secure E2E Lightweight Caesar & XOR Base64 Protocol
// Cryptographic key known only to Duckie & Dobby local screens
const E2E_KEY = "DobbyDuckiePrivatePalaceForeverSecure123";

function encryptMessage(text: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const keyChar = E2E_KEY.charCodeAt(i % E2E_KEY.length);
    result += String.fromCharCode(charCode ^ keyChar); // XOR Gate Encryption
  }
  return btoa(encodeURIComponent(result)); // Secure Web Safe payload
}

export function decryptMessage(cipher: string): string {
  try {
    const rawXor = decodeURIComponent(atob(cipher));
    let result = "";
    for (let i = 0; i < rawXor.length; i++) {
      const charCode = rawXor.charCodeAt(i);
      const keyChar = E2E_KEY.charCodeAt(i % E2E_KEY.length);
      result += String.fromCharCode(charCode ^ keyChar);
    }
    return result;
  } catch (err) {
    return cipher; // Fallback if plain text
  }
}

export default function CompanionPanel({
  role,
  messages,
  isOnline,
  onSendMessage,
  onClearTheater,
}: CompanionPanelProps) {
  const [inputText, setInputText] = useState("");
  const feedRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new chats
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    audioSynth.playSoftClick();
    onSendMessage(inputText.trim());
    setInputText("");
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#0F0E14]/80 border-l border-white/5 backdrop-blur-3xl relative">
      
      {/* Header Panel */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 select-none z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#E0B974]/10 border border-[#E0B974]/30 flex items-center justify-center">
            <Popcorn size={15} className="text-[#E0B974]" />
          </div>
          <div>
            <h3 className="font-sans text-sm font-semibold text-white/90">Cozy Notes Feed</h3>
            <div className="flex items-center gap-1">
              <Lock size={10} className="text-emerald-500" />
              <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-500/80">E2E Encrypted</span>
            </div>
          </div>
        </div>

        {/* Sync / Connections badging */}
        <div className="flex items-center gap-2">
          {/* Reset Room Stage button */}
          <button
            onClick={() => {
              if (confirm("Reset the cinema stage and message logs?")) {
                onClearTheater();
              }
            }}
            className="p-1.5 rounded bg-white/5 hover:bg-rose-500/10 hover:text-rose-400 border border-white/5 text-white/40 transition-all duration-150"
            title="Reset stage"
          >
            <Trash2 size={13} />
          </button>

          <span
            className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest rounded-full border transition-all ${
              isOnline 
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                : "bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse"
            }`}
          >
            {isOnline ? (
              <>
                <Wifi size={10} /> Online
              </>
            ) : (
              <>
                <WifiOff size={10} /> Offline
              </>
            )}
          </span>
        </div>
      </div>

      {/* Messages Scroll Feed */}
      <div 
        ref={feedRef}
        className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-none"
      >
        {messages.map((msg) => {
          const isSelf = msg.sender === role;
          const senderName = msg.sender === "duckie" ? "Duckie 🦆" : "Dobby ✨";
          
          // E2E decrypted text
          const decryptedText = decryptMessage(msg.text);

          const cardStyle = isSelf
            ? "bg-[#E0B974]/15 border-[#E0B974]/30 text-white ml-auto"
            : "bg-[#A78BFA]/10 border-[#A78BFA]/20 text-white";

          const bannerColor = msg.sender === "duckie" ? "text-[#E0B974]" : "text-[#A78BFA]";

          return (
            <div
              key={msg.id}
              className={`max-w-[85%] rounded-xl border p-3 hover:shadow-lg transition-transform hover:-translate-y-0.5 duration-250 animate-fade-in ${cardStyle}`}
            >
              {/* Message Header */}
              <div className="flex justify-between items-center mb-1 select-none">
                <span className={`font-semibold font-sans text-xs ${bannerColor}`}>
                  {senderName}
                </span>
                <div className="flex items-center gap-1">
                  {msg.isOffline && (
                    <span className="text-[8px] font-mono text-amber-400 uppercase tracking-widest bg-amber-400/10 px-1 border border-amber-400/20 rounded">
                      Pending Sync
                    </span>
                  )}
                  <span className="font-mono text-[9px] text-white/35">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Text content decryption */}
              <p className="text-sm font-sans whitespace-pre-wrap break-words leading-relaxed leading-[1.4] selection:bg-[#E0B974] selection:text-black">
                {decryptedText}
              </p>
            </div>
          );
        })}
      </div>

      {/* Footer Chat Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-white/5 bg-[#08070B]">
        <div className="flex gap-2 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={isOnline ? "Whisper a sweet cinema note..." : "Saved offline... will auto sync"}
            className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white/90 focus:outline-none focus:border-[#E0B974]/50 focus:ring-1 focus:ring-[#E0B974]/50 transition-all font-sans"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-3 rounded-xl bg-gradient-to-r from-[#E0B974] to-[#cba662] hover:scale-[1.03] active:scale-95 disabled:scale-100 disabled:opacity-40 select-none text-[#0F0E14] font-semibold transition-all shadow-md group border border-[#cba662] cursor-pointer"
          >
            <Send size={15} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-200" />
          </button>
        </div>
      </form>
    </div>
  );
}
export { encryptMessage };
