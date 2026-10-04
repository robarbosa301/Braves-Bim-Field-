import {
  collection, doc, getDoc, setDoc, deleteDoc, getDocs, query, where, documentId, serverTimestamp, orderBy, limit,
} from "firebase/firestore";
import { db, firebaseEnabled } from "./firebase.js";
import { composeAddress } from "./utils.js";

// Drop-in replacement for the Claude Artifact runtime's window.storage API:
// shared=true goes to Firestore (synced across devices), shared=false stays
// on this device via localStorage. Mirrors the {get,set,list,delete} shape
// so the rest of the app doesn't need to know which backend is used.

function kvDoc(key) {
  return doc(collection(db, "kv"), key);
}

export async function safeGet(key, shared) {
  try {
    if (shared) {
      if (!firebaseEnabled) return null;
      const snap = await getDoc(kvDoc(key));
      return snap.exists() ? snap.data().value : null;
    }
    return localStorage.getItem(key);
  } catch (e) { return null; }
}

export async function safeSet(key, value, shared) {
  try {
    if (shared) {
      if (!firebaseEnabled) return false;
      await setDoc(kvDoc(key), { value, updatedAt: serverTimestamp() });
      return true;
    }
    localStorage.setItem(key, value);
    return true;
  } catch (e) { return false; }
}

export async function safeList(prefix, shared) {
  try {
    if (shared) {
      if (!firebaseEnabled) return [];
      const q = query(
        collection(db, "kv"),
        where(documentId(), ">=", prefix),
        where(documentId(), "<", prefix + "")
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => d.id);
    }
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    return keys;
  } catch (e) { return []; }
}

export async function safeDelete(key, shared) {
  try {
    if (shared) {
      if (!firebaseEnabled) return false;
      await deleteDoc(kvDoc(key));
      return true;
    }
    localStorage.removeItem(key);
    return true;
  } catch (e) { return false; }
}

// Structured (non-JSON-blob) project metadata, one doc per project code, so
// external tools — the Revit add-in in particular — can list/search projects
// by name via Firestore's REST API without having to parse the `kv` blobs.
export async function syncProjectMeta(code, meta) {
  try {
    if (!firebaseEnabled || !code) return false;
    await setDoc(doc(collection(db, "projects"), code), { ...meta, code, updatedAt: serverTimestamp() });
    return true;
  } catch (e) { return false; }
}

// A logged-in user's own project list — same "kv" collection every other
// shared value already goes through (no new Firestore rule needed), just
// keyed by uid instead of project code. This is what makes "Meus Projetos"
// follow the person instead of the device: created/joined on a phone while
// logged in, it shows up on an iPad logged into the same account too.
export async function getUserProjects(uid) {
  if (!uid) return [];
  const raw = await safeGet(`user-projects:${uid}`, true);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (e) { return []; }
}
export async function addUserProject(uid, meta) {
  if (!uid || !meta?.code) return;
  const list = await getUserProjects(uid);
  const next = [meta, ...list.filter(p => p.code !== meta.code)].slice(0, 200);
  await safeSet(`user-projects:${uid}`, JSON.stringify(next), true);
}

// Every project this app has ever created or opened — not scoped to this
// device (projects-index, App.jsx) or to a logged-in account
// (getUserProjects above), both of which only ever learn about a project
// the FIRST time it's created/joined from that exact device/account. A
// project from before either existed, or opened only from a device that's
// since been wiped, has no way back into either list — its data is still
// sitting in Firestore, just with nothing pointing at it anymore except a
// 4-character code nobody remembers. Firestore's own read rules are
// already wide open here (see firestore.rules — no login model to scope
// reads to), so this is a straight, unscoped list of what's actually there.
export async function listAllCloudProjects() {
  if (!firebaseEnabled) return [];
  try {
    const metaSnap = await getDocs(query(collection(db, "projects"), orderBy("updatedAt", "desc"), limit(300)));
    const byCode = new Map(metaSnap.docs.map(d => [d.id, { code: d.id, ...d.data() }]));

    // Belt-and-suspenders: a project's own bim-project:<code>:data write
    // (its real survey data) has existed since the sync feature itself was
    // built, older than the "projects" metadata mirror above — so a
    // project whose metadata write never landed (an old version of the
    // app, a failed write) still turns up here, with its name/counts read
    // straight out of that data instead of being permanently unreachable.
    const dataSnap = await getDocs(query(
      collection(db, "kv"),
      where(documentId(), ">=", "bim-project:"),
      where(documentId(), "<", "bim-project:"),
    ));
    dataSnap.docs.forEach(d => {
      const m = /^bim-project:(.+):data$/.exec(d.id);
      if (!m || byCode.has(m[1])) return;
      try {
        const parsed = JSON.parse(d.data().value);
        byCode.set(m[1], {
          code: m[1],
          name: parsed.buildingInfo?.name || "Sem nome",
          address: composeAddress(parsed.buildingInfo || {}),
          roomsCount: (parsed.rooms || []).length,
          levelsCount: (parsed.levels || []).length,
        });
      } catch (e) { /* unparseable/legacy entry — skip it */ }
    });

    return [...byCode.values()];
  } catch (e) { return []; }
}

// ---- local device cache (IndexedDB) ----------------------------------------
// Separate from safeGet/safeSet's localStorage fallback above: this is a
// dedicated key/value store used for larger per-device payloads (a whole
// project's data) that localStorage's ~5MB-ish quota isn't a safe fit for.
function openLocalDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) { reject(new Error("no-indexeddb")); return; }
    const req = indexedDB.open("braves_prancheta", 1);
    req.onupgradeneeded = () => { req.result.createObjectStore("kv", { keyPath: "key" }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function idbGet(key) {
  try {
    const db = await openLocalDB();
    return await new Promise((resolve) => {
      const tx = db.transaction("kv", "readonly");
      const r = tx.objectStore("kv").get(key);
      r.onsuccess = () => resolve(r.result ? r.result.value : null);
      r.onerror = () => resolve(null);
    });
  } catch (e) { return null; }
}
export async function idbSet(key, value) {
  try {
    const db = await openLocalDB();
    return await new Promise((resolve) => {
      const tx = db.transaction("kv", "readwrite");
      tx.objectStore("kv").put({ key, value });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) { return false; }
}
