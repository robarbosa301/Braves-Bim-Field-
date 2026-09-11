import React, { useState, useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import {
  MapPin, LayoutGrid, Grid3x3, Camera, RefreshCw, Wifi, WifiOff, Plus, X, Trash2, RotateCcw,
  CheckCircle2, DoorClosed, RectangleHorizontal, Building2,
  ChevronRight, ChevronDown, Pencil, FileJson, FileText, Layers3,
  Smartphone, Tablet, LocateFixed, ImagePlus, Users, Copy, LogIn,
  Undo2, Eraser, Square, Triangle, LayoutPanelTop, GitBranch, SlidersHorizontal, Box, Home, ZoomIn, ZoomOut, Maximize2,
  MousePointer2, Lightbulb, Link2, ArrowUpRight, Move, DoorOpen, Scissors
} from "lucide-react";
import { safeGet, safeSet, safeList, safeDelete } from "./storage.js";

// ---- BRAVES brand tokens (dark metallic theme) -----------------------------
const SYMBOL_LOGO = "data:image/svg+xml," + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 460">
  <polygon points="45,160 138,108 138,136 45,188" fill="#FFFFFF"/>
  <path d="M60 158 L152 98 L245 158" fill="none" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="190" y1="50" x2="190" y2="248" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/>
  <line x1="209" y1="116" x2="240" y2="252" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/>
  <line x1="227" y1="126" x2="256" y2="255" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/>
  <rect x="60" y="156" width="48" height="248" fill="#FFFFFF"/>
  <path d="M108 262 C195 262 240 296 240 335 C240 382 188 410 132 410 C108 410 92 404 84 396"
    fill="none" stroke="#FFFFFF" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`.trim());

const C = {
  chalk: "#F3F1EA",
  mute: "#A39D90",
  muteDim: "#7A756B",
  panel: "rgba(255,255,255,0.045)",
  panelAlt: "rgba(255,255,255,0.065)",
  line: "rgba(255,255,255,0.11)",
  gold: "#FFFFFF",
  goldTint: "rgba(255,255,255,0.14)",
  bad: "#C1543F",
};

const heading = { fontFamily: "'Poppins',-apple-system,'SF Pro Display','Segoe UI',Roboto,sans-serif", letterSpacing: "0.01em" };
const mono = { fontFamily: "'JetBrains Mono','IBM Plex Mono',monospace" };

function useLoadFonts() {
  useEffect(() => {
    if (document.getElementById("braves-font-link")) return;
    try {
      const link = document.createElement("link");
      link.id = "braves-font-link";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    } catch (e) { /* segue com as fontes do sistema */ }
  }, []);
  useEffect(() => {
    if (document.getElementById("braves-font-inherit-style")) return;
    try {
      const style = document.createElement("style");
      style.id = "braves-font-inherit-style";
      style.textContent = ".braves-app-root button, .braves-app-root input, .braves-app-root select, .braves-app-root textarea { font-family: inherit; }";
      document.head.appendChild(style);
    } catch (e) { /* segue com as fontes do sistema */ }
  }, []);
}

const METAL_BG = {
  backgroundColor: "#0B0B0A",
  backgroundImage:
    "linear-gradient(135deg, #0a0a09 0%, #1d1c18 22%, #0d0d0c 45%, #211f1a 68%, #0a0a09 100%)," +
    "repeating-linear-gradient(115deg, rgba(255,255,255,0.02) 0px, rgba(255,255,255,0.02) 1px, transparent 1px, transparent 7px)",
};

const WATERMARK_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="380" height="380" viewBox="0 0 380 380">
  <g fill="none" stroke="rgba(255,255,255,0.055)" stroke-width="1.3">
    <line x1="0" y1="40" x2="380" y2="40" stroke-dasharray="1,7"/>
    <line x1="0" y1="200" x2="380" y2="200" stroke-dasharray="1,7"/>
    <line x1="40" y1="0" x2="40" y2="380" stroke-dasharray="1,7"/>
    <line x1="230" y1="0" x2="230" y2="380" stroke-dasharray="1,7"/>
  </g>
  <!-- guindaste -->
  <g fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <line x1="55" y1="300" x2="55" y2="95"/>
    <line x1="55" y1="95" x2="150" y2="112"/>
    <line x1="55" y1="95" x2="18" y2="86"/>
    <line x1="132" y1="110" x2="132" y2="132"/>
    <circle cx="132" cy="138" r="4"/>
    <line x1="38" y1="300" x2="72" y2="300"/>
  </g>
  <!-- capacete de segurança -->
  <g fill="none" stroke="rgba(255,255,255,0.075)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 288 62 A 24 21 0 0 1 336 62"/>
    <line x1="282" y1="62" x2="342" y2="62"/>
    <line x1="312" y1="42" x2="312" y2="62"/>
    <path d="M 297 62 Q 312 68 327 62"/>
  </g>
  <!-- casa (planta baixa simplificada) -->
  <g fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 175 95 L 175 60 L 205 38 L 235 60 L 235 95 Z"/>
    <line x1="205" y1="95" x2="205" y2="75"/>
    <rect x="182" y="70" width="12" height="12"/>
    <rect x="252" y="30" width="7" height="16"/>
  </g>
  <!-- nível de bolha -->
  <g fill="none" stroke="rgba(255,255,255,0.055)" stroke-width="1.2">
    <rect x="120" y="230" width="66" height="15" rx="7"/>
    <circle cx="153" cy="237.5" r="4"/>
    <line x1="128" y1="230" x2="128" y2="245"/>
    <line x1="178" y1="230" x2="178" y2="245"/>
  </g>
  <!-- colher de pedreiro -->
  <g fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 296 300 L 320 282 L 330 293 L 306 311 Z"/>
    <line x1="320" y1="282" x2="336" y2="266"/>
    <line x1="332" y1="262" x2="340" y2="270"/>
  </g>
  <!-- alvenaria (fiadas de tijolo) -->
  <g fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1.2">
    <rect x="30" y="330" width="34" height="15"/>
    <rect x="64" y="330" width="34" height="15"/>
    <rect x="13" y="345" width="34" height="15"/>
    <rect x="47" y="345" width="34" height="15"/>
    <rect x="81" y="345" width="17" height="15"/>
  </g>
</svg>
`.trim();
const WATERMARK_URL = "url(\"data:image/svg+xml," + encodeURIComponent(WATERMARK_SVG) + "\")";

function Watermark() {
  return <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: WATERMARK_URL, backgroundRepeat: "repeat", backgroundSize: "380px 380px", opacity: 0.9 }} />;
}

const uid = () => Math.random().toString(36).slice(2, 9);
const toNum = (v, fallback = 0) => {
  if (v === null || v === undefined || v === "") return fallback;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? fallback : n;
};
const genCode = () => Math.random().toString(36).slice(2, 6).toUpperCase();

const WALL_TYPES = ["Alvenaria 15cm", "Alvenaria 20cm", "Concreto", "Drywall", "Vidro"];
const FINISH_TYPES = ["A definir", "Pintura", "Reboco sem pintura", "Sem reboco (aparente)", "Revestimento cerâmico", "Textura acrílica"];
const DOOR_TYPES = ["Madeira maciça", "Madeira semi-oca", "Alumínio", "Vidro temperado", "Correr — alumínio", "Correr — vidro", "Pivotante", "Sanfonada", "Camarão", "Blindada"];
const WINDOW_TYPES = ["Alumínio de correr", "Vidro de correr", "Basculante", "Maxim-ar", "Vidro fixo", "Guilhotina", "Veneziana", "Pivotante"];
const FLOOR_TYPES = ["Porcelanato", "Cerâmica", "Contrapiso aparente", "Madeira/Laminado", "Vinílico", "A definir"];
const CEILING_TYPES = ["Laje aparente", "Forro de gesso", "Forro em PVC", "Forro mineral (lay-in)", "A definir"];

function conditionColor(cond) {
  if (cond === "Bom") return C.gold;
  if (cond === "Ruim") return C.bad;
  return C.mute;
}

function defaultLevels() {
  return [
    { id: uid(), name: "Térreo", elevation: "0.00", wallHeightDefault: "2.80", sketchScale: 0.5, sketchElements: [] },
    { id: uid(), name: "1º Pavimento", elevation: "3.10", wallHeightDefault: "2.80", sketchScale: 0.5, sketchElements: [] },
    { id: uid(), name: "Cobertura", elevation: "6.20", wallHeightDefault: "2.80", sketchScale: 0.5, sketchElements: [] },
  ];
}

function buildLevelsFromCount(count) {
  const n = Math.max(1, Math.min(20, parseInt(count) || 1));
  const lv = [];
  for (let i = 0; i < n; i++) {
    lv.push({ id: uid(), name: i === 0 ? "Térreo" : `${i}º Pavimento`, elevation: (i * 3).toFixed(2), wallHeightDefault: "2.80", sketchScale: 0.5, sketchElements: [] });
  }
  return lv;
}

// ---- local device cache (IndexedDB) ----------------------------------------
function openLocalDB() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) { reject(new Error("no-indexeddb")); return; }
    const req = indexedDB.open("braves_prancheta", 1);
    req.onupgradeneeded = () => { req.result.createObjectStore("kv", { keyPath: "key" }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key) {
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
async function idbSet(key, value) {
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

function composeAddress(b) {
  if (!b) return "";
  const line1 = [b.street, b.number].filter(Boolean).join(", ");
  const line2 = [b.neighborhood, b.city, b.state].filter(Boolean).join(", ");
  return [line1, line2].filter(Boolean).join(" — ");
}
async function upsertProjectIndex(code, meta) {
  const list = (await idbGet("projects-index")) || [];
  const next = [{ code, ...meta, updatedAt: Date.now() }, ...list.filter(p => p.code !== code)];
  await idbSet("projects-index", next.slice(0, 100));
}
async function removeFromProjectIndex(code) {
  const list = (await idbGet("projects-index")) || [];
  await idbSet("projects-index", list.filter(p => p.code !== code));
}

// ---- geometry helpers -------------------------------------------------------
const GRID = 20;
function snap(v) { return Math.round(v / GRID) * GRID; }
function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
function projectPointOnSegment(p, a, b) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ap = { x: p.x - a.x, y: p.y - a.y };
  const lenSq = ab.x * ab.x + ab.y * ab.y || 1;
  let t = (ap.x * ab.x + ap.y * ab.y) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + ab.x * t, y: a.y + ab.y * t, t };
}
function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
function polygonCentroid(points) {
  let x = 0, y = 0;
  points.forEach(p => { x += p.x; y += p.y; });
  return { x: x / points.length, y: y / points.length };
}
function wrapTextLines(text, maxChars) {
  if (!text) return [""];
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  words.forEach(w => {
    if ((cur + " " + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; }
    else cur = (cur + " " + w).trim();
  });
  if (cur) lines.push(cur);
  return lines;
}
function wallRoomAdjacency(level, wall) {
  const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const nx = -uy, ny = ux;
  const mid = { x: (wall.x1 + wall.x2) / 2, y: (wall.y1 + wall.y2) / 2 };
  const polys = (level.sketchElements || []).filter(e => e.type === "room");
  const roomAt = (p) => { const poly = polys.find(r => pointInPolygon(p, r.points)); return poly ? (poly.name || "Ambiente sem nome") : "Externo / não identificado"; };
  return {
    faceA: roomAt({ x: mid.x + nx * 12, y: mid.y + ny * 12 }),
    faceB: roomAt({ x: mid.x - nx * 12, y: mid.y - ny * 12 }),
  };
}
function findMergeableWall(wall, elements) {
  const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const others = elements.filter(e => e.type === "wall" && e.id !== wall.id);
  for (const o of others) {
    const sharedAtStart = dist({ x: o.x1, y: o.y1 }, { x: wall.x1, y: wall.y1 }) < 3 || dist({ x: o.x2, y: o.y2 }, { x: wall.x1, y: wall.y1 }) < 3;
    const sharedAtEnd = dist({ x: o.x1, y: o.y1 }, { x: wall.x2, y: wall.y2 }) < 3 || dist({ x: o.x2, y: o.y2 }, { x: wall.x2, y: wall.y2 }) < 3;
    if (!sharedAtStart && !sharedAtEnd) continue;
    const odx = o.x2 - o.x1, ody = o.y2 - o.y1, olen = Math.hypot(odx, ody) || 1;
    const oux = odx / olen, ouy = ody / olen;
    if (Math.abs(ux * ouy - uy * oux) < 0.06) return o;
  }
  return null;
}
function mergeWallPair(a, b) {
  const pts = [{ x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }, { x: b.x1, y: b.y1 }, { x: b.x2, y: b.y2 }];
  let best = [pts[0], pts[1]], bestD = -1;
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) { const d = dist(pts[i], pts[j]); if (d > bestD) { bestD = d; best = [pts[i], pts[j]]; } }
  return { x1: best[0].x, y1: best[0].y, x2: best[1].x, y2: best[1].y };
}
function wallToM(w, toM) {
  return {
    id: w.id, x1: toM(w.x1), y1: toM(w.y1), x2: toM(w.x2), y2: toM(w.y2), height: toNum(w.height, 2.8),
    finishA: w.finishA || w.finish || "A definir", paintColorA: w.paintColorA || w.paintColor || "#E8E4DA",
    finishB: w.finishB || w.finish || "A definir", paintColorB: w.paintColorB || w.paintColor || "#E8E4DA",
  };
}
function doorToM(d, toM) {
  return {
    id: d.id, wallId: d.wallId, x: toM(d.x), y: toM(d.y), width: toNum(d.width, 0.8), height: toNum(d.height, 2.1),
    panels: Math.max(1, Math.round(toNum(d.panels, 1))), doorType: d.doorType || DOOR_TYPES[0],
  };
}
function windowToM(w, toM) {
  return {
    id: w.id, wallId: w.wallId, x: toM(w.x), y: toM(w.y), width: toNum(w.width, 1.2), height: toNum(w.height, 1.2), peitoril: toNum(w.peitoril, 1.0),
    panels: Math.max(1, Math.round(toNum(w.panels, 2))), windowType: w.windowType || WINDOW_TYPES[0],
  };
}
function stairToM(s2, toM) { return { x1: toM(s2.x1), y1: toM(s2.y1), x2: toM(s2.x2), y2: toM(s2.y2), width: toNum(s2.width, 1.0), toLevelId: s2.toLevelId || "", hasLanding: !!s2.hasLanding, landingPos: toNum(s2.landingPos, 0.5), landingHeight: s2.landingHeight }; }
function luminariaToM(l, toM) { return { x: toM(l.x), y: toM(l.y) }; }
function roomToM(r, toM) { return { points: r.points.map(p => ({ x: toM(p.x), y: toM(p.y) })), ceilingFinish: r.ceilingFinish, floorFinish: r.floorFinish, floorColor: r.floorColor, name: r.name }; }

function levelToMeters(level) {
  const s = toNum(level.sketchScale, 0.5);
  const toM = (px) => (px / GRID) * s;
  const els = level.sketchElements || [];
  return {
    elevation: toNum(level.elevation, 0),
    walls: els.filter(e => e.type === "wall").map(w => wallToM(w, toM)),
    doors: els.filter(e => e.type === "door").map(d => doorToM(d, toM)),
    windows: els.filter(e => e.type === "window").map(w => windowToM(w, toM)),
    stairs: els.filter(e => e.type === "stair").map(s2 => stairToM(s2, toM)),
    luminarias: els.filter(e => e.type === "luminaria").map(l => luminariaToM(l, toM)),
    rooms: els.filter(e => e.type === "room").map(r => roomToM(r, toM)),
    nextElevation: null,
  };
}
function levelToMetersForRoom(level, room) {
  const poly = (level.sketchElements || []).find(e => e.type === "room" && e.roomId === room.id);
  if (!poly) return null;
  const s = toNum(level.sketchScale, 0.5);
  const toM = (px) => (px / GRID) * s;
  const els = level.sketchElements || [];
  const inPoly = (x, y) => pointInPolygon({ x, y }, poly.points);
  return {
    elevation: toNum(level.elevation, 0),
    walls: els.filter(e => e.type === "wall" && inPoly((e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2)).map(w => wallToM(w, toM)),
    doors: els.filter(e => e.type === "door" && inPoly(e.x, e.y)).map(d => doorToM(d, toM)),
    windows: els.filter(e => e.type === "window" && inPoly(e.x, e.y)).map(w => windowToM(w, toM)),
    stairs: els.filter(e => e.type === "stair" && inPoly((e.x1 + e.x2) / 2, (e.y1 + e.y2) / 2)).map(s2 => stairToM(s2, toM)),
    luminarias: els.filter(e => e.type === "luminaria" && inPoly(e.x, e.y)).map(l => luminariaToM(l, toM)),
    rooms: [roomToM(poly, toM)],
  };
}

// ---- brand mark -------------------------------------------------------------
function BrandMark({ size = 30 }) {
  return <img src={SYMBOL_LOGO} alt="BRAVES" style={{ height: size, width: "auto" }} />;
}

// ---- procedural wall finish textures (no external image assets needed) ----
const _textureCache = new Map();
function getWallTexture(finish, color) {
  const key = (finish || "A definir") + "|" + (color || "");
  if (_textureCache.has(key)) return _textureCache.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const paintish = finish === "Pintura";
  const base = paintish ? (color || "#E8E4DA") : (finish === "Porcelanato" ? "#E4E1D8" : finish === "Cerâmica" ? "#D8CFC0" : finish === "Madeira/Laminado" ? "#B08A5C" : finish === "Vinílico" ? "#C9C2B4" : "#D9D4C8");
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

// ---- 3D viewer (raw three.js — no OrbitControls addon available) ----------
function ThreeDView({ buildingLevels, elevationsById, openState = "closed", sectionCut }) {
  const mountRef = useRef(null);
  const [ok, setOk] = useState(true);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const totalWalls = buildingLevels.reduce((s, l) => s + l.walls.length, 0);
    if (totalWalls === 0) { setEmpty(true); return; }
    setEmpty(false);

    let renderer, raf, disposed = false;
    const cleanupFns = [];
    try {
      const width = mount.clientWidth || 320, height = 340;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.localClippingEnabled = true;
      if (sectionCut && sectionCut.enabled) {
        let plane;
        if (sectionCut.axis === "horizontal") plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), sectionCut.position);
        else if (sectionCut.axis === "vertical-x") plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), sectionCut.position);
        else plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), sectionCut.position);
        renderer.clippingPlanes = [plane];
      } else {
        renderer.clippingPlanes = [];
      }
      mount.innerHTML = "";
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 400);
      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const dir = new THREE.DirectionalLight(0xffffff, 0.75);
      dir.position.set(10, 16, 8);
      scene.add(dir);

      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = 1;

      buildingLevels.forEach(lvl => {
        const elev = lvl.elevation;
        const levelWallHeight = lvl.walls.length ? Math.max(...lvl.walls.map(w => w.height || 2.8)) : 2.8;

        lvl.walls.forEach(w => {
          const dx = w.x2 - w.x1, dz = w.y2 - w.y1;
          const len = Math.max(0.05, Math.hypot(dx, dz));
          const angle = Math.atan2(dz, dx);
          const h = w.height || 2.8;
          const ux = dx / len, uz = dz / len;
          const thickness = 0.2;

          // The physical opening in the wall always exists — "open" only
          // changes how the door/window leaf itself is posed, never removes
          // the hole (that used to make windows vanish and doors clip through
          // solid wall when toggled open).
          const openings = [
            ...lvl.doors.filter(d => d.wallId === w.id).map(d => ({ kind: "door", ...d })),
            ...lvl.windows.filter(win => win.wallId === w.id).map(win => ({ kind: "window", ...win })),
          ].map(o => {
            const pos = (o.x - w.x1) * ux + (o.y - w.y1) * uz;
            const halfW = Math.max(0.15, o.width / 2);
            return {
              ...o, pos,
              start: Math.max(0, pos - halfW), end: Math.min(len, pos + halfW),
              yBottom: o.kind === "door" ? 0 : o.peitoril,
              yTop: o.kind === "door" ? o.height : o.peitoril + o.height,
            };
          }).sort((a, b) => a.start - b.start);

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

          const texA = getWallTexture(w.finishA, w.paintColorA);
          const texB = getWallTexture(w.finishB, w.paintColorB);
          const matNeutral = new THREE.MeshStandardMaterial({ color: 0xdedad0, roughness: 0.9 });
          segs.forEach(seg => {
            const segLen = seg.end - seg.start, segH = seg.yTop - seg.yBottom;
            if (segLen <= 0.02 || segH <= 0.02) return;
            const tA = texA.clone(); tA.needsUpdate = true; tA.repeat.set(Math.max(1, segLen / 1.1), Math.max(1, segH / 1.1));
            const tB = texB.clone(); tB.needsUpdate = true; tB.repeat.set(Math.max(1, segLen / 1.1), Math.max(1, segH / 1.1));
            const matA = new THREE.MeshStandardMaterial({ map: tA, roughness: w.finishA === "Pintura" ? 0.45 : 0.92 });
            const matB = new THREE.MeshStandardMaterial({ map: tB, roughness: w.finishB === "Pintura" ? 0.45 : 0.92 });
            const geo = new THREE.BoxGeometry(segLen, segH, thickness);
            const mesh = new THREE.Mesh(geo, [matNeutral, matNeutral, matNeutral, matNeutral, matA, matB]);
            const cx = w.x1 + ux * (seg.start + segLen / 2);
            const cz = w.y1 + uz * (seg.start + segLen / 2);
            mesh.position.set(cx, elev + seg.yBottom + segH / 2, cz);
            mesh.rotation.y = -angle;
            scene.add(mesh);
          });

          // Door/window leaves: split into their real panel ("folha") count,
          // always rotated flush with this wall's own angle so they never
          // clip through or poke out of it. Sliding ("Correr") panels slide
          // sideways in the wall plane when open; hinged panels swing on a
          // vertical hinge into the room.
          openings.forEach(o => {
            const panels = Math.max(1, o.panels || 1);
            const panelWidth = o.width / panels;
            const gap = Math.min(0.03, panelWidth * 0.08);
            const isSliding = /correr/i.test(o.doorType || o.windowType || "");
            const isDoorKind = o.kind === "door";
            const color = isDoorKind ? 0x4A4A46 : 0xC7C5BE;
            const matOpts = isDoorKind
              ? { roughness: 0.5 }
              : { roughness: 0.2, transparent: true, opacity: 0.75 };

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
              scene.add(mesh);
            }
          });

          minX = Math.min(minX, w.x1, w.x2); maxX = Math.max(maxX, w.x1, w.x2);
          minZ = Math.min(minZ, w.y1, w.y2); maxZ = Math.max(maxZ, w.y1, w.y2);
          maxY = Math.max(maxY, elev + h);
        });

        (lvl.rooms || []).forEach(r => {
          if (r.points.length < 3) return;
          const shape = new THREE.Shape(r.points.map(p => new THREE.Vector2(p.x, -p.y)));
          const floorTex = getWallTexture(r.floorFinish, r.floorColor).clone(); floorTex.needsUpdate = true; floorTex.repeat.set(3, 3);
          const floorMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, side: THREE.DoubleSide }));
          floorMesh.rotation.x = -Math.PI / 2;
          floorMesh.position.y = elev + 0.01;
          scene.add(floorMesh);

          const ceilTex = getWallTexture(r.ceilingFinish, "#EDEBE4").clone(); ceilTex.needsUpdate = true; ceilTex.repeat.set(3, 3);
          const ceilMesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.95, side: THREE.DoubleSide }));
          ceilMesh.rotation.x = -Math.PI / 2;
          ceilMesh.position.y = elev + levelWallHeight - 0.01;
          scene.add(ceilMesh);
        });

        (lvl.stairs || []).forEach(st => {
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

        if (lvl.walls.length) {
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

      if (!isFinite(minX)) { minX = 0; maxX = 4; minZ = 0; maxZ = 4; }
      const target = new THREE.Vector3((minX + maxX) / 2, maxY / 2, (minZ + maxZ) / 2);
      let theta = Math.PI / 4, phi = Math.PI / 3.2;
      let camDist = Math.max(6, Math.hypot(maxX - minX, maxZ - minZ) * 1.25 + 3);

      function updateCamera() {
        camera.position.set(
          target.x + camDist * Math.sin(phi) * Math.cos(theta),
          target.y + camDist * Math.cos(phi),
          target.z + camDist * Math.sin(phi) * Math.sin(theta)
        );
        camera.lookAt(target);
      }
      updateCamera();

      let dragging = false, lastX = 0, lastY = 0;
      function onDown(e) { dragging = true; const p = e.touches ? e.touches[0] : e; lastX = p.clientX; lastY = p.clientY; }
      function onMove(e) {
        if (!dragging) return;
        const p = e.touches ? e.touches[0] : e;
        const dx = p.clientX - lastX, dy = p.clientY - lastY;
        lastX = p.clientX; lastY = p.clientY;
        theta -= dx * 0.008;
        phi = Math.min(Math.PI - 0.15, Math.max(0.2, phi - dy * 0.008));
        updateCamera();
      }
      function onUp() { dragging = false; }
      function onWheel(e) { e.preventDefault(); camDist = Math.min(80, Math.max(3, camDist + e.deltaY * 0.01)); updateCamera(); }

      const el = renderer.domElement;
      el.addEventListener("mousedown", onDown);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      el.addEventListener("touchstart", onDown, { passive: true });
      el.addEventListener("touchmove", onMove, { passive: true });
      el.addEventListener("touchend", onUp);
      el.addEventListener("wheel", onWheel, { passive: false });
      cleanupFns.push(() => {
        el.removeEventListener("mousedown", onDown);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
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
    };
  }, [buildingLevels, openState, sectionCut]);

  if (!ok) return <div className="text-xs p-4 text-center" style={{ color: C.mute }}>A visualização 3D não pôde ser iniciada neste navegador.</div>;
  if (empty) return <div className="text-xs p-6 text-center" style={{ color: C.mute }}>Ainda não há paredes desenhadas para mostrar em 3D. Desenhe no Croqui primeiro.</div>;
  return (
    <div>
      <div ref={mountRef} style={{ width: "100%", height: 340, borderRadius: 8, overflow: "hidden", background: "#8A8880" }} />
      <p className="text-[11px] mt-1.5 text-center" style={{ color: C.mute }}>Arraste para girar · roda do mouse (ou pinça) para zoom</p>
    </div>
  );
}

// ---- vector sketch (shared per LEVEL — walls are real, connected geometry) -
function VectorSketch({ level, allLevels, rooms, onChange, onMeta, onNameRoom, onMergeWalls, onLinkStairLevel }) {
  const svgRef = useRef(null);
  const [tool, setTool] = useState("parede");
  const [planMode, setPlanMode] = useState("piso");
  const [pending, setPending] = useState(null);
  const [polygon, setPolygon] = useState([]);
  const [dims, setDims] = useState({ w: 340, h: 300 });
  const [vb, setVb] = useState(null);
  const [deletedStack, setDeletedStack] = useState([]);
  const [namingId, setNamingId] = useState(null);
  const [namingValue, setNamingValue] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showBelow, setShowBelow] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [showAbove, setShowAbove] = useState(false);
  const [draggingLabel, setDraggingLabel] = useState(null);
  const [editingDim, setEditingDim] = useState(null);
  const [editingWallLen, setEditingWallLen] = useState(null);
  const [editingLumDim, setEditingLumDim] = useState(null);
  const [dragSession, setDragSession] = useState(null);
  const [splittingWall, setSplittingWall] = useState(null);
  const pinch = useRef(null);
  const scale = toNum(level.sketchScale, 0.5);
  const wallHeightDefault = level.wallHeightDefault || "2.80";
  const elements = level.sketchElements || [];
  const wallsById = {};
  elements.filter(e => e.type === "wall").forEach(w => { wallsById[w.id] = w; });
  const selected = elements.find(e => e.id === selectedId) || null;

  const levelIdx = (allLevels || []).findIndex(l => l.id === level.id);
  const belowLevel = levelIdx > 0 ? allLevels[levelIdx - 1] : null;
  const aboveLevel = (allLevels && levelIdx >= 0 && levelIdx < allLevels.length - 1) ? allLevels[levelIdx + 1] : null;

  useEffect(() => {
    function measure() {
      if (!svgRef.current) return;
      const w = svgRef.current.parentElement.clientWidth || 340;
      const h = Math.max(280, (window.innerHeight || 700) - 480);
      setDims({ w, h });
      setVb(v => v || { x: 0, y: 0, w, h });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const viewBox = vb || { x: 0, y: 0, w: dims.w, h: dims.h };

  function toScreen(p) {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: ((p.x - viewBox.x) / viewBox.w) * rect.width, y: ((p.y - viewBox.y) / viewBox.h) * rect.height };
  }
  function svgPoint(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    const relX = (p.clientX - rect.left) / rect.width;
    const relY = (p.clientY - rect.top) / rect.height;
    return { x: snap(viewBox.x + relX * viewBox.w), y: snap(viewBox.y + relY * viewBox.h) };
  }
  function svgPointRaw(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    const relX = (p.clientX - rect.left) / rect.width;
    const relY = (p.clientY - rect.top) / rect.height;
    return { x: viewBox.x + relX * viewBox.w, y: viewBox.y + relY * viewBox.h };
  }
  function pxToMeters(px) { return +((px / GRID) * scale).toFixed(2); }
  function commitElements(next) { onChange(next); }
  function patchSelected(patch) { if (!selectedId) return; commitElements(elements.map(e => e.id === selectedId ? { ...e, ...patch } : e)); }

  function zoomAround(relX, relY, factor) {
    setVb(v => {
      const cur = v || { x: 0, y: 0, w: dims.w, h: dims.h };
      const newW = Math.min(4000, Math.max(60, cur.w * factor));
      const newH = newW * (cur.h / cur.w);
      const cx = cur.x + relX * cur.w, cy = cur.y + relY * cur.h;
      return { x: cx - relX * newW, y: cy - relY * newH, w: newW, h: newH };
    });
  }
  function elementAnchor(el) {
    if (!el) return null;
    if (el.type === "wall" || el.type === "stair") return { x: (el.x1 + el.x2) / 2, y: (el.y1 + el.y2) / 2 };
    if (el.type === "door" || el.type === "window" || el.type === "luminaria") return { x: el.x, y: el.y };
    if (el.type === "room") return polygonCentroid(el.points);
    return null;
  }
  function zoomButton(factor) {
    const anchor = elementAnchor(selected);
    if (anchor) {
      setVb(v => {
        const cur = v || { x: 0, y: 0, w: dims.w, h: dims.h };
        const newW = Math.min(4000, Math.max(60, cur.w * factor));
        const newH = newW * (cur.h / cur.w);
        return { x: anchor.x - newW / 2, y: anchor.y - newH / 2, w: newW, h: newH };
      });
      return;
    }
    zoomAround(0.5, 0.5, factor);
  }
  function resetZoom() {
    if (!elements.length) { setVb({ x: 0, y: 0, w: dims.w, h: dims.h }); return; }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    elements.forEach(el => {
      if (el.type === "wall" || el.type === "stair") {
        minX = Math.min(minX, el.x1, el.x2); maxX = Math.max(maxX, el.x1, el.x2);
        minY = Math.min(minY, el.y1, el.y2); maxY = Math.max(maxY, el.y1, el.y2);
      } else if (el.type === "door" || el.type === "window" || el.type === "luminaria") {
        minX = Math.min(minX, el.x); maxX = Math.max(maxX, el.x);
        minY = Math.min(minY, el.y); maxY = Math.max(maxY, el.y);
      } else if (el.type === "room") {
        el.points.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
      }
    });
    if (!isFinite(minX)) { setVb({ x: 0, y: 0, w: dims.w, h: dims.h }); return; }
    const aspect = dims.w / dims.h;
    const contentW = Math.max(30, maxX - minX), contentH = Math.max(30, maxY - minY);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    let newW = contentW * 1.3, newH = newW / aspect;
    if (newH < contentH * 1.3) { newH = contentH * 1.3; newW = newH * aspect; }
    newW = Math.max(60, Math.min(4000, newW));
    newH = newW / aspect;
    setVb({ x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH });
  }
  function ensureVisible(x, y) {
    if (!isFinite(x) || !isFinite(y)) return;
    setVb(v => {
      const cur = v || { x: 0, y: 0, w: dims.w, h: dims.h };
      const margin = cur.w * 0.18;
      if (x < cur.x + margin || x > cur.x + cur.w - margin || y < cur.y + margin || y > cur.y + cur.h - margin) {
        return { x: x - cur.w / 2, y: y - cur.h / 2, w: cur.w, h: cur.h };
      }
      return cur;
    });
  }
  function onWheel(e) {
    e.preventDefault();
    const rect = svgRef.current.getBoundingClientRect();
    zoomAround((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height, e.deltaY > 0 ? 1.12 : 0.89);
  }
  function onTouchStartCanvas(e) {
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      pinch.current = { d: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY), vb: viewBox };
    }
  }
  function onTouchMoveCanvas(e) {
    if (e.touches.length === 2 && pinch.current) {
      if (e.cancelable) e.preventDefault();
      const [a, b] = e.touches;
      const d = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      const factor = pinch.current.d / Math.max(1, d);
      const startVb = pinch.current.vb;
      const newW = Math.min(4000, Math.max(60, startVb.w * factor));
      const newH = newW * (startVb.h / startVb.w);
      const cx = startVb.x + startVb.w / 2, cy = startVb.y + startVb.h / 2;
      setVb({ x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH });
      return;
    }
    if (e.touches.length === 1 && (dragSession || draggingLabel)) onCanvasPointerMove(e);
  }
  function onTouchEndCanvas(e) { if (e.touches.length < 2) pinch.current = null; if (e.touches.length === 0) onCanvasPointerUp(); }

  function nearestWall(p) {
    const walls = elements.filter(el => el.type === "wall");
    if (!walls.length) return null;
    const candidates = walls.map(w => {
      const proj = projectPointOnSegment(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      return { wall: w, proj, d: dist(p, proj), len: dist({ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }) };
    }).sort((a, b) => a.d - b.d);
    const screenPxTolerance = 16;
    const worldTolerance = screenPxTolerance * (viewBox.w / dims.w);
    const near = candidates.filter(c => c.d <= candidates[0].d + worldTolerance);
    near.sort((a, b) => a.len - b.len);
    return { wall: near[0].wall, proj: near[0].proj };
  }
  function findAt(p) {
    const dw = elements.filter(e => e.type === "door" || e.type === "window" || e.type === "luminaria");
    let best = null, bestD = Infinity;
    dw.forEach(e => { const d = dist(p, { x: e.x, y: e.y }); if (d < bestD) { bestD = d; best = e; } });
    if (best && bestD < 18) return best;
    const walls = elements.filter(e => e.type === "wall" || e.type === "stair");
    let bestWall = null, bestWD = Infinity;
    walls.forEach(w => {
      const proj = projectPointOnSegment(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      const d = dist(p, proj);
      if (d < bestWD) { bestWD = d; bestWall = w; }
    });
    if (bestWall && bestWD < 16) return bestWall;
    const roomPolys = elements.filter(e => e.type === "room");
    const hitRoom = roomPolys.find(r => pointInPolygon(p, r.points));
    if (hitRoom) return hitRoom;
    return null;
  }

  function handleTap(e) {
    if (e.touches && e.touches.length > 1) return;
    if (draggingLabel) return;
    e.preventDefault();
    const p = svgPoint(e);

    if (tool === "selecionar") { const hit = findAt(p); setSelectedId(hit ? hit.id : null); return; }

    if (tool === "apagar") {
      const target = findAt(p);
      if (!target) return;
      let batch = [target];
      if (target.type === "wall") {
        const attached = elements.filter(el => (el.type === "door" || el.type === "window") && el.wallId === target.id);
        batch = [target, ...attached];
      }
      const ids = new Set(batch.map(b => b.id));
      setDeletedStack(s => [...s, batch]);
      if (selectedId && ids.has(selectedId)) setSelectedId(null);
      commitElements(elements.filter(el => !ids.has(el.id)));
      return;
    }

    if (tool === "parede") {
      if (!pending) { setPending(p); return; }
      if (p.x === pending.x && p.y === pending.y) { setPending(null); return; }
      const length = pxToMeters(dist(pending, p));
      const wallCount = elements.filter(x => x.type === "wall").length;
      const el = { id: uid(), type: "wall", x1: pending.x, y1: pending.y, x2: p.x, y2: p.y, tag: `P-${wallCount + 1}`, length, height: wallHeightDefault, wallType: WALL_TYPES[0], finishA: "A definir", paintColorA: "#E8E4DA", finishB: "A definir", paintColorB: "#E8E4DA", condition: "A confirmar" };
      commitElements([...elements, el]);
      setPending(null);
      return;
    }

    if (tool === "escada") {
      if (!pending) { setPending(p); return; }
      if (p.x === pending.x && p.y === pending.y) { setPending(null); return; }
      const count = elements.filter(x => x.type === "stair").length;
      const el = { id: uid(), type: "stair", x1: pending.x, y1: pending.y, x2: p.x, y2: p.y, tag: `ES-${count + 1}`, toLevelId: aboveLevel?.id || "", width: 1.0, condition: "A confirmar" };
      commitElements([...elements, el]);
      setPending(null);
      setSelectedId(el.id);
      return;
    }

    if (tool === "luminaria") {
      const raw = svgPointRaw(e);
      const count = elements.filter(x => x.type === "luminaria").length;
      const el = { id: uid(), type: "luminaria", x: raw.x, y: raw.y, tag: `LM-${count + 1}` };
      commitElements([...elements, el]);
      setSelectedId(el.id);
      return;
    }

    if (tool === "ambiente") {
      if (polygon.length === 0) {
        const hitExisting = elements.find(e => e.type === "room" && pointInPolygon(p, e.points));
        if (hitExisting) {
          if (planMode === "forro") { setSelectedId(hitExisting.id); return; }
          setNamingId(hitExisting.id); setNamingValue(hitExisting.name || "");
          return;
        }
      }
      if (planMode === "forro") return;
      setPolygon([...polygon, p]);
      return;
    }

    if (tool === "porta" || tool === "janela") {
      const hit = nearestWall(p);
      if (!hit) return;
      const type = tool === "porta" ? "door" : "window";
      const count = elements.filter(x => x.type === type).length;
      const tagPrefix = tool === "porta" ? "PT" : "JN";
      const el = tool === "porta"
        ? { id: uid(), type, x: hit.proj.x, y: hit.proj.y, wallId: hit.wall.id, tag: `${tagPrefix}-${count + 1}`, width: 0.8, height: 2.10, doorType: DOOR_TYPES[0], panels: 1, condition: "A confirmar" }
        : { id: uid(), type, x: hit.proj.x, y: hit.proj.y, wallId: hit.wall.id, tag: `${tagPrefix}-${count + 1}`, width: 1.2, height: 1.20, peitoril: 1.00, windowType: WINDOW_TYPES[0], panels: 2, condition: "A confirmar" };
      commitElements([...elements, el]);
      setSelectedId(el.id);
    }
  }

  function restoreLast() {
    if (!deletedStack.length) return;
    const batch = deletedStack[deletedStack.length - 1];
    setDeletedStack(s => s.slice(0, -1));
    commitElements([...elements, ...batch]);
  }

  function closePolygon() {
    if (polygon.length < 3) return;
    let area = 0;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      area += a.x * b.y - b.x * a.y;
    }
    area = Math.abs(area / 2);
    const areaM2 = +((area / (GRID * GRID)) * scale * scale).toFixed(2);
    const el = { id: uid(), type: "room", points: polygon, area: areaM2, roomId: null, floorFinish: "A definir", floorColor: "#D9D4C8", ceilingFinish: "A definir" };
    commitElements([...elements, el]);
    setPolygon([]);
    setNamingId(el.id); setNamingValue("");
  }

  function saveName() {
    if (namingId) onNameRoom(namingId, namingValue.trim());
    setNamingId(null); setNamingValue("");
  }

  function undoLast() {
    if (tool === "ambiente" && polygon.length > 0) { setPolygon(polygon.slice(0, -1)); return; }
    if (pending) { setPending(null); return; }
    commitElements(elements.slice(0, -1));
  }
  function clearAll() {
    if (!window.confirm("Limpar todo o croqui deste nível? Essa ação não pode ser desfeita.")) return;
    commitElements([]); setPolygon([]); setPending(null); setSelectedId(null);
  }

  function tryMergeSelected() {
    if (!selected || selected.type !== "wall") return;
    const other = findMergeableWall(selected, elements);
    if (!other) return;
    const merged = mergeWallPair(selected, other);
    const newWall = { ...selected, ...merged, length: pxToMeters(dist({ x: merged.x1, y: merged.y1 }, { x: merged.x2, y: merged.y2 })) };
    const next = elements
      .filter(e => e.id !== other.id && e.id !== selected.id)
      .map(e => (e.wallId === other.id ? { ...e, wallId: newWall.id } : e));
    next.push(newWall);
    commitElements(next);
    setSelectedId(newWall.id);
  }

  function splitSelectedWallAt(distM) {
    if (!selected || selected.type !== "wall") return;
    const dx = selected.x2 - selected.x1, dy = selected.y2 - selected.y1, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const cutPx = Math.min(len - 4, Math.max(4, (toNum(distM) / scale) * GRID));
    const mx = snap(selected.x1 + ux * cutPx), my = snap(selected.y1 + uy * cutPx);
    if ((mx === selected.x1 && my === selected.y1) || (mx === selected.x2 && my === selected.y2)) return;
    const wallCount = elements.filter(x => x.type === "wall").length;
    const partA = { ...selected, id: uid(), x2: mx, y2: my, tag: `P-${wallCount + 1}`, length: pxToMeters(dist({ x: selected.x1, y: selected.y1 }, { x: mx, y: my })) };
    const partB = { ...selected, id: uid(), x1: mx, y1: my, tag: `P-${wallCount + 2}`, length: pxToMeters(dist({ x: mx, y: my }, { x: selected.x2, y: selected.y2 })) };
    const midPos = (mx - selected.x1) * ux + (my - selected.y1) * uy;
    const next = elements.filter(e => e.id !== selected.id).map(e => {
      if (e.wallId !== selected.id) return e;
      const pos = (e.x - selected.x1) * ux + (e.y - selected.y1) * uy;
      return { ...e, wallId: pos <= midPos ? partA.id : partB.id };
    });
    next.push(partA, partB);
    commitElements(next);
    setSelectedId(partA.id);
    setSplittingWall(null);
  }

  function moveOpeningAlongWall(el, newPosM) {
    const w = wallsById[el.wallId];
    if (!w) return;
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const halfW = (toNum(el.width, 0.8) / scale) * GRID / 2;
    const lo = Math.min(halfW, len / 2), hi = Math.max(len - halfW, len / 2);
    const posPx = Math.max(lo, Math.min(hi, (newPosM / scale) * GRID));
    const nx = w.x1 + ux * posPx, ny = w.y1 + uy * posPx;
    commitElements(elements.map(e => e.id === el.id ? { ...e, x: nx, y: ny } : e));
    ensureVisible(nx, ny);
  }
  function openingPosM(el) {
    const w = wallsById[el.wallId];
    if (!w) return 0;
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const pos = (el.x - w.x1) * ux + (el.y - w.y1) * uy;
    return pxToMeters(pos);
  }

  function applyDimEdit() {
    if (!editingDim) return;
    const { wallId, gapIndex, value, ux, uy } = editingDim;
    const w = wallsById[wallId];
    if (!w) { setEditingDim(null); return; }
    const opens = elements.filter(e => (e.type === "door" || e.type === "window") && e.wallId === wallId)
      .map(o => ({ ...o, pos: (o.x - w.x1) * ux + (o.y - w.y1) * uy, halfW: (toNum(o.width, 0.8) / scale) * GRID / 2 }))
      .sort((a, b) => a.pos - b.pos);
    const dx0 = w.x2 - w.x1, dy0 = w.y2 - w.y1, len = Math.hypot(dx0, dy0) || 1;
    const gaps = [];
    let cursor = 0;
    opens.forEach(o => { const start = o.pos - o.halfW, end = o.pos + o.halfW; if (start - cursor > 3) gaps.push({ start: cursor, end: start, afterOpeningId: o.id }); cursor = Math.max(cursor, end); });
    if (len - cursor > 3) gaps.push({ start: cursor, end: len, afterOpeningId: null });
    const gap = gaps[gapIndex];
    if (!gap) { setEditingDim(null); return; }
    const newLenPx = Math.max(2, (toNum(value) / scale) * GRID);
    const rawDelta = newLenPx - (gap.end - gap.start);
    if (Math.abs(rawDelta) < 0.01) { setEditingDim(null); return; }

    if (gap.afterOpeningId) {
      const fromIdx = opens.findIndex(o => o.id === gap.afterOpeningId);
      const shifted = opens.slice(fromIdx);
      const prevEnd = fromIdx > 0 ? opens[fromIdx - 1].pos + opens[fromIdx - 1].halfW : 0;
      const minDelta = prevEnd - (shifted[0].pos - shifted[0].halfW) + 2;
      const maxDelta = len - (shifted[shifted.length - 1].pos + shifted[shifted.length - 1].halfW) - 2;
      const delta = Math.max(minDelta, Math.min(maxDelta, rawDelta));
      const shiftIds = new Set(shifted.map(o => o.id));
      let lastXY = null;
      commitElements(elements.map(e => {
        if (!shiftIds.has(e.id)) return e;
        const nx = e.x + ux * delta, ny = e.y + uy * delta;
        lastXY = { x: nx, y: ny };
        return { ...e, x: nx, y: ny };
      }));
      if (lastXY) ensureVisible(lastXY.x, lastXY.y);
    } else {
      const minLen = cursor + 2;
      const newLen = Math.max(minLen, len + rawDelta);
      const newX2 = w.x1 + ux * newLen, newY2 = w.y1 + uy * newLen;
      const newLenM = pxToMeters(dist({ x: w.x1, y: w.y1 }, { x: newX2, y: newY2 }));
      commitElements(elements.map(e => e.id === w.id ? { ...e, x2: newX2, y2: newY2, length: newLenM } : e));
      ensureVisible(newX2, newY2);
    }
    setEditingDim(null);
  }

  function setWallLengthDirect(wallId, newLenM) {
    const w = wallsById[wallId];
    if (!w) return;
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1, curLen = Math.hypot(dx, dy) || 1;
    const ux = dx / curLen, uy = dy / curLen;
    const newLenPx = Math.max(4, (toNum(newLenM) / scale) * GRID);
    const newX2 = w.x1 + ux * newLenPx, newY2 = w.y1 + uy * newLenPx;
    const newLenMActual = pxToMeters(dist({ x: w.x1, y: w.y1 }, { x: newX2, y: newY2 }));
    commitElements(elements.map(e => e.id === w.id ? { ...e, x2: newX2, y2: newY2, length: newLenMActual } : e));
    ensureVisible(newX2, newY2);
  }
  function applyWallLenEdit() {
    if (!editingWallLen) return;
    setWallLengthDirect(editingWallLen.wallId, editingWallLen.value);
    setEditingWallLen(null);
  }

  function luminariaDimensions(lm) {
    const walls = elements.filter(e => e.type === "wall");
    const lums = elements.filter(e => e.type === "luminaria" && e.id !== lm.id);
    let wallDim = null;
    walls.forEach(w => {
      const proj = projectPointOnSegment({ x: lm.x, y: lm.y }, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      const d = dist({ x: lm.x, y: lm.y }, proj);
      if (!wallDim || d < wallDim.d) wallDim = { target: proj, d, wallId: w.id };
    });
    let lumDim = null;
    lums.forEach(other => {
      const d = dist({ x: lm.x, y: lm.y }, { x: other.x, y: other.y });
      if (!lumDim || d < lumDim.d) lumDim = { target: { x: other.x, y: other.y }, d, otherId: other.id };
    });
    return { wallDim, lumDim };
  }

  function applyLumDimEdit() {
    if (!editingLumDim) return;
    const { lumId, refX, refY, value } = editingLumDim;
    const lm = elements.find(e => e.id === lumId);
    if (!lm) { setEditingLumDim(null); return; }
    const dx = lm.x - refX, dy = lm.y - refY, curD = Math.hypot(dx, dy) || 1;
    const ux = dx / curD, uy = dy / curD;
    const newDPx = Math.max(2, (toNum(value) / scale) * GRID);
    const nx = refX + ux * newDPx, ny = refY + uy * newDPx;
    commitElements(elements.map(e => e.id === lumId ? { ...e, x: nx, y: ny } : e));
    ensureVisible(nx, ny);
    setEditingLumDim(null);
  }

  function startLabelDrag(el, e) {
    e.stopPropagation(); e.preventDefault();
    const centroid = polygonCentroid(el.points);
    setDraggingLabel({ id: el.id, centroid });
  }
  function onLabelDragMove(e) {
    if (!draggingLabel) return;
    const p = svgPointRaw(e);
    const el = elements.find(x => x.id === draggingLabel.id);
    if (!el) return;
    if (!pointInPolygon(p, el.points)) return;
    const centroid = draggingLabel.centroid;
    commitElements(elements.map(x => x.id === el.id ? { ...x, labelOffset: { dx: p.x - centroid.x, dy: p.y - centroid.y } } : x));
  }
  function onLabelDragEnd() { setDraggingLabel(null); }
  function rotateRoomLabel(el) {
    const next = ((el.labelRotation || 0) + 90) % 360;
    commitElements(elements.map(x => x.id === el.id ? { ...x, labelRotation: next } : x));
  }

  function beginDragWallMove(w, e) {
    if (tool !== "selecionar") return;
    e.stopPropagation(); e.preventDefault();
    setSelectedId(w.id);
    setDragSession({ kind: "wall-move", id: w.id, startPointer: svgPointRaw(e), orig: { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 } });
  }
  function beginDragWallEndpoint(w, which, e) {
    e.stopPropagation(); e.preventDefault();
    setSelectedId(w.id);
    setDragSession({ kind: "wall-endpoint", id: w.id, which });
  }
  function beginDragOpening(el, e) {
    if (tool !== "selecionar") return;
    e.stopPropagation(); e.preventDefault();
    setSelectedId(el.id);
    setDragSession({ kind: "opening", id: el.id, wallId: el.wallId });
  }
  function onCanvasPointerMove(e) {
    onLabelDragMove(e);
    if (!dragSession) return;
    if (e.cancelable) e.preventDefault();
    const p = svgPointRaw(e);
    if (dragSession.kind === "wall-move") {
      const dx = p.x - dragSession.startPointer.x, dy = p.y - dragSession.startPointer.y;
      const nx1 = snap(dragSession.orig.x1 + dx), ny1 = snap(dragSession.orig.y1 + dy);
      const nx2 = snap(dragSession.orig.x2 + dx), ny2 = snap(dragSession.orig.y2 + dy);
      const actualDx = nx1 - dragSession.orig.x1, actualDy = ny1 - dragSession.orig.y1;
      commitElements(elements.map(el => {
        if (el.id === dragSession.id) return { ...el, x1: nx1, y1: ny1, x2: nx2, y2: ny2 };
        if (el.wallId === dragSession.id) return { ...el, x: el.x + actualDx, y: el.y + actualDy };
        return el;
      }));
    } else if (dragSession.kind === "wall-endpoint") {
      const sp = { x: snap(p.x), y: snap(p.y) };
      commitElements(elements.map(el => {
        if (el.id !== dragSession.id) return el;
        const next = dragSession.which === "start" ? { ...el, x1: sp.x, y1: sp.y } : { ...el, x2: sp.x, y2: sp.y };
        next.length = pxToMeters(dist({ x: next.x1, y: next.y1 }, { x: next.x2, y: next.y2 }));
        return next;
      }));
    } else if (dragSession.kind === "opening") {
      const w = wallsById[dragSession.wallId];
      if (!w) return;
      const proj = projectPointOnSegment(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      commitElements(elements.map(el => el.id === dragSession.id ? { ...el, x: proj.x, y: proj.y } : el));
    }
  }
  function onCanvasPointerUp() { onLabelDragEnd(); setDragSession(null); }

  function wallDimensions(w) {
    const opens = elements.filter(e => (e.type === "door" || e.type === "window") && e.wallId === w.id);
    if (!opens.length) return null;
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const offset = 13;
    const ivs = opens.map(o => {
      const pos = (o.x - w.x1) * ux + (o.y - w.y1) * uy;
      const halfW = (toNum(o.width, 0.8) / scale) * GRID / 2;
      return { id: o.id, start: pos - halfW, end: pos + halfW };
    }).sort((a, b) => a.start - b.start);
    const gaps = [];
    let cursor = 0;
    ivs.forEach(iv => { if (iv.start - cursor > 3) gaps.push({ start: cursor, end: iv.start, afterOpeningId: iv.id }); cursor = Math.max(cursor, iv.end); });
    if (len - cursor > 3) gaps.push({ start: cursor, end: len, afterOpeningId: null });
    return gaps.map((g, i) => {
      const { start: s, end: e2 } = g;
      const p1 = { x: w.x1 + ux * s + nx * offset, y: w.y1 + uy * s + ny * offset };
      const p2 = { x: w.x1 + ux * e2 + nx * offset, y: w.y1 + uy * e2 + ny * offset };
      const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
      const lenM = (((e2 - s) / GRID) * scale).toFixed(2);
      const isEditing = editingDim && editingDim.wallId === w.id && editingDim.gapIndex === i;
      const editable = tool === "selecionar";
      return (
        <g key={w.id + "-dim-" + i}>
          <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#4A4A46" strokeWidth="0.75" />
          <line x1={p1.x - nx * 4} y1={p1.y - ny * 4} x2={p1.x + nx * 4} y2={p1.y + ny * 4} stroke="#4A4A46" strokeWidth="0.75" />
          <line x1={p2.x - nx * 4} y1={p2.y - ny * 4} x2={p2.x + nx * 4} y2={p2.y + ny * 4} stroke="#4A4A46" strokeWidth="0.75" />
          {editable && (
            <rect x={midX - 12} y={midY - 12} width="24" height="12" fill={isEditing ? "#4A4A46" : "transparent"} opacity={isEditing ? 0.3 : 1}
              style={{ cursor: "pointer" }}
              onClick={e => { e.stopPropagation(); setEditingDim({ wallId: w.id, gapIndex: i, value: lenM, ux, uy }); }} />
          )}
          <text x={midX} y={midY - 3} fontSize="7.5" fill="#4A4A46" textAnchor="middle" style={editable ? { cursor: "pointer" } : undefined}
            onClick={editable ? (e => { e.stopPropagation(); setEditingDim({ wallId: w.id, gapIndex: i, value: lenM, ux, uy }); }) : undefined}>{lenM}</text>
        </g>
      );
    });
  }

  function ghostLevel(lvl, color) {
    if (!lvl) return null;
    const els = lvl.sketchElements || [];
    return (
      <g opacity="0.35" pointerEvents="none">
        {els.filter(e => e.type === "wall").map(w => <line key={w.id} x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke={color} strokeWidth="3" strokeDasharray="5,3" />)}
        {els.filter(e => e.type === "room").map(r => <polygon key={r.id} points={r.points.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke={color} strokeWidth="1" strokeDasharray="2,3" />)}
      </g>
    );
  }

  const PISO_TOOLS = [
    { id: "selecionar", label: "Selecionar", Icon: MousePointer2 },
    { id: "parede", label: "Parede", Icon: RectangleHorizontal },
    { id: "ambiente", label: "Ambiente", Icon: Square },
    { id: "porta", label: "Porta", Icon: DoorClosed },
    { id: "janela", label: "Janela", Icon: Layers3 },
    { id: "escada", label: "Escada", Icon: ArrowUpRight },
    { id: "apagar", label: "Apagar", Icon: Eraser },
  ];
  const FORRO_TOOLS = [
    { id: "selecionar", label: "Selecionar", Icon: MousePointer2 },
    { id: "ambiente", label: "Ambiente (acabamento)", Icon: Square },
    { id: "luminaria", label: "Luminária", Icon: Lightbulb },
    { id: "apagar", label: "Apagar", Icon: Eraser },
  ];
  const TOOLS = planMode === "forro" ? FORRO_TOOLS : PISO_TOOLS;

  return (
    <div>
      <div className="flex gap-1.5 mb-2">
        <button onClick={() => { setPlanMode("piso"); setTool("selecionar"); setSelectedId(null); }} className="flex-1 py-1.5 rounded text-[11px]"
          style={{ ...heading, fontWeight: 600, background: planMode === "piso" ? C.gold : C.panelAlt, color: planMode === "piso" ? "#141311" : C.mute }}>Planta de Piso</button>
        <button onClick={() => { setPlanMode("forro"); setTool("selecionar"); setSelectedId(null); }} className="flex-1 py-1.5 rounded text-[11px]"
          style={{ ...heading, fontWeight: 600, background: planMode === "forro" ? C.gold : C.panelAlt, color: planMode === "forro" ? "#141311" : C.mute }}>Planta de Forro</button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {TOOLS.map(({ id, label, Icon }) => {
          const active = tool === id;
          const activeColor = id === "apagar" ? C.bad : C.gold;
          return (
            <button key={id} onClick={() => { setTool(id); setPending(null); }}
              className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded"
              style={{ ...heading, fontWeight: 600, background: active ? (id === "apagar" ? "rgba(193,84,63,0.16)" : C.goldTint) : C.panelAlt, color: active ? activeColor : C.mute, border: `1px solid ${active ? activeColor : C.line}` }}>
              <Icon size={12} /> {label}
            </button>
          );
        })}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setShowGrid(g => !g)} className="p-1.5 rounded" style={{ background: showGrid ? C.goldTint : C.panelAlt, border: `1px solid ${showGrid ? C.gold : C.line}` }}><Grid3x3 size={13} color={showGrid ? C.gold : C.chalk} /></button>
          <button onClick={() => zoomButton(0.8)} className="p-1.5 rounded" style={{ background: C.panelAlt, border: `1px solid ${C.line}` }}><ZoomIn size={13} color={C.chalk} /></button>
          <button onClick={() => zoomButton(1.25)} className="p-1.5 rounded" style={{ background: C.panelAlt, border: `1px solid ${C.line}` }}><ZoomOut size={13} color={C.chalk} /></button>
          <button onClick={resetZoom} title="Centralizar e enquadrar tudo" className="p-1.5 rounded" style={{ background: C.panelAlt, border: `1px solid ${C.line}` }}><Maximize2 size={13} color={C.chalk} /></button>
        </div>
      </div>
      {tool === "apagar" && (
        <p className="text-[11px] mb-2" style={{ color: C.bad }}>Toque num elemento para apagá-lo. Uma parede apagada leva junto as portas/janelas dela.</p>
      )}
      {planMode === "piso" && (
        <div className="flex flex-wrap items-center gap-3 mb-2 text-[10px]" style={{ color: C.mute }}>
          <span className="flex items-center gap-1"><SlidersHorizontal size={11} /> 1 quadro =
            <input type="text" inputMode="decimal" value={scale} onChange={e => onMeta({ sketchScale: e.target.value })}
              className="w-12 px-1 py-0.5 rounded text-[10px]" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} /> m
          </span>
          <span className="flex items-center gap-1">Pé-direito novas paredes
            <input type="text" inputMode="decimal" value={wallHeightDefault} onChange={e => onMeta({ wallHeightDefault: e.target.value })}
              className="w-14 px-1 py-0.5 rounded text-[10px]" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} /> m
          </span>
          {(belowLevel || aboveLevel) && (
            <span className="flex items-center gap-2">
              {belowLevel && (
                <label className="flex items-center gap-1"><input type="checkbox" checked={showBelow} onChange={e => setShowBelow(e.target.checked)} /> ver {belowLevel.name}</label>
              )}
              {aboveLevel && (
                <label className="flex items-center gap-1"><input type="checkbox" checked={showAbove} onChange={e => setShowAbove(e.target.checked)} /> ver {aboveLevel.name}</label>
              )}
            </span>
          )}
        </div>
      )}

      {tool === "ambiente" && planMode === "piso" && (
        <div className="flex items-center gap-2 mb-2 text-[11px]" style={{ color: C.mute }}>
          <span>{polygon.length} ponto(s) marcados</span>
          <button onClick={closePolygon} disabled={polygon.length < 3}
            className="px-2 py-1 rounded" style={{ ...heading, fontWeight: 600, background: C.goldTint, color: C.gold, opacity: polygon.length < 3 ? 0.4 : 1 }}>Fechar ambiente</button>
        </div>
      )}

      {namingId && (
        <div className="flex items-center gap-2 mb-2 p-2 rounded" style={{ background: C.goldTint, border: `1px solid ${C.gold}` }}>
          <span className="text-[11px] shrink-0" style={{ color: C.gold }}>Nome do ambiente:</span>
          <input autoFocus value={namingValue} onChange={e => setNamingValue(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveName()}
            className="flex-1 px-2 py-1 rounded text-xs" style={{ background: "rgba(255,255,255,0.08)", color: C.chalk, border: `1px solid ${C.line}` }} />
          <button onClick={saveName} className="text-[11px] px-2 py-1 rounded" style={{ background: C.gold, color: "#141311" }}>Salvar</button>
          <button onClick={() => { setNamingId(null); setNamingValue(""); }} className="text-[11px] px-1.5" style={{ color: C.mute }}><X size={13} /></button>
        </div>
      )}

      {editingDim && (
        <div className="flex items-center gap-2 mb-2 p-2 rounded" style={{ background: C.goldTint, border: `1px solid ${C.gold}` }}>
          <span className="text-[11px] shrink-0" style={{ color: C.gold }}>Corrigir distância (m):</span>
          <input autoFocus type="text" inputMode="decimal" value={editingDim.value} onChange={e => setEditingDim({ ...editingDim, value: e.target.value })}
            onKeyDown={e => e.key === "Enter" && applyDimEdit()}
            className="w-20 px-2 py-1 rounded text-xs" style={{ background: "rgba(255,255,255,0.08)", color: C.chalk, border: `1px solid ${C.line}` }} />
          <span className="text-[10px]" style={{ color: C.mute }}>desloca o que vem depois nesta parede</span>
          <button onClick={applyDimEdit} className="text-[11px] px-2 py-1 rounded ml-auto" style={{ background: C.gold, color: "#141311" }}>Aplicar</button>
          <button onClick={() => setEditingDim(null)} className="text-[11px] px-1.5" style={{ color: C.mute }}><X size={13} /></button>
        </div>
      )}

      {editingWallLen && (
        <div className="flex items-center gap-2 mb-2 p-2 rounded" style={{ background: C.goldTint, border: `1px solid ${C.gold}` }}>
          <span className="text-[11px] shrink-0" style={{ color: C.gold }}>Comprimento da parede (m):</span>
          <input autoFocus type="text" inputMode="decimal" value={editingWallLen.value} onChange={e => setEditingWallLen({ ...editingWallLen, value: e.target.value })}
            onKeyDown={e => e.key === "Enter" && applyWallLenEdit()}
            className="w-20 px-2 py-1 rounded text-xs" style={{ background: "rgba(255,255,255,0.08)", color: C.chalk, border: `1px solid ${C.line}` }} />
          <span className="text-[10px]" style={{ color: C.mute }}>estica/encolhe a partir do início da parede</span>
          <button onClick={applyWallLenEdit} className="text-[11px] px-2 py-1 rounded ml-auto" style={{ background: C.gold, color: "#141311" }}>Aplicar</button>
          <button onClick={() => setEditingWallLen(null)} className="text-[11px] px-1.5" style={{ color: C.mute }}><X size={13} /></button>
        </div>
      )}

      <svg ref={svgRef} width="100%" height={dims.h} viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="rounded-md touch-none" style={{ background: "#DCDCD8", border: "1px solid #C6C6C1", display: "block", touchAction: "none" }}
        onClick={handleTap} onWheel={onWheel}
        onTouchStart={onTouchStartCanvas} onTouchMove={onTouchMoveCanvas} onTouchEnd={onTouchEndCanvas}
        onMouseMove={onCanvasPointerMove} onMouseUp={onCanvasPointerUp} onMouseLeave={onCanvasPointerUp}>
        <defs>
          <pattern id={`grid-${level.id}`} width={GRID} height={GRID} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#C6C6C1" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x={viewBox.x - viewBox.w} y={viewBox.y - viewBox.h} width={viewBox.w * 3} height={viewBox.h * 3} fill={showGrid ? `url(#grid-${level.id})` : "#DCDCD8"} />

        {showBelow && ghostLevel(belowLevel, "#8A8880")}
        {showAbove && ghostLevel(aboveLevel, "#4A4A46")}

        {planMode === "piso" && elements.filter(el => el.type === "room").map(el => {
          const centroid = polygonCentroid(el.points);
          const lines = wrapTextLines(el.name || "Ambiente sem nome", 14);
          const totalLines = lines.length + 1;
          const lineHeight = 11;
          const lx = centroid.x + (el.labelOffset?.dx ?? 0);
          const ly = centroid.y + (el.labelOffset?.dy ?? 0);
          const topY = ly - ((totalLines - 1) * lineHeight) / 2;
          const rot = el.labelRotation || 0;
          const isSel = selectedId === el.id;
          const longest = Math.max(...lines.map(l => l.length), String(el.area).length + 3);
          const hitW = longest * 5.6 + 10, hitH = totalLines * lineHeight + 8;
          return (
            <g key={el.id}>
              <polygon points={el.points.map(p => `${p.x},${p.y}`).join(" ")} fill="rgba(0,0,0,0.06)" stroke={isSel ? "#726F68" : "#4A4A46"} strokeWidth={isSel ? 2.5 : 1.5} />
              <g style={{ cursor: "move" }} onMouseDown={e => startLabelDrag(el, e)} onTouchStart={e => startLabelDrag(el, e)} transform={rot ? `rotate(${rot} ${lx} ${ly})` : undefined}>
                <rect x={lx - hitW / 2} y={ly - hitH / 2} width={hitW} height={hitH} fill="rgba(255,255,255,0.001)" />
                {lines.map((ln, i) => <text key={i} x={lx} y={topY + i * lineHeight} fontSize="10" fontWeight="600" fill="#4A4A46" textAnchor="middle" style={{ pointerEvents: "none" }}>{ln}</text>)}
                <text x={lx} y={topY + lines.length * lineHeight} fontSize="9" fill="#4A4A46" textAnchor="middle" style={{ pointerEvents: "none" }}>{el.area} m²</text>
              </g>
            </g>
          );
        })}
        {planMode === "forro" && elements.filter(el => el.type === "room").map(el => (
          <g key={el.id}>
            <polygon points={el.points.map(p => `${p.x},${p.y}`).join(" ")} fill="rgba(0,0,0,0.05)" stroke={selectedId === el.id ? "#726F68" : "#8A8880"} strokeWidth={selectedId === el.id ? 2.5 : 1} strokeDasharray="3,3" />
            <text x={polygonCentroid(el.points).x - 20} y={polygonCentroid(el.points).y} fontSize="8" fill="#6B6862">{el.ceilingFinish && el.ceilingFinish !== "A definir" ? el.ceilingFinish : ""}</text>
          </g>
        ))}
        {elements.filter(el => el.type === "wall").map(el => (
          <g key={el.id} opacity={planMode === "forro" ? 0.35 : 1}>
            <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke={selectedId === el.id ? "#726F68" : "#1B1E1A"} strokeWidth={selectedId === el.id ? 6 : 4} strokeLinecap="square"
              style={{ cursor: tool === "selecionar" ? "move" : "default" }} onMouseDown={e => beginDragWallMove(el, e)} onTouchStart={e => beginDragWallMove(el, e)} />
            {planMode === "piso" && (
              <text x={(el.x1 + el.x2) / 2} y={(el.y1 + el.y2) / 2 - 6} fontSize="10" fill="#6b6660" textAnchor="middle"
                style={tool === "selecionar" ? { cursor: "pointer" } : undefined}
                onClick={tool === "selecionar" ? (e => { e.stopPropagation(); setEditingWallLen({ wallId: el.id, value: el.length }); }) : undefined}>
                {el.length} m{tool === "selecionar" && " ✎"}
              </text>
            )}
            {planMode === "piso" && wallDimensions(el)}
            {selectedId === el.id && tool === "selecionar" && (
              <>
                <circle cx={el.x1} cy={el.y1} r="6" fill="#726F68" stroke="#1B1E1A" strokeWidth="1" style={{ cursor: "grab" }}
                  onMouseDown={e => beginDragWallEndpoint(el, "start", e)} onTouchStart={e => beginDragWallEndpoint(el, "start", e)} />
                <circle cx={el.x2} cy={el.y2} r="6" fill="#726F68" stroke="#1B1E1A" strokeWidth="1" style={{ cursor: "grab" }}
                  onMouseDown={e => beginDragWallEndpoint(el, "end", e)} onTouchStart={e => beginDragWallEndpoint(el, "end", e)} />
              </>
            )}
          </g>
        ))}
        {planMode === "piso" && elements.filter(el => el.type === "stair").map(el => (
          <g key={el.id}>
            <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke={selectedId === el.id ? "#726F68" : "#6B6862"} strokeWidth="10" strokeLinecap="round" opacity="0.7"
              style={{ cursor: tool === "selecionar" ? "move" : "default" }} onMouseDown={e => beginDragWallMove(el, e)} onTouchStart={e => beginDragWallMove(el, e)} />
            {el.hasLanding && <circle cx={el.x1 + (el.x2 - el.x1) * toNum(el.landingPos, 0.5)} cy={el.y1 + (el.y2 - el.y1) * toNum(el.landingPos, 0.5)} r="9" fill="none" stroke="#4A4A46" strokeWidth="1.5" />}
            {Array.from({ length: 5 }).map((_, i) => {
              const t = (i + 1) / 6;
              const x = el.x1 + (el.x2 - el.x1) * t, y = el.y1 + (el.y2 - el.y1) * t;
              return <line key={i} x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} stroke="#4A4A46" strokeWidth="1.5" />;
            })}
            <text x={(el.x1 + el.x2) / 2} y={(el.y1 + el.y2) / 2 - 10} fontSize="9" fill="#4A4A46" textAnchor="middle">{el.tag}</text>
          </g>
        ))}
        {planMode === "piso" && elements.filter(el => el.type === "door" || el.type === "window").map(el => {
          const w = wallsById[el.wallId];
          const angleDeg = w ? (Math.atan2(w.y2 - w.y1, w.x2 - w.x1) * 180 / Math.PI) : 0;
          const widthPx = Math.max(6, (toNum(el.width, 0.8) / scale) * GRID);
          const isDoor = el.type === "door";
          const isSel = selectedId === el.id;
          const panels = Math.max(1, Math.round(toNum(el.panels, isDoor ? 1 : 2)));
          const panelWidthPx = widthPx / panels;
          return (
            <g key={el.id} transform={`rotate(${angleDeg} ${el.x} ${el.y})`}>
              <rect x={el.x - widthPx / 2 - 4} y={el.y - 14} width={widthPx + 8} height={28} fill="rgba(0,0,0,0.001)"
                style={{ cursor: tool === "selecionar" ? "grab" : "default" }} onMouseDown={e => beginDragOpening(el, e)} onTouchStart={e => beginDragOpening(el, e)} />
              <rect x={el.x - widthPx / 2} y={el.y - 3.5} width={widthPx} height={7}
                fill={isDoor ? "#4A4A46" : "#B9B6AE"} stroke={isSel ? "#726F68" : "#1B1E1A"} strokeWidth={isSel ? 2.5 : 1} opacity={isDoor ? 1 : 0.85}
                style={{ pointerEvents: "none" }} />
              {Array.from({ length: panels - 1 }).map((_, i) => (
                <line key={i} x1={el.x - widthPx / 2 + panelWidthPx * (i + 1)} y1={el.y - 3.5}
                  x2={el.x - widthPx / 2 + panelWidthPx * (i + 1)} y2={el.y + 3.5}
                  stroke="#1B1E1A" strokeWidth="1" style={{ pointerEvents: "none" }} />
              ))}
              <text x={el.x} y={el.y - 8} fontSize="9" fill="#6b6660" textAnchor="middle" transform={`rotate(${-angleDeg} ${el.x} ${el.y - 8})`}>{el.width}×{el.height} · {panels}f</text>
            </g>
          );
        })}
        {planMode === "forro" && elements.filter(el => el.type === "luminaria").map(el => {
          const dims = tool === "selecionar" ? luminariaDimensions(el) : null;
          return (
            <g key={el.id}>
              {dims?.wallDim && (
                <g>
                  <line x1={el.x} y1={el.y} x2={dims.wallDim.target.x} y2={dims.wallDim.target.y} stroke="#8A8880" strokeWidth="0.75" strokeDasharray="3,2" />
                  <text x={(el.x + dims.wallDim.target.x) / 2} y={(el.y + dims.wallDim.target.y) / 2 - 4} fontSize="7.5" fill="#4A4A46" textAnchor="middle"
                    style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); setEditingLumDim({ lumId: el.id, kind: "wall", refX: dims.wallDim.target.x, refY: dims.wallDim.target.y, value: pxToMeters(dims.wallDim.d) }); }}>
                    {pxToMeters(dims.wallDim.d)} ✎
                  </text>
                </g>
              )}
              {dims?.lumDim && (
                <g>
                  <line x1={el.x} y1={el.y} x2={dims.lumDim.target.x} y2={dims.lumDim.target.y} stroke="#B9B6AE" strokeWidth="0.75" strokeDasharray="1,3" />
                  <text x={(el.x + dims.lumDim.target.x) / 2} y={(el.y + dims.lumDim.target.y) / 2 + 8} fontSize="7.5" fill="#6B6862" textAnchor="middle"
                    style={{ cursor: "pointer" }} onClick={e => { e.stopPropagation(); setEditingLumDim({ lumId: el.id, kind: "lum", refX: dims.lumDim.target.x, refY: dims.lumDim.target.y, value: pxToMeters(dims.lumDim.d) }); }}>
                    {pxToMeters(dims.lumDim.d)} ✎
                  </text>
                </g>
              )}
              <circle cx={el.x} cy={el.y} r="6" fill="#E5E3DD" stroke={selectedId === el.id ? "#726F68" : "#4A4A46"} strokeWidth={selectedId === el.id ? 2.5 : 1} />
              <line x1={el.x - 8} y1={el.y} x2={el.x + 8} y2={el.y} stroke="#4A4A46" strokeWidth="1" />
              <line x1={el.x} y1={el.y - 8} x2={el.x} y2={el.y + 8} stroke="#4A4A46" strokeWidth="1" />
            </g>
          );
        })}
        {polygon.length > 0 && <polyline points={polygon.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#4A4A46" strokeWidth="1.5" strokeDasharray="4,3" />}
        {polygon.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#4A4A46" />)}
        {pending && <circle cx={pending.x} cy={pending.y} r="4.5" fill="#4A4A46" stroke="#1B1E1A" strokeWidth="1" />}
      </svg>

      {selected && (
        <div className="mt-2 p-2.5 rounded-lg" style={{ background: C.goldTint, border: `1px solid ${C.gold}` }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium" style={{ color: C.gold }}>
              {selected.type === "wall" ? `Parede ${selected.tag}` : selected.type === "door" ? `Porta ${selected.tag}` : selected.type === "window" ? `Janela ${selected.tag}` : selected.type === "room" ? `Ambiente: ${selected.name || "sem nome"}` : selected.type === "stair" ? `Escada ${selected.tag}` : "Luminária"}
            </span>
            <button onClick={() => setSelectedId(null)}><X size={14} color={C.gold} /></button>
          </div>

          {selected.type === "wall" && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap text-[11px]" style={{ color: C.chalk }}>
                <NumField value={selected.length} onCommit={v => setWallLengthDirect(selected.id, v)} unit="m comprimento" />
                <NumField value={selected.height} onChange={v => patchSelected({ height: v })} unit="m altura" />
                <ConditionSelect value={selected.condition} onChange={v => patchSelected({ condition: v })} />
              </div>
              {findMergeableWall(selected, elements) && (
                <button onClick={tryMergeSelected} className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded" style={{ ...heading, fontWeight: 600, background: C.gold, color: "#141311" }}>
                  <Link2 size={12} /> Unir com parede adjacente (mesmo alinhamento)
                </button>
              )}
              {!splittingWall ? (
                <button onClick={() => setSplittingWall({ value: (toNum(selected.length) / 2).toFixed(2) })} className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded" style={{ ...heading, fontWeight: 600, background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
                  <Scissors size={12} /> Cortar parede...
                </button>
              ) : (
                <div className="flex items-center gap-2 flex-wrap p-2 rounded" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <span className="text-[11px]" style={{ color: C.mute }}>Cortar a</span>
                  <input autoFocus type="text" inputMode="decimal" value={splittingWall.value} onChange={e => setSplittingWall({ value: e.target.value })}
                    onKeyDown={e => e.key === "Enter" && splitSelectedWallAt(splittingWall.value)}
                    className="w-16 px-1.5 py-1 rounded text-[11px] text-right" style={{ ...mono, background: "rgba(255,255,255,0.08)", color: C.chalk, border: `1px solid ${C.line}` }} />
                  <span className="text-[11px]" style={{ color: C.mute }}>m do início (parede tem {selected.length} m)</span>
                  <button onClick={() => splitSelectedWallAt(splittingWall.value)} className="text-[11px] px-2 py-1 rounded" style={{ ...heading, fontWeight: 600, background: C.gold, color: "#141311" }}>Cortar</button>
                  <button onClick={() => setSplittingWall(null)} style={{ color: C.mute }}><X size={13} /></button>
                </div>
              )}
            </div>
          )}
          {(selected.type === "door" || selected.type === "window") && (
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span style={{ color: C.mute }}>Família:</span>
              {selected.type === "door"
                ? <TypeSelect value={selected.doorType || DOOR_TYPES[0]} options={DOOR_TYPES} onChange={v => patchSelected({ doorType: v })} />
                : <TypeSelect value={selected.windowType || WINDOW_TYPES[0]} options={WINDOW_TYPES} onChange={v => patchSelected({ windowType: v })} />}
              <NumField value={selected.panels || 1} onChange={v => patchSelected({ panels: v })} unit="folhas" w="w-10" />
            </div>
          )}
          {(selected.type === "door" || selected.type === "window") && (
            <div className="flex items-center gap-2 flex-wrap text-[11px] mt-1.5">
              <span style={{ color: C.mute }}>Posição na parede:</span>
              <NumField value={openingPosM(selected)} onCommit={v => moveOpeningAlongWall(selected, toNum(v, 0))} unit="m do início" />
              <NumField value={selected.width} onChange={v => patchSelected({ width: v })} unit="larg." />
              <NumField value={selected.height} onChange={v => patchSelected({ height: v })} unit="alt." />
              {selected.type === "window" && <NumField value={selected.peitoril} onChange={v => patchSelected({ peitoril: v })} unit="peitoril" />}
            </div>
          )}
          {selected.type === "room" && (
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span style={{ color: C.mute }}>Piso:</span>
                <TypeSelect value={selected.floorFinish || "A definir"} options={FLOOR_TYPES} onChange={v => patchSelected({ floorFinish: v })} />
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span style={{ color: C.mute }}>Forro:</span>
                <TypeSelect value={selected.ceilingFinish || "A definir"} options={CEILING_TYPES} onChange={v => patchSelected({ ceilingFinish: v })} />
              </div>
              <button onClick={() => rotateRoomLabel(selected)} className="flex items-center gap-1 px-2 py-1 rounded" style={{ ...heading, fontWeight: 600, background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
                <RotateCcw size={11} /> Girar nome 90° (arraste pra reposicionar)
              </button>
            </div>
          )}
          {selected.type === "stair" && (
            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
              <span style={{ color: C.mute }}>Sobe até:</span>
              <select value={selected.toLevelId || ""} onChange={e => patchSelected({ toLevelId: e.target.value })} className="text-[11px] px-1.5 py-1 rounded"
                style={{ background: "rgba(255,255,255,0.08)", color: C.chalk, border: `1px solid ${C.line}` }}>
                <option value="">— selecione —</option>
                {(allLevels || []).filter(l => l.id !== level.id).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <NumField value={selected.width} onChange={v => patchSelected({ width: v })} unit="m largura" />
              <label className="flex items-center gap-1 w-full mt-1">
                <input type="checkbox" checked={!!selected.hasLanding} onChange={e => {
                  if (e.target.checked) {
                    const target = (allLevels || []).find(l => l.id === selected.toLevelId);
                    const totalRise = target ? (toNum(target.elevation) - toNum(level.elevation)) : 3;
                    patchSelected({ hasLanding: true, landingPos: 0.5, landingHeight: (totalRise * 0.5).toFixed(2) });
                  } else {
                    patchSelected({ hasLanding: false });
                  }
                }} />
                <span style={{ color: C.mute }}>Tem patamar</span>
              </label>
              {selected.hasLanding && (
                <>
                  <NumField value={selected.landingPos} onChange={v => patchSelected({ landingPos: Math.min(0.95, Math.max(0.05, toNum(v, 0.5))) })} unit="posição (0 a 1 no trajeto)" />
                  <NumField value={selected.landingHeight} onChange={v => patchSelected({ landingHeight: v })} unit="m — altura do patamar até o piso" />
                </>
              )}
            </div>
          )}
          <button onClick={() => {
            const ids = new Set([selected.id, ...(selected.type === "wall" ? elements.filter(e => (e.type === "door" || e.type === "window") && e.wallId === selected.id).map(e => e.id) : [])]);
            setDeletedStack(s => [...s, elements.filter(e => ids.has(e.id))]);
            commitElements(elements.filter(e => !ids.has(e.id)));
            setSelectedId(null);
          }} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded mt-2" style={{ color: C.bad, background: "rgba(193,84,63,0.12)" }}>
            <Trash2 size={11} /> Apagar este elemento
          </button>
        </div>
      )}

      <div className="flex items-center justify-end mt-2 flex-wrap gap-2">
        <div className="flex gap-1.5">
          <button onClick={undoLast} className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded" style={{ ...heading, fontWeight: 600, background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
            <Undo2 size={12} /> Recente
          </button>
          <button onClick={restoreLast} disabled={!deletedStack.length}
            className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded"
            style={{ ...heading, fontWeight: 600, background: deletedStack.length ? C.goldTint : C.panelAlt, color: deletedStack.length ? C.gold : C.muteDim, border: `1px solid ${deletedStack.length ? C.gold : C.line}`, opacity: deletedStack.length ? 1 : 0.5 }}>
            <RotateCcw size={12} /> Desfazer exclusão
          </button>
          <button onClick={clearAll} className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded" style={{ ...heading, fontWeight: 600, background: C.panelAlt, color: C.bad, border: `1px solid ${C.line}` }}>
            <Eraser size={12} /> Tudo
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- small building blocks ---------------------------------------------
function Pill({ active, label, Icon }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
      style={{ background: active ? C.goldTint : "rgba(255,255,255,0.05)", border: `1px solid ${active ? C.gold : "rgba(255,255,255,0.15)"}` }}>
      <Icon size={12} color={active ? C.gold : C.muteDim} />
      <span className="text-[11px]" style={{ ...heading, fontWeight: 700, letterSpacing: "0.03em", color: active ? C.gold : C.muteDim }}>{label}</span>
    </div>
  );
}
function StatRow({ label, value }) {
  return (
    <div className="flex justify-between text-xs py-1" style={{ borderBottom: `1px dashed ${C.line}` }}>
      <span style={{ color: C.mute }}>{label}</span>
      <span style={{ ...mono, color: C.chalk }}>{value}</span>
    </div>
  );
}
function NumField({ value, onChange, onCommit, w = "w-14", unit }) {
  const [draft, setDraft] = useState(null);
  useEffect(() => { setDraft(null); }, [value]);
  const display = draft !== null ? draft : value;
  return (
    <span className="flex items-center gap-1">
      <input type="text" inputMode="decimal" value={display}
        onChange={e => { if (onCommit) setDraft(e.target.value); else onChange(e.target.value); }}
        onBlur={() => { if (onCommit && draft !== null) onCommit(draft); }}
        onKeyDown={e => { if (onCommit && e.key === "Enter") { onCommit(draft ?? display); e.target.blur(); } }}
        className={`${w} px-1.5 py-1 rounded text-[11px] text-right`} style={{ ...mono, background: "rgba(255,255,255,0.06)", color: C.chalk, border: `1px solid ${C.line}` }} />
      {unit && <span className="text-[10px]" style={{ color: C.mute }}>{unit}</span>}
    </span>
  );
}
function TypeSelect({ value, options, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="text-[11px] px-1.5 py-1 rounded flex-1"
      style={{ background: "rgba(255,255,255,0.06)", color: C.chalk, border: `1px solid ${C.line}` }}>
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );
}
function ConditionSelect({ value, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="text-[10px] px-1 py-1 rounded"
      style={{ color: conditionColor(value), background: "rgba(255,255,255,0.06)", border: `1px solid ${C.line}` }}>
      {["Bom", "Regular", "Ruim", "A confirmar"].map(o => <option key={o}>{o}</option>)}
    </select>
  );
}

function WallRow({ el, adjacency, onPatch, onDelete }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-2 rounded flex-wrap" style={{ background: C.panelAlt, border: `1px solid ${C.line}` }}>
      <RectangleHorizontal size={14} color={C.mute} />
      <span className="text-xs font-semibold w-11" style={{ ...mono, color: C.gold }}>{el.tag}</span>
      <TypeSelect value={el.wallType || WALL_TYPES[0]} options={WALL_TYPES} onChange={v => onPatch({ wallType: v })} />
      <span className="text-[10px]" style={{ color: C.mute }}>{el.length} m ×</span>
      <NumField value={el.height} onChange={v => onPatch({ height: v })} unit="m altura" />
      <ConditionSelect value={el.condition} onChange={v => onPatch({ condition: v })} />
      <button onClick={onDelete}><Trash2 size={12} color={C.mute} /></button>
      <div className="w-full flex items-center gap-1.5 mt-1 flex-wrap">
        <span className="text-[10px] w-full" style={{ color: C.mute }}>Acabamento — visível no 3D (cada face pode ter um diferente):</span>
        <span className="text-[10px]" style={{ color: C.mute }}>Face 1 <span style={{ color: C.gold }}>→ {adjacency?.faceA}</span>:</span>
        <TypeSelect value={el.finishA || "A definir"} options={FINISH_TYPES} onChange={v => onPatch({ finishA: v })} />
        {el.finishA === "Pintura" && (
          <input type="color" value={el.paintColorA || "#E8E4DA"} onChange={e => onPatch({ paintColorA: e.target.value })}
            className="w-7 h-7 rounded" style={{ border: `1px solid ${C.line}`, background: "transparent" }} />
        )}
      </div>
      <div className="w-full flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px]" style={{ color: C.mute }}>Face 2 <span style={{ color: C.gold }}>→ {adjacency?.faceB}</span>:</span>
        <TypeSelect value={el.finishB || "A definir"} options={FINISH_TYPES} onChange={v => onPatch({ finishB: v })} />
        {el.finishB === "Pintura" && (
          <input type="color" value={el.paintColorB || "#E8E4DA"} onChange={e => onPatch({ paintColorB: e.target.value })}
            className="w-7 h-7 rounded" style={{ border: `1px solid ${C.line}`, background: "transparent" }} />
        )}
      </div>
    </div>
  );
}
function DoorRow({ el, onPatch, onDelete }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-2 rounded flex-wrap" style={{ background: C.panelAlt, border: `1px solid ${C.line}` }}>
      <DoorClosed size={14} color={C.mute} />
      <span className="text-xs font-semibold w-11" style={{ ...heading, fontWeight: 700, color: C.gold }}>{el.tag}</span>
      <TypeSelect value={el.doorType || DOOR_TYPES[0]} options={DOOR_TYPES} onChange={v => onPatch({ doorType: v })} />
      <NumField value={el.panels || 1} onChange={v => onPatch({ panels: v })} unit="folhas" w="w-10" />
      <NumField value={el.width} onChange={v => onPatch({ width: v })} unit="larg." />
      <NumField value={el.height} onChange={v => onPatch({ height: v })} unit="alt." />
      <ConditionSelect value={el.condition} onChange={v => onPatch({ condition: v })} />
      <button onClick={onDelete}><Trash2 size={12} color={C.mute} /></button>
    </div>
  );
}
function WindowRow({ el, onPatch, onDelete }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-2 rounded flex-wrap" style={{ background: C.panelAlt, border: `1px solid ${C.line}` }}>
      <Layers3 size={14} color={C.mute} />
      <span className="text-xs font-semibold w-11" style={{ ...heading, fontWeight: 700, color: C.gold }}>{el.tag}</span>
      <TypeSelect value={el.windowType || WINDOW_TYPES[0]} options={WINDOW_TYPES} onChange={v => onPatch({ windowType: v })} />
      <NumField value={el.panels || 2} onChange={v => onPatch({ panels: v })} unit="folhas" w="w-10" />
      <NumField value={el.width} onChange={v => onPatch({ width: v })} unit="larg." />
      <NumField value={el.height} onChange={v => onPatch({ height: v })} unit="alt." />
      <NumField value={el.peitoril} onChange={v => onPatch({ peitoril: v })} unit="peitoril" />
      <ConditionSelect value={el.condition} onChange={v => onPatch({ condition: v })} />
      <button onClick={onDelete}><Trash2 size={12} color={C.mute} /></button>
    </div>
  );
}
function FloorRow({ el, onPatch, onDelete }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-2 rounded flex-wrap" style={{ background: C.panelAlt, border: `1px solid ${C.line}` }}>
      <LayoutPanelTop size={14} color={C.mute} />
      <span className="text-xs font-semibold w-11" style={{ ...mono, color: C.gold }}>{el.tag}</span>
      <TypeSelect value={el.type} options={FLOOR_TYPES} onChange={v => onPatch({ type: v })} />
      <NumField value={el.area} onChange={v => onPatch({ area: v })} unit="m²" />
      <ConditionSelect value={el.condition} onChange={v => onPatch({ condition: v })} />
      <button onClick={onDelete}><Trash2 size={12} color={C.mute} /></button>
    </div>
  );
}

// ---- join / project screen -----------------------------------------------
function CornerBrackets({ active }) {
  if (!active) return null;
  const s = { position: "absolute", width: 14, height: 14, borderColor: C.gold };
  return (
    <>
      <div style={{ ...s, top: 6, left: 6, borderTop: "2px solid", borderLeft: "2px solid", borderTopLeftRadius: 4 }} />
      <div style={{ ...s, top: 6, right: 6, borderTop: "2px solid", borderRight: "2px solid", borderTopRightRadius: 4 }} />
      <div style={{ ...s, bottom: 6, left: 6, borderBottom: "2px solid", borderLeft: "2px solid", borderBottomLeftRadius: 4 }} />
      <div style={{ ...s, bottom: 6, right: 6, borderBottom: "2px solid", borderRight: "2px solid", borderBottomRightRadius: 4 }} />
    </>
  );
}

function JoinScreen({ onJoin }) {
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

  useEffect(() => {
    idbGet("projects-index").then(list => setSavedProjects(list || []));
  }, []);

  function goToBuilding() {
    const finalCode = genCode();
    setCode(finalCode);
    setStep("building");
  }
  async function handleJoinExisting(codeOverride) {
    setBusy(true);
    await onJoin((codeOverride || code).trim().toUpperCase(), role, null);
    setBusy(false);
  }
  async function handleCreateBuilding() {
    setBusy(true);
    await onJoin(code, role, building);
    setBusy(false);
  }

  if (step === "building") {
    return (
      <div className="relative w-full min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden" style={METAL_BG}>
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
    <div className="relative w-full min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden" style={METAL_BG}>
      <Watermark />
      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center gap-4 mb-7">
          <img src={SYMBOL_LOGO} alt="Braves BIM Field" style={{ height: 78, width: "auto" }} />
          <div className="text-center">
            <div style={{ ...heading, color: C.chalk, fontSize: "26px", letterSpacing: "0.01em", fontWeight: 800 }}>BRAVES BIM FIELD</div>
            <div className="text-[11px] mt-1.5" style={{ color: C.mute, letterSpacing: "0.18em" }}>PROJETOS E CONSTRUÇÕES EFICIENTES</div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-7">
          <div style={{ flex: 1, height: 1, background: C.line }} />
          <span className="text-sm" style={{ color: C.mute }}>Prancheta BIM de campo</span>
          <div style={{ flex: 1, height: 1, background: C.line }} />
        </div>

        <div className="text-sm mb-3" style={{ color: C.mute }}>Este dispositivo é um</div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {[{ id: "tablet", label: "Tablet", sub: "Para visualizar plantas", Icon: Tablet }, { id: "phone", label: "Celular", sub: "Para fotos de campo", Icon: Smartphone }].map(({ id, label, sub, Icon }) => (
            <button key={id} onClick={() => setRole(id)} className="relative py-7 rounded-2xl flex flex-col items-center gap-2.5"
              style={{ background: C.panel, border: `1px solid ${role === id ? "rgba(255,255,255,0.35)" : C.line}` }}>
              <CornerBrackets active={role === id} />
              <Icon size={30} color={role === id ? C.gold : C.chalk} strokeWidth={1.5} />
              <div className="text-center">
                <div className="text-base font-semibold" style={{ color: C.chalk }}>{label}</div>
                <div className="text-[11px] mt-0.5" style={{ color: C.mute }}>{sub}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <button onClick={() => setMode("create")} className="py-3.5 rounded-xl text-sm font-medium"
            style={{ background: mode === "create" ? C.goldTint : "transparent", color: mode === "create" ? C.gold : C.chalk, border: `1px solid ${mode === "create" ? "#FFFFFF" : C.line}` }}>Novo levantamento</button>
          <button onClick={() => setMode("join")} className="py-3.5 rounded-xl text-sm font-medium"
            style={{ background: mode === "join" ? C.goldTint : "transparent", color: mode === "join" ? C.gold : C.chalk, border: `1px solid ${mode === "join" ? "#FFFFFF" : C.line}` }}>Entrar com código</button>
        </div>
        {mode === "join" && (
          <>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="Código do projeto (ex: 7K2P)"
              className="w-full mb-3 px-3 py-2.5 rounded-xl text-sm uppercase" style={{ ...mono, background: C.panel, color: C.chalk, border: `1px solid ${C.line}` }} />
            {savedProjects.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] mb-1.5" style={{ color: C.mute, letterSpacing: "0.06em" }}>OU ESCOLHA UM LEVANTAMENTO SALVO NESTE APARELHO</div>
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
              </div>
            )}
          </>
        )}
        <button onClick={mode === "create" ? goToBuilding : () => handleJoinExisting()} disabled={busy || (mode === "join" && !code.trim())}
          className="w-full py-4 rounded-2xl text-base font-semibold flex items-center justify-center gap-2 mt-2"
          style={{ background: "#F2F1ED", color: "#141311", opacity: busy || (mode === "join" && !code.trim()) ? 0.6 : 1 }}>
          Continuar <ArrowUpRight size={18} style={{ transform: "rotate(45deg)" }} />
        </button>
        <p className="text-[11px] text-center mt-4" style={{ color: C.muteDim }}>
          O tablet abre o levantamento e gera um código. Abra o mesmo link no celular e digite o código
          para os dois dispositivos ficarem no mesmo ambiente, em tempo real. O código pode ser alterado depois, dentro do projeto.
        </p>
      </div>
    </div>
  );
}

// ---- main app --------------------------------------------------------------
export default function PranchetaBIM() {
  useLoadFonts();
  const [session, setSession] = useState(null);
  const [tab, setTab] = useState("ambientes");
  const [modeloSub, setModeloSub] = useState("elementos");
  const [rooms, setRooms] = useState([]);
  const [levels, setLevels] = useState([]);
  const [buildingInfo, setBuildingInfo] = useState(null);
  const [editingCode, setEditingCode] = useState(false);
  const [codeDraft, setCodeDraft] = useState("");
  const [ambientesLevelFilter, setAmbientesLevelFilter] = useState(null);
  const [roofs, setRoofs] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [croquiLevelId, setCroquiLevelId] = useState(null);
  const [view3dMode, setView3dMode] = useState("casa");
  const [view3dOpen, setView3dOpen] = useState(false);
  const [sectionCut, setSectionCut] = useState({ enabled: false, axis: "horizontal", position: 1.2 });
  const [view3dRoomId, setView3dRoomId] = useState(null);
  const [conn, setConn] = useState({ revit: false, cad: false });
  const [syncing, setSyncing] = useState(false);
  const [log, setLog] = useState([]);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: "", level: "", area: "", height: "2.70", use: "", condition: "A confirmar" });
  const [peers, setPeers] = useState(1);
  const [photoThumbs, setPhotoThumbs] = useState({});
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pending, setPending] = useState(0);
  const lastUpdatedAt = useRef(0);
  const fileInputRef = useRef(null);
  const photoTargetRoom = useRef(null);

  useEffect(() => {
    function goOnline() { setOnline(true); flushPending(); }
    function goOffline() { setOnline(false); }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => { window.removeEventListener("online", goOnline); window.removeEventListener("offline", goOffline); };
  }, [session]);

  useEffect(() => {
    (async () => {
      const savedLocal = await idbGet("last-session");
      const saved = savedLocal || (await safeGet("last-session", false));
      if (saved) {
        try { const s = typeof saved === "string" ? JSON.parse(saved) : saved; await joinProject(s.code, s.role, null, s.deviceId); }
        catch (e) { /* ignore */ }
      }
    })();
  }, []);

  async function joinProject(code, role, buildingInfo, existingDeviceId) {
    const deviceId = existingDeviceId || (await idbGet("device-id")) || (await safeGet("device-id", false)) || uid();
    await idbSet("device-id", deviceId);
    await idbSet("last-session", { code, role, deviceId });
    await safeSet("device-id", deviceId, false);
    await safeSet("last-session", JSON.stringify({ code, role, deviceId }), false);

    const localRaw = await idbGet(`project:${code}`);
    const cloudRaw = navigator.onLine ? await safeGet(`bim-project:${code}:data`, true) : null;
    let chosen = null;
    try { if (localRaw) chosen = localRaw; } catch (e) {}
    try {
      if (cloudRaw) {
        const cloudParsed = JSON.parse(cloudRaw);
        if (!chosen || (cloudParsed.updatedAt || 0) > (chosen.updatedAt || 0)) chosen = cloudParsed;
      }
    } catch (e) {}

    if (chosen) {
      setRooms(chosen.rooms || []); setLog(chosen.log || []);
      setLevels(chosen.levels || defaultLevels()); setRoofs(chosen.roofs || []);
      setBuildingInfo(chosen.buildingInfo || null);
      lastUpdatedAt.current = chosen.updatedAt || 0;
      await idbSet(`project:${code}`, chosen);
      await upsertProjectIndex(code, { name: chosen.buildingInfo?.name || "Sem nome", address: composeAddress(chosen.buildingInfo), roomsCount: (chosen.rooms || []).length, levelsCount: (chosen.levels || []).length });
      setCroquiLevelId((chosen.levels || [])[0]?.id || null);
    } else {
      const lv = buildLevelsFromCount(buildingInfo?.levelsCount || 1);
      const initial = {
        buildingInfo: buildingInfo || { name: "Levantamento", address: "", type: "Residencial", levelsCount: String(lv.length) },
        rooms: [],
        log: [{ id: uid(), t: new Date().toLocaleTimeString("pt-BR"), msg: `Levantamento "${buildingInfo?.name || "sem nome"}" criado neste ${role === "tablet" ? "tablet" : "celular"}.`, kind: "info" }],
        levels: lv, roofs: [], updatedAt: Date.now(),
      };
      setRooms(initial.rooms); setLog(initial.log); setLevels(initial.levels); setRoofs(initial.roofs);
      setBuildingInfo(initial.buildingInfo);
      lastUpdatedAt.current = initial.updatedAt;
      setCroquiLevelId(lv[0].id);
      await idbSet(`project:${code}`, initial);
      await safeSet(`bim-project:${code}:data`, JSON.stringify(initial), true);
      await upsertProjectIndex(code, { name: initial.buildingInfo.name, address: composeAddress(initial.buildingInfo), roomsCount: 0, levelsCount: lv.length });
    }
    setSession({ code, role, deviceId });
    setTab(buildingInfo ? "croqui" : "ambientes");
  }

  async function flushPending() {
    if (!session) return;
    const local = await idbGet(`project:${session.code}`);
    if (!local) return;
    const ok = await safeSet(`bim-project:${session.code}:data`, JSON.stringify(local), true);
    if (ok) { setPending(0); pushLog("Conexão restabelecida — alterações do dispositivo sincronizadas com o projeto.", "done"); }
  }

  async function renameProjectCode(newCodeRaw) {
    const newCode = newCodeRaw.trim().toUpperCase();
    if (!newCode || newCode === session.code) return;
    const existing = await idbGet(`project:${newCode}`);
    if (existing) { pushLog(`Já existe um levantamento salvo com o código "${newCode}". Escolha outro.`, "info"); return; }
    const oldCode = session.code;
    const current = await idbGet(`project:${oldCode}`);
    if (!current) return;
    await idbSet(`project:${newCode}`, current);
    await safeSet(`bim-project:${newCode}:data`, JSON.stringify(current), true);
    await idbSet("last-session", { code: newCode, role: session.role, deviceId: session.deviceId });
    await safeSet("last-session", JSON.stringify({ code: newCode, role: session.role, deviceId: session.deviceId }), false);
    await upsertProjectIndex(newCode, { name: buildingInfo?.name || "Sem nome", address: composeAddress(buildingInfo), roomsCount: rooms.length, levelsCount: levels.length });
    await removeFromProjectIndex(oldCode);
    await safeDelete(`bim-project:${oldCode}:data`, true);
    setSession(s => ({ ...s, code: newCode }));
    pushLog(`Código do projeto alterado de "${oldCode}" para "${newCode}".`, "info");
  }

  async function switchProject() {
    await idbSet("last-session", null);
    await safeSet("last-session", "", false);
    setSession(null);
    setRooms([]); setLevels([]); setRoofs([]); setLog([]); setBuildingInfo(null);
    setActiveRoomId(null); setCroquiLevelId(null); setTab("ambientes");
  }

  useEffect(() => {
    if (!session) return;
    let stopped = false;
    async function heartbeat() {
      if (!navigator.onLine) return;
      await safeSet(`bim-project:${session.code}:presence:${session.deviceId}`, JSON.stringify({ role: session.role, ts: Date.now() }), true);
      const keys = await safeList(`bim-project:${session.code}:presence:`, true);
      let count = 0;
      for (const k of keys) { const v = await safeGet(k, true); if (v) { try { if (Date.now() - JSON.parse(v).ts < 20000) count++; } catch (e) {} } }
      if (!stopped) setPeers(Math.max(count, 1));
    }
    async function poll() {
      if (!navigator.onLine) return;
      const raw = await safeGet(`bim-project:${session.code}:data`, true);
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if ((parsed.updatedAt || 0) > lastUpdatedAt.current) {
          lastUpdatedAt.current = parsed.updatedAt;
          setRooms(parsed.rooms || []); setLog(parsed.log || []);
          setLevels(parsed.levels || []); setRoofs(parsed.roofs || []);
          if (parsed.buildingInfo) setBuildingInfo(parsed.buildingInfo);
          idbSet(`project:${session.code}`, parsed);
        }
      } catch (e) { /* ignore */ }
    }
    heartbeat(); poll();
    const hb = setInterval(heartbeat, 6000);
    const pl = setInterval(poll, 4000);
    return () => { stopped = true; clearInterval(hb); clearInterval(pl); };
  }, [session]);

  async function persist(next) {
    const updatedAt = Date.now();
    lastUpdatedAt.current = updatedAt;
    const payload = { buildingInfo, ...next, updatedAt };
    await idbSet(`project:${session.code}`, payload);
    upsertProjectIndex(session.code, { name: payload.buildingInfo?.name || "Sem nome", address: composeAddress(payload.buildingInfo), roomsCount: (payload.rooms || []).length, levelsCount: (payload.levels || []).length });
    if (navigator.onLine) {
      const ok = await safeSet(`bim-project:${session.code}:data`, JSON.stringify(payload), true);
      setPending(p => (ok ? 0 : p + 1));
    } else {
      setPending(p => p + 1);
    }
  }
  function pushLog(msg, kind = "ok") {
    setLog(l => { const next = [{ id: uid(), t: new Date().toLocaleTimeString("pt-BR"), msg, kind }, ...l]; persist({ rooms, log: next, levels, roofs }); return next; });
  }
  function updateRooms(fn) { setRooms(rs => { const next = fn(rs); persist({ rooms: next, log, levels, roofs }); return next; }); }
  function updateLevels(fn) { setLevels(ls => { const next = fn(ls); persist({ rooms, log, levels: next, roofs }); return next; }); }
  function updateRoofs(fn) { setRoofs(rs => { const next = fn(rs); persist({ rooms, log, levels, roofs: next }); return next; }); }

  const activeRoom = rooms.find(r => r.id === activeRoomId) || null;
  const croquiLevel = levels.find(l => l.id === croquiLevelId) || levels[0] || null;

  function addRoom() {
    if (!newRoom.name.trim()) return;
    const room = { id: uid(), ...newRoom, level: newRoom.level || (levels[0]?.name || ""), notes: "", photos: 0, geo: null, floors: [] };
    updateRooms(r => [...r, room]);
    setShowNewRoom(false);
    setNewRoom({ name: "", level: "", area: "", height: "2.70", use: "", condition: "A confirmar" });
    pushLog(`Ambiente "${room.name}" registrado por ${session.role === "tablet" ? "tablet" : "celular"} (${room.level})`, "info");
  }
  function addFloor(roomId) {
    updateRooms(rs => rs.map(r => r.id === roomId ? { ...r, floors: [...r.floors, { id: uid(), tag: `PS-${r.floors.length + 1}`, type: FLOOR_TYPES[0], area: r.area, espessura: "0.02", condition: "A confirmar" }] } : r));
  }
  function removeFloor(roomId, id) {
    updateRooms(rs => rs.map(r => r.id === roomId ? { ...r, floors: r.floors.filter(f => f.id !== id) } : r));
  }
  function patchFloor(roomId, id, patch) {
    updateRooms(rs => rs.map(r => r.id === roomId ? { ...r, floors: r.floors.map(f => f.id === id ? { ...f, ...patch } : f) } : r));
  }

  function updateLevelSketch(levelId, newElements, newScale) {
    updateLevels(ls => ls.map(l => l.id === levelId ? { ...l, sketchElements: newElements, sketchScale: newScale ?? l.sketchScale } : l));
  }
  function updateLevelMeta(levelId, patch) {
    updateLevels(ls => ls.map(l => l.id === levelId ? { ...l, ...patch } : l));
  }
  function nameRoomPolygon(levelId, elementId, trimmed) {
    const level = levels.find(l => l.id === levelId);
    if (!level) return;
    const poly = (level.sketchElements || []).find(e => e.id === elementId);
    if (!poly) return;
    if (!trimmed) {
      updateLevels(ls => ls.map(l => l.id !== levelId ? l : { ...l, sketchElements: l.sketchElements.map(e => e.id === elementId ? { ...e, name: undefined, roomId: null } : e) }));
      return;
    }
    const existing = rooms.find(r => r.level === level.name && r.name.toLowerCase() === trimmed.toLowerCase() && r.id !== poly.roomId);
    let roomId = poly.roomId;
    if (existing) {
      roomId = existing.id;
      updateRooms(rs => rs.map(r => r.id === existing.id ? { ...r, area: String(poly.area) } : r));
    } else if (roomId) {
      updateRooms(rs => rs.map(r => r.id === roomId ? { ...r, name: trimmed, area: String(poly.area) } : r));
    } else {
      const newR = { id: uid(), name: trimmed, level: level.name, area: String(poly.area), height: String(level.wallHeightDefault || "2.80"), use: "", condition: "A confirmar", notes: "", photos: 0, geo: null, floors: [] };
      roomId = newR.id;
      updateRooms(rs => [...rs, newR]);
    }
    updateLevels(ls => ls.map(l => l.id !== levelId ? l : { ...l, sketchElements: l.sketchElements.map(e => e.id === elementId ? { ...e, name: trimmed, roomId } : e) }));
    pushLog(`Ambiente "${trimmed}" identificado no croqui (${level.name}).`, "info");
  }
  function updateLevelElement(levelId, elementId, patch) {
    updateLevels(ls => ls.map(l => l.id !== levelId ? l : { ...l, sketchElements: l.sketchElements.map(e => e.id === elementId ? { ...e, ...patch } : e) }));
  }
  function removeLevelElement(levelId, elementId) {
    updateLevels(ls => ls.map(l => l.id !== levelId ? l : { ...l, sketchElements: l.sketchElements.filter(e => e.id !== elementId) }));
  }

  function markLocation(roomId) {
    if (!navigator.geolocation) { pushLog("Dispositivo sem GPS disponível.", "info"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const geo = { lat: pos.coords.latitude.toFixed(6), lon: pos.coords.longitude.toFixed(6) };
        updateRooms(rs => rs.map(r => r.id === roomId ? { ...r, geo } : r));
        pushLog(`Localização registrada para "${rooms.find(r => r.id === roomId)?.name}" (${geo.lat}, ${geo.lon})`, "info");
      },
      () => pushLog("Não foi possível obter a localização (permissão negada ou sem sinal de GPS).", "info")
    );
  }
  function openCamera(roomId) { photoTargetRoom.current = roomId; fileInputRef.current?.click(); }
  function handlePhotoCaptured(e) {
    const file = e.target.files?.[0];
    const roomId = photoTargetRoom.current;
    if (!file || !roomId) return;
    const url = URL.createObjectURL(file);
    setPhotoThumbs(pt => ({ ...pt, [roomId]: [...(pt[roomId] || []), url] }));
    updateRooms(rs => rs.map(r => r.id === roomId ? { ...r, photos: r.photos + 1 } : r));
    pushLog(`Foto anexada ao ambiente "${rooms.find(r => r.id === roomId)?.name}" via ${session.role === "phone" ? "celular" : "tablet"}.`, "info");
    e.target.value = "";
  }
  function addLevel() {
    updateLevels(ls => [...ls, { id: uid(), name: `Nível ${ls.length + 1}`, elevation: "0.00", wallHeightDefault: "2.80", sketchScale: 0.5, sketchElements: [] }]);
  }
  function addRoof() {
    updateRoofs(rs => [...rs, { id: uid(), name: `Cobertura ${rs.length + 1}`, level: levels[levels.length - 1]?.name || "", aguas: [{ id: uid(), inclinacao: "30", area: "" }] }]);
  }
  function addAgua(roofId) { updateRoofs(rs => rs.map(r => r.id === roofId ? { ...r, aguas: [...r.aguas, { id: uid(), inclinacao: "30", area: "" }] } : r)); }
  function removeAgua(roofId, aguaId) { updateRoofs(rs => rs.map(r => r.id === roofId ? { ...r, aguas: r.aguas.filter(a => a.id !== aguaId) } : r)); }

  function runSync() {
    setSyncing(true);
    pushLog("Iniciando sincronização com Revit e exportação CAD…", "info");
    let delay = 500;
    setConn({ revit: false, cad: false });
    levels.forEach(l => {
      delay += 300;
      setTimeout(() => { setConn(c => ({ ...c, revit: true })); pushLog(`Revit ← Level "${l.name}" (cota ${l.elevation} m)`, "revit"); }, delay);
      (l.sketchElements || []).forEach(el => {
        delay += 180;
        let msg;
        if (el.type === "wall") msg = `${el.tag} · Parede ${el.length} m × ${el.height} m → A-WALL`;
        else if (el.type === "door") msg = `${el.tag} · Porta ${el.width}×${el.height} m → A-DOOR`;
        else if (el.type === "window") msg = `${el.tag} · Janela ${el.width}×${el.height} m (peitoril ${el.peitoril} m) → A-GLAZ`;
        else if (el.type === "room") msg = `Contorno "${el.name || "sem vínculo"}" · ${el.area} m² → A-AREA`;
        if (msg) setTimeout(() => { pushLog(`CAD/Revit ← ${msg}`, "cad"); setConn(c => ({ ...c, cad: true })); }, 0);
      });
    });
    rooms.forEach(r => {
      delay += 300;
      setTimeout(() => { pushLog(`Revit ← Room "${r.name}" (Nível: ${r.level}, Área: ${r.area || "—"} m²)`, "revit"); }, delay);
      r.floors.forEach(f => { delay += 150; setTimeout(() => { pushLog(`CAD ← ${f.tag} · Piso ${f.type} · ${f.area} m² → A-FLOOR`, "cad"); }, delay); });
    });
    roofs.forEach(r => {
      delay += 350;
      setTimeout(() => { pushLog(`Revit ← Roof "${r.name}" — ${r.aguas.length} água(s): ${r.aguas.map(a => a.inclinacao + '°').join(", ")}`, "revit"); }, delay);
    });
    delay += 500;
    setTimeout(() => { pushLog("Sincronização concluída — modelo Revit e desenho CAD atualizados.", "done"); setSyncing(false); }, delay);
  }
  function buildSchema() {
    return {
      projeto: { empresa: "BRAVES", codigo: session?.code, data: new Date().toISOString() },
      niveis: levels.map(l => ({ nome: l.name, cota: l.elevation, pe_direito_padrao: l.wallHeightDefault, escala_m_por_quadro: l.sketchScale, elementos: l.sketchElements })),
      coberturas: roofs,
      ambientes: rooms.map(r => ({ nome: r.name, nivel: r.level, area_m2: r.area, uso: r.use, condicao: r.condition, observacoes: r.notes, geo: r.geo, fotos: r.photos, pisos: r.floors })),
    };
  }
  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
  function exportJSON() { download("levantamento_bim.json", JSON.stringify(buildSchema(), null, 2), "application/json"); pushLog("Arquivo levantamento_bim.json exportado.", "info"); }
  function exportCSV() {
    const rows = [["Nível/Ambiente", "Tag", "Categoria", "Tipo", "Dimensões", "Condição"]];
    levels.forEach(l => (l.sketchElements || []).forEach(el => {
      if (el.type === "wall") rows.push([l.name, el.tag, "Parede", el.wallType, `${el.length}×${el.height} m`, el.condition]);
      if (el.type === "door") rows.push([l.name, el.tag, "Porta", el.doorType, `${el.width}×${el.height} m`, el.condition]);
      if (el.type === "window") rows.push([l.name, el.tag, "Janela", el.windowType, `${el.width}×${el.height} m (peit. ${el.peitoril})`, el.condition]);
    }));
    rooms.forEach(r => r.floors.forEach(f => rows.push([r.name, f.tag, "Piso", f.type, `${f.area} m²`, f.condition])));
    download("levantamento_elementos.csv", rows.map(r => r.join(";")).join("\n"), "text/csv");
    pushLog("Arquivo levantamento_elementos.csv exportado.", "info");
  }

  if (!session) return <JoinScreen onJoin={joinProject} />;

  const totalArea = rooms.reduce((s, r) => s + (toNum(r.area, 0)), 0).toFixed(1);
  const allEls = levels.flatMap(l => l.sketchElements || []);
  const totalElements = allEls.length + rooms.reduce((s, r) => s + r.floors.length, 0);

  const TABS = [
    { id: "ambientes", label: "Ambientes", Icon: LayoutGrid },
    { id: "croqui", label: "Croqui", Icon: Pencil },
    { id: "modelo", label: "Modelo", Icon: GitBranch },
    { id: "sync", label: "Sincronização", Icon: RefreshCw },
  ];

  return (
    <div className="braves-app-root relative w-full h-dvh overflow-hidden flex flex-col" style={{ ...METAL_BG, fontFamily: "'Plus Jakarta Sans','Inter','Helvetica Neue',sans-serif" }}>
      <Watermark />
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handlePhotoCaptured} />

      <div className="relative px-4 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark size={30} />
            <div>
              <div className="text-base font-semibold leading-tight" style={{ ...heading, color: C.chalk, fontSize: "17px" }}>{buildingInfo?.name || "BRAVES BIM FIELD"}</div>
              <div className="text-[11px] -mt-0.5 flex items-center gap-1" style={{ color: C.mute }}>
                {session.role === "tablet" ? <Tablet size={11} /> : <Smartphone size={11} />}
                {editingCode ? (
                  <>
                    <input autoFocus value={codeDraft} onChange={e => setCodeDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { renameProjectCode(codeDraft); setEditingCode(false); } if (e.key === "Escape") setEditingCode(false); }}
                      className="w-16 px-1 rounded text-[11px] uppercase" style={{ ...mono, background: "rgba(255,255,255,0.1)", color: C.chalk, border: `1px solid ${C.gold}` }} />
                    <button onClick={() => { renameProjectCode(codeDraft); setEditingCode(false); }}><CheckCircle2 size={12} color={C.gold} /></button>
                  </>
                ) : (
                  <button onClick={() => { setCodeDraft(session.code); setEditingCode(true); }} style={{ ...heading, fontWeight: 700 }} className="underline decoration-dotted">{session.code}</button>
                )}
                <button onClick={() => navigator.clipboard?.writeText(session.code)}><Copy size={10} /></button>
                <button onClick={switchProject} className="ml-1.5 flex items-center gap-0.5" style={{ ...heading, fontWeight: 600, color: C.gold }}><Home size={10} /> Início</button>
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex items-center gap-1 px-2 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${C.line}` }}>
              <Users size={12} color={C.gold} />
              <span className="text-[11px]" style={{ ...mono, color: C.chalk }}>{peers}</span>
            </div>
            <Pill active={conn.revit} label="REVIT" Icon={conn.revit ? Wifi : WifiOff} />
            <Pill active={conn.cad} label="CAD" Icon={conn.cad ? Wifi : WifiOff} />
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <Pill active={online} label={online ? "ONLINE" : "SEM SINAL — SALVANDO NO APARELHO"} Icon={online ? Wifi : WifiOff} />
          {pending > 0 && <span className="text-[10px] px-2 py-1 rounded-full" style={{ ...heading, fontWeight: 600, color: C.bad, background: "rgba(193,84,63,0.14)", border: "1px solid rgba(193,84,63,0.4)" }}>{pending} pendente(s)</span>}
        </div>
        <div className="mt-3 flex gap-4 text-xs" style={{ color: C.mute }}>
          <span style={{ ...heading, fontWeight: 600 }}>{rooms.length} ambientes</span><span>·</span>
          <span style={{ ...heading, fontWeight: 600 }}>{totalArea} m²</span><span>·</span>
          <span style={{ ...heading, fontWeight: 600 }}>{totalElements} elementos</span><span>·</span>
          <span style={{ ...heading, fontWeight: 600 }}>{levels.length} níveis</span>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 p-4 overflow-y-auto">
        {tab === "ambientes" && !activeRoom && !ambientesLevelFilter && (
          <div className="space-y-2">
            {levels.map(l => {
              const roomsHere = rooms.filter(r => r.level === l.name);
              const totalArea = roomsHere.reduce((s, r) => s + (toNum(r.area, 0)), 0);
              return (
                <button key={l.id} onClick={() => setAmbientesLevelFilter(l.name)}
                  className="w-full text-left p-3 rounded-lg flex items-center gap-3"
                  style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                  <div className="w-9 h-9 rounded flex items-center justify-center" style={{ background: C.panelAlt }}>
                    <Layers3 size={16} color={C.gold} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium" style={{ color: C.chalk }}>{l.name}</div>
                    <div className="text-[11px]" style={{ color: C.mute }}>{roomsHere.length} ambiente(s) · {totalArea.toFixed(1)} m² de área construída · cota {l.elevation} m</div>
                  </div>
                  <ChevronRight size={16} color={C.mute} />
                </button>
              );
            })}
            {levels.length === 0 && <div className="text-[11px] italic text-center py-6" style={{ color: C.mute }}>Nenhum nível criado ainda.</div>}
          </div>
        )}

        {tab === "ambientes" && !activeRoom && ambientesLevelFilter && (
          <div className="space-y-2">
            <button onClick={() => setAmbientesLevelFilter(null)} className="text-xs mb-1 flex items-center gap-1" style={{ color: C.mute }}>← Voltar aos níveis</button>
            <div className="text-xs font-semibold mb-1" style={{ color: C.gold }}>{ambientesLevelFilter}</div>
            {rooms.filter(r => r.level === ambientesLevelFilter).map(r => (
              <button key={r.id} onClick={() => setActiveRoomId(r.id)}
                className="w-full text-left p-3 rounded-lg flex items-center gap-3"
                style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                <div className="w-9 h-9 rounded flex items-center justify-center" style={{ background: C.panelAlt }}>
                  <Building2 size={16} color={C.gold} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium" style={{ color: C.chalk }}>{r.name}</div>
                  <div className="text-[11px] flex items-center gap-1.5" style={{ color: C.mute }}>
                    <span>{r.area ? `${r.area} m²` : "área não definida"}</span>
                    {r.photos > 0 && <span className="flex items-center gap-0.5"><Camera size={10} />{r.photos}</span>}
                    {r.geo && <MapPin size={10} />}
                  </div>
                </div>
                <span className="text-[10px] px-2 py-1 rounded" style={{ color: conditionColor(r.condition), background: "rgba(255,255,255,0.06)" }}>{r.condition}</span>
                <ChevronRight size={16} color={C.mute} />
              </button>
            ))}

            {showNewRoom ? (
              <div className="p-3 rounded-lg space-y-2" style={{ background: C.panel, border: `1px solid ${C.gold}` }}>
                <input placeholder="Nome do ambiente" value={newRoom.name} onChange={e => setNewRoom({ ...newRoom, name: e.target.value })}
                  className="w-full px-2 py-2 rounded text-sm" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
                <div className="grid grid-cols-3 gap-2">
                  <select value={newRoom.level || ambientesLevelFilter} onChange={e => setNewRoom({ ...newRoom, level: e.target.value })}
                    className="px-2 py-2 rounded text-xs" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
                    {levels.map(l => <option key={l.id}>{l.name}</option>)}
                  </select>
                  <input placeholder="Área m² (opcional)" value={newRoom.area} onChange={e => setNewRoom({ ...newRoom, area: e.target.value })}
                    className="px-2 py-2 rounded text-xs" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
                  <input placeholder="Pé-direito" value={newRoom.height} onChange={e => setNewRoom({ ...newRoom, height: e.target.value })}
                    className="px-2 py-2 rounded text-xs" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
                </div>
                <input placeholder="Uso (social, serviço, técnico…)" value={newRoom.use} onChange={e => setNewRoom({ ...newRoom, use: e.target.value })}
                  className="w-full px-2 py-2 rounded text-xs" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
                <div className="flex gap-2">
                  <button onClick={addRoom} className="flex-1 py-2 rounded text-sm font-medium" style={{ background: C.gold, color: "#141311" }}>Registrar ambiente</button>
                  <button onClick={() => setShowNewRoom(false)} className="px-3 py-2 rounded" style={{ background: C.panelAlt, color: C.mute }}><X size={16} /></button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setNewRoom({ ...newRoom, level: ambientesLevelFilter }); setShowNewRoom(true); }} className="w-full py-3 rounded-lg flex items-center justify-center gap-2 text-sm" style={{ border: `1px dashed ${C.line}`, color: C.mute }}>
                <Plus size={16} /> Novo ambiente
              </button>
            )}
            <p className="text-[11px] text-center pt-1" style={{ color: C.muteDim }}>Dica: desenhar o contorno na aba Croqui (ferramenta Ambiente) cria e mede o ambiente automaticamente.</p>
          </div>
        )}

        {tab === "ambientes" && activeRoom && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setActiveRoomId(null)} className="text-xs flex items-center gap-1" style={{ color: C.mute }}>← Voltar aos ambientes</button>
              <button onClick={() => { setActiveRoomId(null); setTab("ambientes"); }} className="text-xs flex items-center gap-1 px-2 py-1 rounded" style={{ color: C.gold, background: C.goldTint }}><Home size={12} /> Início</button>
            </div>
            <div className="p-3 rounded-lg mb-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-lg font-semibold mb-2" style={{ ...heading, color: C.chalk, fontSize: "20px" }}>{activeRoom.name}</div>
              <StatRow label="Nível" value={activeRoom.level} />
              <StatRow label="Área" value={activeRoom.area ? `${activeRoom.area} m²` : "ainda não definida"} />
              <StatRow label="Uso" value={activeRoom.use || "—"} />
              <StatRow label="Condição geral" value={activeRoom.condition} />
              {activeRoom.geo && <StatRow label="GPS" value={`${activeRoom.geo.lat}, ${activeRoom.geo.lon}`} />}
              <div className="mt-2">
                <div className="text-[11px] mb-1" style={{ color: C.mute }}>OBSERVAÇÕES DE CAMPO</div>
                <textarea value={activeRoom.notes} placeholder="Anotar patologias, divergências com projeto, etc."
                  onChange={e => updateRooms(rs => rs.map(r => r.id === activeRoom.id ? { ...r, notes: e.target.value } : r))}
                  className="w-full text-xs p-2 rounded" rows={2} style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => openCamera(activeRoom.id)} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
                  <ImagePlus size={13} /> {activeRoom.photos} foto(s) — tirar nova
                </button>
                <button onClick={() => markLocation(activeRoom.id)} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
                  <LocateFixed size={13} /> Marcar local
                </button>
              </div>
              {(photoThumbs[activeRoom.id] || []).length > 0 && (
                <div className="flex gap-1.5 mt-2 overflow-x-auto">
                  {photoThumbs[activeRoom.id].map((url, i) => <img key={i} src={url} alt="" className="w-14 h-14 rounded object-cover" style={{ border: `1px solid ${C.line}` }} />)}
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg mb-3 flex items-center justify-between" style={{ background: C.panelAlt, border: `1px solid ${C.line}` }}>
              <span className="text-[11px]" style={{ color: C.mute }}>Paredes, portas e janelas agora se desenham na aba Croqui (nível inteiro, geometria real).</span>
              <button onClick={() => { const lvl = levels.find(l => l.name === activeRoom.level); if (lvl) setCroquiLevelId(lvl.id); setTab("croqui"); }}
                className="text-[11px] px-2.5 py-1.5 rounded shrink-0 ml-2" style={{ background: C.goldTint, color: C.gold }}>Ir ao Croqui</button>
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium" style={{ color: C.chalk }}>Pisos</span>
                <button onClick={() => addFloor(activeRoom.id)} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded" style={{ color: C.gold, background: C.goldTint }}>
                  <Plus size={11} /> adicionar
                </button>
              </div>
              <div className="space-y-1.5">
                {activeRoom.floors.length === 0 && <div className="text-[11px] italic" style={{ color: C.mute }}>Nenhum piso registrado.</div>}
                {activeRoom.floors.map(f => <FloorRow key={f.id} el={f} onPatch={p => patchFloor(activeRoom.id, f.id, p)} onDelete={() => removeFloor(activeRoom.id, f.id)} />)}
              </div>
            </div>
          </div>
        )}

        {tab === "croqui" && croquiLevel && (
          <div className="p-3 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium" style={{ color: C.chalk }}>Croqui do nível:</span>
              <select value={croquiLevel.id} onChange={e => setCroquiLevelId(e.target.value)} className="text-xs px-2 py-1 rounded flex-1"
                style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
                {levels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <VectorSketch level={croquiLevel} allLevels={levels} rooms={rooms.filter(r => r.level === croquiLevel.name)}
              onChange={(els, sc) => updateLevelSketch(croquiLevel.id, els, sc)}
              onMeta={(patch) => updateLevelMeta(croquiLevel.id, patch)}
              onNameRoom={(elId, name) => nameRoomPolygon(croquiLevel.id, elId, name)} />
          </div>
        )}
        {tab === "croqui" && !croquiLevel && <div className="text-center text-sm py-10" style={{ color: C.mute }}>Crie um nível na aba Modelo → Níveis para começar a desenhar.</div>}

        {tab === "modelo" && (
          <div>
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {[{ id: "elementos", label: "Elementos" }, { id: "pisos", label: "Pisos" }, { id: "coberturas", label: "Coberturas" }, { id: "niveis", label: "Níveis" }, { id: "3d", label: "3D" }].map(s => (
                <button key={s.id} onClick={() => setModeloSub(s.id)} className="px-2.5 py-1.5 rounded text-xs"
                  style={{ ...heading, fontWeight: 600, background: modeloSub === s.id ? C.goldTint : C.panelAlt, color: modeloSub === s.id ? C.gold : C.mute, border: `1px solid ${modeloSub === s.id ? "#FFFFFF" : C.line}` }}>
                  {s.label}
                </button>
              ))}
            </div>

            {modeloSub === "elementos" && (
              <div className="space-y-4">
                {levels.map(l => (
                  <div key={l.id}>
                    <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: C.gold }}>
                      <ChevronDown size={12} /> {l.name.toUpperCase()} <span style={{ color: C.mute, ...mono, fontWeight: 400 }}>· cota {l.elevation} m</span>
                    </div>
                    <div className="space-y-1.5 mb-2">
                      {(l.sketchElements || []).filter(e => e.type === "wall").map(el => <WallRow key={el.id} el={el} adjacency={wallRoomAdjacency(l, el)} onPatch={p => updateLevelElement(l.id, el.id, p)} onDelete={() => removeLevelElement(l.id, el.id)} />)}
                      {(l.sketchElements || []).filter(e => e.type === "door").map(el => <DoorRow key={el.id} el={el} onPatch={p => updateLevelElement(l.id, el.id, p)} onDelete={() => removeLevelElement(l.id, el.id)} />)}
                      {(l.sketchElements || []).filter(e => e.type === "window").map(el => <WindowRow key={el.id} el={el} onPatch={p => updateLevelElement(l.id, el.id, p)} onDelete={() => removeLevelElement(l.id, el.id)} />)}
                      {(l.sketchElements || []).filter(e => e.type === "wall" || e.type === "door" || e.type === "window").length === 0 && (
                        <div className="text-[11px] italic" style={{ color: C.mute }}>Nada desenhado ainda neste nível.</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {modeloSub === "pisos" && (
              <div className="space-y-4">
                <p className="text-[11px]" style={{ color: C.mute }}>Lance o piso de cada ambiente aqui — tipo de revestimento, área e condição.</p>
                {rooms.length === 0 && (
                  <div className="text-[11px] italic p-3 rounded-lg" style={{ color: C.mute, background: C.panelAlt, border: `1px solid ${C.line}` }}>
                    Ainda não há ambientes nomeados. Vá ao Croqui, feche um contorno com a ferramenta "Ambiente" e dê um nome — ele aparece aqui na sequência.
                  </div>
                )}
                {rooms.map(r => (
                  <div key={r.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium" style={{ color: C.chalk }}>{r.name} <span style={{ color: C.mute, fontWeight: 400 }}>· {r.level}</span></span>
                      <button onClick={() => addFloor(r.id)} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded" style={{ color: C.gold, background: C.goldTint }}>
                        <Plus size={11} /> novo piso
                      </button>
                    </div>
                    <div className="space-y-1.5 mb-2">
                      {r.floors.length === 0 && <div className="text-[11px] italic" style={{ color: C.mute }}>Nenhum piso registrado.</div>}
                      {r.floors.map(f => <FloorRow key={f.id} el={f} onPatch={p => patchFloor(r.id, f.id, p)} onDelete={() => removeFloor(r.id, f.id)} />)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {modeloSub === "coberturas" && (
              <div className="space-y-3">
                <div className="p-2.5 rounded-lg text-[11px]" style={{ background: C.panelAlt, border: `1px solid ${C.line}`, color: C.mute }}>
                  Cada água vira um plano de telhado no Revit (Roof by Footprint) com a inclinação lançada aqui — e o comprimento de rufo/calha entra direto na planilha de quantitativos exportada.
                </div>
                {roofs.map(roof => {
                  const totalRoofArea = roof.aguas.reduce((s, a) => s + (toNum(a.area, 0)), 0).toFixed(1);
                  const totalRufo = roof.aguas.reduce((s, a) => s + (toNum(a.rufo, 0)), 0).toFixed(1);
                  const totalCalha = roof.aguas.reduce((s, a) => s + (toNum(a.calha, 0)), 0).toFixed(1);
                  return (
                    <div key={roof.id} className="p-3 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Triangle size={14} color={C.gold} />
                        <input value={roof.name} onChange={e => updateRoofs(rs => rs.map(r => r.id === roof.id ? { ...r, name: e.target.value } : r))}
                          className="text-sm font-medium flex-1 bg-transparent" style={{ color: C.chalk }} />
                        <select value={roof.level} onChange={e => updateRoofs(rs => rs.map(r => r.id === roof.id ? { ...r, level: e.target.value } : r))}
                          className="text-[11px] px-2 py-1 rounded" style={{ background: C.panelAlt, color: C.mute, border: `1px solid ${C.line}` }}>
                          {levels.map(l => <option key={l.id}>{l.name}</option>)}
                        </select>
                      </div>
                      <div className="text-[11px] mb-2" style={{ color: C.mute }}>{roof.aguas.length} água(s) · {totalRoofArea} m² · {totalRufo} m de rufo · {totalCalha} m de calha</div>
                      <div className="space-y-1.5">
                        {roof.aguas.map((agua, i) => (
                          <div key={agua.id} className="p-2 rounded space-y-1.5" style={{ background: C.panelAlt, border: `1px solid ${C.line}` }}>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] w-14" style={{ ...mono, color: C.gold }}>Água {i + 1}</span>
                              <input type="text" inputMode="decimal" value={agua.inclinacao} placeholder="Inclinação"
                                onChange={e => updateRoofs(rs => rs.map(r => r.id === roof.id ? { ...r, aguas: r.aguas.map(a => a.id === agua.id ? { ...a, inclinacao: e.target.value } : a) } : r))}
                                className="w-14 px-1.5 py-1 rounded text-xs" style={{ background: "rgba(255,255,255,0.06)", color: C.chalk, border: `1px solid ${C.line}` }} />
                              <span className="text-[10px]" style={{ color: C.mute }}>° inclin.</span>
                              <input type="text" inputMode="decimal" value={agua.area} placeholder="Área m²"
                                onChange={e => updateRoofs(rs => rs.map(r => r.id === roof.id ? { ...r, aguas: r.aguas.map(a => a.id === agua.id ? { ...a, area: e.target.value } : a) } : r))}
                                className="w-14 px-1.5 py-1 rounded text-xs ml-auto" style={{ background: "rgba(255,255,255,0.06)", color: C.chalk, border: `1px solid ${C.line}` }} />
                              <span className="text-[10px]" style={{ color: C.mute }}>m²</span>
                              <button onClick={() => removeAgua(roof.id, agua.id)}><Trash2 size={12} color={C.mute} /></button>
                            </div>
                            <div className="flex items-center gap-2 pl-16">
                              <span className="text-[10px]" style={{ color: C.mute }}>Rufo</span>
                              <input type="text" inputMode="decimal" value={agua.rufo || ""} placeholder="0"
                                onChange={e => updateRoofs(rs => rs.map(r => r.id === roof.id ? { ...r, aguas: r.aguas.map(a => a.id === agua.id ? { ...a, rufo: e.target.value } : a) } : r))}
                                className="w-14 px-1.5 py-1 rounded text-xs" style={{ background: "rgba(255,255,255,0.06)", color: C.chalk, border: `1px solid ${C.line}` }} />
                              <span className="text-[10px]" style={{ color: C.mute }}>m</span>
                              <span className="text-[10px] ml-3" style={{ color: C.mute }}>Calha</span>
                              <input type="text" inputMode="decimal" value={agua.calha || ""} placeholder="0"
                                onChange={e => updateRoofs(rs => rs.map(r => r.id === roof.id ? { ...r, aguas: r.aguas.map(a => a.id === agua.id ? { ...a, calha: e.target.value } : a) } : r))}
                                className="w-14 px-1.5 py-1 rounded text-xs" style={{ background: "rgba(255,255,255,0.06)", color: C.chalk, border: `1px solid ${C.line}` }} />
                              <span className="text-[10px]" style={{ color: C.mute }}>m</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => addAgua(roof.id)} className="mt-2 flex items-center gap-1 text-[11px] px-2 py-1 rounded" style={{ color: C.gold, background: C.goldTint }}>
                        <Plus size={11} /> adicionar água
                      </button>
                    </div>
                  );
                })}
                <button onClick={addRoof} className="w-full py-3 rounded-lg flex items-center justify-center gap-2 text-sm" style={{ border: `1px dashed ${C.line}`, color: C.mute }}>
                  <Plus size={16} /> Nova cobertura
                </button>
              </div>
            )}

            {modeloSub === "niveis" && (
              <div className="space-y-2">
                {levels.map(l => (
                  <div key={l.id} className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                    <Layers3 size={14} color={C.gold} />
                    <input value={l.name} onChange={e => updateLevels(ls => ls.map(x => x.id === l.id ? { ...x, name: e.target.value } : x))}
                      className="text-sm flex-1 bg-transparent" style={{ color: C.chalk }} />
                    <input type="text" inputMode="decimal" value={l.elevation} onChange={e => updateLevels(ls => ls.map(x => x.id === l.id ? { ...x, elevation: e.target.value } : x))}
                      className="w-20 px-2 py-1 rounded text-xs text-right" style={{ ...mono, background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
                    <span className="text-[10px]" style={{ color: C.mute }}>m</span>
                    <button onClick={() => updateLevels(ls => ls.filter(x => x.id !== l.id))}><Trash2 size={13} color={C.mute} /></button>
                  </div>
                ))}
                <button onClick={addLevel} className="w-full py-3 rounded-lg flex items-center justify-center gap-2 text-sm" style={{ border: `1px dashed ${C.line}`, color: C.mute }}>
                  <Plus size={16} /> Novo nível
                </button>
              </div>
            )}

            {modeloSub === "3d" && (
              <div>
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  <button onClick={() => setView3dMode("casa")} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs"
                    style={{ background: view3dMode === "casa" ? C.goldTint : C.panelAlt, color: view3dMode === "casa" ? C.gold : C.mute, border: `1px solid ${view3dMode === "casa" ? "#FFFFFF" : C.line}` }}>
                    <Home size={12} /> Casa toda
                  </button>
                  <button onClick={() => setView3dMode("ambiente")} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs"
                    style={{ background: view3dMode === "ambiente" ? C.goldTint : C.panelAlt, color: view3dMode === "ambiente" ? C.gold : C.mute, border: `1px solid ${view3dMode === "ambiente" ? "#FFFFFF" : C.line}` }}>
                    <Box size={12} /> Este ambiente
                  </button>
                  {view3dMode === "ambiente" && (
                    <select value={view3dRoomId || ""} onChange={e => setView3dRoomId(e.target.value)} className="text-xs px-2 py-1 rounded flex-1"
                      style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
                      <option value="">Selecione um ambiente</option>
                      {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  )}
                  <button onClick={() => setView3dOpen(o => !o)} className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs ml-auto"
                    style={{ background: view3dOpen ? C.goldTint : C.panelAlt, color: view3dOpen ? C.gold : C.mute, border: `1px solid ${view3dOpen ? "#FFFFFF" : C.line}` }}>
                    <DoorOpen size={12} /> {view3dOpen ? "Portas/janelas abertas" : "Portas/janelas fechadas"}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3 p-2 rounded-lg" style={{ background: C.panelAlt, border: `1px solid ${C.line}` }}>
                  <button onClick={() => setSectionCut(s => ({ ...s, enabled: !s.enabled }))} className="flex items-center gap-1 px-2 py-1.5 rounded text-xs"
                    style={{ background: sectionCut.enabled ? C.goldTint : "transparent", color: sectionCut.enabled ? C.gold : C.mute, border: `1px solid ${sectionCut.enabled ? "#FFFFFF" : C.line}` }}>
                    <Scissors size={12} /> Corte de seção
                  </button>
                  {sectionCut.enabled && (
                    <>
                      <select value={sectionCut.axis} onChange={e => setSectionCut(s => ({ ...s, axis: e.target.value }))} className="text-xs px-2 py-1 rounded"
                        style={{ background: "rgba(255,255,255,0.06)", color: C.chalk, border: `1px solid ${C.line}` }}>
                        <option value="horizontal">Horizontal (planta em corte)</option>
                        <option value="vertical-x">Vertical — eixo X</option>
                        <option value="vertical-z">Vertical — eixo Z</option>
                      </select>
                      <input type="range" min={sectionCut.axis === "horizontal" ? -1 : -15} max="15" step="0.1" value={sectionCut.position}
                        onChange={e => setSectionCut(s => ({ ...s, position: toNum(e.target.value, s.position) }))} className="flex-1 min-w-[100px]" />
                      <span className="text-[10px]" style={{ ...mono, color: C.mute }}>{sectionCut.position.toFixed(1)} m</span>
                    </>
                  )}
                </div>

                {view3dMode === "casa" && <ThreeDView buildingLevels={levels.map(levelToMeters)} elevationsById={Object.fromEntries(levels.map(l => [l.id, toNum(l.elevation, 0)]))} openState={view3dOpen ? "open" : "closed"} sectionCut={sectionCut} />}
                {view3dMode === "ambiente" && (() => {
                  const room = rooms.find(r => r.id === view3dRoomId);
                  if (!room) return <div className="text-xs p-6 text-center" style={{ color: C.mute }}>Escolha um ambiente acima.</div>;
                  const level = levels.find(l => l.name === room.level);
                  const data = level ? levelToMetersForRoom(level, room) : null;
                  if (!data) return <div className="text-xs p-6 text-center" style={{ color: C.mute }}>Este ambiente ainda não tem um contorno desenhado. Vá ao Croqui, use a ferramenta "Ambiente" e feche o contorno vinculando a este nome.</div>;
                  return <ThreeDView buildingLevels={[data]} elevationsById={{}} openState={view3dOpen ? "open" : "closed"} sectionCut={sectionCut} />;
                })()}
              </div>
            )}
          </div>
        )}

        {tab === "sync" && (
          <div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={runSync} disabled={syncing}
                className="py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                style={{ background: syncing ? C.panelAlt : C.gold, color: "#141311", opacity: syncing ? 0.7 : 1 }}>
                <RefreshCw size={15} className={syncing ? "animate-spin" : ""} /> {syncing ? "Sincronizando…" : "Sincronizar agora"}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={exportJSON} className="py-3 rounded-lg text-xs flex flex-col items-center justify-center gap-1" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
                  <FileJson size={15} color={C.gold} /> JSON
                </button>
                <button onClick={exportCSV} className="py-3 rounded-lg text-xs flex flex-col items-center justify-center gap-1" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
                  <FileText size={15} color={C.gold} /> CSV
                </button>
              </div>
            </div>
            <div className="rounded-lg p-3 mb-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-[11px] mb-2" style={{ color: C.mute }}>REGISTRO DE SINCRONIZAÇÃO</div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {log.map(entry => (
                  <div key={entry.id} className="flex items-start gap-2 text-[11px]">
                    <span style={{ ...mono, color: C.mute }}>{entry.t}</span>
                    <span style={{ color: entry.kind === "done" ? C.gold : entry.kind === "revit" || entry.kind === "cad" ? C.gold : C.chalk, flex: 1 }}>
                      {entry.kind === "done" && <CheckCircle2 size={11} className="inline mr-1" style={{ marginBottom: "1px" }} />}
                      {entry.msg}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg p-3" style={{ background: C.panelAlt, border: `1px solid ${C.line}` }}>
              <div className="text-[11px] font-medium mb-1.5" style={{ color: C.chalk }}>Do croqui ao Revit</div>
              <ul className="text-[11px] space-y-1" style={{ color: C.mute }}>
                <li>· Cada parede tem dois pontos, comprimento e altura reais — vira um Wall.Create no nível certo.</li>
                <li>· Portas/janelas guardam a parede-mãe, dimensões e (para janelas) o peitoril — viram Family Instances hospedadas na posição certa.</li>
                <li>· Coberturas com várias águas e inclinações mapeiam para um Roof by Footprint com slope por borda.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="relative flex shrink-0" style={{ background: "#141311", borderTop: `1px solid ${C.line}` }}>
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => { setTab(id); if (id !== "ambientes") setActiveRoomId(null); }}
            className="flex-1 py-3 flex flex-col items-center gap-1">
            <Icon size={18} color={tab === id ? C.gold : C.muteDim} />
            <span className="text-[10px]" style={{ ...heading, fontWeight: 600, color: tab === id ? C.gold : C.muteDim }}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
