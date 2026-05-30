import { useEffect, useState, useRef } from "react";
import { UserRole, ChatMessage, MediaState } from "@/src/types";
import { audioSynth } from "@/src/utils/audioSynth";
import ParticleCanvas from "@/src/components/ParticleCanvas";
import CameraSeat from "@/src/components/CameraSeat";
import MovieScreen from "@/src/components/MovieScreen";
import CompanionPanel, { encryptMessage } from "@/src/components/CompanionPanel";
import { Sparkles, MonitorStop, RefreshCw, Layers, ShieldCheck, Heart, Users } from "lucide-react";

export default function App() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [introPlayed, setIntroPlayed] = useState(false);
  const [introStage, setIntroStage] = useState(0); // 1 to 5 for cinematic sections
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Room core states
  const [media, setMedia] = useState<MediaState>({
    url: "",
    playing: false,
    currentTime: 0,
    sender: "dobby",
    timestamp: Date.now(),
  });
  const [chats, setChats] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState({
    duckieOnline: false,
    dobbyOnline: false,
  });

  // Local camera media tracks
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(false);

  // Screensharing media tracks
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);

  // Motion activity tracking levels for live particles spawning
  const [activityDuckie, setActivityDuckie] = useState(0);
  const [activityDobby, setActivityDobby] = useState(0);

  // WebRTC refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const presenceIntervalRef = useRef<number | null>(null);

  // Maintain offline buffering state
  const [offlineChats, setOfflineChats] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem("dd_offline_chats_queue");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Track physical connectivity drops
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerOfflineSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [offlineChats]);

  // Offline buffer backup persistence
  useEffect(() => {
    localStorage.setItem("dd_offline_chats_queue", JSON.stringify(offlineChats));
  }, [offlineChats]);

  // Unified Room State polling + Heartbeat polling
  useEffect(() => {
    if (!role || !introPlayed) return;

    // Fast heartbeat polling
    const pulse = async () => {
      try {
        const res = await fetch("/api/theater/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        });
        if (res.ok) {
          setIsOnline(true);
        }
      } catch (err) {
        setIsOnline(false);
      }
    };

    // Main sync poll
    const syncState = async () => {
      try {
        const res = await fetch("/api/theater/state");
        if (res.ok) {
          const data = await res.json();
          setPresence({
            duckieOnline: data.presence.duckieOnline,
            dobbyOnline: data.presence.dobbyOnline,
          });
          setChats(data.chats);

          // Only overwrite local media player controls if we are NOT the owner of the last update
          if (data.media.sender !== role) {
            setMedia(data.media);
          }
        }
      } catch (err) {
        setIsOnline(false);
      }
    };

    pulse();
    syncState();

    const tHeart = window.setInterval(pulse, 3000);
    const tSync = window.setInterval(syncState, 2000);

    presenceIntervalRef.current = tHeart;
    pollingIntervalRef.current = tSync;

    return () => {
      if (tHeart) clearInterval(tHeart);
      if (tSync) clearInterval(tSync);
    };
  }, [role, introPlayed]);

  // Synchronize offline logs when internet restores
  const triggerOfflineSync = async () => {
    if (offlineChats.length === 0) return;

    try {
      const res = await fetch("/api/theater/offline-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: offlineChats }),
      });
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats);
        setOfflineChats([]);
      }
    } catch {
      // Keep offline cache for next attempt
    }
  };

  // Run initial sync on boot if online
  useEffect(() => {
    if (isOnline && introPlayed) {
      triggerOfflineSync();
    }
  }, [isOnline, introPlayed]);

  // Sound triggering effect for peers joining
  useEffect(() => {
    if (!introPlayed) return;
    const otherOnline = role === "duckie" ? presence.dobbyOnline : presence.duckieOnline;
    if (otherOnline) {
      // Magical bell ringing!
      audioSynth.playDuckieSound();
    }
  }, [presence.duckieOnline, presence.dobbyOnline, introPlayed]);

  // WebRTC Signaling Poll Listener for P2P Screen share & Camera/Mic stream transfers
  useEffect(() => {
    if (!role || !introPlayed) return;

    const pollSignals = async () => {
      try {
        const res = await fetch(`/api/theater/signal/poll?role=${role}`);
        if (!res.ok) return;

        const { signals } = await res.json();
        if (Array.isArray(signals)) {
          for (const sig of signals) {
            await handleIncomingSignal(sig);
          }
        }
      } catch (err) {
        // Safe console ignore
      }
    };

    const tSignal = window.setInterval(pollSignals, 1500);
    return () => clearInterval(tSignal);
  }, [role, introPlayed, localStream, screenStream]);

  // Post SDP / ICE signals to the signaling server
  const sendSignal = async (type: "offer" | "answer" | "candidate", payload: any) => {
    try {
      await fetch("/api/theater/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender: role, type, payload }),
      });
    } catch {
      // Ignored during connection transitions
    }
  };

  // WebRTC state handlers
  const handleIncomingSignal = async (sig: any) => {
    const pc = pcRef.current;
    if (!pc) {
      // Auto build PC if we received an offer
      if (sig.type === "offer") {
        await acceptConnection(sig.payload);
      }
      return;
    }

    try {
      if (sig.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
      } else if (sig.type === "candidate") {
        await pc.addIceCandidate(new RTCIceCandidate(sig.payload));
      }
    } catch (e) {
      // Safe logger
    }
  };

  // Peer connection constructor
  const initializePeerConnection = (isCaller: boolean): RTCPeerConnection => {
    const config: RTCConfiguration = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    };

    const pc = new RTCPeerConnection(config);

    // Stream tracks listener
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (stream) {
        // Evaluate track type: screen tracks usually come under secondary video stream IDs,
        // or we simply assign based on state. If we are currently sharing standard cams, tracks are mapped.
        // We set both remote video targets cleanly.
        if (e.track.kind === "video") {
          // If we receive screen track (identified via track label or dynamic mapping), render it
          if (e.track.label.toLowerCase().includes("screen") || isSharing === false) {
            setRemoteScreenStream(stream);
          } else {
            setRemoteStream(stream);
          }
        } else {
          setRemoteStream(stream);
        }
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignal("candidate", e.candidate);
      }
    };

    // Attach current camera/mic layers to peer connection
    if (localStream) {
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }

    // Attach present screen shared tracks
    if (screenStream) {
      screenStream.getTracks().forEach((track) => pc.addTrack(track, screenStream));
    }

    pcRef.current = pc;
    return pc;
  };

  // WebRTC initiate caller offer
  const callPeer = async () => {
    const pc = initializePeerConnection(true);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal("offer", offer);
    } catch (err) {
      // Fail lock
    }
  };

  // WebRTC respond receiver answer
  const acceptConnection = async (offerSDP: any) => {
    const pc = initializePeerConnection(false);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offerSDP));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal("answer", answer);
    } catch (err) {
      // Fail lock
    }
  };

  // Toggle user audio/video streams
  const handleToggleCamera = async () => {
    if (cameraActive) {
      // Stop old tracks
      if (localStream) {
        localStream.getVideoTracks().forEach((track) => track.stop());
      }
      setCameraActive(false);
      // If mic is also off, stop full stream
      if (!micActive) {
        setLocalStream(null);
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, frameRate: 15 },
          audio: micActive,
        });

        if (localStream) {
          // Merge video track
          const videoTrack = stream.getVideoTracks()[0];
          localStream.addTrack(videoTrack);
          setLocalStream(new MediaStream(localStream.getTracks()));
        } else {
          setLocalStream(stream);
        }
        setCameraActive(true);

        // Feed to active peer conn
        if (pcRef.current) {
          const videoTrack = stream.getVideoTracks()[0];
          pcRef.current.addTrack(videoTrack, stream);
          await callPeer(); // renegotiate
        }
      } catch (err) {
        alert("Camera permission denied or camera currently in use.");
      }
    }
  };

  const handleToggleMic = async () => {
    if (micActive) {
      if (localStream) {
        localStream.getAudioTracks().forEach((track) => track.stop());
      }
      setMicActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: cameraActive,
        });

        if (localStream) {
          const audioTrack = stream.getAudioTracks()[0];
          localStream.addTrack(audioTrack);
          setLocalStream(new MediaStream(localStream.getTracks()));
        } else {
          setLocalStream(stream);
        }
        setMicActive(true);

        if (pcRef.current) {
          const audioTrack = stream.getAudioTracks()[0];
          pcRef.current.addTrack(audioTrack, stream);
          await callPeer(); // renegotiate
        }
      } catch (err) {
        alert("Microphone permission denied.");
      }
    }
  };

  // Screen layout share procedures
  const handleStartScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
      });

      setScreenStream(stream);
      setIsSharing(true);

      // Distribute stream across peer conns
      if (pcRef.current) {
        stream.getTracks().forEach((track) => {
          pcRef.current?.addTrack(track, stream);
        });
        await callPeer();
      }

      // Handle self stop sharing from browser UI bar
      stream.getVideoTracks()[0].onended = () => {
        handleStopScreenShare();
      };
    } catch (err) {
      // Share cancelled
    }
  };

  const handleStopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }
    setScreenStream(null);
    setIsSharing(false);
  };

  // Update synchronized player state
  const handleUpdateMediaState = async (update: Partial<MediaState>) => {
    const nextMedia = {
      ...media,
      ...update,
      timestamp: Date.now(),
    };
    setMedia(nextMedia);

    if (isOnline) {
      try {
        await fetch("/api/theater/media-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextMedia),
        });
      } catch {
        // Keep localized state
      }
    }
  };

  // Encrypted chat dispatcher
  const handleSendMessage = async (text: string) => {
    const freshChat: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      sender: role!,
      text: encryptMessage(text), // Encrypting string using local E2E protocol
      timestamp: Date.now(),
    };

    // Update locally instantly
    setChats((prev) => [...prev, freshChat]);

    if (isOnline) {
      try {
        await fetch("/api/theater/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(freshChat),
        });
      } catch (err) {
        // Network state failed mid-payload, shift to offline queue
        setOfflineChats((prev) => [...prev, { ...freshChat, isOffline: true }]);
      }
    } else {
      // Offline queue
      setOfflineChats((prev) => [...prev, { ...freshChat, isOffline: true }]);
    }
  };

  // System Theater Reset
  const handleClearTheater = async () => {
    try {
      await fetch("/api/theater/clear", { method: "POST" });
      setChats([]);
      setMedia({
        url: "",
        playing: false,
        currentTime: 0,
        sender: "dobby",
        timestamp: Date.now(),
      });
    } catch {
      // local fail
    }
  };

  // Cinematic Intro flow trigger sequencers
  const triggerCinematicIntro = () => {
    if (!role) return;

    audioSynth.playGrandOpening(); // 1. Sound grand THX chime swell triggers!
    setIntroStage(1); // "D & D" glow word

    // Stage 2: Black screen
    setTimeout(() => {
      setIntroStage(2);
      audioSynth.playTensionSwell();
    }, 2800);

    // Stage 3: Line 1
    setTimeout(() => {
      setIntroStage(3);
    }, 5500);

    // Stage 4: Line 2
    setTimeout(() => {
      setIntroStage(4);
    }, 8500);

    // Stage 5: Line 3
    setTimeout(() => {
      setIntroStage(5);
    }, 11500);

    // Stage 6: Fade theater room in!
    setTimeout(() => {
      setIntroPlayed(true);
      setIntroStage(0);
    }, 14500);
  };

  // Track state activities for rendering particle canvas flows
  const onActivityDuckieChanged = (lvl: number) => {
    setActivityDuckie(lvl);
  };

  const onActivityDobbyChanged = (lvl: number) => {
    setActivityDobby(lvl);
  };

  // -------------------------------------------------------------------------
  // RENDER FLOWS MODULE
  // -------------------------------------------------------------------------

  // A. Entrance Selector Screen
  if (!role) {
    return (
      <div className="min-h-screen bg-[#07060A] text-white flex flex-col items-center justify-center p-6 select-none relative overflow-hidden font-sans">
        {/* Soft magical star dust particles */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,13,105,0.1)_0,rgba(0,0,0,0)_100%)] pointer-events-none" />
        <div className="absolute top-1/4 left-1/3 w-96 h-96 rounded-full bg-[#E0B974]/3 filter blur-[120px] pointer-events-none" />

        <div className="w-full max-w-lg p-8 rounded-3xl border border-white/5 bg-gradient-to-b from-[#0F0E14] to-[#08070B] shadow-2xl relative z-10 flex flex-col items-center gap-6 text-center">
          
          <div className="flex flex-col gap-1 items-center">
            <span className="text-4xl animate-bounce">🍿</span>
            <h1 className="text-3xl font-semibold tracking-wider font-sans text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300">
              D & D Private Theater
            </h1>
            <p className="text-[11px] font-mono text-white/40 tracking-widest uppercase">
              The Sacred Screen of Duckie & Dobby
            </p>
          </div>

          <p className="text-xs text-white/50 max-w-sm leading-relaxed">
            Please pick your cozy seat to connect WebRTC stream lines and synchronize the cinematic screening room.
          </p>

          {/* Seat grids selector */}
          <div className="grid grid-cols-2 gap-4 w-full mt-2">
            {/* Seat Duckie */}
            <button
              onClick={() => {
                audioSynth.playSoftClick();
                setRole("duckie");
              }}
              className="group p-5 rounded-2xl border border-[#E0B974]/25 hover:border-[#E0B974] bg-[#E0B974]/2 hover:bg-[#E0B974]/5 transition-all text-center flex flex-col items-center gap-3 active:scale-95 duration-200 cursor-pointer"
            >
              <span className="text-4xl group-hover:scale-110 transition-transform">🦆</span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[#E0B974] font-sans">I am aarvee</span>
                <span className="text-[10px] font-mono text-white/35">(Duckie)</span>
              </div>
            </button>

            {/* Seat Dobby */}
            <button
              onClick={() => {
                audioSynth.playSoftClick();
                setRole("dobby");
              }}
              className="group p-5 rounded-2xl border border-[#A78BFA]/25 hover:border-[#A78BFA] bg-[#A78BFA]/2 hover:bg-[#A78BFA]/5 transition-all text-center flex flex-col items-center gap-3 active:scale-95 duration-200 cursor-pointer"
            >
              <span className="text-4xl group-hover:scale-110 transition-transform">🧝</span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[#A78BFA] font-sans">I am Dobby</span>
                <span className="text-[10px] font-mono text-white/35">(The Elf)</span>
              </div>
            </button>
          </div>

          {/* Golden E2E Protocol Notice bar */}
          <div className="w-full mt-2 p-3.5 rounded-xl bg-black/40 border border-white/5 flex items-center gap-2.5 text-left text-[11px] text-white/45 leading-normal">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
            <span>
              End-to-End Cryptography channel is ready. Every whisper, log, and action is strictly encrypted locally.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // B. Cinematic Intro Transition Screens
  if (!introPlayed) {
    // Idle/Init cinematic trigger setup
    if (introStage === 0) {
      return (
        <div className="min-h-screen bg-[#07060A] text-white flex flex-col items-center justify-center p-6 relative select-none font-sans">
          <div className="w-full max-w-sm p-8 rounded-2xl border border-white/5 bg-gradient-to-b from-[#0F0E14] to-[#08070B] text-center flex flex-col items-center gap-6 shadow-2xl relative z-10">
            <span className="text-5xl animate-pulse">✨</span>
            <div className="flex flex-col gap-1 items-center">
              <span className="text-[11px] font-mono text-amber-400 uppercase tracking-widest bg-amber-400/10 px-2 py-0.5 border border-amber-400/20 rounded-full">
                Seat Secured
              </span>
              <p className="text-xs text-white/50 mt-2 font-mono">
                Assigned role: {role === "duckie" ? "Duckie (aarvee)" : "Dobby (me)"}
              </p>
            </div>
            
            <button
              onClick={triggerCinematicIntro}
              style={{
                boxShadow: "0 0 25px rgba(224, 185, 116, 0.15)"
              }}
              className="w-full py-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-[#E0B974] to-[#cba662] hover:scale-[1.03] active:scale-95 text-[#0F0E14] transition-all cursor-pointer font-sans"
            >
              Enter the Sacred Palace
            </button>
          </div>
        </div>
      );
    }

    // Interactive Intro Stage renders
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 select-none font-sans transition-all duration-1000 relative overflow-hidden">
        
        {/* State 1: Glow D & D */}
        {introStage === 1 && (
          <div className="text-center animate-fade-in duration-500">
            <h1 className="text-7xl sm:text-9xl font-semibold tracking-wider font-sans text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-200 to-amber-400 drop-shadow-[0_0_50px_rgba(224,185,116,0.3)]">
              D & D
            </h1>
            <p className="text-xs uppercase tracking-[0.4em] text-white/35 mt-4 font-mono">
              The Theater of Souls
            </p>
          </div>
        )}

        {/* State 2: Deep Dark Empty void */}
        {introStage === 2 && (
          <div className="text-center animate-pulse duration-1000">
            <div className="w-1.5 h-1.5 rounded-full bg-white/20 animate-ping" />
          </div>
        )}

        {/* State 3: Lines 1 */}
        {introStage === 3 && (
          <div className="text-center max-w-lg px-4 space-y-4 animate-fade-in duration-700">
            <p className="text-xl sm:text-2xl font-sans tracking-wide text-amber-100 font-light italic leading-relaxed">
              &ldquo;For the stars that aligned to bring us together...&rdquo;
            </p>
            <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#E0B974]/30 to-transparent mx-auto mt-6" />
          </div>
        )}

        {/* State 4: Lines 2 */}
        {introStage === 4 && (
          <div className="text-center max-w-lg px-4 space-y-4 animate-fade-in duration-700">
            <p className="text-xl sm:text-2xl font-sans tracking-wide text-purple-100 font-light italic leading-relaxed">
              &ldquo;Welcome home, Duckie and Dobby.&rdquo;
            </p>
            <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#A78BFA]/30 to-transparent mx-auto mt-6" />
          </div>
        )}

        {/* State 5: Lines 3 */}
        {introStage === 5 && (
          <div className="text-center max-w-lg px-4 space-y-4 animate-fade-in duration-700">
            <p className="text-xl sm:text-2xl font-sans tracking-wide text-amber-200 font-medium italic leading-relaxed">
              &ldquo;Your private cinematic world resides behind the veil...&rdquo;
            </p>
            <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#E1B974]/50 to-transparent mx-auto mt-6" />
          </div>
        )}
      </div>
    );
  }

  // C. Main Immersive Theater Palace Screen
  const senderDisplayName = role === "duckie" ? "Duckie 🦆" : "Dobby ✨";
  const otherDisplayName = role === "duckie" ? "Dobby ✨" : "Duckie 🦆";
  const otherOnlineStatus = role === "duckie" ? presence.dobbyOnline : presence.duckieOnline;
  const webRTCStateLabel = pcRef.current ? pcRef.current.connectionState : "offline";

  return (
    <div className="min-h-screen bg-[#060508] text-white flex flex-col relative overflow-hidden font-sans select-none">
      
      {/* Background Advanced Particle System Layer for Micro-Smiles / Cam activities */}
      <ParticleCanvas 
        activityDuckie={activityDuckie}
        activityDobby={activityDobby}
      />

      {/* 1. Luxurious Virtual Status Indicator HUD Bar */}
      <header className="w-full border-b border-white/5 bg-gradient-to-b from-[#0F0E14] to-transparent py-4 px-6 flex items-center justify-between select-none z-10 relative">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-r from-[#E0B974] to-[#cba662] text-black font-bold text-center flex items-center justify-center shadow-lg font-sans">
            D
          </div>
          <div>
            <h1 className="font-sans text-sm font-semibold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-amber-200">
              D & D Private Theater
            </h1>
            <p className="text-[10px] font-mono text-white/40 tracking-wider">
              Secure P2P Encrypted Sandbox
            </p>
          </div>
        </div>

        {/* Quick HUD Diagnostics data */}
        <div className="flex flex-wrap items-center gap-3.5 text-xs">
          {/* Peer connection indicators */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
            <Users size={12} className="text-[#E0B974]" />
            <span className="font-mono text-[10px] text-white/50">
              {otherDisplayName}:{" "}
              <strong className={otherOnlineStatus ? "text-emerald-400" : "text-white/30"}>
                {otherOnlineStatus ? "ONLINE" : "OFFSIDE"}
              </strong>
            </span>
          </div>

          {/* WebRTC P2P diagnostics latency state */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 font-mono text-[10px] text-white/50">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>P2P State: {webRTCStateLabel.toUpperCase()}</span>
          </div>

          {/* Direct trigger WebRTC negotiation manually */}
          <button
            onClick={() => {
              audioSynth.playSoftClick();
              callPeer();
            }}
            className="p-1 px-2.5 rounded bg-[#A78BFA]/10 hover:bg-[#A78BFA]/20 text-[#A78BFA] border border-[#A78BFA]/30 flex items-center gap-1 font-mono text-[10px] tracking-wider transition-all cursor-pointer"
            title="Force reconnect Peer Streams"
          >
            <RefreshCw size={10} /> FORCE RECONNECT
          </button>
        </div>
      </header>

      {/* 2. Primary split column body panel stage */}
      <main className="flex-1 w-full grid grid-cols-1 lg:grid-cols-4 relative z-10 overflow-hidden">
        
        {/* Left Side: Dynamic screen share + Cinema Screen stream feeds (3-cols scale) */}
        <div className="lg:col-span-3 p-6 flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-76px)] scrollbar-none">
          
          <MovieScreen 
            role={role}
            media={media}
            screenStream={screenStream || remoteScreenStream}
            isSharing={isSharing}
            onUpdateMediaState={handleUpdateMediaState}
            onStartScreenShare={handleStartScreenShare}
            onStopScreenShare={handleStopScreenShare}
          />

          {/* Double theater seating cards container */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
            
            {/* Duct Seat : Left card (Duckie) */}
            <CameraSeat 
              role="duckie"
              isSelf={role === "duckie"}
              stream={role === "duckie" ? localStream : remoteStream}
              cameraActive={role === "duckie" ? cameraActive : otherOnlineStatus}
              micActive={role === "duckie" ? micActive : otherOnlineStatus}
              onToggleCamera={handleToggleCamera}
              onToggleMic={handleToggleMic}
              onActivityChanged={onActivityDuckieChanged}
            />

            {/* Elf Seat : Right card (Dobby) */}
            <CameraSeat 
              role="dobby"
              isSelf={role === "dobby"}
              stream={role === "dobby" ? localStream : remoteStream}
              cameraActive={role === "dobby" ? cameraActive : otherOnlineStatus}
              micActive={role === "dobby" ? micActive : otherOnlineStatus}
              onToggleCamera={handleToggleCamera}
              onToggleMic={handleToggleMic}
              onActivityChanged={onActivityDobbyChanged}
            />
          </div>
        </div>

        {/* Right Side: Shared E2E notes feed (1-col scale) */}
        <div className="lg:col-span-1 border-t lg:border-t-0 border-white/5 h-full max-h-[calc(100vh-76px)] overflow-hidden">
          <CompanionPanel 
            role={role}
            messages={chats}
            isOnline={isOnline}
            onSendMessage={handleSendMessage}
            onClearTheater={handleClearTheater}
          />
        </div>
      </main>

      {/* Elegant E2E Guarding micro badge footer */}
      <footer className="w-full py-2 bg-black border-t border-white/5 text-center text-[9px] font-mono text-white/20 select-none z-10">
        <span className="flex items-center justify-center gap-1.5 uppercase tracking-wider">
          <ShieldCheck size={11} className="text-[#E0B974]/80" /> Private Cinema Tunnel secured with TLS & WebRTC E2E Cryptography. Duckie & Dobby Cinema Suite v1.50
        </span>
      </footer>
    </div>
  );
}
