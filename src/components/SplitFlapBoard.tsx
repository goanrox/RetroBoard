import SplitFlapCell from "./SplitFlapCell";
import { formatTextToBoard } from "@/src/lib/layout";
import { useEffect, useState, useRef, useCallback, useMemo, useLayoutEffect } from "react";

interface SplitFlapBoardProps {
  text: string;
  version?: number;
  rows?: number;
  cols?: number;
  animationStyle?: "subtle" | "normal" | "dramatic";
  size?: "sm" | "md" | "lg";
  suppressAnimation?: boolean;
  onTransitionStart?: () => void;
  onTransitionEnd?: () => void;
}

export default function SplitFlapBoard({ 
  text, 
  version = 0,
  rows = 4, 
  cols = 22, 
  animationStyle = "normal", 
  size = "md", 
  suppressAnimation = false,
  onTransitionStart,
  onTransitionEnd
}: SplitFlapBoardProps) {
  // Synchronously derive formatted rows to prevent one-render desync with version
  const formattedRows = useMemo(() => formatTextToBoard(text, rows, cols), [text, rows, cols]);
  
  const completedCountRef = useRef(0);
  const totalCells = rows * cols;
  const currentVersionRef = useRef(version);
  const hasEndedRef = useRef(false);
  const onTransitionStartRef = useRef(onTransitionStart);
  const onTransitionEndRef = useRef(onTransitionEnd);

  useEffect(() => {
    onTransitionStartRef.current = onTransitionStart;
  });
  useEffect(() => {
    onTransitionEndRef.current = onTransitionEnd;
  });

  const handleCellComplete = useCallback(() => {
    completedCountRef.current++;
    if (completedCountRef.current >= totalCells && !hasEndedRef.current) {
      hasEndedRef.current = true;
      console.log(`[Board] All cells complete. Version: ${currentVersionRef.current}`);
      onTransitionEndRef.current?.();
    }
  }, [totalCells]);

  useEffect(() => {
    if (!suppressAnimation) {
      // Synchronous reset before children can report completion for the new version
      currentVersionRef.current = version;
      completedCountRef.current = 0;
      hasEndedRef.current = false;
      console.log(`[Board] Transition started. Session: ${version}`);
      onTransitionStartRef.current?.();

      // Board-level watchdog: Force completion if cells take too long
      const maxDelay = (rows * cols) * 10;
      const steps = animationStyle === "subtle" ? 5 : animationStyle === "dramatic" ? 15 : 10;
      const animDuration = steps * 100;
      const totalDuration = maxDelay + animDuration + 2000; // 2s safety buffer

      const watchdog = setTimeout(() => {
        if (!hasEndedRef.current && currentVersionRef.current === version) {
          console.warn(`[Board] Watchdog triggered for session ${version}. Completed: ${completedCountRef.current}/${totalCells}`);
          hasEndedRef.current = true;
          onTransitionEndRef.current?.();
        }
      }, totalDuration);

      return () => clearTimeout(watchdog);
    } else {
      onTransitionStartRef.current?.();
      onTransitionEndRef.current?.();
    }
  }, [version, rows, cols, animationStyle, suppressAnimation, totalCells]);

  return (
    <div className="relative p-4 sm:p-6 md:p-8 lg:p-10 bg-zinc-950 rounded-xl shadow-2xl border border-zinc-800 flex flex-col gap-1 sm:gap-2 md:gap-3 lg:gap-4 items-center justify-center">
      {/* LED Indicators */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col gap-4">
        <div className="w-1 h-1 rounded-full bg-red-500/50 animate-pulse" />
        <div className="w-1 h-1 rounded-full bg-red-500/50 animate-pulse delay-75" />
      </div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-4">
        <div className="w-1 h-1 rounded-full bg-red-500/50 animate-pulse delay-150" />
        <div className="w-1 h-1 rounded-full bg-red-500/50 animate-pulse delay-200" />
      </div>

      {formattedRows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-0.5 sm:gap-1 md:gap-1.5 lg:gap-2">
          {row.split("").map((char, colIndex) => (
            <SplitFlapCell
              key={`${rowIndex}-${colIndex}`}
              target={char}
              delay={(rowIndex * cols + colIndex) * 10} // Staggered delay
              animationStyle={animationStyle}
              size={size}
              suppressAnimation={suppressAnimation}
              version={version}
              onComplete={handleCellComplete}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
