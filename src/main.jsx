import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Trophy, Flame, Clock, Wallet, ChevronRight, Zap, BarChart3, ArrowUpRight, Activity, Shield, Lock, Headphones, CreditCard, Search, RefreshCw, AlertCircle, Loader2 } from "lucide-react";

// ================================================================
// JOUW Cloudflare Worker URL
// ================================================================
const API_BASE = "https://mute-paper-7180-inselbetapi.vincentsteevensz.workers.dev";

const REFRESH_INTERVAL_MS = 30_000;
const USER = { username: "user", balance: 1250.00 };

// === HELPERS ===
const fmtMoney = (n) => `€${Number(n).toFixed(2)}`;

const fmtMatchTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d - now;
  const diffH = diffMs / (1000 * 60 * 60);
  const time = d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  if (diffH < 0) return `Bezig · ${time}`;
  if (diffH < 1) return `Over ${Math.round(diffMs / 60000)} min`;
  if (diffH < 24 && d.getDate() === now.getDate()) return `Vandaag · ${time}`;
  if (diffH < 48) return `Morgen · ${time}`;
  const dateStr = d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
  return `${dateStr} · ${time}`;
};

const isLive = (iso) => {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d <= now && (now - d) < 1000 * 60 * 60 * 4;
};

const normalizeMatch = (apiMatch) => {
  let options = [];
  for (const bm of apiMatch.bookmakers || []) {
    const h2h = bm.markets?.find((m) => m.key === "h2h");
    if (h2h && h2h.outcomes?.length >= 2) {
      const home = h2h.outcomes.find((o) => o.name === apiMatch.home_team);
      const away = h2h.outcomes.find((o) => o.name === apiMatch.away_team);
      const draw = h2h.outcomes.find((o) => o.name === "Draw");
      options = [home, draw, away].filter(Boolean).map((o) => ({
        label: o.name === apiMatch.home_team ? "Thuis" : o.name === apiMatch.away_team ? "Uit" : "Gelijk",
        team: o.name,
        odd: o.price,
      }));
      break;
    }
  }

  return {
    id: apiMatch.id,
    sport_key: apiMatch.sport_key,
    sport_title: apiMatch.sport_title || apiMatch.sport_key,
    sport_group: getSportGroup(apiMatch.sport_key),
    home_team: apiMatch.home_team,
    away_team: apiMatch.away_team,
    commence_time: apiMatch.commence_time,
    options,
    isLive: isLive(apiMatch.commence_time),
  };
};

const getSportGroup = (sportKey) => {
  if (sportKey?.startsWith("soccer_")) return "Voetbal";
  if (sportKey?.startsWith("tennis_")) return "Tennis";
  if (sportKey?.startsWith("mma_")) return "MMA";
  if (sportKey?.startsWith("boxing_")) return "Boksen";
  return "Sport";
};

const getLeagueName = (sportKey) => {
  const map = {
    soccer_epl: "Premier League",
    soccer_netherlands_eredivisie: "Eredivisie",
    soccer_uefa_champs_league: "Champions League",
    soccer_uefa_europa_league: "Europa League",
    soccer_spain_la_liga: "La Liga",
    soccer_italy_serie_a: "Serie A",
    soccer_germany_bundesliga: "Bundesliga",
    soccer_france_ligue_one: "Ligue 1",
    soccer_efl_champ: "Championship",
    soccer_argentina_primera_division: "Primera División Argentinië",
    soccer_australia_aleague: "A-League",
    soccer_austria_bundesliga: "Bundesliga Oostenrijk",
    soccer_belgium_first_div: "Eerste Klasse België",
    soccer_brazil_campeonato: "Brasileirão Série A",
    soccer_brazil_serie_b: "Brasileirão Série B",
    soccer_chile_campeonato: "Primera División Chili",
    soccer_china_superleague: "Chinese Super League",
    soccer_conmebol_copa_libertadores: "Copa Libertadores",
    soccer_conmebol_copa_sudamericana: "Copa Sudamericana",
    soccer_denmark_superliga: "Superliga",
    soccer_finland_veikkausliiga: "Veikkausliiga",
    soccer_japan_j_league: "J-League",
    soccer_korea_kleague1: "K League 1",
    soccer_league_of_ireland: "League of Ireland",
    soccer_mexico_ligamx: "Liga MX",
    soccer_norway_eliteserien: "Eliteserien",
    soccer_poland_ekstraklasa: "Ekstraklasa",
    soccer_portugal_primeira_liga: "Primeira Liga",
    soccer_spl: "Scottish Premiership",
    soccer_sweden_allsvenskan: "Allsvenskan",
    soccer_sweden_superettan: "Superettan",
    soccer_switzerland_superleague: "Swiss Super League",
    soccer_turkey_super_league: "Süper Lig",
    soccer_usa_mls: "MLS",
    tennis_atp_french_open: "ATP French Open",
    tennis_atp_wimbledon: "ATP Wimbledon",
    tennis_atp_us_open: "ATP US Open",
    tennis_atp_aus_open_singles: "ATP Australian Open",
    tennis_wta_french_open: "WTA French Open",
    tennis_wta_wimbledon: "WTA Wimbledon",
    mma_mixed_martial_arts: "MMA / UFC",
    boxing_boxing: "Boksen",
  };
  return map[sportKey] || sportKey.replace(/_/g, " ").replace(/^(soccer|tennis|mma|boxing) /, "");
};

// === API HOOK ===
function useMatches() {
  const [data, setData] = useState({ matches: [], fetched_at: null });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/matches`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const normalized = (json.matches || []).map(normalizeMatch).filter((m) => m.options.length > 0);
      setData({ matches: normalized, fetched_at: json.fetched_at });
      setStatus("ok");
      setError(null);
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  return { ...data, status, error, refresh: fetchMatches };
}

// === MAIN APP ===
export default function App() {
  const [view, setView] = useState("home");
  const [selectedMatch, setSelectedMatch] = useState(null);
  const matchesData = useMatches();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-cyan-400 selection:text-zinc-950" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        .display-font { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.01em; }
        .mono-font { font-family: 'JetBrains Mono', monospace; }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes float-orb { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(40px,-30px) scale(1.05); } 66% { transform: translate(-30px,30px) scale(0.95); } }
        @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-fade-up { animation: fade-up 0.5s ease-out backwards; }
        .pulse-dot { animation: pulse-dot 1.5s ease-in-out infinite; }
        .shimmer { background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.1), transparent); background-size: 200% 100%; animation: shimmer 3s ease-in-out infinite; }
        .grid-bg {
          background-image: 
            linear-gradient(rgba(34, 211, 238, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34, 211, 238, 0.04) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #09090b; }
        ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #52525b; }
      `}</style>

      <Navbar view={view} setView={setView} dataStatus={matchesData.status} />

      <main>
        {view === "home" && <HomePage setView={setView} setSelectedMatch={setSelectedMatch} matchesData={matchesData} />}
        {view === "matches" && <MatchesPage setSelectedMatch={setSelectedMatch} matchesData={matchesData} />}
        {view === "live" && <LivePage setSelectedMatch={setSelectedMatch} matchesData={matchesData} />}
        {view === "mybets" && <MyBetsPage />}
      </main>

      <Footer />

      {selectedMatch && <BetModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />}
    </div>
  );
}

function Navbar({ view, setView, dataStatus }) {
  const items = [
    { id: "home", label: "Home" },
    { id: "matches", label: "Sport" },
    { id: "live", label: "Live", badge: true },
    { id: "mybets", label: "Mijn weddenschappen" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <button onClick={() => setView("home")} className="flex items-center gap-2.5 group">
              <div className="relative w-9 h-9 bg-gradient-to-br from-cyan-300 via-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/30 group-hover:shadow-cyan-400/50 transition">
                <Trophy size={18} className="text-zinc-950" strokeWidth={2.8} />
                <div className="absolute inset-0 rounded-lg ring-1 ring-cyan-300/50" />
              </div>
              <span className="display-font text-2xl text-cyan-400 tracking-wide">INSELBET</span>
            </button>

            <nav className="hidden md:flex items-center gap-1">
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={`relative px-4 py-2 text-sm font-medium transition rounded-md flex items-center gap-1.5 ${
                    view === item.id ? "text-cyan-400" : "text-zinc-400 hover:text-zinc-100"
                  }`}
                >
                  {item.label}
                  {item.badge && (
                    <div className="relative">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                      <div className="absolute inset-0 w-1.5 h-1.5 bg-red-500 rounded-full pulse-dot" />
                    </div>
                  )}
                  {view === item.id && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-cyan-400 rounded-full" />
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <DataStatusIndicator status={dataStatus} />
            <button className="hidden sm:flex p-2 text-zinc-400 hover:text-zinc-100 rounded-md hover:bg-zinc-900 transition">
              <Search size={18} />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-cyan-400/10 to-cyan-400/5 border border-cyan-400/30 rounded-md">
              <Wallet size={14} className="text-cyan-400" />
              <span className="mono-font text-sm text-cyan-400 font-bold">{fmtMoney(USER.balance)}</span>
            </div>
            <button className="px-3 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-zinc-950 text-sm font-bold rounded-md transition">
              Storten
            </button>
            <div className="w-9 h-9 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center font-bold text-cyan-400">
              {USER.username[0].toUpperCase()}
            </div>
          </div>
        </div>

        <nav className="md:hidden flex gap-1 pb-3 -mx-1 overflow-x-auto">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`shrink-0 px-3 py-1.5 text-sm font-medium rounded-md transition flex items-center gap-1.5 ${
                view === item.id ? "bg-cyan-400/10 text-cyan-400" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {item.label}
              {item.badge && <div className="w-1.5 h-1.5 bg-red-500 rounded-full pulse-dot" />}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

function DataStatusIndicator({ status }) {
  if (status === "loading") {
    return (
      <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 text-xs mono-font text-zinc-500">
        <Loader2 size={12} className="animate-spin" />
        SYNCEN
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 text-xs mono-font text-red-400">
        <AlertCircle size={12} />
        OFFLINE
      </div>
    );
  }
  return (
    <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 text-xs mono-font text-emerald-400">
      <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full pulse-dot" />
      LIVE
    </div>
  );
}

function LiveTicker({ matches }) {
  const items = useMemo(() => {
    if (!matches || matches.length === 0) {
      return ["DATA WORDT GELADEN", "REAL-TIME ODDS · 24/7", "300+ WEDSTRIJDEN BESCHIKBAAR"];
    }
    return matches.slice(0, 8).map((m) => {
      const time = fmtMatchTime(m.commence_time);
      return `${m.home_team.toUpperCase()} VS ${m.away_team.toUpperCase()} · ${time.toUpperCase()}`;
    });
  }, [matches]);

  const doubled = [...items, ...items];

  return (
    <div className="border-y border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
      <div className="flex items-center gap-3 py-2.5">
        <div className="shrink-0 flex items-center gap-2 pl-4 sm:pl-6 pr-3 border-r border-zinc-800">
          <div className="relative">
            <div className="w-2 h-2 bg-red-500 rounded-full" />
            <div className="absolute inset-0 w-2 h-2 bg-red-500 rounded-full pulse-dot" />
          </div>
          <span className="text-xs mono-font font-bold text-red-400 tracking-widest">LIVE</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex gap-8 whitespace-nowrap" style={{ animation: "ticker 60s linear infinite" }}>
            {doubled.map((item, i) => (
              <span key={i} className="text-xs mono-font text-zinc-400">
                <span className="text-cyan-400 mr-2">▸</span>{item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HomePage({ setView, setSelectedMatch, matchesData }) {
  return (
    <>
      <LiveTicker matches={matchesData.matches} />
      <Hero setView={setView} matchesData={matchesData} setSelectedMatch={setSelectedMatch} />
      <SportCategories setView={setView} matches={matchesData.matches} />
      <FeaturedMatches setSelectedMatch={setSelectedMatch} matchesData={matchesData} />
      <UpcomingSection setSelectedMatch={setSelectedMatch} matchesData={matchesData} />
      <TrustSection />
    </>
  );
}

function Hero({ setView, matchesData, setSelectedMatch }) {
  const featuredMatch = useMemo(() => {
    const live = matchesData.matches.find((m) => m.isLive);
    if (live) return live;
    return matchesData.matches[0];
  }, [matchesData.matches]);

  return (
    <section className="relative overflow-hidden border-b border-zinc-800">
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute top-0 -left-40 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl" style={{ animation: "float-orb 18s ease-in-out infinite" }} />
      <div className="absolute bottom-0 -right-40 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl" style={{ animation: "float-orb 22s ease-in-out infinite reverse" }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-28">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-400/10 border border-cyan-400/30 rounded-full mb-6">
              <Activity size={12} className="text-cyan-400" />
              <span className="text-xs mono-font text-cyan-400 tracking-wider">REAL-TIME ODDS · 24/7 LIVE</span>
            </div>

            <h1 className="display-font text-6xl sm:text-7xl lg:text-8xl leading-[0.95] mb-6">
              <span className="block">DE BESTE</span>
              <span className="block bg-gradient-to-r from-cyan-300 via-cyan-400 to-cyan-600 bg-clip-text text-transparent">QUOTES</span>
              <span className="block">VOOR ELKE</span>
              <span className="block">WEDSTRIJD</span>
            </h1>

            <p className="text-lg text-zinc-400 max-w-lg mb-8 leading-relaxed">
              Wed op duizenden sportwedstrijden wereldwijd. Scherpe odds, snelle uitbetalingen, en de meest complete live betting ervaring in de markt.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setView("matches")}
                className="group inline-flex items-center gap-2 px-6 py-3 bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-bold rounded-md shadow-lg shadow-cyan-500/30 hover:shadow-cyan-400/50 transition"
              >
                <Zap size={16} />
                BEKIJK WEDSTRIJDEN
                <ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
              </button>
              <button
                onClick={() => setView("live")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-100 font-semibold rounded-md transition"
              >
                <div className="w-2 h-2 bg-red-500 rounded-full pulse-dot" />
                Live wedden
              </button>
            </div>

            <div className="mt-10 flex items-center gap-6 sm:gap-8 text-sm">
              <div>
                <div className="display-font text-3xl text-cyan-400">{matchesData.matches.length || "—"}</div>
                <div className="text-xs mono-font text-zinc-500 tracking-wider">WEDSTRIJDEN NU</div>
              </div>
              <div className="w-px h-10 bg-zinc-800" />
              <div>
                <div className="display-font text-3xl text-cyan-400">24/7</div>
                <div className="text-xs mono-font text-zinc-500 tracking-wider">LIVE ODDS</div>
              </div>
              <div className="w-px h-10 bg-zinc-800" />
              <div>
                <div className="display-font text-3xl text-cyan-400">&lt;5min</div>
                <div className="text-xs mono-font text-zinc-500 tracking-wider">UITBETALING</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-br from-cyan-400/30 via-cyan-500/10 to-transparent rounded-2xl blur-xl" />
              {matchesData.status === "loading" && <FeaturedSkeleton />}
              {matchesData.status === "error" && <FeaturedError error={matchesData.error} onRetry={matchesData.refresh} />}
              {matchesData.status === "ok" && featuredMatch && (
                <FeaturedMatchHero match={featuredMatch} onClick={() => setSelectedMatch(featuredMatch)} />
              )}
              {matchesData.status === "ok" && !featuredMatch && (
                <div className="relative bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-8 text-center">
                  <p className="text-zinc-400">Geen wedstrijden beschikbaar.</p>
                </div>
              )}
              <div className="absolute -top-2 -right-2 w-16 h-16 border-t-2 border-r-2 border-cyan-400/40 rounded-tr-2xl pointer-events-none" />
              <div className="absolute -bottom-2 -left-2 w-16 h-16 border-b-2 border-l-2 border-cyan-400/40 rounded-bl-2xl pointer-events-none" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturedMatchHero({ match, onClick }) {
  return (
    <div className="relative bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          {match.isLive ? (
            <>
              <div className="w-2 h-2 bg-red-500 rounded-full pulse-dot" />
              <span className="text-xs mono-font text-red-400 tracking-wider font-bold">LIVE NU</span>
            </>
          ) : (
            <>
              <Flame size={12} className="text-orange-400" />
              <span className="text-xs mono-font text-orange-400 tracking-wider font-bold">UITGELICHT</span>
            </>
          )}
        </div>
        <span className="text-xs mono-font text-zinc-500">{fmtMatchTime(match.commence_time)}</span>
      </div>

      <div className="text-xs mono-font text-cyan-400 mb-2 tracking-wider truncate">{match.sport_group.toUpperCase()} · {getLeagueName(match.sport_key).toUpperCase()}</div>
      <div className="flex items-center justify-between mb-5">
        <div className="text-right flex-1 min-w-0">
          <div className="text-xl font-bold truncate">{match.home_team}</div>
        </div>
        <div className="px-4 display-font text-2xl text-zinc-600 shrink-0">VS</div>
        <div className="flex-1 min-w-0">
          <div className="text-xl font-bold truncate">{match.away_team}</div>
        </div>
      </div>

      <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: `repeat(${match.options.length}, 1fr)` }}>
        {match.options.map((opt, i) => (
          <button
            key={i}
            onClick={onClick}
            className="p-3 bg-zinc-950 hover:bg-cyan-400 hover:text-zinc-950 border border-zinc-800 hover:border-cyan-400 rounded-lg transition"
          >
            <div className="text-[11px] text-zinc-500 truncate">{opt.label}</div>
            <div className="mono-font font-bold text-lg">{opt.odd.toFixed(2)}</div>
          </button>
        ))}
      </div>

      <div className="pt-4 border-t border-zinc-800">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500 mono-font">Bekijk alle markten</span>
          <button onClick={onClick} className="text-cyan-400 hover:text-cyan-300 mono-font font-semibold flex items-center gap-1">
            DETAILS <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

function FeaturedSkeleton() {
  return (
    <div className="relative bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6">
      <div className="space-y-4 animate-pulse">
        <div className="h-3 bg-zinc-800 rounded w-1/3" />
        <div className="h-8 bg-zinc-800 rounded w-2/3" />
        <div className="grid grid-cols-3 gap-2">
          <div className="h-16 bg-zinc-800 rounded" />
          <div className="h-16 bg-zinc-800 rounded" />
          <div className="h-16 bg-zinc-800 rounded" />
        </div>
      </div>
    </div>
  );
}

function FeaturedError({ error, onRetry }) {
  return (
    <div className="relative bg-zinc-900/80 backdrop-blur-xl border border-red-500/30 rounded-2xl p-6">
      <div className="flex items-center gap-2 text-red-400 mb-3">
        <AlertCircle size={18} />
        <span className="font-semibold">Verbinding mislukt</span>
      </div>
      <p className="text-sm text-zinc-400 mb-4">Kon geen verbinding maken met de odds-server. {error}</p>
      <button onClick={onRetry} className="text-sm px-3 py-1.5 bg-cyan-400 text-zinc-950 rounded font-bold flex items-center gap-2">
        <RefreshCw size={14} /> Opnieuw proberen
      </button>
    </div>
  );
}

function SportCategories({ setView, matches }) {
  const counts = useMemo(() => {
    const c = { Voetbal: 0, Tennis: 0, MMA: 0, Boksen: 0 };
    matches.forEach((m) => { if (c[m.sport_group] !== undefined) c[m.sport_group]++; });
    return c;
  }, [matches]);

  const cats = [
    { name: "Voetbal", icon: "⚽", count: counts.Voetbal },
    { name: "Tennis", icon: "🎾", count: counts.Tennis },
    { name: "MMA", icon: "🥊", count: counts.MMA },
    { name: "Boksen", icon: "🥋", count: counts.Boksen },
  ];

  return (
    <section className="border-b border-zinc-800 bg-zinc-900/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-4 gap-2 max-w-2xl mx-auto">
          {cats.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setView("matches")}
              className="group flex flex-col items-center gap-1 p-4 rounded-lg hover:bg-zinc-900 transition"
            >
              <div className="text-3xl group-hover:scale-110 transition">{cat.icon}</div>
              <div className="text-sm font-semibold text-zinc-300 group-hover:text-cyan-400 transition">{cat.name}</div>
              <div className="text-[10px] mono-font text-zinc-500">{cat.count}</div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturedMatches({ setSelectedMatch, matchesData }) {
  const featured = useMemo(() => {
    const live = matchesData.matches.filter((m) => m.isLive);
    const upcoming = matchesData.matches.filter((m) => !m.isLive);
    return [...live, ...upcoming].slice(0, 4);
  }, [matchesData.matches]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Flame size={16} className="text-orange-400" />
            <span className="text-xs mono-font text-orange-400 tracking-widest">UITGELICHT</span>
          </div>
          <h2 className="display-font text-4xl sm:text-5xl">TOPWEDSTRIJDEN</h2>
        </div>
      </div>

      {matchesData.status === "loading" && <MatchGridSkeleton />}
      {matchesData.status === "error" && (
        <div className="bg-zinc-900/40 border border-red-500/30 rounded-xl p-6 text-center">
          <AlertCircle size={24} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm text-zinc-400">Wedstrijden kunnen niet geladen worden.</p>
        </div>
      )}
      {matchesData.status === "ok" && featured.length === 0 && (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-500">Momenteel geen wedstrijden beschikbaar.</p>
        </div>
      )}
      {matchesData.status === "ok" && featured.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {featured.map((match, i) => (
            <FeaturedMatchCard key={match.id} match={match} onClick={() => setSelectedMatch(match)} delay={i * 0.08} />
          ))}
        </div>
      )}
    </section>
  );
}

function MatchGridSkeleton() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 animate-pulse">
          <div className="space-y-3">
            <div className="h-3 bg-zinc-800 rounded w-1/4" />
            <div className="h-6 bg-zinc-800 rounded w-3/4" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-14 bg-zinc-800 rounded" />
              <div className="h-14 bg-zinc-800 rounded" />
              <div className="h-14 bg-zinc-800 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function FeaturedMatchCard({ match, onClick, delay }) {
  return (
    <div
      onClick={onClick}
      className="group relative bg-zinc-900/40 hover:bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 rounded-xl p-5 cursor-pointer transition animate-fade-up"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-400/0 via-cyan-400/0 to-cyan-400/0 group-hover:from-cyan-400/5 group-hover:to-transparent transition pointer-events-none" />

      <div className="relative">
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs mono-font text-cyan-400 font-semibold tracking-wider shrink-0">{match.sport_group.toUpperCase()}</span>
            <span className="text-xs text-zinc-600 shrink-0">·</span>
            <span className="text-xs mono-font text-zinc-500 truncate">{getLeagueName(match.sport_key)}</span>
          </div>
          <div className={`flex items-center gap-1 text-xs mono-font shrink-0 ${match.isLive ? "text-red-400" : "text-zinc-500"}`}>
            {match.isLive && <div className="w-1.5 h-1.5 bg-red-500 rounded-full pulse-dot" />}
            {fmtMatchTime(match.commence_time)}
          </div>
        </div>

        <div className="flex items-center justify-between mb-5">
          <div className="text-right flex-1 min-w-0">
            <div className="text-xl font-bold truncate">{match.home_team}</div>
          </div>
          <div className="px-4 shrink-0">
            <div className="display-font text-2xl text-zinc-600">VS</div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xl font-bold truncate">{match.away_team}</div>
          </div>
        </div>

        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${match.options.length}, 1fr)` }}>
          {match.options.map((opt, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); onClick(); }}
              className="group/odd p-3 bg-zinc-950 hover:bg-cyan-400 hover:text-zinc-950 border border-zinc-800 hover:border-cyan-400 rounded-lg transition text-left"
            >
              <div className="text-[11px] text-zinc-500 group-hover/odd:text-zinc-900 truncate transition">{opt.label}</div>
              <div className="mono-font font-bold text-lg">{opt.odd.toFixed(2)}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function UpcomingSection({ setSelectedMatch, matchesData }) {
  const upcoming = useMemo(() => {
    return matchesData.matches.filter((m) => !m.isLive).slice(0, 8);
  }, [matchesData.matches]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-cyan-400" />
            <span className="text-xs mono-font text-cyan-400 tracking-widest">KOMEND</span>
          </div>
          <h2 className="display-font text-4xl">AANSTAANDE WEDSTRIJDEN</h2>
        </div>
      </div>

      {matchesData.status === "ok" && upcoming.length > 0 && (
        <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-zinc-800">
            {upcoming.map((m) => (
              <QuickMatchRow key={m.id} match={m} onClick={() => setSelectedMatch(m)} />
            ))}
          </div>
        </div>
      )}
      {matchesData.status === "ok" && upcoming.length === 0 && (
        <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
          Geen aanstaande wedstrijden.
        </div>
      )}
    </section>
  );
}

function QuickMatchRow({ match, onClick }) {
  return (
    <div
      onClick={onClick}
      className="group flex items-center gap-3 p-4 hover:bg-zinc-900/50 cursor-pointer transition"
    >
      <div className="shrink-0 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-[10px] mono-font text-cyan-400 tracking-wider">
        {match.sport_group.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate group-hover:text-cyan-300 transition">{match.home_team} - {match.away_team}</div>
        <div className="text-xs text-zinc-500 mono-font truncate">{fmtMatchTime(match.commence_time)} · {getLeagueName(match.sport_key)}</div>
      </div>
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        {match.options.map((opt, i) => (
          <div key={i} className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded mono-font text-sm font-semibold min-w-[3rem] text-center group-hover:border-cyan-400/50 transition">
            {opt.odd.toFixed(2)}
          </div>
        ))}
      </div>
      <ChevronRight size={16} className="text-zinc-600 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition shrink-0" />
    </div>
  );
}

function TrustSection() {
  const features = [
    { icon: <Shield size={24} />, title: "Veilig & beveiligd", desc: "Versleutelde transacties en strikte privacybescherming volgens de hoogste industriestandaarden." },
    { icon: <Zap size={24} />, title: "Snelle uitbetalingen", desc: "Winsten worden binnen enkele minuten na afloop van de wedstrijd op je account bijgeschreven." },
    { icon: <Headphones size={24} />, title: "24/7 ondersteuning", desc: "Onze klantenservice staat dag en nacht voor je klaar via live chat en e-mail." },
    { icon: <CreditCard size={24} />, title: "Flexibele betaalmethoden", desc: "Stort en neem op via iDEAL, creditcard, bankoverschrijving of populaire e-wallets." },
  ];

  return (
    <section className="border-y border-zinc-800 bg-zinc-900/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-400/10 border border-cyan-400/30 rounded-full mb-4">
            <Lock size={12} className="text-cyan-400" />
            <span className="text-xs mono-font text-cyan-400 tracking-wider">WAAROM INSELBET</span>
          </div>
          <h2 className="display-font text-4xl sm:text-5xl mb-3">DE PROFESSIONELE STANDAARD</h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Inselbet biedt scherpe odds, uitgebreide markten en een veilige omgeving voor sportweddenschappen — alles in één geavanceerd platform.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <div key={i} className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition">
              <div className="w-12 h-12 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400 mb-4">
                {f.icon}
              </div>
              <h3 className="font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MatchesPage({ setSelectedMatch, matchesData }) {
  const [filter, setFilter] = useState("alle");
  const filters = ["alle", "Voetbal", "Tennis", "MMA", "Boksen"];

  const filtered = useMemo(() => {
    return filter === "alle"
      ? matchesData.matches
      : matchesData.matches.filter((m) => m.sport_group === filter);
  }, [filter, matchesData.matches]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="display-font text-5xl sm:text-6xl">SPORTMARKTEN</h1>
          <p className="text-zinc-500 mt-2">Bekijk alle beschikbare wedstrijden en odds.</p>
        </div>
        <button onClick={matchesData.refresh} className="hidden sm:flex items-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md text-sm transition">
          <RefreshCw size={14} className={matchesData.status === "loading" ? "animate-spin" : ""} /> Verversen
        </button>
      </div>

      <div className="flex gap-2 mb-6 -mx-1 px-1 overflow-x-auto pb-1">
        {filters.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`shrink-0 px-4 py-2 rounded-md text-sm font-semibold transition ${
              filter === s ? "bg-cyan-400 text-zinc-950" : "bg-zinc-900 text-zinc-400 hover:text-zinc-100 border border-zinc-800"
            }`}
          >
            {s === "alle" ? "Alle sporten" : s}
          </button>
        ))}
      </div>

      {matchesData.status === "loading" && <MatchGridSkeleton />}
      {matchesData.status === "error" && (
        <div className="bg-zinc-900/40 border border-red-500/30 rounded-xl p-8 text-center">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="font-semibold mb-1">Kon wedstrijden niet laden</p>
          <p className="text-sm text-zinc-500 mb-4">{matchesData.error}</p>
          <button onClick={matchesData.refresh} className="px-4 py-2 bg-cyan-400 text-zinc-950 rounded-md font-bold text-sm">
            Opnieuw proberen
          </button>
        </div>
      )}
      {matchesData.status === "ok" && filtered.length === 0 && (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
          Geen {filter !== "alle" ? filter.toLowerCase() : ""}wedstrijden gevonden.
        </div>
      )}
      {matchesData.status === "ok" && filtered.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((match, i) => (
            <FeaturedMatchCard key={match.id} match={match} onClick={() => setSelectedMatch(match)} delay={Math.min(i * 0.04, 0.4)} />
          ))}
        </div>
      )}
    </section>
  );
}

function LivePage({ setSelectedMatch, matchesData }) {
  const live = useMemo(() => matchesData.matches.filter((m) => m.isLive), [matchesData.matches]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-red-500 rounded-full pulse-dot" />
            <span className="text-xs mono-font text-red-400 tracking-widest font-bold">LIVE NU</span>
          </div>
          <h1 className="display-font text-5xl sm:text-6xl">LIVE WEDDEN</h1>
          <p className="text-zinc-500 mt-2">Realtime odds op wedstrijden die nu bezig zijn.</p>
        </div>
        <div className="hidden sm:block text-right">
          <div className="text-3xl font-bold mono-font text-red-400">{live.length}</div>
          <div className="text-xs mono-font text-zinc-500 tracking-wider">ACTIEVE WEDSTRIJDEN</div>
        </div>
      </div>

      {matchesData.status === "loading" && <MatchGridSkeleton />}
      {matchesData.status === "ok" && live.length === 0 && (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-12 text-center">
          <Activity size={32} className="text-zinc-600 mx-auto mb-3" />
          <p className="font-semibold mb-1">Geen live wedstrijden</p>
          <p className="text-sm text-zinc-500">Er zijn momenteel geen wedstrijden live aan de gang.</p>
        </div>
      )}
      {matchesData.status === "ok" && live.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {live.map((match, i) => (
            <FeaturedMatchCard key={match.id} match={match} onClick={() => setSelectedMatch(match)} delay={i * 0.05} />
          ))}
        </div>
      )}
    </section>
  );
}

function MyBetsPage() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="display-font text-5xl sm:text-6xl">MIJN WEDDENSCHAPPEN</h1>
        <p className="text-zinc-500 mt-2">Overzicht van openstaande en afgewikkelde weddenschappen.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <SummaryCard label="OPEN" value="0" accent="cyan" />
        <SummaryCard label="GEWONNEN" value="0" accent="emerald" />
        <SummaryCard label="VERLOREN" value="0" accent="red" />
        <SummaryCard label="WINST/VERLIES" value="€0,00" accent="emerald" mono />
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-12 text-center">
        <BarChart3 size={32} className="text-zinc-600 mx-auto mb-3" />
        <p className="font-semibold mb-1">Nog geen weddenschappen</p>
        <p className="text-sm text-zinc-500">Plaats je eerste weddenschap bij de wedstrijden.</p>
      </div>
    </section>
  );
}

function SummaryCard({ label, value, accent, mono }) {
  const colors = {
    cyan: "from-cyan-400/10 border-cyan-400/30 text-cyan-400",
    emerald: "from-emerald-400/10 border-emerald-400/30 text-emerald-400",
    red: "from-red-400/10 border-red-400/30 text-red-400",
  };
  return (
    <div className={`bg-gradient-to-br ${colors[accent]} to-transparent border rounded-lg p-4`}>
      <div className="text-[10px] mono-font tracking-widest opacity-70">{label}</div>
      <div className={`text-3xl font-bold mt-1 ${mono ? "mono-font" : ""}`}>{value}</div>
    </div>
  );
}

function BetModal({ match, onClose }) {
  const [selectedMarket, setSelectedMarket] = useState("h2h");
  const [selected, setSelected] = useState(null);
  const [stake, setStake] = useState("");
  const [details, setDetails] = useState(null);
  const [detailsStatus, setDetailsStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDetailsStatus("loading");
      try {
        const res = await fetch(`${API_BASE}/api/event/${match.sport_key}/${match.id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) {
          setDetails(json);
          setDetailsStatus("ok");
        }
      } catch (err) {
        if (!cancelled) setDetailsStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [match.id, match.sport_key]);

  const markets = useMemo(() => {
    if (!details?.bookmakers) return [];
    const map = {};
    for (const bm of details.bookmakers) {
      for (const market of bm.markets || []) {
        if (!map[market.key]) {
          map[market.key] = { key: market.key, outcomes: {} };
        }
        for (const oc of market.outcomes || []) {
          const ocKey = oc.name + (oc.point !== undefined ? `_${oc.point}` : "");
          const existing = map[market.key].outcomes[ocKey];
          if (!existing || oc.price > existing.odd) {
            map[market.key].outcomes[ocKey] = {
              name: oc.name,
              point: oc.point,
              odd: oc.price,
              bookmaker: bm.title,
            };
          }
        }
      }
    }
    return Object.values(map).map((m) => ({
      ...m,
      outcomes: Object.values(m.outcomes),
    }));
  }, [details]);

  const marketLabel = (key) => {
    const labels = {
      h2h: "Wedstrijdwinnaar (1X2)",
      h2h_3_way: "Wedstrijdwinnaar (3-weg)",
      spreads: "Handicap",
      totals: "Over / Under",
      btts: "Beide ploegen scoren",
      draw_no_bet: "Draw No Bet",
    };
    return labels[key] || key;
  };

  const outcomeLabel = (oc, marketKey) => {
    if (marketKey === "totals") {
      return `${oc.name === "Over" ? "Boven" : "Onder"} ${oc.point}`;
    }
    if (marketKey === "spreads") {
      const sign = oc.point > 0 ? "+" : "";
      return `${oc.name} (${sign}${oc.point})`;
    }
    if (oc.name === "Draw") return "Gelijkspel";
    return oc.name;
  };

  const stakeNum = parseFloat(stake) || 0;
  const odd = selected?.odd || 0;
  const potential = stakeNum * odd;

  const currentMarket = markets.find((m) => m.key === selectedMarket);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-800 p-4 flex items-center justify-between z-10">
          <div className="min-w-0">
            <div className="text-xs mono-font text-cyan-400 tracking-wider truncate">{match.sport_group.toUpperCase()} · {getLeagueName(match.sport_key).toUpperCase()}</div>
            <div className="font-bold truncate">{match.home_team} <span className="text-zinc-500">vs</span> {match.away_team}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{fmtMatchTime(match.commence_time)}</div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md transition shrink-0">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          {detailsStatus === "loading" && (
            <div className="py-12 flex items-center justify-center text-zinc-500">
              <Loader2 className="animate-spin mr-2" size={18} /> Markten laden...
            </div>
          )}

          {detailsStatus === "error" && (
            <div className="py-8 text-center">
              <AlertCircle className="mx-auto text-red-400 mb-2" size={24} />
              <p className="text-sm text-zinc-400">Kon markten niet laden.</p>
            </div>
          )}

          {detailsStatus === "ok" && markets.length === 0 && (
            <div className="py-8 text-center text-zinc-500 text-sm">
              Geen markten beschikbaar voor deze wedstrijd.
            </div>
          )}

          {detailsStatus === "ok" && markets.length > 0 && (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {markets.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => { setSelectedMarket(m.key); setSelected(null); }}
                    className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                      selectedMarket === m.key ? "bg-cyan-400 text-zinc-950" : "bg-zinc-950 text-zinc-400 hover:text-zinc-100 border border-zinc-800"
                    }`}
                  >
                    {marketLabel(m.key)}
                  </button>
                ))}
              </div>

              {currentMarket && (
                <>
                  <div className="text-xs mono-font text-zinc-500 tracking-wider">SELECTEER UITKOMST</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {currentMarket.outcomes.map((oc, i) => {
                      const ocId = oc.name + (oc.point ?? "");
                      const isSelected = selected?.id === ocId && selected?.marketKey === currentMarket.key;
                      return (
                        <button
                          key={i}
                          onClick={() => setSelected({ id: ocId, marketKey: currentMarket.key, name: outcomeLabel(oc, currentMarket.key), odd: oc.odd })}
                          className={`p-3 rounded-md border transition text-left flex items-center justify-between ${
                            isSelected ? "bg-cyan-400 text-zinc-950 border-cyan-400" : "bg-zinc-950 border-zinc-800 hover:border-zinc-700"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{outcomeLabel(oc, currentMarket.key)}</div>
                            <div className={`text-[10px] mono-font ${isSelected ? "text-zinc-700" : "text-zinc-500"}`}>{oc.bookmaker}</div>
                          </div>
                          <div className="mono-font font-bold text-lg ml-3 shrink-0">{oc.odd.toFixed(2)}</div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {selected && (
                <div className="space-y-3 pt-4 border-t border-zinc-800 animate-fade-up">
                  <div className="bg-zinc-950 border border-zinc-800 rounded-md p-3">
                    <div className="text-[10px] mono-font text-zinc-500 tracking-wider">JE SELECTIE</div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-semibold">{selected.name}</span>
                      <span className="mono-font font-bold text-cyan-400">{selected.odd.toFixed(2)}</span>
                    </div>
                  </div>

                  <label className="block text-xs mono-font text-zinc-500 tracking-wider">INZET</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={stake}
                      onChange={(e) => setStake(e.target.value)}
                      placeholder="0"
                      className="flex-1 px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-md mono-font text-lg focus:border-cyan-400 focus:outline-none"
                    />
                    <button onClick={() => setStake("10")} className="px-3 bg-zinc-800 hover:bg-zinc-700 rounded-md text-xs mono-font">€10</button>
                    <button onClick={() => setStake("50")} className="px-3 bg-zinc-800 hover:bg-zinc-700 rounded-md text-xs mono-font">€50</button>
                    <button onClick={() => setStake("100")} className="px-3 bg-zinc-800 hover:bg-zinc-700 rounded-md text-xs mono-font">€100</button>
                  </div>

                  {stakeNum > 0 && (
                    <div className="bg-cyan-400/5 border border-cyan-400/20 rounded-md p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Inzet:</span>
                        <span className="mono-font">{fmtMoney(stakeNum)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-zinc-400">Quote:</span>
                        <span className="mono-font">{odd.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-cyan-400/20">
                        <span className="font-semibold">Potentiële uitbetaling:</span>
                        <span className="mono-font text-cyan-400 font-bold text-lg">{fmtMoney(potential)}</span>
                      </div>
                    </div>
                  )}

                  <button
                    disabled={stakeNum <= 0}
                    onClick={() => { alert(`Weddenschap geplaatst: ${fmtMoney(stakeNum)} op "${selected.name}"`); onClose(); }}
                    className="w-full py-3 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-bold rounded-md transition shadow-lg shadow-cyan-500/20"
                  >
                    PLAATS WEDDENSCHAP
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-zinc-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-8">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-md flex items-center justify-center">
                <Trophy size={14} className="text-zinc-950" strokeWidth={2.5} />
              </div>
              <span className="display-font text-xl text-cyan-400">INSELBET</span>
            </div>
            <p className="text-sm text-zinc-500 leading-relaxed max-w-sm">
              Inselbet is een toonaangevend platform voor online sportweddenschappen met scherpe odds en een uitgebreid aanbod aan markten.
            </p>
            <div className="flex items-center gap-3 mt-5">
              <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] mono-font text-zinc-400 tracking-wider">SSL · 256-BIT</div>
              <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] mono-font text-zinc-400 tracking-wider">18+</div>
            </div>
          </div>
          <FooterColumn title="Sport" items={["Voetbal", "Tennis", "MMA", "Boksen"]} />
          <FooterColumn title="Account" items={["Mijn weddenschappen", "Storten", "Opnemen", "Geschiedenis"]} />
          <FooterColumn title="Ondersteuning" items={["Help center", "Contact", "Algemene voorwaarden", "Privacybeleid", "Verantwoord spelen"]} />
        </div>
        <div className="pt-6 border-t border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs mono-font text-zinc-600">© 2026 INSELBET · ALLE RECHTEN VOORBEHOUDEN</p>
          <p className="text-xs mono-font text-zinc-600">Speel bewust. 18+</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, items }) {
  return (
    <div>
      <div className="text-xs mono-font text-zinc-400 tracking-widest mb-3">{title.toUpperCase()}</div>
      <ul className="space-y-2">
        {items.map(item => (
          <li key={item}>
            <a href="#" className="text-sm text-zinc-500 hover:text-cyan-400 transition">{item}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
