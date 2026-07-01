import { firebaseConfig } from './firebase-config.js';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getDatabase, ref, set, onValue, off, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';

const configured = firebaseConfig?.apiKey && !firebaseConfig.apiKey.startsWith('YOUR_');
const app = configured ? (getApps()[0] || initializeApp(firebaseConfig)) : null;
const db = app ? getDatabase(app) : null;

function clean(value) {
  return JSON.parse(JSON.stringify(value, (_, item) => item === undefined ? null : item));
}

export function ready() {
  return !!db;
}

export function directThreadId(a, b) {
  return [a, b].filter(Boolean).sort().join('_').replace(/[.#$/[\]]/g, '_');
}

export async function saveDirectMessage(me, friendId, message) {
  if (!db || !me || !friendId || !message?.id) return false;
  const thread = directThreadId(me, friendId);
  await set(ref(db, `directMessages/${thread}/${message.id}`), clean({
    ...message,
    thread,
    participants: { [me]: true, [friendId]: true },
    savedAt: serverTimestamp()
  }));
  return true;
}

export function listenDirectMessages(me, friendId, callback) {
  if (!db || !me || !friendId) return () => {};
  const thread = directThreadId(me, friendId);
  const location = ref(db, `directMessages/${thread}`);
  const handler = snapshot => {
    const rows = [];
    snapshot.forEach(child => rows.push({ id: child.key, ...child.val() }));
    rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    callback(rows);
  };
  onValue(location, handler);
  return () => off(location, 'value', handler);
}

function safePath(value) {
  return String(value || 'general').replace(/[.#$/[\]]/g, '_');
}

export async function saveChannelMessage(room, message) {
  if (!db || !room || !message?.id) return false;
  await set(ref(db, `channelMessages/${safePath(room)}/${message.id}`), clean({
    ...message,
    room,
    savedAt: serverTimestamp()
  }));
  return true;
}

export function listenChannelMessages(room, callback) {
  if (!db || !room) return () => {};
  const location = ref(db, `channelMessages/${safePath(room)}`);
  const handler = snapshot => {
    const rows = [];
    snapshot.forEach(child => rows.push({ id: child.key, ...child.val() }));
    rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    callback(rows.slice(-80));
  };
  onValue(location, handler);
  return () => off(location, 'value', handler);
}

export async function saveStudySession(uid, session) {
  if (!db || !uid || !session?.id) return false;
  await set(ref(db, `studyHelperSessions/${uid}/${session.id}`), clean({
    ...session,
    updatedAtServer: serverTimestamp()
  }));
  return true;
}

export function listenStudySessions(uid, callback) {
  if (!db || !uid) return () => {};
  const location = ref(db, `studyHelperSessions/${uid}`);
  const handler = snapshot => {
    const sessions = [];
    snapshot.forEach(child => sessions.push({ id: child.key, ...child.val() }));
    sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    callback(sessions);
  };
  onValue(location, handler);
  return () => off(location, 'value', handler);
}
