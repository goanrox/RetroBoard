import { useEffect, useState, useCallback, useRef } from "react";
import SplitFlapBoard from "./components/SplitFlapBoard";
import SettingsDrawer from "./components/SettingsDrawer";
import { QUOTES, WEATHER, HEADLINES, CUSTOM_MESSAGES, CURATED_QUOTES } from "./lib/content";
import { soundManager } from "./lib/sound";
import { hapticsManager } from "./lib/haptics";
import { motion, AnimatePresence } from "motion/react";

const STORAGE_KEY = "retroboard_settings";

const DEFAULT_SETTINGS = {
  interval: 15,
  contentToggles: {
    quotes: true,
    weather: true,
    headlines: true,
    calendar: false,
    custom: true,
  },
  weatherLocationInput: "LONDON",
  weatherUseCurrentLocation: false,
  temperatureUnit: "C" as "C" | "F",
  selectedNewsCategories: ["world"],
  favoriteQuotePerson: "",
  quoteSource: "mixed-favorites" as string,
  calendarPreference: "next" as "next" | "today" | "tomorrow",
  calendarFeedUrl: "",
  calendarFeedValid: false,
  sound: true,
  haptics: true,
  animationStyle: "normal" as const,
  orientation: "landscape" as "landscape" | "portrait",
  isPaused: false,
};

export default function App() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [currentText, setCurrentText] = useState("WELCOME TO RETROBOARD");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings({
          ...DEFAULT_SETTINGS,
          ...parsed,
          contentToggles: {
            ...DEFAULT_SETTINGS.contentToggles,
            ...(parsed.contentToggles || {})
          }
        });
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      soundManager.setEnabled(settings.sound);
      hapticsManager.setEnabled(settings.haptics);
    }
  }, [settings, isLoaded]);

  const getNextContent = useCallback(async (forcedType?: string, shouldRefresh: boolean = false) => {
    const activeTypes: string[] = [];
    if (settings.contentToggles.quotes) activeTypes.push("quote");
    if (settings.contentToggles.weather) activeTypes.push("weather");
    if (settings.contentToggles.headlines) activeTypes.push("news");
    if (settings.contentToggles.calendar && settings.calendarFeedUrl && settings.calendarFeedValid) activeTypes.push("calendar");
    if (settings.contentToggles.custom) activeTypes.push("custom");

    if (activeTypes.length === 0) return "SELECT CONTENT SOURCE";
    
    // Pick a random type or use forced type
    const type = forcedType || activeTypes[Math.floor(Math.random() * activeTypes.length)];

    try {
      if (type === "custom") {
        const pool = CUSTOM_MESSAGES;
        let next = pool[Math.floor(Math.random() * pool.length)];
        while (next === currentText && pool.length > 1) {
          next = pool[Math.floor(Math.random() * pool.length)];
        }
        return next;
      }

      let url = `/api/${type}`;
      if (type === "weather") {
        const unitParam = `&unit=${settings.temperatureUnit}`;
        if (settings.weatherUseCurrentLocation) {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          url += `?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}${unitParam}`;
        } else {
          url += `?q=${encodeURIComponent(settings.weatherLocationInput)}${unitParam}`;
        }
      } else if (type === "news") {
        const category = settings.selectedNewsCategories[0] || "world";
        url += `?category=${category}`;
        if (shouldRefresh) {
          url += `&refresh=true&t=${Date.now()}`;
        }


      } else if (type === "quote") {
        const source = settings.quoteSource || "mixed-favorites";
        
        if (source === "mixed-favorites") {
          const authors = Object.keys(CURATED_QUOTES);
          const randomAuthor = authors[Math.floor(Math.random() * authors.length)];
          const pool = CURATED_QUOTES[randomAuthor];
          const quote = pool[Math.floor(Math.random() * pool.length)];
          return `${quote.text} — ${quote.author}`.toUpperCase();
        } else if (CURATED_QUOTES[source]) {
          const pool = CURATED_QUOTES[source];
          const quote = pool[Math.floor(Math.random() * pool.length)];
          return `${quote.text} — ${quote.author}`.toUpperCase();
        } else {
          // Fallback to random API if somehow source is invalid or for generic quotes
          const response = await fetch("/api/quote");
          const data = await response.json();
          if (data.lines && data.lines.length > 0) {
            return data.lines.join(" ");
          }
          throw new Error("No quote data");
        }
      } else if (type === "calendar") {
        url += `?preference=${settings.calendarPreference}`;
        if (settings.calendarFeedUrl) {
          url += `&url=${encodeURIComponent(settings.calendarFeedUrl)}`;
        }
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.lines && data.lines.length > 0) {
        // For news/calendar, we might get multiple lines, pick one randomly or join
        if (type === "news") {
          return data.lines[Math.floor(Math.random() * data.lines.length)];
        }
        if (type === "calendar") {
          // Join with space, but maybe just first 2 lines for better fit?
          return data.lines.slice(0, 3).join(" ");
        }
        // For weather/quote, they usually return a specific format
        return data.lines.join(" ");
      }
      
      throw new Error("No data from API");
    } catch (error) {
      console.error(`Error fetching ${type}: [REDACTED]`);
      // Fallback to local mock data
      const fallbacks: Record<string, string[]> = {
        quote: QUOTES,
        weather: WEATHER,
        news: HEADLINES,
        calendar: ["NO UPCOMING", "EVENTS TODAY"],
        custom: CUSTOM_MESSAGES
      };
      const pool = fallbacks[type] || CUSTOM_MESSAGES;
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }, [settings, currentText]);

  const rotateContent = useCallback(async (forcedType?: string, shouldRefresh: boolean = false) => {
    if (settings.isPaused && !forcedType) return;
    const next = await getNextContent(forcedType, shouldRefresh);
    setCurrentText(next);
  }, [getNextContent, settings.isPaused]);

  // Handle orientation lock in fullscreen
  useEffect(() => {
    const orientationAPI = (screen as any).orientation;
    if (isFullscreen && orientationAPI && orientationAPI.lock) {
      const orientation = settings.orientation === "landscape" ? "landscape" : "portrait";
      orientationAPI.lock(orientation).catch((err: any) => {
        console.warn("Orientation lock failed:", err);
      });
    }
  }, [isFullscreen, settings.orientation]);

  // Trigger immediate refresh when critical settings change
  useEffect(() => {
    if (isLoaded && !settings.isPaused) {
      rotateContent("weather");
    }
  }, [settings.weatherLocationInput, settings.weatherUseCurrentLocation, settings.temperatureUnit]);

  useEffect(() => {
    if (isLoaded && !settings.isPaused) {
      rotateContent("news", true);
    }
  }, [settings.selectedNewsCategories]);

  useEffect(() => {
    if (isLoaded && !settings.isPaused) {
      rotateContent("quote");
    }
  }, [settings.quoteSource]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    if (!settings.isPaused) {
      timerRef.current = setInterval(rotateContent, settings.interval * 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [rotateContent, settings.interval, settings.isPaused]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => {
        console.error(`Error attempting to enable full-screen mode: ${e.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  if (!isLoaded) return null;

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white selection:text-black flex flex-col items-center justify-center p-4 sm:p-8 overflow-hidden font-sans">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-zinc-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-zinc-900/20 blur-[120px] rounded-full" />
      </div>

      <main className="relative z-10 w-full max-w-7xl flex flex-col items-center gap-12">
        {/* Header - Minimal & Premium */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-2"
        >
          <h1 className="text-xs uppercase tracking-[0.4em] font-bold text-zinc-500">RetroBoard</h1>
          <div className="h-[1px] w-8 bg-zinc-800" />
        </motion.header>

        {/* The Board */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="w-full flex justify-center"
        >
          <SplitFlapBoard 
            text={currentText} 
            rows={settings.orientation === "landscape" ? 6 : 10}
            cols={settings.orientation === "landscape" ? 22 : 10}
            animationStyle={settings.animationStyle}
            size={settings.orientation === "landscape" ? "md" : "sm"}
          />
        </motion.div>

        {/* Footer Info */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="flex items-center gap-6 text-[10px] uppercase tracking-widest font-bold text-zinc-600">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${settings.isPaused ? "bg-zinc-800" : "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"}`} />
              <span>{settings.isPaused ? "Paused" : "Live"}</span>
            </div>
            <div className="w-[1px] h-3 bg-zinc-800" />
            <span>Update in {settings.interval}s</span>
          </div>
        </motion.footer>
      </main>

      {/* Settings */}
      <SettingsDrawer 
        settings={settings} 
        onUpdate={setSettings} 
        onToggleFullscreen={toggleFullscreen}
        isFullscreen={isFullscreen}
      />

      {/* Manual Trigger (Hidden but accessible for testing) */}
      <button 
        onClick={rotateContent}
        className="sr-only"
        aria-label="Next content"
      >
        Next
      </button>
    </div>
  );
}
