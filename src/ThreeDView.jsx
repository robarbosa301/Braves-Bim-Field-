import { useRef, useState, useEffect, useLayoutEffect } from "react";
import * as THREE from "three";
import { C, matchesPhaseView } from "./theme.js";
import { toNum, wallNetAreaM2 } from "./utils.js";
import { pointInPolygon, polygonAreaXZ } from "./geometry.js";
import { wallThicknessM, FLOOR_TYPES, DOOR_MATERIAL_MIX, WINDOW_MATERIAL_MIX } from "./constants.js";

// Split out of App.jsx and lazy-loaded (see the React.lazy import there) so
// three.js — a large dependency only ever needed once someone opens the 3D
// tab — isn't part of the app's initial bundle.
const _textureCache = new Map();
function getWallTexture(finish, color) {
  const key = (finish || "A definir") + "|" + (color || "");
  if (_textureCache.has(key)) return _textureCache.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const paintish = finish === "Pintura";
  const floorDefault = finish === "Porcelanato" ? "#E4E1D8" : finish === "Cerâmica" ? "#D8CFC0" : finish === "Madeira/Laminado" ? "#B08A5C" : finish === "Vinílico" ? "#C9C2B4" : finish === "Korodur" ? "#8C9A93" : finish === "Deck" ? "#9C7A52" : "#D9D4C8";
  // A floor's own family (Piso tool or a room's floorFinish) is always
  // user-colorable, the same custom color the 2D plan already fills its
  // polygon with — unlike a WALL finish, where "color" only ever means
  // something for Pintura (every wall face carries a default paintColor
  // regardless of finish, so honoring it for e.g. "Revestimento cerâmico"
  // would silently override that finish's own tone with whatever the
  // paint swatch happens to be set to).
  const isFloorFamily = FLOOR_TYPES.includes(finish);
  const base = paintish ? (color || "#E8E4DA") : isFloorFamily ? (color || floorDefault) : floorDefault;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);

  if (finish === "Sem reboco (aparente)") {
    ctx.strokeStyle = "rgba(0,0,0,0.28)"; ctx.lineWidth = 2;
    for (let y = 0; y < 128; y += 16) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke();
      const offset = (y / 16) % 2 === 0 ? 0 : 16;
      for (let x = offset; x < 128; x += 32) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 16); ctx.stroke(); }
    }
  } else if (finish === "Revestimento cerâmico" || finish === "Porcelanato" || finish === "Cerâmica") {
    const step = finish === "Cerâmica" ? 24 : 32;
    ctx.strokeStyle = "rgba(0,0,0,0.16)"; ctx.lineWidth = 2;
    for (let i = 0; i <= 128; i += step) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke();
    }
  } else if (finish === "Madeira/Laminado") {
    ctx.strokeStyle = "rgba(0,0,0,0.18)"; ctx.lineWidth = 1.5;
    for (let y = 0; y < 128; y += 14) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke(); }
    for (let i = 0; i < 40; i++) { ctx.strokeStyle = "rgba(0,0,0,0.06)"; ctx.beginPath(); const y = Math.random() * 128; ctx.moveTo(Math.random() * 100, y); ctx.lineTo(Math.random() * 100 + 20, y); ctx.stroke(); }
  } else if (finish === "Vinílico") {
    for (let i = 0; i < 200; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; ctx.fillRect(Math.random() * 128, Math.random() * 128, 3, 3); }
  } else if (finish === "Deck") {
    // Wider, unevenly-spaced boards than Madeira/Laminado, plus a visible
    // gap line between each — a deck's own boards read as distinct planks
    // rather than laminate's tight continuous strips.
    ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 2.5;
    for (let y = 0; y < 128; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke(); }
    for (let i = 0; i < 50; i++) { ctx.strokeStyle = "rgba(0,0,0,0.08)"; ctx.beginPath(); const y = Math.random() * 128; ctx.moveTo(Math.random() * 110, y); ctx.lineTo(Math.random() * 110 + 15, y); ctx.stroke(); }
  } else if (finish === "Korodur") {
    // Smooth resinous/epoxy industrial floor — a fine even speckle instead
    // of any grout lines or grain, closer to a sprayed finish than a laid
    // material.
    for (let i = 0; i < 700; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 1, 1);
    }
  } else if (finish === "Textura acrílica") {
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.15})`;
      ctx.beginPath(); ctx.arc(Math.random() * 128, Math.random() * 128, 1.4, 0, 7); ctx.fill();
    }
  } else if (finish === "Pintura") {
    const grad = ctx.createLinearGradient(0, 0, 128, 128);
    grad.addColorStop(0, "rgba(255,255,255,0.10)");
    grad.addColorStop(1, "rgba(0,0,0,0.06)");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 128, 128);
  } else if (finish === "Forro de gesso" || finish === "Forro em PVC" || finish === "Forro mineral (lay-in)") {
    ctx.strokeStyle = "rgba(0,0,0,0.12)"; ctx.lineWidth = 1.5;
    const step = finish === "Forro mineral (lay-in)" ? 32 : 64;
    for (let i = 0; i <= 128; i += step) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke(); }
  } else {
    for (let i = 0; i < 420; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  _textureCache.set(key, tex);
  return tex;
}

// A painted wall face is meant to read as one flat, uniform coat of color —
// tiling getWallTexture's subtle gradient canvas across a whole wall (like
// every other finish does, to show a repeating brick/tile/wood pattern)
// instead made the paint look like a grid of visible squares. So Pintura
// skips the texture entirely and uses the color straight on the material.
function wallFaceMaterial(finish, color, segLen, segH) {
  if (finish === "Pintura") return new THREE.MeshStandardMaterial({ color: color || "#E8E4DA", roughness: 0.45 });
  const tex = getWallTexture(finish, color).clone();
  tex.needsUpdate = true;
  tex.repeat.set(Math.max(1, segLen / 1.1), Math.max(1, segH / 1.1));
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 });
}

// A literal [] as a default parameter is a FRESH array on every single call
// where the caller omits roofs (the isolated "Ambiente" 3D view never
// passes one) — including a re-render triggered by this component's own
// local state (tapping an element to select it). roofs sits in the main
// scene-building effect's dependency array, so that fresh reference made
// the effect think roofs itself had changed on every re-render, tearing the
// whole scene down and rebuilding it — whose own cleanup clears the
// selection it had JUST set two lines earlier. The net effect: any tap
// briefly selected something, then the immediate rebuild wiped it again, so
// nothing ever stayed selected. One shared, stable empty array fixes it.
const EMPTY_ROOFS = [];
// ---- 3D viewer (raw three.js — no OrbitControls addon available) ----------
export default function ThreeDView({ buildingLevels, elevationsById, roofs = EMPTY_ROOFS, openState = "closed", sectionCut, phaseView = "tudo", exportMarker = false }) {
  const mountRef = useRef(null);
  const hintRef = useRef(null);
  const [ok, setOk] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [emptyPhase, setEmptyPhase] = useState(false);
  // Tapped-wall legend (area/volume/room/material) — cleared whenever the
  // scene itself rebuilds (level, phase view, section cut…) since the mesh
  // it pointed at no longer exists once that happens.
  const [selectedWallInfo, setSelectedWallInfo] = useState(null);
  // A fixed 340px used to leave a big band of empty space below the model
  // on any screen taller than that — same "fill whatever's actually left
  // down to the bottom nav" auto-sizing the Croqui's own 2D canvas already
  // does. Kept as its own state (rather than measured inline in the effect
  // below) so a plain window resize/orientation change can update it
  // without needing to rebuild the whole scene from scratch first.
  const [dims, setDims] = useState({ w: 320, h: 340 });
  useLayoutEffect(() => {
    function measure() {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth || 320;
      const mountTop = mountRef.current.getBoundingClientRect().top;
      const nav = document.querySelector("[data-braves-bottom-nav]");
      const bottomEdge = nav ? nav.getBoundingClientRect().top : (window.innerHeight || 700);
      const belowH = hintRef.current ? hintRef.current.getBoundingClientRect().height : 20;
      const h = Math.max(220, bottomEdge - mountTop - belowH - 8);
      setDims(prev => (Math.abs(prev.w - w) > 1 || Math.abs(prev.h - h) > 1) ? { w, h } : prev);
    }
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      if (window.visualViewport) window.visualViewport.removeEventListener("resize", measure);
    };
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const totalWalls = buildingLevels.reduce((s, l) => s + l.walls.length, 0);
    if (totalWalls === 0) { setEmpty(true); setEmptyPhase(false); return; }
    // Distinguished from the "nothing drawn at all" case above — a phase
    // view can legitimately have nothing to show (e.g. "Demolição" on a
    // level where nothing's marked for demolition), which needs a
    // different message than "go draw something in the Croqui". Counts
    // doors/windows/stairs too, not just walls — a reforma where only a
    // door (not its wall) is marked for demolition used to read as
    // "nothing marked" and skip rendering entirely, even though the Croqui
    // itself would show that door in the same view.
    const visibleCount = phaseView === "tudo" ? totalWalls
      : buildingLevels.reduce((s, l) =>
        s + l.walls.filter(w => matchesPhaseView(w, phaseView)).length
          + l.doors.filter(d => matchesPhaseView(d, phaseView)).length
          + l.windows.filter(win => matchesPhaseView(win, phaseView)).length
          + (l.stairs || []).filter(st => matchesPhaseView(st, phaseView)).length, 0);
    if (visibleCount === 0) { setEmptyPhase(true); setEmpty(false); return; }
    setEmpty(false); setEmptyPhase(false);

    let renderer, raf, disposed = false;
    const cleanupFns = [];
    try {
      const width = dims.w, height = dims.h;
      // preserveDrawingBuffer: without it, the browser is free to clear the
      // WebGL drawing buffer right after compositing each frame — reading
      // it back later via canvas.toDataURL() (the PDF export's 3D
      // snapshot) then comes back blank, even though the canvas visibly
      // shows the scene on screen the whole time.
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.localClippingEnabled = true;
      // Each axis is independent — clippingPlanes takes an array and
      // three.js clips against the intersection of all of them, so any
      // combination (X+Y, X+Z, all three, …) just works by including
      // whichever axes are enabled, instead of only ever one at a time.
      const clipPlanes = [];
      if (sectionCut?.x?.enabled) clipPlanes.push(new THREE.Plane(new THREE.Vector3(-1, 0, 0), sectionCut.x.position));
      if (sectionCut?.y?.enabled) clipPlanes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), sectionCut.y.position));
      if (sectionCut?.z?.enabled) clipPlanes.push(new THREE.Plane(new THREE.Vector3(0, 0, -1), sectionCut.z.position));
      renderer.clippingPlanes = clipPlanes;
      mount.innerHTML = "";
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 400);
      // Every wall segment mesh pushed here (plus its shared userData —
      // one entry per whole wall, not per segment, so tapping any part of
      // a wall split by a door/window still reports the same wall) is
      // what tap-to-select raycasts against, below.
      const selectableMeshes = [];
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const dir = new THREE.DirectionalLight(0xffffff, 0.75);
      dir.position.set(10, 16, 8);
      scene.add(dir);

      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = 1;

      // Same "Vistas" a reforma project switches between in the Croqui —
      // "tudo" shows everything as-is; the other four each hide whichever
      // walls/openings don't actually exist at that stage of the work. A
      // room's floor/ceiling plane doesn't carry its own demolir/construir
      // flag, so it's handled separately below per level, mirroring the
      // Croqui's simpler (non-split) treatment for "novo": a room a new
      // wall cuts through just doesn't get a floor/ceiling plane there,
      // since the plane can't be recomputed into two here without redoing
      // VectorSketch's flood-fill trace.
      const phaseVisible = el => phaseView === "tudo" || matchesPhaseView(el, phaseView);

      // Positions a door/window relative to its own wall's line, independent
      // of whether that wall itself is being drawn in this phase view — the
      // Croqui's 2D view filters each element on its own terms (a door
      // marked "demolir" still shows even when its wall isn't), so an
      // orphaned opening below (its wall didn't pass phaseVisible) still
      // needs this to place its leaf correctly.
      function mapOpening(o, kind, w, ux, uz, len) {
        const pos = (o.x - w.x1) * ux + (o.y - w.y1) * uz;
        const halfW = Math.max(0.15, o.width / 2);
        return {
          ...o, kind, pos,
          start: Math.max(0, pos - halfW), end: Math.min(len, pos + halfW),
          yBottom: kind === "door" ? 0 : o.peitoril,
          yTop: kind === "door" ? o.height : o.peitoril + o.height,
        };
      }
      // Door/window leaves: split into their real panel ("folha") count,
      // always rotated flush with the wall's own angle so they never clip
      // through or poke out of it. Sliding ("Correr") panels slide sideways
      // in the wall plane when open; hinged panels swing on a vertical
      // hinge into the room.
      function addOpeningLeaves(o, w, ux, uz, angle, elev, ctx = {}) {
        const panels = Math.max(1, o.panels || 1);
        const panelWidth = o.width / panels;
        const gap = Math.min(0.03, panelWidth * 0.08);
        const isSliding = /correr/i.test(o.doorType || o.windowType || "");
        const isDoorKind = o.kind === "door";
        const oDemolir = o.demolir && phaseView !== "final" && phaseView !== "existente";
        const oConstruir = o.construir && phaseView !== "final" && phaseView !== "existente";
        const color = oDemolir ? 0xC1543F : oConstruir ? 0x6B9C5A : (isDoorKind ? 0x4A4A46 : 0xC7C5BE);
        const matOpts = (oDemolir || oConstruir)
          ? { roughness: 0.6, transparent: true, opacity: 0.5 }
          : isDoorKind
            ? { roughness: 0.5 }
            : { roughness: 0.2, transparent: true, opacity: 0.75 };

        // Shared by every panel this opening splits into — same idea as a
        // wall's own wallInfo, so tapping any one leaf of a multi-folha
        // door/window still selects (and dimensions) the WHOLE opening.
        const openingInfo = {
          kind: o.kind, tag: o.tag, wallTag: w.tag,
          widthM: o.width, heightM: o.height, thicknessM: ctx.thickness ?? wallThicknessM(w),
          doorType: o.doorType, windowType: o.windowType, panels: o.panels, condition: o.condition,
          cx: w.x1 + ux * o.pos, cz: w.y1 + uz * o.pos, ux, uz, elev,
          yBottom: o.yBottom, yTop: o.yTop,
          faceA: ctx.faceA, faceB: ctx.faceB,
          dimColor: ctx.dimColor || "#4A4A46",
        };

        for (let i = 0; i < panels; i++) {
          const segStart = o.pos - o.width / 2 + i * panelWidth;
          const segEnd = segStart + panelWidth;
          const segMid = (segStart + segEnd) / 2;
          const leafW = Math.max(0.15, panelWidth - gap);
          const leafH = Math.max(0.2, o.height - 0.04);
          let cx, cz, leafAngle = angle;

          if (openState === "open" && isSliding) {
            const slidPos = segMid + (panelWidth - gap) * 0.92;
            cx = w.x1 + ux * slidPos; cz = w.y1 + uz * slidPos;
          } else if (openState === "open") {
            const hingePos = segStart;
            leafAngle = angle + Math.PI * 0.42; // ~75° swung open
            const hx = w.x1 + ux * hingePos, hz = w.y1 + uz * hingePos;
            cx = hx + Math.cos(leafAngle) * (leafW / 2);
            cz = hz + Math.sin(leafAngle) * (leafW / 2);
          } else {
            cx = w.x1 + ux * segMid; cz = w.y1 + uz * segMid;
          }

          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(leafW, leafH, 0.05),
            new THREE.MeshStandardMaterial({ color, ...matOpts })
          );
          mesh.position.set(cx, elev + o.yBottom + o.height / 2, cz);
          mesh.rotation.y = -leafAngle;
          mesh.userData = openingInfo;
          scene.add(mesh);
          selectableMeshes.push(mesh);
        }
      }

      buildingLevels.forEach(lvl => {
        const elev = lvl.elevation;
        const levelWalls = lvl.walls.filter(phaseVisible);
        const levelDoors = lvl.doors.filter(phaseVisible);
        const levelWindows = lvl.windows.filter(phaseVisible);
        const levelWallHeight = levelWalls.length ? Math.max(...levelWalls.map(w => w.height || 2.8)) : 2.8;

        levelWalls.forEach(w => {
          const dx = w.x2 - w.x1, dz = w.y2 - w.y1;
          const len = Math.max(0.05, Math.hypot(dx, dz));
          const angle = Math.atan2(dz, dx);
          const h = w.height || 2.8;
          const ux = dx / len, uz = dz / len;
          const thickness = wallThicknessM(w);

          // Which room (by name) sits on each face — same "step off the
          // wall's midpoint a bit and see which room polygon contains
          // that point" App.jsx's own wallRoomAdjacency does in the 2D
          // Croqui, just in real meters here instead of drawing pixels
          // (this view never sees the drawing's px/GRID units at all).
          const nx = -uz, nz = ux;
          const wallMid = { x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 };
          const roomAt = (p) => {
            const room = lvl.rooms.find(r => pointInPolygon(p, r.points));
            return room ? (room.name || "Ambiente sem nome") : "Externo";
          };
          // A door/window's own area (and the volume it displaces) comes
          // back out of its wall's gross length×height×thickness — the
          // same net figure the Tabelas tab and this wall's own info panel
          // below both show, so a door isn't counted once under "Portas"
          // and AGAIN inside its wall's full, un-punched área/volume.
          const wallOpeningsRaw = [
            ...levelDoors.filter(d => d.wallId === w.id),
            ...levelWindows.filter(win => win.wallId === w.id),
          ];
          const netAreaM2 = wallNetAreaM2(len, h, wallOpeningsRaw);
          const wallInfo = {
            kind: "wall", wallId: w.id, tag: w.tag, lengthM: len, heightM: h, thicknessM: thickness,
            netAreaM2, netVolumeM3: netAreaM2 * thickness,
            wallType: w.wallType, condition: w.condition,
            faceA: roomAt({ x: wallMid.x + nx * 0.3, y: wallMid.y + nz * 0.3 }),
            faceB: roomAt({ x: wallMid.x - nx * 0.3, y: wallMid.y - nz * 0.3 }),
            // The wall's own full centerline/rotation — every segment a
            // door/window splits it into shares this one wallInfo object,
            // so a tap on any of them can still highlight (and dimension)
            // the WHOLE wall instead of just the segment actually hit.
            x1: w.x1, z1: w.y1, x2: w.x2, z2: w.y2, elev, angle,
            centerX: (w.x1 + w.x2) / 2, centerZ: (w.y1 + w.y2) / 2, centerY: elev + h / 2,
            dimColor: lvl.dimColor,
          };

          // The physical opening in the wall always exists — "open" only
          // changes how the door/window leaf itself is posed, never removes
          // the hole (that used to make windows vanish and doors clip through
          // solid wall when toggled open).
          const openings = [
            ...levelDoors.filter(d => d.wallId === w.id).map(d => mapOpening(d, "door", w, ux, uz, len)),
            ...levelWindows.filter(win => win.wallId === w.id).map(win => mapOpening(win, "window", w, ux, uz, len)),
          ].sort((a, b) => a.start - b.start);

          const segs = [];
          let cursor = 0;
          openings.forEach(iv => {
            if (iv.start > cursor + 0.02) segs.push({ start: cursor, end: iv.start, yBottom: 0, yTop: h });
            if (iv.yBottom > 0.05) segs.push({ start: iv.start, end: iv.end, yBottom: 0, yTop: iv.yBottom });
            if (iv.yTop < h - 0.05) segs.push({ start: iv.start, end: iv.end, yBottom: iv.yTop, yTop: h });
            cursor = Math.max(cursor, iv.end);
          });
          if (cursor < len - 0.02) segs.push({ start: cursor, end: len, yBottom: 0, yTop: h });
          if (segs.length === 0) segs.push({ start: 0, end: len, yBottom: 0, yTop: h });

          // Walls flagged for demolition or new construction (a reforma's
          // scope) render as a translucent red/green block instead of their
          // real finish, so the 3D view calls out the same elements the
          // Croqui already marks with a dashed outline — same convention
          // (and same colors), two views.
          const demolirMat = () => new THREE.MeshStandardMaterial({ color: 0xC1543F, roughness: 0.6, transparent: true, opacity: 0.5 });
          const construirMat = () => new THREE.MeshStandardMaterial({ color: 0x6B9C5A, roughness: 0.6, transparent: true, opacity: 0.5 });
          // "Final" (kept and new should look identical, same as the
          // Croqui's own "Final" view) and "Existente" (what's standing
          // today, drawn plainly — a wall due to come down still belongs
          // here, just not singled out) both skip this red/green flagging.
          // Everything demolir-marked is already excluded from levelWalls
          // for "Final".
          const wDemolir = w.demolir && phaseView !== "final" && phaseView !== "existente";
          const wConstruir = w.construir && phaseView !== "final" && phaseView !== "existente";
          const matNeutral = wDemolir ? demolirMat() : wConstruir ? construirMat() : new THREE.MeshStandardMaterial({ color: 0xdedad0, roughness: 0.9 });
          segs.forEach(seg => {
            const segLen = seg.end - seg.start, segH = seg.yTop - seg.yBottom;
            if (segLen <= 0.02 || segH <= 0.02) return;
            let matA, matB;
            if (wDemolir) {
              matA = demolirMat(); matB = demolirMat();
            } else if (wConstruir) {
              matA = construirMat(); matB = construirMat();
            } else {
              matA = wallFaceMaterial(w.finishA, w.paintColorA, segLen, segH);
              matB = wallFaceMaterial(w.finishB, w.paintColorB, segLen, segH);
            }
            const geo = new THREE.BoxGeometry(segLen, segH, thickness);
            const mesh = new THREE.Mesh(geo, [matNeutral, matNeutral, matNeutral, matNeutral, matA, matB]);
            const cx = w.x1 + ux * (seg.start + segLen / 2);
            const cz = w.y1 + uz * (seg.start + segLen / 2);
            mesh.position.set(cx, elev + seg.yBottom + segH / 2, cz);
            mesh.rotation.y = -angle;
            mesh.userData = wallInfo;
            scene.add(mesh);
            selectableMeshes.push(mesh);
          });

          // Door/window leaves: split into their real panel ("folha") count,
          // always rotated flush with this wall's own angle so they never
          // clip through or poke out of it.
          openings.forEach(o => addOpeningLeaves(o, w, ux, uz, angle, elev, {
            thickness, faceA: wallInfo.faceA, faceB: wallInfo.faceB,
            dimColor: o.kind === "door" ? lvl.doorDimColor : lvl.windowDimColor,
          }));

          minX = Math.min(minX, w.x1, w.x2); maxX = Math.max(maxX, w.x1, w.x2);
          minZ = Math.min(minZ, w.y1, w.y2); maxZ = Math.max(maxZ, w.y1, w.y2);
          maxY = Math.max(maxY, elev + h);
        });

        // Doors/windows whose own wall didn't pass this phase's filter (a
        // door marked "demolir" on a wall that isn't, say) still get their
        // leaf drawn on its own — mirroring the Croqui's 2D view, where
        // each element is filtered independently rather than disappearing
        // along with an unmarked wall. Only the leaf shows, no wall body:
        // that wall isn't part of this phase, same as the 2D view leaving
        // it undrawn too.
        const levelWallsById = {};
        lvl.walls.forEach(w => { levelWallsById[w.id] = w; });
        const visibleWallIds = new Set(levelWalls.map(w => w.id));
        [
          ...levelDoors.filter(d => !visibleWallIds.has(d.wallId)).map(d => ({ kind: "door", el: d })),
          ...levelWindows.filter(win => !visibleWallIds.has(win.wallId)).map(win => ({ kind: "window", el: win })),
        ].forEach(({ kind, el }) => {
          const w = levelWallsById[el.wallId];
          if (!w) return;
          const dx = w.x2 - w.x1, dz = w.y2 - w.y1;
          const len = Math.max(0.05, Math.hypot(dx, dz));
          const angle = Math.atan2(dz, dx);
          const ux = dx / len, uz = dz / len;
          addOpeningLeaves(mapOpening(el, kind, w, ux, uz, len), w, ux, uz, angle, elev, {
            thickness: wallThicknessM(w),
            dimColor: kind === "door" ? lvl.doorDimColor : lvl.windowDimColor,
          });
        });

        (lvl.rooms || []).forEach(r => {
          if (r.points.length < 3) return;
          // "Construção Nova" only ever shows the walls that are actually
          // new (levelWalls is already filtered down to those for this
          // view) — a room one of them cuts through doesn't get a floor/
          // ceiling plane here, since there's no cheap way to split it into
          // the two resulting rooms in 3D the way the Croqui's flood-fill
          // trace does for its own "Final"/"Construção Nova" views.
          if (phaseView === "novo" && levelWalls.some(w => pointInPolygon({ x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 }, r.points))) return;
          const shape = new THREE.Shape(r.points.map(p => new THREE.Vector2(p.x, -p.y)));
          // Only render a floor/ceiling plane once that finish was actually
          // chosen in Croqui — "A definir" (the default before anyone picks
          // one) isn't real survey data, so it shouldn't show up in 3D as if
          // it were.
          if (r.floorFinish && r.floorFinish !== "A definir") {
            const floorTex = getWallTexture(r.floorFinish, r.floorColor).clone(); floorTex.needsUpdate = true; floorTex.repeat.set(3, 3);
            const floorMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, side: THREE.DoubleSide }));
            floorMesh.rotation.x = -Math.PI / 2;
            floorMesh.position.y = elev + 0.01;
            scene.add(floorMesh);
          }

          if (r.ceilingFinish && r.ceilingFinish !== "A definir") {
            const ceilTex = getWallTexture(r.ceilingFinish, "#EDEBE4").clone(); ceilTex.needsUpdate = true; ceilTex.repeat.set(3, 3);
            const ceilMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.95, side: THREE.DoubleSide }));
            ceilMesh.rotation.x = -Math.PI / 2;
            ceilMesh.position.y = elev + levelWallHeight - 0.01;
            scene.add(ceilMesh);
          }
        });

        // "Piso" zones (Croqui's own Piso tool) — independent of room
        // boundaries, so they get their own floor plane instead of reusing
        // a room's, and sit a hair above it (elev + 0.015 vs +0.01) to read
        // as the actual finish where the two overlap rather than z-fighting
        // with it.
        (lvl.floorZones || []).forEach(f => {
          if (f.points.length < 3 || !f.floorType || f.floorType === "A definir") return;
          const shape = new THREE.Shape(f.points.map(p => new THREE.Vector2(p.x, -p.y)));
          const tex = getWallTexture(f.floorType, f.floorColor).clone(); tex.needsUpdate = true; tex.repeat.set(3, 3);
          const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide }));
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.y = elev + 0.015;
          mesh.userData = { kind: "floor", floorType: f.floorType, areaM2: f.area, points: f.points, elev };
          scene.add(mesh);
          selectableMeshes.push(mesh);
        });

        (lvl.stairs || []).filter(phaseVisible).forEach(st => {
          const targetElev = (elevationsById && elevationsById[st.toLevelId] != null) ? elevationsById[st.toLevelId] : elev + 3;
          const totalRise = targetElev - elev;
          const mat = new THREE.MeshStandardMaterial({ color: 0x8A8880, roughness: 0.85 });
          const stepRiser = 0.18;
          const width = Math.max(0.6, st.width);

          function addFlightSteps(ax, az, bx, bz, aY, bY) {
            const dx = bx - ax, dz = bz - az;
            const runLen = Math.max(0.05, Math.hypot(dx, dz));
            const ux = dx / runLen, uz = dz / runLen;
            const rise = bY - aY;
            const steps = Math.max(1, Math.round(Math.abs(rise) / stepRiser));
            const stepRun = runLen / steps;
            const stepRise = rise / steps;
            const angle = Math.atan2(dz, dx);
            for (let i = 0; i < steps; i++) {
              const topY = aY + stepRise * (i + 1);
              const boxHeight = Math.max(0.03, Math.abs(topY - aY));
              const cx = ax + ux * stepRun * (i + 0.5);
              const cz = az + uz * stepRun * (i + 0.5);
              const mesh = new THREE.Mesh(new THREE.BoxGeometry(stepRun + 0.015, boxHeight, width), mat);
              mesh.position.set(cx, aY + (topY - aY) / 2, cz);
              mesh.rotation.y = -angle;
              scene.add(mesh);
            }
          }

          if (st.hasLanding) {
            const pos = Math.min(0.95, Math.max(0.05, toNum(st.landingPos, 0.5)));
            const landY = elev + toNum(st.landingHeight, totalRise * pos);
            const lx = st.x1 + (st.x2 - st.x1) * pos, lz = st.y1 + (st.y2 - st.y1) * pos;
            addFlightSteps(st.x1, st.y1, lx, lz, elev, landY);
            addFlightSteps(lx, lz, st.x2, st.y2, landY, targetElev);
            const landingMesh = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, width), mat);
            landingMesh.position.set(lx, landY, lz);
            scene.add(landingMesh);
          } else {
            addFlightSteps(st.x1, st.y1, st.x2, st.y2, elev, targetElev);
          }
        });

        (lvl.luminarias || []).forEach(lm => {
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), new THREE.MeshStandardMaterial({ color: 0xF2F1ED, emissive: 0xE5E3DD, emissiveIntensity: 0.8 }));
          mesh.position.set(lm.x, elev + levelWallHeight - 0.12, lm.y);
          scene.add(mesh);
        });

        if (levelWalls.length) {
          const w = Math.max(2, (maxX - minX) + 1), d = Math.max(2, (maxZ - minZ) + 1);
          const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(w, d),
            new THREE.MeshStandardMaterial({ color: 0x2a2822, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.25 })
          );
          floor.rotation.x = -Math.PI / 2;
          floor.position.set((minX + maxX) / 2, elev, (minZ + maxZ) / 2);
          scene.add(floor);
        }
      });

      // Roofs (Coberturas tab): each is a handful of already-absolute 3D
      // planes computed by computeRoofPlanes (geometry.js) — a custom
      // BufferGeometry per plane (quads split into 2 triangles) rather
      // than a primitive, since a sloped face isn't box/plane-shaped in
      // any way three.js has a constructor for. Folded into the same
      // bounding box the walls built above, so framing a building
      // actually includes its roof instead of clipping it at eave height.
      const TILE_COLORS = {
        "Cerâmica": 0xB5623A, "Concreto": 0x9A8F82, "Fibrocimento": 0x8C8C86,
        "Metálica (telha zinco)": 0xAEB4B8, "Shingle (americana)": 0x4A4038,
      };
      roofs.forEach(roof => {
        const mat = new THREE.MeshStandardMaterial({ color: TILE_COLORS[roof.tileType] ?? 0xB5623A, roughness: 0.8, side: THREE.DoubleSide });
        (roof.planes || []).forEach((plane, aguaIndex) => {
          const tris = plane.length === 3 ? [[0, 1, 2]] : [[0, 1, 2], [0, 2, 3]];
          const positions = [];
          tris.forEach(t => t.forEach(idx => { const p = plane[idx]; positions.push(p.x, p.y, p.z); }));
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
          geo.computeVertexNormals();
          const mesh = new THREE.Mesh(geo, mat);
          // The plane's own real area (its true tilted surface, not its
          // flat XZ footprint) is what a "Água" actually needs — the same
          // 1/cos(pitch) correction recalcRoofGeometry (App.jsx) uses for
          // the Coberturas tab's own area field, kept in sync here instead
          // of trusting that tab's own (possibly stale, un-recalculated)
          // stored value.
          const pitchRad = (Math.max(0, Math.min(89, toNum(roof.pitchDeg, 30))) * Math.PI) / 180;
          const areaM2 = polygonAreaXZ(plane) / Math.cos(pitchRad);
          mesh.userData = { kind: "roof", roofId: roof.id, roofName: roof.name || "Cobertura", aguaIndex, pitchDeg: toNum(roof.pitchDeg, 30), areaM2, plane, tileType: roof.tileType };
          scene.add(mesh);
          selectableMeshes.push(mesh);
          plane.forEach(p => {
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
            maxY = Math.max(maxY, p.y);
          });
        });
        const loop = roof.eaveLoop || [];
        if (loop.length) {
          const gutterMat = new THREE.MeshStandardMaterial({ color: 0x707070, roughness: 0.4, metalness: 0.6 });
          for (let i = 0; i < loop.length; i++) {
            const a = loop[i], b = loop[(i + 1) % loop.length];
            const len = Math.hypot(b.x - a.x, b.z - a.z);
            if (len < 0.01) continue;
            const angle = Math.atan2(b.z - a.z, b.x - a.x);
            const gMesh = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.08), gutterMat);
            gMesh.position.set((a.x + b.x) / 2, roof.baseElevation - 0.04, (a.z + b.z) / 2);
            gMesh.rotation.y = -angle;
            scene.add(gMesh);
          }
        }
      });

      if (!isFinite(minX)) { minX = 0; maxX = 4; minZ = 0; maxZ = 4; }
      const target = new THREE.Vector3((minX + maxX) / 2, maxY / 2, (minZ + maxZ) / 2);
      let theta = Math.PI / 4, phi = Math.PI / 3.2;
      // Distance needed to frame the whole building's bounding sphere (half
      // the box diagonal — width, depth AND height — not just its
      // horizontal footprint like before) inside whichever of the camera's
      // two FOV axes is tighter. A narrow/tall canvas (portrait phones, now
      // that this view fills the available height instead of a fixed
      // 340px) has a much narrower horizontal FOV than the 45° vertical
      // one; framing by footprint alone left the building's own height
      // poking past the frame's bottom edge at that camera angle.
      const boxRadius = Math.hypot((maxX - minX) / 2, maxY / 2, (maxZ - minZ) / 2);
      const vFov = (45 * Math.PI) / 180;
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (width / height));
      const fitFov = Math.min(vFov, hFov);
      let camDist = Math.max(6, boxRadius / Math.sin(fitFov / 2) + 2);

      function updateCamera() {
        camera.position.set(
          target.x + camDist * Math.sin(phi) * Math.cos(theta),
          target.y + camDist * Math.cos(phi),
          target.z + camDist * Math.sin(phi) * Math.sin(theta)
        );
        camera.lookAt(target);
      }
      updateCamera();

      // A small canvas-texture label, always facing the camera (Sprite),
      // used for the on-element dimension numbers below — same idea as
      // getWallTexture's canvas approach, just for text instead of a
      // tiled material. depthTest is off so a dimension drawn right on
      // top of a wall/door never gets hidden behind its own geometry.
      function makeTextSprite(text, color) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const fontSize = 48;
        ctx.font = `700 ${fontSize}px sans-serif`;
        const textW = ctx.measureText(text).width;
        canvas.width = Math.ceil(textW) + 24;
        canvas.height = fontSize + 20;
        ctx.font = `700 ${fontSize}px sans-serif`;
        ctx.fillStyle = "rgba(20,19,17,0.82)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = color;
        ctx.textBaseline = "middle";
        ctx.fillText(text, 12, canvas.height / 2);
        const tex = new THREE.CanvasTexture(canvas);
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false }));
        const worldH = 0.32;
        sprite.scale.set((canvas.width / canvas.height) * worldH, worldH, 1);
        sprite.renderOrder = 999;
        return sprite;
      }
      function makeDimensionLine(p1, p2, color) {
        const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, depthTest: false }));
        line.renderOrder = 998;
        return line;
      }
      // Length/height/thickness right on the wall itself — offset just off
      // its front face (along its own normal) so the line doesn't z-fight
      // with the wall mesh, colored with the same dimColor the 2D plan and
      // Elevação already use for this level.
      function buildWallDimensionGroup(info) {
        const dx = info.x2 - info.x1, dz = info.z2 - info.z1;
        const len = Math.max(0.05, Math.hypot(dx, dz));
        const ux = dx / len, uz = dz / len;
        const nx = -uz, nz = ux;
        const offset = info.thicknessM / 2 + 0.12;
        const baseY = info.elev + 0.04;
        const group = new THREE.Group();
        const p1 = new THREE.Vector3(info.x1 + nx * offset, baseY, info.z1 + nz * offset);
        const p2 = new THREE.Vector3(info.x2 + nx * offset, baseY, info.z2 + nz * offset);
        group.add(makeDimensionLine(p1, p2, info.dimColor));
        const lenLabel = makeTextSprite(`${info.lengthM.toFixed(2)} m`, info.dimColor);
        lenLabel.position.copy(p1).lerp(p2, 0.5).add(new THREE.Vector3(0, 0.2, 0));
        group.add(lenLabel);

        const hp1 = new THREE.Vector3(info.x1 + nx * offset, info.elev, info.z1 + nz * offset);
        const hp2 = new THREE.Vector3(info.x1 + nx * offset, info.elev + info.heightM, info.z1 + nz * offset);
        group.add(makeDimensionLine(hp1, hp2, info.dimColor));
        const heightLabel = makeTextSprite(`${info.heightM.toFixed(2)} m`, info.dimColor);
        heightLabel.position.copy(hp1).lerp(hp2, 0.5).add(new THREE.Vector3(nx * 0.25, 0, nz * 0.25));
        group.add(heightLabel);

        const tp1 = new THREE.Vector3(info.x1 - nx * (info.thicknessM / 2), info.elev + 0.04, info.z1 - nz * (info.thicknessM / 2));
        const tp2 = new THREE.Vector3(info.x1 + nx * (info.thicknessM / 2), info.elev + 0.04, info.z1 + nz * (info.thicknessM / 2));
        group.add(makeDimensionLine(tp1, tp2, info.dimColor));
        const thickLabel = makeTextSprite(`${(info.thicknessM * 100).toFixed(0)} cm`, info.dimColor);
        thickLabel.position.copy(tp1).lerp(tp2, 0.5).add(new THREE.Vector3(-ux * 0.35, 0.14, -uz * 0.35));
        group.add(thickLabel);
        return group;
      }
      // Width/height right on the door/window leaf itself, in the same
      // doorDimColor/windowDimColor the plan and Elevação already use.
      function buildOpeningDimensionGroup(info) {
        const { ux, uz } = info;
        const halfW = info.widthM / 2;
        const group = new THREE.Group();
        const p1 = new THREE.Vector3(info.cx - ux * halfW, info.elev + info.yBottom - 0.12, info.cz - uz * halfW);
        const p2 = new THREE.Vector3(info.cx + ux * halfW, info.elev + info.yBottom - 0.12, info.cz + uz * halfW);
        group.add(makeDimensionLine(p1, p2, info.dimColor));
        const widthLabel = makeTextSprite(`${info.widthM.toFixed(2)} m`, info.dimColor);
        widthLabel.position.copy(p1).lerp(p2, 0.5).add(new THREE.Vector3(0, -0.05, 0));
        group.add(widthLabel);

        const nx = -uz, nz = ux;
        const hp1 = new THREE.Vector3(info.cx + nx * (info.thicknessM / 2 + 0.1), info.elev + info.yBottom, info.cz + nz * (info.thicknessM / 2 + 0.1));
        const hp2 = new THREE.Vector3(info.cx + nx * (info.thicknessM / 2 + 0.1), info.elev + info.yTop, info.cz + nz * (info.thicknessM / 2 + 0.1));
        group.add(makeDimensionLine(hp1, hp2, info.dimColor));
        const heightLabel = makeTextSprite(`${info.heightM.toFixed(2)} m`, info.dimColor);
        heightLabel.position.copy(hp1).lerp(hp2, 0.5).add(new THREE.Vector3(nx * 0.2, 0, nz * 0.2));
        group.add(heightLabel);
        return group;
      }
      // Every edge of the selected água's own plane, each labeled with its
      // real 3D length — same "cotas right on the element" idea as a wall
      // or opening gets, except these edges run up the slope instead of
      // level, so the dimension line (and its length) follow the incline
      // instead of a flattened plan projection of it.
      const ROOF_DIM_COLOR = "#4A4A46";
      function buildRoofDimensionGroup(info) {
        const pts = info.plane.map(p => new THREE.Vector3(p.x, p.y, p.z));
        const n = new THREE.Vector3().crossVectors(
          new THREE.Vector3().subVectors(pts[1], pts[0]),
          new THREE.Vector3().subVectors(pts[2], pts[0])
        ).normalize();
        // Always push the dimension lines up and away from the roof deck,
        // never down into the attic space below it.
        if (n.y < 0) n.multiplyScalar(-1);
        const offset = n.clone().multiplyScalar(0.08);
        const group = new THREE.Group();
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i].clone().add(offset), b = pts[(i + 1) % pts.length].clone().add(offset);
          const edgeLen = a.distanceTo(b);
          if (edgeLen < 0.05) continue;
          group.add(makeDimensionLine(a, b, ROOF_DIM_COLOR));
          const label = makeTextSprite(`${edgeLen.toFixed(2)} m`, ROOF_DIM_COLOR);
          label.position.copy(a).lerp(b, 0.5).add(offset);
          group.add(label);
        }
        return group;
      }

      // Tap-to-select: raycasts against selectableMeshes (wall segments,
      // door/window leaves, and piso zones) and reports the whole element
      // (area/volume/room/material) via setSelectedWallInfo, read by the
      // HTML legend in the component's own return below.
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      let highlightFill = null, dimensionGroup = null;
      function clearHighlight() {
        if (highlightFill) {
          scene.remove(highlightFill);
          highlightFill.geometry.dispose();
          highlightFill.material.dispose();
          highlightFill = null;
        }
        if (dimensionGroup) {
          dimensionGroup.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) { if (obj.material.map) obj.material.map.dispose(); obj.material.dispose(); }
          });
          scene.remove(dimensionGroup);
          dimensionGroup = null;
        }
      }
      // A soft, translucent aqua wash over the WHOLE selected element reads
      // as "this is selected" on its own — no separate wireframe outline
      // (tried both: wireframe-only read as thin edge lines with the
      // element itself looking untouched; wireframe + fill together was
      // redundant once the fill alone already changes the element's own
      // color). depthWrite is off so this never z-fights with the real
      // mesh sitting at almost the same surface.
      const SELECT_COLOR = 0x4DD9C7;
      const fillMat = () => new THREE.MeshBasicMaterial({ color: SELECT_COLOR, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
      // Distinct id for whatever a mesh actually represents (a wall, a
      // door/window, or a floor zone) — used to collapse a ray's several
      // hits down to one per real element, so tap-cycling below (see
      // lastTapScreen) never re-lands on two segments of the same wall in
      // a row.
      function elementKey(mesh) {
        const info = mesh.userData;
        if (info.kind === "wall") return "wall:" + info.wallId;
        if (info.kind === "door" || info.kind === "window") return info.kind + ":" + info.wallTag + ":" + info.tag;
        if (info.kind === "roof") return "roof:" + info.roofId + ":" + info.aguaIndex;
        return "obj:" + mesh.uuid;
      }
      // A tap only ever raycasts to whatever's NEAREST the camera — with a
      // building modeled as solid boxes, that's always the outer wall
      // facing the viewer, so there was no way to reach a wall behind it
      // or anything inside the building at all. Tapping again at (roughly)
      // the same screen spot instead steps to the next hit further along
      // that same ray, same "click again to go deeper" pattern other
      // BIM/CAD viewers use for occluded geometry.
      let lastTapScreen = null, lastHitIndex = -1;
      function trySelect(clientX, clientY) {
        const rect = el.getBoundingClientRect();
        ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(ndc, camera);
        const rawHits = raycaster.intersectObjects(selectableMeshes);
        const seen = new Set();
        const hits = rawHits.filter(h => {
          const key = elementKey(h.object);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        clearHighlight();
        if (!hits.length) { setSelectedWallInfo(null); lastTapScreen = null; lastHitIndex = -1; return; }
        const sameSpot = lastTapScreen && Math.hypot(clientX - lastTapScreen.x, clientY - lastTapScreen.y) < 20;
        const hitIndex = sameSpot ? (lastHitIndex + 1) % hits.length : 0;
        lastTapScreen = { x: clientX, y: clientY };
        lastHitIndex = hitIndex;
        const mesh = hits[hitIndex].object;
        const info = mesh.userData;
        setSelectedWallInfo({ ...info, _hitIndex: hitIndex, _hitTotal: hits.length });
        dimensionGroup = new THREE.Group();
        if (info.kind === "wall") {
          // Spans the WHOLE wall's own centerline (not just the one
          // segment actually hit — a door/window splits a wall into
          // several segment meshes that all share this same userData, so
          // the highlight has to be rebuilt from the wall's own geometry
          // rather than reused from whichever segment the ray landed on).
          highlightFill = new THREE.Mesh(
            new THREE.BoxGeometry(info.lengthM + 0.02, info.heightM + 0.02, info.thicknessM + 0.02),
            fillMat()
          );
          highlightFill.position.set(info.centerX, info.centerY, info.centerZ);
          highlightFill.rotation.y = -info.angle;
          scene.add(highlightFill);
          dimensionGroup.add(buildWallDimensionGroup(info));
        } else if (info.kind === "door" || info.kind === "window") {
          const midY = info.elev + (info.yBottom + info.yTop) / 2;
          highlightFill = new THREE.Mesh(
            new THREE.BoxGeometry(info.widthM + 0.02, (info.yTop - info.yBottom) + 0.02, info.thicknessM + 0.04),
            fillMat()
          );
          highlightFill.position.set(info.cx, midY, info.cz);
          highlightFill.rotation.y = -Math.atan2(info.uz, info.ux);
          scene.add(highlightFill);
          dimensionGroup.add(buildOpeningDimensionGroup(info));
        } else if (info.kind === "floor") {
          // No box makes sense for an arbitrary polygon — fill its own
          // shape instead, just above the floor plane it belongs to.
          const shape = new THREE.Shape(info.points.map(p => new THREE.Vector2(p.x, -p.y)));
          highlightFill = new THREE.Mesh(new THREE.ShapeGeometry(shape), fillMat());
          highlightFill.rotation.x = -Math.PI / 2;
          highlightFill.position.y = info.elev + 0.025;
          scene.add(highlightFill);
        } else if (info.kind === "roof") {
          // Same quad-of-triangles construction the roof's own tile mesh
          // uses (buildRoofDimensionGroup's own normal-offset trick keeps
          // this from z-fighting with it), just re-triangulated here with
          // the translucent select material instead of the tile texture.
          const plane = info.plane;
          const tris = plane.length === 3 ? [[0, 1, 2]] : [[0, 1, 2], [0, 2, 3]];
          const positions = [];
          tris.forEach(t => t.forEach(idx => { const p = plane[idx]; positions.push(p.x, p.y + 0.01, p.z); }));
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
          geo.computeVertexNormals();
          highlightFill = new THREE.Mesh(geo, fillMat());
          scene.add(highlightFill);
          dimensionGroup.add(buildRoofDimensionGroup(info));
        }
        scene.add(dimensionGroup);
      }

      // Moves the look-at point opposite a screen-space drag, along the
      // camera's own current right/up (not world X/Z) so pan always tracks
      // the finger regardless of which way the model is currently orbited
      // — and scaled by camDist so a fixed screen-pixel drag covers the
      // same apparent ground whether zoomed in tight or pulled back far.
      function panBy(dxScreen, dyScreen) {
        const dir = new THREE.Vector3().subVectors(camera.position, target).normalize();
        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
        const up = new THREE.Vector3().crossVectors(dir, right).normalize();
        const panScale = camDist * 0.0016;
        target.addScaledVector(right, -dxScreen * panScale);
        target.addScaledVector(up, dyScreen * panScale);
      }

      let dragging = false, lastX = 0, lastY = 0, pinchDist = null, panMid = null, vPanY = null, tapStart = null;
      const TAP_MOVE_TOL = 8;
      const touchDist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const touchMid = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
      function onDown(e) {
        if (e.touches && e.touches.length === 3) {
          // Three fingers: vertical-only pan (walk up/down through floors)
          // — kept separate from the two-finger pinch/pan below so a third
          // finger landing mid-gesture never gets read as a sideways pan.
          dragging = false; pinchDist = null; panMid = null; tapStart = null;
          const ys = Array.from(e.touches).map(t => t.clientY);
          vPanY = ys.reduce((a, b) => a + b, 0) / ys.length;
          return;
        }
        if (e.touches && e.touches.length === 2) {
          dragging = false; vPanY = null; tapStart = null;
          pinchDist = touchDist(e.touches[0], e.touches[1]);
          panMid = touchMid(e.touches[0], e.touches[1]);
          return;
        }
        dragging = true; vPanY = null; panMid = null;
        const p = e.touches ? e.touches[0] : e;
        lastX = p.clientX; lastY = p.clientY;
        tapStart = { x: p.clientX, y: p.clientY, moved: false };
      }
      function onMove(e) {
        if (e.touches && e.touches.length === 3 && vPanY != null) {
          if (e.cancelable) e.preventDefault();
          const ys = Array.from(e.touches).map(t => t.clientY);
          const midY = ys.reduce((a, b) => a + b, 0) / ys.length;
          panBy(0, midY - vPanY);
          vPanY = midY;
          updateCamera();
          return;
        }
        if (e.touches && e.touches.length === 2) {
          if (e.cancelable) e.preventDefault();
          const [a, b] = e.touches;
          const d = touchDist(a, b), mid = touchMid(a, b);
          if (pinchDist != null) camDist = Math.min(80, Math.max(3, camDist - (d - pinchDist) * 0.02));
          if (panMid != null) panBy(mid.x - panMid.x, mid.y - panMid.y);
          pinchDist = d; panMid = mid;
          updateCamera();
          return;
        }
        if (!dragging) return;
        if (e.touches && e.cancelable) e.preventDefault();
        const p = e.touches ? e.touches[0] : e;
        const dx = p.clientX - lastX, dy = p.clientY - lastY;
        lastX = p.clientX; lastY = p.clientY;
        if (tapStart && Math.hypot(p.clientX - tapStart.x, p.clientY - tapStart.y) > TAP_MOVE_TOL) tapStart.moved = true;
        theta -= dx * 0.008;
        phi = Math.min(Math.PI - 0.15, Math.max(0.2, phi - dy * 0.008));
        updateCamera();
      }
      function onUp(e) {
        dragging = false;
        if (!e.touches || e.touches.length < 2) { pinchDist = null; panMid = null; }
        if (!e.touches || e.touches.length < 3) vPanY = null;
        if (tapStart && !tapStart.moved) trySelect(tapStart.x, tapStart.y);
        tapStart = null;
      }
      function onWheel(e) { e.preventDefault(); camDist = Math.min(80, Math.max(3, camDist + e.deltaY * 0.01)); updateCamera(); }

      const el = renderer.domElement;
      el.addEventListener("mousedown", onDown);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      // Not passive: a pinch (two touches) has to call preventDefault from
      // inside the handler itself to stop the browser reading the same
      // gesture as its own page-zoom (see the touch-action note above —
      // this is the other half of it, for the pinch specifically).
      el.addEventListener("touchstart", onDown, { passive: false });
      el.addEventListener("touchmove", onMove, { passive: false });
      el.addEventListener("touchend", onUp);
      el.addEventListener("wheel", onWheel, { passive: false });
      cleanupFns.push(() => {
        el.removeEventListener("mousedown", onDown);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        el.removeEventListener("touchstart", onDown);
        el.removeEventListener("touchmove", onMove);
        el.removeEventListener("touchend", onUp);
        el.removeEventListener("wheel", onWheel);
      });

      function animate() {
        if (disposed) return;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      }
      animate();
      setOk(true);
    } catch (e) {
      setOk(false);
    }

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      cleanupFns.forEach(fn => fn());
      if (renderer) {
        renderer.dispose();
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      }
      // The mesh a stale selection points at won't exist once the scene
      // rebuilds (new level, phase view, section cut…) — drop it rather
      // than leave the legend showing a wall that's no longer there.
      setSelectedWallInfo(null);
    };
  }, [buildingLevels, roofs, openState, sectionCut, phaseView, dims]);

  // The mount div stays in the tree always, even in an ok/empty/emptyPhase
  // state — the status text overlays it instead of replacing it. The
  // effect above needs mountRef.current to exist to run its own detection
  // logic (it bails immediately if not); returning a different element
  // tree here used to unmount that div whenever emptyPhase went true,
  // which left mountRef.current null and permanently stuck that same
  // effect from ever re-checking a later, actually-non-empty view —
  // exactly the "works the first time, blank every time after" bug.
  const statusMsg = !ok ? "A visualização 3D não pôde ser iniciada neste navegador."
    : empty ? "Ainda não há paredes desenhadas para mostrar em 3D. Desenhe no Croqui primeiro."
      : emptyPhase ? "Nada marcado para essa vista ainda." : null;
  return (
    <div>
      <div className="relative">
        <div ref={mountRef} data-threed-mount={exportMarker ? "true" : undefined}
          // Without this, a two-finger pinch meant for our own zoom handler
          // (below) is free to also be read by the browser itself as a page
          // zoom gesture — iOS Safari does this even with the page's own
          // user-scalable=no, since it now ignores that for accessibility.
          // The whole app then renders visibly smaller/zoomed out (not just
          // this canvas) until the person manually zooms back out, which
          // reads as the UI randomly shrinking and leaving dead space around
          // the bottom nav. touch-action: none opts this element out of the
          // browser's own gesture handling entirely, leaving it all to the
          // touch handlers below.
          style={{ width: "100%", height: dims.h, borderRadius: 8, overflow: "hidden", background: "#8A8880", touchAction: "none" }} />
        {statusMsg && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-center p-6" style={{ color: C.mute }}>{statusMsg}</div>
        )}
        {!statusMsg && selectedWallInfo && (() => {
          const info = selectedWallInfo;
          // Comprimento/altura/espessura (ou largura/altura) já aparecem
          // desenhados em cima do próprio elemento (ver buildWallDimension-
          // Group/buildOpeningDimensionGroup) — repeti-los aqui em texto só
          // engordava o painel. Cada tipo vira UMA linha de resumo (sem
          // rótulo por campo) em vez de uma pilha de "Campo: valor".
          // A door/window's own volume, split by the materials its family
          // is actually made of (glass + frame, wood + glass, etc.) instead
          // of one combined number — DOOR_MATERIAL_MIX/WINDOW_MATERIAL_MIX
          // are architectural estimates, not a real cut list.
          const openingVolumeByMaterial = (kind) => {
            const familyName = kind === "door" ? info.doorType : info.windowType;
            const mix = (kind === "door" ? DOOR_MATERIAL_MIX[familyName] : WINDOW_MATERIAL_MIX[familyName]) || [{ material: kind === "door" ? "Madeira" : "Alumínio", fraction: 1 }];
            const totalM3 = info.widthM * info.heightM * info.thicknessM;
            return mix.map(m => `${m.material} ${(totalM3 * m.fraction).toFixed(3)}`).join(" + ") + " m³";
          };
          const summary = info.kind === "wall"
            ? `${info.wallType} · ${info.netAreaM2.toFixed(1)} m² · ${info.netVolumeM3.toFixed(2)} m³`
            : info.kind === "door" || info.kind === "window"
              ? `${info.wallTag} · ${info.kind === "door" ? info.doorType : info.windowType} · ${openingVolumeByMaterial(info.kind)}`
              : info.kind === "roof"
                ? `${info.pitchDeg}° · ${info.areaM2.toFixed(1)} m²`
                : `${info.areaM2} m²`;
          const ambiente = (info.faceA || info.faceB)
            ? (info.faceA === info.faceB ? info.faceA : `${info.faceA} / ${info.faceB}`)
            : null;
          return (
            <div className="absolute top-2 right-2 left-2 sm:left-auto sm:w-72 rounded-lg px-2.5 py-1.5 text-[11px]"
              style={{ background: "rgba(20,19,17,0.92)", border: `1px solid ${C.line}`, color: C.chalk, backdropFilter: "blur(4px)" }}>
              <div className="flex items-center gap-2">
                <span className="font-semibold shrink-0" style={{ color: C.gold }}>
                  {info.kind === "wall" ? `Parede ${info.tag}`
                    : info.kind === "door" ? `Porta ${info.tag}`
                      : info.kind === "window" ? `Janela ${info.tag}`
                        : info.kind === "roof" ? `${info.roofName} · Água ${info.aguaIndex + 1}`
                          : `Piso · ${info.floorType}`}
                </span>
                <span className="flex-1 text-right truncate" style={{ color: C.mute }}>{summary}</span>
                <button onClick={() => setSelectedWallInfo(null)} className="shrink-0" style={{ color: C.mute, fontSize: 16, lineHeight: 1 }}>×</button>
              </div>
              {(ambiente || info._hitTotal > 1) && (
                <div className="flex items-center gap-2 text-[10px] mt-0.5" style={{ color: C.mute }}>
                  {ambiente && <span className="truncate">{ambiente}</span>}
                  {info._hitTotal > 1 && <span className="ml-auto shrink-0" style={{ color: C.gold }}>{info._hitIndex + 1}/{info._hitTotal} aqui · toque de novo</span>}
                </div>
              )}
            </div>
          );
        })()}
      </div>
      {!statusMsg && <p ref={hintRef} className="text-[11px] mt-1.5 text-center" style={{ color: C.mute }}>Arraste: girar · pinça: zoom · 2 dedos: mover · 3 dedos: subir/descer · toque num elemento: ver detalhes</p>}
    </div>
  );
}
