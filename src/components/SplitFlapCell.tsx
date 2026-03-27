import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState, useRef } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { soundManager } from "@/src/lib/sound";
import { hapticsManager } from "@/src/lib/haptics";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?:'\"- ";
const COLORS = [
  "bg-yellow-400 text-black",
  "bg-red-500 text-white",
  "bg-purple-500 text-white",
  "bg-cyan-400 text-black",
  "bg-blue-600 text-white",
  "bg-green-500 text-white",
];

interface SplitFlapCellProps {
  key?: string | number;
  target: string;
  delay?: number;
  animationStyle?: "subtle" | "normal" | "dramatic";
  size?: "sm" | "md" | "lg";
}

export default function SplitFlapCell({ target, delay = 0, animationStyle = "normal", size = "md" }: SplitFlapCellProps) {
  const [currentChar, setCurrentChar] = useState(" ");
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentColor, setCurrentColor] = useState("bg-zinc-900 text-white");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationIdRef = useRef(0);

  const sizeClasses = {
    sm: "w-6 h-9 text-lg sm:w-8 sm:h-12 sm:text-2xl",
    md: "w-8 h-12 sm:w-10 sm:h-14 md:w-12 md:h-18 lg:w-14 lg:h-20 text-2xl sm:text-3xl md:text-4xl lg:text-5xl",
    lg: "w-10 h-15 sm:w-14 sm:h-20 md:w-18 md:h-24 lg:w-22 lg:h-30 text-3xl sm:text-5xl md:text-6xl lg:text-7xl",
  };

  useEffect(() => {
    // If target is already reached and we aren't animating, do nothing
    if (target === currentChar && !isAnimating) return;

    const currentAnimId = ++animationIdRef.current;

    const startAnimation = () => {
      if (currentAnimId !== animationIdRef.current) return;

      setIsAnimating(true);
      let steps = animationStyle === "subtle" ? 5 : animationStyle === "dramatic" ? 15 : 10;
      let currentStep = 0;

      const animate = () => {
        // Guard against stale animation loops from older transitions
        if (currentAnimId !== animationIdRef.current) return;

        if (currentStep < steps) {
          const randomChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
          const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
          
          setCurrentChar(randomChar);
          setCurrentColor(randomColor);
          soundManager.playClick();
          hapticsManager.vibrate();

          currentStep++;
          timeoutRef.current = setTimeout(animate, 50 + Math.random() * 50);
        } else {
          // Final settle to target character
          setCurrentChar(target);
          setCurrentColor("bg-zinc-900 text-white");
          setIsAnimating(false);
          soundManager.playClick();
          hapticsManager.vibrate();
        }
      };

      animate();
    };

    const initialDelayTimeout = setTimeout(startAnimation, delay);

    // Watchdog: Force reset after 5 seconds if still animating or stuck in colored state
    const watchdogTimeout = setTimeout(() => {
      if (currentAnimId === animationIdRef.current) {
        setCurrentChar(target);
        setCurrentColor("bg-zinc-900 text-white");
        setIsAnimating(false);
      }
    }, 5000 + delay);

    return () => {
      clearTimeout(initialDelayTimeout);
      clearTimeout(watchdogTimeout);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [target, animationStyle, delay]);

  return (
    <div className={cn(
      "relative bg-zinc-950 rounded-sm overflow-hidden shadow-inner border border-zinc-800 flex items-center justify-center font-mono font-bold select-none",
      sizeClasses[size]
    )}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentChar + currentColor}
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 90, opacity: 0 }}
          transition={{ duration: 0.05, ease: "easeInOut" }}
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-colors duration-75",
            currentColor
          )}
        >
          {currentChar}
        </motion.div>
      </AnimatePresence>
      
      {/* Split line */}
      <div className="absolute inset-x-0 top-1/2 h-[1px] bg-black/40 z-10" />
      
      {/* Depth shadows */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/20 via-transparent to-black/40" />
    </div>
  );
}
