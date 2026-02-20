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
  getDocs,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  writeBatch
} from 'firebase/firestore';
import { 
  getAuth, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  reload
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
  Unlock,
  Palette, 
  Zap, 
  LogOut, 
  AlertCircle, 
  RefreshCw,
  Mail,
  Key,
  User as UserIcon,
  ChevronRight,
  Crown,
  Skull,
  UserPlus,
  Video,
  Timer,
  ExternalLink,
  ShieldCheck,
  X,
  Youtube,
  Tv,
  Monitor,
  LayoutGrid,
  Gamepad,
  Target,
  MessageSquare,
  CheckCircle2,
  Copy,
  Hash,
  ShieldAlert
} from 'lucide-react';

// --- PRODUCTION CONFIGURATION ---
const manualFirebaseConfig = {
  apiKey: "AIzaSyDFHW-ZV5HPxGNJlwbi4Ravrs0tnyRW3Eg",
  authDomain: "gamesync-7fdde.firebaseapp.com",
  projectId: "gamesync-7fdde",
  storageBucket: "gamesync-7fdde.firebasestorage.app",
  messagingSenderId: "209595978385",
  appId: "1:209595978385:web:804bf3167a353073be2530",
  measurementId: "G-Z4RLFK079H"
};

// SET YOUR FEEDBACK EMAIL HERE
const SUPPORT_EMAIL = "your-email@example.com";

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
const isConfigValid = !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey.startsWith("AIza"));

const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'community_calendar_production';
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
  light: { id: 'light', bg: 'bg-slate-50', card: 'bg-white', header: 'bg-white', accent: 'text-indigo-600', border: 'border-slate-100', text: 'text-slate-900', muted: 'text-slate-500', button: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
  dark: { id: 'dark', bg: 'bg-zinc-950', card: 'bg-zinc-900', header: 'bg-zinc-900', accent: 'text-indigo-400', border: 'border-zinc-800', text: 'text-zinc-100', muted: 'text-zinc-500', button: 'bg-indigo-600 hover:bg-indigo-700 text-white' }
};

const App = () => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); 
  const [authForm, setAuthForm] = useState({ email: '', password: '', displayName: '' });
  const [authError, setAuthError] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [guilds, setGuilds] = useState([]);
  const [activeGuildId, setActiveGuildId] = useState('all');
  const [currentView, setCurrentView] = useState('calendar'); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGuildModalOpen, setIsGuildModalOpen] = useState(false);
  
  const [rosterGuild, setRosterGuild] = useState(null); 
  const [viewingProfile, setViewingProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const [inviteInput, setInviteInput] = useState('');
  const [inviteError, setInviteError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [newGuild, setNewGuild] = useState({ name: '', desc: '', isPrivate: false });

  const [profile, setProfile] = useState({ 
    displayName: 'Operator', 
    joinedGuilds: [], 
    theme: 'light',
    handles: { steam: '', psn: '', xbox: '', youtube: '', twitch: '', kick: '' },
    showcaseGames: ['', '', '', '', '']
  });
  const activeTheme = THEMES[profile.theme] || THEMES.light;

  const [formData, setFormData] = useState({
    gameTitle: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '19:00',
    duration: '2',
    isStreaming: false,
    streamPlatform: 'Twitch',
    guildId: '',
    maxOpenings: 4
  });

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

  useEffect(() => {
    if (!user || !db || !user.emailVerified) return;
    const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
    
    const initProfile = async () => {
      const snap = await getDoc(profileRef);
      if (!snap.exists()) {
        await setDoc(profileRef, {
          displayName: authForm.displayName || `Operator_${user.uid.slice(0, 4)}`,
          joinedGuilds: [],
          theme: 'light',
          handles: { steam: '', psn: '', xbox: '', youtube: '', twitch: '', kick: '' },
          showcaseGames: ['', '', '', '', ''],
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
  }, [user, user?.emailVerified]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      if (authMode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password);
        await sendEmailVerification(cred.user);
      } else {
        await signInWithEmailAndPassword(auth, authForm.email, authForm.password);
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const checkVerification = async () => {
    if (!user) return;
    setIsVerifying(true);
    await reload(user);
    setUser({ ...auth.currentUser });
    setIsVerifying(false);
  };

  const resendVerification = async () => {
    if (!user) return;
    try {
        await sendEmailVerification(user);
        setAuthError("NEW VERIFICATION LINK TRANSMITTED");
    } catch (err) {
        setAuthError(err.message);
    }
  };

  const saveProfile = async (data) => {
    if (!user || !db) return;
    setProfileSaving(true);
    try {
      const batch = writeBatch(db);
      const profileRef = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info');
      batch.set(profileRef, data, { merge: true });
      const dirRef = doc(db, 'artifacts', appId, 'public', 'data', 'user_directory', user.uid);
      batch.set(dirRef, {
          displayName: data.displayName,
          handles: data.handles || {},
          showcaseGames: data.showcaseGames || [],
          theme: data.theme || 'light',
          uid: user.uid
      }, { merge: true });

      guilds.forEach(guild => {
        const memberIdx = guild.members?.findIndex(m => (m.uid || m) === user.uid);
        if (memberIdx !== -1) {
          const updatedMembers = [...guild.members];
          updatedMembers[memberIdx] = { uid: user.uid, name: data.displayName };
          batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'guilds', guild.id), { members: updatedMembers });
        }
      });

      sessions.forEach(session => {
        let needsUpdate = false;
        const updateData = {};
        if (session.userId === user.uid) { updateData.userName = data.displayName; needsUpdate = true; }
        const partIdx = session.participants?.findIndex(p => p.uid === user.uid);
        if (partIdx !== -1) {
          const updatedParticipants = [...session.participants];
          updatedParticipants[partIdx] = { uid: user.uid, name: data.displayName };
          updateData.participants = updatedParticipants;
          needsUpdate = true;
        }
        if (needsUpdate) batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', session.id), updateData);
      });
      await batch.commit();
    } finally {
      setTimeout(() => setProfileSaving(false), 800);
    }
  };

  const openPublicProfile = async (targetUid) => {
    if (!db) return;
    setProfileLoading(true);
    try {
        const snap = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'user_directory', targetUid));
        if (snap.exists()) setViewingProfile(snap.data());
    } finally {
        setProfileLoading(false);
    }
  };

  const handleSendFeedback = async (e) => {
    e.preventDefault();
    if (!db || !user) return;
    setFeedbackLoading(true);
    try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'feedback'), {
            message: feedbackMsg, senderName: profile.displayName, senderUid: user.uid, timestamp: serverTimestamp()
        });
        setFeedbackSent(true);
        setFeedbackMsg('');
        setTimeout(() => { setIsFeedbackModalOpen(false); setFeedbackSent(false); }, 2000);
    } finally {
        setFeedbackLoading(false);
    }
  };

  const deleteGuildSessions = async (gId) => {
    const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'sessions'));
    const toDelete = snap.docs.filter(d => d.data().guildId === gId);
    const deletions = toDelete.map(d => deleteDoc(d.ref));
    await Promise.all(deletions);
  };

  const disbandGuild = async (gId) => {
    if (!window.confirm("PERMANENT DISBAND: Delete guild and missions?")) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'guilds', gId));
    await deleteGuildSessions(gId);
  };

  const createGuild = async () => {
    if (!newGuild.name || !user || !db) return;
    const inviteCode = newGuild.isPrivate ? Math.random().toString(36).substring(2, 8).toUpperCase() : null;
    const gRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'guilds'), { 
      name: newGuild.name, desc: newGuild.desc || "Active Tactical Sector", ownerId: user.uid, 
      members: [{ uid: user.uid, name: profile.displayName }], isPrivate: newGuild.isPrivate, inviteCode, createdAt: serverTimestamp() 
    });
    const updatedJoined = [...(profile.joinedGuilds || []), gRef.id];
    await saveProfile({ ...profile, joinedGuilds: updatedJoined });
    setNewGuild({ name: '', desc: '', isPrivate: false });
    setIsGuildModalOpen(false);
  };

  const joinPrivateGuild = async (e) => {
    e.preventDefault();
    if (!inviteInput || !db || !user) return;
    setInviteError(null);
    const targetCode = inviteInput.toUpperCase().trim();
    const guildToJoin = guilds.find(g => g.inviteCode === targetCode);
    if (!guildToJoin) { setInviteError("INVALID SECTOR CODE"); return; }
    if (profile.joinedGuilds?.includes(guildToJoin.id)) { setInviteError("ALREADY ENLISTED"); return; }
    await saveProfile({ ...profile, joinedGuilds: [...(profile.joinedGuilds || []), guildToJoin.id] });
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'guilds', guildToJoin.id), { members: arrayUnion({ uid: user.uid, name: profile.displayName }) });
    setInviteInput('');
    setActiveGuildId(guildToJoin.id);
  };

  const handleToggleGuild = async (guild) => {
    if (!user || !db) return;
    const joinedList = profile.joinedGuilds || [];
    const isEnlisted = joinedList.includes(guild.id);
    const members = guild.members || [];
    if (isEnlisted) {
      const newJoined = joinedList.filter(id => id !== guild.id);
      await saveProfile({ ...profile, joinedGuilds: newJoined });
      const remainingMembers = members.filter(m => (m.uid || m) !== user.uid);
      if (remainingMembers.length === 0) {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'guilds', guild.id));
          await deleteGuildSessions(guild.id);
      } else {
          const memberToRemove = members.find(m => (m.uid || m) === user.uid);
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'guilds', guild.id), { members: arrayRemove(memberToRemove) });
      }
    } else {
      if (guild.isPrivate) return;
      await saveProfile({ ...profile, joinedGuilds: [...joinedList, guild.id] });
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'guilds', guild.id), { members: arrayUnion({ uid: user.uid, name: profile.displayName }) });
    }
  };

  const toggleJoinSession = async (session) => {
    if (!db || !user) return;
    const participants = session.participants || [];
    const isJoined = participants.some(p => p.uid === user.uid);
    const capacity = Number(session.maxOpenings) + 1;
    if (isJoined) {
      const updated = participants.filter(p => p.uid !== user.uid);
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', session.id), { participants: updated });
    } else {
      if (participants.length >= capacity) return;
      const updated = [...participants, { uid: user.uid, name: profile.displayName }];
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', session.id), { participants: updated });
    }
  };

  const handleSubmitSession = async (e) => {
    e.preventDefault();
    if (!db || !user) return;
    const gId = formData.guildId || activeGuildId;
    if (gId === 'all') return;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sessions'), { 
      ...formData, maxOpenings: Number(formData.maxOpenings), guildId: gId, 
      userId: user.uid, userName: profile.displayName, participants: [{ uid: user.uid, name: profile.displayName }], createdAt: serverTimestamp() 
    });
    setIsModalOpen(false);
  };

  const filteredSessionsByDate = useMemo(() => {
    const joined = profile.joinedGuilds || [];
    const filtered = sessions.filter(s => {
      const inGuild = activeGuildId === 'all' ? joined.includes(s.guildId) : s.guildId === activeGuildId;
      return inGuild && String(s.gameTitle).toLowerCase().includes(searchTerm.toLowerCase());
    }).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const groups = {};
    filtered.forEach(s => { const d = String(s.date); if (!groups[d]) groups[d] = []; groups[d].push(s); });
    return groups;
  }, [sessions, activeGuildId, profile.joinedGuilds, searchTerm]);

  if (!isConfigValid) return <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center"><Shield className="w-16 h-16 text-rose-500 mb-6" /><h2 className="text-3xl font-black uppercase italic">Sync Failed</h2><p className="opacity-50 text-sm">Check App.jsx.</p></div>;
  if (authLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Gamepad2 className="w-12 h-12 text-indigo-500 animate-bounce" /></div>;

  // --- LOGIN / REGISTER VIEW ---
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white">
        <div className="w-full max-w-md bg-zinc-900 p-12 rounded-[4rem] border border-zinc-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600 animate-pulse"></div>
          <div className="text-center mb-10">
            <Gamepad2 className="w-16 h-16 text-indigo-500 mx-auto mb-6" />
            <h1 className="text-4xl font-black uppercase tracking-tighter italic">GameSync</h1>
            <p className="text-[10px] uppercase font-black tracking-[0.3em] opacity-30 mt-2">Identity Matrix Registry</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <input type="email" placeholder="EMAIL" required className="w-full bg-black border border-zinc-800 p-5 rounded-2xl outline-none focus:border-indigo-500 text-xs font-black uppercase transition" value={authForm.email} onChange={e => setAuthForm({...authForm, email: e.target.value})} />
            <input type="password" placeholder="PASSWORD" required className="w-full bg-black border border-zinc-800 p-5 rounded-2xl outline-none focus:border-indigo-500 text-xs font-black uppercase transition" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} />
            {authError && <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-[10px] text-rose-500 font-bold uppercase">{authError}</div>}
            <button type="submit" className="w-full bg-indigo-600 p-6 rounded-3xl font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition">Establish Link</button>
          </form>
          <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full mt-10 text-[10px] font-black uppercase opacity-30 hover:opacity-100 transition tracking-widest">{authMode === 'login' ? "New Operator? Create Registry" : "Have an Identity? Sign In"}</button>
        </div>
      </div>
    );
  }

  // --- EMAIL VERIFICATION PENDING VIEW ---
  if (user && !user.emailVerified) {
    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white text-center">
            <div className="w-full max-w-md bg-zinc-900 p-12 rounded-[5rem] border border-zinc-800 shadow-2xl relative">
                <div className="mb-10">
                    <div className="w-20 h-20 bg-indigo-600/20 border border-indigo-500/40 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <Mail className="w-10 h-10 text-indigo-400 animate-pulse" />
                    </div>
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter">Verify Intel</h2>
                    <p className="text-[10px] font-black uppercase opacity-30 mt-2 tracking-[0.2em]">Transmission Sent to {user.email}</p>
                </div>
                
                <div className="space-y-4">
                    <button onClick={checkVerification} disabled={isVerifying} className="w-full p-6 rounded-3xl bg-indigo-600 font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3 active:scale-95 transition disabled:opacity-50">
                        {isVerifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Access Sector
                    </button>
                    <button onClick={resendVerification} className="w-full p-6 rounded-3xl bg-white/5 border border-white/10 font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition">Resend Transmission</button>
                </div>

                <div className="mt-12 pt-8 border-t border-white/5">
                    <button onClick={() => signOut(auth)} className="flex items-center gap-2 mx-auto text-[9px] font-black uppercase opacity-30 hover:opacity-100 transition"><LogOut className="w-3 h-3" /> Abort Registry</button>
                </div>

                {authError && <div className="mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[9px] text-emerald-500 font-bold uppercase">{authError}</div>}
            </div>
        </div>
    );
  }

  // --- MAIN APP INTERFACE ---
  return (
    <div className={`min-h-screen ${activeTheme.bg} ${activeTheme.text} transition-colors duration-500`}>
      <header className={`${activeTheme.header} border-b ${activeTheme.border} sticky top-0 z-40 h-16 flex items-center justify-between px-6 shadow-sm`}>
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setCurrentView('calendar')}>
          <Gamepad2 className={`w-8 h-8 ${activeTheme.accent}`} />
          <h1 className="font-black text-xl italic uppercase">GameSync</h1>
        </div>
        <nav className="flex items-center gap-4">
          <button onClick={() => setCurrentView('calendar')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition ${currentView === 'calendar' ? activeTheme.button : 'opacity-40 hover:opacity-100'}`}>Hub</button>
          <button onClick={() => setCurrentView('profile')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition ${currentView === 'profile' ? activeTheme.button : 'opacity-40 hover:opacity-100'}`}>Profile</button>
          <button onClick={() => setIsFeedbackModalOpen(true)} className="p-2 opacity-40 hover:text-indigo-500 transition"><MessageSquare className="w-4 h-4" /></button>
          <button onClick={() => signOut(auth)} className="p-2 opacity-40 hover:text-rose-500 transition"><LogOut className="w-4 h-4" /></button>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto p-8 flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-72">
          <p className="text-[10px] font-black uppercase opacity-30 mb-4 tracking-widest">Tactical Sectors</p>
          <button onClick={() => setActiveGuildId('all')} className={`w-full text-left p-3 rounded-xl mb-2 font-black text-xs transition ${activeGuildId === 'all' ? activeTheme.button : 'hover:bg-slate-500/10'}`}>Global Comms</button>
          <div className="mt-6 space-y-2">
            {guilds.filter(g => profile.joinedGuilds?.includes(g.id)).map(g => (
                <div key={g.id} className="flex items-center gap-1 group">
                    <button onClick={() => setActiveGuildId(g.id)} className={`flex-1 text-left p-3 rounded-xl font-bold text-xs transition truncate ${activeGuildId === g.id ? activeTheme.button : 'hover:bg-slate-500/10'}`}>{String(g.name)}</button>
                    <button onClick={() => setRosterGuild(g)} className="p-3 rounded-xl bg-slate-500/5 hover:bg-indigo-500 hover:text-white transition opacity-0 group-hover:opacity-100"><Users className="w-4 h-4" /></button>
                </div>
            ))}
          </div>
          <button onClick={() => setIsGuildModalOpen(true)} className="w-full p-4 mt-6 rounded-xl border border-dashed border-slate-500/30 text-[10px] font-black uppercase opacity-40 hover:opacity-100 transition flex items-center justify-center gap-2"><Compass className="w-4 h-4" /> Find Sectors</button>
        </aside>

        <div className="flex-1">
          {currentView === 'calendar' ? (
            <>
              <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
                <h2 className="text-5xl font-black uppercase italic tracking-tighter leading-none">{activeGuildId === 'all' ? 'The Hub' : guilds.find(g => g.id === activeGuildId)?.name}</h2>
                <div className="flex gap-4">
                  <div className="relative group"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" /><input type="text" placeholder="Filter..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={`pl-10 pr-4 py-3 rounded-2xl ${activeTheme.card} border ${activeTheme.border} outline-none text-sm w-48 focus:border-indigo-500 transition`} /></div>
                  <button onClick={() => setIsModalOpen(true)} className={`${activeTheme.button} px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg`}>+ New Mission</button>
                </div>
              </div>

              <div className="space-y-12">
                {Object.entries(filteredSessionsByDate).map(([date, daySessions]) => (
                  <div key={date}>
                    <div className="flex items-center gap-4 mb-8"><span className="text-[11px] font-black uppercase opacity-40 tracking-widest italic">{date}</span><div className={`flex-1 h-px ${activeTheme.border}`}></div></div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {daySessions.map(session => {
                        const isEnlisted = session.participants?.some(p => p.uid === user?.uid);
                        const capacity = (Number(session.maxOpenings) || 0) + 1;
                        const isFull = (session.participants?.length || 0) >= capacity;

                        return (
                          <div key={session.id} className={`${activeTheme.card} border ${activeTheme.border} rounded-[3rem] p-8 shadow-sm transition hover:-translate-y-1 group relative overflow-hidden flex flex-col`}>
                            {session.isStreaming && <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-rose-600 text-white px-3 py-1 rounded-full animate-pulse shadow-lg"><Video className="w-3 h-3" /><span className="text-[9px] font-black uppercase tracking-widest">{session.streamPlatform}</span></div>}
                            <h4 className="text-2xl font-black italic uppercase group-hover:text-indigo-600 transition-colors leading-tight mb-4">{String(session.gameTitle)}</h4>
                            <div className="flex flex-wrap gap-4 mb-6 opacity-40">
                              <div className="flex items-center gap-2"><Clock className="w-3 h-3" /><span className="text-[10px] font-black uppercase">{String(session.startTime)}</span></div>
                              <div className="flex items-center gap-2"><Timer className="w-3 h-3" /><span className="text-[10px] font-black uppercase">{session.duration} HR</span></div>
                            </div>
                            <div className="mb-8 flex-1">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-4">{session.participants?.length || 0} / {capacity} Enlisted</p>
                                <div className="flex flex-wrap gap-2">
                                    {session.participants?.map((p, i) => (
                                    <button key={i} onClick={() => openPublicProfile(p.uid)} className={`flex items-center gap-2 text-[9px] font-black px-4 py-2 rounded-full ${activeTheme.bg} border ${activeTheme.border} uppercase shadow-sm hover:border-indigo-500 transition`}>
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                        {String(p.name)}
                                    </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 mt-auto">
                              <button onClick={() => toggleJoinSession(session)} disabled={isFull && !isEnlisted} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition active:scale-95 ${isEnlisted ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : isFull ? 'bg-slate-500/10 text-slate-400 opacity-50 cursor-not-allowed' : activeTheme.button}`}>{isEnlisted ? 'Retire' : isFull ? 'Full' : 'Enlist'}</button>
                              {session.userId === user?.uid && <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', session.id))} className="p-4 rounded-2xl bg-rose-500/10 text-rose-500 transition opacity-20 hover:opacity-100"><Trash2 className="w-5 h-5" /></button>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="max-w-4xl mx-auto pb-20">
              <div className={`${activeTheme.card} border ${activeTheme.border} rounded-[5rem] p-12 shadow-2xl relative overflow-hidden`}>
                <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600"></div>
                <div className="flex flex-col md:flex-row gap-12">
                    <div className="w-full md:w-1/3 text-center">
                        <div className="w-32 h-32 mx-auto mb-8 rounded-[3rem] bg-indigo-600 flex items-center justify-center text-white text-5xl font-black shadow-2xl">{profile.displayName.charAt(0)}</div>
                        <input type="text" value={profile.displayName} onChange={e => setProfile({...profile, displayName: e.target.value})} className="w-full bg-transparent text-center text-3xl font-black italic uppercase outline-none focus:text-indigo-600 transition" />
                        <div className="mt-12 space-y-4">
                            <button onClick={() => setProfile({...profile, theme: 'light'})} className={`w-full p-4 rounded-2xl border-2 transition flex items-center justify-center gap-3 ${profile.theme === 'light' ? 'border-indigo-600' : 'border-transparent opacity-40'}`}><Palette className="w-4 h-4" /><span className="text-[10px] font-black uppercase">Standard</span></button>
                            <button onClick={() => setProfile({...profile, theme: 'dark'})} className={`w-full p-4 rounded-2xl border-2 transition flex items-center justify-center gap-3 ${profile.theme === 'dark' ? 'border-indigo-400' : 'border-transparent opacity-40'}`}><Zap className="w-4 h-4" /><span className="text-[10px] font-black uppercase">Midnight</span></button>
                        </div>
                        <button onClick={() => saveProfile(profile)} disabled={profileSaving} className={`w-full mt-10 py-5 rounded-3xl ${activeTheme.button} font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-2`}>
                            {profileSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} {profileSaving ? "SYNCING..." : "SYNC PROFILE"}
                        </button>
                        <button onClick={() => setIsFeedbackModalOpen(true)} className="w-full mt-4 text-[10px] font-black uppercase opacity-40 hover:opacity-100 transition tracking-widest flex items-center justify-center gap-2 underline underline-offset-4 decoration-dotted"><MessageSquare className="w-3 h-3" /> Report Issue / Feedback</button>
                    </div>

                    <div className="flex-1 space-y-10">
                        <div>
                            <p className="text-[10px] font-black uppercase opacity-30 mb-6 tracking-widest flex items-center gap-2"><Lock className="w-3 h-3" /> Identity Matrix</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="relative group"><LayoutGrid className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" /><input placeholder="STEAM" className={`w-full pl-12 p-4 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-[10px] font-black uppercase`} value={profile.handles?.steam} onChange={e => setProfile({...profile, handles: {...profile.handles, steam: e.target.value}})} /></div>
                                <div className="relative group"><Gamepad2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" /><input placeholder="PSN" className={`w-full pl-12 p-4 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-[10px] font-black uppercase`} value={profile.handles?.psn} onChange={e => setProfile({...profile, handles: {...profile.handles, psn: e.target.value}})} /></div>
                                <div className="relative group"><Gamepad className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" /><input placeholder="XBOX" className={`w-full pl-12 p-4 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-[10px] font-black uppercase`} value={profile.handles?.xbox} onChange={e => setProfile({...profile, handles: {...profile.handles, xbox: e.target.value}})} /></div>
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase opacity-30 mb-6 tracking-widest flex items-center gap-2"><Video className="w-3 h-3" /> Broadcast Hub</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="relative group"><Tv className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" /><input placeholder="TWITCH" className={`w-full pl-12 p-4 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-[10px] font-black uppercase`} value={profile.handles?.twitch} onChange={e => setProfile({...profile, handles: {...profile.handles, twitch: e.target.value}})} /></div>
                                <div className="relative group"><Youtube className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" /><input placeholder="YOUTUBE" className={`w-full pl-12 p-4 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-[10px] font-black uppercase`} value={profile.handles?.youtube} onChange={e => setProfile({...profile, handles: {...profile.handles, youtube: e.target.value}})} /></div>
                                <div className="relative group"><ExternalLink className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-20" /><input placeholder="KICK" className={`w-full pl-12 p-4 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-[10px] font-black uppercase`} value={profile.handles?.kick} onChange={e => setProfile({...profile, handles: {...profile.handles, kick: e.target.value}})} /></div>
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase opacity-30 mb-6 tracking-widest flex items-center gap-2"><Target className="w-3 h-3" /> Interest Showcase</p>
                            <div className="space-y-3">
                                {[0,1,2,3,4].map(idx => (
                                    <input key={idx} placeholder={`GAME 0${idx+1}`} className={`w-full p-4 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-[10px] font-black uppercase focus:border-indigo-500 transition`} value={profile.showcaseGames?.[idx] || ''} onChange={e => {
                                        const newGames = [...(profile.showcaseGames || ['', '', '', '', ''])];
                                        newGames[idx] = e.target.value;
                                        setProfile({...profile, showcaseGames: newGames});
                                    }} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* FEEDBACK MODAL */}
      {isFeedbackModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md transition-all">
          <div className={`${activeTheme.card} border ${activeTheme.border} rounded-[4rem] p-12 max-w-xl w-full shadow-2xl relative`}>
            {!feedbackSent ? (
                <>
                    <button onClick={() => setIsFeedbackModalOpen(false)} className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center bg-slate-500/10 rounded-full hover:rotate-90 transition"><X /></button>
                    <div className="text-center mb-10"><MessageSquare className="w-12 h-12 text-indigo-500 mx-auto mb-6" /><h3 className="text-4xl font-black italic uppercase tracking-tighter">Report Intel</h3></div>
                    <form onSubmit={handleSendFeedback} className="space-y-6">
                        <textarea required placeholder="DESCRIBE ISSUE..." className={`w-full h-40 p-6 rounded-[2rem] ${activeTheme.bg} border ${activeTheme.border} outline-none font-black uppercase text-xs focus:border-indigo-500 transition shadow-inner resize-none`} value={feedbackMsg} onChange={e => setFeedbackMsg(e.target.value)} />
                        <button type="submit" disabled={feedbackLoading} className={`w-full py-5 rounded-3xl ${activeTheme.button} font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition flex items-center justify-center gap-2`}>
                            {feedbackLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} TRANSMIT REPORT
                        </button>
                    </form>
                </>
            ) : (
                <div className="text-center py-20 animate-in fade-in zoom-in duration-500"><CheckCircle2 className="w-20 h-20 text-emerald-500 mx-auto mb-6 animate-bounce" /><h3 className="text-4xl font-black italic uppercase tracking-tighter text-emerald-500">Received</h3></div>
            )}
          </div>
        </div>
      )}

      {/* PUBLIC INTEL DECK (Profile Viewer) */}
      {viewingProfile && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl transition-all">
          <div className={`${viewingProfile.theme === 'dark' ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-slate-100 text-slate-900'} border rounded-[5rem] p-12 max-w-xl w-full shadow-2xl relative overflow-hidden`}>
            <button onClick={() => setViewingProfile(null)} className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center bg-slate-500/10 rounded-full hover:rotate-90 transition"><X /></button>
            <div className="text-center mb-10">
                <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-indigo-600 flex items-center justify-center text-white text-4xl font-black shadow-xl">{viewingProfile.displayName.charAt(0)}</div>
                <h3 className="text-3xl font-black italic uppercase tracking-tight">{viewingProfile.displayName}</h3>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-10">
                {Object.entries(viewingProfile.handles || {}).map(([key, val]) => val && (
                    <div key={key} className="p-3 bg-slate-500/5 border border-slate-500/10 rounded-xl text-center"><p className="text-[7px] font-black uppercase opacity-40 mb-1">{key}</p><p className="text-[9px] font-black uppercase truncate">{val}</p></div>
                ))}
            </div>
            <div className="space-y-2">
                <p className="text-[10px] font-black uppercase opacity-30 mb-4 text-center tracking-widest">Tactical Interests</p>
                {viewingProfile.showcaseGames?.map((game, idx) => game && (
                    <div key={idx} className="p-3 bg-black/20 rounded-xl border border-white/5 flex items-center gap-4"><span className="text-[9px] font-black opacity-20">0{idx+1}</span><span className="text-xs font-black uppercase tracking-tight italic">{game}</span></div>
                ))}
            </div>
            <button onClick={() => setViewingProfile(null)} className="w-full mt-10 py-5 rounded-3xl bg-indigo-600 text-white font-black uppercase text-xs tracking-widest shadow-xl">Close Intel Deck</button>
          </div>
        </div>
      )}

      {/* ROSTER MODAL */}
      {rosterGuild && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md transition-all">
          <div className={`${activeTheme.card} border ${activeTheme.border} rounded-[4rem] p-12 max-w-xl w-full shadow-2xl`}>
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-4xl font-black uppercase italic tracking-tighter">{rosterGuild.name}</h3>
                    {rosterGuild.isPrivate && (
                        <div className="mt-4 flex items-center gap-4 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                            <div><p className="text-[8px] font-black uppercase opacity-40 tracking-widest">Sector Invite Code</p><p className="text-2xl font-black italic text-indigo-400 tracking-tighter select-all">{rosterGuild.inviteCode}</p></div>
                            <button onClick={() => { navigator.clipboard.writeText(rosterGuild.inviteCode); }} className="p-3 rounded-xl bg-indigo-600 text-white shadow-lg"><Copy className="w-4 h-4" /></button>
                        </div>
                    )}
                </div>
                <button onClick={() => setRosterGuild(null)} className="w-10 h-10 flex items-center justify-center bg-slate-500/10 rounded-full"><X /></button>
            </div>
            <div className="space-y-3 max-h-[40vh] overflow-y-auto mb-10 pr-2 custom-scrollbar">
                {rosterGuild.members?.map((m, idx) => (
                    <button key={idx} onClick={() => openPublicProfile(m.uid || m)} className={`w-full text-left ${activeTheme.bg} p-4 rounded-3xl border ${activeTheme.border} flex items-center gap-4 hover:border-indigo-500 transition group`}>
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-[11px] font-black text-white shadow-lg group-hover:scale-110 transition">{String(m.name || 'O').charAt(0)}</div>
                        <div className="flex-1 overflow-hidden"><p className="text-sm font-black uppercase tracking-tight truncate">{String(m.name || 'Unknown Op')}</p><p className="text-[8px] opacity-20 font-bold truncate">{m.uid || m}</p></div>
                        {(m.uid || m) === rosterGuild.ownerId && <Crown className="w-4 h-4 text-amber-500" />}
                    </button>
                ))}
            </div>
            <button onClick={() => setRosterGuild(null)} className="w-full py-5 rounded-3xl bg-indigo-600 text-white font-black uppercase text-xs tracking-widest transition">Close Deck</button>
          </div>
        </div>
      )}

      {/* GUILD DIRECTORY MODAL */}
      {isGuildModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className={`${activeTheme.card} border ${activeTheme.border} rounded-[4rem] p-12 max-w-2xl w-full shadow-2xl`}>
            <div className="flex justify-between items-start mb-10"><h3 className="text-4xl font-black uppercase italic tracking-tighter">Directory</h3><button onClick={() => setIsGuildModalOpen(false)} className="w-12 h-12 flex items-center justify-center bg-slate-500/10 rounded-full">✕</button></div>
            <div className="mb-10 p-6 rounded-[2.5rem] bg-indigo-600/10 border border-indigo-500/20">
                <p className="text-[10px] font-black uppercase opacity-40 mb-4 tracking-widest flex items-center gap-2"><Lock className="w-3 h-3" /> Secure Enlistment</p>
                <form onSubmit={joinPrivateGuild} className="flex gap-4"><input placeholder="ENTER INVITE CODE" className="flex-1 p-5 rounded-2xl bg-black/40 border border-indigo-500/30 outline-none text-xs font-black uppercase focus:border-indigo-500 transition text-white" value={inviteInput} onChange={e => setInviteInput(e.target.value.toUpperCase())} maxLength={6} /><button type="submit" className="px-8 py-5 rounded-2xl bg-indigo-600 text-white font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition">Enlist</button></form>
                {inviteError && <p className="text-[9px] font-black text-rose-500 uppercase mt-3 ml-2">{inviteError}</p>}
            </div>
            <div className="space-y-4 max-h-[30vh] overflow-y-auto mb-10 pr-2 custom-scrollbar">
              {guilds.map(g => (
                <div key={g.id} className={`${activeTheme.bg} p-6 rounded-[2.5rem] border ${activeTheme.border} flex justify-between items-center group`}>
                    <div className="flex-1"><div className="flex items-center gap-2"><p className="font-black uppercase text-sm group-hover:text-indigo-500 transition">{String(g.name)}</p>{g.isPrivate && <Lock className="w-3 h-3 opacity-30" />}</div><p className="text-[9px] font-black opacity-30 mt-1 uppercase">{g.members?.length || 0} Members</p></div>
                    <div className="flex items-center gap-2">
                        {g.isPrivate ? (<div className="px-6 py-3 rounded-2xl bg-slate-500/5 text-slate-400 text-[9px] font-black uppercase italic border border-white/5">Private</div>) : (<button onClick={() => handleToggleGuild(g)} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition active:scale-95 ${profile.joinedGuilds?.includes(g.id) ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : activeTheme.button}`}>{profile.joinedGuilds?.includes(g.id) ? 'Retire' : 'Enlist'}</button>)}
                        {g.ownerId === user?.uid && <button onClick={() => disbandGuild(g.id)} className="p-3 bg-rose-500/10 text-rose-500 rounded-xl transition hover:bg-rose-500 hover:text-white"><Skull className="w-4 h-4" /></button>}
                    </div>
                </div>
              ))}
            </div>
            <div className={`pt-10 border-t ${activeTheme.border} space-y-4`}>
              <p className="text-[10px] font-black uppercase opacity-40 text-center tracking-widest">Commission Sector</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><input placeholder="GUILD NAME" className={`w-full p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black uppercase focus:border-indigo-500 transition shadow-inner`} value={newGuild.name} onChange={e => setNewGuild({...newGuild, name: e.target.value})} /><button type="button" onClick={() => setNewGuild({...newGuild, isPrivate: !newGuild.isPrivate})} className={`p-5 rounded-2xl border-2 transition flex items-center justify-center gap-3 ${newGuild.isPrivate ? 'border-indigo-600 bg-indigo-500/10 text-indigo-400' : 'border-slate-500/20 opacity-40'}`}>{newGuild.isPrivate ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}<span className="text-[10px] font-black uppercase">{newGuild.isPrivate ? 'Private Sector' : 'Public Sector'}</span></button></div>
              <button onClick={createGuild} className={`w-full py-5 rounded-3xl ${activeTheme.button} font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition`}>Commission Registry</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md transition-all">
          <div className={`${activeTheme.card} border ${activeTheme.border} rounded-[4rem] p-12 max-w-2xl w-full shadow-2xl`}>
            <div className="flex justify-between items-start mb-8"><h3 className="text-4xl font-black uppercase italic tracking-tighter">New Mission</h3><button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center bg-slate-500/10 rounded-full">✕</button></div>
            <form onSubmit={handleSubmitSession} className="space-y-6">
              <input placeholder="GAME / OPERATION NAME" className={`w-full p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none font-black uppercase focus:border-indigo-500 transition text-sm shadow-inner`} value={formData.gameTitle} onChange={e => setFormData({...formData, gameTitle: e.target.value})} required />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <input type="date" className={`w-full p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black`} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                <input type="time" className={`w-full p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black`} value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
                <div className="relative"><Timer className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" /><input type="number" placeholder="HR" className={`w-full pl-12 p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black`} value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <select className={`w-full p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black uppercase`} value={formData.guildId} onChange={e => setFormData({...formData, guildId: e.target.value})} required><option value="">Select Guild</option>{guilds.filter(g => profile.joinedGuilds?.includes(g.id)).map(g => (<option key={g.id} value={g.id}>{String(g.name)}</option>))}</select>
                <div className="relative"><UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30" /><input type="number" placeholder="SLOTS" className={`w-full pl-12 p-5 rounded-2xl ${activeTheme.bg} border ${activeTheme.border} outline-none text-xs font-black`} value={formData.maxOpenings} onChange={e => setFormData({...formData, maxOpenings: e.target.value})} /></div>
              </div>
              <div className={`${activeTheme.bg} p-6 rounded-3xl border ${activeTheme.border} flex items-center justify-between`}><div className="flex items-center gap-4"><Video className="w-5 h-5 opacity-40" /><div><p className="text-[11px] font-black uppercase tracking-widest">Broadcast Mission</p></div></div><button type="button" onClick={() => setFormData({...formData, isStreaming: !formData.isStreaming})} className={`w-14 h-8 rounded-full transition-colors relative ${formData.isStreaming ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-zinc-800'}`}><div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${formData.isStreaming ? 'left-7 shadow-lg' : 'left-1'}`}></div></button></div>
              <button type="submit" className={`w-full py-5 rounded-3xl ${activeTheme.button} font-black uppercase text-xs tracking-widest shadow-xl active:scale-95 transition mt-4`}>Deploy Mission</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;