import { useEffect, useRef, useState } from "react";
import { UserRole } from "@/src/types";
import { Camera, CameraOff, Mic, MicOff, Sparkles } from "lucide-react";
import { audioSynth } from "@/src/utils/audioSynth";

interface CameraSeatProps {
  role: UserRole;
  isSelf: boolean;
  stream: MediaStream | null;
  cameraActive: boolean;
  micActive: boolean;
  onToggleCamera?: () => void;
  onToggleMic?: () => void;
  onActivityChanged?: (level: number) => void;
}

const EMOJIS = ["😊", "😂", "💖", "😮", "😢", "🍿"];

export default function CameraSeat({
  role,
  isSelf,
  stream,
  cameraActive,
  micActive,
  onToggleCamera,
  onToggleMic,
  onActivityChanged,
}: CameraSeatProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastFrameData = useRef<Uint8ClampedArray | null>(null);

  const [localActive, setLocalActive] = useState(0);

  // Bind stream to video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Motion Detection algorithm - very lightweight
  useEffect(() => {
    if (!cameraActive || !stream || !onActivityChanged) return;

    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 24;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isDestroyed = false;

    const detectMotion = () => {
      if (isDestroyed || !videoRef.current) return;
      
      try {
        ctx.drawImage(videoRef.current, 0, 0, 32, 24);
        const imgData = ctx.getImageData(0, 0, 32, 24).data;

        if (lastFrameData.current) {
          let totalDiff = 0;
          for (let i = 0; i < imgData.length; i += 4) {
            const rDiff = Math.abs(imgData[i] - lastFrameData.current[i]);
            const gDiff = Math.abs(imgData[i+1] - lastFrameData.current[i+1]);
            const bDiff = Math.abs(imgData[i+2] - lastFrameData.current[i+2]);
            totalDiff += (rDiff + gDiff + bDiff);
          }
          
          // Max diff for 768 pixels is 768 * 255 * 3 = 587,520
          // Normal movement yields 10,000 to 80,000
          const rate = Math.min(totalDiff / 100000, 1);
          setLocalActive(rate);
          onActivityChanged(rate);
        }

        lastFrameData.current = imgData;
      } catch (e) {
        // Safe catch for video tracks initialization state
      }

      setTimeout(detectMotion, 250);
    };

    const t = setTimeout(detectMotion, 1000);

    return () => {
      isDestroyed = true;
      clearTimeout(t);
    };
  }, [cameraActive, stream, onActivityChanged]);

  const triggerEmote = (emoji: string) => {
    // Play role sound
    if (role === "duckie") {
      audioSynth.playDuckieSound();
    } else {
      audioSynth.playDobbySound();
    }

    // Emit custom event
    const event = new CustomEvent("spawn-particles", {
      detail: { sender: role, emoji },
    });
    window.dispatchEvent(event);
  };

  const displayName = role === "duckie" ? "Duckie (aarvee) 🦆" : "Dobby (me) ✨";
  const seatColor = role === "duckie" ? "border-[#E0B974]/60 text-[#E0B974]" : "border-[#A78BFA]/60 text-[#A78BFA]";
  const shadowColor = role === "duckie" ? "shadow-[#E0B974]/15" : "shadow-[#A78BFA]/15";

  return (
    <div className={`flex flex-col items-center w-full max-w-[340px] p-4 rounded-2xl border-2 bg-gradient-to-b from-[#0F0E14] to-[#08070B]/80 backdrop-blur-xl shadow-xl transition-all duration-300 ${seatColor} ${shadowColor} relative group overflow-hidden`}>
      
      {/* Visual Glowing Ambient Backdrop */}
      <div className={`absolute -inset-10 bg-gradient-to-r rounded-full opacity-10 filter blur-3xl transition-opacity duration-500 group-hover:opacity-20 ${role === "duckie" ? "from-[#E0B974]" : "from-[#A78BFA]"}`} />

      {/* Seat Header Badge */}
      <div className="flex items-center justify-between w-full mb-3 select-none">
        <span className="font-mono text-xs uppercase tracking-wider text-white/50">
          {isSelf ? "My Seat" : "Peer Seat"}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${cameraActive ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`} />
          <span className="font-sans text-xs font-semibold">{displayName}</span>
        </div>
      </div>

      {/* Video Framing Card */}
      <div className="w-full aspect-[4/3] rounded-xl bg-black/90 border border-white/10 relative overflow-hidden flex items-center justify-center shadow-inner">
        {cameraActive && stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isSelf} // Always mute self to prevent local echo loop
            className="w-full h-full object-cover rounded-xl"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 select-none text-white/20">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center border border-white/5 bg-white/2 ${role === 'duckie' ? 'text-[#E0B974]' : 'text-[#A78BFA]'}`}>
              {role === "duckie" ? (
                <span className="text-3xl">🦆</span>
              ) : (
                <span className="text-3xl">✨</span>
              )}
            </div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-[#E0B974]/60">
              Camera Offline
            </p>
          </div>
        )}

        {/* Dynamic Activity Overlay Frame (Pulses gold/purple when talking/moving) */}
        <div
          style={{ opacity: Math.max(0, localActive - 0.1) }}
          className={`absolute inset-0 border-2 rounded-xl pointer-events-none transition-opacity duration-150 ${role === "duckie" ? "border-[#E0B974]" : "border-[#A78BFA]"}`}
        />
      </div>

      {/* Seat Controls Panel */}
      <div className="flex items-center justify-between w-full mt-3.5 pt-3.5 border-t border-white/5">
        <div className="flex gap-2">
          {isSelf && (
            <>
              <button
                onClick={() => {
                  audioSynth.playSoftClick();
                  if (onToggleCamera) onToggleCamera();
                }}
                className={`p-2 rounded-lg border transition-all hover:scale-105 active:scale-95 ${cameraActive ? "bg-[#E0B974]/20 border-[#E0B974]/40 text-[#E0B974]" : "bg-white/5 border-white/10 text-white/50"}`}
                title={cameraActive ? "Turn Cam Off" : "Turn Cam On"}
              >
                {cameraActive ? <Camera size={15} /> : <CameraOff size={15} />}
              </button>
              <button
                onClick={() => {
                  audioSynth.playSoftClick();
                  if (onToggleMic) onToggleMic();
                }}
                className={`p-2 rounded-lg border transition-all hover:scale-105 active:scale-95 ${micActive ? "bg-[#A78BFA]/20 border-[#A78BFA]/40 text-[#A78BFA]" : "bg-white/5 border-white/10 text-white/50"}`}
                title={micActive ? "Mute Mic" : "Unmute Mic"}
              >
                {micActive ? <Mic size={15} /> : <MicOff size={15} />}
              </button>
            </>
          )}
        </div>

        {/* Emotion Trigger Buttons pad */}
        <div className="flex items-center gap-1">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => triggerEmote(emoji)}
              className="w-7 h-7 text-sm flex items-center justify-center rounded-md bg-white/5 hover:bg-white/15 hover:scale-115 active:scale-90 transition-all border border-white/5 duration-150 cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
