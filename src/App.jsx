import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  updateDoc,
  deleteDoc, 
  doc, 
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, 
  onAuthStateChanged,
  signInAnonymously,
  signInWithCustomToken,
  signOut
} from 'firebase/auth';
import { 
  Calendar, 
  Clock, 
  Gamepad2, 
  Plus, 
  Trash2, 
  Search, 
  Users, 
  Info,
  ExternalLink,
  User,
  Settings,
  LogOut,
  Shield,
  Compass,
  Lock,
  Palette,
  Sparkles,
  Zap,
  Target,
  Sword,
  Camera,
  Award,
  Crown,
  Video,
  FileCheck,
  AlertTriangle,
  Copy,
  Check,
  Terminal
} from 'lucide-react';

// --- PRODUCTION CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDFHW-ZV5HPxGNJlwbi4Ravrs0tnyRW3Eg",
  authDomain: "gamesync-7fdde.firebaseapp.com",
  projectId: "gamesync-7fdde",
  storageBucket: "gamesync-7fdde.firebasestorage.app",
  messagingSenderId: "209595978385",
  appId: "1:209595978385:web:804bf3167a353073be2530",
  measurementId: "G-Z4RLFK079H"
};

// --- ENVIRONMENT HANDLING ---
const getFirebaseConfig = () => {
  if (typeof __firebase_config !== 'undefined' && __firebase_config) {
    try {
      return JSON.parse(__firebase_config);
    } catch (e) {
      console.error("Failed to parse environment firebase config", e);
    }
  }
  return manualFirebaseConfig;
};

const firebaseConfig = getFirebaseConfig();
const isConfigValid = firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== "AIzaSyDFHW-ZV5HPxGNJlwbi4Ravrs0tnyRW3Eg";

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'community-calendar-production';
const appId = rawAppId.replace(/[^a-zA-Z0-9]/g, '_'); 

// Initialize Firebase safely
let app, auth, db;
if (isConfigValid) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err) {
    console.error("Firebase Initialization Error:", err);
  }
}

const MOCK_ADMIN_DATA = {
  displayName: 'New Player',
  bio: 'Gaming community member.',
  favoriteGames: [],
  joinedGuilds: [],
  isAdmin: false,
  theme: 'light',
  photoUrl: ''
};

const ACHIEVEMENT_LIST = [
  { id: 'first_step', name: 'First Step', desc: 'Join your first guild.', icon: <Shield className="w-5 h-5" /> },
  { id: 'guild_founder', name: 'Guild Founder', desc: 'Create a community.', icon: <Crown className="w-5 h-5" /> },
  { id: 'party_member', name: 'Party Member', desc: 'Join a gaming session.', icon: <Users className="w-5 h-5" /> },
  { id: 'organizer', name: 'Organizer', desc: 'Host a session.', icon: <Calendar className="w-5 h-5" /> }
];

const THEMES = {
  light: {
    id: 'light',
    name: 'Standard Light',
    bg: 'bg-slate-50',
    card: 'bg-white',
    header: 'bg-white',
    sidebar: 'bg-white',
    primary: 'bg-indigo-600',
    accent: 'text-indigo-600',
    border: 'border-slate-100',
    text: 'text-slate-900',
    muted: 'text-slate-500',
    button: 'bg-indigo-600 hover:bg-indigo-700 text-white'
  },
  dark: {
    id: 'dark',
    name: 'Deep Dark',
    bg: 'bg-zinc-950',
    card: 'bg-zinc-900',
    header: 'bg-zinc-900',
    sidebar: 'bg-zinc-900',
    primary: 'bg-indigo-500',
    accent: 'text-indigo-400',
    border: 'border-zinc-800',
    text: 'text-zinc-100',
    muted: 'text-zinc-500',
    button: 'bg-indigo-500 hover:bg-indigo-600 text-white'
  }
};

const App = () => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(isConfigValid);
  const [sessions, setSessions] = useState([]);
  const [guilds, setGuilds] = useState([]);
  const [activeGuildId, setActiveGuildId] = useState('all');
  const [currentView, setCurrentView] = useState('calendar'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGuildModalOpen, setIsGuildModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [permissionError, setPermissionError] = useState(false);
  const [copied, setCopied] = useState(false);

  const [profile, setProfile] = useState(MOCK_ADMIN_DATA);

  const activeTheme = THEMES[profile.theme] || THEMES.light;

  const [formData, setFormData] = useState({
    gameTitle: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '19:00',
    endTime: '21:00',
    guildId: ''
  });

  const [newGuild, setNewGuild] = useState({ name: '', desc: '' });

  useEffect(() => {
    if (!isConfigValid || !auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth error:", error);
      } finally {
        setAuthLoading(false);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    const handleListenerError = (err) => {
      console.warn("Firestore listener error:", err.code);
      if (err.code === 'permission-denied') {
        setPermissionError(true);
      }
    };

    const unsubSessions = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'sessions'), (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setPermissionError(false);
    }, handleListenerError);

    const unsubGuilds = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'guilds'), (snapshot) => {
      setGuilds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, handleListenerError);

    const unsubProfile = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), (docSnap) => {
      if (docSnap.exists()) setProfile(prev => ({ ...prev, ...docSnap.data() }));
    }, handleListenerError);

    return () => { unsubSessions(); unsubGuilds(); unsubProfile(); };
  }, [user]);

  const handleLogout = () => auth && signOut(auth);

  const saveProfile = async (data) => {
    if (!user || !db) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), data, { merge: true });
    } catch (e) {
      if (e.code === 'permission-denied') setPermissionError(true);
    }
  };

  const deleteSession = async (id) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', id));
    } catch (e) {
      if (e.code === 'permission-denied') setPermissionError(true);
    }
  };

  const toggleJoinSession = async (session) => {
    if (!user || !db) return;
    const participants = session.participants || [];
    const isJoined = participants.some(p => p.uid === user.uid);
    const updated = isJoined 
      ? participants.filter(p => p.uid !== user.uid) 
      : [...participants, { uid: user.uid, name: profile.displayName }];
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', session.id), { participants: updated });
    } catch (e) {
      if (e.code === 'permission-denied') setPermissionError(true);
    }
  };

  const handleSubmitSession = async (e) => {
    e.preventDefault();
    if (!user || !db) return;
    const gId = formData.guildId || activeGuildId;
    if (gId === 'all') return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sessions'), {
        ...formData,
        status: 'active',
        guildId: gId,
        userId: user.uid,
        userName: profile.displayName,
        participants: [{ uid: user.uid, name: profile.displayName }],
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
    } catch (e) {
      if (e.code === 'permission-denied') setPermissionError(true);
    }
  };

  const filteredSessionsByDate = useMemo(() => {
    const joined = profile.joinedGuilds || [];
    const filtered = sessions.filter(s => {
      const inGuild = activeGuildId === 'all' ? joined.includes(s.guildId) : s.guildId === activeGuildId;
      const title = s.gameTitle ? String(s.gameTitle).toLowerCase() : '';
      return inGuild && title.includes(searchTerm.toLowerCase());
    }).sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const groups = {};
    filtered.forEach(s => {
      const d = String(s.date);
      if (!groups[d]) groups[d] = [];
      groups[d].push(s);
    });
    return groups;
  }, [sessions, activeGuildId, profile.joinedGuilds, searchTerm]);

  const copyToClipboard = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
    document.body.removeChild(textArea);
  };

  if (!isConfigValid) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
      <Shield className="w-16 h-16 text-amber-500 mb-6" />
      <h2 className="text-3xl font-black uppercase italic mb-4">Configuration Required</h2>
      <p className="text-slate-400 mb-8 max-w-md font-medium">
        Paste your project keys into <code className="bg-black px-2 py-1 rounded text-indigo-400">community-calendar.jsx</code> to enable data syncing.
      </p>
      <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 py-4 rounded-2xl uppercase text-xs tracking-widest transition shadow-lg shadow-indigo-600/20">
        Open Firebase Console
      </a>
    </div>
  );

  if (permissionError) {
    const universalRules = `service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{anyId}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`;

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="bg-slate-800 p-10 rounded-[3rem] border border-slate-700 max-w-2xl shadow-2xl w-full">
          <div className="flex items-center gap-4 mb-8">
            <Lock className="w-12 h-12 text-rose-500" />
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tighter italic leading-none">Permission Denied</h2>
              <p className="text-rose-400 text-[10px] font-black uppercase tracking-widest mt-2">Action Required: Update Firestore Rules</p>
            </div>
          </div>
          
          <p className="text-slate-300 mb-6 font-medium leading-relaxed">
            The previous specific ID rule failed because the <span className="text-indigo-400 italic font-bold">appId</span> has changed. You must use the <span className="text-indigo-400 italic font-bold">Universal Rule</span> below to prevent this from happening again.
          </p>

          <div className="space-y-4 mb-8">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                <Terminal className="w-3 h-3" /> Copy this code:
              </p>
              <button 
                onClick={() => copyToClipboard(universalRules)}
                className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition"
              >
                {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><Copy className="w-3 h-3" /> Copy Universal Rules</>}
              </button>
            </div>
            <pre className="bg-slate-950 p-6 rounded-2xl text-[11px] text-emerald-400 font-mono overflow-x-auto border border-slate-700 leading-relaxed shadow-inner">
              {universalRules}
            </pre>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <a 
              href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/rules`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl uppercase text-xs tracking-widest transition shadow-lg shadow-indigo-600/20"
            >
              Open Rules Tab <ExternalLink className="w-4 h-4" />
            </a>
            <button 
              onClick={() => window.location.reload()} 
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-black py-5 rounded-2xl uppercase text-xs tracking-widest transition"
            >
              I've Updated Rules
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Gamepad2 className="w-12 h-12 text-indigo-500 animate-bounce" /></div>;

  return (
    <div className={`min-h-screen ${activeTheme.bg} ${activeTheme.text} transition-colors duration-500`}>
      <header className={`${activeTheme.header} border-b ${activeTheme.border} sticky top-0 z-40 h-16 shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setCurrentView('calendar')}>
            <Gamepad2 className={`w-8 h-8 ${activeTheme.accent}`} />
            <h1 className="font-black text-xl italic tracking-tight hidden sm:block">GameSync</h1>
          </div>
          <nav className="flex items-center gap-3">
            <button onClick={() => setCurrentView('calendar')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition ${currentView === 'calendar' ? activeTheme.button : 'opacity-40 hover:opacity-100'}`}>Board</button>
            <button onClick={() => setCurrentView('profile')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition ${currentView === 'profile' ? activeTheme.button : 'opacity-40 hover:opacity-100'}`}>Profile</button>
            <button onClick={handleLogout} className="p-2 opacity-40 hover:opacity-100 transition hover:text-rose-500"><LogOut className="w-4 h-4" /></button>
          </nav>
        </div>
      </header>

      <div className="flex">
        <aside className={`w-64 border-r ${activeTheme.border} hidden md:block min-h-[calc(100vh-4rem)] p-4`}>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-30 mb-4">Tactical Guilds</p>
          <button onClick={() => setActiveGuildId('all')} className={`w-full text-left p-3 rounded-xl mb-2 font-bold text-xs transition ${activeGuildId === 'all' ? activeTheme.button : 'hover:bg-slate-500/10'}`}>Global Feed</button>
          {guilds.filter(g => profile.joinedGuilds?.includes(g.id)).map(g => (
            <button key={g.id} onClick={() => setActiveGuildId(g.id)} className={`w-full text-left p-3 rounded-xl mb-2 font-bold text-xs transition ${activeGuildId === g.id ? activeTheme.button : 'hover:bg-slate-500/10'}`}>{String(g.name)}</button>
          ))}
          <button onClick={() => setIsGuildModalOpen(true)} className="w-full text-left p-3 rounded-xl mt-4 border border-dashed border-slate-500/30 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition flex items-center justify-center gap-2">
            <Compass className="w-3 h-3" /> Find Guilds
          </button>
        </aside>

        <main className="flex-1 p-8 max-w-5xl">
          {currentView === 'calendar' ? (
            <>
              <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
                <div>
                  <h2 className="text-5xl font-black tracking-tighter uppercase italic leading-none">{activeGuildId === 'all' ? 'The Hub' : guilds.find(g => g.id === activeGuildId)?.name}</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    Active Deployment Map
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 group-focus-within:opacity-100 transition" />
                    <input type="text" placeholder="Filter games..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`pl-10 pr-4 py-3 rounded-2xl ${activeTheme.card} border ${activeTheme.border} outline-none text-sm w-64 focus:border-indigo-500 transition`} />
                  </div>
                  <button onClick={() => setIsModalOpen(true)} className={`${activeTheme.button} px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest transition shadow-lg shadow-indigo-600/20 active:scale-95`}>+ New Lobby</button>
                </div>
              </div>

              <div className="space-y-12">
                {Object.entries(filteredSessionsByDate).length === 0 ? (
                  <div className={`py-24 text-center opacity-30 border-2 border-dashed ${activeTheme.border} rounded-[4rem]`}>
                    <Calendar className="w-16 h-16 mx-auto mb-6" />
                    <p className="font-black uppercase tracking-[0.3em] text-xs italic">Sector Empty - No active sessions</p>
                  </div>
                ) : Object.entries(filteredSessionsByDate).map(([date, daySessions]) => (
                  <div key={date}>
                    <div className="flex items-center gap-4 mb-8">
                      <span className="text-[11px] font-black uppercase opacity-40 tracking-[0.4em] italic">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                      <div className={`flex-1 h-px ${activeTheme.border}`}></div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {daySessions.map(session => (
                        <SessionCard key={session.id} session={session} user={user} activeTheme={activeTheme} onJoin={() => toggleJoinSession(session)} onDelete={() => deleteSession(session.id)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <ProfileView profile={profile} activeTheme={activeTheme} />
          )}
        </main>
      </div>

      {isGuildModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md transition-all">
          <div className={`${activeTheme.card} border ${activeTheme.border} rounded-[4rem] p-12 max-w-xl w-full shadow-2xl`}>
            <div className="flex justify-between items-start mb-10">
              <div>
                <h3 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Guild Network</h3>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-3">Expand your community reach</p>
              </div>
              <button onClick={() => setIsGuildModalOpen(false)} className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-100 dark:bg-zinc-800 opacity-60 hover:opacity-100 transition hover:rotate-90">✕</button>
            </div>
            <div className="space-y-4 max-h-[50vh] overflow-y-auto mb-10 pr-2">
              {guilds.map(g => (
                <div key={g.id} className={`${activeTheme.bg} p-6 rounded-[2.5rem] border ${activeTheme.border} flex justify-between items-center transition hover:border-indigo-500/50 group`}>
                  <div>
                    <p className="font-black uppercase tracking-tight text-sm group-hover:text-indigo-500 transition">{String(g.name)}</p>
                    <p className="text-[10px] opacity-40 font-bold uppercase mt-1 tracking-tight">{String(g.description || 'Public Strategic Hub')}</p>
                  </div>
                  <button onClick={async () => {
                    const joined = profile.joinedGuilds || [];
                    const updated = joined.includes(g.id) ? joined.filter(id => id !== g.id) : [...joined, g.id];
                    await saveProfile({ ...profile, joinedGuilds: updated });
                  }} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition active:scale-95 ${profile.joinedGuilds?.includes(g.id) ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : activeTheme.button}`}>
                    {profile.joinedGuilds?.includes(g.id) ? 'Leave' : 'Join'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md transition-all">
          <div className={`${activeTheme.card} border ${activeTheme.border} rounded-[4rem] p-12 max-w-lg w-full shadow-2xl`}>
            <div className="flex justify-between items-start mb-10">
              <div>
                <h3 className="text-4xl font-black uppercase italic tracking-tighter leading-none">New Lobby</h3>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-3">Summon your vanguard team</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-100 dark:bg-zinc-800 opacity-60 hover:opacity-100 transition hover:rotate-90">✕</button>
            </div>
            <form onSubmit={handleSubmitSession} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-4">Primary Objective</label>
                <input placeholder="GAME TITLE / OPERATION" className={`w-full p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none font-black uppercase focus:border-indigo-500 transition text-sm`} value={formData.gameTitle} onChange={e => setFormData({...formData, gameTitle: e.target.value})} required />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-4">Deployment Date</label>
                  <input type="date" className={`w-full p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black focus:border-indigo-500 transition`} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-4">Launch Time (EST)</label>
                  <input type="time" className={`w-full p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black focus:border-indigo-500 transition`} value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-4">Command Guild</label>
                <select className={`w-full p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black uppercase focus:border-indigo-500 transition`} value={formData.guildId} onChange={e => setFormData({...formData, guildId: e.target.value})} required>
                  <option value="">Select Command Center</option>
                  {guilds.filter(g => profile.joinedGuilds?.includes(g.id)).map(g => (
                    <option key={g.id} value={g.id}>{String(g.name)}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className={`w-full py-5 rounded-3xl ${activeTheme.button} font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-600/20 active:scale-95 transition mt-4`}>Establish Deployment</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const SessionCard = ({ session, user, onJoin, onDelete, activeTheme }) => {
  const participants = session.participants || [];
  const isJoined = user && participants.some(p => p.uid === user.uid);
  const isHost = user && session.userId === user.uid;
  return (
    <div className={`${activeTheme.card} border ${activeTheme.border} rounded-[3rem] p-8 shadow-sm transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 group`}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h4 className="text-2xl font-black italic uppercase leading-none group-hover:text-indigo-600 transition-colors">{String(session.gameTitle)}</h4>
          <div className="flex items-center gap-2 mt-3 opacity-40">
            <Clock className="w-3 h-3" />
            <span className="text-[10px] font-black uppercase tracking-widest">{String(session.startTime)} EST</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-10">
        {participants.map((p, i) => (
          <div key={i} className={`flex items-center gap-2 text-[9px] font-black px-4 py-2 rounded-full ${activeTheme.bg} border ${activeTheme.border} uppercase transition hover:border-emerald-500/50`}>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            {String(p.name)}
          </div>
        ))}
      </div>
      <div className="flex gap-4">
        <button onClick={onJoin} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition active:scale-95 ${isJoined ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-lg shadow-rose-500/5' : activeTheme.button + ' shadow-lg shadow-indigo-600/10'}`}>
          {isJoined ? 'Leave Operation' : 'Join Quest'}
        </button>
        {isHost && (
          <button onClick={onDelete} className="p-4 rounded-2xl bg-slate-100 dark:bg-zinc-800 opacity-40 hover:opacity-100 hover:text-rose-500 transition active:scale-90">
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

const ProfileView = ({ profile, activeTheme }) => (
  <div className={`${activeTheme.card} border ${activeTheme.border} rounded-[5rem] p-16 text-center relative overflow-hidden shadow-2xl`}>
    <div className="absolute top-0 left-0 w-full h-40 bg-indigo-600/5 border-b border-indigo-600/5"></div>
    <div className="relative pt-8">
      <div className={`${activeTheme.primary} w-40 h-40 mx-auto mb-8 rounded-[3rem] flex items-center justify-center text-white text-6xl font-black shadow-2xl shadow-indigo-600/30 ring-8 ring-white dark:ring-zinc-900`}>{String(profile.displayName).charAt(0)}</div>
      <h2 className="text-5xl font-black italic uppercase tracking-tighter mb-2 leading-none">{String(profile.displayName)}</h2>
      <p className="text-[11px] font-black uppercase opacity-30 tracking-[0.5em] mb-12 italic">Elite Vanguard Member</p>
    </div>
  </div>
);

export default App;