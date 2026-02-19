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
  getDoc,
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
  Terminal,
  ChevronRight,
  AlertCircle
} from 'lucide-react';

// --- PRODUCTION CONFIGURATION ---
// IMPORTANT: Paste your real keys here!
const manualFirebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

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

// FORCED LOGIC: We check if the key starts with the standard Firebase 'AIza' prefix
// to bypass any issues where the placeholder text 'YOUR_API_KEY' is stuck in cache.
const isConfigValid = !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey.startsWith("AIza"));

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'community-calendar-production';
const appId = rawAppId.replace(/[^a-zA-Z0-9]/g, '_'); 

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

const THEMES = {
  light: {
    id: 'light',
    bg: 'bg-slate-50',
    card: 'bg-white',
    header: 'bg-white',
    accent: 'text-indigo-600',
    border: 'border-slate-100',
    text: 'text-slate-900',
    muted: 'text-slate-500',
    button: 'bg-indigo-600 hover:bg-indigo-700 text-white'
  },
  dark: {
    id: 'dark',
    bg: 'bg-zinc-950',
    card: 'bg-zinc-900',
    header: 'bg-zinc-900',
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
  const [newGuild, setNewGuild] = useState({ name: '', desc: '' });

  const [profile, setProfile] = useState({
    displayName: 'New Player',
    joinedGuilds: [],
    theme: 'light'
  });

  const activeTheme = THEMES[profile.theme] || THEMES.light;

  const [formData, setFormData] = useState({
    gameTitle: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '19:00',
    endTime: '21:00',
    guildId: ''
  });

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
      if (err.code === 'permission-denied') setPermissionError(true);
    };

    const checkProfile = async () => {
      const pRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      const snap = await getDoc(pRef);
      if (!snap.exists()) {
        await setDoc(pRef, {
          displayName: `Player_${user.uid.slice(0, 4)}`,
          joinedGuilds: [],
          theme: 'light',
          createdAt: serverTimestamp()
        });
      }
    };
    checkProfile();

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

  const saveProfile = async (data) => {
    if (!user || !db) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), data, { merge: true });
    } catch (e) {
      if (e.code === 'permission-denied') setPermissionError(true);
    }
  };

  const createGuild = async () => {
    if (!newGuild.name || !user || !db) return;
    try {
      const gRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'guilds'), {
        ...newGuild,
        ownerId: user.uid,
        createdAt: serverTimestamp()
      });
      const updatedJoined = [...(profile.joinedGuilds || []), gRef.id];
      await saveProfile({ ...profile, joinedGuilds: updatedJoined });
      setNewGuild({ name: '', desc: '' });
      setIsGuildModalOpen(false);
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
    document.body.appendChild(textArea);
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
      <AlertCircle className="w-16 h-16 text-rose-500 mb-6" />
      <h2 className="text-3xl font-black uppercase italic mb-4">Configuration Error</h2>
      <p className="text-slate-400 mb-4 max-w-md font-medium">The app is loaded, but your Firebase keys are not being recognized by the browser.</p>
      
      {/* DEBUG PANEL */}
      <div className="bg-black/50 p-6 rounded-2xl font-mono text-[11px] text-rose-400 mb-8 border border-rose-500/20 text-left w-full max-w-md">
        <p className="mb-2 text-rose-300 uppercase font-black tracking-widest text-[9px]">Build Data Sync Debug:</p>
        <p>API Key Detected: {firebaseConfig?.apiKey ? `YES (starts with ${firebaseConfig.apiKey.slice(0, 6)}...)` : "NO"}</p>
        <p>Valid Firebase Prefix? {firebaseConfig?.apiKey?.startsWith("AIza") ? "YES" : "NO"}</p>
        <p>Current Path: {window.location.pathname}</p>
      </div>

      <p className="text-slate-500 text-xs mb-8">If "API Key Detected" says NO but your keys are in VS Code, your GitHub build is serving an old version of the site. Try pushing a fresh commit.</p>
      
      <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 py-4 rounded-2xl uppercase text-xs tracking-widest transition">
        Open Firebase Console
      </a>
    </div>
  );

  if (permissionError) {
    const universalRules = `service cloud.firestore {\n  match /databases/{database}/documents {\n    match /artifacts/{anyId}/{document=**} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}`;
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="bg-slate-800 p-10 rounded-[3rem] border border-slate-700 max-w-2xl shadow-2xl w-full">
          <div className="flex items-center gap-4 mb-8">
            <Lock className="w-12 h-12 text-rose-500" />
            <h2 className="text-3xl font-black uppercase tracking-tighter italic">Permission Denied</h2>
          </div>
          <p className="text-slate-300 mb-6">Update your Firestore Rules with this code:</p>
          <pre className="bg-slate-950 p-6 rounded-2xl text-[11px] text-emerald-400 font-mono overflow-x-auto border border-slate-700 mb-8">{universalRules}</pre>
          <button onClick={() => copyToClipboard(universalRules)} className="w-full bg-indigo-600 py-4 rounded-2xl font-black uppercase text-xs tracking-widest">{copied ? 'Copied!' : 'Copy Rules'}</button>
          <button onClick={() => window.location.reload()} className="w-full mt-4 bg-slate-700 py-4 rounded-2xl font-black uppercase text-xs tracking-widest">Retry Connection</button>
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
            <button onClick={() => auth && signOut(auth)} className="p-2 opacity-40 hover:opacity-100 transition hover:text-rose-500"><LogOut className="w-4 h-4" /></button>
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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 transition" />
                    <input type="text" placeholder="Filter games..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`pl-10 pr-4 py-3 rounded-2xl ${activeTheme.card} border ${activeTheme.border} outline-none text-sm w-64 focus:border-indigo-500 transition`} />
                  </div>
                  <button onClick={() => setIsModalOpen(true)} className={`${activeTheme.button} px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest transition shadow-lg`}>+ New Lobby</button>
                </div>
              </div>

              <div className="space-y-12">
                {Object.entries(filteredSessionsByDate).length === 0 ? (
                  <div className={`py-24 text-center opacity-30 border-2 border-dashed ${activeTheme.border} rounded-[4rem]`}>
                    <Calendar className="w-16 h-16 mx-auto mb-6" />
                    <p className="font-black uppercase tracking-widest text-xs italic">Sector Empty - No active sessions</p>
                  </div>
                ) : Object.entries(filteredSessionsByDate).map(([date, daySessions]) => (
                  <div key={date}>
                    <div className="flex items-center gap-4 mb-8">
                      <span className="text-[11px] font-black uppercase opacity-40 tracking-[0.4em] italic">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                      <div className={`flex-1 h-px ${activeTheme.border}`}></div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {daySessions.map(session => (
                        <div key={session.id} className={`${activeTheme.card} border ${activeTheme.border} rounded-[3rem] p-8 shadow-sm transition hover:shadow-2xl hover:-translate-y-1 group`}>
                          <div className="flex justify-between items-start mb-6">
                            <h4 className="text-2xl font-black italic uppercase leading-none group-hover:text-indigo-600 transition-colors">{String(session.gameTitle)}</h4>
                            <div className="flex items-center gap-2 opacity-40">
                              <Clock className="w-3 h-3" />
                              <span className="text-[10px] font-black uppercase tracking-widest">{String(session.startTime)}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-10">
                            {session.participants?.map((p, i) => (
                              <div key={i} className={`flex items-center gap-2 text-[9px] font-black px-4 py-2 rounded-full ${activeTheme.bg} border ${activeTheme.border} uppercase`}>
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                {String(p.name)}
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-4">
                            <button onClick={() => toggleJoinSession(session)} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition active:scale-95 ${session.participants?.some(p => p.uid === user?.uid) ? 'bg-rose-500/10 text-rose-500' : activeTheme.button}`}>
                              {session.participants?.some(p => p.uid === user?.uid) ? 'Leave Operation' : 'Join Quest'}
                            </button>
                            {session.userId === user?.uid && (
                              <button onClick={() => deleteSession(session.id)} className="p-4 rounded-2xl bg-slate-100 dark:bg-zinc-800 opacity-40 hover:opacity-100 hover:text-rose-500 transition">
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className={`${activeTheme.card} border ${activeTheme.border} rounded-[5rem] p-16 text-center relative overflow-hidden shadow-2xl`}>
              <div className="absolute top-0 left-0 w-full h-40 bg-indigo-600/5 border-b border-indigo-600/5"></div>
              <div className="relative pt-8">
                <div className={`${activeTheme.primary} w-40 h-40 mx-auto mb-8 rounded-[3rem] flex items-center justify-center text-white text-6xl font-black shadow-2xl ring-8 ring-white dark:ring-zinc-900`}>{String(profile.displayName).charAt(0)}</div>
                
                <div className="space-y-4 max-w-sm mx-auto mb-12">
                  <label className="text-[10px] font-black uppercase opacity-30 tracking-widest">Operator Name</label>
                  <input 
                    type="text" 
                    value={profile.displayName} 
                    onChange={e => setProfile({...profile, displayName: e.target.value})}
                    onBlur={() => saveProfile(profile)}
                    className="w-full bg-transparent text-center text-5xl font-black italic uppercase tracking-tighter outline-none focus:text-indigo-600 transition leading-none"
                  />
                </div>
                
                <div className="mt-16 flex justify-center gap-6">
                  <button onClick={() => saveProfile({...profile, theme: 'light'})} className={`flex flex-col items-center gap-4 p-6 rounded-[2.5rem] border-2 transition ${profile.theme === 'light' ? 'border-indigo-600 bg-white shadow-xl' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                    <Palette className="w-8 h-8 text-indigo-600" />
                    <span className="text-[10px] font-black uppercase">Standard</span>
                  </button>
                  <button onClick={() => saveProfile({...profile, theme: 'dark'})} className={`flex flex-col items-center gap-4 p-6 rounded-[2.5rem] border-2 transition ${profile.theme === 'dark' ? 'border-indigo-400 bg-zinc-900 shadow-xl shadow-black/50' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                    <Zap className="w-8 h-8 text-indigo-400" />
                    <span className="text-[10px] font-black uppercase">Midnight</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {isGuildModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md transition-all">
          <div className={`${activeTheme.card} border ${activeTheme.border} rounded-[4rem] p-12 max-w-xl w-full shadow-2xl`}>
            <div className="flex justify-between items-start mb-10">
              <div>
                <h3 className="text-4xl font-black uppercase italic tracking-tighter">Guild Network</h3>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-3">Expand your community reach</p>
              </div>
              <button onClick={() => setIsGuildModalOpen(false)} className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-100 dark:bg-zinc-800 opacity-60 hover:opacity-100 transition hover:rotate-90">✕</button>
            </div>
            <div className="space-y-4 max-h-[40vh] overflow-y-auto mb-10 pr-2 custom-scrollbar">
              {guilds.length === 0 ? <p className="text-center py-10 opacity-30 uppercase font-black text-[10px]">Scanning for available guilds...</p> : guilds.map(g => (
                <div key={g.id} className={`${activeTheme.bg} p-6 rounded-[2.5rem] border ${activeTheme.border} flex justify-between items-center transition group`}>
                  <div>
                    <p className="font-black uppercase tracking-tight text-sm group-hover:text-indigo-500 transition">{String(g.name)}</p>
                    <p className="text-[10px] opacity-40 font-bold uppercase mt-1 tracking-tight">{String(g.desc || 'Public Strategic Hub')}</p>
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
            
            <div className={`pt-10 border-t ${activeTheme.border} space-y-4`}>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40 text-center mb-2">Register a New Command Center</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input 
                  placeholder="GUILD NAME" 
                  className={`w-full p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black uppercase focus:border-indigo-500 transition`} 
                  value={newGuild.name} 
                  onChange={e => setNewGuild({...newGuild, name: e.target.value})} 
                />
                <input 
                  placeholder="DESCRIPTION" 
                  className={`w-full p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black uppercase focus:border-indigo-500 transition`} 
                  value={newGuild.desc} 
                  onChange={e => setNewGuild({...newGuild, desc: e.target.value})} 
                />
              </div>
              <button onClick={createGuild} className={`w-full py-5 rounded-3xl ${activeTheme.button} font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition`}>Commission Guild</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md transition-all">
          <div className={`${activeTheme.card} border ${activeTheme.border} rounded-[4rem] p-12 max-w-lg w-full shadow-2xl`}>
            <div className="flex justify-between items-start mb-10">
              <div>
                <h3 className="text-4xl font-black uppercase italic tracking-tighter">New Lobby</h3>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mt-3">Summon your vanguard team</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-100 dark:bg-zinc-800 opacity-60 hover:opacity-100 transition hover:rotate-90">✕</button>
            </div>
            <form onSubmit={handleSubmitSession} className="space-y-6">
              <input placeholder="GAME TITLE / OPERATION" className={`w-full p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none font-black uppercase focus:border-indigo-500 transition text-sm`} value={formData.gameTitle} onChange={e => setFormData({...formData, gameTitle: e.target.value})} required />
              <div className="grid grid-cols-2 gap-6">
                <input type="date" className={`w-full p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black focus:border-indigo-500 transition`} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                <input type="time" className={`w-full p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black focus:border-indigo-500 transition`} value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
              </div>
              <select className={`w-full p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black uppercase focus:border-indigo-500 transition`} value={formData.guildId} onChange={e => setFormData({...formData, guildId: e.target.value})} required>
                <option value="">Select Command Center</option>
                {guilds.filter(g => profile.joinedGuilds?.includes(g.id)).map(g => (
                  <option key={g.id} value={g.id}>{String(g.name)}</option>
                ))}
              </select>
              <button type="submit" className={`w-full py-5 rounded-3xl ${activeTheme.button} font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition mt-4`}>Establish Deployment</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;