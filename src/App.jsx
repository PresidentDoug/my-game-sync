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
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
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
  Shield, 
  Compass, 
  Lock, 
  Palette, 
  Zap, 
  LogOut, 
  ExternalLink,
  Check,
  Terminal,
  Crown,
  Award,
  AlertCircle,
  RefreshCw,
  Mail,
  Key,
  User as UserIcon,
  ChevronRight
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
// FORCE RECOGNITION: Bypasses cache by checking for the standard Firebase prefix
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
  // Auth State
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authForm, setAuthForm] = useState({ email: '', password: '', displayName: '' });
  const [authError, setAuthError] = useState(null);

  // App State
  const [sessions, setSessions] = useState([]);
  const [guilds, setGuilds] = useState([]);
  const [activeGuildId, setActiveGuildId] = useState('all');
  const [currentView, setCurrentView] = useState('calendar'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGuildModalOpen, setIsGuildModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newGuild, setNewGuild] = useState({ name: '', desc: '' });

  const [profile, setProfile] = useState({
    displayName: 'Operator',
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

  // 1. Monitor Authentication State
  useEffect(() => {
    if (!isConfigValid || !auth) {
      setAuthLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Sync Profile and Data once Logged In
  useEffect(() => {
    if (!user || !db) return;

    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');

    const initProfile = async () => {
      const snap = await getDoc(profileRef);
      if (!snap.exists()) {
        await setDoc(profileRef, {
          displayName: authForm.displayName || `Operator_${user.uid.slice(0, 4)}`,
          joinedGuilds: [],
          theme: 'light',
          createdAt: serverTimestamp()
        });
      }
    };
    initProfile();

    const unsubSessions = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'sessions'), (snap) => {
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubGuilds = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'guilds'), (snap) => {
      setGuilds(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubProfile = onSnapshot(profileRef, (snap) => {
      if (snap.exists()) setProfile(prev => ({ ...prev, ...snap.data() }));
    });

    return () => { unsubSessions(); unsubGuilds(); unsubProfile(); };
  }, [user]);

  // Auth Actions
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      if (authMode === 'register') {
        await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      }
    } catch (err) {
      let msg = err.message;
      if (err.code === 'auth/invalid-credential') msg = "Invalid email or password.";
      if (err.code === 'auth/email-already-in-use') msg = "This email is already registered.";
      if (err.code === 'auth/weak-password') msg = "Password must be at least 6 characters.";
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => auth && signOut(auth);

  const saveProfile = async (data) => {
    if (!user || !db) return;
    setProfileSaving(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), data, { merge: true });
    } finally {
      setTimeout(() => setProfileSaving(false), 800);
    }
  };

  const createGuild = async () => {
    if (!newGuild.name || !user || !db) return;
    const gRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'guilds'), {
      ...newGuild, ownerId: user.uid, createdAt: serverTimestamp()
    });
    const updatedJoined = [...(profile.joinedGuilds || []), gRef.id];
    await saveProfile({ ...profile, joinedGuilds: updatedJoined });
    setNewGuild({ name: '', desc: '' });
    setIsGuildModalOpen(false);
  };

  const toggleJoinSession = async (session) => {
    if (!db || !user) return;
    const participants = session.participants || [];
    const isJoined = participants.some(p => p.uid === user.uid);
    const updated = isJoined 
      ? participants.filter(p => p.uid !== user.uid) 
      : [...participants, { uid: user.uid, name: profile.displayName }];
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', session.id), { participants: updated });
  };

  const handleSubmitSession = async (e) => {
    e.preventDefault();
    if (!db || !user) return;
    const gId = formData.guildId || activeGuildId;
    if (gId === 'all') return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sessions'), {
      ...formData,
      status: 'active',
      guildId: gId,
      userId: user.uid,
      userName: String(profile.displayName),
      participants: [{ uid: user.uid, name: String(profile.displayName) }],
      createdAt: serverTimestamp()
    });
    setIsModalOpen(false);
  };

  const filteredSessionsByDate = useMemo(() => {
    const joined = profile.joinedGuilds || [];
    const filtered = sessions.filter(s => {
      const inGuild = activeGuildId === 'all' ? joined.includes(s.guildId) : s.guildId === activeGuildId;
      const gameTitle = s.gameTitle ? String(s.gameTitle).toLowerCase() : '';
      return inGuild && gameTitle.includes(searchTerm.toLowerCase());
    }).sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const groups = {};
    filtered.forEach(s => {
      const d = String(s.date);
      if (!groups[d]) groups[d] = [];
      groups[d].push(s);
    });
    return groups;
  }, [sessions, activeGuildId, profile.joinedGuilds, searchTerm]);

  // View Protections
  if (!isConfigValid) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
      <Shield className="w-16 h-16 text-rose-500 mb-6" />
      <h2 className="text-3xl font-black uppercase italic mb-4">Identity Sync Error</h2>
      <p className="text-slate-400 mb-8 max-w-md">Your API keys are missing or invalid. Check your `src/App.jsx` file.</p>
    </div>
  );

  if (authLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Gamepad2 className="w-12 h-12 text-indigo-500 animate-bounce" /></div>;

  // LOGIN SCREEN
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white">
        <div className="w-full max-w-md bg-zinc-900 p-12 rounded-[4rem] border border-zinc-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600 animate-pulse"></div>
          
          <div className="text-center mb-10">
            <Gamepad2 className="w-16 h-16 text-indigo-500 mx-auto mb-6" />
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">GameSync</h1>
            <p className="text-[10px] uppercase font-black tracking-[0.3em] opacity-30 mt-2">Operator Identity Registry</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
              <div className="relative group">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 group-focus-within:opacity-100 transition" />
                <input 
                  type="text" placeholder="DISPLAY NAME" required 
                  className="w-full bg-black border border-zinc-800 p-5 pl-14 rounded-2xl outline-none focus:border-indigo-500 transition text-xs font-black uppercase"
                  value={authForm.displayName} onChange={e => setAuthForm({...authForm, displayName: e.target.value})}
                />
              </div>
            )}
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 group-focus-within:opacity-100 transition" />
              <input 
                type="email" placeholder="EMAIL ADDRESS" required 
                className="w-full bg-black border border-zinc-800 p-5 pl-14 rounded-2xl outline-none focus:border-indigo-500 transition text-xs font-black uppercase"
                value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})}
              />
            </div>
            <div className="relative group">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 group-focus-within:opacity-100 transition" />
              <input 
                type="password" placeholder="PASSWORD" required 
                className="w-full bg-black border border-zinc-800 p-5 pl-14 rounded-2xl outline-none focus:border-indigo-500 transition text-xs font-black uppercase"
                value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})}
              />
            </div>

            {authError && (
              <div className="flex items-center gap-2 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[10px] text-rose-500 font-bold uppercase">
                <AlertCircle className="w-3 h-3" /> {authError}
              </div>
            )}

            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 p-6 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-600/20 transition active:scale-95 mt-6 flex items-center justify-center gap-2">
              {authMode === 'login' ? 'Establish Link' : 'Initialize Identity'} <ChevronRight className="w-4 h-4" />
            </button>
          </form>

          <button 
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} 
            className="w-full mt-10 text-[10px] font-black uppercase opacity-30 hover:opacity-100 transition tracking-widest"
          >
            {authMode === 'login' ? "New Operator? Create Registry" : "Have an Identity? Sign In"}
          </button>
        </div>
      </div>
    );
  }

  // MAIN APP
  return (
    <div className={`min-h-screen ${activeTheme.bg} ${activeTheme.text} transition-colors duration-500`}>
      <header className={`${activeTheme.header} border-b ${activeTheme.border} sticky top-0 z-40 h-16 shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setCurrentView('calendar')}>
            <Gamepad2 className={`w-8 h-8 ${activeTheme.accent}`} />
            <h1 className="font-black text-xl italic tracking-tight hidden sm:block uppercase">GameSync</h1>
          </div>
          <nav className="flex items-center gap-3">
            <button onClick={() => setCurrentView('calendar')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition ${currentView === 'calendar' ? activeTheme.button : 'opacity-40 hover:opacity-100'}`}>Hub</button>
            <button onClick={() => setCurrentView('profile')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition ${currentView === 'profile' ? activeTheme.button : 'opacity-40 hover:opacity-100'}`}>Operator</button>
            <button onClick={handleLogout} className="p-2 opacity-40 hover:opacity-100 transition hover:text-rose-500"><LogOut className="w-4 h-4" /></button>
          </nav>
        </div>
      </header>

      <div className="flex">
        <aside className={`w-64 border-r ${activeTheme.border} hidden md:block min-h-[calc(100vh-4rem)] p-6`}>
          <div className="mb-10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 mb-5">Command Stream</p>
            <button onClick={() => setActiveGuildId('all')} className={`w-full text-left p-3 rounded-xl mb-2 font-black text-xs transition ${activeGuildId === 'all' ? activeTheme.button : 'hover:bg-slate-500/10'}`}>Global Comms</button>
          </div>
          <div className="mb-10">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 mb-5">Verified Guilds</p>
            {guilds.filter(g => profile.joinedGuilds?.includes(g.id)).map(g => (
              <button key={g.id} onClick={() => setActiveGuildId(g.id)} className={`w-full text-left p-3 rounded-xl mb-2 font-bold text-xs transition ${activeGuildId === g.id ? activeTheme.button : 'hover:bg-slate-500/10'}`}>{String(g.name)}</button>
            ))}
          </div>
          <button onClick={() => setIsGuildModalOpen(true)} className="w-full p-4 rounded-xl border border-dashed border-slate-500/30 text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition flex items-center justify-center gap-2">
            <Compass className="w-4 h-4" /> Discover Guilds
          </button>
        </aside>

        <main className="flex-1 p-8 max-w-5xl">
          {currentView === 'calendar' ? (
            <>
              <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
                <div>
                  <h2 className="text-5xl font-black tracking-tighter uppercase italic leading-none">{activeGuildId === 'all' ? 'The Hub' : guilds.find(g => g.id === activeGuildId)?.name}</h2>
                  <div className="flex items-center gap-3 mt-4">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Active Deployment Feed</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" />
                    <input type="text" placeholder="Filter operations..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`pl-10 pr-4 py-3 rounded-2xl ${activeTheme.card} border ${activeTheme.border} outline-none text-sm w-64 focus:border-indigo-500 transition shadow-sm`} />
                  </div>
                  <button onClick={() => setIsModalOpen(true)} className={`${activeTheme.button} px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest transition shadow-lg`}>+ New Mission</button>
                </div>
              </div>

              <div className="space-y-12">
                {Object.entries(filteredSessionsByDate).map(([date, daySessions]) => (
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
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                {String(p.name)}
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-4">
                            <button onClick={() => toggleJoinSession(session)} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition active:scale-95 ${session.participants?.some(p => p.uid === user?.uid) ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : activeTheme.button}`}>
                              {session.participants?.some(p => p.uid === user?.uid) ? 'Leave Operation' : 'Enlist Now'}
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
            <div className="max-w-2xl mx-auto">
              <div className={`${activeTheme.card} border ${activeTheme.border} rounded-[5rem] p-16 text-center relative overflow-hidden shadow-2xl`}>
                <div className="absolute top-0 left-0 w-full h-40 bg-indigo-600/5 border-b border-indigo-600/10"></div>
                <div className="relative pt-8">
                  <div className={`w-40 h-40 mx-auto mb-10 rounded-[3rem] bg-indigo-600 flex items-center justify-center text-white text-6xl font-black shadow-2xl ring-8 ring-white dark:ring-zinc-900`}>{String(profile.displayName).charAt(0)}</div>
                  
                  <div className="space-y-6 max-w-sm mx-auto mb-12 text-left">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 ml-4">Identity Matrix</label>
                    <div className="relative group">
                      <input 
                        type="text" 
                        value={profile.displayName} 
                        onChange={e => setProfile({...profile, displayName: e.target.value})}
                        className={`w-full p-6 rounded-[2rem] ${activeTheme.bg} border ${activeTheme.border} outline-none font-black uppercase italic text-lg focus:border-indigo-500 transition shadow-inner`}
                      />
                      {profileSaving && <RefreshCw className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 animate-spin" />}
                    </div>
                    <button 
                      onClick={() => saveProfile(profile)} 
                      className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest ${activeTheme.button}`}
                    >
                      Sync Configuration
                    </button>
                  </div>
                  
                  <div className="pt-8 border-t border-slate-500/10 grid grid-cols-2 gap-6">
                    <button onClick={() => saveProfile({...profile, theme: 'light'})} className={`flex flex-col items-center gap-4 p-8 rounded-[3rem] border-2 transition ${profile.theme === 'light' ? 'border-indigo-600 bg-white shadow-xl' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                      <Palette className="w-8 h-8 text-indigo-600" />
                      <span className="text-[10px] font-black uppercase">Standard</span>
                    </button>
                    <button onClick={() => saveProfile({...profile, theme: 'dark'})} className={`flex flex-col items-center gap-4 p-8 rounded-[3rem] border-2 transition ${profile.theme === 'dark' ? 'border-indigo-400 bg-zinc-900 shadow-xl shadow-black/50' : 'border-transparent opacity-40 hover:opacity-100'}`}>
                      <Zap className="w-8 h-8 text-indigo-400" />
                      <span className="text-[10px] font-black uppercase">Midnight</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {isGuildModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className={`${activeTheme.card} border ${activeTheme.border} rounded-[4rem] p-12 max-w-2xl w-full shadow-2xl`}>
            <div className="flex justify-between items-start mb-10">
              <h3 className="text-4xl font-black uppercase italic tracking-tighter">Guild Directory</h3>
              <button onClick={() => setIsGuildModalOpen(false)} className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-500/10 hover:rotate-90 transition">✕</button>
            </div>
            
            <div className="space-y-4 max-h-[40vh] overflow-y-auto mb-10 pr-2">
              {guilds.map(g => (
                <div key={g.id} className={`${activeTheme.bg} p-6 rounded-[2.5rem] border ${activeTheme.border} flex justify-between items-center transition hover:border-indigo-500/40 group`}>
                  <div>
                    <p className="font-black uppercase tracking-tight text-sm group-hover:text-indigo-500 transition">{String(g.name)}</p>
                    <p className="text-[10px] opacity-40 font-bold uppercase mt-1 tracking-tight">{String(g.desc || 'Public Ops Center')}</p>
                  </div>
                  <button onClick={async () => {
                    const joined = profile.joinedGuilds || [];
                    const updated = joined.includes(g.id) ? joined.filter(id => id !== g.id) : [...joined, g.id];
                    await saveProfile({ ...profile, joinedGuilds: updated });
                  }} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition active:scale-95 ${profile.joinedGuilds?.includes(g.id) ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : activeTheme.button}`}>
                    {profile.joinedGuilds?.includes(g.id) ? 'Retire' : 'Enlist'}
                  </button>
                </div>
              ))}
            </div>

            <div className={`pt-10 border-t ${activeTheme.border} space-y-4`}>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40 text-center">Establish New Command Center</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input placeholder="GUILD NAME" className={`p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black uppercase focus:border-indigo-500`} value={newGuild.name} onChange={e => setNewGuild({...newGuild, name: e.target.value})} />
                <input placeholder="SECTOR DESCRIPTION" className={`p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black uppercase focus:border-indigo-500`} value={newGuild.desc} onChange={e => setNewGuild({...newGuild, desc: e.target.value})} />
              </div>
              <button onClick={createGuild} className={`w-full py-5 rounded-3xl ${activeTheme.button} font-black uppercase text-xs tracking-widest shadow-xl`}>Commission Guild</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className={`${activeTheme.card} border ${activeTheme.border} rounded-[4rem] p-12 max-w-lg w-full shadow-2xl`}>
            <div className="flex justify-between items-start mb-10">
              <h3 className="text-4xl font-black uppercase italic tracking-tighter">New Mission</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-500/10 hover:rotate-90 transition">✕</button>
            </div>
            <form onSubmit={handleSubmitSession} className="space-y-6">
              <input placeholder="MISSION / GAME NAME" className={`w-full p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none font-black uppercase focus:border-indigo-500 transition text-sm`} value={formData.gameTitle} onChange={e => setFormData({...formData, gameTitle: e.target.value})} required />
              <div className="grid grid-cols-2 gap-6">
                <input type="date" className={`p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black`} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                <input type="time" className={`p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black`} value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
              </div>
              <select className={`w-full p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black uppercase`} value={formData.guildId} onChange={e => setFormData({...formData, guildId: e.target.value})} required>
                <option value="">Select Command Guild</option>
                {guilds.filter(g => profile.joinedGuilds?.includes(g.id)).map(g => (
                  <option key={g.id} value={g.id}>{String(g.name)}</option>
                ))}
              </select>
              <button type="submit" className={`w-full py-5 rounded-3xl ${activeTheme.button} font-black uppercase text-xs tracking-widest active:scale-95 shadow-xl mt-4`}>Deploy Mission</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;