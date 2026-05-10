import React, { useRef, useEffect } from "react";
import { motion } from "motion/react";

type VisualizerState = "idle" | "listening" | "processing" | "speaking" | "error";

interface VisualizerProps {
  state: VisualizerState;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  ox: number; 
  oy: number;
  oz: number;
}

export default function Visualizer({ state }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const lerpMouse = useRef({ x: 0, y: 0 });
  const smoothedIntensities = useRef({ shake: 0, pulse: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;
    const particleCount = 350; 
    const particles: Particle[] = [];
    const baseRadius = Math.min(window.innerWidth, window.innerHeight) * 0.42;

    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      const phi = Math.acos(-1 + (2 * i) / particleCount);
      const theta = Math.sqrt(particleCount * Math.PI) * phi;
      const x = baseRadius * Math.sin(phi) * Math.cos(theta);
      const y = baseRadius * Math.sin(phi) * Math.sin(theta);
      const z = baseRadius * Math.cos(phi);
      particles.push({ x, y, z, ox: x, oy: y, oz: z });
    }

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };
    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    resize();

    // Lerp helper
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const draw = () => {
      time += 0.004;
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Smooth mouse coordinates - Increased lerp for snappier feel
      if (mouseRef.current.active) {
        lerpMouse.current.x = lerp(lerpMouse.current.x, mouseRef.current.x, 0.25);
        lerpMouse.current.y = lerp(lerpMouse.current.y, mouseRef.current.y, 0.25);
      }

      // Smooth state transitions - Increased factors for less floatiness
      let targetShake = 0;
      let targetPulse = 1;

      if (state === "listening") {
        targetShake = 2;
        targetPulse = 1 + Math.sin(time * 8) * 0.03;
      } else if (state === "speaking") {
        targetShake = 4;
        targetPulse = 1 + Math.sin(time * 12) * 0.08;
      } else if (state === "processing") {
        targetPulse = 1 + Math.sin(time * 4) * 0.02;
      }

      smoothedIntensities.current.shake = lerp(smoothedIntensities.current.shake, targetShake, 0.15);
      smoothedIntensities.current.pulse = lerp(smoothedIntensities.current.pulse, targetPulse, 0.15);

      const rotY = time * 0.3;
      const rotX = time * 0.15;
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      const projected: { x: number; y: number; z: number; opacity: number; color: string }[] = [];

      particles.forEach((p, idx) => {
        let x = p.ox * cosY - p.oz * sinY;
        let z = p.ox * sinY + p.oz * cosY;
        let y = p.oy * cosX - z * sinX;
        z = p.oy * sinX + z * cosX;

        // Apply smooth scale
        x *= smoothedIntensities.current.pulse;
        y *= smoothedIntensities.current.pulse;
        z *= smoothedIntensities.current.pulse;
        
        // Organic organic vibration instead of random jitter
        if (smoothedIntensities.current.shake > 0) {
          const vibeX = Math.sin(time * 40 + idx) * smoothedIntensities.current.shake;
          const vibeY = Math.cos(time * 40 + idx) * smoothedIntensities.current.shake;
          x += vibeX;
          y += vibeY;
        }

        // Voice vibration effect
        if (state === "speaking") {
          const wave = Math.sin(y * 0.04 + time * 12) * 15; 
          x += wave;
          z += wave;
        } else if (state === "listening") {
           const ripple = Math.sin(Math.sqrt(x*x + y*y) * 0.02 - time * 8) * 8;
           x += (x / baseRadius) * ripple;
           y += (y / baseRadius) * ripple;
        }

        const perspective = 1000;
        const scale = perspective / (perspective + z);
        const px = centerX + x * scale;
        const py = centerY + y * scale;

        // Magnetic Mouse Interaction using smooth coords
        let nodeColor = "34, 211, 238"; 
        if (mouseRef.current.active) {
          const dx = lerpMouse.current.x - px;
          const dy = lerpMouse.current.y - py;
          const distMouse = Math.sqrt(dx * dx + dy * dy);
          if (distMouse < 500) {
            const force = (500 - distMouse) / 500;
            x += (dx / distMouse) * force * 150; 
            y += (dy / distMouse) * force * 150;
            
            if (distMouse < 150) {
              nodeColor = "255, 255, 255"; 
            }
          }
        }

        const rawOpacity = (z + baseRadius) / (baseRadius * 2);
        projected.push({
          x: px,
          y: py,
          z: z,
          opacity: Math.max(0, Math.min(1, rawOpacity)),
          color: nodeColor
        });
      });

      // Draw Plexus Connections
      ctx.lineWidth = 0.8;
      const isSpeaking = state === "speaking";

      for (let i = 0; i < projected.length; i++) {
        const p1 = projected[i];
        
        // Mouse to Node connection (Magnetic energy)
        if (mouseRef.current.active) {
          const mdx = lerpMouse.current.x - p1.x;
          const mdy = lerpMouse.current.y - p1.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist < 250) {
            const alpha = (1 - mdist / 250) * p1.opacity * 0.5;
            ctx.strokeStyle = `rgba(${p1.color}, ${alpha})`;
            ctx.setLineDash(isSpeaking && Math.random() > 0.5 ? [2, 2] : []);
            ctx.beginPath();
            ctx.moveTo(lerpMouse.current.x, lerpMouse.current.y);
            ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
          }
        }

        for (let j = i + 1; j < projected.length; j++) {
          const p2 = projected[j];
          const distSq = (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2;

          if (distSq < (isSpeaking ? 18000 : 15000)) { 
            const dist = Math.sqrt(distSq);
            const alpha = (1 - dist / (isSpeaking ? 135 : 120)) * p1.opacity * p2.opacity * (isSpeaking ? 0.8 : 0.6);
            ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
            ctx.setLineDash(isSpeaking && Math.random() > 0.9 ? [5, 2] : []);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
      ctx.setLineDash([]);

      // Draw Nodes
      projected.forEach((p) => {
        // Mouse proximity for local animation
        let mouseInfluence = 0;
        if (mouseRef.current.active) {
          const dx = lerpMouse.current.x - p.x;
          const dy = lerpMouse.current.y - p.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 200) {
            mouseInfluence = (1 - d / 200);
          }
        }

        const radius = Math.max(0, (2 + mouseInfluence * 3) * p.opacity);
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        
        const isHighlyVisible = p.opacity > 0.6 || mouseInfluence > 0.3;
        
        if (isHighlyVisible) {
          ctx.shadowBlur = (10 + mouseInfluence * 20) * p.opacity;
          ctx.shadowColor = `rgb(${p.color})`;
        } else {
          ctx.shadowBlur = 0;
        }
        
        const coreAlpha = Math.min(1, (p.opacity * 0.8) + (mouseInfluence * 0.5));
        ctx.fillStyle = `rgba(${p.color}, ${coreAlpha})`;
        ctx.fill();
      });
      ctx.shadowBlur = 0;

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [state]);

  const getOrbStateStyles = () => {
    switch (state) {
      case "listening": return "shadow-[0_0_150px_rgba(34,211,238,0.4)] border-cyan-400/20";
      case "speaking": return "shadow-[0_0_200px_rgba(34,211,238,0.6)] border-cyan-300/30";
      case "processing": return "shadow-[0_0_100px_rgba(139,92,246,0.3)] border-violet-500/20 animate-pulse";
      case "error": return "shadow-[0_0_100px_rgba(239,68,68,0.4)] border-red-500/20";
      default: return "shadow-[0_0_50px_rgba(34,211,238,0.1)] border-white/5";
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 bg-black overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      {/* Central Identity Focus (Much subtler and integrated) */}
      <motion.div
        animate={{
          opacity: state === "idle" ? 0.3 : 0.8,
        }}
        transition={{ duration: 1 }}
        className={`relative w-80 h-80 rounded-full flex items-center justify-center overflow-hidden border transition-all duration-1000 ${getOrbStateStyles()}`}
      >
        {/* Artifact Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center brightness-150 contrast-125 opacity-20 mix-blend-screen scale-150 rotate-[-15deg]"
          style={{ backgroundImage: `url('/artifact_image_0.png')` }}
        />
        
        <div className="absolute inset-0 bg-gradient-radial from-cyan-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 rounded-full border border-white/5 bg-white/5 backdrop-blur-[2px]" />
      </motion.div>

      {/* Atmospheric Floor Light */}
      <div className="absolute bottom-[-40%] w-[200%] h-[80%] bg-gradient-to-t from-cyan-500/10 to-transparent blur-[200px] -z-10" />
    </div>
  );
}
