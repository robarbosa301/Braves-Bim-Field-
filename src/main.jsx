import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import PranchetaBIM from "./App.jsx";
import "./index.css";

// The DSN isn't secret (it ends up in the public bundle either way, same as
// the Firebase config) — it only identifies where to send error reports, it
// can't be used to read/write anything. No tracing/session replay: those
// would need a privacy-policy update (session replay records real screens)
// and aren't needed just to see when/where the app crashes for a field crew.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({ dsn: sentryDsn });
}

// Standalone and deliberately independent of the main app's own render
// tree/state (PranchetaBIM) — this only ever needs to know one thing (did
// a newer service worker just take over?) and showing it has to keep
// working even if the main app itself is mid-crash. The service worker
// (public/sw.js) already self-activates immediately on every deploy
// (skipWaiting + clients.claim — no "waiting" step for anyone to approve),
// but that only swaps which SW answers future network requests; the JS
// already running in this open tab stays the OLD version until an actual
// reload happens. On a PWA added to the iPad/iPhone home screen, that
// reload was easy to miss: backgrounding and re-opening the app doesn't
// fire the page's own "load" event again (main.jsx's own update() check
// never reruns), so a new version could sit fully deployed and published
// while the open app kept running the old one indefinitely with no sign
// anything had changed.
function UpdateBanner() {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // A controllerchange fires the FIRST time a service worker ever takes
    // control of a freshly-opened tab too, not just on a later update —
    // only treat it as "a new version replaced the one I was already
    // running" when this tab already had an active controller at mount.
    const hadController = !!navigator.serviceWorker.controller;
    const onControllerChange = () => { if (hadController) setShow(true); };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    // Coming back to the foreground is this app's real equivalent of
    // "reopening" on a PWA that iOS just resumed instead of reloading —
    // re-checks for a new deploy right then instead of waiting for
    // whatever interval the browser's own background update heuristic
    // uses (which can be hours).
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      navigator.serviceWorker.getRegistration().then(reg => reg && reg.update());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  if (!show) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
      padding: "10px 14px", background: "#D9B35B", color: "#141311",
      fontFamily: "sans-serif", fontSize: 13, fontWeight: 600,
      boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
    }}>
      <span>Uma nova versão do app está pronta.</span>
      <button onClick={() => window.location.reload()}
        style={{ padding: "4px 12px", borderRadius: 8, background: "#141311", color: "#F2F1ED", border: "none", fontSize: 12, fontWeight: 700 }}>
        Atualizar agora
      </button>
    </div>
  );
}

function CrashFallback({ eventId }) {
  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24, textAlign: "center", background: "#141311", color: "#F3F1EA", fontFamily: "sans-serif" }}>
      <div style={{ fontSize: 15, fontWeight: 600 }}>Algo deu errado.</div>
      <div style={{ fontSize: 12, color: "#A39D90", maxWidth: 320 }}>
        O erro foi registrado automaticamente. Seus dados já salvos não foram perdidos — feche e abra o app de novo pra continuar.
      </div>
      {eventId && <div style={{ fontSize: 10, color: "#7A756B" }}>Código: {eventId}</div>}
      <button onClick={() => window.location.reload()}
        style={{ marginTop: 8, padding: "10px 20px", borderRadius: 12, background: "#F2F1ED", color: "#141311", border: "none", fontSize: 13, fontWeight: 600 }}>
        Recarregar
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <UpdateBanner />
    <Sentry.ErrorBoundary fallback={({ eventId }) => <CrashFallback eventId={eventId} />}>
      <PranchetaBIM />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // updateViaCache: "none" stops the browser from ever satisfying the SW
    // script fetch itself from HTTP cache — without it, an already-cached
    // sw.js can make every future deploy invisible even though the site's
    // own network-first fetch logic is otherwise correct. The explicit
    // update() call forces an immediate check instead of waiting for the
    // browser's own (much longer) update heuristic.
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: "none" })
      .then((reg) => reg.update());
  });
}
