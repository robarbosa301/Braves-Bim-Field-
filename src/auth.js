// Thin wrapper over Firebase Auth's Google sign-in — kept separate from
// storage.js since this is about *who* is using the app, not persisting
// project data. Login is entirely optional: every call here is a no-op
// when Firebase isn't configured, so the rest of the app (and every device
// without a Google account) keeps working exactly as it did before this
// existed, purely local per-device.
//
// signInWithRedirect (not signInWithPopup) — a Google account picker popup
// often can't open at all inside an installed PWA's standalone window on
// iOS, where this app is actually used in the field. Redirect always works:
// it leaves the page, signs in on Google's own site, and comes back here —
// consumeRedirectResult() below picks up that return trip.
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from "firebase/auth";
import { auth, firebaseEnabled } from "./firebase.js";

export function signInWithGoogle() {
  if (!firebaseEnabled || !auth) return Promise.resolve();
  return signInWithRedirect(auth, new GoogleAuthProvider());
}

export function signOutUser() {
  if (!firebaseEnabled || !auth) return Promise.resolve();
  return signOut(auth);
}

// Call once on app start — resolves the user that just came back from the
// Google redirect (if any). Harmless (resolves null) on every other load.
export async function consumeRedirectResult() {
  if (!firebaseEnabled || !auth) return null;
  try {
    const result = await getRedirectResult(auth);
    return result?.user || null;
  } catch (e) {
    return null;
  }
}

// Keeps firing with the current user (or null) across the whole session,
// including the one at page load once Firebase has restored it from its
// own persisted session — same shape as onAuthStateChanged itself so the
// caller can just useEffect(() => watchAuthState(setUser), []).
export function watchAuthState(callback) {
  if (!firebaseEnabled || !auth) { callback(null); return () => {}; }
  return onAuthStateChanged(auth, callback);
}
