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
  suppressAnimation?: boolean;
  version?: number;
  onComplete?: () => void;
}

export default function SplitFlapCell({ 
  target, 
  delay = 0, 
  animationStyle = "normal", 
  size = "md", 
  suppressAnimation = false,
  version = 0,
  onComplete
}: SplitFlapCellProps) {
  const [currentChar, setCurrentChar] = useState(target);
  const [currentColor, setCurrentColor] = useState("bg-zinc-900 text-white");

  const onCompleteRef = useRef(onComplete);
  const reportedVersionRef = useRef(-1);
  const watchdogRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationIdRef = useRef(0);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    animationIdRef.current++;
    const myAnimId = animationIdRef.current;
    const myVersion = version;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (watchdogRef.current) clearTimeout(watchdogRef.current);

    const settle = () => {
      setCurrentChar(target);
      setCurrentColor("bg-zinc-900 text-white");
      if (reportedVersionRef.current !== myVersion) {
        reportedVersionRef.current = myVersion;
        onCompleteRef.current?.();
      }
    };

    if (suppressAnimation) {
      settle();
      return;
    }

    const steps = animationStyle === "subtle" ? 5 : animationStyle === "dramatic" ? 15 : 10;

    const runAnimation = (step: number) => {
      if (myAnimId !== animationIdRef.current) return;

      if (step < steps) {
        const randomChar = CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)];
        const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
        setCurrentChar(randomChar);
        setCurrentColor(randomColor);
        soundManager.playClick();
        hapticsManager.vibrate();
        timeoutRef.current = setTimeout(() => runAnimation(step + 1), 50 + Math.random() * 50);
      } else {
        soundManager.playClick();
        hapticsManager.vibrate();
        settle();
      }
    };

    timeoutRef.current = setTimeout(() => runAnimation(0), delay);

    const maxDuration = delay + steps * 120 + 2000;
    watchdogRef.current = setTimeout(() => {
      if (myAnimId === animationIdRef.current) {
        console.log(`[Cell] Watchdog triggered for version ${myVersion}`);
        settle();
      }
    }, maxDuration);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
    };
  }, [version, suppressAnimation, animationStyle, delay, target]);

  useEffect(() => {
    if (suppressAnimation) {
      setCurrentChar(target);
      setCurrentColor("bg-zinc-900 text-white");
    }
  }, [target, suppressAnimation]);

  const sizeClasses = {
    sm: "w-6 h-9 text-lg sm:w-8 sm:h-12 sm:text-2xl",
    md: "w-8 h-12 sm:w-10 sm:h-14 md:w-12 md:h-18 lg:w-14 lg:h-20 text-2xl sm:text-3xl md:text-4xl lg:text-5xl",
    lg: "w-10 h-15 sm:w-14 sm:h-20 md:w-18 md:h-24 lg:w-22 lg:h-30 text-3xl sm:text-5xl md:text-6xl lg:text-7xl",
  };

  return (
    <div className={cn(
      "relative bg-zinc-950 rounded-sm overflow-hidden shadow-inner border border-zinc-800 flex items-center justify-center font-mono font-bold select-none",
      sizeClasses[size]
    )}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={currentChar + currentColor}
          initial={suppressAnimation ? false : { rotateX: -90, opacity: 0 }}
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
