// ═══════════════════════════════════════════════════════
// RETTUNGSNETZ · AUTH CORE MODULE
// Einbinden in index.html und alle Module
// ═══════════════════════════════════════════════════════

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  collection, query, where, getDocs, onSnapshot, serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ── Init Firebase ──
const RN_FIREBASE = {
  apiKey: "AIzaSyCTYpbBGp_aYG_i9drbtwJ6IhduHEdfb_Q",
  authDomain: "rettungsnetz.firebaseapp.com",
  databaseURL: "https://rettungsnetz-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "rettungsnetz",
  storageBucket: "rettungsnetz.firebasestorage.app",
  messagingSenderId: "697193964828",
  appId: "1:697193964828:web:abdb140c42a389bbdf06d9"
};

const fbApp  = getApps().length ? getApps()[0] : initializeApp(RN_FIREBASE);
const db     = getFirestore(fbApp);
const auth   = getAuth(fbApp);

const DISCORD_CLIENT_ID  = "947146036093263982";
const DISCORD_CLIENT_SECRET = "2XBfPLraa9pAANroEnMyyoDSIzRvpJtd";
const DISCORD_REDIRECT   = "https://rettungsnetz.github.io/Dashboard/auth-callback.html";
const DEV_USER_ID        = "480087023521366017";

// ═══════════════════════════════════════════════════════
// AUTH STATE
// ═══════════════════════════════════════════════════════

let _currentUser   = null; // Firestore user doc data
let _currentServer = null; // Firestore server doc data
let _authListeners = [];

export function onAuthChange(fn) {
  _authListeners.push(fn);
  if (_currentUser !== undefined) fn(_currentUser, _currentServer);
}

function _notifyListeners() {
  _authListeners.forEach(fn => fn(_currentUser, _currentServer));
}

// ═══════════════════════════════════════════════════════
// DISCORD OAUTH
// ═══════════════════════════════════════════════════════

export function discordLogin() {
  const state = crypto.randomUUID();
  sessionStorage.setItem('discord_oauth_state', state);
  const params = new URLSearchParams({
    client_id:     DISCORD_CLIENT_ID,
    redirect_uri:  DISCORD_REDIRECT,
    response_type: 'code',
    scope:         'identify guilds guilds.members.read',
    state
  });
  window.location.href = 'https://discord.com/oauth2/authorize?' + params;
}

export async function exchangeDiscordCode(code) {
  // Exchange code for Discord access token
  // Uses a CORS proxy since GitHub Pages has no backend
  // Alternative: Firebase Cloud Function (recommended for production)
  
  const body = new URLSearchParams({
    client_id:     DISCORD_CLIENT_ID,
    client_secret: DISCORD_CLIENT_SECRET,
    grant_type:    'authorization_code',
    code,
    redirect_uri:  DISCORD_REDIRECT
  });

  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!res.ok) throw new Error('Token-Austausch fehlgeschlagen: ' + res.status);
  return res.json();
}

export async function fetchDiscordUser(accessToken) {
  const res = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('Discord User Fehler: ' + res.status);
  return res.json();
}

export async function fetchDiscordGuilds(accessToken) {
  const res = await fetch('https://discord.com/api/users/@me/guilds', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) return [];
  return res.json();
}

// ═══════════════════════════════════════════════════════
// USER MANAGEMENT (Firestore)
// ═══════════════════════════════════════════════════════

export async function getUser(discordId) {
  const snap = await getDoc(doc(db, 'users', discordId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function createOrUpdateUser(discordUser, accessToken, refreshToken) {
  const isDevAccount = discordUser.id === DEV_USER_ID;
  const userRef = doc(db, 'users', discordUser.id);
  const existing = await getDoc(userRef);

  const baseData = {
    discordId:      discordUser.id,
    discordTag:     discordUser.username + '#' + (discordUser.discriminator || '0'),
    discordName:    discordUser.global_name || discordUser.username,
    discordAvatar:  discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null,
    accessToken,
    refreshToken,
    updatedAt: serverTimestamp()
  };

  if (!existing.exists()) {
    await setDoc(userRef, {
      ...baseData,
      nickname:   discordUser.global_name || discordUser.username,
      avatar:     baseData.discordAvatar,
      serverId:   isDevAccount ? '__dev__' : null,
      role:       isDevAccount ? 'DEV' : 'GUEST',
      status:     isDevAccount ? 'approved' : 'setup', // 'setup' | 'pending' | 'approved' | 'rejected'
      createdAt:  serverTimestamp()
    });
  } else {
    await updateDoc(userRef, baseData);
  }

  return (await getDoc(userRef)).data();
}

export async function updateUserProfile(discordId, { nickname, avatar }) {
  await updateDoc(doc(db, 'users', discordId), {
    nickname,
    ...(avatar !== undefined ? { avatar } : {}),
    updatedAt: serverTimestamp()
  });
}

export async function setUserServer(discordId, serverId) {
  await updateDoc(doc(db, 'users', discordId), {
    serverId,
    status: 'pending',
    role: 'GUEST',
    updatedAt: serverTimestamp()
  });
}

// ═══════════════════════════════════════════════════════
// SERVER MANAGEMENT (Firestore)
// ═══════════════════════════════════════════════════════

export async function getAllServers() {
  const snap = await getDocs(collection(db, 'servers'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getServer(serverId) {
  const snap = await getDoc(doc(db, 'servers', serverId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getServerMembers(serverId) {
  const q = query(collection(db, 'users'), where('serverId', '==', serverId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPendingMembers(serverId) {
  const q = query(
    collection(db, 'users'),
    where('serverId', '==', serverId),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function approveMember(discordId, serverId, role = 'MEMBER') {
  await updateDoc(doc(db, 'users', discordId), {
    status: 'approved',
    role,
    serverId,
    updatedAt: serverTimestamp()
  });
}

export async function rejectMember(discordId) {
  await updateDoc(doc(db, 'users', discordId), {
    status: 'rejected',
    serverId: null,
    role: 'GUEST',
    updatedAt: serverTimestamp()
  });
}

export async function kickMember(discordId) {
  await updateDoc(doc(db, 'users', discordId), {
    status: 'kicked',
    serverId: null,
    role: 'GUEST',
    updatedAt: serverTimestamp()
  });
}

export async function updateMemberRole(discordId, role) {
  await updateDoc(doc(db, 'users', discordId), { role, updatedAt: serverTimestamp() });
}

// ── Map Markers ──
export async function getMapMarkers(serverId) {
  const snap = await getDoc(doc(db, 'servers', serverId));
  return snap.exists() ? (snap.data().mapMarkers || []) : [];
}

export async function saveMapMarkers(serverId, markers) {
  await updateDoc(doc(db, 'servers', serverId), { mapMarkers: markers, updatedAt: serverTimestamp() });
}

// ═══════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ═══════════════════════════════════════════════════════

export async function initAuth() {
  const stored = localStorage.getItem('rn_user');
  if (!stored) {
    _currentUser = null;
    _notifyListeners();
    return null;
  }

  try {
    const { discordId, accessToken } = JSON.parse(stored);
    const user = await getUser(discordId);
    if (!user) {
      localStorage.removeItem('rn_user');
      _currentUser = null;
      _notifyListeners();
      return null;
    }

    _currentUser = user;
    if (user.serverId && user.serverId !== '__dev__') {
      _currentServer = await getServer(user.serverId);
    }
    _notifyListeners();
    return user;
  } catch (e) {
    console.error('Auth init error:', e);
    localStorage.removeItem('rn_user');
    _currentUser = null;
    _notifyListeners();
    return null;
  }
}

export function saveSession(discordId, accessToken) {
  localStorage.setItem('rn_user', JSON.stringify({ discordId, accessToken }));
}

export function logout() {
  localStorage.removeItem('rn_user');
  sessionStorage.removeItem('discord_code');
  _currentUser   = null;
  _currentServer = null;
  _notifyListeners();
  window.location.reload();
}

export function getCurrentUser()   { return _currentUser; }
export function getCurrentServer() { return _currentServer; }
export function isDevAccount(u)    { return (u || _currentUser)?.discordId === DEV_USER_ID; }
export function isAdmin(u)         { const r = (u || _currentUser)?.role; return r === 'ADMIN' || r === 'OWNER' || r === 'DEV'; }
export function isApproved(u)      { return (u || _currentUser)?.status === 'approved'; }

export { db, auth, DEV_USER_ID };
