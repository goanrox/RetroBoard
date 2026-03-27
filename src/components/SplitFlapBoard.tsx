import SplitFlapCell from "./SplitFlapCell";
import { formatTextToBoard } from "@/src/lib/layout";
import { useEffect, useState } from "react";

interface SplitFlapBoardProps {
  text: string;
  rows?: number;
  cols?: number;
  animationStyle?: "subtle" | "normal" | "dramatic";
  size?: "sm" | "md" | "lg";
}

export default function SplitFlapBoard({ text, rows = 4, cols = 22, animationStyle = "normal", size = "md" }: SplitFlapBoardProps) {
  const [formattedRows, setFormattedRows] = useState<string[]>(Array(rows).fill(" ".repeat(cols)));

  useEffect(() => {
    const newRows = formatTextToBoard(text, rows, cols);
    setFormattedRows(newRows);
  }, [text, rows, cols]);

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
            />
          ))}
        </div>
      ))}
    </div>
  );
}
