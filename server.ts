import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import https from "https";
import cookieSession from "cookie-session";
import ical from "node-ical";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper for fetching that can ignore SSL errors if needed (for Quote APIs with expired certs)
async function robustFetch(url: string, options: any = {}): Promise<any> {
  try {
    return await fetch(url, options);
  } catch (error: any) {
    const errorMsg = error.message || "";
    const errorCode = error.code || "";
    const causeMsg = error.cause?.message || "";
    const causeCode = error.cause?.code || "";

    const isCertError = 
      errorMsg.includes("certificate has expired") || 
      errorCode === "CERT_HAS_EXPIRED" ||
      causeMsg.includes("certificate has expired") ||
      causeCode === "CERT_HAS_EXPIRED" ||
      causeMsg.includes("self-signed certificate") ||
      causeCode === "DEPTH_ZERO_SELF_SIGNED_CERT";

    if (isCertError) {
      console.warn(`SSL Certificate issue for [REDACTED], attempting insecure fetch...`);
      return new Promise((resolve, reject) => {
        try {
          const urlObj = new URL(url);
          const requestOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || "GET",
            headers: options.headers || {},
            rejectUnauthorized: false
          };

          const req = https.request(requestOptions, (res: any) => {
            let data = "";
            res.on("data", (chunk: any) => (data += chunk));
            res.on("end", () => {
              try {
                resolve({
                  ok: res.statusCode >= 200 && res.statusCode < 300,
                  status: res.statusCode,
                  headers: { get: (name: string) => res.headers[name.toLowerCase()] },
                  json: async () => JSON.parse(data),
                  text: async () => data,
                });
              } catch (e) {
                reject(new Error("Failed to parse insecure response body"));
              }
            });
          });

          req.on("error", (err) => reject(err));
          if (options.body) req.write(options.body);
          req.end();
        } catch (e) {
          reject(e);
        }
      });
    }
    throw error;
  }
}

// Simple in-memory cache
const cache: Record<string, { data: any; expiry: number }> = {};
const calendarCache: Record<string, { event: any; lastUpdated: number }> = {};

function getCache(key: string) {
  const item = cache[key];
  if (item && item.expiry > Date.now()) {
    return item.data;
  }
  return null;
}

function setCache(key: string, data: any, ttlSeconds: number) {
  cache[key] = {
    data,
    expiry: Date.now() + ttlSeconds * 1000,
  };
}

// Normalization helper
function normalizeText(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9\s.,!?'"°C°F]/g, "") // Keep basic punctuation and °C/°F
    .trim();
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");
}

function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const LOCAL_QUOTES: Record<string, string[]> = {
  "STEVE JOBS": [
    "STAY HUNGRY, STAY FOOLISH.",
    "THE ONLY WAY TO DO GREAT WORK IS TO LOVE WHAT YOU DO.",
    "INNOVATION DISTINGUISHES BETWEEN A LEADER AND A FOLLOWER.",
    "YOUR TIME IS LIMITED, SO DON'T WASTE IT LIVING SOMEONE ELSE'S LIFE.",
    "HAVE THE COURAGE TO FOLLOW YOUR HEART AND INTUITION."
  ],
  "LES BROWN": [
    "SHOOT FOR THE MOON. EVEN IF YOU MISS, YOU'LL LAND AMONG THE STARS.",
    "YOU ARE NEVER TOO OLD TO SET ANOTHER GOAL OR TO DREAM A NEW DREAM.",
    "HELP OTHERS ACHIEVE THEIR DREAMS AND YOU WILL ACHIEVE YOURS.",
    "IT'S NOT OVER UNTIL YOU WIN.",
    "YOU MUST BE WILLING TO DO THE THINGS TODAY OTHERS WON'T DO IN ORDER TO HAVE THE THINGS TOMORROW OTHERS WON'T HAVE."
  ],
  "MAYA ANGELOU": [
    "I'VE LEARNED THAT PEOPLE WILL FORGET WHAT YOU SAID, BUT PEOPLE WILL NEVER FORGET HOW YOU MADE THEM FEEL.",
    "NOTHING WILL WORK UNLESS YOU DO.",
    "YOU MAY ENCOUNTER MANY DEFEATS, BUT YOU MUST NOT BE DEFEATED.",
    "IF YOU DON'T LIKE SOMETHING, CHANGE IT. IF YOU CAN'T CHANGE IT, CHANGE YOUR ATTITUDE.",
    "MY MISSION IN LIFE IS NOT MERELY TO SURVIVE, BUT TO THRIVE."
  ],
  "BRUCE LEE": [
    "BE WATER, MY FRIEND.",
    "AS YOU THINK, SO SHALL YOU BECOME.",
    "MISTAKES ARE ALWAYS FORGIVABLE, IF ONE HAS THE COURAGE TO ADMIT THEM.",
    "THE SUCCESSFUL WARRIOR IS THE AVERAGE MAN, WITH LASER-LIKE FOCUS.",
    "KNOWING IS NOT ENOUGH, WE MUST APPLY. WILLING IS NOT ENOUGH, WE MUST DO."
  ],
  "ALBERT EINSTEIN": [
    "IMAGINATION IS MORE IMPORTANT THAN KNOWLEDGE.",
    "LIFE IS LIKE RIDING A BICYCLE. TO KEEP YOUR BALANCE, YOU MUST KEEP MOVING.",
    "A PERSON WHO NEVER MADE A MISTAKE NEVER TRIED ANYTHING NEW.",
    "STRIVE NOT TO BE A SUCCESS, BUT RATHER TO BE OF VALUE.",
    "IN THE MIDDLE OF DIFFICULTY LIES OPPORTUNITY."
  ],
  "OPRAH WINFREY": [
    "THE BIGGEST ADVENTURE YOU CAN TAKE IS TO LIVE THE LIFE OF YOUR DREAMS.",
    "TURN YOUR WOUNDS INTO WISDOM.",
    "YOU BECOME WHAT YOU BELIEVE.",
    "LUCK IS A MATTER OF PREPARATION MEETING OPPORTUNITY.",
    "CHALLENGES ARE GIFTS THAT FORCE US TO SEARCH FOR A NEW CENTER OF GRAVITY."
  ]
};

const GENERAL_QUOTES = [
  "STAY HUNGRY, STAY FOOLISH.",
  "THE BEST WAY TO PREDICT THE FUTURE IS TO CREATE IT.",
  "DO NOT WAIT; THE TIME WILL NEVER BE 'JUST RIGHT'.",
  "DREAM BIG AND DARE TO FAIL.",
  "ACTION IS THE KEY TO ALL SUCCESS.",
  "EVERYTHING YOU'VE EVER WANTED IS ON THE OTHER SIDE OF FEAR.",
  "HARDSHIPS OFTEN PREPARE ORDINARY PEOPLE FOR AN EXTRAORDINARY DESTINY.",
  "BELIEVE YOU CAN AND YOU'RE HALFWAY THERE.",
  "YOUR LIMITATION—IT'S ONLY YOUR IMAGINATION.",
  "PUSH YOURSELF, BECAUSE NO ONE ELSE IS GOING TO DO IT FOR YOU.",
  "SOMETIMES LATER BECOMES NEVER. DO IT NOW.",
  "GREAT THINGS NEVER COME FROM COMFORT ZONES.",
  "DREAM IT. WISH IT. DO IT.",
  "SUCCESS DOESN'T JUST FIND YOU. YOU HAVE TO GO OUT AND GET IT.",
  "THE HARDER YOU WORK FOR SOMETHING, THE GREATER YOU'LL FEEL WHEN YOU ACHIEVE IT.",
  "DREAM BIGGER. DO BIGGER.",
  "DON'T STOP WHEN YOU'RE TIRED. STOP WHEN YOU'RE DONE.",
  "WAKE UP WITH DETERMINATION. GO TO BED WITH SATISFACTION.",
  "DO SOMETHING TODAY THAT YOUR FUTURE SELF WILL THANK YOU FOR.",
  "LITTLE THINGS MAKE BIG DAYS.",
  "IT ALWAYS SEEMS IMPOSSIBLE UNTIL IT'S DONE.",
  "KEEP YOUR EYES ON THE STARS, AND YOUR FEET ON THE GROUND.",
  "THE ONLY WAY TO DO GREAT WORK IS TO LOVE WHAT YOU DO.",
  "YOU MISS 100% OF THE SHOTS YOU DON'T TAKE.",
  "WHETHER YOU THINK YOU CAN OR YOU THINK YOU CAN'T, YOU'RE RIGHT.",
  "PERFECTION IS NOT ATTAINABLE, BUT IF WE CHASE PERFECTION WE CAN CATCH EXCELLENCE.",
  "I HAVE NOT FAILED. I'VE JUST FOUND 10,000 WAYS THAT WON'T WORK.",
  "LIMIT YOUR 'ALWAYS' AND YOUR 'NEVERS'.",
  "THE BEST REVENGE IS MASSIVE SUCCESS.",
  "THE ONLY LIMIT TO OUR REALIZATION OF TOMORROW WILL BE OUR DOUBTS OF TODAY."
];

async function fetchAndParseCalendar(url: string) {
  try {
    const response = await robustFetch(url, { method: "GET", timeout: 10000 });
    if (!response.ok) return null;

    const text = await response.text();
    const data = ical.sync.parseICS(text);
    
    const now = new Date();
    let nextEvent: any = null;

    for (const k in data) {
      if (data.hasOwnProperty(k)) {
        const ev = data[k];
        if (ev.type === 'VEVENT') {
          const start = new Date(ev.start);
          const end = ev.end ? new Date(ev.end) : start;
          
          if (end > now) {
            if (!nextEvent || start < new Date(nextEvent.start)) {
              nextEvent = ev;
            }
          }
        }
      }
    }

    if (nextEvent) {
      const start = new Date(nextEvent.start);
      const diffMs = start.getTime() - now.getTime();
      
      let relativeLabel = "";
      if (diffMs < 0) {
        relativeLabel = "Ongoing";
      } else {
        const diffMin = Math.round(diffMs / 60000);
        if (diffMin < 60) {
          relativeLabel = `in ${diffMin} min`;
        } else if (diffMin < 1440) {
          const hours = Math.floor(diffMin / 60);
          const mins = diffMin % 60;
          relativeLabel = `in ${hours}h ${mins}m`;
        } else {
          const days = Math.floor(diffMin / 1440);
          relativeLabel = `in ${days} day${days > 1 ? 's' : ''}`;
        }
      }

      const timeStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

      return {
        title: nextEvent.summary || "Untitled Event",
        startTime: timeStr,
        startDate: dateStr,
        relativeLabel
      };
    }
    return { noEvents: true };
  } catch (error) {
    console.error("Calendar fetch error: [REDACTED]");
    return null;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(
    cookieSession({
      name: "session",
      keys: [process.env.SESSION_SECRET || "REPLACE_WITH_SECURE_SECRET_IN_PRODUCTION"],
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: true,
      sameSite: "none",
    })
  );

  // Auth Routes
  app.get("/api/auth/logout", (req, res) => {
    req.session = null;
    res.json({ success: true });
  });

  // Calendar Route (Placeholder for ICS)
  app.get("/api/calendar", async (req, res) => {
    const { url } = req.query;
    
    if (url && typeof url === "string") {
      const now = Date.now();
      const cached = calendarCache[url];
      const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes

      if (cached && (now - cached.lastUpdated < REFRESH_INTERVAL)) {
        if (cached.event?.noEvents) {
          return res.json({
            type: "calendar",
            lines: ["NO UPCOMING", "EVENTS"],
            lastUpdated: cached.lastUpdated
          });
        }
        return res.json({
          type: "calendar",
          lines: [
            cached.event.title.toUpperCase(),
            `${cached.event.startDate} ${cached.event.startTime}`.toUpperCase(),
            cached.event.relativeLabel.toUpperCase()
          ],
          lastUpdated: cached.lastUpdated
        });
      }

      // Background refresh or initial fetch
      const fetchPromise = fetchAndParseCalendar(url).then(event => {
        if (event) {
          calendarCache[url] = { event, lastUpdated: Date.now() };
        }
        return event;
      });

      if (!cached) {
        const event = await fetchPromise;
        if (event) {
          if (event.noEvents) {
            return res.json({
              type: "calendar",
              lines: ["NO UPCOMING", "EVENTS"],
              lastUpdated: Date.now()
            });
          }
          return res.json({
            type: "calendar",
            lines: [
              event.title.toUpperCase(),
              `${event.startDate} ${event.startTime}`.toUpperCase(),
              event.relativeLabel.toUpperCase()
            ],
            lastUpdated: Date.now()
          });
        }
      } else {
        // Return stale data while refreshing in background
        if (cached.event?.noEvents) {
          return res.json({
            type: "calendar",
            lines: ["NO UPCOMING", "EVENTS"],
            lastUpdated: cached.lastUpdated
          });
        }
        return res.json({
          type: "calendar",
          lines: [
            cached.event.title.toUpperCase(),
            `${cached.event.startDate} ${cached.event.startTime}`.toUpperCase(),
            cached.event.relativeLabel.toUpperCase()
          ],
          lastUpdated: cached.lastUpdated
        });
      }
    }

    res.json({
      type: "calendar",
      lines: ["CALENDAR FEED", "NOT CONFIGURED"],
    });
  });

  // Test Calendar Feed
  app.post("/api/calendar-feed/test", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ status: "invalid", message: "No URL provided" });
    }

    try {
      const response = await robustFetch(url, { method: "GET", timeout: 5000 });
      if (!response.ok) {
        return res.json({ status: "unreachable" });
      }

      const text = await response.text();
      // Basic check for iCal format
      if (text.includes("BEGIN:VCALENDAR")) {
        return res.json({ status: "valid" });
      } else {
        return res.json({ status: "invalid" });
      }
    } catch (error) {
      console.error("Calendar feed test error: [REDACTED]");
      return res.json({ status: "unreachable" });
    }
  });

  // Preview Next Event
  app.post("/api/calendar-feed/preview", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ status: "error", message: "No URL provided" });
    }

    const event = await fetchAndParseCalendar(url);
    if (event) {
      if (event.noEvents) {
        return res.json({ status: "no_events", message: "No upcoming events" });
      }
      // Update cache while we're at it
      calendarCache[url] = { event, lastUpdated: Date.now() };
      return res.json({
        status: "success",
        event,
        lastUpdated: Date.now()
      });
    } else {
      return res.json({ status: "error", message: "Could not read calendar feed" });
    }
  });

  // API Routes
  app.get("/api/weather", async (req, res) => {
    let { lat, lon, city, q, unit } = req.query;
    
  // Geocode if q is provided
    if (q && (!lat || !lon)) {
      const qStr = (q as string).trim();
      const isZip = /^\d{5}$/.test(qStr);
      try {
        if (isZip) {
          // US ZIP code lookup
          const zipRes = await robustFetch(`https://api.zippopotam.us/us/${qStr}`);
          if (zipRes.ok) {
            const zipData = await zipRes.json();
            if (zipData.places && zipData.places[0]) {
              lat = zipData.places[0].latitude.toString();
              lon = zipData.places[0].longitude.toString();
              city = `${zipData.places[0]["place name"].toUpperCase()}, ${zipData["post code"]}`;
            }
          }
        } else {
          // City name geocoding via Open-Meteo
          const geoRes = await robustFetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(qStr)}&count=1`);
          const geoData = await geoRes.json();
          if (geoData.results && geoData.results[0]) {
            lat = geoData.results[0].latitude.toString();
            lon = geoData.results[0].longitude.toString();
            city = geoData.results[0].name.toUpperCase();
          }
        }
      } catch (e) {
        console.error("Geocoding error", e);
      }
    }

    lat = lat || "51.5074";
    lon = lon || "-0.1278";
    city = city || "LONDON";
    const tempUnit = unit === "F" ? "fahrenheit" : "celsius";

    const cacheKey = `weather_${lat}_${lon}_${unit || "C"}`;
    
    const cached = getCache(cacheKey);
    if (cached) return res.json(cached);

    try {
      const response = await robustFetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=${tempUnit}`
      );
      
      if (!response.ok) {
        throw new Error(`Open-Meteo API returned status ${response.status}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Open-Meteo API did not return JSON");
      }

      const data = await response.json();
      
      if (data.current_weather) {
        const temp = Math.round(data.current_weather.temperature);
        const code = data.current_weather.weathercode;
        const displayUnit = unit === "F" ? "°F" : "°C";
        
        const weatherMap: Record<number, string> = {
          0: "CLEAR",
          1: "MAINLY CLEAR", 2: "PARTLY CLOUDY", 3: "OVERCAST",
          45: "FOG", 48: "FOG",
          51: "DRIZZLE", 53: "DRIZZLE", 55: "DRIZZLE",
          61: "RAIN", 63: "RAIN", 65: "RAIN",
          71: "SNOW", 73: "SNOW", 75: "SNOW",
          95: "THUNDERSTORM",
        };
        
        const condition = weatherMap[code] || "CLOUDY";
        const result = {
          type: "weather",
          lines: [`${city}: ${temp}${displayUnit}`, condition],
          meta: { city, temp, condition, unit: displayUnit }
        };
        
        setCache(cacheKey, result, 900); // 15 mins
        return res.json(result);
      }
      throw new Error("Invalid weather data");
    } catch (error) {
      console.error("Weather API error:", error);
      const displayUnit = unit === "F" ? "°F" : "°C";
      const temp = unit === "F" ? 54 : 12;
      res.json({
        type: "weather",
        lines: [`${city}: ${temp}${displayUnit}`, "CLOUDY"],
        meta: { fallback: true }
      });
    }
  });

  app.get("/api/news", async (req, res) => {
    const { category, refresh } = req.query;
    const cat = (category as string) || "world";
    const cacheKey = `news_${cat}`;
    const cached = getCache(cacheKey);
    

    
    if (cached && refresh !== "true") {

      return res.json(cached);
    }
    
    if (refresh === "true") {

    } else {

    }

    const apiKey = process.env.GNEWS_API_KEY;
    if (!apiKey) {

      return res.json({
        type: "news",
        lines: getFallbackNews(cat),
        meta: { fallback: true, reason: "No API Key", category: cat }
      });
    }

    try {
      // GNEWS topics: breaking-news, world, nation, business, technology, entertainment, sports, science, health
      // Note: GNews uses 'topic' parameter for categories
      const url = `https://gnews.io/api/v4/top-headlines?token=${apiKey}&lang=en&max=10&topic=${cat}`;

      
      const response = await robustFetch(url);
      
      if (!response.ok) {
        throw new Error(`GNews API returned status ${response.status}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("GNews API did not return JSON");
      }

      const data = await response.json();
      
      if (data.articles && data.articles.length > 0) {
        const headlines = data.articles.map((a: any) => normalizeText(a.title));
        const result = {
          type: "news",
          lines: headlines,
          meta: { count: headlines.length, category: cat }
        };
        setCache(cacheKey, result, 600); // 10 mins
        return res.json(result);
      }
      throw new Error("No news articles found in response");
    } catch (error) {
      console.error(`News API error for category ${cat}:`, error);
      res.json({
        type: "news",
        lines: getFallbackNews(cat),
        meta: { fallback: true, category: cat }
      });
    }
  });

  // Helper for category-aware fallback headlines
  function getFallbackNews(cat: string): string[] {
    const fallbacks: Record<string, string[]> = {
      technology: [
        "TECH GIANT ANNOUNCES NEW AI MODEL",
        "NEW BREAKTHROUGH IN QUANTUM COMPUTING REPORTED",
        "ELECTRIC VEHICLE SALES HIT RECORD HIGH",
        "INNOVATIVE STARTUP SECURES MAJOR FUNDING"
      ],
      science: [
        "SCIENTISTS DISCOVER NEW DEEP SEA SPECIES",
        "NEW BREAKTHROUGH IN MEDICAL RESEARCH",
        "NEW SPECIES OF BUTTERFLY FOUND IN AMAZON",
        "WORLD'S OLDEST TREE DISCOVERED IN CHILE"
      ],
      business: [
        "GLOBAL MARKETS SHOW STEADY GROWTH",
        "INNOVATIVE STARTUP SECURES MAJOR FUNDING",
        "NEW DESIGN FOR SUSTAINABLE CITIES UNVEILED",
        "CENTRAL BANK ANNOUNCES INTEREST RATE ADJUSTMENT"
      ],
      world: [
        "GLOBAL SUMMIT ON CLIMATE ACTION BEGINS",
        "HISTORIC PEACE TREATY SIGNED",
        "GLOBAL LITERACY RATES REACH NEW HIGH",
        "INTERNATIONAL COOPERATION ON SPACE EXPLORATION"
      ],
      entertainment: [
        "ART EXHIBITION OPENS IN PARIS",
        "MAJOR ART RESTORATION PROJECT COMPLETED",
        "NEW FILM FESTIVAL ANNOUNCED IN VENICE",
        "GLOBAL MUSIC AWARDS NOMINEES REVEALED"
      ],
      sports: [
        "LOCAL TEAM WINS CHAMPIONSHIP",
        "NEW RECORD SET IN ATHLETICS CHAMPIONSHIP",
        "GLOBAL SPORTS EVENT SCHEDULE ANNOUNCED",
        "INNOVATIVE TRAINING TECHNIQUES IN PROFESSIONAL SPORTS"
      ],
      nation: [
        "NEW POLICY ANNOUNCED BY GOVERNMENT",
        "NATIONAL INFRASTRUCTURE PROJECT BEGINS",
        "LOCAL COMMUNITY INITIATIVE SHOWS SUCCESS",
        "NEW EDUCATIONAL REFORM UNVEILED"
      ]
    };
    return fallbacks[cat] || [
      "GLOBAL MARKETS SHOW STEADY GROWTH",
      "NEW BREAKTHROUGH IN RESEARCH",
      "GLOBAL SUMMIT ON CLIMATE ACTION BEGINS"
    ];
  }

  app.get("/api/quote", async (req, res) => {
    const { author } = req.query;
    const authorClean = (author as string || "").trim();
    const cacheKey = `quote_${authorClean || "random"}`;
    const cached = getCache(cacheKey);
    
    if (cached) {

      return res.json(cached);
    }
    


    try {
      let quoteText = "";
      let authorName = "";
      let url = "local";

      // 0. Check Local Curated Library First
      if (authorClean) {
        const upperAuthor = authorClean.toUpperCase();
        const curated = LOCAL_QUOTES[upperAuthor];
        if (curated) {

          const randomIndex = Math.floor(Math.random() * curated.length);
          quoteText = curated[randomIndex];
          authorName = toTitleCase(authorClean);
        }
      }

      // 1. Try Quotable (if not found in local)
      if (!quoteText) {
        try {
          if (!authorClean) {
            url = "https://api.quotable.io/random";
            const response = await robustFetch(url, {
              headers: {
                "User-Agent": "RetroBoard/1.0 (https://ais-dev.run.app)",
                "Accept": "application/json"
              }
            });
            if (response.ok) {
              const data = await response.json();
              if (data.content) {
                quoteText = data.content;
                authorName = data.author;
              }
            }
          } else {
            const variations = [authorClean, toTitleCase(authorClean), slugify(authorClean)];
            const uniqueVariations = [...new Set(variations)];

            for (const variant of uniqueVariations) {
              url = `https://api.quotable.io/quotes?author=${encodeURIComponent(variant)}&limit=1`;
              const response = await robustFetch(url, {
                headers: {
                  "User-Agent": "RetroBoard/1.0 (https://ais-dev.run.app)",
                  "Accept": "application/json"
                }
              });

              if (response.ok) {
                const data = await response.json();
                if (data.content) {
                  quoteText = data.content;
                  authorName = data.author;
                  break;
                } else if (data.results && data.results[0]) {
                  quoteText = data.results[0].content;
                  authorName = data.results[0].author;
                  break;
                }
              }
            }
          }
        } catch (e) {
          console.warn("Quotable API failed:", e);
        }
      }

      // 2. Try ZenQuotes if still no results (only if API key is present or for random)
      // Note: ZenQuotes often fails for specific authors without a key
      if (!quoteText) {
        try {
          if (!authorClean) {
            url = "https://zenquotes.io/api/random";
            const response = await robustFetch(url, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
              }
            });
            if (response.ok) {
              const data = await response.json();
              if (Array.isArray(data) && data.length > 0) {
                // Check if it's an error message disguised as a quote
                const q = data[0].q;
                if (q && !q.toLowerCase().includes("visit zenquotes.io") && !q.toLowerCase().includes("too many requests")) {
                  quoteText = q;
                  authorName = data[0].a;
                }
              }
            }
          } else if (process.env.ZENQUOTES_API_KEY) {
            const variations = [authorClean, slugify(authorClean), toTitleCase(authorClean)];
            const uniqueVariations = [...new Set(variations)];

            for (const variant of uniqueVariations) {
              url = `https://zenquotes.io/api/quotes/author/${encodeURIComponent(variant)}&key=${process.env.ZENQUOTES_API_KEY}`;
              const response = await robustFetch(url, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
                }
              });

              if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0 && data[0].q) {
                  const q = data[0].q;
                  if (!q.toLowerCase().includes("visit zenquotes.io") && !q.toLowerCase().includes("too many requests")) {
                    quoteText = q;
                    authorName = data[0].a;
                    break;
                  }
                }
              }
            }
          }
        } catch (e) {
          console.warn("ZenQuotes API failed:", e);
        }
      }

      // 3. Try Forismatic as final fallback for random only
      if (!quoteText && !authorClean) {
        try {
          url = "https://api.forismatic.com/api/1.0/?method=getQuote&format=json&lang=en";
          const response = await robustFetch(url);
          if (response.ok) {
            const data = await response.json();
            quoteText = data.quoteText;
            authorName = data.quoteAuthor || "Unknown";
          }
        } catch (e) {
          console.warn("Forismatic API failed:", e);
        }
      }

      // 4. Final Fallback to Local General Quotes
      if (!quoteText) {

        const randomIndex = Math.floor(Math.random() * GENERAL_QUOTES.length);
        quoteText = GENERAL_QUOTES[randomIndex];
        authorName = authorClean ? toTitleCase(authorClean) : "Motivational";
        url = "local-fallback";
      }

      const result = {
        type: "quote",
        lines: [normalizeText(quoteText)],
        meta: { author: normalizeText(authorName), source: url }
      };
      

      setCache(cacheKey, result, 300); // 5 mins
      return res.json(result);

    } catch (error) {
      console.error("Quote API critical error:", error);
      
      // Absolute final fallback - never show error to board
      const randomIndex = Math.floor(Math.random() * GENERAL_QUOTES.length);
      res.json({
        type: "quote",
        lines: [normalizeText(GENERAL_QUOTES[randomIndex])],
        meta: { fallback: true, author: "MOTIVATIONAL" }
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
