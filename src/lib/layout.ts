/**
 * Formats text into a visually balanced split-flap board composition.
 */
export function formatTextToBoard(text: string, rows: number, cols: number): string[] {
  const cleanText = text.toUpperCase().trim();
  let lines: string[] = [];

  // 1. Determine Layout Mode
  if (isWeatherInfo(cleanText)) {
    lines = formatWeatherMode(cleanText, rows, cols);
  } else if (isShortPhrase(cleanText)) {
    lines = formatHeroMode(cleanText, rows, cols);
  } else if (isHeadline(cleanText)) {
    lines = formatHeadlineMode(cleanText, rows, cols);
  } else {
    lines = formatBalancedMode(cleanText, rows, cols);
  }

  // 2. Vertical Centering
  const result: string[] = Array(rows).fill(" ".repeat(cols));
  const startRow = Math.max(0, Math.floor((rows - lines.length) / 2));

  lines.forEach((line, index) => {
    if (startRow + index < rows) {
      // Horizontal Centering
      const trimmedLine = line.trim().slice(0, cols);
      const padding = Math.max(0, Math.floor((cols - trimmedLine.length) / 2));
      result[startRow + index] = trimmedLine.padStart(trimmedLine.length + padding).padEnd(cols);
    }
  });

  return result;
}

/**
 * Detects if the text is a weather/info string (e.g., "LONDON: 12°C CLOUDY")
 */
function isWeatherInfo(text: string): boolean {
  return text.includes(":") || text.includes("°C") || text.includes("°F");
}

/**
 * Detects if the text is a short phrase (3 words or less)
 */
function isShortPhrase(text: string): boolean {
  const words = text.split(/\s+/);
  return words.length <= 4 && text.length < 25;
}

/**
 * Detects if the text is a headline (longer, specific structure)
 */
function isHeadline(text: string): boolean {
  return text.length > 30 && text.length < 60 && !text.includes(":");
}

/**
 * Weather Mode: Splits weather data into logical, cinematic rows
 */
function formatWeatherMode(text: string, rows: number, cols: number): string[] {
  // Example: "LONDON: 12°C CLOUDY"
  const parts = text.split(/[:\s]+/);
  const lines: string[] = [];
  
  if (parts.length >= 3) {
    lines.push(parts[0]); // City (Top row, bold feel)
    lines.push(""); // Spacer
    lines.push(`${parts[1]} ${parts.slice(2).join(" ")}`); // Temp + Condition
    
    // Add a mock update time for premium feel
    const now = new Date();
    const timeStr = `UPDATED ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    if (lines.length < rows - 1) {
      lines.push(""); // Spacer
      lines.push(timeStr);
    }
  } else {
    return formatBalancedMode(text, rows, cols);
  }

  return lines.filter(l => l !== null).slice(0, rows);
}

/**
 * Headline Mode: Editorial layout using more rows and balanced wrapping
 */
function formatHeadlineMode(text: string, rows: number, cols: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  // For headlines, we want a more "spread out" feel if possible
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    // Aim for shorter lines in headline mode for editorial feel
    if (testLine.length <= Math.floor(cols * 0.85)) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Add spacers if we have room to make it feel "editorial"
  if (lines.length > 1 && lines.length * 2 - 1 <= rows) {
    const spacedLines: string[] = [];
    lines.forEach((line, i) => {
      spacedLines.push(line);
      if (i < lines.length - 1) spacedLines.push(""); 
    });
    return spacedLines;
  }

  return lines;
}

/**
 * Hero Mode: Dramatic vertical distribution for short phrases
 */
function formatHeroMode(text: string, rows: number, cols: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];

  if (words.length === 1) {
    lines.push(words[0]);
  } else if (words.length <= rows) {
    // One word per line if it fits vertically
    words.forEach(w => lines.push(w));
  } else {
    // Group words to fit
    return formatBalancedMode(text, rows, cols);
  }

  return lines;
}

/**
 * Balanced Mode: Intelligent wrapping with vertical centering for quotes
 */
function formatBalancedMode(text: string, rows: number, cols: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    // If word itself is longer than cols, split it
    if (word.length > cols) {
      if (currentLine) lines.push(currentLine);
      let remaining = word;
      while (remaining.length > 0) {
        lines.push(remaining.slice(0, cols));
        remaining = remaining.slice(cols);
      }
      currentLine = "";
      continue;
    }

    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= cols) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  // If we have very few lines, try to add spacers between them for "Balanced" feel
  if (lines.length > 1 && lines.length * 2 - 1 <= rows && text.length < 50) {
    const spacedLines: string[] = [];
    lines.forEach((line, i) => {
      spacedLines.push(line);
      if (i < lines.length - 1) spacedLines.push(""); // Add empty row between
    });
    return spacedLines;
  }

  return lines;
}
