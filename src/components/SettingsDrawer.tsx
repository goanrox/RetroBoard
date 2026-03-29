import { Settings, X, Volume2, VolumeX, Smartphone, SmartphoneNfc, Maximize, Minimize, Play, Pause, MapPin, Newspaper, Calendar, LogOut, Trash2, Clock } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

interface SettingsDrawerProps {
  settings: {
    interval: number;
    contentToggles: {
      quotes: boolean;
      weather: boolean;
      headlines: boolean;
      calendar: boolean;
      custom: boolean;
      datetime: boolean;
    };
    weatherLocationInput: string;
    weatherUseCurrentLocation: boolean;
    selectedNewsCategories: string[];
    favoriteQuotePerson: string;
    quoteSource: string;
    temperatureUnit: "C" | "F";
    calendarPreference: "next" | "today" | "tomorrow";
    calendarFeedUrl: string;
    calendarFeedValid: boolean;
    sound: boolean;
    haptics: boolean;
    animationStyle: "subtle" | "normal" | "dramatic";
    orientation: "landscape" | "portrait";
    isPaused: boolean;
  };
  onUpdate: (newSettings: any) => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
}

export default function SettingsDrawer({ settings, onUpdate, onToggleFullscreen, isFullscreen }: SettingsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localWeather, setLocalWeather] = useState(settings.weatherLocationInput);
  const [weatherSuccess, setWeatherSuccess] = useState(false);
  const [localCalendarFeed, setLocalCalendarFeed] = useState(settings.calendarFeedUrl);
  const [calendarSuccess, setCalendarSuccess] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"valid" | "invalid" | "unreachable" | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [isEditingCalendar, setIsEditingCalendar] = useState(!settings.calendarFeedUrl);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalCalendarFeed(settings.calendarFeedUrl);
      setIsEditingCalendar(!settings.calendarFeedUrl);
      setTestStatus(null);
      setPreviewData(null);
      setPreviewError(null);
      setShowDeleteConfirm(false);
    }
  }, [isOpen, settings.calendarFeedUrl]);

  const maskUrl = (url: string) => {
    if (!url) return "";
    try {
      const urlObj = new URL(url);
      const parts = urlObj.pathname.split('/');
      const filename = parts[parts.length - 1] || "calendar.ics";
      return `${urlObj.protocol}//${urlObj.hostname}/.../${filename}`;
    } catch (e) {
      if (url.length <= 24) return url;
      return url.substring(0, 12) + "..." + url.substring(url.length - 8);
    }
  };

  const handleWeatherConfirm = () => {
    onUpdate({ ...settings, weatherLocationInput: localWeather, weatherUseCurrentLocation: false });
    setWeatherSuccess(true);
    setTimeout(() => setWeatherSuccess(false), 2000);
  };

  const handleCalendarConfirm = () => {
    const hasChanged = settings.calendarFeedUrl !== localCalendarFeed;
    onUpdate({ 
      ...settings, 
      calendarFeedUrl: localCalendarFeed,
      calendarFeedValid: hasChanged ? false : settings.calendarFeedValid,
      contentToggles: {
        ...settings.contentToggles,
        calendar: hasChanged ? false : settings.contentToggles.calendar
      }
    });
    setCalendarSuccess(true);
    setIsEditingCalendar(false);
    setTimeout(() => setCalendarSuccess(false), 2000);
  };

  const handleCalendarClear = () => {
    setLocalCalendarFeed("");
    onUpdate({ 
      ...settings, 
      calendarFeedUrl: "",
      calendarFeedValid: false,
      contentToggles: {
        ...settings.contentToggles,
        calendar: false
      }
    });
    setCalendarSuccess(true);
    setTestStatus(null);
    setIsEditingCalendar(true);
    setPreviewData(null);
    setPreviewError(null);
    setLastUpdated(null);
    setTimeout(() => setCalendarSuccess(false), 2000);
  };

  const handleDeleteAllCalendarData = () => {
    setLocalCalendarFeed("");
    setTestStatus(null);
    setPreviewData(null);
    setPreviewError(null);
    setLastUpdated(null);
    setIsEditingCalendar(true);
    setShowDeleteConfirm(false);
    
    onUpdate({ 
      ...settings, 
      calendarFeedUrl: "",
      contentToggles: {
        ...settings.contentToggles,
        calendar: false
      }
    });
  };

  const handleTestFeed = async () => {
    if (!settings.calendarFeedUrl) return;
    
    setIsTesting(true);
    setTestStatus(null);
    
    try {
      const response = await fetch("/api/calendar-feed/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: settings.calendarFeedUrl }),
      });
      
      const data = await response.json();
      setTestStatus(data.status);
      
      if (data.status === "valid") {
        onUpdate({ ...settings, calendarFeedValid: true });
      } else {
        onUpdate({ 
          ...settings, 
          calendarFeedValid: false,
          contentToggles: {
            ...settings.contentToggles,
            calendar: false
          }
        });
      }
    } catch (error) {
      console.error("Test feed error: [REDACTED]");
      setTestStatus("unreachable");
      onUpdate({ 
        ...settings, 
        calendarFeedValid: false,
        contentToggles: {
          ...settings.contentToggles,
          calendar: false
        }
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handlePreviewNextEvent = async () => {
    if (!settings.calendarFeedUrl) return;
    
    setIsPreviewing(true);
    setPreviewError(null);
    setPreviewData(null);
    
    try {
      const response = await fetch("/api/calendar-feed/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: settings.calendarFeedUrl }),
      });
      
      const data = await response.json();
      if (data.status === "success") {
        setPreviewData(data.event);
        if (data.lastUpdated) setLastUpdated(data.lastUpdated);
      } else if (data.status === "no_events") {
        setPreviewError("No upcoming events");
      } else {
        setPreviewError(data.message || "Could not read calendar feed");
      }
    } catch (error) {
      console.error("Preview feed error: [REDACTED]");
      setPreviewError("Could not read calendar feed");
    } finally {
      setIsPreviewing(false);
    }
  };

  const toggleContent = (key: keyof typeof settings.contentToggles) => {
    onUpdate({
      ...settings,
      contentToggles: {
        ...settings.contentToggles,
        [key]: !settings.contentToggles[key],
      },
    });
  };

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true);
          setLocalWeather(settings.weatherLocationInput);
          setLocalCalendarFeed(settings.calendarFeedUrl);
        }}
        className="fixed bottom-6 right-6 p-3 bg-zinc-900/80 backdrop-blur-md text-zinc-400 hover:text-white rounded-full border border-zinc-800 transition-all z-40"
      >
        <Settings size={24} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              className="fixed right-0 top-0 bottom-0 w-80 bg-zinc-950/95 backdrop-blur-xl border-l border-zinc-800 p-8 z-50 overflow-y-auto shadow-2xl"
            >
              <div className="flex items-center justify-between mb-10">
                <div className="flex flex-col">
                  <h2 className="text-xl font-bold text-white tracking-tight">Settings</h2>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] mt-1 font-bold">Preferences</p>
                </div>
                <button 
                  onClick={() => setIsOpen(false)} 
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-10">
                {/* Playback Control */}
                <section>
                  <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-4 block">Playback</label>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => onUpdate({ ...settings, isPaused: !settings.isPaused })}
                      className={`w-full flex items-center justify-center gap-3 p-4 rounded-xl border transition-all font-semibold ${
                        settings.isPaused ? "bg-zinc-900 border-zinc-800 text-zinc-400" : "bg-white border-white text-black shadow-lg shadow-white/10"
                      }`}
                    >
                      {settings.isPaused ? <Play size={18} /> : <Pause size={18} />}
                      {settings.isPaused ? "Resume Board" : "Pause Board"}
                    </button>
                    
                    <button
                      onClick={onToggleFullscreen}
                      className="w-full flex items-center justify-center gap-3 p-4 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-xl transition-all font-semibold"
                    >
                      {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                      {isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                    </button>
                  </div>
                </section>

                {/* Orientation */}
                <section>
                  <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-4 block">Board Orientation</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                    {["landscape", "portrait"].map((mode) => (
                      <button
                        key={mode}
                        onClick={() => onUpdate({ ...settings, orientation: mode })}
                        className={`py-2 px-4 rounded-lg text-xs font-bold transition-all ${
                          settings.orientation === mode ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        <span className="capitalize">{mode}</span>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Calendar Feed Section */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold block">Calendar Feed</label>
                      <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-wider">
                        Private ICS/iCal Integration
                      </span>
                    </div>
                    <AnimatePresence>
                      {calendarSuccess && (
                        <motion.span 
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-[9px] text-green-500 font-bold uppercase tracking-wider"
                        >
                          Saved
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex flex-col gap-2">
                      {isEditingCalendar ? (
                        <>
                          <input
                            type="text"
                            value={localCalendarFeed}
                            onChange={(e) => setLocalCalendarFeed(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleCalendarConfirm();
                              }
                            }}
                            placeholder="Paste your private calendar feed URL"
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-all"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleCalendarConfirm}
                              className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border border-zinc-700 shadow-lg shadow-black/20"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={handleCalendarClear}
                              className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-red-400 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border border-zinc-800 shadow-lg shadow-black/20"
                            >
                              Clear
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="w-full bg-zinc-950 border border-zinc-900 rounded-xl py-3 px-4 flex items-center justify-between">
                          <p className="text-[10px] text-zinc-500 truncate mr-4 font-mono opacity-80">
                            {maskUrl(settings.calendarFeedUrl)}
                          </p>
                          <div className="flex gap-3">
                            <button
                              onClick={() => setIsEditingCalendar(true)}
                              className="text-[9px] font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={handleCalendarClear}
                              className="text-[9px] font-bold uppercase tracking-wider text-zinc-600 hover:text-red-400 transition-colors"
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={handleTestFeed}
                        disabled={!settings.calendarFeedUrl || isTesting}
                        className={`w-full py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border shadow-lg shadow-black/20 flex items-center justify-center gap-2 ${
                          !settings.calendarFeedUrl || isTesting
                            ? "bg-zinc-950 border-zinc-900 text-zinc-700 cursor-not-allowed"
                            : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                        }`}
                      >
                        {isTesting ? (
                          <div className="w-3 h-3 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Calendar size={14} />
                        )}
                        {isTesting ? "Testing..." : "Test Feed"}
                      </button>

                      <button
                        onClick={handlePreviewNextEvent}
                        disabled={!settings.calendarFeedUrl || isPreviewing}
                        className={`w-full py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border shadow-lg shadow-black/20 flex items-center justify-center gap-2 ${
                          !settings.calendarFeedUrl || isPreviewing
                            ? "bg-zinc-950 border-zinc-900 text-zinc-700 cursor-not-allowed"
                            : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                        }`}
                      >
                        {isPreviewing ? (
                          <div className="w-3 h-3 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                        ) : (
                          <Play size={14} />
                        )}
                        {isPreviewing ? "Fetching Preview..." : "Preview Next Event"}
                      </button>

                      <div className="pt-2">
                        {!showDeleteConfirm ? (
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={!settings.calendarFeedUrl}
                            className={`w-full py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border shadow-lg shadow-black/20 flex items-center justify-center gap-2 ${
                              !settings.calendarFeedUrl
                                ? "bg-zinc-950 border-zinc-900 text-zinc-800 cursor-not-allowed"
                                : "bg-zinc-900/50 border-zinc-800/50 text-zinc-500 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                            }`}
                          >
                            <Trash2 size={14} />
                            Delete All Calendar Data
                          </button>
                        ) : (
                          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 space-y-3">
                            <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider text-center leading-relaxed">
                              Delete saved calendar feed and cached event data?
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={handleDeleteAllCalendarData}
                                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all shadow-lg shadow-red-500/20"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border border-zinc-700"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <AnimatePresence>
                        {(previewData || previewError) && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className={`p-4 rounded-xl border ${previewError ? "bg-red-500/5 border-red-500/20" : "bg-zinc-900/50 border-zinc-800"}`}>
                              {previewError ? (
                                <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider text-center">
                                  {previewError}
                                </p>
                              ) : (
                                <div className="space-y-1">
                                  <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-[0.2em]">Next Event</p>
                                  <p className="text-xs font-bold text-white truncate">{previewData.title}</p>
                                  <div className="flex items-center justify-between mt-2">
                                    <p className="text-[10px] text-zinc-400">{previewData.startDate} {previewData.startTime}</p>
                                    <p className="text-[10px] text-green-500 font-bold">{previewData.relativeLabel}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex flex-col gap-1 px-1">
                        {settings.calendarFeedUrl && !settings.calendarFeedValid && (
                          <p className="text-[9px] text-red-500/80 font-bold uppercase tracking-wider animate-pulse mb-1">
                            Calendar feed needs attention
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <p className={`text-[9px] font-bold uppercase tracking-wider ${settings.calendarFeedUrl ? "text-green-500/70" : "text-zinc-600"}`}>
                            {settings.calendarFeedUrl ? "Calendar feed saved" : "No calendar feed saved"}
                          </p>
                          <AnimatePresence>
                            {testStatus && (
                              <motion.p
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className={`text-[9px] font-bold uppercase tracking-wider ${
                                  testStatus === "valid" ? "text-green-500" : "text-red-500"
                                }`}
                              >
                                {testStatus === "valid" && "Feed looks valid"}
                                {testStatus === "invalid" && "Feed is invalid"}
                                {testStatus === "unreachable" && "Feed could not be reached"}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                        {lastUpdated && (
                          <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-wider">
                            Last checked: {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                        <div className="space-y-2 mt-1">
                          <p className="text-[9px] text-zinc-500 leading-relaxed italic">
                            Your calendar feed is used only to display upcoming events. Only minimal event data is cached for display. You can delete all saved calendar data at any time.
                          </p>
                          <p className="text-[8px] text-zinc-600 leading-relaxed font-medium">
                            Your saved feed link and minimal calendar display data are stored locally in this app unless a server-side deployment is configured differently.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 mt-4">
                      <label className="text-[8px] uppercase tracking-[0.1em] text-zinc-600 font-bold px-1">Display Preference</label>
                      {[
                        { id: "next", label: "Next Event Only" },
                        { id: "today", label: "Today's Remaining" },
                        { id: "tomorrow", label: "Tomorrow's First" }
                      ].map((pref) => (
                        <button
                          key={pref.id}
                          onClick={() => onUpdate({ ...settings, calendarPreference: pref.id })}
                          className={`flex items-center justify-between p-4 rounded-xl border text-xs font-bold transition-all ${
                            settings.calendarPreference === pref.id 
                              ? "bg-zinc-800 border-zinc-700 text-white" 
                              : "bg-zinc-900/50 border-zinc-800/50 text-zinc-500 hover:border-zinc-800"
                          }`}
                        >
                          {pref.label}
                          {settings.calendarPreference === pref.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Weather Location */}
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold block">Weather Location</label>
                    <AnimatePresence>
                      {weatherSuccess && (
                        <motion.span 
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          className="text-[9px] text-green-500 font-bold uppercase tracking-wider"
                        >
                          Updated
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={localWeather}
                        onChange={(e) => setLocalWeather(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleWeatherConfirm()}
                        placeholder="Jacksonville, NC or 28546"
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-all"
                      />
                      <button
                        onClick={handleWeatherConfirm}
                        className="px-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border border-zinc-700"
                      >
                        Confirm
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        onUpdate({ ...settings, weatherUseCurrentLocation: !settings.weatherUseCurrentLocation });
                        if (!settings.weatherUseCurrentLocation) {
                          setWeatherSuccess(true);
                          setTimeout(() => setWeatherSuccess(false), 2000);
                        }
                      }}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border text-[10px] font-bold transition-all ${
                        settings.weatherUseCurrentLocation ? "bg-white border-white text-black" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                      }`}
                    >
                      <MapPin size={14} />
                      {settings.weatherUseCurrentLocation ? "Using Current Location" : "Use Current Location"}
                    </button>

                    <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                      {["C", "F"].map((unit) => (
                        <button
                          key={unit}
                          onClick={() => onUpdate({ ...settings, temperatureUnit: unit })}
                          className={`py-2 px-4 rounded-lg text-xs font-bold transition-all ${
                            settings.temperatureUnit === unit ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          {unit === "C" ? "Celsius (°C)" : "Fahrenheit (°F)"}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* News Categories */}
                <section>
                  <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-4 block">News Categories</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "technology", label: "Tech" },
                      { id: "nation", label: "US News" },
                      { id: "world", label: "World" },
                      { id: "business", label: "Business" },
                      { id: "entertainment", label: "Entertainment" },
                      { id: "sports", label: "Sports" },
                      { id: "science", label: "Science" },
                    ].map((cat) => {
                      const isSelected = settings.selectedNewsCategories.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {

                            onUpdate({ ...settings, selectedNewsCategories: [cat.id] });
                          }}
                          className={`py-2 px-3 rounded-full border text-[10px] font-bold transition-all ${
                            isSelected ? "bg-white border-white text-black" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Quote Preference */}
                <section>
                  <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-4 block">Quote Source</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "les-brown", label: "Les Brown" },
                      { id: "steve-jobs", label: "Steve Jobs" },
                      { id: "maya-angelou", label: "Maya Angelou" },
                      { id: "oprah-winfrey", label: "Oprah Winfrey" },
                      { id: "zig-ziglar", label: "Zig Ziglar" },
                      { id: "mixed-favorites", label: "Mixed Favorites" },
                    ].map((source) => {
                      const isSelected = settings.quoteSource === source.id;
                      return (
                        <button
                          key={source.id}
                          onClick={() => onUpdate({ ...settings, quoteSource: source.id })}
                          className={`py-2 px-4 rounded-full border text-[10px] font-bold transition-all ${
                            isSelected ? "bg-white border-white text-black shadow-lg shadow-white/5" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          {source.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Interval */}
                <section>
                  <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-4 block">Update Interval</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[15, 30, 60, 300].map((val) => (
                      <button
                        key={val}
                        onClick={() => onUpdate({ ...settings, interval: val })}
                        className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                          settings.interval === val ? "bg-white border-white text-black" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                        }`}
                      >
                        {val < 60 ? `${val}s` : `${val / 60}m`}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Content */}
                <section>
                  <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-4 block">Content Sources</label>
                  <div className="space-y-2">
                        {Object.entries(settings.contentToggles).map(([key, enabled]) => {
                          const isCalendar = key === "calendar";
                          const isDateTime = key === "datetime";
                          const isCalendarDisabled = isCalendar && (!settings.calendarFeedUrl || !settings.calendarFeedValid);
                          
                          return (
                            <button
                              key={key}
                              onClick={() => toggleContent(key as keyof typeof settings.contentToggles)}
                              disabled={isCalendarDisabled}
                              className={`w-full flex items-center justify-between p-4 rounded-xl border text-sm font-semibold transition-all ${
                                enabled ? "bg-zinc-900/50 border-zinc-700 text-white" : "bg-zinc-950 border-zinc-900 text-zinc-600"
                              } ${isCalendarDisabled ? "opacity-30 grayscale cursor-not-allowed" : ""}`}
                            >
                              <div className="flex items-center gap-3">
                                {isCalendar && <Calendar size={14} className={enabled ? "text-white" : "text-zinc-700"} />}
                                {isDateTime && <Clock size={14} className={enabled ? "text-white" : "text-zinc-700"} />}
                                <span className="capitalize">{key === "datetime" ? "Date & Time" : key}</span>
                              </div>
                          <div className="flex items-center gap-3">
                            {isCalendar && !settings.calendarFeedValid && settings.calendarFeedUrl && (
                              <span className="text-[8px] text-red-500/70 font-bold uppercase tracking-wider">Needs Test</span>
                            )}
                            <div className={`w-2 h-2 rounded-full transition-all duration-500 ${enabled ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)]" : "bg-zinc-800"}`} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Animation Style */}
                <section>
                  <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-4 block">Animation Style</label>
                  <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                    {["subtle", "normal", "dramatic"].map((style) => (
                      <button
                        key={style}
                        onClick={() => onUpdate({ ...settings, animationStyle: style })}
                        className={`py-2 px-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                          settings.animationStyle === style ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Audio & Haptics */}
                <section>
                  <label className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold mb-4 block">System Feedback</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => onUpdate({ ...settings, sound: !settings.sound })}
                      className={`flex-1 flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all ${
                        settings.sound ? "bg-zinc-900 border-zinc-700 text-white" : "bg-zinc-950 border-zinc-900 text-zinc-600"
                      }`}
                    >
                      <div className={`p-2 rounded-full ${settings.sound ? "bg-zinc-800 text-white" : "bg-zinc-900 text-zinc-700"}`}>
                        {settings.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
                      </div>
                      <span className="text-[10px] uppercase tracking-widest font-black">Sound</span>
                    </button>
                    <button
                      onClick={() => onUpdate({ ...settings, haptics: !settings.haptics })}
                      className={`flex-1 flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all ${
                        settings.haptics ? "bg-zinc-900 border-zinc-700 text-white" : "bg-zinc-950 border-zinc-900 text-zinc-600"
                      }`}
                    >
                      <div className={`p-2 rounded-full ${settings.haptics ? "bg-zinc-800 text-white" : "bg-zinc-900 text-zinc-700"}`}>
                        {settings.haptics ? <SmartphoneNfc size={18} /> : <Smartphone size={18} />}
                      </div>
                      <span className="text-[10px] uppercase tracking-widest font-black">Haptics</span>
                    </button>
                  </div>
                </section>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
