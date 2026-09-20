import { useState, useEffect } from "react";
import { Tablet, Smartphone, Building2, ArrowUpRight, RefreshCw, LogIn, LogOut } from "lucide-react";
import { C, mono, heading } from "./theme.js";
import { genCode, composeAddress } from "./utils.js";
import { idbGet, idbSet, getUserProjects, addUserProject } from "./storage.js";
import { firebaseEnabled } from "./firebase.js";
import { signInWithGoogle, signOutUser, watchAuthState, consumeRedirectResult } from "./auth.js";
import { SYMBOL_LOGO, METAL_BG, Watermark } from "./branding.jsx";
import { CornerBrackets } from "./ElementRows.jsx";

// A quick, one-shot "sketch it, then it's built" flourish that plays above
// the logo on landing: a little floor plan (walls, a door swing, a
// dimension line) draws itself in like a field survey — then a handful of
// points along it light up and link together into a small network, as if
// the sketch just got read and connected into a model, before the whole
// thing collapses away right as the logo rises. Stands in for "levantamento
// de obra" (the survey itself), "inteligência artificial" (the sketch being
// read and connected on its own) and "integração" (the resulting network)
// in one continuous beat, on top of being distinct from a plain fade-in.
function BlueprintIntro() {
  const nodes = [[30, 24], [130, 24], [58, 74], [122, 46]];
  return (
    <div className="braves-blueprint-wrap flex justify-center" aria-hidden="true">
      <svg width="128" height="70" viewBox="0 0 160 88" fill="none">
        <path className="braves-blueprint-path" pathLength="1" style={{ animationDelay: "0s" }}
          d="M30,24 L130,24 L130,74 L92,74 M58,74 L30,74 L30,24"
          stroke={C.chalk} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" />
        <path className="braves-blueprint-path" pathLength="1" style={{ animationDelay: "0.12s" }}
          d="M30,10 L130,10 M30,5 L30,15 M130,5 L130,15"
          stroke={C.mute} strokeWidth="1.2" />
        <path className="braves-blueprint-path" pathLength="1" style={{ animationDelay: "0.4s" }}
          d="M130,40 L122,40 L122,52 L130,52"
          stroke={C.mute} strokeWidth="1.4" />
        <path className="braves-blueprint-path" pathLength="1" style={{ animationDelay: "0.32s" }}
          d="M58,74 A34,34 0 0 1 92,40 M58,74 L92,40"
          stroke="#FFFFFF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path className="braves-network-path" pathLength="1" style={{ animationDelay: "0.68s" }}
          d="M30,24 L130,24 L122,46 L58,74 L30,24"
          stroke="#FFFFFF" strokeWidth="0.9" opacity="0.55" />
        {nodes.map(([nx, ny], i) => (
          <circle key={i} className="braves-node" cx={nx} cy={ny} r="2.6" fill="#FFFFFF" style={{ animationDelay: `${0.56 + i * 0.05}s` }} />
        ))}
      </svg>
    </div>
  );
}

// "BRAVES BIM FIELD", revealed one letter at a time (fade + rise, staggered
// a beat apart via each span's own animationDelay) right as the logo
// finishes rising — quicker and less dated than a typewriter effect with a
// blinking cursor. aria-hidden on the letters plus an aria-label on the
// wrapper keeps a screen reader from spelling the title out character by
// character.
const TITLE = "BRAVES BIM FIELD";
function AnimatedTitle() {
  return (
    <span aria-label={TITLE}>
      {TITLE.split("").map((ch, i) => (
        <span key={i} className="braves-letter" aria-hidden="true" style={{ animationDelay: `${0.95 + i * 0.018}s` }}>
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}

// Four small corner marks that snap into place once on arrival, unselected
// — the same shape CornerBrackets (ElementRows.jsx) draws around whichever
// device card IS selected, borrowed here as an intro flourish so a device
// card reads as "measured and marked out" rather than just fading up.
function IntroCorners({ baseDelay }) {
  const s = { position: "absolute", width: 14, height: 14, borderColor: "rgba(255,255,255,0.4)" };
  const corners = [
    { top: 6, left: 6, borderTop: "2px solid", borderLeft: "2px solid", borderTopLeftRadius: 4 },
    { top: 6, right: 6, borderTop: "2px solid", borderRight: "2px solid", borderTopRightRadius: 4 },
    { bottom: 6, left: 6, borderBottom: "2px solid", borderLeft: "2px solid", borderBottomLeftRadius: 4 },
    { bottom: 6, right: 6, borderBottom: "2px solid", borderRight: "2px solid", borderBottomRightRadius: 4 },
  ];
  return corners.map((c, i) => (
    <div key={i} className="braves-corner" style={{ ...s, ...c, animationDelay: `${baseDelay + i * 0.04}s` }} />
  ));
}

// The app's start screen (device role, new vs. join project) and, once
// starting a new project, its building-info step — split out of App.jsx
// since it only needs the onJoin callback from the parent.

export default function JoinScreen({ onJoin }) {
  const [role, setRole] = useState("tablet");
  const [mode, setMode] = useState("create");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("start");
  const [building, setBuilding] = useState({ name: "", street: "", number: "", neighborhood: "", cep: "", city: "", state: "", country: "Brasil", type: "Residencial", levelsCount: "1" });
  const [cepStatus, setCepStatus] = useState("");

  useEffect(() => {
    const digits = building.cep.replace(/\D/g, "");
    if (digits.length !== 8) { setCepStatus(""); return; }
    let cancelled = false;
    setCepStatus("buscando");
    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.erro) { setCepStatus("nao-encontrado"); return; }
        setBuilding(b => ({
          ...b,
          street: data.logradouro || b.street,
          neighborhood: data.bairro || b.neighborhood,
          city: data.localidade || b.city,
          state: data.uf || b.state,
          country: "Brasil",
        }));
        setCepStatus("ok");
      })
      .catch(() => { if (!cancelled) setCepStatus("nao-encontrado"); });
    return () => { cancelled = true; };
  }, [building.cep]);
  const [savedProjects, setSavedProjects] = useState([]);
  const [showAllProjects, setShowAllProjects] = useState(false);
  const [user, setUser] = useState(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    idbGet("projects-index").then(list => setSavedProjects(list || []));
  }, []);

  // Login is entirely optional — every device keeps working off its own
  // local projects-index with no account at all. Logging in just also pulls
  // in whatever this same Google account already created/joined from OTHER
  // devices (getUserProjects), merged into the same list by project code so
  // it reads as one "Meus Projetos", not two separate ones.
  useEffect(() => {
    consumeRedirectResult().finally(() => {
      const unsub = watchAuthState(setUser);
      return unsub;
    });
  }, []);
  useEffect(() => {
    if (!user) return;
    getUserProjects(user.uid).then(cloudList => {
      if (!cloudList.length) return;
      setSavedProjects(local => {
        const byCode = new Map(local.map(p => [p.code, p]));
        cloudList.forEach(p => byCode.set(p.code, { ...byCode.get(p.code), ...p }));
        const merged = [...byCode.values()];
        idbSet("projects-index", merged);
        return merged;
      });
    });
  }, [user]);

  function goToBuilding() {
    const finalCode = genCode();
    setCode(finalCode);
    setStep("building");
  }
  async function handleJoinExisting(codeOverride) {
    setBusy(true);
    const finalCode = (codeOverride || code).trim().toUpperCase();
    await onJoin(finalCode, role, null);
    if (user) {
      const joined = savedProjects.find(p => p.code === finalCode);
      addUserProject(user.uid, { code: finalCode, name: joined?.name || finalCode, address: joined?.address || "", roomsCount: joined?.roomsCount || 0 });
    }
    setBusy(false);
  }
  async function handleCreateBuilding() {
    setBusy(true);
    await onJoin(code, role, building);
    if (user) addUserProject(user.uid, { code, name: building.name, address: composeAddress(building), roomsCount: 0 });
    setBusy(false);
  }

  if (step === "building") {
    return (
      <div className="braves-app-root relative w-full min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden" style={METAL_BG}>
        <Watermark />
        <div className="relative w-full max-w-sm">
          <div className="flex flex-col items-center gap-2 mb-6">
            <img src={SYMBOL_LOGO} alt="Braves BIM Field" style={{ height: 34, width: "auto" }} />
            <div style={{ ...heading, color: C.chalk, fontSize: "15px", fontWeight: 700, letterSpacing: "0.02em" }}>BRAVES BIM FIELD</div>
            <div className="text-[10px]" style={{ ...mono, color: C.mute, letterSpacing: "0.08em" }}>DADOS DA EDIFICAÇÃO</div>
          </div>
          <p className="text-[11px] mb-4" style={{ color: C.mute }}>Antes de desenhar, conte um pouco sobre o imóvel. Depois disso você vai direto para o croqui e desenha a edificação inteira, ambiente por ambiente.</p>
          <div className="space-y-2.5">
            <input placeholder="Nome do imóvel / projeto" value={building.name} onChange={e => setBuilding({ ...building, name: e.target.value })}
              className="w-full px-3 py-2.5 rounded text-sm" style={{ background: C.panel, color: C.chalk, border: `1px solid ${C.line}` }} />
            <div className="relative">
              <input placeholder="CEP" value={building.cep} onChange={e => setBuilding({ ...building, cep: e.target.value })}
                className="w-full px-3 py-2.5 rounded text-sm" style={{ background: C.panel, color: C.chalk, border: `1px solid ${C.line}` }} />
              {cepStatus === "buscando" && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: C.mute }}>buscando…</span>}
              {cepStatus === "ok" && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: C.chalk }}>✓ encontrado</span>}
              {cepStatus === "nao-encontrado" && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: C.mute }}>não encontrado — preencha à mão</span>}
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <input placeholder="Rua" value={building.street} onChange={e => setBuilding({ ...building, street: e.target.value })}
                className="col-span-2 px-3 py-2.5 rounded text-sm" style={{ background: C.panel, color: C.chalk, border: `1px solid ${C.line}` }} />
              <input placeholder="Número" value={building.number} onChange={e => setBuilding({ ...building, number: e.target.value })}
                className="px-3 py-2.5 rounded text-sm" style={{ background: C.panel, color: C.chalk, border: `1px solid ${C.line}` }} />
            </div>
            <input placeholder="Bairro" value={building.neighborhood} onChange={e => setBuilding({ ...building, neighborhood: e.target.value })}
              className="w-full px-3 py-2.5 rounded text-sm" style={{ background: C.panel, color: C.chalk, border: `1px solid ${C.line}` }} />
            <div className="grid grid-cols-2 gap-2.5">
              <input placeholder="Cidade" value={building.city} onChange={e => setBuilding({ ...building, city: e.target.value })}
                className="px-3 py-2.5 rounded text-sm" style={{ background: C.panel, color: C.chalk, border: `1px solid ${C.line}` }} />
              <input placeholder="Estado" value={building.state} onChange={e => setBuilding({ ...building, state: e.target.value })}
                className="px-3 py-2.5 rounded text-sm" style={{ background: C.panel, color: C.chalk, border: `1px solid ${C.line}` }} />
            </div>
            <input placeholder="País" value={building.country} onChange={e => setBuilding({ ...building, country: e.target.value })}
              className="w-full px-3 py-2.5 rounded text-sm" style={{ background: C.panel, color: C.chalk, border: `1px solid ${C.line}` }} />
            <div className="grid grid-cols-2 gap-2.5">
              <select value={building.type} onChange={e => setBuilding({ ...building, type: e.target.value })}
                className="px-3 py-2.5 rounded text-sm" style={{ background: C.panel, color: C.chalk, border: `1px solid ${C.line}` }}>
                {["Residencial", "Comercial", "Industrial", "Institucional", "Misto"].map(o => <option key={o}>{o}</option>)}
              </select>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <input type="text" inputMode="numeric" value={building.levelsCount} onChange={e => setBuilding({ ...building, levelsCount: e.target.value })}
                  className="w-10 bg-transparent text-sm" style={{ color: C.chalk }} />
                <span className="text-[11px]" style={{ color: C.mute }}>nível(is)</span>
              </div>
            </div>
          </div>
          <button onClick={handleCreateBuilding} disabled={busy || !building.name.trim()}
            className="w-full py-4 rounded-2xl text-base font-semibold flex items-center justify-center gap-2 mt-5"
            style={{ background: "#F2F1ED", color: "#141311", opacity: busy || !building.name.trim() ? 0.6 : 1 }}>
            Ir para o croqui <ArrowUpRight size={18} style={{ transform: "rotate(45deg)" }} />
          </button>
          <button onClick={() => setStep("start")} className="w-full text-[11px] mt-3" style={{ color: C.muteDim }}>← Voltar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="braves-app-root relative w-full min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden" style={METAL_BG}>
      <Watermark />
      <div className="relative w-full max-w-sm mt-16">
        <div className="braves-anim-in flex flex-col items-center gap-4 mb-7" style={{ animationDelay: "0s" }}>
          <BlueprintIntro />
          <img src={SYMBOL_LOGO} alt="Braves BIM Field" className="braves-logo-build" style={{ height: 176, width: "auto" }} />
          <div className="text-center">
            <div style={{ ...heading, color: C.chalk, fontSize: "26px", letterSpacing: "0.01em", fontWeight: 800 }}>
              <AnimatedTitle />
            </div>
            <div className="text-[11px] mt-1.5" style={{ color: C.mute, letterSpacing: "0.18em" }}>PROJETOS E CONSTRUÇÕES EFICIENTES</div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-7">
          <div className="braves-rule" style={{ flex: 1, height: 1, background: C.line, transformOrigin: "right", animationDelay: "0.1s" }} />
          <span className="braves-wipe-in text-sm" style={{ color: C.mute, animationDelay: "0.45s" }}>Prancheta BIM de campo</span>
          <div className="braves-rule" style={{ flex: 1, height: 1, background: C.line, transformOrigin: "left", animationDelay: "0.1s" }} />
        </div>

        <div>
          <div className="braves-wipe-in text-sm mb-3" style={{ color: C.mute, animationDelay: "0.6s" }}>Este dispositivo é um</div>
          <div className="relative grid grid-cols-2 gap-3 mb-6">
            <div className="braves-sync-badge" aria-hidden="true" style={{ position: "absolute", left: "50%", top: "50%", zIndex: 1, animationDelay: "1.35s" }}>
              <div style={{ width: 22, height: 22, borderRadius: 999, background: "#141311", border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <RefreshCw size={11} color={C.chalk} />
              </div>
            </div>
            {[{ id: "tablet", label: "Tablet", sub: "Para visualizar plantas", Icon: Tablet }, { id: "phone", label: "Celular", sub: "Para fotos de campo", Icon: Smartphone }].map(({ id, label, sub, Icon }, i) => (
              <button key={id} onClick={() => setRole(id)} className="braves-fade relative py-7 rounded-2xl flex flex-col items-center gap-2.5"
                style={{ background: C.panel, border: `1px solid ${role === id ? "rgba(255,255,255,0.35)" : C.line}`, animationDelay: `${0.55 + i * 0.06}s` }}>
                <CornerBrackets active={role === id} />
                <IntroCorners baseDelay={0.7 + i * 0.06} />
                <div className="braves-wipe-in flex flex-col items-center gap-2.5" style={{ animationDelay: `${0.9 + i * 0.06}s` }}>
                  <Icon size={30} color={role === id ? C.gold : C.chalk} strokeWidth={1.5} />
                  <div className="text-center">
                    <div className="text-base font-semibold" style={{ color: C.chalk }}>{label}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: C.mute }}>{sub}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {firebaseEnabled && (
          <div className="braves-wipe-in mb-4" style={{ animationDelay: "1.0s" }}>
            <div className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              {user ? (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    {user.photoURL
                      ? <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" />
                      : <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: C.goldTint, color: C.gold, fontSize: 11 }}>{(user.displayName || user.email || "?")[0].toUpperCase()}</div>}
                    <span className="text-[11px] truncate" style={{ color: C.chalk }}>{user.displayName || user.email}</span>
                  </div>
                  <button onClick={async () => { setAuthBusy(true); setAuthError(""); try { await signOutUser(); } catch (e) { setAuthError("Não deu pra sair agora — tente de novo."); } setAuthBusy(false); }} disabled={authBusy}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded shrink-0" style={{ color: C.mute }}>
                    <LogOut size={12} /> Sair
                  </button>
                </>
              ) : (
                <>
                  <span className="text-[11px]" style={{ color: C.mute }}>Entre pra ver seus projetos em qualquer aparelho</span>
                  <button onClick={async () => {
                    setAuthBusy(true); setAuthError("");
                    try { await signInWithGoogle(); } catch (e) { setAuthError("Não deu pra entrar agora — verifique sua internet e tente de novo."); }
                    setAuthBusy(false);
                  }} disabled={authBusy}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded shrink-0" style={{ ...heading, fontWeight: 600, color: C.gold, background: C.goldTint, border: `1px solid ${C.gold}` }}>
                    <LogIn size={12} /> Entrar com Google
                  </button>
                </>
              )}
            </div>
            {authError && <div className="text-[10px] mt-1" style={{ color: C.bad }}>{authError}</div>}
          </div>
        )}

        <div className="braves-wipe-in" style={{ animationDelay: "1.05s" }}>
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <button onClick={() => setMode("create")} className="py-3.5 rounded-xl text-sm font-medium"
              style={{ background: mode === "create" ? C.goldTint : "transparent", color: mode === "create" ? C.gold : C.chalk, border: `1px solid ${mode === "create" ? "#FFFFFF" : C.line}` }}>Novo levantamento</button>
            <button onClick={() => setMode("join")} className="py-3.5 rounded-xl text-sm font-medium"
              style={{ background: mode === "join" ? C.goldTint : "transparent", color: mode === "join" ? C.gold : C.chalk, border: `1px solid ${mode === "join" ? "#FFFFFF" : C.line}` }}>Meus Projetos</button>
          </div>
          {mode === "join" && (
            <>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="Código do projeto (ex: 7K2P)"
                className="w-full mb-3 px-3 py-2.5 rounded-xl text-sm uppercase" style={{ ...mono, background: C.panel, color: C.chalk, border: `1px solid ${C.line}` }} />
              {savedProjects.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-[10px]" style={{ color: C.mute, letterSpacing: "0.06em" }}>OU ESCOLHA UM LEVANTAMENTO SALVO NESTE APARELHO</div>
                    {savedProjects.length > 2 && (
                      <button onClick={() => setShowAllProjects(v => !v)} className="text-[10px] font-semibold shrink-0 ml-2" style={{ color: C.gold }}>
                        {showAllProjects ? "Ver menos" : `Todos (${savedProjects.length})`}
                      </button>
                    )}
                  </div>
                  {showAllProjects ? (
                    // "Todos": a proper grid of every saved project instead
                    // of the same short scrolling list — each card stands in
                    // as a thumbnail (icon + name + address + stats) since a
                    // real floor-plan preview would mean loading every
                    // project's full geometry from IndexedDB just to draw one.
                    <div className="grid grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                      {savedProjects.map(p => (
                        <button key={p.code} onClick={() => handleJoinExisting(p.code)}
                          className="text-left p-2.5 rounded-xl flex flex-col gap-1.5" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                          <div className="w-full aspect-square rounded-lg flex items-center justify-center" style={{ background: C.panelAlt }}>
                            <Building2 size={26} color={C.gold} />
                          </div>
                          <div className="text-xs truncate" style={{ color: C.chalk }}>{p.name}</div>
                          <div className="text-[10px] truncate" style={{ color: C.mute }}>{p.address || "sem endereço"}</div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px]" style={{ color: C.mute }}>{p.roomsCount || 0} amb.</span>
                            <span className="text-[10px]" style={{ ...mono, color: C.gold }}>{p.code}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {savedProjects.map(p => (
                        <button key={p.code} onClick={() => handleJoinExisting(p.code)}
                          className="w-full text-left p-2.5 rounded-xl flex items-center gap-2" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                          <Building2 size={15} color={C.gold} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs truncate" style={{ color: C.chalk }}>{p.name}</div>
                            <div className="text-[10px] truncate" style={{ color: C.mute }}>{p.address || "sem endereço"} · {p.roomsCount || 0} ambiente(s)</div>
                          </div>
                          <span className="text-[10px] shrink-0" style={{ ...mono, color: C.gold }}>{p.code}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          <button onClick={mode === "create" ? goToBuilding : () => handleJoinExisting()} disabled={busy || (mode === "join" && !code.trim())}
            className="w-full py-4 rounded-2xl text-base font-semibold flex items-center justify-center gap-2 mt-2"
            style={{ background: "#F2F1ED", color: "#141311", opacity: busy || (mode === "join" && !code.trim()) ? 0.6 : 1 }}>
            Continuar <ArrowUpRight size={18} style={{ transform: "rotate(45deg)" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
