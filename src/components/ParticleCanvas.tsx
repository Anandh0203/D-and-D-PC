import React, { useEffect, useRef } from "react";
import { Particle } from "@/src/types";

interface ParticleCanvasProps {
  activityDuckie: number; // 0 to 1 indicating movement intensity
  activityDobby: number;  // 0 to 1 indicating movement intensity
}

export default function ParticleCanvas({ activityDuckie, activityDobby }: ParticleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number | null>(null);

  // Spawns localized particles
  const spawnSplash = (x: number, y: number, color: string, emoji?: string, count: number = 15) => {
    const list: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2 + 1;
      list.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (emoji ? 1 : 0), // float up slightly
        size: Math.random() * 4 + 2,
        alpha: 1,
        color,
        life: 0,
        maxLife: Math.random() * 60 + 40,
        emoji,
      });
    }
    particlesRef.current = [...particlesRef.current, ...list];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    // Constant background starry dust flow
    const fillStarryStars = () => {
      if (particlesRef.current.length < 60) {
        particlesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.2,
          vy: -Math.random() * 0.3 - 0.1, // gently floating upwards
          size: Math.random() * 2 + 0.5,
          alpha: Math.random() * 0.5 + 0.2,
          color: "rgba(224, 185, 116, 0.4)", // vintage gold dust
          life: 0,
          maxLife: Math.random() * 200 + 100,
        });
      }
    };

    // Draw & Update loop
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      fillStarryStars();

      // Draw background ambient nebulae glow (extremely soft purple & teal)
      const grad = ctx.createRadialGradient(
        canvas.width * 0.3, canvas.height * 0.2, 50,
        canvas.width * 0.3, canvas.height * 0.2, canvas.width * 0.6
      );
      grad.addColorStop(0, "rgba(59, 13, 105, 0.08)"); // Soft purple glow
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const grad2 = ctx.createRadialGradient(
        canvas.width * 0.8, canvas.height * 0.7, 50,
        canvas.width * 0.8, canvas.height * 0.7, canvas.width * 0.5
      );
      grad2.addColorStop(0, "rgba(212, 175, 55, 0.03)"); // Gold shimmer
      grad2.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render & Update particles
      particlesRef.current.forEach((p, idx) => {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;

        // Apply slight drag and floatation
        p.vx *= 0.98;
        p.vy *= 0.98;

        // Life decay alpha
        p.alpha = 1 - p.life / p.maxLife;

        if (p.emoji) {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          // Scale size slowly
          const size = p.size * 5 + 12;
          ctx.font = `${size}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          // Draw subtle golden shadow behind emojis
          ctx.shadowBlur = 8;
          ctx.shadowColor = "rgba(212, 175, 55, 0.4)";
          ctx.fillText(p.emoji, p.x, p.y);
          ctx.restore();
        } else {
          // Normal starry particle
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          // Add starlight glow
          ctx.shadowBlur = p.size * 3;
          ctx.shadowColor = p.color;
          ctx.fill();
          ctx.restore();
        }
      });

      // Filter out dead particles
      particlesRef.current = particlesRef.current.filter(
        (p) => p.life < p.maxLife && p.x >= 0 && p.x <= canvas.width && p.y >= 0 && p.y <= canvas.height
      );

      animationRef.current = requestAnimationFrame(loop);
    };

    loop();

    // Listen to custom emoji spawn events
    const handleSpawnEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ sender: "duckie" | "dobby"; emoji: string }>;
      const { sender, emoji } = customEvent.detail;
      
      // Calculate origin based on standard seat positions
      // Left side is Duckie's camera, Right side is Dobby's camera
      const startX = sender === "duckie" ? window.innerWidth * 0.15 : window.innerWidth * 0.85;
      const startY = window.innerHeight * 0.75;
      
      const emojiColor = sender === "duckie" ? "#E0B974" : "#A78BFA";
      spawnSplash(startX, startY, emojiColor, emoji, 12);
    };

    window.addEventListener("spawn-particles", handleSpawnEvent);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("spawn-particles", handleSpawnEvent);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // React to webcam activities
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Trigger golden micro-bursts from Duckie side (left)
    if (activityDuckie > 0.15) {
      const count = Math.ceil(activityDuckie * 5);
      const x = canvas.width * 0.15;
      const y = canvas.height * 0.75;
      const burstList: Particle[] = [];
      for (let i = 0; i < count; i++) {
        burstList.push({
          x: x + (Math.random() - 0.5) * 80,
          y: y + (Math.random() - 0.5) * 60,
          vx: (Math.random() - 0.5) * 0.8,
          vy: -Math.random() * 1.5 - 0.5,
          size: Math.random() * 3 + 1,
          alpha: 1,
          color: "rgba(224, 185, 116, 0.85)", // Duckie gold light
          life: 0,
          maxLife: Math.random() * 40 + 20,
        });
      }
      particlesRef.current = [...particlesRef.current, ...burstList];
    }
  }, [activityDuckie]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Trigger violet/gold micro-bursts from Dobby side (right)
    if (activityDobby > 0.15) {
      const count = Math.ceil(activityDobby * 5);
      const x = canvas.width * 0.85;
      const y = canvas.height * 0.75;
      const burstList: Particle[] = [];
      for (let i = 0; i < count; i++) {
        burstList.push({
          x: x + (Math.random() - 0.5) * 80,
          y: y + (Math.random() - 0.5) * 60,
          vx: (Math.random() - 0.5) * 0.8,
          vy: -Math.random() * 1.5 - 0.5,
          size: Math.random() * 3 + 1,
          alpha: 1,
          color: "rgba(167, 139, 250, 0.85)", // Dobby violet light
          life: 0,
          maxLife: Math.random() * 40 + 20,
        });
      }
      particlesRef.current = [...particlesRef.current, ...burstList];
    }
  }, [activityDobby]);

  // Click on background canvas spawns glowing sparkles
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    spawnSplash(e.clientX, e.clientY, "rgba(212, 175, 55, 0.9)", undefined, 18);
  };

  return (
    <canvas
      ref={canvasRef}
      id="bg-particles-canvas"
      onClick={handleCanvasClick}
      className="absolute inset-0 block w-full h-full pointer-events-auto z-0 cursor-crosshair"
    />
  );
}
