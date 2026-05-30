import React, { useEffect, useRef, useState } from "react";
import { UserRole, MediaState } from "@/src/types";
import { Play, Pause, Maximize, Volume2, Monitor, Tv, Link2, Sliders, ExternalLink } from "lucide-react";
import { audioSynth } from "@/src/utils/audioSynth";

interface MovieScreenProps {
  role: UserRole;
  media: MediaState;
  screenStream: MediaStream | null;
  isSharing: boolean;
  onUpdateMediaState: (update: Partial<MediaState>) => void;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
}

const CINEMA_TRAILERS = [
  { name: "Big Buck Bunny (Humble Classic)", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" },
  { name: "Sintel (Fantasy Drama)", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4" },
  { name: "Tears of Steel (Sci-Fi Cyberpunk)", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4" },
];

export default function MovieScreen({
  role,
  media,
  screenStream,
  isSharing,
  onUpdateMediaState,
  onStartScreenShare,
  onStopScreenShare,
}: MovieScreenProps) {
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);
  const streamVideoRef = useRef<HTMLVideoElement | null>(null);

  const [urlInput, setUrlInput] = useState(media.url);
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Bind screen share stream
  useEffect(() => {
    if (streamVideoRef.current && screenStream) {
      streamVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  // Synchronize playing states
  useEffect(() => {
    const video = videoPlayerRef.current;
    if (!video || isSharing || screenStream) return;

    // Only update if drift is high (> 2 seconds) or state mismatch
    if (media.playing && video.paused) {
      video.play().catch(() => {});
    } else if (!media.playing && !video.paused) {
      video.pause();
    }

    if (Math.abs(video.currentTime - media.currentTime) > 2) {
      video.currentTime = media.currentTime;
    }
  }, [media.playing, media.currentTime, isSharing, screenStream]);

  // Update loop for custom sliders
  useEffect(() => {
    const video = videoPlayerRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const onDurationChange = () => {
      setDuration(video.duration);
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
    };
  }, []);

  const handlePlayToggle = () => {
    const video = videoPlayerRef.current;
    if (!video) return;

    audioSynth.playSoftClick();

    const nextPlaying = !media.playing;
    if (nextPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }

    onUpdateMediaState({
      playing: nextPlaying,
      currentTime: video.currentTime,
      sender: role,
    });
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoPlayerRef.current;
    if (!video) return;

    const nextTime = parseFloat(e.target.value);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);

    onUpdateMediaState({
      currentTime: nextTime,
      sender: role,
    });
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVol = parseFloat(e.target.value);
    setVolume(nextVol);
    if (videoPlayerRef.current) {
      videoPlayerRef.current.volume = nextVol;
    }
    if (streamVideoRef.current) {
      streamVideoRef.current.volume = nextVol;
    }
  };

  const handleUrlLoad = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    audioSynth.playSoftClick();
    onUpdateMediaState({
      url: urlInput.trim(),
      playing: false,
      currentTime: 0,
      sender: role,
    });
  };

  const selectTrailer = (url: string) => {
    audioSynth.playSoftClick();
    setUrlInput(url);
    onUpdateMediaState({
      url,
      playing: false,
      currentTime: 0,
      sender: role,
    });
  };

  const handleFullscreen = () => {
    audioSynth.playSoftClick();
    const activeVid = screenStream ? streamVideoRef.current : videoPlayerRef.current;
    if (activeVid) {
      if (activeVid.requestFullscreen) {
        activeVid.requestFullscreen();
      }
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="flex flex-col w-full gap-5">
      {/* 1. Immersive Curved Cinema Screen Frame */}
      <div
        className="w-full relative aspect-[16/9] rounded-3xl bg-[#030305] border-2 border-white/5 shadow-2xl overflow-hidden group select-none cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Subtle dynamic background mirroring ambient light reflection glow */}
        <div className="absolute inset-0 bg-radial-glow opacity-30 pointer-events-none transition-all duration-700" />

        {/* Ambient projection bounce shadow back light */}
        <div className="absolute top-2 w-[80%] left-[10%] h-[15%] rounded-full bg-amber-500/10 filter blur-3xl group-hover:bg-[#E0B974]/15 transition-all duration-500 pointer-events-none" />

        {/* Active screensharing feed */}
        {screenStream ? (
          <video
            ref={streamVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain z-10"
          />
        ) : media.url ? (
          /* Active static player video feed */
          <video
            ref={videoPlayerRef}
            src={media.url}
            autoPlay={media.playing}
            playsInline
            onClick={handlePlayToggle}
            className="w-full h-full object-contain z-10"
          />
        ) : (
          /* Default Empty Cinema Bed (Velvet curtains) */
          <div className="w-full h-full flex flex-col items-center justify-center relative p-8">
            <div className="absolute inset-0 bg-radial-gradient from-purple-950/20 via-black to-black opacity-80" />
            
            {/* Curved Neon Neon Logo branding */}
            <div className="flex flex-col items-center gap-3 z-10 text-center animate-pulse">
              <span className="text-5xl text-[#E0B974] drop-shadow-[0_0_15px_rgba(224,185,116,0.6)] font-semibold select-none">
                🎬
              </span>
              <h2 className="text-2xl font-semibold tracking-wider font-sans text-[#E0B974] select-all">
                The Cozy Grand Screen
              </h2>
              <p className="max-w-md text-xs font-mono text-white/40 tracking-wider">
                LOAN ANY STREAM ONLINE OR CLICK WINDOW SCREEN SHARE TO LAUNCH
              </p>
            </div>
          </div>
        )}

        {/* Dynamic ambient halo ring */}
        <div className="absolute inset-x-0 bottom-0 py-6 px-10 bg-gradient-to-t from-black via-black/40 to-transparent z-20 flex flex-col gap-3 transition-opacity duration-300 opacity-0 group-hover:opacity-100"
          style={{ opacity: isHovered || !media.playing ? 1 : 0 }}
        >
          {/* Custom video controls slider toolbar */}
          {!screenStream && media.url && (
            <div className="flex items-center gap-3 w-full">
              <span className="font-mono text-[10px] text-white/70">{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 accent-[#E0B974] h-1 bg-white/20 rounded-lg cursor-pointer"
              />
              <span className="font-mono text-[10px] text-white/75">{formatTime(duration)}</span>
            </div>
          )}

          {/* Buttons panel */}
          <div className="flex items-center justify-between w-full h-8">
            <div className="flex items-center gap-4">
              {!screenStream && media.url && (
                <button
                  onClick={handlePlayToggle}
                  className="p-1.5 rounded-lg bg-[#E0B974] text-black hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  {media.playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                </button>
              )}

              {/* Volume sliders */}
              <div className="flex items-center gap-2">
                <Volume2 size={13} className="text-[#E0B974]/80" />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-16 accent-[#E0B974] h-1 bg-white/25 rounded-md cursor-pointer"
                />
              </div>

              {/* Sender label syncing badge */}
              {media.url && !screenStream && (
                <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest hidden sm:inline">
                  Last active: {media.sender === "duckie" ? "Duckie" : "Dobby"}
                </span>
              )}
            </div>

            {/* Sharing / Fullscreen controls panel */}
            <div className="flex items-center gap-3">
              {isSharing ? (
                <button
                  onClick={onStopScreenShare}
                  className="px-3 py-1 text-xs rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all font-mono uppercase tracking-wider cursor-pointer"
                >
                  Stop Sharing
                </button>
              ) : (
                <button
                  onClick={onStartScreenShare}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg border border-[#A78BFA]/30 bg-[#A78BFA]/5 text-[#A78BFA] hover:bg-[#A78BFA]/15 active:scale-95 transition-all font-mono uppercase tracking-wider cursor-pointer"
                >
                  <Monitor size={12} /> Share Screen
                </button>
              )}

              <button
                onClick={handleFullscreen}
                className="p-1.5 rounded-lg hover:bg-white/10 text-[#E0B974]/90 active:scale-90 transition-all cursor-pointer"
                title="Fullscreen cinema"
              >
                <Maximize size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Cozy Source Loaders bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-[#0F0E14] to-[#08070B] border border-white/5 shadow-lg flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-white/70 select-none">
            <Link2 size={13} className="text-[#E0B974]" /> Source Input
          </span>
          <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest select-none">
            P2P Synchronized Player
          </span>
        </div>

        {/* Input loader Form */}
        <form onSubmit={handleUrlLoad} className="flex gap-2 w-full">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste your MP4 stream URL to watch together..."
            className="flex-1 rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-[#E0B974]/50 transition-all font-sans"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#E0B974]/15 hover:bg-[#E0B974]/25 border border-[#E0B974]/30 text-[#E0B974] transition-all cursor-pointer"
          >
            Load Movie
          </button>
        </form>

        {/* Demo Streaming suggestions */}
        <div className="flex flex-wrap items-center gap-2.5 mt-1">
          <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest select-none mr-1">
            Demo Films:
          </span>
          {CINEMA_TRAILERS.map((film) => (
            <button
              key={film.url}
              onClick={() => selectTrailer(film.url)}
              type="button"
              className={`px-2.5 py-1 text-[10px] font-sans font-medium rounded-lg border transition-all duration-150 cursor-pointer ${
                media.url === film.url 
                  ? "bg-[#E0B974]/20 border-[#E0B974]/40 text-[#E0B974]" 
                  : "bg-white/3 border-white/5 text-white/40 hover:bg-white/10"
              }`}
            >
              {film.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
export { CINEMA_TRAILERS };
