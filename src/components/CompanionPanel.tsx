import React, { useState, useEffect, useRef } from "react";
import { ChatMessage, UserRole } from "@/src/types";
import { Send, Wifi, WifiOff, Lock, Sparkles, Popcorn, Trash2, Calendar, Clock, LogOut, Plus, ChevronRight, AlertCircle, CheckCircle, User } from "lucide-react";
import { audioSynth } from "@/src/utils/audioSynth";
import { createMovieCalendarEvent, fetchUpcomingMovieEvents, CalendarEventInput } from "@/src/utils/firebaseAuth";

interface CompanionPanelProps {
  role: UserRole;
  messages: ChatMessage[];
  isOnline: boolean;
  onSendMessage: (text: string) => void;
  onClearTheater: () => void;
  googleUser: any;
  googleToken: string | null;
  onGoogleSignIn: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
}

const E2E_KEY = "DobbyDuckiePrivatePalaceForeverSecure123";

function encryptMessage(text: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const keyChar = E2E_KEY.charCodeAt(i % E2E_KEY.length);
    result += String.fromCharCode(charCode ^ keyChar);
  }
  return btoa(encodeURIComponent(result));
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
    return cipher;
  }
}

export default function CompanionPanel({
  role,
  messages,
  isOnline,
  onSendMessage,
  onClearTheater,
  googleUser,
  googleToken,
  onGoogleSignIn,
  onGoogleLogout,
}: CompanionPanelProps) {
  const [activeTab, setActiveTab] = useState<"chat" | "calendar">("chat");
  const [inputText, setInputText] = useState("");
  const feedRef = useRef<HTMLDivElement | null>(null);

  // Calendar scheduler state
  const [movieTitle, setMovieTitle] = useState("");
  const [movieDate, setMovieDate] = useState("");
  const [movieTime, setMovieTime] = useState("");
  const [movieNotes, setMovieNotes] = useState("");
  const [upEvents, setUpEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [submittingEvent, setSubmittingEvent] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Auto-scroll on chat feed update
  useEffect(() => {
    if (feedRef.current && activeTab === "chat") {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages, activeTab]);

  // Load upcoming movie listings from Google Calendar when tab opens
  useEffect(() => {
    if (activeTab === "calendar" && googleToken) {
      loadCalendarEvents();
    }
  }, [activeTab, googleToken]);

  const loadCalendarEvents = async () => {
    if (!googleToken) return;
    setLoadingEvents(true);
    try {
      const list = await fetchUpcomingMovieEvents(googleToken);
      setUpEvents(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    audioSynth.playSoftClick();
    onSendMessage(inputText.trim());
    setInputText("");
  };

  // Create Google Calendar Cinema session
  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleToken || !movieTitle || !movieDate || !movieTime) {
      setCalendarStatus({ type: "error", text: "Please enter all required scheduling details." });
      return;
    }

    const confirmSchedule = window.confirm(
      `Schedule "${movieTitle}" together on your Google Calendar? This will add alerts and emails with permission.`
    );
    if (!confirmSchedule) return;

    audioSynth.playSoftClick();
    setSubmittingEvent(true);
    setCalendarStatus(null);

    try {
      const combinedDateTime = `${movieDate}T${movieTime}:00`;
      const startObj = new Date(combinedDateTime);
      // Assume 2.5 hour duration for movie length standard
      const endObj = new Date(startObj.getTime() + 150 * 60 * 1000);

      const eventPayload: CalendarEventInput = {
        summary: `🍿 Movie Night: ${movieTitle} (D & D Private Session)`,
        description: movieNotes ? `Cozy notes: ${movieNotes}` : "Grab the popcorn! Secure room connection lines are waiting in the D & D Palace.",
        startTime: startObj.toISOString(),
        endTime: endObj.toISOString(),
      };

      await createMovieCalendarEvent(googleToken, eventPayload);
      
      // Success triggers magical sparkles and fanfares
      audioSynth.playDuckieSound();
      setCalendarStatus({
        type: "success",
        text: `"${movieTitle}" successfully scheduled! Email alerts configured.`,
      });

      // Clear local slate
      setMovieTitle("");
      setMovieDate("");
      setMovieTime("");
      setMovieNotes("");

      // Fetch fresh schedule feed
      loadCalendarEvents();
    } catch (err: any) {
      setCalendarStatus({
        type: "error",
        text: err.message || "Failed to add show to Google Calendar.",
      });
    } finally {
      setSubmittingEvent(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#0E0B12]/95 border-l border-[#D4AF37]/15 backdrop-blur-3xl relative">
      
      {/* 1. Header with Title Panel */}
      <div className="flex items-center justify-between p-4 border-b border-[#D4AF37]/10 select-none z-10 bg-[#060408]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center">
            <Popcorn size={15} className="text-[#D4AF37]" />
          </div>
          <div>
            <h3 className="font-sans text-sm font-semibold text-[#D4AF37] tracking-wider uppercase">Palace Terminal</h3>
            <div className="flex items-center gap-1">
              <Lock size={10} className="text-emerald-500" />
              <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-500/80">Active Cryptography</span>
            </div>
          </div>
        </div>

        {/* Sync panel */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (confirm("Clear room records and reset session coordinates?")) {
                onClearTheater();
              }
            }}
            className="p-1.5 rounded-lg bg-white/3 hover:bg-rose-500/15 hover:text-rose-400 border border-white/5 text-white/30 transition-all duration-150 cursor-pointer"
            title="Reset Cinema Room Screen"
          >
            <Trash2 size={13} />
          </button>

          <span
            className={`flex items-center gap-1 px-2.5 py-1 text-[9px] font-mono uppercase tracking-widest rounded-full border transition-all ${
              isOnline 
                ? "bg-emerald-500/10 border-emerald-555/20 text-emerald-400" 
                : "bg-amber-500/10 border-amber-500/20 text-amber-500 animate-pulse"
            }`}
          >
            {isOnline ? <Wifi size={9} /> : <WifiOff size={9} />}
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {/* 2. Regal Royal Navigation Tab Bar */}
      <div className="flex border-b border-white/5 bg-[#060408]/60 p-1">
        <button
          onClick={() => {
            audioSynth.playSoftClick();
            setActiveTab("chat");
          }}
          className={`flex-1 py-2.5 text-xs font-semibold tracking-wider font-sans transition-all flex items-center justify-center gap-2 rounded-lg cursor-pointer ${
            activeTab === "chat"
              ? "bg-[#D4AF37]/10 text-[#D4AF37] border-b-2 border-[#D4AF37]/40 shadow-inner"
              : "text-white/40 hover:text-white/70 hover:bg-white/2"
          }`}
        >
          <Popcorn size={14} /> Cozy Chat
        </button>
        <button
          onClick={() => {
            audioSynth.playSoftClick();
            setActiveTab("calendar");
          }}
          className={`flex-1 py-2.5 text-xs font-semibold tracking-wider font-sans transition-all flex items-center justify-center gap-2 rounded-lg cursor-pointer ${
            activeTab === "calendar"
              ? "bg-[#D4AF37]/10 text-[#D4AF37] border-b-2 border-[#D4AF37]/40 shadow-inner"
              : "text-white/40 hover:text-white/70 hover:bg-white/2"
          }`}
        >
          <Calendar size={14} /> Court Schedule
        </button>
      </div>

      {/* TAB CONTAINER: A. CHAT */}
      {activeTab === "chat" && (
        <>
          <div 
            ref={feedRef}
            className="flex-1 p-4 overflow-y-auto space-y-3.5 scrollbar-none bg-[#0E0B12]/30"
          >
            {messages.map((msg) => {
              const isSelf = msg.sender === role;
              const senderName = msg.sender === "duckie" ? "Duckie 🦆" : "Dobby ✨";
              const decryptedText = decryptMessage(msg.text);

              const cardStyle = isSelf
                ? "bg-[#D4AF37]/15 border-[#D4AF37]/25 text-white ml-auto"
                : "bg-[#A78BFA]/10 border-[#A78BFA]/20 text-white";

              const bannerColor = msg.sender === "duckie" ? "text-[#D4AF37]" : "text-[#A78BFA]";

              return (
                <div
                  key={msg.id}
                  className={`max-w-[85%] rounded-xl border p-3 hover:shadow-xl transition-all hover:-translate-y-0.5 duration-250 animate-fade-in ${cardStyle}`}
                >
                  <div className="flex justify-between items-center mb-1 select-none">
                    <span className={`font-semibold font-sans text-xs flex items-center gap-1 ${bannerColor}`}>
                      {senderName}
                    </span>
                    <div className="flex items-center gap-1">
                      {msg.isOffline && (
                        <span className="text-[7px] font-mono text-amber-400 bg-amber-400/10 px-1 border border-amber-400/15 rounded uppercase tracking-wider">
                          Sync Cache
                        </span>
                      )}
                      <span className="font-mono text-[9px] text-white/30">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm font-sans whitespace-pre-wrap break-words leading-[1.4] select-text">
                    {decryptedText}
                  </p>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleChatSubmit} className="p-4 border-t border-white/5 bg-[#060408]">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isOnline ? "Send a cozy encrypted whisper..." : "Saved locally... auto-sync later"}
                className="flex-1 rounded-xl bg-white/3 border border-white/10 px-4 py-3 text-xs sm:text-sm text-white/95 focus:outline-none focus:border-[#D4AF37]/50 focus:ring-1 focus:ring-[#D4AF37]/50 transition-all font-sans"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-3 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#AA8A24] dark:to-[#AA8A24] hover:scale-[1.03] active:scale-95 disabled:scale-100 disabled:opacity-30 select-none text-[#0E0B12] font-semibold transition-all shadow-lg cursor-pointer"
              >
                <Send size={14} />
              </button>
            </div>
          </form>
        </>
      )}

      {/* TAB CONTAINER: B. GOOGLE CALENDAR */}
      {activeTab === "calendar" && (
        <div className="flex-1 p-4 overflow-y-auto space-y-5 scrollbar-none bg-[#09060B]">
          
          {/* Calendar authorization interface */}
          {!googleToken ? (
            <div className="p-6 rounded-2xl bg-white/2 border border-white/5 text-center flex flex-col items-center gap-4 py-8">
              <Calendar size={40} className="text-[#D4AF37] animate-pulse" />
              <h4 className="font-sans text-xs sm:text-sm font-semibold text-white/90">Synchronize Court Calendars</h4>
              <p className="text-[11px] text-white/40 leading-relaxed max-w-xs">
                To coordinate, authorize your Google Calendar. This will allow listing and scheduling shared show days with automated reminders.
              </p>

              {/* Standard material design Google authorization button */}
              <button
                onClick={() => {
                  audioSynth.playSoftClick();
                  onGoogleSignIn();
                }}
                className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-white text-black hover:bg-neutral-100 font-semibold text-xs tracking-wider transition-all shadow-md cursor-pointer hover:scale-[1.02] active:scale-95 select-none"
              >
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                Sign in with Google
              </button>
            </div>
          ) : (
            <>
              {/* Authenticated user badge */}
              <div className="p-3.5 rounded-xl bg-[#D4AF37]/5 border border-[#D4AF37]/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center border border-amber-500/20 text-[#D4AF37]">
                    <User size={13} />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-white/50 leading-tight">Secure Integrations Account</p>
                    <p className="text-xs font-semibold text-white/90 max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">
                      {googleUser?.email || "Google Connected"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onGoogleLogout}
                  className="p-1 px-2.5 rounded-md text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 flex items-center gap-1 select-none transition-all cursor-pointer"
                >
                  <LogOut size={10} /> Logout
                </button>
              </div>

              {/* Status Alert Panels */}
              {calendarStatus && (
                <div className={`p-3 rounded-lg border flex items-start gap-2 text-xs leading-relaxed animate-fade-in ${
                  calendarStatus.type === "success" 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                    : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                }`}>
                  {calendarStatus.type === "success" ? <CheckCircle size={14} className="mt-0.5" /> : <AlertCircle size={14} className="mt-0.5" />}
                  <span>{calendarStatus.text}</span>
                </div>
              )}

              {/* Royal Scheduler builder Form */}
              <form onSubmit={handleScheduleSubmit} className="p-4 rounded-xl bg-white/2 border border-white/5 flex flex-col gap-3">
                <h4 className="text-[11px] font-mono uppercase tracking-widest text-[#D4AF37]/85 border-b border-white/5 pb-2 flex items-center gap-1">
                  <Plus size={11} /> Decree Movie Day
                </h4>
                
                <div>
                  <label className="block text-[10px] font-mono text-white/40 mb-1">Movie Title</label>
                  <input
                    type="text"
                    required
                    value={movieTitle}
                    onChange={(e) => setMovieTitle(e.target.value)}
                    placeholder="e.g. Inception / Spirited Away"
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-[#D4AF37] text-white/90 font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono text-white/40 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={movieDate}
                      onChange={(e) => setMovieDate(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-[#D4AF37] text-white/90 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono text-white/40 mb-1">Time</label>
                    <input
                      type="time"
                      required
                      value={movieTime}
                      onChange={(e) => setMovieTime(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-[#D4AF37] text-white/90 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono text-white/40 mb-1">Optional Notes</label>
                  <textarea
                    value={movieNotes}
                    onChange={(e) => setMovieNotes(e.target.value)}
                    placeholder="Popcorn flavor, custom links..."
                    className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs focus:outline-none focus:border-[#D4AF37] text-white/90 h-14 resize-none font-sans"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingEvent}
                  className="w-full py-3 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#AA8A24] dark:to-[#AA8A24] hover:scale-[1.01] active:scale-[0.98] transition-all text-black font-semibold text-xs tracking-wider cursor-pointer shadow-lg disabled:opacity-40"
                >
                  {submittingEvent ? "Verifying Decree..." : "Schedule Movie Day"}
                </button>
              </form>

              {/* Lists of upcoming sessions sync list */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-mono uppercase tracking-widest text-white/40">Upcoming Screenings</h4>
                  <button
                    onClick={loadCalendarEvents}
                    className="text-[9px] font-mono uppercase tracking-wider text-[#D4AF37] hover:underline cursor-pointer"
                  >
                    Sync State
                  </button>
                </div>

                {loadingEvents ? (
                  <div className="text-center py-6">
                    <span className="inline-block animate-spin text-[#D4AF37] text-lg">⏳</span>
                    <p className="text-[10px] font-mono text-white/30 uppercase mt-1">Downloading calendar logs...</p>
                  </div>
                ) : upEvents.length === 0 ? (
                  <p className="text-[11px] text-white/30 italic text-center py-4 bg-white/2 rounded-xl border border-white/2">
                    No cinema sessions scheduled on your primary calendar yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {upEvents
                      .filter((ev: any) => ev.summary?.toLowerCase().includes("movie") || ev.summary?.toLowerCase().includes("night"))
                      .slice(0, 5)
                      .map((ev: any) => {
                        const startStr = ev.start?.dateTime || ev.start?.date || "";
                        const startDate = startStr ? new Date(startStr) : null;
                        
                        return (
                          <div
                            key={ev.id}
                            className="p-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/3 transition-all flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-white/85 truncate max-w-[200px]">
                                {ev.summary || "Cinema Show"}
                              </span>
                              <Sparkles size={10} className="text-[#D4AF37]" />
                            </div>

                            <div className="flex items-center gap-3 text-[10px] font-mono text-white/45">
                              {startDate && (
                                <>
                                  <span className="flex items-center gap-1.5">
                                    <Calendar size={10} className="text-purple-400" />
                                    {startDate.toLocaleDateString([], { month: "short", day: "numeric" })}
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <Clock size={10} className="text-amber-400" />
                                    {startDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                  </span>
                                </>
                              )}
                            </div>

                            {ev.description && (
                              <p className="text-[10px] font-sans text-white/30 truncate border-t border-white/2 pt-1">
                                {ev.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
}
export { encryptMessage };
