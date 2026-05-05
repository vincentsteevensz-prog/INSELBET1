import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Trophy, Flame, Clock, Wallet, ChevronRight, Zap, BarChart3, ArrowUpRight, Activity, Search, RefreshCw, AlertCircle, Loader2, LogOut, Eye, EyeOff, Plus, Minus, Ban, ShieldCheck, X, ChevronDown, Receipt, Trash2, CheckCircle2, XCircle, RotateCcw, Hourglass, TrendingUp, TrendingDown } from "lucide-react";

const API_BASE = "https://mute-paper-7180-inselbetapi.vincentsteevensz.workers.dev";
const REFRESH_INTERVAL_MS = 30_000;
const SCORES_REFRESH_MS = 60_000;
const CANCEL_BUFFER_MS = 5 * 60 * 1000;

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

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("nl-NL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
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
    home_team: apiMatch.home_team,
    away_team: apiMatch.away_team,
    commence_time: apiMatch.commence_time,
    options,
    isLive: isLive(apiMatch.commence_time),
  };
};

const getLeagueName = (sportKey) => ({
  soccer_germany_bundesliga: "Bundesliga",
  soccer_germany_bundesliga2: "2. Bundesliga",
  soccer_epl: "Premier League",
  soccer_netherlands_eredivisie: "Eredivisie",
  soccer_uefa_champs_league: "Champions League",
  soccer_uefa_europa_league: "Europa League",
  soccer_spain_la_liga: "La Liga",
  soccer_italy_serie_a: "Serie A",
  soccer_france_ligue_one: "Ligue 1",
}[sportKey] || sportKey);

// === API CLIENT ===
const TOKEN_KEY = "inselbet_token";
const api = {
  getToken: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  setToken: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch {} },
  clearToken: () => { try { localStorage.removeItem(TOKEN_KEY); } catch {} },
  async request(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    const token = api.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },
};

// === HOOKS ===
function useMatches() {
  const [data, setData] = useState({ matches: [], fetched_at: null });
  const [status, setStatus] = useState("loading");

  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/matches`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const normalized = (json.matches || []).map(normalizeMatch).filter((m) => m.options.length > 0);
      setData({ matches: normalized, fetched_at: json.fetched_at });
      setStatus("ok");
    } catch (err) { setStatus("error"); }
  }, []);

  useEffect(() => {
    fetchMatches();
    const interval = setInterval(fetchMatches, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  return { ...data, status, refresh: fetchMatches };
}

function useScores() {
  const [scores, setScores] = useState([]);

  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/scores`);
      if (!res.ok) return;
      const json = await res.json();
      setScores(json.scores || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchScores();
    const interval = setInterval(fetchScores, SCORES_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchScores]);

  return { scores, refresh: fetchScores };
}

function useBetSlip() {
  const [selections, setSelections] = useState([]);

  const addSelection = useCallback((sel) => {
    setSelections((prev) => {
      if (prev.find((s) => s.id === sel.id)) return prev;
      const filtered = prev.filter((s) => s.matchId !== sel.matchId);
      return [...filtered, sel];
    });
  }, []);

  const removeSelection = useCallback((id) => {
    setSelections((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const clearSlip = useCallback(() => setSelections([]), []);
  const totalOdd = useMemo(() => selections.reduce((acc, s) => acc * s.odd, 1), [selections]);

  return { selections, addSelection, removeSelection, clearSlip, totalOdd };
}

// Helper: zoek score voor een match
function getScoreForMatch(matchId, scoresList) {
  return scoresList.find((s) => s.id === matchId);
}

// === MAIN APP ===
export default function App() {
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("checking");

  useEffect(() => {
    (async () => {
      const token = api.getToken();
      if (!token) { setAuthStatus("loggedOut"); return; }
      try {
        const data = await api.request("/api/me");
        setUser(data.user);
        setAuthStatus("loggedIn");
      } catch { api.clearToken(); setAuthStatus("loggedOut"); }
    })();
  }, []);

  const refreshUser = useCallback(async () => {
    try { const data = await api.request("/api/me"); setUser(data.user); } catch {}
  }, []);

  const handleLogout = async () => {
    try { await api.request("/api/logout", { method: "POST" }); } catch {}
    api.clearToken();
    setUser(null);
    setAuthStatus("loggedOut");
  };

  const handleAuthSuccess = (token, userData) => {
    api.setToken(token);
    setUser(userData);
    setAuthStatus("loggedIn");
  };

  if (authStatus === "checking") {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="animate-spin text-cyan-400" size={32} /></div>;
  }
  if (authStatus === "loggedOut") return <AuthPage onSuccess={handleAuthSuccess} />;
  return <MainApp user={user} onLogout={handleLogout} refreshUser={refreshUser} />;
}

// ============================================================
// AUTH PAGE
// ============================================================
function AuthPage({ onSuccess }) {
  const [mode, setMode] = useState("login");
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-cyan-400 selection:text-zinc-950" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        .display-font { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.01em; }
        .mono-font { font-family: 'JetBrains Mono', monospace; }
        @keyframes float-orb { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(40px,-30px) scale(1.05); } 66% { transform: translate(-30px,30px) scale(0.95); } }
        .grid-bg { background-image: linear-gradient(rgba(34,211,238,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px); background-size: 48px 48px; }
      `}</style>
      <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden">
        <div className="absolute inset-0 grid-bg" />
        <div className="absolute top-0 -left-40 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl" style={{ animation: "float-orb 18s ease-in-out infinite" }} />
        <div className="absolute bottom-0 -right-40 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-3xl" style={{ animation: "float-orb 22s ease-in-out infinite reverse" }} />
        <div className="relative w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-300 via-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <Trophy size={24} className="text-zinc-950" strokeWidth={2.8} />
              </div>
              <span className="display-font text-4xl text-cyan-400 tracking-wide">INSELBET</span>
            </div>
          </div>
          <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6">
            <div className="flex gap-2 mb-6 p-1 bg-zinc-950 border border-zinc-800 rounded-lg">
              <button onClick={() => setMode("login")} className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${mode === "login" ? "bg-cyan-400 text-zinc-950" : "text-zinc-400 hover:text-zinc-100"}`}>Inloggen</button>
              <button onClick={() => setMode("register")} className={`flex-1 py-2 rounded-md text-sm font-semibold transition ${mode === "register" ? "bg-cyan-400 text-zinc-950" : "text-zinc-400 hover:text-zinc-100"}`}>Registreren</button>
            </div>
            {mode === "login" ? <LoginForm onSuccess={onSuccess} /> : <RegisterForm onSuccess={onSuccess} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginForm({ onSuccess }) {
  const [username, setUsername] = useState(""); const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const data = await api.request("/api/login", { method: "POST", body: JSON.stringify({ username: username.trim(), password }) });
      onSuccess(data.token, data.user);
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs mono-font text-zinc-500 mb-1.5 tracking-wider">GEBRUIKERSNAAM OF E-MAIL</label>
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-md focus:border-cyan-400 focus:outline-none transition" placeholder="naam@example.com" required />
      </div>
      <div>
        <label className="block text-xs mono-font text-zinc-500 mb-1.5 tracking-wider">WACHTWOORD</label>
        <div className="relative">
          <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2.5 pr-10 bg-zinc-950 border border-zinc-800 rounded-md focus:border-cyan-400 focus:outline-none transition" placeholder="••••••••" required />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
      </div>
      {err && <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-md"><AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" /><span className="text-sm text-red-300">{err}</span></div>}
      <button type="submit" disabled={busy} className="w-full py-3 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-zinc-950 font-bold rounded-md transition shadow-lg shadow-cyan-500/20">
        {busy ? <Loader2 className="animate-spin mx-auto" size={18} /> : "INLOGGEN"}
      </button>
    </form>
  );
}

function RegisterForm({ onSuccess }) {
  const [email, setEmail] = useState(""); const [firstName, setFirstName] = useState(""); const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState(""); const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      const data = await api.request("/api/register", { method: "POST", body: JSON.stringify({ email: email.trim(), first_name: firstName.trim(), last_name: lastName.trim(), password }) });
      onSuccess(data.token, data.user);
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs mono-font text-zinc-500 mb-1.5 tracking-wider">VOORNAAM</label>
          <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-md focus:border-cyan-400 focus:outline-none transition" placeholder="Jan" required />
        </div>
        <div>
          <label className="block text-xs mono-font text-zinc-500 mb-1.5 tracking-wider">ACHTERNAAM</label>
          <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-md focus:border-cyan-400 focus:outline-none transition" placeholder="Jansen" required />
        </div>
      </div>
      <div>
        <label className="block text-xs mono-font text-zinc-500 mb-1.5 tracking-wider">E-MAILADRES</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-md focus:border-cyan-400 focus:outline-none transition" placeholder="naam@example.com" required />
      </div>
      <div>
        <label className="block text-xs mono-font text-zinc-500 mb-1.5 tracking-wider">WACHTWOORD</label>
        <div className="relative">
          <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2.5 pr-10 bg-zinc-950 border border-zinc-800 rounded-md focus:border-cyan-400 focus:outline-none transition" placeholder="Min. 6 tekens" required minLength={6} />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">{showPw ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
      </div>
      {err && <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-md"><AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" /><span className="text-sm text-red-300">{err}</span></div>}
      <button type="submit" disabled={busy} className="w-full py-3 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-zinc-950 font-bold rounded-md transition shadow-lg shadow-cyan-500/20">
        {busy ? <Loader2 className="animate-spin mx-auto" size={18} /> : "ACCOUNT AANMAKEN"}
      </button>
    </form>
  );
}

// ============================================================
// MAIN APP
// ============================================================
function MainApp({ user, onLogout, refreshUser }) {
  const [view, setView] = useState("home");
  const matchesData = useMatches();
  const scoresData = useScores();
  const betSlip = useBetSlip();
  const [betsRefreshKey, setBetsRefreshKey] = useState(0);

  const triggerBetsRefresh = () => setBetsRefreshKey((k) => k + 1);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-cyan-400 selection:text-zinc-950" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        .display-font { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.01em; }
        .mono-font { font-family: 'JetBrains Mono', monospace; }
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float-orb { 0%,100% { transform: translate(0,0) scale(1); } 33% { transform: translate(40px,-30px) scale(1.05); } 66% { transform: translate(-30px,30px) scale(0.95); } }
        @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes pop-in { 0% { transform: scale(0.95); opacity: 0; } 50% { transform: scale(1.02); } 100% { transform: scale(1); opacity: 1; } }
        .animate-fade-up { animation: fade-up 0.5s ease-out backwards; }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        .animate-pop { animation: pop-in 0.3s ease-out; }
        .pulse-dot { animation: pulse-dot 1.5s ease-in-out infinite; }
        .grid-bg { background-image: linear-gradient(rgba(34,211,238,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.04) 1px, transparent 1px); background-size: 48px 48px; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #09090b; }
        ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
      `}</style>

      <Navbar view={view} setView={setView} dataStatus={matchesData.status} user={user} onLogout={onLogout} />

      <main className="pb-32">
        {view === "home" && <HomePage setView={setView} matchesData={matchesData} scoresData={scoresData} user={user} betSlip={betSlip} />}
        {view === "matches" && <MatchesPage matchesData={matchesData} betSlip={betSlip} />}
        {view === "live" && <LivePage matchesData={matchesData} scoresData={scoresData} betSlip={betSlip} />}
        {view === "mybets" && <MyBetsPage refreshKey={betsRefreshKey} refreshUser={refreshUser} scoresData={scoresData} />}
        {view === "admin" && user.is_admin && <AdminPage refreshCurrentUser={refreshUser} currentUser={user} />}
      </main>

      <Footer />

      <BetSlip betSlip={betSlip} user={user} refreshUser={refreshUser} onPlaced={triggerBetsRefresh} />
    </div>
  );
}

function Navbar({ view, setView, dataStatus, user, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const items = [
    { id: "home", label: "Home" },
    { id: "matches", label: "Sport" },
    { id: "live", label: "Live", badge: true },
    { id: "mybets", label: "Mijn weddenschappen" },
  ];
  if (user.is_admin) items.push({ id: "admin", label: "Admin", admin: true });

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <button onClick={() => setView("home")} className="flex items-center gap-2.5 group">
              <div className="relative w-9 h-9 bg-gradient-to-br from-cyan-300 via-cyan-400 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/30">
                <Trophy size={18} className="text-zinc-950" strokeWidth={2.8} />
              </div>
              <span className="display-font text-2xl text-cyan-400 tracking-wide">INSELBET</span>
            </button>
            <nav className="hidden md:flex items-center gap-1">
              {items.map(item => (
                <button key={item.id} onClick={() => setView(item.id)}
                  className={`relative px-4 py-2 text-sm font-medium transition rounded-md flex items-center gap-1.5 ${view === item.id ? "text-cyan-400" : "text-zinc-400 hover:text-zinc-100"} ${item.admin ? "border border-amber-500/30 bg-amber-500/5 text-amber-400" : ""}`}>
                  {item.admin && <ShieldCheck size={14} />}
                  {item.label}
                  {item.badge && <div className="relative"><div className="w-1.5 h-1.5 bg-red-500 rounded-full" /><div className="absolute inset-0 w-1.5 h-1.5 bg-red-500 rounded-full pulse-dot" /></div>}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <DataStatusIndicator status={dataStatus} />
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-cyan-400/10 to-cyan-400/5 border border-cyan-400/30 rounded-md">
              <Wallet size={14} className="text-cyan-400" />
              <span className="mono-font text-sm text-cyan-400 font-bold">{fmtMoney(user.balance)}</span>
            </div>
            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)} className="w-9 h-9 rounded-md bg-zinc-900 border border-zinc-800 hover:border-cyan-400/50 flex items-center justify-center font-bold text-cyan-400 transition">
                {user.first_name[0].toUpperCase()}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-md shadow-2xl z-40 overflow-hidden">
                    <div className="px-3 py-2 border-b border-zinc-800">
                      <div className="font-semibold text-sm">{user.first_name} {user.last_name}</div>
                      <div className="text-xs text-zinc-500 truncate">{user.email}</div>
                      {user.is_admin && <div className="mt-1 inline-flex items-center gap-1 text-[10px] mono-font text-amber-400"><ShieldCheck size={10} /> ADMIN</div>}
                    </div>
                    <button onClick={() => { onLogout(); setMenuOpen(false); }} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition flex items-center gap-2">
                      <LogOut size={14} /> Uitloggen
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <nav className="md:hidden flex gap-1 pb-3 -mx-1 overflow-x-auto">
          {items.map(item => (
            <button key={item.id} onClick={() => setView(item.id)}
              className={`shrink-0 px-3 py-1.5 text-sm font-medium rounded-md transition flex items-center gap-1.5 ${view === item.id ? "bg-cyan-400/10 text-cyan-400" : "text-zinc-400"} ${item.admin ? "border border-amber-500/30 text-amber-400" : ""}`}>
              {item.admin && <ShieldCheck size={12} />}
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
  if (status === "loading") return <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 text-xs mono-font text-zinc-500"><Loader2 size={12} className="animate-spin" />SYNCEN</div>;
  if (status === "error") return <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 text-xs mono-font text-red-400"><AlertCircle size={12} />OFFLINE</div>;
  return <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 text-xs mono-font text-emerald-400"><div className="w-1.5 h-1.5 bg-emerald-400 rounded-full pulse-dot" />LIVE</div>;
}

function LiveTicker({ matches }) {
  const items = useMemo(() => {
    if (!matches || matches.length === 0) return ["DATA WORDT GELADEN"];
    return matches.slice(0, 8).map((m) => `${m.home_team.toUpperCase()} VS ${m.away_team.toUpperCase()} · ${fmtMatchTime(m.commence_time).toUpperCase()}`);
  }, [matches]);
  const doubled = [...items, ...items];
  return (
    <div className="border-y border-zinc-800/80 bg-zinc-900/30 overflow-hidden">
      <div className="flex items-center gap-3 py-2.5">
        <div className="shrink-0 flex items-center gap-2 pl-4 sm:pl-6 pr-3 border-r border-zinc-800">
          <div className="relative"><div className="w-2 h-2 bg-red-500 rounded-full" /><div className="absolute inset-0 w-2 h-2 bg-red-500 rounded-full pulse-dot" /></div>
          <span className="text-xs mono-font font-bold text-red-400 tracking-widest">LIVE</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="flex gap-8 whitespace-nowrap" style={{ animation: "ticker 60s linear infinite" }}>
            {doubled.map((item, i) => <span key={i} className="text-xs mono-font text-zinc-400"><span className="text-cyan-400 mr-2">▸</span>{item}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function HomePage({ setView, matchesData, scoresData, user, betSlip }) {
  return (
    <>
      <LiveTicker matches={matchesData.matches} />
      <Hero setView={setView} matchesData={matchesData} user={user} betSlip={betSlip} />
      <FeaturedMatches matchesData={matchesData} scoresData={scoresData} betSlip={betSlip} />
      <UpcomingSection matchesData={matchesData} betSlip={betSlip} />
    </>
  );
}

function Hero({ setView, matchesData, user, betSlip }) {
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
              <span className="text-xs mono-font text-cyan-400 tracking-wider">WELKOM TERUG, {user.first_name.toUpperCase()}</span>
            </div>
            <h1 className="display-font text-6xl sm:text-7xl lg:text-8xl leading-[0.95] mb-6">
              <span className="block">DE BESTE</span>
              <span className="block bg-gradient-to-r from-cyan-300 via-cyan-400 to-cyan-600 bg-clip-text text-transparent">QUOTES</span>
              <span className="block">VOOR ELKE</span>
              <span className="block">WEDSTRIJD</span>
            </h1>
            <p className="text-lg text-zinc-400 max-w-lg mb-8 leading-relaxed">Combineer meerdere selecties voor hogere quotes en grotere uitbetalingen.</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => setView("matches")} className="group inline-flex items-center gap-2 px-6 py-3 bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-bold rounded-md shadow-lg shadow-cyan-500/30 transition">
                <Zap size={16} />BEKIJK WEDSTRIJDEN<ArrowUpRight size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
              </button>
              <button onClick={() => setView("live")} className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md transition">
                <div className="w-2 h-2 bg-red-500 rounded-full pulse-dot" />Live wedden
              </button>
            </div>
            <div className="mt-10 flex items-center gap-6 sm:gap-8 text-sm">
              <div>
                <div className="display-font text-3xl text-cyan-400">{matchesData.matches.length || "—"}</div>
                <div className="text-xs mono-font text-zinc-500 tracking-wider">WEDSTRIJDEN</div>
              </div>
              <div className="w-px h-10 bg-zinc-800" />
              <div>
                <div className="display-font text-3xl text-cyan-400">{fmtMoney(user.balance)}</div>
                <div className="text-xs mono-font text-zinc-500 tracking-wider">JOUW SALDO</div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-5 animate-fade-up" style={{ animationDelay: "0.2s" }}>
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-br from-cyan-400/30 via-cyan-500/10 to-transparent rounded-2xl blur-xl" />
              {matchesData.status === "loading" && <FeaturedSkeleton />}
              {matchesData.status === "ok" && featuredMatch && <FeaturedMatchHero match={featuredMatch} betSlip={betSlip} />}
              {matchesData.status === "ok" && !featuredMatch && <div className="relative bg-zinc-900/80 border border-zinc-800 rounded-2xl p-8 text-center"><p className="text-zinc-400">Geen wedstrijden beschikbaar.</p></div>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeaturedMatchHero({ match, betSlip }) {
  const handleAdd = (opt) => {
    betSlip.addSelection({
      id: `${match.id}-${opt.label}`, matchId: match.id,
      matchName: `${match.home_team} - ${match.away_team}`, league: getLeagueName(match.sport_key),
      sportKey: match.sport_key, selection: opt.label === "Thuis" ? match.home_team : opt.label === "Uit" ? match.away_team : "Gelijkspel",
      selectionTeam: opt.team, odd: opt.odd, commenceTime: match.commence_time,
    });
  };
  const isInSlip = (label) => betSlip.selections.some((s) => s.id === `${match.id}-${label}`);
  return (
    <div className="relative bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          {match.isLive ? (<><div className="w-2 h-2 bg-red-500 rounded-full pulse-dot" /><span className="text-xs mono-font text-red-400 tracking-wider font-bold">LIVE NU</span></>) :
            (<><Flame size={12} className="text-orange-400" /><span className="text-xs mono-font text-orange-400 tracking-wider font-bold">UITGELICHT</span></>)}
        </div>
        <span className="text-xs mono-font text-zinc-500">{fmtMatchTime(match.commence_time)}</span>
      </div>
      <div className="text-xs mono-font text-cyan-400 mb-2 tracking-wider truncate">{getLeagueName(match.sport_key).toUpperCase()}</div>
      <div className="flex items-center justify-between mb-5">
        <div className="text-right flex-1 min-w-0"><div className="text-xl font-bold truncate">{match.home_team}</div></div>
        <div className="px-4 display-font text-2xl text-zinc-600 shrink-0">VS</div>
        <div className="flex-1 min-w-0"><div className="text-xl font-bold truncate">{match.away_team}</div></div>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${match.options.length}, 1fr)` }}>
        {match.options.map((opt, i) => {
          const selected = isInSlip(opt.label);
          return (
            <button key={i} onClick={() => handleAdd(opt)} className={`p-3 rounded-lg border transition ${selected ? "bg-cyan-400 text-zinc-950 border-cyan-400" : "bg-zinc-950 hover:bg-cyan-400 hover:text-zinc-950 border-zinc-800 hover:border-cyan-400"}`}>
              <div className={`text-[11px] truncate ${selected ? "text-zinc-700" : "text-zinc-500"}`}>{opt.label}</div>
              <div className="mono-font font-bold text-lg">{opt.odd.toFixed(2)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FeaturedSkeleton() {
  return (
    <div className="relative bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6">
      <div className="space-y-4 animate-pulse">
        <div className="h-3 bg-zinc-800 rounded w-1/3" />
        <div className="h-8 bg-zinc-800 rounded w-2/3" />
        <div className="grid grid-cols-3 gap-2"><div className="h-16 bg-zinc-800 rounded" /><div className="h-16 bg-zinc-800 rounded" /><div className="h-16 bg-zinc-800 rounded" /></div>
      </div>
    </div>
  );
}

function FeaturedMatches({ matchesData, scoresData, betSlip }) {
  const featured = useMemo(() => {
    const live = matchesData.matches.filter((m) => m.isLive);
    const upcoming = matchesData.matches.filter((m) => !m.isLive);
    return [...live, ...upcoming].slice(0, 4);
  }, [matchesData.matches]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2"><Flame size={16} className="text-orange-400" /><span className="text-xs mono-font text-orange-400 tracking-widest">UITGELICHT</span></div>
          <h2 className="display-font text-4xl sm:text-5xl">TOPWEDSTRIJDEN</h2>
        </div>
      </div>
      {matchesData.status === "loading" && <MatchGridSkeleton />}
      {matchesData.status === "ok" && featured.length === 0 && <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-8 text-center"><p className="text-zinc-500">Momenteel geen wedstrijden beschikbaar.</p></div>}
      {matchesData.status === "ok" && featured.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {featured.map((match, i) => <MatchCard key={match.id} match={match} betSlip={betSlip} scoresData={scoresData} delay={i * 0.08} />)}
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
            <div className="grid grid-cols-3 gap-2"><div className="h-14 bg-zinc-800 rounded" /><div className="h-14 bg-zinc-800 rounded" /><div className="h-14 bg-zinc-800 rounded" /></div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchCard({ match, betSlip, scoresData, delay }) {
  const handleAdd = (opt) => {
    betSlip.addSelection({
      id: `${match.id}-${opt.label}`, matchId: match.id,
      matchName: `${match.home_team} - ${match.away_team}`, league: getLeagueName(match.sport_key),
      sportKey: match.sport_key,
      selection: opt.label === "Thuis" ? match.home_team : opt.label === "Uit" ? match.away_team : "Gelijkspel",
      selectionTeam: opt.team, odd: opt.odd, commenceTime: match.commence_time,
    });
  };
  const isInSlip = (label) => betSlip.selections.some((s) => s.id === `${match.id}-${label}`);

  // Live score voor deze match
  const score = scoresData ? getScoreForMatch(match.id, scoresData.scores) : null;
  const homeScore = score?.scores?.find((s) => s.name === match.home_team)?.score;
  const awayScore = score?.scores?.find((s) => s.name === match.away_team)?.score;
  const showScore = match.isLive && score && homeScore !== undefined && awayScore !== undefined;

  return (
    <div className="group relative bg-zinc-900/40 border border-zinc-800 rounded-xl p-5 transition animate-fade-up" style={{ animationDelay: `${delay}s` }}>
      <div className="flex items-center justify-between mb-4 gap-2">
        <span className="text-xs mono-font text-cyan-400 font-semibold tracking-wider truncate">{getLeagueName(match.sport_key).toUpperCase()}</span>
        <div className={`flex items-center gap-1 text-xs mono-font shrink-0 ${match.isLive ? "text-red-400" : "text-zinc-500"}`}>
          {match.isLive && <div className="w-1.5 h-1.5 bg-red-500 rounded-full pulse-dot" />}
          {fmtMatchTime(match.commence_time)}
        </div>
      </div>

      <div className="flex items-center justify-between mb-5">
        <div className="text-right flex-1 min-w-0"><div className="text-xl font-bold truncate">{match.home_team}</div></div>
        {showScore ? (
          <div className="px-4 shrink-0 flex items-center gap-2">
            <span className="display-font text-3xl text-red-400 mono-font">{homeScore}</span>
            <span className="text-zinc-600">·</span>
            <span className="display-font text-3xl text-red-400 mono-font">{awayScore}</span>
          </div>
        ) : (
          <div className="px-4 shrink-0"><div className="display-font text-2xl text-zinc-600">VS</div></div>
        )}
        <div className="flex-1 min-w-0"><div className="text-xl font-bold truncate">{match.away_team}</div></div>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${match.options.length}, 1fr)` }}>
        {match.options.map((opt, i) => {
          const selected = isInSlip(opt.label);
          return (
            <button key={i} onClick={() => handleAdd(opt)} className={`p-3 rounded-lg border transition text-left ${selected ? "bg-cyan-400 text-zinc-950 border-cyan-400" : "bg-zinc-950 hover:bg-cyan-400 hover:text-zinc-950 border-zinc-800 hover:border-cyan-400"}`}>
              <div className={`text-[11px] truncate ${selected ? "text-zinc-700" : "text-zinc-500"}`}>{opt.label}</div>
              <div className="mono-font font-bold text-lg">{opt.odd.toFixed(2)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UpcomingSection({ matchesData, betSlip }) {
  const upcoming = useMemo(() => matchesData.matches.filter((m) => !m.isLive).slice(0, 8), [matchesData.matches]);
  if (matchesData.status !== "ok" || upcoming.length === 0) return null;
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2"><Clock size={16} className="text-cyan-400" /><span className="text-xs mono-font text-cyan-400 tracking-widest">KOMEND</span></div>
          <h2 className="display-font text-4xl">AANSTAANDE WEDSTRIJDEN</h2>
        </div>
      </div>
      <div className="bg-zinc-900/30 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="divide-y divide-zinc-800">
          {upcoming.map((m) => <QuickMatchRow key={m.id} match={m} betSlip={betSlip} />)}
        </div>
      </div>
    </section>
  );
}

function QuickMatchRow({ match, betSlip }) {
  const handleAdd = (opt) => {
    betSlip.addSelection({
      id: `${match.id}-${opt.label}`, matchId: match.id,
      matchName: `${match.home_team} - ${match.away_team}`, league: getLeagueName(match.sport_key),
      sportKey: match.sport_key,
      selection: opt.label === "Thuis" ? match.home_team : opt.label === "Uit" ? match.away_team : "Gelijkspel",
      selectionTeam: opt.team, odd: opt.odd, commenceTime: match.commence_time,
    });
  };
  const isInSlip = (label) => betSlip.selections.some((s) => s.id === `${match.id}-${label}`);
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="shrink-0 px-2 py-1 bg-zinc-950 border border-zinc-800 rounded text-[10px] mono-font text-cyan-400 tracking-wider truncate max-w-[100px]">{getLeagueName(match.sport_key).toUpperCase()}</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{match.home_team} - {match.away_team}</div>
        <div className="text-xs text-zinc-500 mono-font">{fmtMatchTime(match.commence_time)}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {match.options.map((opt, i) => {
          const selected = isInSlip(opt.label);
          return (
            <button key={i} onClick={() => handleAdd(opt)} className={`px-3 py-1.5 border rounded mono-font text-sm font-semibold min-w-[3rem] text-center transition ${selected ? "bg-cyan-400 text-zinc-950 border-cyan-400" : "bg-zinc-950 border-zinc-800 hover:border-cyan-400 hover:bg-cyan-400/10"}`}>
              {opt.odd.toFixed(2)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MatchesPage({ matchesData, betSlip }) {
  const [filter, setFilter] = useState("alle");
  const leagues = useMemo(() => Array.from(new Set(matchesData.matches.map((m) => m.sport_key))), [matchesData.matches]);
  const filtered = useMemo(() => filter === "alle" ? matchesData.matches : matchesData.matches.filter((m) => m.sport_key === filter), [filter, matchesData.matches]);
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="display-font text-5xl sm:text-6xl">SPORTMARKTEN</h1>
          <p className="text-zinc-500 mt-2">Alle beschikbare wedstrijden en odds.</p>
        </div>
        <button onClick={matchesData.refresh} className="hidden sm:flex items-center gap-2 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-md text-sm transition">
          <RefreshCw size={14} className={matchesData.status === "loading" ? "animate-spin" : ""} /> Verversen
        </button>
      </div>
      {leagues.length > 1 && (
        <div className="flex gap-2 mb-6 -mx-1 px-1 overflow-x-auto pb-1">
          <button onClick={() => setFilter("alle")} className={`shrink-0 px-4 py-2 rounded-md text-sm font-semibold transition ${filter === "alle" ? "bg-cyan-400 text-zinc-950" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>Alle competities</button>
          {leagues.map((sport) => <button key={sport} onClick={() => setFilter(sport)} className={`shrink-0 px-4 py-2 rounded-md text-sm font-semibold transition ${filter === sport ? "bg-cyan-400 text-zinc-950" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>{getLeagueName(sport)}</button>)}
        </div>
      )}
      {matchesData.status === "loading" && <MatchGridSkeleton />}
      {matchesData.status === "ok" && filtered.length === 0 && <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">Geen wedstrijden gevonden.</div>}
      {matchesData.status === "ok" && filtered.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((match, i) => <MatchCard key={match.id} match={match} betSlip={betSlip} delay={Math.min(i * 0.04, 0.4)} />)}
        </div>
      )}
    </section>
  );
}

function LivePage({ matchesData, scoresData, betSlip }) {
  const live = useMemo(() => matchesData.matches.filter((m) => m.isLive), [matchesData.matches]);
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2"><div className="w-2 h-2 bg-red-500 rounded-full pulse-dot" /><span className="text-xs mono-font text-red-400 tracking-widest font-bold">LIVE NU</span></div>
          <h1 className="display-font text-5xl sm:text-6xl">LIVE WEDDEN</h1>
          <p className="text-zinc-500 mt-2">Volg de scores en plaats live weddenschappen.</p>
        </div>
        <div className="hidden sm:block text-right">
          <div className="text-3xl font-bold mono-font text-red-400">{live.length}</div>
          <div className="text-xs mono-font text-zinc-500 tracking-wider">ACTIEVE WEDSTRIJDEN</div>
        </div>
      </div>
      {matchesData.status === "ok" && live.length === 0 && (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-12 text-center">
          <Activity size={32} className="text-zinc-600 mx-auto mb-3" />
          <p className="font-semibold mb-1">Geen live wedstrijden</p>
          <p className="text-sm text-zinc-500">Er zijn momenteel geen wedstrijden live aan de gang.</p>
        </div>
      )}
      {matchesData.status === "ok" && live.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {live.map((match, i) => <MatchCard key={match.id} match={match} betSlip={betSlip} scoresData={scoresData} delay={i * 0.05} />)}
        </div>
      )}
    </section>
  );
}

// ============================================================
// MIJN WEDDENSCHAPPEN
// ============================================================
function MyBetsPage({ refreshKey, refreshUser, scoresData }) {
  const [bets, setBets] = useState([]);
  const [status, setStatus] = useState("loading");
  const [filter, setFilter] = useState("all");
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadBets = useCallback(async () => {
    try {
      const data = await api.request("/api/bets");
      setBets(data.bets);
      setStatus("ok");
    } catch (e) { setStatus("error"); }
  }, []);

  useEffect(() => { loadBets(); }, [loadBets, refreshKey]);

  // Auto-refresh elke 30 sec voor status updates
  useEffect(() => {
    const interval = setInterval(() => loadBets(), 30000);
    return () => clearInterval(interval);
  }, [loadBets]);

  const filtered = useMemo(() => {
    if (filter === "all") return bets;
    if (filter === "open") return bets.filter((b) => b.status === "open");
    if (filter === "settled") return bets.filter((b) => b.status === "won" || b.status === "lost");
    if (filter === "cancelled") return bets.filter((b) => b.status === "cancelled");
    return bets;
  }, [bets, filter]);

  const handleCancel = async (betId) => {
    if (!confirm("Weet je zeker dat je deze weddenschap wilt annuleren? Je inzet wordt teruggestort.")) return;
    try {
      const data = await api.request(`/api/bets/${betId}/cancel`, { method: "POST" });
      showToast(`Inzet teruggestort: ${fmtMoney(data.refunded)}`);
      loadBets();
      refreshUser();
    } catch (e) { showToast(e.message, "error"); }
  };

  // Stats
  const stats = useMemo(() => {
    const open = bets.filter((b) => b.status === "open");
    const won = bets.filter((b) => b.status === "won");
    const lost = bets.filter((b) => b.status === "lost");
    const totalStaked = bets.filter((b) => b.status !== "cancelled").reduce((s, b) => s + b.stake, 0);
    const totalWon = won.reduce((s, b) => s + b.payout, 0);
    const profit = totalWon - won.reduce((s, b) => s + b.stake, 0) - lost.reduce((s, b) => s + b.stake, 0);
    return { open: open.length, won: won.length, lost: lost.length, totalStaked, profit };
  }, [bets]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="display-font text-5xl sm:text-6xl">MIJN WEDDENSCHAPPEN</h1>
        <p className="text-zinc-500 mt-2">Overzicht van openstaande en afgewikkelde weddenschappen.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="OPENSTAAND" value={stats.open} accent="cyan" />
        <StatCard label="GEWONNEN" value={stats.won} accent="emerald" />
        <StatCard label="VERLOREN" value={stats.lost} accent="red" />
        <StatCard label="WINST" value={fmtMoney(stats.profit)} accent={stats.profit >= 0 ? "emerald" : "red"} mono />
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {[
          { id: "all", label: "Alle" },
          { id: "open", label: "Openstaand" },
          { id: "settled", label: "Afgerond" },
          { id: "cancelled", label: "Geannuleerd" },
        ].map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`shrink-0 px-4 py-2 rounded-md text-sm font-semibold transition ${filter === f.id ? "bg-cyan-400 text-zinc-950" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {status === "loading" && <div className="text-center py-12 text-zinc-500"><Loader2 className="animate-spin mx-auto mb-2" size={24} />Laden...</div>}
      {status === "error" && <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4 text-red-300">Kon weddenschappen niet laden</div>}
      {status === "ok" && filtered.length === 0 && (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-12 text-center">
          <BarChart3 size={32} className="text-zinc-600 mx-auto mb-3" />
          <p className="font-semibold mb-1">Geen weddenschappen</p>
          <p className="text-sm text-zinc-500">Plaats je eerste weddenschap bij de wedstrijden.</p>
        </div>
      )}
      {status === "ok" && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((bet) => <BetCard key={bet.id} bet={bet} onCancel={() => handleCancel(bet.id)} scoresData={scoresData} />)}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 left-4 z-50">
          <div className={`px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-xl ${toast.type === "success" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-red-500/20 border-red-500/40 text-red-300"}`}>
            <span className="text-sm font-medium">{toast.msg}</span>
          </div>
        </div>
      )}
    </section>
  );
}

function BetCard({ bet, onCancel, scoresData }) {
  const [expanded, setExpanded] = useState(false);

  const statusInfo = {
    open: { label: "Openstaand", icon: <Hourglass size={14} />, color: "cyan" },
    won: { label: "Gewonnen", icon: <CheckCircle2 size={14} />, color: "emerald" },
    lost: { label: "Verloren", icon: <XCircle size={14} />, color: "red" },
    cancelled: { label: "Geannuleerd", icon: <RotateCcw size={14} />, color: "zinc" },
  }[bet.status] || { label: bet.status, icon: null, color: "zinc" };

  const colorClasses = {
    cyan: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
    emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
    red: "bg-red-500/10 border-red-500/30 text-red-400",
    zinc: "bg-zinc-700/30 border-zinc-700 text-zinc-400",
  }[statusInfo.color];

  // Cancel mogelijk?
  const earliestStart = new Date(bet.earliest_commence_time).getTime();
  const cancelCutoff = earliestStart - CANCEL_BUFFER_MS;
  const canCancel = bet.status === "open" && Date.now() < cancelCutoff;
  const minutesUntilCutoff = Math.max(0, Math.floor((cancelCutoff - Date.now()) / 60000));

  return (
    <div className={`bg-zinc-900/40 border rounded-xl overflow-hidden transition ${bet.status === "won" ? "border-emerald-500/30" : bet.status === "lost" ? "border-red-500/20" : "border-zinc-800"}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold border ${colorClasses}`}>
              {statusInfo.icon}{statusInfo.label}
            </div>
            {bet.selections.length >= 2 && (
              <div className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-400/10 border border-cyan-400/30 rounded-md text-[10px] mono-font text-cyan-400">
                <Zap size={10} />{bet.selections.length}x COMBI
              </div>
            )}
          </div>
          <button onClick={() => setExpanded(!expanded)} className="p-1 text-zinc-500 hover:text-zinc-100 transition">
            <ChevronDown size={18} className={`transition ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Selections preview */}
        <div className="space-y-1 mb-3">
          {(expanded ? bet.selections : bet.selections.slice(0, 1)).map((sel, i) => {
            const score = scoresData ? getScoreForMatch(sel.matchId, scoresData.scores) : null;
            const homeScore = score?.scores?.find((s) => s.name === sel.matchName.split(" - ")[0])?.score;
            const awayScore = score?.scores?.find((s) => s.name === sel.matchName.split(" - ")[1])?.score;
            const showScore = score && homeScore !== undefined && awayScore !== undefined;
            return (
              <div key={i} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{sel.selection}</div>
                  <div className="text-xs text-zinc-500 truncate flex items-center gap-2">
                    <span>{sel.matchName}</span>
                    {showScore && <span className="mono-font text-red-400 font-bold">{homeScore}-{awayScore}</span>}
                  </div>
                </div>
                <div className="mono-font font-bold text-cyan-400 shrink-0">{sel.odd.toFixed(2)}</div>
              </div>
            );
          })}
          {!expanded && bet.selections.length > 1 && (
            <button onClick={() => setExpanded(true)} className="text-xs text-zinc-500 hover:text-cyan-400 transition">
              + {bet.selections.length - 1} meer selectie{bet.selections.length > 2 ? "s" : ""}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-zinc-800">
          <div>
            <div className="text-[10px] mono-font text-zinc-500 tracking-wider">INZET</div>
            <div className="mono-font font-semibold text-sm">{fmtMoney(bet.stake)}</div>
          </div>
          <div>
            <div className="text-[10px] mono-font text-zinc-500 tracking-wider">QUOTE</div>
            <div className="mono-font font-semibold text-sm">{bet.total_odd.toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] mono-font text-zinc-500 tracking-wider">{bet.status === "won" ? "UITBETALING" : bet.status === "cancelled" ? "TERUGGESTORT" : "POTENTIEEL"}</div>
            <div className={`mono-font font-bold ${bet.status === "won" ? "text-emerald-400" : "text-cyan-400"}`}>
              {fmtMoney(bet.status === "open" ? bet.potential_payout : bet.payout || bet.potential_payout)}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-[10px] mono-font text-zinc-600">
            Geplaatst: {fmtDateTime(bet.placed_at)}
          </div>
          {canCancel && (
            <button onClick={onCancel} className="text-xs text-red-400 hover:text-red-300 mono-font font-semibold flex items-center gap-1">
              <X size={12} /> Annuleren
            </button>
          )}
          {bet.status === "open" && !canCancel && (
            <div className="text-[10px] mono-font text-zinc-600">Annuleren niet meer mogelijk</div>
          )}
        </div>
        {bet.status === "open" && canCancel && minutesUntilCutoff > 0 && minutesUntilCutoff < 60 && (
          <div className="mt-2 text-[10px] mono-font text-amber-400">⚠ Annuleren tot {minutesUntilCutoff} min nog mogelijk</div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// BET SLIP
// ============================================================
function BetSlip({ betSlip, user, refreshUser, onPlaced }) {
  const [open, setOpen] = useState(false);
  const [stake, setStake] = useState("");
  const [busy, setBusy] = useState(false);

  const { selections, removeSelection, clearSlip, totalOdd } = betSlip;
  const count = selections.length;
  const stakeNum = parseFloat(stake) || 0;
  const potential = stakeNum * totalOdd;

  useEffect(() => {
    if (count > 0 && !open) setOpen(true);
    if (count === 0) setStake("");
  }, [count]); // eslint-disable-line

  const handlePlace = async () => {
    if (stakeNum <= 0) return;
    if (stakeNum > user.balance) { alert("Onvoldoende saldo"); return; }
    setBusy(true);
    try {
      await api.request("/api/bets", {
        method: "POST",
        body: JSON.stringify({ stake: stakeNum, selections }),
      });
      clearSlip();
      setStake("");
      await refreshUser();
      if (onPlaced) onPlaced();
      setOpen(false);
    } catch (e) {
      alert("Fout: " + e.message);
    } finally { setBusy(false); }
  };

  if (count === 0) return null;

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-bold rounded-full shadow-2xl shadow-cyan-500/30 animate-pop transition">
          <Receipt size={18} /><span>Bet slip</span>
          <div className="bg-zinc-950 text-cyan-400 mono-font text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">{count}</div>
        </button>
      )}
      {open && (
        <div className="fixed bottom-0 right-0 sm:bottom-4 sm:right-4 z-50 w-full sm:w-96 max-h-[85vh] flex flex-col animate-slide-up">
          <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-gradient-to-r from-cyan-400/10 to-transparent">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-cyan-400" /><span className="font-bold">Bet slip</span>
                <div className="bg-cyan-400 text-zinc-950 mono-font text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{count}</div>
              </div>
              <div className="flex items-center gap-1">
                {count > 0 && <button onClick={clearSlip} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition" title="Leegmaken"><Trash2 size={14} /></button>}
                <button onClick={() => setOpen(false)} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition"><ChevronDown size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[40vh]">
              {selections.map((sel) => (
                <div key={sel.id} className="p-3 border-b border-zinc-800 hover:bg-zinc-800/30 transition">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-[10px] mono-font text-cyan-400 tracking-wider truncate">{sel.league.toUpperCase()}</div>
                    <button onClick={() => removeSelection(sel.id)} className="text-zinc-500 hover:text-red-400 shrink-0"><X size={14} /></button>
                  </div>
                  <div className="text-xs text-zinc-500 mb-1 truncate">{sel.matchName}</div>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm truncate">{sel.selection}</div>
                    <div className="mono-font font-bold text-cyan-400 ml-2 shrink-0">{sel.odd.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
            {count >= 2 && (
              <div className="px-4 py-2 bg-cyan-400/5 border-t border-cyan-400/20 flex items-center justify-between">
                <div className="flex items-center gap-2"><Zap size={14} className="text-cyan-400" /><span className="text-xs mono-font text-cyan-400 tracking-wider">{count}x COMBI</span></div>
                <div className="text-xs text-zinc-400">Odds vermenigvuldigd</div>
              </div>
            )}
            <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs mono-font text-zinc-500 tracking-wider">TOTALE QUOTE</span>
                <span className="display-font text-2xl text-cyan-400">{totalOdd.toFixed(2)}</span>
              </div>
              <div className="flex gap-2">
                <input type="number" value={stake} onChange={(e) => setStake(e.target.value)} placeholder="Inzet €" className="flex-1 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-md mono-font text-base focus:border-cyan-400 focus:outline-none" />
                <button onClick={() => setStake(String(Math.floor(user.balance)))} className="px-3 bg-zinc-800 hover:bg-zinc-700 rounded-md text-xs mono-font font-bold" disabled={user.balance <= 0}>MAX</button>
              </div>
              <div className="flex gap-1.5">
                {[5, 10, 25, 50, 100].map((v) => <button key={v} onClick={() => setStake(String(v))} className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded text-[11px] mono-font transition">€{v}</button>)}
              </div>
              {stakeNum > 0 && (
                <div className="flex items-center justify-between p-3 bg-cyan-400/10 border border-cyan-400/30 rounded-md">
                  <span className="text-sm font-semibold">Mogelijke uitbetaling:</span>
                  <span className="mono-font font-bold text-cyan-400 text-lg">{fmtMoney(potential)}</span>
                </div>
              )}
              <button onClick={handlePlace} disabled={stakeNum <= 0 || stakeNum > user.balance || busy} className="w-full py-3 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-bold rounded-md transition shadow-lg shadow-cyan-500/20">
                {busy ? <Loader2 className="animate-spin mx-auto" size={18} /> : stakeNum > user.balance ? "ONVOLDOENDE SALDO" : `PLAATS WEDDENSCHAP · ${fmtMoney(stakeNum)}`}
              </button>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Saldo:</span><span className="mono-font text-cyan-400 font-bold">{fmtMoney(user.balance)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// ADMIN
// ============================================================
function AdminPage({ refreshCurrentUser, currentUser }) {
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("loading");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };
  const loadUsers = useCallback(async () => {
    setStatus("loading");
    try { const data = await api.request("/api/admin/users"); setUsers(data.users); setStatus("ok"); }
    catch (e) { setStatus("error"); }
  }, []);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) => u.email.toLowerCase().includes(q) || u.first_name.toLowerCase().includes(q) || u.last_name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
  }, [users, search]);

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2"><ShieldCheck size={16} className="text-amber-400" /><span className="text-xs mono-font text-amber-400 tracking-widest">ADMIN PANEEL</span></div>
        <h1 className="display-font text-5xl sm:text-6xl">GEBRUIKERS</h1>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="GEBRUIKERS" value={users.length} accent="cyan" />
        <StatCard label="TOTAAL SALDO" value={fmtMoney(users.reduce((s, u) => s + u.balance, 0))} accent="emerald" mono />
        <StatCard label="ADMINS" value={users.filter((u) => u.is_admin).length} accent="amber" />
        <StatCard label="GEBLOKKEERD" value={users.filter((u) => u.banned).length} accent="red" />
      </div>
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Zoek..." className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-md focus:border-cyan-400 focus:outline-none transition" />
      </div>
      {status === "loading" && <div className="text-center py-12 text-zinc-500"><Loader2 className="animate-spin mx-auto mb-2" size={24} />Laden...</div>}
      {status === "ok" && (
        <div className="space-y-2">
          {filtered.map((u) => <UserRow key={u.id} user={u} currentUserId={currentUser.id} onUpdate={loadUsers} showToast={showToast} refreshCurrentUser={refreshCurrentUser} />)}
        </div>
      )}
      {toast && (
        <div className="fixed bottom-4 left-4 z-50">
          <div className={`px-4 py-3 rounded-lg shadow-2xl border backdrop-blur-xl ${toast.type === "success" ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-red-500/20 border-red-500/40 text-red-300"}`}>
            <span className="text-sm font-medium">{toast.msg}</span>
          </div>
        </div>
      )}
    </section>
  );
}

function StatCard({ label, value, accent, mono }) {
  const colors = {
    cyan: "from-cyan-400/10 border-cyan-400/30 text-cyan-400",
    emerald: "from-emerald-400/10 border-emerald-400/30 text-emerald-400",
    amber: "from-amber-400/10 border-amber-400/30 text-amber-400",
    red: "from-red-400/10 border-red-400/30 text-red-400",
  };
  return (
    <div className={`bg-gradient-to-br ${colors[accent]} to-transparent border rounded-lg p-4`}>
      <div className="text-[10px] mono-font tracking-widest opacity-70">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${mono ? "mono-font" : ""}`}>{value}</div>
    </div>
  );
}

function UserRow({ user, currentUserId, onUpdate, showToast, refreshCurrentUser }) {
  const [amount, setAmount] = useState(""); const [busy, setBusy] = useState(false);
  const isMe = user.id === currentUserId;

  const addBalance = async (delta) => {
    const amt = parseFloat(amount);
    if (!amt || isNaN(amt)) return showToast("Voer een geldig bedrag in", "error");
    setBusy(true);
    try {
      await api.request("/api/admin/add-balance", { method: "POST", body: JSON.stringify({ user_id: user.id, amount: delta * Math.abs(amt) }) });
      setAmount("");
      showToast(`${delta > 0 ? "+" : "-"}${fmtMoney(Math.abs(amt))} bij ${user.first_name}`);
      onUpdate();
      if (isMe) refreshCurrentUser();
    } catch (e) { showToast(e.message, "error"); } finally { setBusy(false); }
  };

  const toggleAdmin = async () => {
    if (!confirm(`${user.is_admin ? "Verwijder" : "Geef"} admin rechten ${user.is_admin ? "van" : "aan"} ${user.first_name}?`)) return;
    try { await api.request("/api/admin/toggle-admin", { method: "POST", body: JSON.stringify({ user_id: user.id }) }); showToast("OK"); onUpdate(); }
    catch (e) { showToast(e.message, "error"); }
  };
  const toggleBan = async () => {
    if (!confirm(`${user.banned ? "Deblokkeer" : "Blokkeer"} ${user.first_name}?`)) return;
    try { await api.request("/api/admin/toggle-ban", { method: "POST", body: JSON.stringify({ user_id: user.id }) }); showToast("OK"); onUpdate(); }
    catch (e) { showToast(e.message, "error"); }
  };

  return (
    <div className={`bg-zinc-900/40 border rounded-lg p-4 ${user.banned ? "border-red-500/30" : "border-zinc-800"}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className={`w-10 h-10 rounded-md flex items-center justify-center font-bold shrink-0 ${user.is_admin ? "bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950" : "bg-gradient-to-br from-cyan-400 to-cyan-600 text-zinc-950"}`}>
          {user.first_name[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold flex items-center gap-2 flex-wrap">
            {user.first_name} {user.last_name}
            {user.is_admin && <span className="text-[10px] mono-font px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded inline-flex items-center gap-1"><ShieldCheck size={10} /> ADMIN</span>}
            {user.banned && <span className="text-[10px] mono-font px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded">GEBLOKKEERD</span>}
            {isMe && <span className="text-[10px] mono-font px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 rounded">JIJ</span>}
          </div>
          <div className="text-xs text-zinc-500 truncate">{user.email}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] mono-font text-zinc-500">SALDO</div>
          <div className="mono-font font-bold text-cyan-400">{fmtMoney(user.balance)}</div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center gap-2 flex-wrap">
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Bedrag €" className="flex-1 min-w-[120px] px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md mono-font text-sm focus:border-cyan-400 focus:outline-none" />
        <button onClick={() => addBalance(1)} disabled={busy} className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold rounded-md flex items-center gap-1 transition"><Plus size={12} /> Storten</button>
        <button onClick={() => addBalance(-1)} disabled={busy} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold rounded-md flex items-center gap-1 transition"><Minus size={12} /> Aftrekken</button>
        {!isMe && (
          <>
            <button onClick={toggleAdmin} className={`p-1.5 rounded-md border transition ${user.is_admin ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`} title={user.is_admin ? "Demote" : "Promote"}><ShieldCheck size={14} /></button>
            <button onClick={toggleBan} className={`p-1.5 rounded-md border transition ${user.banned ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-zinc-800 border-zinc-700 text-zinc-400"}`} title={user.banned ? "Deblokkeer" : "Blokkeer"}><Ban size={14} /></button>
          </>
        )}
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-zinc-800 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-md flex items-center justify-center"><Trophy size={14} className="text-zinc-950" strokeWidth={2.5} /></div>
            <span className="display-font text-xl text-cyan-400">INSELBET</span>
          </div>
          <p className="text-xs mono-font text-zinc-600">© 2026 INSELBET</p>
        </div>
      </div>
    </footer>
  );
}
