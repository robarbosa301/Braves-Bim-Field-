import { useState, useRef, useLayoutEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Grid3x3, Grid2x2, X, Trash2, RotateCcw, DoorClosed, BrickWall, Pencil, Undo2, Redo2, Eraser,
  LayoutPanelTop, ZoomIn, ZoomOut, Maximize2, MousePointer2, Lightbulb, Link2, Scissors, Ruler, CornerUpRight,
  Expand, Shrink, Box, Type, Minus, Plus, ArrowLeftRight, SquareStack, AlignCenterVertical, Repeat, CheckSquare,
} from "lucide-react";
import { C, mono, heading, phaseColor, matchesPhaseView } from "./theme.js";
import { toNum, uid } from "./utils.js";
import { WALL_TYPES, DOOR_TYPES, WINDOW_TYPES, FLOOR_TYPES, CEILING_TYPES, wallThicknessM, FONT_FAMILIES, fontFamilyCss } from "./constants.js";
import { GRID, snap, dist, projectPointOnSegment, pointInPolygon, polygonCentroid, fitViewBoxToElements, resyncVbAspect, wrapTextLines, rotatePoint } from "./geometry.js";
import { NumField, TypeSelect, ConditionSelect, PhaseToggles } from "./ElementRows.jsx";

// Split out of App.jsx — this is the Croqui (2D sketch) editor, the
// single largest component in the app. Its own private geometry helpers
// (nearestParallelWallDims, traceEnclosedRoom, the RDP simplifiers,
// findMergeableWall/mergeWallPair) live below, unexported, since nothing
// else in the app needs them.

// Vertical spacing between a door/window's name (tag) and its dimensions
// line, stacked above the opening — mirrors ElevationView's own TAG_LINE_GAP
// so a plan and its elevation read the same way.
const TAG_LINE_GAP = 9;

// 2D fill hint per floor family (Piso tool) — same base tones ThreeDView's
// getWallTexture uses for its own procedural textures, so a floor reads as
// roughly the same material in both views instead of an arbitrary color
// picked independently for each.
const FLOOR_COLOR_2D = {
  "Porcelanato": "#E4E1D8", "Cerâmica": "#D8CFC0", "Contrapiso aparente": "#C9C4B8",
  "Madeira/Laminado": "#B08A5C", "Vinílico": "#C9C2B4", "Korodur": "#8C9A93", "Deck": "#9C7A52", "A definir": "#B9B6AE",
};
// lucide-react has no "stairs" icon — a small hand-drawn one, same stroke
// style (currentColor, round caps/joins) as the rest so it blends in.
function StairsIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h4v-4h4v-4h4v-4h4" />
      <path d="M4 20V4" />
    </svg>
  );
}

// lucide-react also has no "building window" icon — Blinds reads as
// horizontal slats at 16px, not a window. A framed pane with a cross of
// mullions plus a sill reads unambiguously as a window instead.
function WindowIcon({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="15" rx="1" />
      <path d="M12 4v15M5 11.5h14" />
      <path d="M3 20h18" />
    </svg>
  );
}

// A physical wall run split into several elements (a door/window cutting
// it, or just drawn as separate segments) otherwise makes each piece find
// its own nearest facing wall independently in nearestParallelWallDims
// below — several dimension pairs that all measure the exact same span,
// rendering as visual duplicates stacked along the same side. Collapses
// any chain of touching, collinear segments into one virtual run (the
// first segment's own id stands in for the whole chain, for the thickness
// lookup and the drag-to-edit target) spanning its two outer endpoints,
// so pairing sees one wall per physical side — same real corners either
// way, but jogs/steps (never collinear with their neighbor) still pair up
// on their own, exactly where a plain rectangle wouldn't have needed this
// at all.
function mergeCollinearWallRuns(walls) {
  const sameLine = (a, b) => {
    const ax = a.x2 - a.x1, ay = a.y2 - a.y1, alen = Math.hypot(ax, ay) || 1;
    const bx = b.x2 - b.x1, by = b.y2 - b.y1, blen = Math.hypot(bx, by) || 1;
    if (Math.abs(ax * by - ay * bx) / (alen * blen) > 0.02) return false; // not parallel
    const ux = ax / alen, uy = ay / alen;
    const perp = Math.abs((b.x1 - a.x1) * -uy + (b.y1 - a.y1) * ux);
    return perp < GRID * 0.3;
  };
  const touches = (a, b) => {
    const pts = [{ x: a.x1, y: a.y1 }, { x: a.x2, y: a.y2 }];
    const qts = [{ x: b.x1, y: b.y1 }, { x: b.x2, y: b.y2 }];
    return pts.some(p => qts.some(q => dist(p, q) < 3));
  };
  const used = new Array(walls.length).fill(false);
  const runs = [];
  for (let i = 0; i < walls.length; i++) {
    if (used[i]) continue;
    const group = [walls[i]];
    used[i] = true;
    let grew = true;
    while (grew) {
      grew = false;
      for (let j = 0; j < walls.length; j++) {
        if (used[j]) continue;
        if (group.some(g => sameLine(g, walls[j]) && touches(g, walls[j]))) { group.push(walls[j]); used[j] = true; grew = true; }
      }
    }
    if (group.length === 1) { runs.push(group[0]); continue; }
    const ax = group[0].x2 - group[0].x1, ay = group[0].y2 - group[0].y1, alen = Math.hypot(ax, ay) || 1;
    const ux = ax / alen, uy = ay / alen;
    let minT = Infinity, maxT = -Infinity, p0 = null, p1 = null;
    group.forEach(g => {
      [{ x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 }].forEach(p => {
        const t = (p.x - group[0].x1) * ux + (p.y - group[0].y1) * uy;
        if (t < minT) { minT = t; p0 = p; }
        if (t > maxT) { maxT = t; p1 = p; }
      });
    });
    runs.push({ ...group[0], x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y });
  }
  return runs;
}
// For each wall, finds the nearest parallel wall facing it on each side
// (overlapping projection along its own axis) and returns one dimension
// line per such pair — the "cota" between opposing wall faces (e.g. room
// width/depth), independent of each wall's own length label.
function nearestParallelWallDims(walls) {
  const pairs = [];
  for (let i = 0; i < walls.length; i++) {
    const a = walls[i];
    const ax = a.x2 - a.x1, ay = a.y2 - a.y1;
    const alen = Math.hypot(ax, ay);
    if (alen < 1e-6) continue;
    const ux = ax / alen, uy = ay / alen;
    const nx = -uy, ny = ux;
    let bestPos = null, bestNeg = null;
    for (let j = 0; j < walls.length; j++) {
      if (i === j) continue;
      const b = walls[j];
      const bx = b.x2 - b.x1, by = b.y2 - b.y1;
      const blen = Math.hypot(bx, by);
      if (blen < 1e-6) continue;
      if (Math.abs(ax * by - ay * bx) / (alen * blen) > 0.02) continue; // not parallel (~1° tolerance)
      const bmx = (b.x1 + b.x2) / 2, bmy = (b.y1 + b.y2) / 2;
      const signedDist = (bmx - a.x1) * nx + (bmy - a.y1) * ny;
      const distPx = Math.abs(signedDist);
      if (distPx < GRID * 0.6) continue; // too close to be a separate facing wall
      const projB1 = (b.x1 - a.x1) * ux + (b.y1 - a.y1) * uy;
      const projB2 = (b.x2 - a.x1) * ux + (b.y2 - a.y1) * uy;
      const overlapMin = Math.max(0, Math.min(projB1, projB2));
      const overlapMax = Math.min(alen, Math.max(projB1, projB2));
      if (overlapMax - overlapMin < GRID * 0.5) continue;
      const cand = { wallId: b.id, distPx, signedDist, overlapMin, overlapMax };
      if (signedDist > 0 && (!bestPos || distPx < bestPos.distPx)) bestPos = cand;
      if (signedDist < 0 && (!bestNeg || distPx < bestNeg.distPx)) bestNeg = cand;
    }
    for (const cand of [bestPos, bestNeg]) {
      if (!cand) continue;
      const midT = (cand.overlapMin + cand.overlapMax) / 2;
      const p1 = { x: a.x1 + ux * midT, y: a.y1 + uy * midT };
      const p2 = { x: p1.x + nx * cand.signedDist, y: p1.y + ny * cand.signedDist };
      pairs.push({ aId: a.id, bId: cand.wallId, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, distPx: cand.distPx, overlapMin: cand.overlapMin, overlapMax: cand.overlapMax });
    }
  }
  const seen = new Set();
  const out = [];
  for (const p of pairs) {
    const key = [p.aId, p.bId].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}
// Same centerline-to-centerline connecting axis nearestParallelWallDims
// builds for a wall's NEAREST facing neighbor, but for an EXPLICIT pair the
// user picked by hand with the "Cota" tool — so it skips the "is this
// really the closest match" ranking and the minimum-overlap/minimum-distance
// filters that would silently refuse an edge case a manual measurement
// shouldn't have to care about. Falls back to wall A's own midpoint when
// the two walls don't actually overlap along A's length at all (e.g. two
// walls facing each other but offset past one another), so the tool still
// draws SOMETHING instead of a degenerate zero-length line.
function wallToWallAxis(a, b) {
  const ax = a.x2 - a.x1, ay = a.y2 - a.y1;
  const alen = Math.hypot(ax, ay) || 1;
  const ux = ax / alen, uy = ay / alen;
  const nx = -uy, ny = ux;
  const bmx = (b.x1 + b.x2) / 2, bmy = (b.y1 + b.y2) / 2;
  const signedDist = (bmx - a.x1) * nx + (bmy - a.y1) * ny;
  const projB1 = (b.x1 - a.x1) * ux + (b.y1 - a.y1) * uy;
  const projB2 = (b.x2 - a.x1) * ux + (b.y2 - a.y1) * uy;
  const overlapMin = Math.max(0, Math.min(projB1, projB2));
  const overlapMax = Math.min(alen, Math.max(projB1, projB2));
  const hasOverlap = overlapMax > overlapMin;
  const midT = hasOverlap ? (overlapMin + overlapMax) / 2 : alen / 2;
  const p1 = { x: a.x1 + ux * midT, y: a.y1 + uy * midT };
  const p2 = { x: p1.x + nx * signedDist, y: p1.y + ny * signedDist };
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, distPx: Math.abs(signedDist) };
}
// The full render geometry (line endpoints + label position + value in
// meters) for one manually-placed "cota" element — shared between the
// actual SVG render and findAt's hit-testing, so a manual dimension is
// exactly as tappable/selectable as everything else on the sheet instead
// of being a render-only decoration nobody can select or delete.
// Modes: "eixo" (centerline to centerline), "face" (facing/inner faces —
// the clear span), "faceExt" (outer faces — overall including both wall
// thicknesses), "espessura" (one wall's own thickness), "opening" (a
// door/window's own width, in plan).
function cotaGeometry(el, elements, scale) {
  const byId = id => elements.find(e => e.id === id);
  if (el.mode === "espessura") {
    const w = byId(el.wallId);
    if (!w) return null;
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const t = Math.max(0, Math.min(len, el.atPx ?? len / 2));
    const cx = w.x1 + ux * t, cy = w.y1 + uy * t;
    const halfThickPx = (wallThicknessM(w) / 2 / scale) * GRID;
    return {
      x1: cx - nx * halfThickPx, y1: cy - ny * halfThickPx,
      x2: cx + nx * halfThickPx, y2: cy + ny * halfThickPx,
      labelX: cx + ux * 16, labelY: cy + uy * 16,
      valueM: wallThicknessM(w), lineAngleDeg: Math.atan2(ny, nx) * 180 / Math.PI,
    };
  }
  if (el.mode === "opening") {
    const o = byId(el.refId);
    const w = o && byId(o.wallId);
    if (!o || !w) return null;
    const dx = w.x2 - w.x1, dy = w.y2 - w.y1, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const posUnits = (o.x - w.x1) * ux + (o.y - w.y1) * uy;
    const halfWPx = (toNum(o.width, 0.8) / 2 / scale) * GRID;
    const offsetPx = 16;
    const cx = w.x1 + ux * posUnits + nx * offsetPx, cy = w.y1 + uy * posUnits + ny * offsetPx;
    return {
      x1: cx - ux * halfWPx, y1: cy - uy * halfWPx,
      x2: cx + ux * halfWPx, y2: cy + uy * halfWPx,
      labelX: cx, labelY: cy,
      valueM: toNum(o.width, 0.8), lineAngleDeg: Math.atan2(uy, ux) * 180 / Math.PI,
    };
  }
  // face / eixo / faceExt: between two walls the user tapped in sequence.
  const a = byId(el.wallAId), b = byId(el.wallBId);
  if (!a || !b) return null;
  const axis = wallToWallAxis(a, b);
  const dx = axis.x2 - axis.x1, dy = axis.y2 - axis.y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const halfThickAPx = (wallThicknessM(a) / 2 / scale) * GRID;
  const halfThickBPx = (wallThicknessM(b) / 2 / scale) * GRID;
  let x1 = axis.x1, y1 = axis.y1, x2 = axis.x2, y2 = axis.y2;
  if (el.mode === "face") {
    x1 += ux * halfThickAPx; y1 += uy * halfThickAPx;
    x2 -= ux * halfThickBPx; y2 -= uy * halfThickBPx;
  } else if (el.mode === "faceExt") {
    x1 -= ux * halfThickAPx; y1 -= uy * halfThickAPx;
    x2 += ux * halfThickBPx; y2 += uy * halfThickBPx;
  }
  const halfSumM = wallThicknessM(a) / 2 + wallThicknessM(b) / 2;
  const distM = (axis.distPx / GRID) * scale;
  const valueM = el.mode === "face" ? Math.max(0, distM - halfSumM) : el.mode === "faceExt" ? distM + halfSumM : distM;
  let dimDeg = Math.atan2(uy, ux) * 180 / Math.PI;
  if (dimDeg > 90 || dimDeg < -90) dimDeg += 180;
  return { x1, y1, x2, y2, labelX: (x1 + x2) / 2, labelY: (y1 + y2) / 2, valueM: +valueM.toFixed(2), lineAngleDeg: dimDeg };
}
const COTA_MODE_LABEL = {
  face: "Face a face", eixo: "Eixo a eixo", faceExt: "Face ext. a face ext.",
  espessura: "Espessura da parede", opening: "Largura (porta/janela)",
};
// Same room-membership test App.jsx's own wallSpanForRoom/isWallExterior
// use, duplicated here (VectorSketch never imports from App.jsx) so the
// automatic perimeter dimensioning below can tell an exterior wall from an
// interior partition on its own. Kept minimal: only what this file needs.
function wallSpanForRoomLocal(wall, room, scale) {
  const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const halfThickPx = (wallThicknessM(wall) / 2 / scale) * GRID;
  const tolerance = halfThickPx + GRID * 0.6;
  const along = room.points
    .map(p => {
      const relX = p.x - wall.x1, relY = p.y - wall.y1;
      return { pos: relX * ux + relY * uy, perp: Math.abs(relX * nx + relY * ny) };
    })
    .filter(p => p.perp <= tolerance)
    .map(p => p.pos);
  if (!along.length) return null;
  return { startPx: Math.max(0, Math.min(...along)), endPx: Math.min(len, Math.max(...along)) };
}
function isWallExteriorLocal(wall, rooms, scale) {
  if (!rooms.length) return true;
  const spans = rooms.map(r => wallSpanForRoomLocal(wall, r, scale)).filter(Boolean);
  if (spans.length <= 1) return true;
  const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1;
  const fullLen = Math.hypot(dx, dy) || 1;
  const overallStart = Math.min(...spans.map(s => s.startPx));
  const overallEnd = Math.max(...spans.map(s => s.endPx));
  const points = Array.from(new Set([overallStart, overallEnd, ...spans.flatMap(s => [s.startPx, s.endPx])])).sort((a, b) => a - b);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (b - a < 1) continue;
    const mid = (a + b) / 2;
    const coverCount = spans.filter(s => mid >= s.startPx && mid <= s.endPx).length;
    if (coverCount <= 1) return true;
  }
  return false;
}
// Which perpendicular direction actually points OUT of the building, for a
// wall run whose other side has no traced room to anchor against (or none
// at all) — probes both sides for "is this inside some room", and falls
// back to whichever side sits farther from the whole drawing's own
// centroid so an untraced building still gets a sane outward direction.
function outwardNormalForRun(run, elements) {
  const dx = run.x2 - run.x1, dy = run.y2 - run.y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const mid = { x: (run.x1 + run.x2) / 2, y: (run.y1 + run.y2) / 2 };
  const rooms = elements.filter(e => e.type === "room");
  const insideAt = (p) => rooms.some(r => pointInPolygon(p, r.points));
  const TEST_D = 20;
  const posSide = { x: mid.x + nx * TEST_D, y: mid.y + ny * TEST_D };
  const negSide = { x: mid.x - nx * TEST_D, y: mid.y - ny * TEST_D };
  const posIn = insideAt(posSide), negIn = insideAt(negSide);
  if (posIn && !negIn) return { nx: -nx, ny: -ny };
  if (negIn && !posIn) return { nx, ny };
  const wallPts = elements.filter(e => e.type === "wall").flatMap(w => [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }]);
  if (!wallPts.length) return { nx, ny };
  const cx = wallPts.reduce((s, p) => s + p.x, 0) / wallPts.length, cy = wallPts.reduce((s, p) => s + p.y, 0) / wallPts.length;
  const dPos = Math.hypot(posSide.x - cx, posSide.y - cy), dNeg = Math.hypot(negSide.x - cx, negSide.y - cy);
  return dPos > dNeg ? { nx, ny } : { nx: -nx, ny: -ny };
}
// Every door/window whose center sits on (or very near) this merged run's
// own centerline, positioned along the run's own axis — used to break the
// run into the corner/opening chain a construction drawing always cotas
// along a building's own perimeter. Matched by proximity rather than
// wallId, since a run merges several original wall segments into one.
function wallRunOpenings(run, elements) {
  const dx = run.x2 - run.x1, dy = run.y2 - run.y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  return elements
    .filter(e => e.type === "door" || e.type === "window")
    .map(o => {
      const relX = o.x - run.x1, relY = o.y - run.y1;
      return { o, pos: relX * ux + relY * uy, perp: Math.abs(relX * nx + relY * ny) };
    })
    .filter(x => x.perp < GRID * 0.35 && x.pos > -GRID && x.pos < len + GRID);
}
// The two automatic dimension rows a real construction drawing always
// carries around a building's own perimeter — nearestParallelWallDims only
// ever measures BETWEEN two facing walls (a room's own span), never a
// single exterior wall's own run broken into its corners and openings, so
// this is the piece that was actually missing. For every exterior wall
// run: a close "chain" (corner→opening→opening→corner, matching every
// tick a real drawing places along the wall) plus one further-out
// "overall" dimension spanning the whole run.
function exteriorPerimeterChains(elements, scale) {
  const rooms = elements.filter(e => e.type === "room");
  const exteriorWalls = elements.filter(e => e.type === "wall").filter(w => isWallExteriorLocal(w, rooms, scale));
  if (!exteriorWalls.length) return [];
  const runs = mergeCollinearWallRuns(exteriorWalls);
  return runs.map(run => {
    const dx = run.x2 - run.x1, dy = run.y2 - run.y1, len = Math.hypot(dx, dy) || 1;
    if (len < GRID) return null;
    const ux = dx / len, uy = dy / len;
    const halfThickPx = (wallThicknessM(run) / 2 / scale) * GRID;
    // Each opening contributes its own [start,end] edges as breakpoints —
    // kept alongside the corners so a segment that exactly reproduces one
    // opening's own span can be tagged "door"/"window" below, instead of
    // every segment reading as a generic wall gap (a door's own width row
    // needs the door's own cota color/size, same as everywhere else in the
    // app that dimensions an opening — Elevação, the manual Cota tool).
    const openingSpans = wallRunOpenings(run, elements).map(({ o, pos }) => {
      const halfW = (toNum(o.width, 0.8) / 2 / scale) * GRID;
      return { kind: o.type, start: Math.max(0, pos - halfW), end: Math.min(len, pos + halfW) };
    });
    const points = new Set([0, len]);
    openingSpans.forEach(s => { points.add(s.start); points.add(s.end); });
    const sorted = Array.from(points).sort((a, b) => a - b);
    const segs = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (b - a < GRID * 0.15) continue;
      const match = openingSpans.find(s => Math.abs(s.start - a) < 1 && Math.abs(s.end - b) < 1);
      segs.push({ a, b, kind: match ? match.kind : "gap" });
    }
    const { nx, ny } = outwardNormalForRun(run, elements);
    return { id: run.id, tag: run.tag, x1: run.x1, y1: run.y1, ux, uy, nx, ny, halfThickPx, len, segs };
  }).filter(Boolean);
}
// Auto-traces a room polygon by flood-filling the open floor area starting
// from a clicked point, stopping at wall faces — the "click inside" room
// tool, as opposed to tracing each corner by hand. Works on a grid finer
// than the drawing's own snap grid so it can still approximate diagonal
// walls reasonably well. Returns null when the click landed on a wall, the
// grid got unreasonably large, or the area isn't actually enclosed (the
// fill reaches the padding border around the walls' bounding box).
function traceEnclosedRoom(walls, clickPoint, GRID, scale) {
  if (!walls.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  walls.forEach(w => {
    minX = Math.min(minX, w.x1, w.x2); maxX = Math.max(maxX, w.x1, w.x2);
    minY = Math.min(minY, w.y1, w.y2); maxY = Math.max(maxY, w.y1, w.y2);
  });
  const spanX = maxX - minX, spanY = maxY - minY;
  // CELL is expressed in drawing units, but what it actually costs the
  // room is real-world size: at a coarse "meters per grid square" scale
  // (a big property surveyed with a loose grid), a fixed-in-units cell
  // can represent a meter or more — bigger than the entire width of a
  // narrow room like a hallway or a tapering tip, so the wall-blocking
  // margin on both sides overlaps and blots out the whole interior
  // there. Aim for a roughly constant ~5cm real-world cell instead of a
  // fixed drawing-unit one. A single fixed floor on how fine that's
  // allowed to get (rather than one derived from the cell-count budget
  // below) was still too coarse for a small, narrow room like this one,
  // while being needlessly fine for a huge one — so shrink CELL only as
  // far as this room's OWN bounding box can afford within the cap,
  // which lets a small room get a much finer cell than a large one. A
  // narrow slice of a room split by a new dividing wall (the "Final"
  // phase view re-traces one) is exactly the case a coarser cell used to
  // shortchange the most — the fixed wall-blocking margin below eats a
  // bigger fraction of a thin sliver than of the room it came from.
  let CELL = Math.min(GRID / 2, scale ? (0.05 / scale) * GRID : GRID / 2);
  for (let i = 0; i < 30 && CELL < GRID / 2; i++) {
    const pad = CELL * 4;
    const cols = Math.ceil((spanX + 2 * pad) / CELL);
    const rows = Math.ceil((spanY + 2 * pad) / CELL);
    if (cols * rows <= 40000) break;
    CELL *= 1.25;
  }
  CELL = Math.min(GRID / 2, CELL);
  const PAD = CELL * 4;
  minX -= PAD; minY -= PAD; maxX += PAD; maxY += PAD;
  const cols = Math.ceil((maxX - minX) / CELL);
  const rows = Math.ceil((maxY - minY) / CELL);
  if (cols * rows > 40000 || cols < 1 || rows < 1) return null;

  const blocked = new Uint8Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const px = minX + (cx + 0.5) * CELL, py = minY + (cy + 0.5) * CELL;
      for (const w of walls) {
        const proj = projectPointOnSegment({ x: px, y: py }, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
        // Only a thin safety margin here (not half a cell, as before) — the
        // flood fill below is already 4-connected, which on its own can't
        // leak diagonally through a wall corner (that needs 8-connectivity),
        // so a big margin wasn't actually buying leak-proofing; it was just
        // eating into the traced room on every side, undercounting its area
        // by roughly one margin-width per wall (visibly so once CELL isn't
        // tiny — e.g. ~4cm inset each side at the default ~8cm cell).
        if (dist({ x: px, y: py }, proj) < w.halfThickPx + CELL * 0.12) {
          blocked[cy * cols + cx] = 1;
          break;
        }
      }
    }
  }

  const startCx = Math.floor((clickPoint.x - minX) / CELL);
  const startCy = Math.floor((clickPoint.y - minY) / CELL);
  if (startCx < 0 || startCy < 0 || startCx >= cols || startCy >= rows) return null;
  if (blocked[startCy * cols + startCx]) return null;

  const filled = new Uint8Array(cols * rows);
  const stack = [[startCx, startCy]];
  filled[startCy * cols + startCx] = 1;
  let touchedEdge = false;
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx === 0 || cy === 0 || cx === cols - 1 || cy === rows - 1) touchedEdge = true;
    const neighbors = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const idx = ny * cols + nx;
      if (filled[idx] || blocked[idx]) continue;
      filled[idx] = 1;
      stack.push([nx, ny]);
    }
  }
  if (touchedEdge) return null;

  const isFilled = (cx, cy) => cx >= 0 && cy >= 0 && cx < cols && cy < rows && filled[cy * cols + cx];
  const edges = [];
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      if (!filled[cy * cols + cx]) continue;
      const tl = { x: minX + cx * CELL, y: minY + cy * CELL };
      const tr = { x: minX + (cx + 1) * CELL, y: minY + cy * CELL };
      const bl = { x: minX + cx * CELL, y: minY + (cy + 1) * CELL };
      const br = { x: minX + (cx + 1) * CELL, y: minY + (cy + 1) * CELL };
      if (!isFilled(cx, cy - 1)) edges.push([tr, tl]);
      if (!isFilled(cx, cy + 1)) edges.push([bl, br]);
      if (!isFilled(cx - 1, cy)) edges.push([tl, bl]);
      if (!isFilled(cx + 1, cy)) edges.push([br, tr]);
    }
  }
  if (!edges.length) return null;

  const keyOf = (p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  const byStart = new Map();
  edges.forEach(e => byStart.set(keyOf(e[0]), e));

  const startEdge = edges[0];
  const loop = [startEdge[0]];
  let cur = startEdge[1];
  let guard = 0;
  while (keyOf(cur) !== keyOf(startEdge[0]) && guard < edges.length + 5) {
    loop.push(cur);
    const next = byStart.get(keyOf(cur));
    if (!next) return null;
    cur = next[1];
    guard++;
  }
  if (guard >= edges.length + 5) return null;

  // The raster trace above approximates any non-orthogonal wall as a
  // staircase of CELL-sized steps (each cell is either "in" or "out" of
  // the room) — an exactly-collinear-point filter only cleans up straight
  // runs, so a diagonal or acute-angled wall still comes out looking like
  // a jagged staircase instead of one straight edge. Running it through
  // Ramer-Douglas-Peucker flattens any deviation up to a bit more than
  // one step back into a straight line, while real corners (offset by
  // whole wall thicknesses/segments) stay well outside that tolerance
  // and survive.
  const smoothed = rdpSimplifyClosed(loop, CELL * 1.5);
  const finalLoop = smoothed.length >= 3 ? smoothed : loop;
  // The raster trace, even after RDP smoothing, still only approximates
  // each wall's real face — it's built from CELL-sized steps offset by the
  // fill-blocking margin above, so every edge sits some fraction of a cell
  // shy of where the wall's actual face is, undercounting the room's area
  // by a small but visible amount (worse the smaller the room, since CELL
  // itself is a bigger fraction of it). Re-snapping each edge onto the
  // wall it's actually tracing — using the wall's own geometry, not the
  // raster — removes that error instead of just shrinking it further.
  return snapRoomToWallFaces(finalLoop, walls, CELL * 2.5);
}
// traceEnclosedRoom's flood-fill grid spans the bounding box of every wall
// it's handed, not just whichever ones actually surround clickPoint — on a
// level with several rooms (or one with walls scattered elsewhere), that
// bounding box balloons well past the room actually being traced, and the
// 40000-cell budget then forces CELL coarser everywhere, not just far away
// from the click. Pre-filtering to walls within a generous radius of
// clickPoint keeps the grid — and CELL — sized to the room actually being
// traced; the full wall list is still tried as a fallback in case a
// legitimately huge room needed the walls this trimmed away.
function traceEnclosedRoomNear(walls, clickPoint, GRID, scale) {
  const radiusPx = (12 / (scale || 0.5)) * GRID;
  const near = walls.filter(w => {
    const proj = projectPointOnSegment(clickPoint, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
    return dist(clickPoint, proj) < radiusPx;
  });
  if (near.length && near.length < walls.length) {
    const traced = traceEnclosedRoom(near, clickPoint, GRID, scale);
    if (traced) return traced;
  }
  return traceEnclosedRoom(walls, clickPoint, GRID, scale);
}
// Replaces each edge of a raster-traced room outline with the EXACT face
// line of whichever wall it's tracing (a line parallel to that wall's
// centerline, offset by precisely its own half-thickness), then rebuilds
// each corner as the intersection of its two adjacent corrected edges —
// turning the raster's blocky approximation into the true wall-face
// polygon, independent of CELL size. Falls back to the original raster
// edge/vertex wherever no wall match is found or two adjacent edges turn
// out (near-)parallel, so a partial or ambiguous match never makes the
// result worse than the untouched raster trace.
function snapRoomToWallFaces(loop, walls, tolerance) {
  const n = loop.length;
  if (n < 3) return loop;
  const faceLines = loop.map((p1, i) => {
    const p2 = loop[(i + 1) % n];
    const ex = p2.x - p1.x, ey = p2.y - p1.y, elen = Math.hypot(ex, ey);
    if (elen < 1e-6) return null;
    const eux = ex / elen, euy = ey / elen;
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    let best = null;
    for (const w of walls) {
      const wx = w.x2 - w.x1, wy = w.y2 - w.y1, wlen = Math.hypot(wx, wy) || 1;
      const wux = wx / wlen, wuy = wy / wlen;
      if (Math.abs(eux * wuy - euy * wux) > 0.03) continue; // not parallel to this wall
      const proj = projectPointOnSegment(mid, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      const nx = -wuy, ny = wux;
      const signedDist = (mid.x - proj.x) * nx + (mid.y - proj.y) * ny;
      const diff = Math.abs(Math.abs(signedDist) - w.halfThickPx);
      if (diff < tolerance && (!best || diff < best.diff)) {
        best = { diff, ux: wux, uy: wuy, nx, ny, footpoint: proj, sign: signedDist >= 0 ? 1 : -1, halfThickPx: w.halfThickPx };
      }
    }
    if (!best) return null;
    return {
      ux: best.ux, uy: best.uy,
      point: { x: best.footpoint.x + best.nx * best.sign * best.halfThickPx, y: best.footpoint.y + best.ny * best.sign * best.halfThickPx },
    };
  });
  return loop.map((p, i) => {
    const prev = faceLines[(i - 1 + n) % n];
    const cur = faceLines[i];
    if (!prev || !cur) return p;
    const denom = prev.ux * cur.uy - prev.uy * cur.ux;
    if (Math.abs(denom) < 1e-6) return p;
    const t = ((cur.point.x - prev.point.x) * cur.uy - (cur.point.y - prev.point.y) * cur.ux) / denom;
    return { x: prev.point.x + prev.ux * t, y: prev.point.y + prev.uy * t };
  });
}
function perpDistToLine(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return dist(p, a);
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}
function rdpOpen(points, epsilon) {
  if (points.length < 3) return points.slice();
  const first = points[0], last = points[points.length - 1];
  let maxD = -1, idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDistToLine(points[i], first, last);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > epsilon) {
    const left = rdpOpen(points.slice(0, idx + 1), epsilon);
    const right = rdpOpen(points.slice(idx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [first, last];
}
// RDP is defined for an open polyline with two fixed endpoints; a closed
// room outline has none, so split it into two chains at the point
// farthest from an arbitrary anchor (loop[0]) and simplify each as an
// open path, then stitch them back into one loop.
function rdpSimplifyClosed(loop, epsilon) {
  if (loop.length < 4) return loop;
  let maxD = 0, splitIdx = 1;
  for (let i = 1; i < loop.length; i++) {
    const d = dist(loop[0], loop[i]);
    if (d > maxD) { maxD = d; splitIdx = i; }
  }
  const chainA = loop.slice(0, splitIdx + 1);
  const chainB = loop.slice(splitIdx).concat([loop[0]]);
  const simpA = rdpOpen(chainA, epsilon);
  const simpB = rdpOpen(chainB, epsilon);
  return simpA.slice(0, -1).concat(simpB.slice(0, -1));
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
// Finds a nearby, non-parallel wall whose nearest endpoint to one of
// `wall`'s own endpoints sits close by but doesn't already coincide with
// it — the "meant to be the same corner, but one wall was drawn a bit
// short/long or they cross past each other" case that's fiddly to fix by
// dragging a single endpoint by hand. Parallel/collinear walls are left
// to the merge feature above — there's no single corner to trim to.
function findCornerWall(wall, elements) {
  const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const aEnds = [{ x: wall.x1, y: wall.y1 }, { x: wall.x2, y: wall.y2 }];
  const others = elements.filter(e => e.type === "wall" && e.id !== wall.id);
  for (const o of others) {
    const odx = o.x2 - o.x1, ody = o.y2 - o.y1, olen = Math.hypot(odx, ody) || 1;
    const oux = odx / olen, ouy = ody / olen;
    if (Math.abs(ux * ouy - uy * oux) < 0.06) continue;
    const bEnds = [{ x: o.x1, y: o.y1 }, { x: o.x2, y: o.y2 }];
    for (const ae of aEnds) for (const be of bEnds) {
      const d = dist(ae, be);
      if (d > 0.75 && d < GRID * 3) return o;
    }
  }
  return null;
}
// Extends/trims two non-parallel walls so they meet exactly at the
// intersection of their (infinite) centerlines — whichever endpoint of
// each wall already sits nearest that point is the one pulled onto it,
// same as dragging that single endpoint by hand, just exact. The other,
// already-anchored end of each wall never moves.
function trimWallsToCorner(a, b) {
  const aux0 = a.x2 - a.x1, auy0 = a.y2 - a.y1, alen = Math.hypot(aux0, auy0) || 1;
  const aux = aux0 / alen, auy = auy0 / alen;
  const bux0 = b.x2 - b.x1, buy0 = b.y2 - b.y1, blen = Math.hypot(bux0, buy0) || 1;
  const bux = bux0 / blen, buy = buy0 / blen;
  const denom = aux * buy - auy * bux;
  if (Math.abs(denom) < 1e-6) return null;
  const t = ((b.x1 - a.x1) * buy - (b.y1 - a.y1) * bux) / denom;
  const ix = a.x1 + aux * t, iy = a.y1 + auy * t;
  const aStartD = dist({ x: a.x1, y: a.y1 }, { x: ix, y: iy });
  const aEndD = dist({ x: a.x2, y: a.y2 }, { x: ix, y: iy });
  const bStartD = dist({ x: b.x1, y: b.y1 }, { x: ix, y: iy });
  const bEndD = dist({ x: b.x2, y: b.y2 }, { x: ix, y: iy });
  return {
    a: aStartD <= aEndD ? { x1: ix, y1: iy, x2: a.x2, y2: a.y2 } : { x1: a.x1, y1: a.y1, x2: ix, y2: iy },
    b: bStartD <= bEndD ? { x1: ix, y1: iy, x2: b.x2, y2: b.y2 } : { x1: b.x1, y1: b.y1, x2: ix, y2: iy },
  };
}

export default function VectorSketch({ level, allLevels, rooms, onChange, onMeta, onNameRoom, onMergeWalls, onLinkStairLevel, exportMode = false, onOpenThreeD, phaseView = "tudo", roofOverlays = [] }) {
  const svgRef = useRef(null);
  const toolbarRef = useRef(null);
  const belowCanvasRef = useRef(null);
  const [tool, setTool] = useState("selecionar");
  const [planMode, setPlanMode] = useState("piso");
  const [pending, setPending] = useState(null);
  // Live preview of the segment about to be placed while chain-drawing
  // walls/stairs (tap a point, tap the next, tap the next... without
  // reselecting the tool each time) — a mouse/trackpad (an iPad with a
  // Magic Keyboard, a desktop browser) can hover before committing, so
  // this tracks that position the same way a real tap would resolve it
  // (endpoint/wall-line snap, then angle-snap), giving a solid preview
  // styled like the real wall itself — not a dashed placeholder — instead
  // of leaving the chain's next segment invisible until the tap actually
  // lands. Touch alone has no hover to preview from, but the
  // chain logic itself (in handleTap) works the same regardless.
  const [hoverPos, setHoverPos] = useState(null);
  // Visual-only anchor for the press-drag-release gesture below, separate
  // from `pending` — set the instant a finger/cursor goes down, before it's
  // even known whether this will turn into a real drag or just a plain tap,
  // so the preview line starts from the press point immediately instead of
  // only appearing once the drag has already traveled the threshold
  // distance. `pending` itself is only touched once that threshold is
  // actually crossed (see moveWallGesture) — a plain tap needs `pending`
  // left exactly as the tap-chain logic in handleTap expects it.
  const [gestureAnchor, setGestureAnchor] = useState(null);
  const [polygon, setPolygon] = useState([]);
  const [ambienteAuto, setAmbienteAuto] = useState(true);
  const [lastPolygonAdd, setLastPolygonAdd] = useState(1);
  const [autoRoomMsg, setAutoRoomMsg] = useState("");
  const [dims, setDims] = useState({ w: 340, h: 300 });
  const [vb, setVb] = useState(null);
  // Degrees the sheet itself is spun by (around the current view's center),
  // independent of pan/zoom — set from a three-finger twist so a big
  // project that runs off the top-left corner can be squared back up on
  // screen instead of only ever being readable at whatever angle it was
  // drawn.
  const [rotationDeg, setRotationDeg] = useState(0);
  const [deletedStack, setDeletedStack] = useState([]);
  const [history, setHistory] = useState([]);
  // States "Recente" (undoLast) has undone, so "Avançar" can restore them —
  // any fresh commit invalidates this (there's no future to redo once the
  // person draws something new), so commitElements clears it.
  const [redoStack, setRedoStack] = useState([]);
  const isDraggingRef = useRef(false);
  const [namingId, setNamingId] = useState(null);
  const [namingValue, setNamingValue] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  // Drag-select (marquee): press empty canvas with the Selecionar tool,
  // drag a box, release — every wall/door/window/stair/room fully inside it
  // joins this batch, so a handful of elements can be deleted together
  // instead of one Apagar tap per element or "Tudo" nuking the whole level.
  // Kept apart from selectedId (that one drives the single-element property
  // editor below the canvas) since the two modes are mutually exclusive but
  // shouldn't have to share state to prove it.
  const [selectionIds, setSelectionIds] = useState(() => new Set());
  const [marqueeRect, setMarqueeRect] = useState(null);
  const marqueeGesture = useRef(null);
  // "Selecionar vários" toggle: with it on, tapping a wall/door/window/
  // ambiente/piso one at a time ADDS or REMOVES it from selectionIds
  // instead of moving it or opening its single-element panel — the touch
  // equivalent of the marquee box above, for elements that aren't
  // conveniently boxable (scattered doors, non-adjacent ambientes).
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  function toggleSelectionMember(id) {
    setSelectionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const [showBelow, setShowBelow] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showTextSettings, setShowTextSettings] = useState(false);
  // "Estender": tap the wall to stretch/shrink, then tap the wall it
  // should reach — extendSourceId holds the first tap between the two.
  const [extendSourceId, setExtendSourceId] = useState(null);
  const [extendMsg, setExtendMsg] = useState("");
  // "Alinhar": tap the wall to align TO (reference, stays put), then tap
  // the wall that should move to line up with it — same two-tap pattern
  // as Estender, just a parallel-offset correction instead of a
  // stretch/shrink to a meeting point. Holds the actual wall object (not
  // just an id) since the reference can be a ghost wall from the level
  // above/below, which isn't in this level's own elements/wallsById.
  const [alignRef, setAlignRef] = useState(null);
  const [alignMsg, setAlignMsg] = useState("");
  // "Cota" (manual dimension): a sub-mode picker (face a face / eixo a eixo
  // / face externa / espessura / porta-janela) plus, for the two-wall
  // modes, the first wall tapped while waiting for the second — the same
  // two-tap pattern as Estender/Alinhar above. This exists because the
  // automatic dimensions (nearestParallelWallDims, the per-wall length
  // label) only ever cover a handful of fixed cases; anything else on a
  // real engineering drawing — a chained wall-segment breakdown, an
  // overall outer-to-outer building width, an opening's own width in
  // plan — has no automatic equivalent, so the user places it by hand.
  const [cotaMode, setCotaMode] = useState("face");
  const [cotaPendingWallId, setCotaPendingWallId] = useState(null);
  // Tela cheia: the whole editor floats out of the app's normal scrolling
  // layout into a fixed full-viewport portal so the canvas can use the
  // entire phone screen — the toolbar rows and the selected-element panel
  // become translucent overlays pinned to the top/bottom of the canvas
  // (a "watermark") instead of pushing it down, and only regain full
  // opacity where they actually sit under a finger.
  const [fullscreen, setFullscreen] = useState(false);
  const [showAbove, setShowAbove] = useState(false);
  const [draggingLabel, setDraggingLabel] = useState(null);
  const [draggingDimLabel, setDraggingDimLabel] = useState(null);
  const [editingWallLen, setEditingWallLen] = useState(null);
  const [editingLumDim, setEditingLumDim] = useState(null);
  const [editingParallelDim, setEditingParallelDim] = useState(null);
  // Which automatic exterior-perimeter dimension (a chain segment or an
  // overall run total — see exteriorPerimeterChains) is currently showing
  // its own tiny "Apagar esta cota" popup, tapped open the same way a
  // face-a-face pair's edit box opens above.
  const [selectedExtDim, setSelectedExtDim] = useState(null);
  const [dragSession, setDragSession] = useState(null);
  const [splittingWall, setSplittingWall] = useState(null);
  const pinch = useRef(null);
  const twist = useRef(null);
  // Draw-by-dragging a wall/stair in one motion (press, drag, release) as
  // an alternative to the tap-tap chain method above — someone who just
  // wants one straight wall shouldn't have to place two separate taps for
  // it. Kept as a ref (not state) since it's only read/written from inside
  // the gesture handlers themselves, never rendered directly — hoverPos
  // (already used for the tap-chain's own preview line) doubles as this
  // drag's live end point too.
  const wallGesture = useRef(null);
  // Mouse's own click event fires on mouseup regardless of how far the
  // pointer moved in between (no built-in "that was a drag, not a tap"
  // suppression the way touch-to-click synthesis usually has) — set right
  // before a drag-placed wall/stair commits OR a marquee selection lands,
  // and checked at the top of handleTap, so that same release doesn't ALSO
  // run the tap-chain/single-select logic on top of what the drag itself
  // just did (placing a segment, or picking a batch of elements).
  const justDraggedOnCanvas = useRef(false);
  const scale = toNum(level.sketchScale, 0.5);
  const wallHeightDefault = level.wallHeightDefault || "2.80";
  const dimColor = level.dimColor || "#4A4A46";
  // Door/window sill/height dimensions in the Elevação view get their own
  // pair of colors instead of sharing dimColor (that one's for the overall
  // exterior wall dimensions here in the plan), so a door-adjacent
  // measurement and a window-adjacent one can be told apart at a glance.
  const doorDimColor = level.doorDimColor || "#4A4A46";
  const windowDimColor = level.windowDimColor || "#4A4A46";
  const dimLabelOpaqueBg = level.dimLabelOpaqueBg !== false;
  const dimFontSize = toNum(level.dimFontSize, 7.5);
  // Same idea as the door/window dim colors above: a separate size for
  // the door/window-adjacent gap numbers, so they can be made bigger (or
  // smaller) than the plain corner-to-corner wall dimensions without
  // resizing every dimension on the sheet. Defaults to dimFontSize itself
  // (no visible change) until set.
  const doorWindowDimFontSize = toNum(level.doorWindowDimFontSize, dimFontSize);
  const roomNameFontSize = toNum(level.roomNameFontSize, 10);
  const tagFontSize = toNum(level.tagFontSize, 7);
  const tagColor = level.tagColor || "#4A4A46";
  const croquiFontFamily = fontFamilyCss(level.fontFamily);
  const elements = level.sketchElements || [];
  const wallsById = {};
  elements.filter(e => e.type === "wall").forEach(w => { wallsById[w.id] = w; });
  const selected = elements.find(e => e.id === selectedId) || null;
  const phaseVisible = el => phaseView === "tudo" || matchesPhaseView(el, phaseView);
  // "Final" (what's kept and what's new should look identical, nothing
  // left to tell apart once the work is done) and "Existente" (what's
  // standing today, drawn plainly — a wall due to come down still belongs
  // here, just not singled out; that's the Demolição view's job) both skip
  // the demolir/construir color coding the other views use to flag what's
  // changing. Everything demolir-marked is already hidden from "Final" by
  // phaseVisible above, so the only color it actually needs to suppress is
  // construir's green highlight.
  const phaseStyleColor = el => (phaseView === "final" || phaseView === "existente" ? null : phaseColor(el));
  // In "Final", a room's actual shape can differ from what was traced —
  // a new dividing wall splits it, a torn-down one merges it with a
  // neighbor — so this recomputes every room's footprint from the walls
  // that actually survive into that view instead of trusting the stored
  // polygon, the same flood-fill the "Ambiente" auto-trace tool itself
  // uses (traceEnclosedRoom), just seeded from each existing room instead
  // of a single tap. "Construção Nova" reuses the very same recompute
  // (below) filtered down to just the pieces that didn't keep an
  // original room's identity — the two rooms a new wall carves out of one
  // bigger room are exactly as "new" as the wall itself, even though part
  // of their own boundary is old walls being kept. Memoized: it's a real
  // flood fill (up to 40000 cells each), not something to redo on every
  // unrelated render while either view is open.
  const finalRooms = useMemo(() => {
    if (phaseView !== "final" && phaseView !== "novo") return null;
    const storedRooms = elements.filter(e => e.type === "room");
    if (!storedRooms.length) return [];
    const finalWalls = elements.filter(e => e.type === "wall" && matchesPhaseView(e, "final")).map(w => ({
      x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2,
      halfThickPx: (wallThicknessM(w) / 2 / scale) * GRID,
    }));
    const found = []; // { points, area, sourceRoomIds: Set }
    storedRooms.forEach(room => {
      const centroid = polygonCentroid(room.points);
      // A probe at the centroid alone misses an L-shaped (or otherwise
      // non-convex) room whose centroid falls outside its own polygon, or
      // lands exactly on a wall that now splits it — the midpoint toward
      // each vertex is still inside the original room and gives every
      // resulting piece its own seed even then.
      const seeds = [centroid, ...room.points.map(pt => ({ x: (centroid.x + pt.x) / 2, y: (centroid.y + pt.y) / 2 }))];
      seeds.forEach(p => {
        if (!pointInPolygon(p, room.points)) return;
        if (found.some(f => pointInPolygon(p, f.points))) return;
        const traced = traceEnclosedRoomNear(finalWalls, p, GRID, scale);
        if (!traced) return;
        let area2 = 0;
        for (let i = 0; i < traced.length; i++) {
          const a = traced[i], b = traced[(i + 1) % traced.length];
          area2 += a.x * b.y - b.x * a.y;
        }
        area2 = Math.abs(area2 / 2);
        const areaM2 = +((area2 / (GRID * GRID)) * scale * scale).toFixed(2);
        found.push({ points: traced, area: areaM2, sourceRoomIds: new Set([room.id]) });
      });
    });
    // A region more than one original room's centroid lands inside (two
    // rooms merged once the wall between them is gone) picks up every
    // one of those ids instead of being traced — and shown — twice.
    storedRooms.forEach(room => {
      const centroid = polygonCentroid(room.points);
      const region = found.find(f => pointInPolygon(centroid, f.points));
      if (region) region.sourceRoomIds.add(room.id);
    });
    return found.map(f => {
      const singleId = f.sourceRoomIds.size === 1 ? [...f.sourceRoomIds][0] : null;
      const original = singleId ? storedRooms.find(r => r.id === singleId) : null;
      // Keep the original room's name/id only when this region's area
      // still closely matches it — a real split or merge falls back to
      // unnamed, same as a freshly traced room, rather than keeping a
      // name that no longer describes the actual space.
      const keepsIdentity = original && Math.abs(f.area - toNum(original.area, 0)) < Math.max(0.05, toNum(original.area, 0) * 0.03);
      return keepsIdentity
        ? { ...original, points: f.points, area: f.area }
        : { id: uid(), type: "room", points: f.points, area: f.area, roomId: null, name: null, floorFinish: "A definir", floorColor: "#D9D4C8", ceilingFinish: "A definir", isSplitNew: true };
    });
  }, [phaseView, elements, scale]);
  // "Construção Nova" shows only what's being newly built — an existing,
  // untouched room still makes sense in "Final" (nothing about it is
  // changing) but not here, while a piece a new wall actually carved out
  // of a bigger room (isSplitNew, from finalRooms above) belongs in both:
  // it's a genuinely new space. "Existente"/"Demolição"/"Completo" still
  // show the room as originally traced — the bigger, not-yet-split room
  // is exactly what "Demolição" should show, since that configuration is
  // what's going away.
  const roomsForRender = phaseView === "final" ? (finalRooms || [])
    : phaseView === "novo" ? (finalRooms || []).filter(r => r.isSplitNew)
    : elements.filter(e => e.type === "room");
  // Estimated on-screen box of each room's name/area label (mirrors the
  // hitW/hitH math in the room-label render below) — used by the
  // parallel-wall dimension labels to steer clear of it. For a rectangular
  // room, that label sits at the centroid, which is exactly where the
  // room's two facing-wall dimension lines cross too, so without this the
  // room name and the "x.xx m" figure land on top of each other and both
  // become unreadable.
  const roomLabelBoxes = roomsForRender.map(el => {
    const centroid = polygonCentroid(el.points);
    const lines = wrapTextLines(el.name || "Ambiente sem nome", 14);
    const totalLines = lines.length + 1;
    const lx = centroid.x + (el.labelOffset?.dx ?? 0);
    const ly = centroid.y + (el.labelOffset?.dy ?? 0);
    const longest = Math.max(...lines.map(l => l.length), String(el.area).length + 3);
    return { x: lx, y: ly, hw: (longest * 5.6 + 10) / 2, hh: (totalLines * 11 + 8) / 2 };
  });

  const levelIdx = (allLevels || []).findIndex(l => l.id === level.id);
  const belowLevel = levelIdx > 0 ? allLevels[levelIdx - 1] : null;
  const aboveLevel = (allLevels && levelIdx >= 0 && levelIdx < allLevels.length - 1) ? allLevels[levelIdx + 1] : null;
  // Only the ghost level(s) actually toggled on ("ver [nível]") — same
  // walls ghostLevel() below draws as a faint dashed reference, reused
  // here so a NEW wall can snap its endpoint (or align) straight onto
  // one, instead of the ghost being purely a look-but-don't-touch guide.
  // Raw x/y, no scale conversion: the ghost overlay itself never converts
  // between levels' scales either, so this only lines up when both
  // levels share the same "1 quadro = " setting, exactly like the visual
  // guide already assumes.
  const ghostWalls = [
    ...(showBelow && belowLevel ? (belowLevel.sketchElements || []).filter(e => e.type === "wall") : []),
    ...(showAbove && aboveLevel ? (aboveLevel.sketchElements || []).filter(e => e.type === "wall") : []),
  ];

  useLayoutEffect(() => {
    function measure() {
      if (!svgRef.current) return;
      // Fullscreen: the svg is a position:absolute layer filling the fixed
      // full-viewport portal, with the toolbar/panel floating on top of it
      // rather than pushing it down — so it gets the whole window instead
      // of whatever's left after those rows, and doesn't need to dodge the
      // (now hidden-behind-it) app bottom nav either.
      if (fullscreen) {
        const w = window.innerWidth || 340, h = window.innerHeight || 600;
        setDims(prev => (Math.abs(prev.w - w) > 1 || Math.abs(prev.h - h) > 1) ? { w, h } : prev);
        setVb(v => v ? resyncVbAspect(v, w, h) : fitViewBoxToElements(elements, w, h));
        return;
      }
      const w = svgRef.current.parentElement.clientWidth || 340;
      const svgTop = svgRef.current.getBoundingClientRect().top;
      const nav = document.querySelector("[data-braves-bottom-nav]");
      const bottomEdge = nav ? nav.getBoundingClientRect().top : (window.innerHeight || 700);
      // Space that always follows the canvas — the Recente/Desfazer/Tudo
      // row, plus (when something's selected) its whole detail-editor
      // panel above that row. A fixed guess here either wastes space when
      // nothing's selected and that panel is absent, or gets outgrown the
      // moment it appears (a wall's own editor, with its buttons for
      // merging/trimming/splitting, runs well past a flat guess) and
      // shoves this reserved area — and the canvas "filling the rest" —
      // straight past the bottom nav. Measuring the block's real rendered
      // height instead adapts to whichever is actually on screen.
      const belowH = belowCanvasRef.current ? belowCanvasRef.current.getBoundingClientRect().height : 64;
      const h = Math.max(220, bottomEdge - svgTop - belowH - 8);
      setDims(prev => (Math.abs(prev.w - w) > 1 || Math.abs(prev.h - h) > 1) ? { w, h } : prev);
      setVb(v => v ? resyncVbAspect(v, w, h) : fitViewBoxToElements(elements, w, h));
    }
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    // Mobile Safari settling its address bar after load changes the real
    // visible height without always firing a plain window "resize" — the
    // same gap-below-the-app case App.jsx's own useRealViewportHeight
    // guards against, just for this canvas's internal measurement instead
    // of the app root. visualViewport catches it reliably where "resize"
    // doesn't.
    if (window.visualViewport) window.visualViewport.addEventListener("resize", measure);
    // The dependency list above only covers toolbar rows that come and go
    // with local UI state — it can't know about ones that show up once
    // cloud data finishes loading (the "Vistas" row needs a demolir/
    // construir element to exist, "ver 1º Pavimento" needs a level above/
    // below), which shifts the toolbar's real height without touching any
    // of those dependencies, silently freezing the canvas at a shorter,
    // stale size — the wasted band of empty space between it and the
    // bottom nav that never gets reclaimed. Watching the toolbar block
    // itself catches that (and anything else) directly, instead of trying
    // to enumerate every possible cause.
    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => measure());
      if (toolbarRef.current) ro.observe(toolbarRef.current);
      if (belowCanvasRef.current) ro.observe(belowCanvasRef.current);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      if (window.visualViewport) window.visualViewport.removeEventListener("resize", measure);
      if (ro) ro.disconnect();
    };
  }, [tool, planMode, editingWallLen, editingParallelDim, namingId, showBelow, showAbove, belowLevel, aboveLevel, fullscreen]);

  const viewBox = vb || { x: 0, y: 0, w: dims.w, h: dims.h };

  // The drawing itself is rendered inside a <g rotate(rotationDeg, ...)>
  // pivoting on the current viewBox's center (see the <svg> below), so a
  // raw screen tap first lands in that pre-rotation "viewBox space" and has
  // to be rotated back by -rotationDeg to recover the element coordinates
  // it actually corresponds to; going the other way (element -> screen)
  // rotates forward by the same amount around the same pivot.
  function rotationPivot() { return { x: viewBox.x + viewBox.w / 2, y: viewBox.y + viewBox.h / 2 }; }
  function toScreen(p) {
    const rect = svgRef.current.getBoundingClientRect();
    const sp = rotationDeg ? rotatePoint(p, rotationDeg, rotationPivot()) : p;
    return { x: ((sp.x - viewBox.x) / viewBox.w) * rect.width, y: ((sp.y - viewBox.y) / viewBox.h) * rect.height };
  }
  function svgPointRaw(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    const relX = (p.clientX - rect.left) / rect.width;
    const relY = (p.clientY - rect.top) / rect.height;
    const sp = { x: viewBox.x + relX * viewBox.w, y: viewBox.y + relY * viewBox.h };
    return rotationDeg ? rotatePoint(sp, -rotationDeg, rotationPivot()) : sp;
  }
  function pxToMeters(px) { return +((px / GRID) * scale).toFixed(2); }
  // Every discrete action (add, delete, edit a length, close a room...)
  // snapshots the pre-change elements onto a real undo history. A drag
  // gesture calls this on every pointer move, though — snapshotting each
  // of those would flood history with intermediate frames of the same
  // drag, so beginDrag* takes the one snapshot for the whole gesture
  // up front (via pushHistory) and sets isDraggingRef so this skips its
  // own auto-push until the drag ends.
  function pushHistory() {
    setHistory(h => {
      const next = [...h, elements];
      return next.length > 60 ? next.slice(next.length - 60) : next;
    });
  }
  function commitElements(next) {
    if (!isDraggingRef.current) pushHistory();
    if (redoStack.length) setRedoStack([]);
    onChange(next);
  }
  function patchSelected(patch) { if (!selectedId) return; commitElements(elements.map(e => e.id === selectedId ? { ...e, ...patch } : e)); }

  // Swaps a door for a window (or vice versa) in place — same wallId, x/y
  // and width, so the opening stays exactly where it was drawn, instead of
  // making the user delete and re-place it just because they picked the
  // wrong family on-site. Height/peitoril/doorType-windowType/panels reset
  // to that family's own usual defaults, since a door's 2.10m height paired
  // with a window's 1.00m peitoril would poke out of the wall's top.
  function substituteOpening(el, newType) {
    const tagPrefix = newType === "door" ? "P" : "J";
    const count = elements.filter(x => x.type === newType && x.id !== el.id).length;
    const shared = { id: el.id, x: el.x, y: el.y, wallId: el.wallId, tag: `${tagPrefix}${count + 1}`, width: el.width, condition: el.condition || "A confirmar", demolir: el.demolir, construir: el.construir, tagRotation: el.tagRotation };
    const next = newType === "door"
      ? { ...shared, type: "door", height: 2.10, doorType: DOOR_TYPES[0], panels: 1 }
      : { ...shared, type: "window", height: 1.20, peitoril: 1.00, windowType: WINDOW_TYPES[0], panels: 2 };
    commitElements(elements.map(e => e.id === el.id ? next : e));
    setSelectedId(next.id);
  }

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
    setVb(fitViewBoxToElements(elements, dims.w, dims.h));
    setRotationDeg(0);
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
      // A second finger arriving always means "pinch now", even if the
      // first one had already grabbed a wall/endpoint/opening — otherwise
      // that stale drag session can make the element jump once fingers
      // start lifting back to a single touch.
      setDragSession(null);
      twist.current = null;
      const [a, b] = e.touches;
      pinch.current = {
        d: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
        mid: { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 },
        vb: viewBox,
      };
    } else if (e.touches.length === 3) {
      // A third finger switches the gesture to rotate-only, kept separate
      // from plain two-finger pan/zoom so a normal pan never picks up an
      // accidental twist — rotating is deliberate, a third finger on top.
      setDragSession(null);
      pinch.current = null;
      const [a, b] = e.touches;
      twist.current = { angle: Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * (180 / Math.PI), rotation: rotationDeg };
    }
  }
  function onTouchMoveCanvas(e) {
    if (e.touches.length === 2 && pinch.current) {
      if (e.cancelable) e.preventDefault();
      const [a, b] = e.touches;
      const rect = svgRef.current.getBoundingClientRect();
      const start = pinch.current;
      const d = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      const mid = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
      const startVb = start.vb;
      const factor = start.d / Math.max(1, d);
      const newW = Math.min(4000, Math.max(60, startVb.w * factor));
      const newH = newW * (startVb.h / startVb.w);
      // Both driven by the same two fingers at once — how far apart they
      // are zooms, how far their midpoint travels pans — so a project too
      // big for the frame can be dragged into view and zoomed to fit in
      // one motion, the same combined gesture people already know from map
      // apps. Rotating is a separate, deliberate third-finger gesture below.
      const dxWorld = (mid.x - start.mid.x) * (startVb.w / rect.width);
      const dyWorld = (mid.y - start.mid.y) * (startVb.h / rect.height);
      const newCx = startVb.x + startVb.w / 2 - dxWorld;
      const newCy = startVb.y + startVb.h / 2 - dyWorld;
      setVb({ x: newCx - newW / 2, y: newCy - newH / 2, w: newW, h: newH });
      return;
    }
    if (e.touches.length === 3 && twist.current) {
      if (e.cancelable) e.preventDefault();
      const [a, b] = e.touches;
      const start = twist.current;
      const angle = Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * (180 / Math.PI);
      setRotationDeg(start.rotation + (angle - start.angle));
      return;
    }
    if (e.touches.length === 1 && (dragSession || draggingLabel || draggingDimLabel)) onCanvasPointerMove(e);
  }
  function onTouchEndCanvas(e) {
    if (e.touches.length < 2) pinch.current = null;
    if (e.touches.length < 3) twist.current = null;
    if (e.touches.length === 0) { onCanvasPointerUp(); endWallGesture(); endMarquee(); }
  }

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
  // Like nearestWall, but with a real cutoff distance instead of always
  // returning the closest wall no matter how far — used to decide whether
  // a tap actually landed on a wall at all (see ambiente's "tap a wall to
  // add both its ends" below), not just to attach an opening to one.
  function nearestWallWithinTolerance(p, screenPxTolerance = 16) {
    const walls = elements.filter(el => el.type === "wall");
    if (!walls.length) return null;
    let best = null, bestD = Infinity;
    walls.forEach(w => {
      const proj = projectPointOnSegment(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      const d = dist(p, proj);
      if (d < bestD) { bestD = d; best = { wall: w, proj }; }
    });
    const worldTolerance = screenPxTolerance * (viewBox.w / dims.w);
    return best && bestD <= worldTolerance ? best : null;
  }
  // Finds an existing wall/stair endpoint within tolerance so two segments
  // can be made to share an exact point (closing a shape) even when that
  // point doesn't land on a grid intersection — angled walls in particular
  // rarely meet the grid exactly. Returns null (not a fallback point) when
  // nothing is close, so callers can still try angle-snapping first.
  function findNearbyEndpoint(p, excludeWallId, excludeIds, extraWalls) {
    // Expressed as a screen-pixel radius, not a fixed world-space one — a
    // fixed SVG-unit tolerance is tied to the drawing's real-world scale,
    // so two corners genuinely closer together than it (like either end of
    // a 0.57m wall) could never be told apart no matter how far the user
    // zoomed in. Converting from screen pixels means zooming in actually
    // buys more precision, same as any CAD tool.
    const screenPxTolerance = 14;
    const TOL = screenPxTolerance * (viewBox.w / dims.w);
    let best = null, bestD = TOL;
    elements.forEach(e => {
      if (e.type !== "wall" && e.type !== "stair") return;
      if (e.id === excludeWallId) return;
      if (excludeIds && excludeIds.has(e.id)) return;
      [{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }].forEach(pt => {
        const d = dist(p, pt);
        if (d < bestD) { bestD = d; best = pt; }
      });
    });
    // Ghost (above/below level) walls — same corners, just from a
    // different level's own list instead of this one's elements.
    (extraWalls || []).forEach(e => {
      [{ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 }].forEach(pt => {
        const d = dist(p, pt);
        if (d < bestD) { bestD = d; best = pt; }
      });
    });
    return best;
  }
  // Like findNearbyEndpoint, but for meeting another wall mid-span (a
  // T-junction) instead of only at its two corners — a new dividing wall
  // almost never gets tapped exactly onto the target wall's line, and
  // without this it fell back to the plain grid snap, which only lines up
  // by coincidence: a wall whose own position came from a typed length or
  // a free drag (both happen elsewhere in this file) isn't necessarily on
  // a grid line at all, so the gap or overshoot this was leaving behind
  // was persistent, not just an unlucky tap. Same screen-pixel tolerance
  // and null-when-nothing-close contract as findNearbyEndpoint. When a
  // fixed anchor point is already placed (the wall's other end), prefers
  // the point where a ray at a clean 0/45/90° angle from that anchor
  // crosses the target wall's own line, over the plain closest-point-on-
  // that-line to the raw tap. A
  // T-junction tap is meant to land the new wall square against the one
  // it's meeting — snapping only to "nearest point on that wall's line"
  // (the old behavior) ignored the anchor entirely and left the wall a
  // fraction of a degree off orthogonal whenever the tap wasn't pixel
  // perfect, which on a touchscreen it never is. Falls back to the plain
  // closest point whenever there's no anchor yet, the ray runs parallel to
  // the target wall (no clean crossing), the crossing falls well outside
  // the target wall's own span, or it lands far from where the user
  // actually tapped (the wall isn't really perpendicular/parallel here,
  // so forcing it would silently redirect the tap somewhere else on the
  // line).
  function findNearbyWallLineOrtho(rawP, fixedPt, excludeWallId, extraWalls) {
    const screenPxTolerance = 14;
    const TOL = screenPxTolerance * (viewBox.w / dims.w);
    let best = null, bestD = TOL, bestWall = null;
    elements.forEach(e => {
      if (e.type !== "wall") return;
      if (e.id === excludeWallId) return;
      const proj = projectPointOnSegment(rawP, { x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 });
      const d = dist(rawP, proj);
      if (d < bestD) { bestD = d; best = proj; bestWall = e; }
    });
    // Ghost (above/below level) walls, same as findNearbyEndpoint — lets a
    // new wall's mid-span meet one on the ghost level too, not just its
    // corners.
    (extraWalls || []).forEach(e => {
      const proj = projectPointOnSegment(rawP, { x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 });
      const d = dist(rawP, proj);
      if (d < bestD) { bestD = d; best = proj; bestWall = e; }
    });
    if (!best || !fixedPt) return best;
    const dx = best.x - fixedPt.x, dy = best.y - fixedPt.y;
    if (Math.hypot(dx, dy) < 1e-6) return best;
    const angle = Math.atan2(dy, dx);
    const step = Math.PI / 4;
    const nearest = Math.round(angle / step) * step;
    const rdx = Math.cos(nearest), rdy = Math.sin(nearest);
    const wdx = bestWall.x2 - bestWall.x1, wdy = bestWall.y2 - bestWall.y1;
    const denom = rdx * wdy - rdy * wdx;
    if (Math.abs(denom) < 1e-6) return best;
    const t = ((bestWall.x1 - fixedPt.x) * wdy - (bestWall.y1 - fixedPt.y) * wdx) / denom;
    if (t <= 0) return best;
    const ix = fixedPt.x + rdx * t, iy = fixedPt.y + rdy * t;
    const wlen = Math.hypot(wdx, wdy) || 1;
    const s = ((ix - bestWall.x1) * wdx + (iy - bestWall.y1) * wdy) / (wlen * wlen);
    if (s < -0.05 || s > 1.05) return best;
    if (dist({ x: ix, y: iy }, rawP) > TOL * 3) return best;
    return { x: ix, y: iy };
  }
  // Snaps freePt's angle relative to fixedPt to the nearest 45° step
  // whenever it's already close — the same "ortho" nudge any CAD sketch
  // tool needs, since a freehand drag on a touchscreen essentially never
  // lands on an exactly horizontal/vertical/diagonal angle on its own.
  // Closeness is judged by the actual sideways (perpendicular) pixel
  // deviation at the current drag distance, not by the angle alone — a
  // fixed angular tolerance is razor-thin on a short wall but enormous
  // (impossible to pull free of) on a long one, since the same few degrees
  // sweep a much bigger sideways distance the farther out you are.
  function angleSnap(fixedPt, freePt, pixelTol = 10) {
    const dx = freePt.x - fixedPt.x, dy = freePt.y - fixedPt.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) return freePt;
    const angle = Math.atan2(dy, dx);
    const step = Math.PI / 4;
    const nearest = Math.round(angle / step) * step;
    const perpDeviation = Math.abs(Math.sin(angle - nearest)) * d;
    if (perpDeviation > pixelTol) return freePt;
    return { x: fixedPt.x + Math.cos(nearest) * d, y: fixedPt.y + Math.sin(nearest) * d };
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
    // Checked before rooms/pisos — a manually-placed cota's line/label
    // often sits right over a room's open floor area, which would
    // otherwise always win the point-in-polygon test below and make the
    // cota impossible to tap at all once it's inside a room.
    const cotas = elements.filter(e => e.type === "cota");
    let bestCota = null, bestCotaD = Infinity;
    cotas.forEach(el => {
      const g = cotaGeometry(el, elements, scale);
      if (!g) return;
      const proj = projectPointOnSegment(p, { x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 });
      const d = Math.min(dist(p, proj), dist(p, { x: g.labelX, y: g.labelY }));
      if (d < bestCotaD) { bestCotaD = d; bestCota = el; }
    });
    if (bestCota && bestCotaD < 14) return bestCota;
    // Checked before rooms: a "piso" zone is drawn specifically because it
    // doesn't just mirror the room underneath it (a wet-area-only tile
    // zone, say), so a tap landing inside one most likely means that zone,
    // not the room it happens to sit inside.
    const floorPolys = elements.filter(e => e.type === "floor");
    const hitFloor = floorPolys.find(f => pointInPolygon(p, f.points));
    if (hitFloor) return hitFloor;
    const roomPolys = elements.filter(e => e.type === "room");
    const hitRoom = roomPolys.find(r => pointInPolygon(p, r.points));
    if (hitRoom) return hitRoom;
    return null;
  }
  // Like findAt, but only ever matches a wall from the ghost level(s)
  // currently toggled on — used solely as the Alinhar tool's reference
  // pick, so a wall on this level can be aligned straight onto one from
  // the level above/below without that other wall needing to exist here.
  function findGhostWallAt(p) {
    const TOL = 16 * (viewBox.w / dims.w);
    let best = null, bestD = TOL;
    ghostWalls.forEach(w => {
      const proj = projectPointOnSegment(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      const d = dist(p, proj);
      if (d < bestD) { bestD = d; best = w; }
    });
    return best;
  }

  function elementBounds(el) {
    if (el.type === "wall" || el.type === "stair") {
      return { minX: Math.min(el.x1, el.x2), maxX: Math.max(el.x1, el.x2), minY: Math.min(el.y1, el.y2), maxY: Math.max(el.y1, el.y2) };
    }
    if (el.type === "door" || el.type === "window" || el.type === "luminaria") {
      return { minX: el.x, maxX: el.x, minY: el.y, maxY: el.y };
    }
    if (el.type === "room" || el.type === "floor") {
      const xs = el.points.map(p => p.x), ys = el.points.map(p => p.y);
      return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    }
    if (el.type === "cota") {
      const g = cotaGeometry(el, elements, scale);
      if (!g) return null;
      return { minX: Math.min(g.x1, g.x2, g.labelX), maxX: Math.max(g.x1, g.x2, g.labelX), minY: Math.min(g.y1, g.y2, g.labelY), maxY: Math.max(g.y1, g.y2, g.labelY) };
    }
    return null;
  }
  // Marquee selection is "fully inside the box", not "touches the box" —
  // predictable (a small box dragged in a corner never grabs a huge wall
  // that just happens to pass through it) and matches what most drawing
  // tools do for a plain drag-select.
  function elementsInRect(rect) {
    const rx1 = Math.min(rect.x1, rect.x2), rx2 = Math.max(rect.x1, rect.x2);
    const ry1 = Math.min(rect.y1, rect.y2), ry2 = Math.max(rect.y1, rect.y2);
    return elements.filter(el => {
      if (!phaseVisible(el)) return false;
      const b = elementBounds(el);
      return b && b.minX >= rx1 && b.maxX <= rx2 && b.minY >= ry1 && b.maxY <= ry2;
    });
  }
  function deleteSelectionBatch() {
    if (selectionIds.size === 0) return;
    const targets = elements.filter(el => selectionIds.has(el.id));
    // A wall taken out this way takes its own doors/windows with it, same
    // as a single Apagar tap on that wall already does.
    const attached = elements.filter(el => (el.type === "door" || el.type === "window") && selectionIds.has(el.wallId) && !selectionIds.has(el.id));
    const batch = [...targets, ...attached];
    const ids = new Set(batch.map(b => b.id));
    setDeletedStack(s => [...s, batch]);
    if (selectedId && ids.has(selectedId)) setSelectedId(null);
    commitElements(elements.filter(el => !ids.has(el.id)));
    setSelectionIds(new Set());
  }

  // Shared by the tap-tap chain (handleTap below) and the press-drag-release
  // gesture (endWallGesture) — one wall/stair segment from start to end,
  // whichever method placed those two points.
  function placeWallOrStairSegment(kind, start, end) {
    if (kind === "parede") {
      const length = pxToMeters(dist(start, end));
      const wallCount = elements.filter(x => x.type === "wall").length;
      // Drawn while looking at the "Construção Nova" view, a wall is
      // obviously meant to be part of that new construction — tag it as
      // such automatically, or it'd vanish the instant it's drawn (this
      // view only shows elements already marked construir).
      const el = { id: uid(), type: "wall", x1: start.x, y1: start.y, x2: end.x, y2: end.y, tag: `P-${wallCount + 1}`, length, height: wallHeightDefault, wallType: WALL_TYPES[0], finishA: "A definir", paintColorA: "#E8E4DA", finishB: "A definir", paintColorB: "#E8E4DA", condition: "A confirmar", demolir: false, construir: phaseView === "novo" };
      commitElements([...elements, el]);
      return el;
    }
    const count = elements.filter(x => x.type === "stair").length;
    const el = { id: uid(), type: "stair", x1: start.x, y1: start.y, x2: end.x, y2: end.y, tag: `ES-${count + 1}`, toLevelId: aboveLevel?.id || "", width: 1.0, condition: "A confirmar" };
    commitElements([...elements, el]);
    return el;
  }

  function handleTap(e) {
    if (justDraggedOnCanvas.current) { justDraggedOnCanvas.current = false; return; }
    if (e.touches && e.touches.length > 1) return;
    if (draggingLabel || draggingDimLabel) return;
    e.preventDefault();
    // Must be the true unsnapped pointer position, not svgPoint()'s
    // grid-snapped one — findNearbyEndpoint below does its own
    // fine-grained (screen-pixel) search, and pre-rounding the input to
    // the 20-unit grid first can throw away more precision than that
    // search tolerance, silently pulling the match onto the wrong corner
    // whenever two corners (or a short wall's own two ends) sit closer
    // together than the grid step.
    const rawP = svgPointRaw(e);
    // Ambiente needs this too — its polygon vertices are meant to trace
    // existing wall corners, and missing them by a few px (same issue
    // walls had) leaves gaps that never actually close the shape.
    let p = rawP;
    if (tool === "parede" || tool === "escada" || tool === "ambiente") {
      // Drawing a wall/escada also snaps onto whichever ghost level (the
      // one/below above) is currently toggled on — otherwise the only way
      // to land a new wall exactly on top of one from another level was
      // eyeballing it against the faint dashed guide.
      const snapExtra = (tool === "parede" || tool === "escada") ? ghostWalls : undefined;
      const endpointHit = findNearbyEndpoint(rawP, null, undefined, snapExtra);
      const wallLineHit = !endpointHit && (tool === "parede" || tool === "escada") ? findNearbyWallLineOrtho(rawP, pending, null, snapExtra) : null;
      p = endpointHit || wallLineHit || { x: snap(rawP.x), y: snap(rawP.y) };
      // A freehand second tap almost never lands on an exact 0/45/90°
      // angle from the first point — nudge it there when it's already
      // close, so walls stay orthogonal instead of drifting off-angle.
      // Skipped once a T-junction snap already placed the point exactly
      // on the target wall's own line — angle-snapping it from there
      // could pull it right back off that wall.
      if (!endpointHit && !wallLineHit && pending && (tool === "parede" || tool === "escada")) p = angleSnap(pending, p);
    }

    if (tool === "selecionar") {
      const hit = findAt(p);
      if (multiSelectMode) {
        if (hit) toggleSelectionMember(hit.id);
        return;
      }
      setSelectedId(hit ? hit.id : null);
      if (selectionIds.size) setSelectionIds(new Set());
      return;
    }

    if (tool === "cortar") {
      const hit = findAt(p);
      if (!hit || hit.type !== "wall") return;
      const proj = projectPointOnSegment(rawP, { x: hit.x1, y: hit.y1 }, { x: hit.x2, y: hit.y2 });
      const dx = hit.x2 - hit.x1, dy = hit.y2 - hit.y1, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const cutPx = Math.min(len - 4, Math.max(4, proj.t * len));
      splitWallAt(hit, snap(hit.x1 + ux * cutPx), snap(hit.y1 + uy * cutPx));
      return;
    }

    if (tool === "estender") {
      const hit = findAt(p);
      if (!hit || hit.type !== "wall") return;
      if (!extendSourceId) { setExtendSourceId(hit.id); setExtendMsg(""); return; }
      if (hit.id === extendSourceId) { setExtendSourceId(null); return; }
      const source = wallsById[extendSourceId];
      setExtendSourceId(null);
      if (!source) return;
      const err = extendWallTo(source, hit);
      setExtendMsg(err || "");
      return;
    }

    if (tool === "alinhar") {
      // First tap: the wall to align TO (the reference, stays put) — can
      // be a real wall on this level OR a ghost wall from the level
      // above/below currently toggled on ("ver [nível]"), so a floor's
      // wall can finally be aligned straight onto the one below it
      // instead of only ever referencing another wall on the same level.
      if (!alignRef) {
        const hit = findAt(p) || findGhostWallAt(p);
        if (!hit || hit.type !== "wall") return;
        setAlignRef(hit);
        setAlignMsg("");
        return;
      }
      // Second tap: the wall to MOVE so it lines up with the reference —
      // always a real wall on THIS level, since that's the one being
      // edited (the ghost level's own wall is read-only here).
      const hit = findAt(p);
      if (!hit || hit.type !== "wall") return;
      if (hit.id === alignRef.id) { setAlignRef(null); return; }
      const ref = alignRef;
      setAlignRef(null);
      const err = alignWallTo(hit, ref);
      setAlignMsg(err || "");
      return;
    }

    if (tool === "cota") {
      if (cotaMode === "espessura") {
        const hit = findAt(p);
        if (!hit || hit.type !== "wall") return;
        const dx = hit.x2 - hit.x1, dy = hit.y2 - hit.y1, len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const atPx = Math.max(0, Math.min(len, (p.x - hit.x1) * ux + (p.y - hit.y1) * uy));
        const el = { id: uid(), type: "cota", mode: "espessura", wallId: hit.id, atPx };
        commitElements([...elements, el]);
        setSelectedId(el.id);
        return;
      }
      if (cotaMode === "opening") {
        const hit = findAt(p);
        if (!hit || (hit.type !== "door" && hit.type !== "window")) return;
        const el = { id: uid(), type: "cota", mode: "opening", refId: hit.id };
        commitElements([...elements, el]);
        setSelectedId(el.id);
        return;
      }
      // face / eixo / faceExt: two walls tapped in sequence, same pattern
      // as Alinhar/Estender above — first tap holds, second tap commits.
      const hit = findAt(p);
      if (!hit || hit.type !== "wall") return;
      if (!cotaPendingWallId) { setCotaPendingWallId(hit.id); return; }
      if (hit.id === cotaPendingWallId) { setCotaPendingWallId(null); return; }
      const el = { id: uid(), type: "cota", mode: cotaMode, wallAId: cotaPendingWallId, wallBId: hit.id };
      setCotaPendingWallId(null);
      commitElements([...elements, el]);
      setSelectedId(el.id);
      return;
    }

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
      placeWallOrStairSegment("parede", pending, p);
      // Chain mode: keep drawing from this wall's endpoint instead of
      // requiring a fresh start tap for every segment. Tap the same point
      // again (or reselect the Parede tool) to end the chain.
      setPending(p);
      return;
    }

    if (tool === "escada") {
      if (!pending) { setPending(p); return; }
      if (p.x === pending.x && p.y === pending.y) { setPending(null); return; }
      const el = placeWallOrStairSegment("escada", pending, p);
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

    if (tool === "ambiente" || tool === "piso") {
      // "Piso" traces the exact same way "Ambiente" does (tap-inside auto
      // or manual corner-by-corner) but produces an independent "floor"
      // element instead of a "room" — its own zone, not tied to a room's
      // boundary, since real flooring often doesn't match room outlines
      // one-to-one (continuous tile through a hallway spanning several
      // rooms, a wet-area-only zone inside a bigger bathroom, a deck that
      // isn't a room at all).
      const isPiso = tool === "piso";
      const targetType = isPiso ? "floor" : "room";
      if (polygon.length === 0) {
        const hitExisting = elements.find(e => e.type === targetType && pointInPolygon(p, e.points));
        if (hitExisting) {
          if (isPiso || planMode === "forro") { setSelectedId(hitExisting.id); return; }
          setNamingId(hitExisting.id); setNamingValue(hitExisting.name || "");
          return;
        }
      }
      if (planMode === "forro") return;
      if (ambienteAuto && polygon.length === 0) {
        setAutoRoomMsg("");
        const wallSegs = elements.filter(e => e.type === "wall").map(w => ({
          x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2,
          halfThickPx: (wallThicknessM(w) / 2 / scale) * GRID,
        }));
        // Use the raw tap position, not the endpoint-snapped p — snapping
        // this click onto a nearby wall corner (meant for tracing exact
        // vertices, not for "click somewhere inside the room") could land
        // it right on/against a wall, starting the flood fill from a
        // sliver cell instead of the room's actual open interior.
        const traced = traceEnclosedRoomNear(wallSegs, rawP, GRID, scale);
        if (!traced) {
          setAutoRoomMsg("Não achei um contorno fechado aqui — verifique se as paredes se encontram, ou desenhe os pontos manualmente.");
          return;
        }
        let area = 0;
        for (let i = 0; i < traced.length; i++) {
          const a = traced[i], b = traced[(i + 1) % traced.length];
          area += a.x * b.y - b.x * a.y;
        }
        area = Math.abs(area / 2);
        const areaM2 = +((area / (GRID * GRID)) * scale * scale).toFixed(2);
        const el = isPiso
          ? { id: uid(), type: "floor", points: traced, area: areaM2, floorType: FLOOR_TYPES[0], floorColor: "#B08A5C" }
          : { id: uid(), type: "room", points: traced, area: areaM2, roomId: null, floorFinish: "A definir", floorColor: "#D9D4C8", ceilingFinish: "A definir" };
        commitElements([...elements, el]);
        if (isPiso) { setSelectedId(el.id); } else { setNamingId(el.id); setNamingValue(`Ambiente ${elements.filter(e => e.type === "room").length + 1}`); }
        // Placing a room/floor is a one-shot action, not a mode you stay in
        // — leaving "tool" here afterward silently disabled every wall
        // dimension (editable/draggable only in "selecionar") right when
        // the user is most likely to want to check/adjust them.
        setTool("selecionar");
        return;
      }
      // Tapping precisely on a very short wall's own corner is genuinely
      // hard even zoomed in (the two ends can be just a handful of screen
      // px apart) — short enough that the shared endpoint-snap above
      // (endpointHit) almost always already resolves the tap to whichever
      // end is nearest, before this code ever sees it. So this can't
      // gate on "wasn't already an exact endpoint": for a wall shorter
      // than about twice that snap tolerance, EVERY tap on it resolves
      // to one end or the other, and the shortcut below would never
      // fire when it's needed most. Instead, always check for a nearby
      // wall LINE first and add whichever of its two ends aren't already
      // traced — falling back to a single free point only when no wall
      // is close enough at all.
      {
        const wallHit = nearestWallWithinTolerance(rawP);
        if (wallHit) {
          const w = wallHit.wall;
          const ends = [{ x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 }];
          const ref = polygon.length ? polygon[polygon.length - 1] : rawP;
          ends.sort((a, b) => dist(ref, a) - dist(ref, b));
          // A tapped corner is often shared by two walls (a T-junction or
          // the room's own closing corner) and which one comes back as
          // "nearest" can flip on sub-pixel differences — so rather than
          // only checking the wall's near end against the polygon's last
          // point, drop ANY end that's already traced anywhere in the
          // polygon (its far end could just as easily be a point placed
          // several taps ago, not only the immediately previous one).
          const toAdd = ends.filter(e => !polygon.some(q => dist(q, e) < 1));
          if (toAdd.length) {
            setLastPolygonAdd(toAdd.length);
            setPolygon([...polygon, ...toAdd]);
          }
          return;
        }
      }
      setLastPolygonAdd(1);
      setPolygon([...polygon, p]);
      return;
    }

    if (tool === "porta" || tool === "janela") {
      const hit = nearestWall(p);
      if (!hit) return;
      const type = tool === "porta" ? "door" : "window";
      const count = elements.filter(x => x.type === type).length;
      // P1, P2… for doors and J1, J2… for windows — the same short,
      // no-hyphen convention field surveys use on a door/window schedule.
      const tagPrefix = tool === "porta" ? "P" : "J";
      // Same reasoning as a new wall above: placed while viewing "Construção
      // Nova", a door/window is new construction by definition.
      const isNew = phaseView === "novo";
      const el = tool === "porta"
        ? { id: uid(), type, x: hit.proj.x, y: hit.proj.y, wallId: hit.wall.id, tag: `${tagPrefix}${count + 1}`, width: 0.8, height: 2.10, doorType: DOOR_TYPES[0], panels: 1, condition: "A confirmar", demolir: false, construir: isNew }
        : { id: uid(), type, x: hit.proj.x, y: hit.proj.y, wallId: hit.wall.id, tag: `${tagPrefix}${count + 1}`, width: 1.2, height: 1.20, peitoril: 1.00, windowType: WINDOW_TYPES[0], panels: 2, condition: "A confirmar", demolir: false, construir: isNew };
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
    const isPiso = tool === "piso";
    const el = isPiso
      ? { id: uid(), type: "floor", points: polygon, area: areaM2, floorType: FLOOR_TYPES[0], floorColor: "#B08A5C" }
      : { id: uid(), type: "room", points: polygon, area: areaM2, roomId: null, floorFinish: "A definir", floorColor: "#D9D4C8", ceilingFinish: "A definir" };
    commitElements([...elements, el]);
    setPolygon([]);
    if (isPiso) { setSelectedId(el.id); } else { setNamingId(el.id); setNamingValue(`Ambiente ${elements.filter(e => e.type === "room").length + 1}`); }
    setTool("selecionar");
  }

  function saveName() {
    if (namingId) onNameRoom(namingId, namingValue.trim());
    setNamingId(null); setNamingValue("");
  }
  function deleteRoom(id) {
    const room = elements.find(e => e.id === id);
    if (!room) { setNamingId(null); setNamingValue(""); return; }
    setDeletedStack(s => [...s, [room]]);
    commitElements(elements.filter(e => e.id !== id));
    setNamingId(null); setNamingValue("");
  }

  function undoLast() {
    if (tool === "ambiente" && polygon.length > 0) {
      setPolygon(polygon.slice(0, -Math.min(lastPolygonAdd, polygon.length)));
      return;
    }
    if (tool === "parede" && pending && elements.length) {
      const last = elements[elements.length - 1];
      // Mid-chain: undo the last segment but keep the chain going from its
      // start point, instead of just dropping the pending point. This is
      // itself a kind of undo, so it bypasses commitElements/history —
      // "Recente" shouldn't need pressing twice to get past its own effect.
      if (last.type === "wall" && last.x2 === pending.x && last.y2 === pending.y) {
        // Removes the whole segment, including its start point — leaving
        // it as the new pending point drew a dangling dot on the canvas
        // with nothing left to anchor it to.
        setRedoStack(r => [...r, elements]);
        onChange(elements.slice(0, -1));
        setPending(null);
        return;
      }
    }
    if (pending) { setPending(null); return; }
    // Real undo: restore the elements as they were before the last
    // discrete action (add, delete, edit, drag...), not just whatever
    // happens to be the last entry in the current array — that broke on
    // anything that wasn't a plain "add" (e.g. undoing a move deleted an
    // unrelated element instead of moving the wall back).
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setRedoStack(r => [...r, elements]);
    onChange(prev);
  }
  function redoLast() {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(r => r.slice(0, -1));
    setHistory(h => [...h, elements]);
    onChange(next);
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

  function tryTrimCorner() {
    if (!selected || selected.type !== "wall") return;
    const other = findCornerWall(selected, elements);
    if (!other) return;
    const trimmed = trimWallsToCorner(selected, other);
    if (!trimmed) return;
    const newA = { ...selected, ...trimmed.a, length: pxToMeters(dist({ x: trimmed.a.x1, y: trimmed.a.y1 }, { x: trimmed.a.x2, y: trimmed.a.y2 })) };
    const newB = { ...other, ...trimmed.b, length: pxToMeters(dist({ x: trimmed.b.x1, y: trimmed.b.y1 }, { x: trimmed.b.x2, y: trimmed.b.y2 })) };
    commitElements(elements.map(e => (e.id === newA.id ? newA : e.id === newB.id ? newB : e)));
  }

  // Shared by the "Cortar parede..." distance field (splitSelectedWallAt)
  // and the tap-to-cut "cortar" tool — both just need to hand it the wall
  // and where along it to cut.
  function splitWallAt(wall, mx, my) {
    if ((mx === wall.x1 && my === wall.y1) || (mx === wall.x2 && my === wall.y2)) return;
    const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const wallCount = elements.filter(x => x.type === "wall").length;
    const partA = { ...wall, id: uid(), x2: mx, y2: my, tag: `P-${wallCount + 1}`, length: pxToMeters(dist({ x: wall.x1, y: wall.y1 }, { x: mx, y: my })) };
    const partB = { ...wall, id: uid(), x1: mx, y1: my, tag: `P-${wallCount + 2}`, length: pxToMeters(dist({ x: mx, y: my }, { x: wall.x2, y: wall.y2 })) };
    const midPos = (mx - wall.x1) * ux + (my - wall.y1) * uy;
    const next = elements.filter(e => e.id !== wall.id).map(e => {
      if (e.wallId !== wall.id) return e;
      const pos = (e.x - wall.x1) * ux + (e.y - wall.y1) * uy;
      return { ...e, wallId: pos <= midPos ? partA.id : partB.id };
    });
    next.push(partA, partB);
    commitElements(next);
    setSelectedId(partA.id);
  }
  function splitSelectedWallAt(distM) {
    if (!selected || selected.type !== "wall") return;
    const dx = selected.x2 - selected.x1, dy = selected.y2 - selected.y1, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const cutPx = Math.min(len - 4, Math.max(4, (toNum(distM) / scale) * GRID));
    splitWallAt(selected, snap(selected.x1 + ux * cutPx), snap(selected.y1 + uy * cutPx));
    setSplittingWall(null);
  }

  // "Estender": grows or shrinks `wall` so whichever of its two ends is
  // nearer `target` lands exactly on target's own (infinite) line —
  // exactly a CAD extend/trim, single-target. Reuses moveWallEndAndLinked
  // so it gets the same linked-corner carrying, room auto-refresh and
  // history push a drag or a typed length already get. Returns a message
  // to show the user when it can't do anything (parallel walls, or the
  // line only crosses target's centerline well outside target's own
  // span — not somewhere calling it "reaching that wall" would make sense).
  function extendWallTo(wall, target) {
    const d1x = wall.x2 - wall.x1, d1y = wall.y2 - wall.y1;
    const d2x = target.x2 - target.x1, d2y = target.y2 - target.y1;
    const denom = d1x * d2y - d1y * d2x;
    if (Math.abs(denom) < 1e-6) return "Essa parede é paralela — não tem como esticar até ela.";
    const t = ((target.x1 - wall.x1) * d2y - (target.y1 - wall.y1) * d2x) / denom;
    const ix = wall.x1 + d1x * t, iy = wall.y1 + d1y * t;
    const targetLenSq = d2x * d2x + d2y * d2y || 1;
    const s = ((ix - target.x1) * d2x + (iy - target.y1) * d2y) / targetLenSq;
    if (s < -0.05 || s > 1.05) return "Essa parede não chega até ali — o cruzamento fica fora dela.";
    const d1sq = (ix - wall.x1) ** 2 + (iy - wall.y1) ** 2;
    const d2sq = (ix - wall.x2) ** 2 + (iy - wall.y2) ** 2;
    const movingEnd = d1sq < d2sq ? "start" : "end";
    const oldMoving = movingEnd === "start" ? { x: wall.x1, y: wall.y1 } : { x: wall.x2, y: wall.y2 };
    moveWallEndAndLinked(wall.id, movingEnd, oldMoving, { x: ix, y: iy });
    return null;
  }
  // "Alinhar": shifts `target` sideways (perpendicular to its own line) by
  // exactly the offset needed to make it collinear with `ref` — same
  // simple "move the whole wall" semantics as dragging it by hand (its
  // own doors/windows carried along, no attempt to drag along whatever
  // else was touching its old corners), just computed instead of eyeballed.
  // Only makes sense between two roughly parallel walls — a corridor wall
  // continued in a separate segment that ended up a hair off the same
  // line, not two walls meeting at a corner (that's what Estender/the
  // endpoint snap are for).
  function alignWallTo(target, ref) {
    const tdx = target.x2 - target.x1, tdy = target.y2 - target.y1;
    const rdx = ref.x2 - ref.x1, rdy = ref.y2 - ref.y1;
    const tlen = Math.hypot(tdx, tdy) || 1, rlen = Math.hypot(rdx, rdy) || 1;
    const tux = tdx / tlen, tuy = tdy / tlen, rux = rdx / rlen, ruy = rdy / rlen;
    const cross = tux * ruy - tuy * rux;
    if (Math.abs(cross) > 0.05) return "Essas paredes não são paralelas — não dá para alinhar.";
    const nx = -ruy, ny = rux;
    const offset = (target.x1 - ref.x1) * nx + (target.y1 - ref.y1) * ny;
    if (Math.abs(offset) < 1) return "Essas paredes já estão alinhadas.";
    const nx1 = target.x1 - nx * offset, ny1 = target.y1 - ny * offset;
    const nx2 = target.x2 - nx * offset, ny2 = target.y2 - ny * offset;
    commitElements(elements.map(el => {
      if (el.id === target.id) return { ...el, x1: nx1, y1: ny1, x2: nx2, y2: ny2 };
      if (el.wallId === target.id) return { ...el, x: el.x - nx * offset, y: el.y - ny * offset };
      return el;
    }));
    return null;
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

  // An auto-traced room (the "Ambiente" tool's tap-once-inside mode) is
  // only ever computed at the moment it's traced — dragging, stretching or
  // straightening a wall that borders it afterward doesn't move the
  // room's own stored edges to match, so it silently goes stale: its area
  // stops matching reality and its fill visibly stops short of (or
  // overshoots) the wall's new position. Re-running each room's own trace
  // from its current centroid — using it as the "tap inside" point against
  // the wall set as it stands NOW — keeps it locked to whatever currently
  // encloses it instead of drifting out of sync with a wall move. Returns
  // the same array reference when nothing actually changed, so a caller
  // can skip committing (and thus skip pushing a needless history entry)
  // on the common case where no room bordered the wall that moved.
  function refreshAutoRooms(next) {
    const walls = next.filter(e => e.type === "wall").map(w => ({
      x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2,
      halfThickPx: (wallThicknessM(w) / 2 / scale) * GRID,
    }));
    let changed = false;
    const updated = next.map(el => {
      if (el.type !== "room" || !el.points || el.points.length < 3) return el;
      const centroid = polygonCentroid(el.points);
      const traced = traceEnclosedRoomNear(walls, centroid, GRID, scale);
      if (!traced) return el;
      let area = 0;
      for (let i = 0; i < traced.length; i++) {
        const a = traced[i], b = traced[(i + 1) % traced.length];
        area += a.x * b.y - b.x * a.y;
      }
      const areaM2 = +((Math.abs(area / 2) / (GRID * GRID)) * scale * scale).toFixed(2);
      if (areaM2 === el.area && traced.length === el.points.length && traced.every((p, i) => Math.abs(p.x - el.points[i].x) < 0.5 && Math.abs(p.y - el.points[i].y) < 0.5)) return el;
      changed = true;
      return { ...el, points: traced, area: areaM2 };
    });
    return changed ? updated : next;
  }
  // movingEnd picks which endpoint moves to hit the new length — "end"
  // (default) keeps the start fixed and stretches from x2/y2, exactly the
  // old behavior; "start" keeps the end fixed and stretches from x1/y1, so
  // tapping a specific endpoint handle can grow/shrink the wall from that
  // same end instead of always anchoring at the start.
  // Moves wallId's chosen endpoint to newMoving, carrying along any other
  // wall/stair endpoint that was exactly joined to the OLD position — the
  // shared bit of logic behind both length-editing and straightening, so
  // neither of them ever pulls a corner apart from its neighbor.
  function moveWallEndAndLinked(wallId, movingEnd, oldMoving, newMoving) {
    const linked = [];
    elements.forEach(e => {
      if ((e.type !== "wall" && e.type !== "stair") || e.id === wallId) return;
      if (dist(oldMoving, { x: e.x1, y: e.y1 }) < 3) linked.push({ id: e.id, which: "start" });
      if (dist(oldMoving, { x: e.x2, y: e.y2 }) < 3) linked.push({ id: e.id, which: "end" });
    });
    const patch = movingEnd === "end" ? { x2: newMoving.x, y2: newMoving.y } : { x1: newMoving.x, y1: newMoving.y };
    const next = elements.map(e => {
      if (e.id === wallId) {
        const n = { ...e, ...patch };
        n.length = pxToMeters(dist({ x: n.x1, y: n.y1 }, { x: n.x2, y: n.y2 }));
        return n;
      }
      const link = linked.find(l => l.id === e.id);
      if (!link) return e;
      const n = link.which === "start" ? { ...e, x1: newMoving.x, y1: newMoving.y } : { ...e, x2: newMoving.x, y2: newMoving.y };
      n.length = pxToMeters(dist({ x: n.x1, y: n.y1 }, { x: n.x2, y: n.y2 }));
      return n;
    });
    commitElements(refreshAutoRooms(next));
    ensureVisible(newMoving.x, newMoving.y);
  }
  function setWallLengthDirect(wallId, newLenM, movingEnd = "end") {
    const w = wallsById[wallId];
    if (!w) return;
    const fixed = movingEnd === "end" ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 };
    const oldMoving = movingEnd === "end" ? { x: w.x2, y: w.y2 } : { x: w.x1, y: w.y1 };
    // Typing a length must not just preserve whatever slight tilt the wall
    // already had — if it's already close to 0/45/90°, snap the direction
    // exactly first, same as dragging does, so this can also be how a
    // crooked wall gets straightened.
    const snappedDir = angleSnap(fixed, oldMoving);
    const dx = snappedDir.x - fixed.x, dy = snappedDir.y - fixed.y, dirLen = Math.hypot(dx, dy) || 1;
    const ux = dx / dirLen, uy = dy / dirLen;
    const newLenPx = Math.max(4, (toNum(newLenM) / scale) * GRID);
    const newMoving = { x: fixed.x + ux * newLenPx, y: fixed.y + uy * newLenPx };
    moveWallEndAndLinked(w.id, movingEnd, oldMoving, newMoving);
  }
  function applyWallLenEdit() {
    if (!editingWallLen) return;
    setWallLengthDirect(editingWallLen.wallId, editingWallLen.value, editingWallLen.movingEnd || "end");
    setEditingWallLen(null);
  }
  // Forces the wall onto the nearest 0/45/90° angle regardless of how far
  // off it currently is — an explicit action for when the passive 6°
  // auto-snap (drag, or typing a length) isn't enough to straighten an
  // already-crooked wall, without guessing at genuinely diagonal ones.
  function straightenWall(wallId, movingEnd) {
    const w = wallsById[wallId];
    if (!w) return;
    const fixed = movingEnd === "end" ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 };
    const oldMoving = movingEnd === "end" ? { x: w.x2, y: w.y2 } : { x: w.x1, y: w.y1 };
    const len = dist(fixed, oldMoving) || 1;
    const angle = Math.atan2(oldMoving.y - fixed.y, oldMoving.x - fixed.x);
    const step = Math.PI / 4;
    const nearest = Math.round(angle / step) * step;
    const newMoving = { x: fixed.x + Math.cos(nearest) * len, y: fixed.y + Math.sin(nearest) * len };
    moveWallEndAndLinked(w.id, movingEnd, oldMoving, newMoving);
  }

  // Editing a face-to-face dimension moves the currently selected wall
  // (rigid translation along its own perpendicular) so the gap to the
  // other, fixed wall in the pair becomes the entered value — the other
  // wall never moves.
  function applyParallelDimEdit() {
    if (!editingParallelDim) return;
    const { movingWallId, fixedWallId, value } = editingParallelDim;
    const moving = wallsById[movingWallId];
    const fixed = wallsById[fixedWallId];
    if (!moving || !fixed) { setEditingParallelDim(null); return; }
    const dx = moving.x2 - moving.x1, dy = moving.y2 - moving.y1, len = Math.hypot(dx, dy) || 1;
    const nx = -(dy / len), ny = dx / len;
    const fmx = (fixed.x1 + fixed.x2) / 2, fmy = (fixed.y1 + fixed.y2) / 2;
    const signedDistPx = (fmx - moving.x1) * nx + (fmy - moving.y1) * ny;
    const dirSign = signedDistPx >= 0 ? 1 : -1;
    const halfSumM = wallThicknessM(moving) / 2 + wallThicknessM(fixed) / 2;
    const newCenterM = Math.max(0.02, toNum(value, 0) + halfSumM);
    const newCenterPx = (newCenterM / scale) * GRID;
    const k = signedDistPx - dirSign * newCenterPx;
    const tx = k * nx, ty = k * ny;
    commitElements(elements.map(e => e.id === moving.id
      ? { ...e, x1: e.x1 + tx, y1: e.y1 + ty, x2: e.x2 + tx, y2: e.y2 + ty }
      : e));
    setEditingParallelDim(null);
  }

  // Automatic dimensions (the face-a-face pairs above, and the exterior
  // perimeter chain/overall further below) aren't stored elements — they're
  // recomputed fresh from the wall geometry every render, so there's
  // nothing to "delete" the normal way. Redundant ones a real project
  // doesn't need still have to go somewhere though, so each one gets a
  // stable string key and the level itself remembers which keys the user
  // asked to hide (level.hiddenAutoDims) — kept apart from the undo/redo
  // stack (that one's scoped to sketchElements, not level metadata), which
  // is why there's a one-tap "restaurar" to bring them all back rather
  // than relying on Voltar.
  const hiddenAutoDims = level.hiddenAutoDims || [];
  function hideAutoDim(key) { onMeta({ hiddenAutoDims: [...hiddenAutoDims, key] }); }
  function restoreAutoDims() { onMeta({ hiddenAutoDims: [] }); }

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
    // Don't commit to a drag (and snapshot history for one) on pointerdown
    // alone — a plain tap-to-edit also lands here first, and it should
    // neither pollute the undo stack nor require the pointer to move at
    // all. history/isDraggingRef only get set once real movement is seen,
    // in onLabelDragMove below. The room name (Piso tab) and the ceiling
    // finish (Forro tab) are two independent labels on the same room, so
    // which offset/rotation field this drag writes to depends on which
    // tab's label was actually grabbed, not the room itself.
    const centroid = polygonCentroid(el.points);
    const offsetField = planMode === "forro" ? "ceilingLabelOffset" : "labelOffset";
    setDraggingLabel({ id: el.id, centroid, startP: svgPointRaw(e), moved: false, offsetField });
  }
  function onLabelDragMove(e) {
    if (!draggingLabel) return;
    const p = svgPointRaw(e);
    const el = elements.find(x => x.id === draggingLabel.id);
    if (!el) return;
    if (!draggingLabel.moved) {
      if (dist(p, draggingLabel.startP) < 3) return; // still just a tap-in-progress
      pushHistory();
      isDraggingRef.current = true;
      setDraggingLabel(d => (d ? { ...d, moved: true } : d));
    }
    // Requiring the exact pointer position to stay inside the polygon
    // made this unusable on any room that tapers to a narrow point (like
    // a thin triangle) — a real finger can't trace a path that stays
    // inside a sliver only centimeters wide while sliding toward the
    // room's wider end, so the drag would just freeze. Clamp to the
    // room's bounding box instead: it still keeps the label from being
    // dragged off into unrelated parts of the canvas, but never blocks
    // reaching any part of the room's own shape.
    const xs = el.points.map(pt => pt.x), ys = el.points.map(pt => pt.y);
    const cx = Math.max(Math.min(...xs), Math.min(Math.max(...xs), p.x));
    const cy = Math.max(Math.min(...ys), Math.min(Math.max(...ys), p.y));
    const centroid = draggingLabel.centroid;
    const field = draggingLabel.offsetField;
    commitElements(elements.map(x => x.id === el.id ? { ...x, [field]: { dx: cx - centroid.x, dy: cy - centroid.y } } : x));
  }
  function onLabelDragEnd() {
    // A tap that never moved past the drag threshold — treat it as
    // "tap the label to edit" instead of silently doing nothing, the same
    // way tapping a wall's length label opens its editor directly. The
    // room name has its own free-text rename box; the ceiling finish is a
    // fixed list, so tapping it opens the room's properties panel where
    // that dropdown (and Girar nome) already live.
    if (draggingLabel && !draggingLabel.moved) {
      const el = elements.find(x => x.id === draggingLabel.id);
      if (el) {
        if (draggingLabel.offsetField === "ceilingLabelOffset") setSelectedId(el.id);
        else { setNamingId(el.id); setNamingValue(el.name || ""); }
      }
    } else if (draggingLabel) {
      // Same fix as onDimLabelDragEnd below: a real drag must suppress the
      // tap that follows this release, or lifting the finger off the label
      // silently (re)selects whatever wall happens to be underneath it.
      justDraggedOnCanvas.current = true;
    }
    setDraggingLabel(null);
    isDraggingRef.current = false;
  }

  // A pre-2D-drag save could have a plain number here (the old
  // perpendicular-only nudge) — read it back as { perp, along: 0 } so
  // existing projects don't lose their adjustment when this loads.
  function readDimNudge(wallA, otherId) {
    const raw = wallA && wallA.dimNudge && wallA.dimNudge[otherId];
    if (raw && typeof raw === "object") return raw;
    return { perp: typeof raw === "number" ? raw : 0, along: 0 };
  }
  // Lets the user manually slide a parallel-wall dimension's label freely
  // in the plane of its own dimension line — perpendicular to it (nx,ny,
  // parallel to the walls themselves) to pull it out from behind another
  // dimension it's colliding with, AND along it (ux,uy, between the two
  // wall faces) to reposition it along the line the same way the label's
  // own rotation now reads (parallel to the line, not always horizontal).
  // The nudge is stored on the wall (dimNudge, keyed by the other wall's
  // id) rather than component state so it survives VectorSketch remounting
  // on tab switch, and each axis is clamped independently — perp to the
  // pair's shared overlap span, along to the gap between the two wall
  // faces — so the label can't be dragged out of the room in either
  // direction.
  function beginDragDimLabel(wallA, otherId, ux, uy, nx, ny, overlapMin, overlapMax, faceLen, labelT, startEdit, e) {
    if (tool !== "selecionar") return;
    if (e.touches && e.touches.length > 1) return;
    e.stopPropagation(); e.preventDefault();
    const startNudge = readDimNudge(wallA, otherId);
    setDraggingDimLabel({ wallId: wallA.id, otherId, ux, uy, nx, ny, overlapMin, overlapMax, faceLen, labelT, startP: svgPointRaw(e), startNudge, moved: false, startEdit });
  }
  function onDimLabelDragMove(e) {
    if (!draggingDimLabel) return;
    const p = svgPointRaw(e);
    const d = draggingDimLabel;
    if (!d.moved) {
      if (dist(p, d.startP) < 3) return; // still just a tap-in-progress
      pushHistory();
      isDraggingRef.current = true;
      setDraggingDimLabel(s => (s ? { ...s, moved: true } : s));
    }
    const dxp = p.x - d.startP.x, dyp = p.y - d.startP.y;
    const deltaPerp = dxp * d.nx + dyp * d.ny;
    const deltaAlong = dxp * d.ux + dyp * d.uy;
    const maxPerp = Math.max(0, (d.overlapMax - d.overlapMin) / 2 - GRID / 2);
    const perp = Math.max(-maxPerp, Math.min(maxPerp, d.startNudge.perp + deltaPerp));
    // The label's un-nudged position already sits at labelT along the
    // face-to-face line (T0), not at its midpoint — clamp the ALONG offset
    // relative to that base position, keeping a small margin so the label
    // never slides on top of either wall's own face.
    const T0 = d.faceLen * d.labelT;
    const margin = Math.min(10, d.faceLen / 2);
    const alongLo = Math.min(margin - T0, d.faceLen - margin - T0);
    const alongHi = Math.max(margin - T0, d.faceLen - margin - T0);
    const along = Math.max(alongLo, Math.min(alongHi, d.startNudge.along + deltaAlong));
    commitElements(elements.map(el => el.id === d.wallId
      ? { ...el, dimNudge: { ...(el.dimNudge || {}), [d.otherId]: { perp, along } } }
      : el));
  }
  function onDimLabelDragEnd() {
    if (draggingDimLabel && !draggingDimLabel.moved) draggingDimLabel.startEdit();
    // A real drag (not just a tap-to-edit) must suppress the tap that
    // follows this release, same as endWallGesture/endMarquee already do —
    // without it, lifting the finger off the dimension line fires a plain
    // tap at that same spot, which lands on whatever wall is underneath
    // and silently selects it instead of leaving the dimension alone.
    if (draggingDimLabel && draggingDimLabel.moved) justDraggedOnCanvas.current = true;
    setDraggingDimLabel(null);
    isDraggingRef.current = false;
  }
  function rotateRoomLabel(el) {
    const field = planMode === "forro" ? "ceilingLabelRotation" : "labelRotation";
    const next = ((el[field] || 0) + 90) % 360;
    commitElements(elements.map(x => x.id === el.id ? { ...x, [field]: next } : x));
  }

  function beginDragWallMove(w, e) {
    if (tool !== "selecionar") return;
    // A second finger landing on/near the element (pinching right on top of
    // it, a very natural gesture) must not get claimed as a drag — that
    // would stopPropagation before the pinch handler on the SVG ever sees
    // it, leaving pinch-to-zoom completely dead on selected elements.
    if (e.touches && e.touches.length > 1) return;
    e.stopPropagation(); e.preventDefault();
    if (multiSelectMode) { toggleSelectionMember(w.id); return; }
    pushHistory();
    isDraggingRef.current = true;
    setSelectedId(w.id);
    setDragSession({ kind: "wall-move", id: w.id, startPointer: svgPointRaw(e), orig: { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 } });
  }
  function beginDragWallEndpoint(w, which, e) {
    if (e.touches && e.touches.length > 1) return;
    e.stopPropagation(); e.preventDefault();
    pushHistory();
    isDraggingRef.current = true;
    setSelectedId(w.id);
    const pt = which === "start" ? { x: w.x1, y: w.y1 } : { x: w.x2, y: w.y2 };
    // Any other wall whose own endpoint exactly coincides with the one
    // being dragged is a joined neighbor — it needs to move together with
    // this point, otherwise the corner splits apart during the drag. This
    // also has to be excluded from the nearby-endpoint snap below, or it'd
    // just snap the point straight back to where it already was.
    const linked = [];
    elements.forEach(e2 => {
      if ((e2.type !== "wall" && e2.type !== "stair") || e2.id === w.id) return;
      if (dist(pt, { x: e2.x1, y: e2.y1 }) < 3) linked.push({ id: e2.id, which: "start" });
      if (dist(pt, { x: e2.x2, y: e2.y2 }) < 3) linked.push({ id: e2.id, which: "end" });
    });
    setDragSession({ kind: "wall-endpoint", id: w.id, which, linked });
  }
  function beginDragOpening(el, e) {
    if (tool !== "selecionar") return;
    if (e.touches && e.touches.length > 1) return;
    e.stopPropagation(); e.preventDefault();
    if (multiSelectMode) { toggleSelectionMember(el.id); return; }
    pushHistory();
    isDraggingRef.current = true;
    setSelectedId(el.id);
    setDragSession({ kind: "opening", id: el.id, wallId: el.wallId });
  }
  function onCanvasPointerMove(e) {
    onLabelDragMove(e);
    onDimLabelDragMove(e);
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
      const w = wallsById[dragSession.id];
      const linked = dragSession.linked || [];
      // Linked (already-joined) neighbors must never be candidates for the
      // nearby-endpoint snap — they still sit at the OLD position we're
      // trying to move away from, so snapping to them would just pull the
      // point straight back and make it impossible to ever straighten.
      const linkedIds = new Set(linked.map(l => l.id));
      const hit = w && findNearbyEndpoint(p, dragSession.id, linkedIds, ghostWalls);
      const fixedPt = w ? (dragSession.which === "start" ? { x: w.x2, y: w.y2 } : { x: w.x1, y: w.y1 }) : null;
      const wallLineHit = !hit && w && findNearbyWallLineOrtho(p, fixedPt, dragSession.id, ghostWalls);
      let sp = hit || wallLineHit || { x: snap(p.x), y: snap(p.y) };
      if (!hit && !wallLineHit && w) {
        sp = angleSnap(fixedPt, sp);
      }
      commitElements(elements.map(el => {
        if (el.id === dragSession.id) {
          const next = dragSession.which === "start" ? { ...el, x1: sp.x, y1: sp.y } : { ...el, x2: sp.x, y2: sp.y };
          next.length = pxToMeters(dist({ x: next.x1, y: next.y1 }, { x: next.x2, y: next.y2 }));
          return next;
        }
        const link = linked.find(l => l.id === el.id);
        if (link) {
          const next = link.which === "start" ? { ...el, x1: sp.x, y1: sp.y } : { ...el, x2: sp.x, y2: sp.y };
          next.length = pxToMeters(dist({ x: next.x1, y: next.y1 }, { x: next.x2, y: next.y2 }));
          return next;
        }
        return el;
      }));
    } else if (dragSession.kind === "opening") {
      const w = wallsById[dragSession.wallId];
      if (!w) return;
      const proj = projectPointOnSegment(p, { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 });
      commitElements(elements.map(el => el.id === dragSession.id ? { ...el, x: proj.x, y: proj.y } : el));
    }
  }
  function onCanvasPointerUp() {
    onLabelDragEnd(); onDimLabelDragEnd();
    // Dragging a wall or one of its endpoints commits on every move frame
    // (isDraggingRef suppresses the history push, not the commit itself),
    // so by the time the pointer lifts, `elements` already holds the
    // wall's final settled position — the right moment to re-check any
    // room it might have pulled stale, once, instead of on every frame.
    if (dragSession && (dragSession.kind === "wall-move" || dragSession.kind === "wall-endpoint")) {
      const refreshed = refreshAutoRooms(elements);
      if (refreshed !== elements) commitElements(refreshed);
    }
    setDragSession(null);
  }

  // Same endpoint/wall-line snap (and, given an anchor, angle-snap) a real
  // tap resolves to — shared by the hover preview, the tap-chain itself
  // (handleTap above already inlines its own copy of this) and the
  // press-drag-release gesture below, so all three ways of placing a point
  // land in exactly the same spot for the same finger/cursor position.
  function resolveDrawPoint(rawP, angleAnchor) {
    const endpointHit = findNearbyEndpoint(rawP, null, undefined, ghostWalls);
    const wallLineHit = !endpointHit ? findNearbyWallLineOrtho(rawP, angleAnchor, null, ghostWalls) : null;
    if (endpointHit || wallLineHit) return endpointHit || wallLineHit;
    const snapped = { x: snap(rawP.x), y: snap(rawP.y) };
    return angleAnchor ? angleSnap(angleAnchor, snapped) : snapped;
  }
  function onCanvasHover(e) {
    // Touch has no hover — only a mouse/trackpad pointer gets a preview,
    // and only mid-chain (once a first point is already pending).
    if (e.touches || (tool !== "parede" && tool !== "escada") || !pending) {
      if (hoverPos) setHoverPos(null);
      return;
    }
    setHoverPos(resolveDrawPoint(svgPointRaw(e), pending));
  }

  // Draw-by-dragging: press on empty canvas with the Parede/Escada tool,
  // drag, release — one wall/stair in a single motion, instead of the
  // tap-chain's two separate taps. A plain tap (no real movement) falls
  // through untouched to handleTap's own tap-chain logic, via onClick.
  function beginWallGesture(e) {
    if (tool !== "parede" && tool !== "escada") return;
    if (e.touches && e.touches.length !== 1) return;
    const p = e.touches ? e.touches[0] : e;
    // Resolved immediately (not deferred to when/if the drag threshold is
    // crossed) so the preview line has an anchor from the very first frame
    // of contact — see gestureAnchor's own declaration for why this stays
    // out of `pending` until moveWallGesture confirms a real drag.
    const startPoint = resolveDrawPoint(svgPointRaw(e), null);
    wallGesture.current = { startClientX: p.clientX, startClientY: p.clientY, startPoint, moved: false };
    setGestureAnchor(startPoint);
    setHoverPos(startPoint);
  }
  function moveWallGesture(e) {
    const g = wallGesture.current;
    if (!g) return;
    const p = e.touches ? e.touches[0] : e;
    if (!g.moved && Math.hypot(p.clientX - g.startClientX, p.clientY - g.startClientY) >= 10) {
      // Crossed the drag threshold — now it's a real drag, so `pending`
      // (the tap-chain's own state) takes over from here, overriding
      // whatever it held before: a fresh drag never anchors itself to an
      // unrelated leftover pending tap.
      g.moved = true;
      setPending(g.startPoint);
    }
    if (e.cancelable) e.preventDefault();
    setHoverPos(resolveDrawPoint(svgPointRaw(e), g.startPoint));
  }
  function endWallGesture() {
    const g = wallGesture.current;
    wallGesture.current = null;
    setGestureAnchor(null);
    if (!g || !g.moved) { setHoverPos(null); return; } // a plain tap — handleTap (via onClick) handles it, `pending` untouched
    const endPoint = hoverPos;
    setHoverPos(null);
    if (!endPoint || (endPoint.x === g.startPoint.x && endPoint.y === g.startPoint.y)) { setPending(null); return; }
    justDraggedOnCanvas.current = true;
    const el = placeWallOrStairSegment(tool, g.startPoint, endPoint);
    if (tool === "escada") { setPending(null); setSelectedId(el.id); }
    else setPending(endPoint); // chain: another drag (or tap) from here continues it
  }

  // Drag-select: press empty canvas with the Selecionar tool, drag, release
  // — everything fully inside the box joins selectionIds. A press that
  // actually lands ON an element is left alone here (findAt below bails
  // out), so it falls through to that element's own onMouseDown/
  // onTouchStart (drag-to-move, drag-an-endpoint, etc.) exactly as before.
  function beginMarquee(e) {
    if (tool !== "selecionar") return;
    if (e.touches && e.touches.length !== 1) return;
    const rawP = svgPointRaw(e);
    if (findAt(rawP)) return;
    const p = e.touches ? e.touches[0] : e;
    marqueeGesture.current = { startClientX: p.clientX, startClientY: p.clientY, startPoint: rawP, moved: false };
  }
  function moveMarquee(e) {
    const g = marqueeGesture.current;
    if (!g) return;
    const p = e.touches ? e.touches[0] : e;
    if (!g.moved) {
      if (Math.hypot(p.clientX - g.startClientX, p.clientY - g.startClientY) < 10) return;
      g.moved = true;
    }
    if (e.cancelable) e.preventDefault();
    const rawP = svgPointRaw(e);
    setMarqueeRect({ x1: g.startPoint.x, y1: g.startPoint.y, x2: rawP.x, y2: rawP.y });
  }
  function endMarquee() {
    const g = marqueeGesture.current;
    marqueeGesture.current = null;
    if (!g || !g.moved || !marqueeRect) { setMarqueeRect(null); return; } // a plain tap — handleTap's own single-select handles it
    // Mouse's click fires on mouseup regardless of how far it moved (same
    // reason justDraggedOnCanvas exists for the wall-drag gesture) — without
    // this, that trailing click's own tool==="selecionar" branch in
    // handleTap sees the selection this drag just made and immediately
    // clears it again, since `selectionIds.size` reads as truthy the
    // instant this render commits.
    justDraggedOnCanvas.current = true;
    setSelectedId(null);
    const boxed = elementsInRect(marqueeRect).map(el => el.id);
    // In "Selecionar vários" a box drag ADDS to whatever was already
    // tap-toggled on, instead of replacing it — the two ways of building
    // the same selection shouldn't fight each other.
    setSelectionIds(prev => multiSelectMode ? new Set([...prev, ...boxed]) : new Set(boxed));
    setMarqueeRect(null);
  }

  // Angle (degrees) to rotate a dimension label so it runs parallel to the
  // wall it measures instead of always sitting flat/horizontal — flipped
  // 180° whenever the raw angle would otherwise render the text upside
  // down, so it always reads left-to-right.
  function labelAngleDeg(w) {
    let deg = Math.atan2(w.y2 - w.y1, w.x2 - w.x1) * 180 / Math.PI;
    if (deg > 90 || deg < -90) deg += 180;
    return deg;
  }
  // The drawing's own raw extent (walls/stairs/doors/windows/rooms),
  // independent of whatever the camera (viewBox) currently happens to be
  // looking at —
  // clampOffsetToView below anchors to this instead, since a fitted-view
  // clamp based on the live viewBox re-triggers on every pan, dragging a
  // pushed-out label toward its anchor (and potentially on top of a
  // neighboring tag) as the drawing is panned toward that edge, rather
  // than only when the label would truly run past the drawing itself.
  const contentBounds = useMemo(() => {
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
    return isFinite(minX) ? { minX, maxX, minY, maxY } : null;
  }, [elements]);
  // Pulls a label back toward its anchor (along the same push direction,
  // never sideways) just enough that it clears the drawing's own edge —
  // for an outer wall, wallLabelOffset always pushes its length label
  // AWAY from the room, which is also the direction of the drawing's own
  // outer boundary, so a merged "x.xx m · w×h · Nf" tag on a wall close
  // to that boundary can end up sitting right against it. Scaling the
  // offset back (rather than moving the fit box) fixes just that label
  // without zooming the whole drawing out.
  function clampOffsetToView(baseX, baseY, offX, offY) {
    if (!contentBounds) return { x: baseX + offX, y: baseY + offY };
    // Wide enough for wallLabelOffset's "extra" push (18 + TAG_LINE_GAP,
    // when a centered opening's own two-line tag needs clearing) to
    // actually land clear of that tag instead of being clamped back down
    // on top of it.
    const MARGIN = 24 + TAG_LINE_GAP;
    let k = 1;
    if (offX > 0) k = Math.min(k, Math.max(0, (contentBounds.maxX + MARGIN - baseX) / offX));
    else if (offX < 0) k = Math.min(k, Math.max(0, (baseX - (contentBounds.minX - MARGIN)) / -offX));
    if (offY > 0) k = Math.min(k, Math.max(0, (contentBounds.maxY + MARGIN - baseY) / offY));
    else if (offY < 0) k = Math.min(k, Math.max(0, (baseY - (contentBounds.minY - MARGIN)) / -offY));
    return { x: baseX + offX * k, y: baseY + offY * k };
  }
  // How far (and to which side) a wall's own length label sits off the
  // wall line — pushed away from the rough centroid of all the walls
  // being sketched, so a label on any side of a shape (top, bottom, left,
  // right) lands outside it instead of on top of the line or collapsing
  // into the middle when another wall runs close and roughly parallel.
  function wallLabelOffset(el, extra = 0) {
    const dx = el.x2 - el.x1, dy = el.y2 - el.y1, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const walls = elements.filter(e => e.type === "wall");
    let cx = 0, cy = 0;
    walls.forEach(w => { cx += (w.x1 + w.x2) / 2; cy += (w.y1 + w.y2) / 2; });
    cx /= walls.length; cy /= walls.length;
    const midX = (el.x1 + el.x2) / 2, midY = (el.y1 + el.y2) / 2;
    const dot = (cx - midX) * nx + (cy - midY) * ny;
    const side = dot > 0 ? -1 : 1;
    const offDir = { x: nx * side, y: ny * side };

    // The text is rotated to run parallel to the wall (labelAngleDeg),
    // which also rotates which way its glyph body grows from the
    // baseline anchor — for a near-vertical wall that direction ends up
    // pointing back toward the wall instead of away from it, visually
    // shrinking the gap unless the base distance is pushed out to
    // compensate. A more diagonal wall doesn't have this problem (its
    // glyphs already grow away from the line), so it needs no extra.
    const rad = labelAngleDeg(el) * Math.PI / 180;
    const ascentDir = { x: Math.sin(rad), y: -Math.cos(rad) };
    const towardWall = Math.max(0, -(ascentDir.x * offDir.x + ascentDir.y * offDir.y));
    const D = 8, ASCENT = 7;
    const dist = D + towardWall * ASCENT + extra;
    return { x: offDir.x * dist, y: offDir.y * dist };
  }
  // Standard architectural door-swing symbol (or, for a sliding family, a
  // simple direction arrow) drawn in the door's own local frame — same
  // rotated <g> the leaf itself renders in, so this always tracks the
  // door's wall angle for free. swingSide flips which side of the wall the
  // leaf opens toward, swingHand which end it hinges from (single leaf
  // only — a double leaf always hinges at both outer edges), slideDir
  // which way a sliding door's arrow points; all three default to a fixed
  // side/hand instead of null so an existing door drawn before this
  // feature still gets a sensible symbol without needing a migration.
  function doorProjection(el, widthPx, panels) {
    const sliding = /correr/i.test(el.doorType || "");
    const side = el.swingSide === -1 ? -1 : 1;
    if (sliding) {
      const dir = el.slideDir === -1 ? -1 : 1;
      const halfSpan = widthPx * 0.35;
      const y0 = el.y + side * 9;
      const xTail = el.x - dir * halfSpan, xHead = el.x + dir * halfSpan;
      return (
        <g style={{ pointerEvents: "none" }} opacity="0.85">
          <line x1={xTail} y1={y0} x2={xHead} y2={y0} stroke="#726F68" strokeWidth="1" strokeDasharray="4,2" />
          <polygon points={`${xHead},${y0} ${xHead - dir * 5},${y0 - 3} ${xHead - dir * 5},${y0 + 3}`} fill="#726F68" />
        </g>
      );
    }
    // A quarter-circle from the latch (on the wall line) to the leaf's
    // fully-open tip (perpendicular to the wall, swung toward `side`),
    // radius = leaf width — hingeX < latchX (hinge on the left) sweeps the
    // opposite way from hinge-on-the-right, same as flipping `side` does.
    const leafArc = (hingeX, latchX, radius) => {
      const tipY = el.y + side * radius;
      const sweep = (hingeX < latchX) === (side === 1) ? 1 : 0;
      return `M ${latchX} ${el.y} A ${radius} ${radius} 0 0 ${sweep} ${hingeX} ${tipY}`;
    };
    if (panels >= 2) {
      const half = widthPx / 2;
      return (
        <g style={{ pointerEvents: "none" }} opacity="0.85">
          <path d={leafArc(el.x - half, el.x, half)} fill="none" stroke="#726F68" strokeWidth="1" />
          <path d={leafArc(el.x + half, el.x, half)} fill="none" stroke="#726F68" strokeWidth="1" />
        </g>
      );
    }
    const hand = el.swingHand === "right" ? "right" : "left";
    const hingeX = hand === "left" ? el.x - widthPx / 2 : el.x + widthPx / 2;
    const latchX = hand === "left" ? el.x + widthPx / 2 : el.x - widthPx / 2;
    return (
      <g style={{ pointerEvents: "none" }} opacity="0.85">
        <line x1={hingeX} y1={el.y} x2={hingeX} y2={el.y + side * widthPx} stroke="#726F68" strokeWidth="1" />
        <path d={leafArc(hingeX, latchX, widthPx)} fill="none" stroke="#726F68" strokeWidth="1" />
      </g>
    );
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
    { id: "parede", label: "Parede", Icon: BrickWall },
    { id: "ambiente", label: "Ambiente", Icon: LayoutPanelTop },
    { id: "piso", label: "Piso", Icon: SquareStack },
    { id: "porta", label: "Porta", Icon: DoorClosed },
    { id: "janela", label: "Janela", Icon: WindowIcon },
    { id: "escada", label: "Escada", Icon: StairsIcon },
    { id: "cortar", label: "Cortar parede", Icon: Scissors },
    { id: "estender", label: "Estender parede", Icon: ArrowLeftRight },
    { id: "alinhar", label: "Alinhar paredes", Icon: AlignCenterVertical },
    { id: "cota", label: "Cota", Icon: Ruler },
    { id: "apagar", label: "Apagar", Icon: Eraser },
  ];
  const FORRO_TOOLS = [
    { id: "selecionar", label: "Selecionar", Icon: MousePointer2 },
    { id: "ambiente", label: "Ambiente (acabamento)", Icon: LayoutPanelTop },
    { id: "luminaria", label: "Luminária", Icon: Lightbulb },
    { id: "apagar", label: "Apagar", Icon: Eraser },
  ];
  const TOOLS = planMode === "forro" ? FORRO_TOOLS : PISO_TOOLS;
  // "Apagar tudo" is injected into the tools row itself right before the
  // single-element eraser tool (always the last entry in both lists) —
  // works the same in Piso ("...cortar, estender, apagar") and Forro
  // ("...luminária, apagar") instead of hardcoding one tool's id.
  const clearAllAfterId = TOOLS[TOOLS.length - 2]?.id;

  const content = (
    <div>
      {/* Everything before the <svg> — the toolbar rows, phase-view row,
          naming box, editing overlays — becomes one translucent "watermark"
          layer pinned over the top of the canvas in fullscreen, instead of
          pushing it down; in normal (in-flow) mode this wrapper does
          nothing (no absolute positioning, no background). */}
      <div ref={toolbarRef} className={fullscreen ? "absolute top-0 left-0 right-0 z-20 pb-1.5" : undefined}
        style={fullscreen ? {
          background: "rgba(20,19,17,0.55)", backdropFilter: "blur(3px)",
          // A fullscreen PWA (viewport-fit=cover) draws content under the
          // phone's own status bar/notch — without this, the top row of
          // buttons renders half-hidden behind it and stops being tappable,
          // since touches there go to the OS chrome instead of the page.
          paddingTop: "max(10px, env(safe-area-inset-top))",
          paddingLeft: "max(8px, env(safe-area-inset-left))", paddingRight: "max(8px, env(safe-area-inset-right))",
        } : undefined}>
      {/* Vistas moved up to share App.jsx's own level-select row (this
          component now just reads it as the phaseView prop) — Piso/Forro
          gets the whole row to itself again. */}
      <div className="flex items-center gap-1 rounded p-1 mb-1.5" style={{ background: C.panelAlt }}>
        <button onClick={() => { setPlanMode("piso"); setTool("selecionar"); setSelectedId(null); }} className="flex-1 py-1.5 rounded text-[11px]"
          style={{ ...heading, fontWeight: 600, background: planMode === "piso" ? C.gold : "transparent", color: planMode === "piso" ? "#141311" : C.mute }}>Piso</button>
        <button onClick={() => { setPlanMode("forro"); setTool("selecionar"); setSelectedId(null); }} className="flex-1 py-1.5 rounded text-[11px]"
          style={{ ...heading, fontWeight: 600, background: planMode === "forro" ? C.gold : "transparent", color: planMode === "forro" ? "#141311" : C.mute }}>Forro</button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mb-1">
        {TOOLS.map(({ id, label, Icon }) => {
          const active = tool === id;
          const activeColor = id === "apagar" ? C.bad : C.gold;
          return (
            <span key={id} className="contents">
              <button onClick={() => { setTool(id); setPending(null); setEditingWallLen(null); setEditingParallelDim(null); setExtendSourceId(null); setExtendMsg(""); setAlignRef(null); setAlignMsg(""); setCotaPendingWallId(null); }} title={label}
                className="flex items-center justify-center p-2 rounded"
                style={{ background: active ? (id === "apagar" ? "rgba(193,84,63,0.16)" : C.goldTint) : C.panelAlt, color: active ? activeColor : C.mute, border: `1px solid ${active ? activeColor : C.line}` }}>
                <Icon size={16} />
              </button>
              {/* "Apagar tudo" (clear the whole sketch) sits right here,
                  beside Estender — it used to have its own separate row
                  below with Voltar/Avançar/Desfazer exclusão, which was
                  the biggest remaining chunk of dead space above the
                  canvas since a tool-icon-sized button fits right into
                  this row's own wrap instead. */}
              {id === clearAllAfterId && (
                <button onClick={clearAll} title="Apagar tudo" className="flex items-center justify-center p-2 rounded" style={{ background: C.panelAlt, color: C.bad, border: `1px solid ${C.line}` }}>
                  <Trash2 size={16} />
                </button>
              )}
            </span>
          );
        })}
        {tool === "selecionar" && (
          <button onClick={() => { setMultiSelectMode(m => !m); setSelectedId(null); }} title="Selecionar vários (toque em cada parede, porta, janela, ambiente ou piso)"
            className="flex items-center gap-1 px-2.5 py-2 rounded text-[11px]"
            style={{ ...heading, fontWeight: 600, background: multiSelectMode ? C.gold : C.panelAlt, color: multiSelectMode ? "#141311" : C.mute, border: `1px solid ${multiSelectMode ? C.gold : C.line}` }}>
            <CheckSquare size={14} /> Selecionar vários
          </button>
        )}
      </div>
      {/* Voltar/Avançar/Desfazer exclusão (sketch-wide, not tied to
          whatever's currently selected) share this one row with the
          cor-das-cotas group instead of each getting their own — a row
          just to hold a handful of small icon buttons was a big chunk of
          dead space above the canvas. Every item here is a direct child
          of this same flex-wrap row (no nested ml-auto sub-group) so they
          all pack tightly left-to-right and wrap individually — an
          ml-auto group used to wrap as one solid block, leaving whatever
          space was left on the first line sitting empty instead of
          letting the next item flow into it. */}
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5 text-[10px]" style={{ color: C.mute }}>
        <button onClick={undoLast} title="Voltar" className="flex items-center justify-center px-2.5 py-1.5 rounded" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
          <Undo2 size={13} />
        </button>
        <button onClick={redoLast} disabled={!redoStack.length} title="Avançar"
          className="flex items-center justify-center px-2.5 py-1.5 rounded"
          style={{ background: C.panelAlt, color: redoStack.length ? C.chalk : C.muteDim, border: `1px solid ${C.line}`, opacity: redoStack.length ? 1 : 0.5 }}>
          <Redo2 size={13} />
        </button>
        <button onClick={restoreLast} disabled={!deletedStack.length} title="Desfazer exclusão"
          className="flex items-center justify-center px-2.5 py-1.5 rounded"
          style={{ background: deletedStack.length ? C.goldTint : C.panelAlt, color: deletedStack.length ? C.gold : C.muteDim, border: `1px solid ${deletedStack.length ? C.gold : C.line}`, opacity: deletedStack.length ? 1 : 0.5 }}>
          <RotateCcw size={13} />
        </button>
        {planMode === "piso" && (
          <>
            <span className="flex items-center gap-1" title="Cor das cotas entre paredes">
              <Ruler size={11} /> Cotas
              <input type="color" value={dimColor} onChange={e => onMeta({ dimColor: e.target.value })}
                className="w-5 h-5 rounded" style={{ border: `1px solid ${C.line}`, background: "transparent" }} />
            </span>
            {/* This is also where the door/window dimension COLORS, the
                door/window dimension FONT SIZE, the room-name font size,
                the door/window tag font size and the sketch's FONT FAMILY
                all live — easy to miss as a bare "T" icon, so it gets its
                own short label instead of relying on the title tooltip
                alone (a tooltip a touchscreen never shows). */}
            <button onClick={() => setShowTextSettings(s => !s)} title="Cores e tamanhos de texto"
              className="flex items-center gap-1 px-1.5 py-1 rounded"
              style={{ background: showTextSettings ? C.goldTint : C.panelAlt, border: `1px solid ${showTextSettings ? C.gold : C.line}`, color: showTextSettings ? C.gold : C.chalk }}>
              <Type size={13} /> Cores/fontes
            </button>
            {belowLevel && (
              <label className="flex items-center gap-1"><input type="checkbox" checked={showBelow} onChange={e => setShowBelow(e.target.checked)} /> ver {belowLevel.name}</label>
            )}
            {aboveLevel && (
              <label className="flex items-center gap-1"><input type="checkbox" checked={showAbove} onChange={e => setShowAbove(e.target.checked)} /> ver {aboveLevel.name}</label>
            )}
          </>
        )}
      </div>
      {planMode === "piso" && showTextSettings && (
        <div className="flex flex-col gap-2 p-2.5 rounded-lg mb-1.5 text-[11px]" style={{ background: C.panelAlt, border: `1px solid ${C.line}` }}>
          <div className="flex items-center justify-between">
            <span className="font-medium" style={{ color: C.chalk }}>Cores e tamanhos de texto</span>
            <button onClick={() => setShowTextSettings(false)}><X size={14} color={C.mute} /></button>
          </div>
          <div className="flex items-center flex-wrap gap-3">
            <span className="flex items-center gap-1.5" style={{ color: C.mute }}>
              Cota portas
              <input type="color" value={doorDimColor} onChange={e => onMeta({ doorDimColor: e.target.value })}
                className="w-5 h-5 rounded" style={{ border: `1px solid ${C.line}`, background: "transparent" }} />
            </span>
            <span className="flex items-center gap-1.5" style={{ color: C.mute }}>
              Cota janelas
              <input type="color" value={windowDimColor} onChange={e => onMeta({ windowDimColor: e.target.value })}
                className="w-5 h-5 rounded" style={{ border: `1px solid ${C.line}`, background: "transparent" }} />
            </span>
            <span className="flex items-center gap-1.5" style={{ color: C.mute }}>
              Etiqueta porta/janela
              <input type="color" value={tagColor} onChange={e => onMeta({ tagColor: e.target.value })}
                className="w-5 h-5 rounded" style={{ border: `1px solid ${C.line}`, background: "transparent" }} />
            </span>
          </div>
          <div className="flex items-center flex-wrap gap-3">
            {[
              { label: "Tam. cota", value: dimFontSize, key: "dimFontSize", step: 0.5, min: 5, max: 12 },
              { label: "Tam. cota porta/janela", value: doorWindowDimFontSize, key: "doorWindowDimFontSize", step: 0.5, min: 5, max: 12 },
              { label: "Tam. nome do ambiente", value: roomNameFontSize, key: "roomNameFontSize", step: 1, min: 7, max: 18 },
              { label: "Tam. etiqueta porta/janela", value: tagFontSize, key: "tagFontSize", step: 0.5, min: 6, max: 11 },
            ].map(f => (
              <span key={f.key} className="flex items-center gap-1" style={{ color: C.mute }}>
                {f.label}
                <button onClick={() => onMeta({ [f.key]: Math.max(f.min, +(f.value - f.step).toFixed(1)) })}
                  className="w-5 h-5 flex items-center justify-center rounded" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                  <Minus size={10} color={C.chalk} />
                </button>
                <span className="w-6 text-center" style={{ ...mono, color: C.chalk }}>{f.value}</span>
                <button onClick={() => onMeta({ [f.key]: Math.min(f.max, +(f.value + f.step).toFixed(1)) })}
                  className="w-5 h-5 flex items-center justify-center rounded" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
                  <Plus size={10} color={C.chalk} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span style={{ color: C.mute }}>Fonte:</span>
            <select value={level.fontFamily || "padrao"} onChange={e => onMeta({ fontFamily: e.target.value })}
              className="text-[11px] px-1.5 py-1 rounded flex-1" style={{ background: "rgba(255,255,255,0.06)", color: C.chalk, border: `1px solid ${C.line}` }}>
              {FONT_FAMILIES.map(f => <option key={f.id} value={f.id} style={{ fontFamily: f.css }}>{f.label}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-1.5" style={{ color: C.mute }}>
            <input type="checkbox" checked={level.dimLabelOpaqueBg !== false} onChange={e => onMeta({ dimLabelOpaqueBg: e.target.checked })} />
            Fundo opaco atrás do número da cota
          </label>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 mb-1 text-[10px]" style={{ color: C.mute }}>
        {planMode === "piso" && (
          <>
            <span className="flex items-center gap-1" title="1 quadro ="><Grid2x2 size={12} /> =
              <input type="text" inputMode="decimal" value={scale} onChange={e => onMeta({ sketchScale: e.target.value })}
                className="w-12 px-1 py-0.5 rounded text-[10px]" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} /> m
            </span>
            <span className="flex items-center gap-1" title="Pé-direito das novas paredes">PD
              <input type="text" inputMode="decimal" value={wallHeightDefault} onChange={e => onMeta({ wallHeightDefault: e.target.value })}
                className="w-14 px-1 py-0.5 rounded text-[10px]" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} /> m
            </span>
          </>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setShowGrid(g => !g)} className="p-1.5 rounded" style={{ background: showGrid ? C.goldTint : C.panelAlt, border: `1px solid ${showGrid ? C.gold : C.line}` }}><Grid3x3 size={13} color={showGrid ? C.gold : C.chalk} /></button>
          <button onClick={() => zoomButton(0.8)} className="p-1.5 rounded" style={{ background: C.panelAlt, border: `1px solid ${C.line}` }}><ZoomIn size={13} color={C.chalk} /></button>
          <button onClick={() => zoomButton(1.25)} className="p-1.5 rounded" style={{ background: C.panelAlt, border: `1px solid ${C.line}` }}><ZoomOut size={13} color={C.chalk} /></button>
          {Math.round(rotationDeg) % 360 !== 0 && (
            <button onClick={() => setRotationDeg(0)} title="Endireitar a folha (desfazer a rotação)"
              className="px-1.5 py-1.5 rounded text-[10px]" style={{ ...mono, background: C.goldTint, border: `1px solid ${C.gold}`, color: C.gold }}>
              {Math.round(((rotationDeg % 360) + 360) % 360)}°
            </button>
          )}
          <button onClick={resetZoom} title="Centralizar, enquadrar tudo e endireitar" className="p-1.5 rounded" style={{ background: C.panelAlt, border: `1px solid ${C.line}` }}><Maximize2 size={13} color={C.chalk} /></button>
          <button onClick={() => setFullscreen(f => !f)} title={fullscreen ? "Sair da tela cheia" : "Tela cheia"} className="p-1.5 rounded" style={{ background: C.panelAlt, border: `1px solid ${C.line}` }}>
            {fullscreen ? <Shrink size={13} color={C.chalk} /> : <Expand size={13} color={C.chalk} />}
          </button>
          {/* Only in fullscreen: a straight shortcut into the 3D view,
              since the normal "Planta 2D / 3D" toggle lives in App.jsx,
              above this whole panel — out of sight once this is floating
              in its own full-viewport portal. Jumping to 3D still leaves
              tela cheia (the 3D view doesn't have its own fullscreen mode
              yet), landing back on that same normal toggle to return. */}
          {fullscreen && onOpenThreeD && (
            <button onClick={() => { setFullscreen(false); onOpenThreeD(); }} title="Ver em 3D"
              className="px-2 py-1.5 rounded flex items-center gap-1 text-[10px]" style={{ ...heading, fontWeight: 600, background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
              <Box size={13} color={C.chalk} /> 3D
            </button>
          )}
        </div>
      </div>

      {(tool === "ambiente" || tool === "piso") && planMode === "piso" && (
        <div className="flex flex-col gap-1.5 mb-2">
          <div className="flex items-center gap-1.5">
            <button onClick={() => { setAmbienteAuto(true); setAutoRoomMsg(""); }} title="Toque dentro de uma área com paredes fechadas"
              className="text-[10px] px-2 py-1 rounded" style={{ background: ambienteAuto ? C.goldTint : C.panelAlt, color: ambienteAuto ? C.gold : C.mute, border: `1px solid ${ambienteAuto ? C.gold : C.line}` }}>Automático</button>
            <button onClick={() => { setAmbienteAuto(false); setAutoRoomMsg(""); }} title="Marque cada ponto do contorno na mão — para varandas e áreas sem paredes fechadas"
              className="text-[10px] px-2 py-1 rounded" style={{ background: !ambienteAuto ? C.goldTint : C.panelAlt, color: !ambienteAuto ? C.gold : C.mute, border: `1px solid ${!ambienteAuto ? C.gold : C.line}` }}>Manual (pontos)</button>
          </div>
          {ambienteAuto && polygon.length === 0 && !autoRoomMsg && (
            <span className="text-[10px]" style={{ color: C.mute }}>{tool === "piso" ? "Toque dentro da área do piso, com paredes fechadas." : "Toque dentro de um ambiente com paredes fechadas."}</span>
          )}
          {autoRoomMsg && <span className="text-[10px]" style={{ color: C.bad }}>{autoRoomMsg}</span>}
          {(!ambienteAuto || polygon.length > 0) && (
            <div className="flex items-center gap-2 text-[11px]" style={{ color: C.mute }}>
              <span>{polygon.length} ponto(s) marcados</span>
              <button onClick={closePolygon} disabled={polygon.length < 3}
                className="px-2 py-1 rounded" style={{ ...heading, fontWeight: 600, background: C.goldTint, color: C.gold, opacity: polygon.length < 3 ? 0.4 : 1 }}>{tool === "piso" ? "Fechar piso" : "Fechar ambiente"}</button>
            </div>
          )}
        </div>
      )}

      {tool === "estender" && planMode === "piso" && (
        <div className="mb-2 text-[10px]" style={{ color: extendMsg ? C.bad : C.mute }}>
          {extendMsg || (extendSourceId ? "Agora toque na parede que ela deve alcançar." : "Toque na parede que quer esticar ou encolher.")}
        </div>
      )}

      {tool === "alinhar" && planMode === "piso" && (
        <div className="mb-2 text-[10px]" style={{ color: alignMsg ? C.bad : C.mute }}>
          {alignMsg || (alignRef ? "Agora toque na parede que deve se mover para alinhar." : "Toque na parede de referência (a que fica parada — pode ser de outro nível, se estiver com \"ver nível\" ligado).")}
        </div>
      )}

      {tool === "cota" && planMode === "piso" && (
        <div className="mb-2">
          <div className="flex flex-wrap gap-1.5 mb-1">
            {[
              { id: "face", label: "Face a face" },
              { id: "eixo", label: "Eixo a eixo" },
              { id: "faceExt", label: "Face ext. a face ext." },
              { id: "espessura", label: "Espessura" },
              { id: "opening", label: "Porta/janela" },
            ].map(m => (
              <button key={m.id} onClick={() => { setCotaMode(m.id); setCotaPendingWallId(null); }}
                className="px-2 py-1 rounded text-[10px]"
                style={{ ...heading, fontWeight: 600, background: cotaMode === m.id ? C.gold : C.panelAlt, color: cotaMode === m.id ? "#141311" : C.mute, border: `1px solid ${cotaMode === m.id ? C.gold : C.line}` }}>
                {m.label}
              </button>
            ))}
          </div>
          <div className="text-[10px]" style={{ color: C.mute }}>
            {cotaMode === "espessura" ? "Toque na parede: mostra a espessura dela."
              : cotaMode === "opening" ? "Toque numa porta ou janela: mostra a largura dela em planta."
              : cotaPendingWallId ? "Agora toque na segunda parede (o mais paralela possível da primeira)."
              : "Toque na primeira parede, depois na segunda."}
          </div>
        </div>
      )}

      {namingId && (
        <div className="flex items-center gap-2 mb-2 p-2 rounded" style={{ background: C.goldTint, border: `1px solid ${C.gold}` }}>
          <span className="text-[11px] shrink-0" style={{ color: C.gold }}>Nome do ambiente:</span>
          <input autoFocus value={namingValue} onChange={e => setNamingValue(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveName()}
            className="flex-1 px-2 py-1 rounded text-xs" style={{ background: "rgba(255,255,255,0.08)", color: C.chalk, border: `1px solid ${C.line}` }} />
          <button onClick={saveName} className="text-[11px] px-2 py-1 rounded" style={{ background: C.gold, color: "#141311" }}>Salvar</button>
          <button onClick={() => deleteRoom(namingId)} title="Apagar este ambiente" className="text-[11px] px-1.5" style={{ color: C.bad }}><Trash2 size={13} /></button>
          <button onClick={() => { setNamingId(null); setNamingValue(""); }} className="text-[11px] px-1.5" style={{ color: C.mute }}><X size={13} /></button>
        </div>
      )}

      {editingWallLen && (
        <div className="flex items-center gap-1.5 mb-1.5 p-1.5 rounded" style={{ background: C.goldTint, border: `1px solid ${C.gold}` }}>
          <span className="text-[11px] shrink-0" style={{ color: C.gold }}>Comprimento (m):</span>
          <input autoFocus type="text" inputMode="decimal" value={editingWallLen.value} onChange={e => setEditingWallLen({ ...editingWallLen, value: e.target.value })}
            onKeyDown={e => e.key === "Enter" && applyWallLenEdit()}
            className="w-16 px-2 py-1 rounded text-xs" style={{ background: "rgba(255,255,255,0.08)", color: C.chalk, border: `1px solid ${C.line}` }} />
          <button onClick={() => straightenWall(editingWallLen.wallId, editingWallLen.movingEnd || "end")} title="Deixar reto (0/45/90°)"
            className="p-1.5 rounded ml-auto shrink-0" style={{ background: C.panelAlt, border: `1px solid ${C.line}` }}><CornerUpRight size={13} color={C.chalk} /></button>
          <button onClick={applyWallLenEdit} className="text-[11px] px-2 py-1 rounded shrink-0" style={{ background: C.gold, color: "#141311" }}>Aplicar</button>
          <button onClick={() => setEditingWallLen(null)} className="text-[11px] px-1 shrink-0" style={{ color: C.mute }}><X size={13} /></button>
        </div>
      )}
      {editingParallelDim && (
        <div className="flex items-center gap-1.5 mb-1.5 p-1.5 rounded" style={{ background: C.goldTint, border: `1px solid ${C.gold}` }}>
          <span className="text-[11px] shrink-0" style={{ color: C.gold }}>Face a face (m):</span>
          <input autoFocus type="text" inputMode="decimal" value={editingParallelDim.value} onChange={e => setEditingParallelDim({ ...editingParallelDim, value: e.target.value })}
            onKeyDown={e => e.key === "Enter" && applyParallelDimEdit()}
            className="w-16 px-2 py-1 rounded text-xs" style={{ background: "rgba(255,255,255,0.08)", color: C.chalk, border: `1px solid ${C.line}` }} />
          <button onClick={applyParallelDimEdit} className="text-[11px] px-2 py-1 rounded ml-auto shrink-0" style={{ background: C.gold, color: "#141311" }}>Aplicar</button>
          <button onClick={() => { hideAutoDim(editingParallelDim.key); setEditingParallelDim(null); }} title="Apagar esta cota"
            className="p-1.5 rounded shrink-0" style={{ background: "rgba(193,84,63,0.16)", border: `1px solid ${C.bad}` }}><Trash2 size={13} color={C.bad} /></button>
          <button onClick={() => setEditingParallelDim(null)} className="text-[11px] px-1 shrink-0" style={{ color: C.mute }}><X size={13} /></button>
        </div>
      )}
      {selectedExtDim && (
        <div className="flex items-center gap-1.5 mb-1.5 p-1.5 rounded" style={{ background: C.goldTint, border: `1px solid ${C.gold}` }}>
          <span className="text-[11px]" style={{ color: C.gold }}>{selectedExtDim.label}</span>
          <button onClick={() => { hideAutoDim(selectedExtDim.key); setSelectedExtDim(null); }} title="Apagar esta cota"
            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded ml-auto shrink-0" style={{ background: "rgba(193,84,63,0.16)", color: C.bad, border: `1px solid ${C.bad}` }}>
            <Trash2 size={12} /> Apagar
          </button>
          <button onClick={() => setSelectedExtDim(null)} className="text-[11px] px-1 shrink-0" style={{ color: C.mute }}><X size={13} /></button>
        </div>
      )}
      {hiddenAutoDims.length > 0 && (
        <div className="flex items-center gap-1.5 mb-1.5 p-1.5 rounded text-[10px]" style={{ background: C.panelAlt, color: C.mute, border: `1px solid ${C.line}` }}>
          <span>{hiddenAutoDims.length} cota(s) automática(s) apagada(s) neste nível.</span>
          <button onClick={restoreAutoDims} className="ml-auto underline shrink-0" style={{ color: C.gold }}>Restaurar todas</button>
        </div>
      )}
      </div>

      <svg ref={svgRef} data-croqui-svg="true" width="100%" height={dims.h} viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="rounded-md touch-none" style={{
          background: exportMode ? "#FFFFFF" : "#DCDCD8", border: exportMode || fullscreen ? "none" : "1px solid #C6C6C1", display: "block", touchAction: "none",
          ...(fullscreen ? { position: "absolute", inset: 0, zIndex: 0, borderRadius: 0 } : null),
        }}
        onClick={handleTap} onWheel={onWheel}
        onMouseDown={e => { beginWallGesture(e); beginMarquee(e); }}
        onTouchStart={e => { onTouchStartCanvas(e); if (e.touches.length === 1) { beginWallGesture(e); beginMarquee(e); } }}
        onTouchMove={e => { onTouchMoveCanvas(e); if (e.touches.length === 1) { moveWallGesture(e); moveMarquee(e); } }}
        onTouchEnd={onTouchEndCanvas}
        onMouseMove={e => { onCanvasPointerMove(e); onCanvasHover(e); moveWallGesture(e); moveMarquee(e); }}
        onMouseUp={e => { onCanvasPointerUp(e); endWallGesture(); endMarquee(); }}
        onMouseLeave={e => { onCanvasPointerUp(e); endWallGesture(); endMarquee(); }}>
        <defs>
          <pattern id={`grid-${level.id}`} width={GRID} height={GRID} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#C6C6C1" strokeWidth="1" />
          </pattern>
          {/* Diagonal hachura for a room's own floor fill in the Demolição/
              Nova views — the same red/green a demolir/construir wall
              already gets, so the whole affected room reads as clearly
              "going away" or "brand new" as the wall marking it does,
              instead of sitting there in its usual neutral gray. */}
          <pattern id={`hatch-demolir-${level.id}`} width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="7" stroke={C.bad} strokeWidth="2" opacity="0.55" />
          </pattern>
          <pattern id={`hatch-construir-${level.id}`} width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="7" stroke={C.good} strokeWidth="2" opacity="0.55" />
          </pattern>
        </defs>
        {/* Everything the sheet actually contains lives inside this one
            group so a three-finger twist (see onTouchMoveCanvas) can spin
            the whole drawing — grid, walls, labels, all of it — together
            around the view's center, instead of rotating the viewport itself
            (which SVG's own viewBox can't do). */}
        {/* fontFamily set once here (an inherited SVG presentation
            attribute) reaches every <text> in the sketch — cotas, tags,
            nomes de ambiente, tudo — without needing it repeated on each
            one individually; none of them set their own fontFamily, so
            nothing locally overrides it. */}
        <g transform={rotationDeg ? `rotate(${rotationDeg} ${viewBox.x + viewBox.w / 2} ${viewBox.y + viewBox.h / 2})` : undefined} fontFamily={croquiFontFamily}>
        {/* Plain white in exportMode regardless of the interactive grid toggle
            — the PDF is meant to read as a clean executive drawing, not a
            screenshot of the editor's own drafting aid. */}
        <rect x={viewBox.x - viewBox.w} y={viewBox.y - viewBox.h} width={viewBox.w * 3} height={viewBox.h * 3} fill={exportMode ? "#FFFFFF" : (showGrid ? `url(#grid-${level.id})` : "#DCDCD8")} />

        {showBelow && ghostLevel(belowLevel, "#8A8880")}
        {showAbove && ghostLevel(aboveLevel, "#4A4A46")}

        {/* Roof outline (Coberturas tab) — the roof has no shape of its
            own in the sketch, it's generated from this level's own wall
            footprint (see roofFootprintFromLevel in App.jsx), so this is
            just a read-only projection: the eave rectangle (including its
            beiral/overhang) plus the ridge line, drawn as a ghost above
            the plan the same way an upper/lower level's outline is. */}
        {roofOverlays.map(r => (
          <g key={r.id} style={{ pointerEvents: "none" }} opacity="0.8">
            <polygon points={r.eaveLoopPx.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#B5623A" strokeWidth="1.5" strokeDasharray="6,3" />
            {r.ridgePx && (
              <line x1={r.ridgePx[0].x} y1={r.ridgePx[0].y} x2={r.ridgePx[1].x} y2={r.ridgePx[1].y} stroke="#B5623A" strokeWidth="2" />
            )}
            <text x={r.eaveLoopPx[0].x + 4} y={r.eaveLoopPx[0].y - 6} fontSize="9" fill="#B5623A">{r.name}</text>
          </g>
        ))}

        {/* "Piso" zones sit under everything else on purpose (drawn first)
            — they're their own independent area, not tied to a room's own
            boundary, so one can span across a wall opening (a continuous
            tiled hallway) or cover only part of a room (a wet-area-only
            zone) without fighting the room polygon's own fill for the same
            pixels. */}
        {planMode === "piso" && elements.filter(el => el.type === "floor" && phaseVisible(el)).map(el => {
          const isSel = selectedId === el.id;
          // el.floorColor is the user's own pick (the color swatch on the
          // selected-piso panel) — it used to be stored but never actually
          // drawn here, so changing it visibly did nothing. Falling back to
          // the family's own hint only when no custom color was set yet.
          const fill = el.floorColor || FLOOR_COLOR_2D[el.floorType] || FLOOR_COLOR_2D["A definir"];
          // A distinct blueprint-blue accent when selected — reusing the
          // room polygon's own grayish selected outline made a selected
          // piso and a selected ambiente read as the exact same thing.
          const stroke = isSel ? "#3E7CA6" : "#8C8477";
          // No text label on the sheet itself — the ambiente polygon
          // underneath already prints its own name/area, so a piso zone's
          // type+area here was just a redundant second caption sitting
          // right on top of it. The type/area are still available by
          // selecting the piso (its own panel below the canvas).
          return (
            <polygon key={el.id} points={el.points.map(p => `${p.x},${p.y}`).join(" ")} fill={fill} fillOpacity={isSel ? 0.8 : 0.65}
              stroke={stroke} strokeWidth={isSel ? 3 : 1} strokeDasharray="4,3"
              style={{ pointerEvents: "none" }} />
          );
        })}

        {planMode === "piso" && roomsForRender.map(el => {
          const centroid = polygonCentroid(el.points);
          const lines = wrapTextLines(el.name || "Ambiente sem nome", 14);
          const totalLines = lines.length + 1;
          const lineHeight = roomNameFontSize + 1;
          const lx = centroid.x + (el.labelOffset?.dx ?? 0);
          const ly = centroid.y + (el.labelOffset?.dy ?? 0);
          const topY = ly - ((totalLines - 1) * lineHeight) / 2;
          const rot = el.labelRotation || 0;
          const isSel = selectedId === el.id;
          const longest = Math.max(...lines.map(l => l.length), String(el.area).length + 3);
          const hitW = longest * roomNameFontSize * 0.56 + 10, hitH = totalLines * lineHeight + 8;
          // Demolição/Nova show every room already scoped to that phase
          // (roomsForRender), so tinting the fill and outline to match the
          // wall's own red/green needs no extra per-room check here.
          const roomHatch = phaseView === "demolicao" ? `url(#hatch-demolir-${level.id})`
            : phaseView === "novo" ? `url(#hatch-construir-${level.id})` : null;
          const roomOutline = phaseView === "demolicao" ? C.bad : phaseView === "novo" ? C.good : "#4A4A46";
          return (
            <g key={el.id}>
              <polygon points={el.points.map(p => `${p.x},${p.y}`).join(" ")} fill={roomHatch || "rgba(0,0,0,0.06)"} stroke={isSel ? "#726F68" : roomOutline} strokeWidth={isSel ? 2.5 : 1.5} />
              {/* "Final" recomputes rooms fresh on every render (see
                  finalRooms above) — its shapes are a read-only projection,
                  not something stored to drag/rename; a click here just
                  wouldn't go anywhere. */}
              <g style={{ cursor: phaseView === "final" ? "default" : "move" }}
                onMouseDown={phaseView === "final" ? undefined : (e => startLabelDrag(el, e))}
                onTouchStart={phaseView === "final" ? undefined : (e => startLabelDrag(el, e))}
                transform={rot ? `rotate(${rot} ${lx} ${ly})` : undefined}>
                <rect x={lx - hitW / 2} y={ly - hitH / 2} width={hitW} height={hitH} fill="rgba(255,255,255,0.001)" />
                {lines.map((ln, i) => <text key={i} x={lx} y={topY + i * lineHeight} fontSize={roomNameFontSize} fontWeight="600" fill="#4A4A46" textAnchor="middle" style={{ pointerEvents: "none" }}>{ln}</text>)}
                <text x={lx} y={topY + lines.length * lineHeight} fontSize={roomNameFontSize - 1} fill="#4A4A46" textAnchor="middle" style={{ pointerEvents: "none" }}>{el.area} m²</text>
              </g>
            </g>
          );
        })}
        {planMode === "forro" && elements.filter(el => el.type === "room").map(el => {
          const centroid = polygonCentroid(el.points);
          const label = el.ceilingFinish && el.ceilingFinish !== "A definir" ? el.ceilingFinish : "Forro sem acabamento";
          const lines = wrapTextLines(label, 14);
          const lineHeight = 10;
          const lx = centroid.x + (el.ceilingLabelOffset?.dx ?? -20);
          const ly = centroid.y + (el.ceilingLabelOffset?.dy ?? 0);
          const topY = ly - ((lines.length - 1) * lineHeight) / 2;
          const rot = el.ceilingLabelRotation || 0;
          const isSel = selectedId === el.id;
          const longest = Math.max(...lines.map(l => l.length), 1);
          const hitW = longest * 5 + 10, hitH = lines.length * lineHeight + 8;
          return (
            <g key={el.id}>
              <polygon points={el.points.map(p => `${p.x},${p.y}`).join(" ")} fill="rgba(0,0,0,0.05)" stroke={isSel ? "#726F68" : "#8A8880"} strokeWidth={isSel ? 2.5 : 1} strokeDasharray="3,3" />
              <g style={{ cursor: "move" }} onMouseDown={e => startLabelDrag(el, e)} onTouchStart={e => startLabelDrag(el, e)} transform={rot ? `rotate(${rot} ${lx} ${ly})` : undefined}>
                <rect x={lx - hitW / 2} y={ly - hitH / 2} width={hitW} height={hitH} fill="rgba(255,255,255,0.001)" />
                {lines.map((ln, i) => <text key={i} x={lx} y={topY + i * lineHeight} fontSize="8" fill="#6B6862" textAnchor="middle" style={{ pointerEvents: "none" }}>{ln}</text>)}
              </g>
            </g>
          );
        })}
        {elements.filter(el => el.type === "wall" && phaseVisible(el)).map(el => (
          <g key={el.id} opacity={planMode === "forro" ? 0.35 : 1}>
            <line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2}
              stroke={extendSourceId === el.id || alignRef?.id === el.id || cotaPendingWallId === el.id ? C.gold : selectedId === el.id ? "#726F68" : phaseStyleColor(el) || "#1B1E1A"}
              strokeWidth={selectedId === el.id || extendSourceId === el.id || alignRef?.id === el.id || cotaPendingWallId === el.id ? 6 : 4} strokeLinecap="square"
              strokeDasharray={extendSourceId === el.id || alignRef?.id === el.id || cotaPendingWallId === el.id ? "8,4" : phaseStyleColor(el) ? "7,5" : undefined}
              style={{ cursor: tool === "selecionar" ? "move" : "default" }} onMouseDown={e => beginDragWallMove(el, e)} onTouchStart={e => beginDragWallMove(el, e)} />
            {/* Every wall used to carry its own bare length label — floating
                text with no leader/tick line, right in the middle of the
                drawing, next to (and often duplicating) the exterior
                dimension chain below. It now only shows for the SELECTED
                wall, as a quick way to tap-to-edit its length, instead of
                cluttering every other wall on the sheet at once; the same
                value is still always available in the selected-wall panel's
                own "comprimento" field. */}
            {planMode === "piso" && selectedId === el.id && tool === "selecionar" && (() => {
              const canEdit = true;
              const midX = (el.x1 + el.x2) / 2, midY = (el.y1 + el.y2) / 2;
              const angleDeg = labelAngleDeg(el);
              // The wall's own length label defaults to the wall's exact
              // midpoint — but so does a door/window's own size/type tag
              // whenever it sits there (a centered opening being the
              // common case), and both sit on the same "outward from the
              // room" side. The door/window tag always stays put, centered
              // on the opening, so when one is near the middle the wall's
              // own label is pushed further out (extra clearance) to land
              // beyond it instead of on top of it — clampOffsetToView below
              // still pulls that extra push back in if it would run past
              // the sketch's own fitted view, so this never re-introduces
              // clipping. Compared in raw pixels, not a fraction of the
              // wall's own length — a short wall's own 25%-of-length gap
              // can still be narrower than the tag, while a long wall's
              // never would, so a fixed fraction threshold either over- or
              // under-triggers depending on the wall's length.
              const wdx = el.x2 - el.x1, wdy = el.y2 - el.y1, wlen = Math.hypot(wdx, wdy) || 1;
              const nearCenter = elements
                .some(o => (o.type === "door" || o.type === "window") && o.wallId === el.id && phaseVisible(o)
                  && Math.abs(((o.x - el.x1) * wdx + (o.y - el.y1) * wdy) / wlen - wlen * 0.5) < 45);
              const off = wallLabelOffset(el, nearCenter ? 18 + TAG_LINE_GAP : 0);
              const { x: lx, y: ly } = clampOffsetToView(midX, midY, off.x, off.y);
              return (
                <text x={lx} y={ly} fontSize="10" fill={phaseStyleColor(el) || "#6b6660"} textAnchor="middle"
                  transform={`rotate(${angleDeg} ${lx} ${ly})`}
                  style={{ pointerEvents: canEdit ? "auto" : "none", cursor: canEdit ? "pointer" : undefined }}
                  onClick={canEdit ? (e => { e.stopPropagation(); setEditingWallLen({ wallId: el.id, value: el.length }); }) : undefined}>
                  {el.length} m{canEdit && " ✎"}
                </text>
              );
            })()}
            {selectedId === el.id && tool === "selecionar" && (
              <>
                <circle cx={el.x1} cy={el.y1} r="6" fill="#726F68" stroke="#1B1E1A" strokeWidth="1" style={{ cursor: "grab" }}
                  onMouseDown={e => beginDragWallEndpoint(el, "start", e)} onTouchStart={e => beginDragWallEndpoint(el, "start", e)}
                  onClick={e => { e.stopPropagation(); setEditingWallLen({ wallId: el.id, value: el.length, movingEnd: "start" }); }} />
                <circle cx={el.x2} cy={el.y2} r="6" fill="#726F68" stroke="#1B1E1A" strokeWidth="1" style={{ cursor: "grab" }}
                  onMouseDown={e => beginDragWallEndpoint(el, "end", e)} onTouchStart={e => beginDragWallEndpoint(el, "end", e)}
                  onClick={e => { e.stopPropagation(); setEditingWallLen({ wallId: el.id, value: el.length, movingEnd: "end" }); }} />
              </>
            )}
          </g>
        ))}
        {planMode === "piso" && (tool === "parede" || tool === "escada" || tool === "ambiente") && (() => {
          // Visible snap targets for every wall/stair corner while drawing
          // or tracing — makes the (otherwise invisible) endpoint-snap
          // something the user can actually aim for, instead of hoping a
          // freehand tap lands close enough to it.
          const pts = [];
          elements.forEach(e => {
            if (e.type !== "wall" && e.type !== "stair") return;
            pts.push({ x: e.x1, y: e.y1, id: e.id + "-1" }, { x: e.x2, y: e.y2, id: e.id + "-2" });
          });
          return pts.map(pt => (
            <circle key={pt.id} cx={pt.x} cy={pt.y} r="4" fill="none" stroke="#2E6FED" strokeWidth="1.5" opacity="0.8" pointerEvents="none" />
          ));
        })()}
        {planMode === "piso" && nearestParallelWallDims(mergeCollinearWallRuns(elements.filter(el => el.type === "wall" && phaseVisible(el)))).map(d => {
          const pwKey = "pw:" + [d.aId, d.bId].sort().join("|");
          if (hiddenAutoDims.includes(pwKey)) return null;
          const dx = d.x2 - d.x1, dy = d.y2 - d.y1, len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len;
          const nx = -uy, ny = ux;
          const wallA = wallsById[d.aId], wallB = wallsById[d.bId];
          const halfThickAPx = wallA ? (wallThicknessM(wallA) / 2 / scale) * GRID : 0;
          const halfThickBPx = wallB ? (wallThicknessM(wallB) / 2 / scale) * GRID : 0;
          // Manual nudge, free in the plane of the line: perpendicular to it
          // (nx,ny — parallel to the walls themselves) and along it (ux,uy).
          // Persisted on the wall (not local state) so it survives this
          // component remounting on tab switch, and each axis is clamped
          // independently so it can't be dragged out of the room.
          const dimNudge = readDimNudge(wallA, d.bId);
          // Half a grid square of clearance at each end of the shared
          // overlap span — a full square (the previous margin) stopped the
          // dragged bar noticeably short of the wall it's measuring.
          const maxPerp = Math.max(0, (d.overlapMax - d.overlapMin) / 2 - GRID / 2);
          const perp = Math.max(-maxPerp, Math.min(maxPerp, dimNudge.perp));
          // The line itself must land on the walls' facing FACES, not their
          // centerlines (d.x1/d.y1 -> d.x2/d.y2 above) — pull each end in by
          // that wall's own half-thickness along the line. The perpendicular
          // nudge (sx,sy) shifts the WHOLE measuring line sideways along the
          // walls, not just its label — by default, two dimensions in a
          // rectangular room both cross through the room's center, forming a
          // cluttered "+"; this lets each one be pulled toward whichever
          // side of the room actually has room for it.
          const sx = nx * perp, sy = ny * perp;
          const fx1 = d.x1 + ux * halfThickAPx + sx, fy1 = d.y1 + uy * halfThickAPx + sy;
          const fx2 = d.x2 - ux * halfThickBPx + sx, fy2 = d.y2 - uy * halfThickBPx + sy;
          // For a simple rectangular room, this pair's line (running between
          // a wall and its opposite) and the OTHER pair's line (the two side
          // walls) cross exactly at the room's center — putting both labels
          // at their line's true midpoint then lands them on the exact same
          // point, stacking the two texts unreadably on top of each other.
          // Sliding each label off-center by a different amount depending on
          // whether its line runs mostly vertically or mostly horizontally
          // keeps it visually anchored to its own dimension line while
          // reliably landing the two labels somewhere different.
          const labelT = Math.abs(uy) > Math.abs(ux) ? 0.36 : 0.64;
          const midX = fx1 + (fx2 - fx1) * labelT, midY = fy1 + (fy2 - fy1) * labelT;
          const halfSumM = wallA && wallB ? (wallThicknessM(wallA) / 2 + wallThicknessM(wallB) / 2) : 0;
          const faceDistM = Math.max(0, pxToMeters(d.distPx) - halfSumM).toFixed(2);
          const faceLen = Math.hypot(fx2 - fx1, fy2 - fy1) || 1;
          // A second, smaller degree of freedom along the line itself (ux,uy)
          // slides the label between the two wall faces instead of always
          // sitting at the fixed labelT point — useful once the line's own
          // position no longer forces it away from an opening or another label.
          const alongMargin = Math.min(10, faceLen / 2);
          const alongLo = Math.min(alongMargin - faceLen * labelT, faceLen - alongMargin - faceLen * labelT);
          const alongHi = Math.max(alongMargin - faceLen * labelT, faceLen - alongMargin - faceLen * labelT);
          const along = Math.max(alongLo, Math.min(alongHi, dimNudge.along));
          // Auto-avoid a room's name/area label when this dimension's
          // default position (no manual drag yet) would land on top of it —
          // push further along the line, away from the room's centroid, up
          // to the same clamp the manual drag itself is bound by.
          let autoAlong = along;
          if (dimNudge.along === 0 && roomLabelBoxes.length) {
            // Extra px of slack on top of the estimated text box — the
            // estimate is approximate (real font metrics, not measured),
            // so land a bit past the computed clearance rather than right
            // on its edge.
            const SAFETY = 6;
            const ourHalfW = (String(faceDistM).length + 2) * 3.2 + 6, ourHalfH = 7;
            const overlaps = (ax, ay) => roomLabelBoxes.some(b => Math.abs(ax - b.x) < (b.hw + ourHalfW + SAFETY) && Math.abs(ay - b.y) < (b.hh + ourHalfH + SAFETY));
            if (overlaps(midX + ux * along, midY + uy * along)) {
              const dir = labelT < 0.5 ? -1 : 1;
              const bound = dir < 0 ? alongLo : alongHi;
              for (let step = 1; step <= 20; step++) {
                const tryAlong = bound * step / 20;
                autoAlong = tryAlong;
                if (!overlaps(midX + ux * tryAlong, midY + uy * tryAlong)) break;
              }
            }
          }
          const labelX = midX + ux * autoAlong, labelY = midY + uy * autoAlong;
          // Rotate the label to read parallel to its own dimension line
          // (matching standard architectural dimension convention) instead
          // of always horizontal — flipped 180° whenever the raw angle
          // would otherwise render the text upside down, same as a wall's
          // own length label.
          let dimDeg = Math.atan2(uy, ux) * 180 / Math.PI;
          if (dimDeg > 90 || dimDeg < -90) dimDeg += 180;
          // Which wall of the pair moves when this dimension is edited: keep
          // whichever one is already selected (so editing right after
          // selecting a wall moves that same wall, not its neighbor), else
          // default to A — either way the dimension itself is always
          // clickable, not just when one of its two walls happens to already
          // be selected (that made most dimensions in a room look editable
          // but silently do nothing when clicked).
          const movingWallId = selectedId === d.bId ? d.bId : d.aId;
          const fixedWallId = movingWallId === d.aId ? d.bId : d.aId;
          const editable = tool === "selecionar";
          const isEditing = editingParallelDim && editingParallelDim.movingWallId === movingWallId
            && editingParallelDim.fixedWallId === fixedWallId;
          const startEdit = () => { setSelectedId(movingWallId); setSelectedExtDim(null); setEditingParallelDim({ movingWallId, fixedWallId, value: faceDistM, key: pwKey }); };
          return (
            <g key={`pw-${d.aId}-${d.bId}`} opacity="0.9">
              <line x1={fx1} y1={fy1} x2={fx2} y2={fy2} stroke={dimColor} strokeWidth="0.9" pointerEvents="none" />
              <line x1={fx1 - nx * 4} y1={fy1 - ny * 4} x2={fx1 + nx * 4} y2={fy1 + ny * 4} stroke={dimColor} strokeWidth="0.9" pointerEvents="none" />
              <line x1={fx2 - nx * 4} y1={fy2 - ny * 4} x2={fx2 + nx * 4} y2={fy2 + ny * 4} stroke={dimColor} strokeWidth="0.9" pointerEvents="none" />
              <g transform={dimDeg ? `rotate(${dimDeg} ${labelX} ${labelY})` : undefined}>
                {editable && (
                  // Bigger than the visible pill below it — a touch-friendly
                  // hit area around a small label is worth more than visual
                  // purity here, especially with several dimensions crowded
                  // into a small room. Mousedown/touchstart (not onClick) so
                  // it can double as the handle for the free 2D drag above —
                  // a plain tap (no movement) still falls through to
                  // startEdit via onDimLabelDragEnd, same as the room-name
                  // label pattern.
                  <rect x={labelX - 22} y={labelY - 14} width="44" height="28" fill={isEditing ? dimColor : "transparent"} opacity={isEditing ? 0.3 : 1}
                    style={{ cursor: "move" }}
                    onMouseDown={e => wallA && beginDragDimLabel(wallA, d.bId, ux, uy, nx, ny, d.overlapMin, d.overlapMax, faceLen, labelT, startEdit, e)}
                    onTouchStart={e => wallA && beginDragDimLabel(wallA, d.bId, ux, uy, nx, ny, d.overlapMin, d.overlapMax, faceLen, labelT, startEdit, e)} />
                )}
                {dimLabelOpaqueBg && <rect x={labelX - 15} y={labelY - 7} width="30" height="10" fill="#DCDCD8" opacity="0.85" pointerEvents="none" />}
                <text x={labelX} y={labelY + 1} fontSize="8" fill={dimColor} textAnchor="middle" fontWeight="600"
                  style={{ pointerEvents: "none" }}>{faceDistM} m</text>
              </g>
            </g>
          );
        })}
        {planMode === "piso" && exteriorPerimeterChains(
          elements.filter(e => (e.type !== "wall" && e.type !== "door" && e.type !== "window") || phaseVisible(e)), scale
        ).map(run => {
          const CHAIN_GAP = 16, OVERALL_GAP = 30;
          const chainOffset = run.halfThickPx + CHAIN_GAP;
          const overallOffset = chainOffset + OVERALL_GAP;
          let dimDeg = Math.atan2(run.uy, run.ux) * 180 / Math.PI;
          if (dimDeg > 90 || dimDeg < -90) dimDeg += 180;
          const at = (t, offset) => ({ x: run.x1 + run.ux * t + run.nx * offset, y: run.y1 + run.uy * t + run.ny * offset });
          const overallP1 = at(0, overallOffset), overallP2 = at(run.len, overallOffset), overallMid = at(run.len / 2, overallOffset);
          const totalM = (run.len / GRID) * scale;
          const overallKey = `extoverall:${run.id}`;
          const pick = (key, label) => (e) => {
            if (tool !== "selecionar") return;
            e.stopPropagation(); e.preventDefault();
            setEditingParallelDim(null);
            setSelectedExtDim({ key, label });
          };
          return (
            <g key={`ext-${run.id}`} opacity="0.9">
              {/* Chain row: every corner-to-opening/opening-to-opening gap
                  along this exterior run — the "blue" annotations, hugging
                  right outside the wall. Each one can be tapped (while
                  Selecionar is active) to bring up its own "Apagar esta
                  cota" — these aren't stored elements, so hiding one just
                  adds its key to the level's own hiddenAutoDims instead of
                  deleting anything. */}
              {run.segs.map((seg, i) => {
                const segKey = `extseg:${run.id}:${Math.round(seg.a)}:${Math.round(seg.b)}`;
                if (hiddenAutoDims.includes(segKey)) return null;
                const p1 = at(seg.a, chainOffset), p2 = at(seg.b, chainOffset);
                const mid = at((seg.a + seg.b) / 2, chainOffset);
                const segM = ((seg.b - seg.a) / GRID) * scale;
                // A segment that IS a door or window's own width uses that
                // family's own cota color/size (doorDimColor/windowDimColor,
                // doorWindowDimFontSize) — the same distinction Elevação and
                // the manual Cota tool already make — instead of every gap
                // and every opening reading as one flat "cotas" color, which
                // made it look like changing one swatch should recolor
                // everything and never actually did.
                const segColor = seg.kind === "door" ? doorDimColor : seg.kind === "window" ? windowDimColor : dimColor;
                const segFontSize = seg.kind === "gap" ? Math.max(6, dimFontSize - 1.5) : doorWindowDimFontSize;
                const kindLabel = seg.kind === "door" ? "porta" : seg.kind === "window" ? "janela" : "vão";
                return (
                  <g key={i}>
                    <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={segColor} strokeWidth="0.75" pointerEvents="none" />
                    <line x1={p1.x - run.nx * 3.5} y1={p1.y - run.ny * 3.5} x2={p1.x + run.nx * 3.5} y2={p1.y + run.ny * 3.5} stroke={segColor} strokeWidth="0.75" pointerEvents="none" />
                    <line x1={p2.x - run.nx * 3.5} y1={p2.y - run.ny * 3.5} x2={p2.x + run.nx * 3.5} y2={p2.y + run.ny * 3.5} stroke={segColor} strokeWidth="0.75" pointerEvents="none" />
                    <g transform={dimDeg ? `rotate(${dimDeg} ${mid.x} ${mid.y})` : undefined}>
                      {dimLabelOpaqueBg && <rect x={mid.x - 13} y={mid.y - 6} width="26" height="9" fill="#DCDCD8" opacity="0.85" pointerEvents="none" />}
                      <text x={mid.x} y={mid.y + 1} fontSize={segFontSize} fill={segColor} textAnchor="middle" style={{ pointerEvents: "none" }}>{segM.toFixed(2)}</text>
                      {tool === "selecionar" && (
                        <rect x={mid.x - 18} y={mid.y - 11} width="36" height="22" fill="transparent" style={{ cursor: "pointer" }}
                          onMouseDown={pick(segKey, `Cota do ${kindLabel} · ${segM.toFixed(2)} m`)} onTouchStart={pick(segKey, `Cota do ${kindLabel} · ${segM.toFixed(2)} m`)} />
                      )}
                    </g>
                  </g>
                );
              })}
              {/* Overall row: this run's whole length, corner to corner —
                  the "red" annotation, further out past the chain. */}
              {!hiddenAutoDims.includes(overallKey) && (
                <g>
                  <line x1={overallP1.x} y1={overallP1.y} x2={overallP2.x} y2={overallP2.y} stroke={dimColor} strokeWidth="1" pointerEvents="none" />
                  <line x1={overallP1.x - run.nx * 4} y1={overallP1.y - run.ny * 4} x2={overallP1.x + run.nx * 4} y2={overallP1.y + run.ny * 4} stroke={dimColor} strokeWidth="1" pointerEvents="none" />
                  <line x1={overallP2.x - run.nx * 4} y1={overallP2.y - run.ny * 4} x2={overallP2.x + run.nx * 4} y2={overallP2.y + run.ny * 4} stroke={dimColor} strokeWidth="1" pointerEvents="none" />
                  <g transform={dimDeg ? `rotate(${dimDeg} ${overallMid.x} ${overallMid.y})` : undefined}>
                    {dimLabelOpaqueBg && <rect x={overallMid.x - 16} y={overallMid.y - 7} width="32" height="10" fill="#DCDCD8" opacity="0.9" pointerEvents="none" />}
                    <text x={overallMid.x} y={overallMid.y + 1} fontSize={dimFontSize} fill={dimColor} textAnchor="middle" fontWeight="700" style={{ pointerEvents: "none" }}>{totalM.toFixed(2)} m</text>
                    {tool === "selecionar" && (
                      <rect x={overallMid.x - 20} y={overallMid.y - 12} width="40" height="24" fill="transparent" style={{ cursor: "pointer" }}
                        onMouseDown={pick(overallKey, `Cota total · ${totalM.toFixed(2)} m`)} onTouchStart={pick(overallKey, `Cota total · ${totalM.toFixed(2)} m`)} />
                    )}
                  </g>
                </g>
              )}
            </g>
          );
        })}
        {planMode === "piso" && elements.filter(el => el.type === "cota").map(el => {
          const g = cotaGeometry(el, elements, scale);
          if (!g) return null;
          const nx = -Math.sin(g.lineAngleDeg * Math.PI / 180), ny = Math.cos(g.lineAngleDeg * Math.PI / 180);
          // A "Porta/janela" cota defaults to that family's own cota color
          // and size (doorDimColor/windowDimColor, doorWindowDimFontSize —
          // same ones Elevação and the automatic perimeter chain use for an
          // opening), not the generic wall-to-wall "Cotas" color, unless the
          // user picked a color/size of their own for this one cota.
          const refEl = el.mode === "opening" ? elements.find(e => e.id === el.refId) : null;
          const defaultColor = refEl?.type === "window" ? windowDimColor : refEl?.type === "door" ? doorDimColor : dimColor;
          const defaultFontSize = refEl ? doorWindowDimFontSize : dimFontSize;
          const color = el.color || defaultColor;
          const fontSize = toNum(el.fontSize, defaultFontSize);
          const isSel = selectedId === el.id;
          return (
            <g key={el.id} opacity={isSel ? 1 : 0.9}>
              <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={isSel ? "#726F68" : color} strokeWidth={isSel ? 1.6 : 0.9} />
              <line x1={g.x1 - nx * 4} y1={g.y1 - ny * 4} x2={g.x1 + nx * 4} y2={g.y1 + ny * 4} stroke={isSel ? "#726F68" : color} strokeWidth="0.9" />
              <line x1={g.x2 - nx * 4} y1={g.y2 - ny * 4} x2={g.x2 + nx * 4} y2={g.y2 + ny * 4} stroke={isSel ? "#726F68" : color} strokeWidth="0.9" />
              <g transform={g.lineAngleDeg ? `rotate(${g.lineAngleDeg} ${g.labelX} ${g.labelY})` : undefined}>
                {dimLabelOpaqueBg && <rect x={g.labelX - 15} y={g.labelY - 7} width="30" height="10" fill="#DCDCD8" opacity="0.85" pointerEvents="none" />}
                <text x={g.labelX} y={g.labelY + 1} fontSize={fontSize} fill={isSel ? "#726F68" : color} textAnchor="middle" fontWeight="600"
                  fontFamily={el.fontFamily ? fontFamilyCss(el.fontFamily) : undefined}
                  style={{ pointerEvents: "none" }}>{el.mode === "espessura" ? `${Math.round(g.valueM * 100)} cm` : `${g.valueM.toFixed(2)} m`}</text>
              </g>
            </g>
          );
        })}
        {planMode === "piso" && elements.filter(el => el.type === "stair" && phaseVisible(el)).map(el => (
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
        {planMode === "piso" && elements.filter(el => (el.type === "door" || el.type === "window") && phaseVisible(el)).map(el => {
          const w = wallsById[el.wallId];
          // Same normalized angle the wall length labels use (labelAngleDeg
          // flips a right-to-left wall's raw angle by 180° so its text never
          // renders upside down) — the door/window leaf itself is symmetric
          // under that flip, so reusing it here costs nothing and lets the
          // tag below inherit the group's rotation instead of fighting it
          // back to horizontal.
          const angleDeg = w ? labelAngleDeg(w) : 0;
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
                fill={phaseView !== "final" && el.demolir ? "rgba(193,84,63,0.35)" : phaseView !== "final" && el.construir ? "rgba(107,156,90,0.35)" : (isDoor ? "#4A4A46" : "#B9B6AE")}
                stroke={isSel ? "#726F68" : phaseStyleColor(el) || "#1B1E1A"} strokeWidth={isSel ? 2.5 : 1}
                strokeDasharray={phaseStyleColor(el) ? "3,2" : undefined}
                opacity={isDoor ? 1 : 0.85}
                style={{ pointerEvents: "none" }} />
              {Array.from({ length: panels - 1 }).map((_, i) => (
                <line key={i} x1={el.x - widthPx / 2 + panelWidthPx * (i + 1)} y1={el.y - 3.5}
                  x2={el.x - widthPx / 2 + panelWidthPx * (i + 1)} y2={el.y + 3.5}
                  stroke="#1B1E1A" strokeWidth="1" style={{ pointerEvents: "none" }} />
              ))}
              <g transform={el.tagRotation ? `rotate(${el.tagRotation} ${el.x} ${el.y - 14})` : undefined}>
                {/* Name (tag) on its own line, dimensions below it — same
                    break used in the Elevação view, instead of one long
                    line cramming "P1 · 0.8×2.1 · 1f" together. */}
                {el.tag && (
                  <text x={el.x} y={el.y - 14 - TAG_LINE_GAP} fontSize={tagFontSize} fill={phaseStyleColor(el) || tagColor} textAnchor="middle">{el.tag}</text>
                )}
                <text x={el.x} y={el.y - 14} fontSize={tagFontSize} fill={phaseStyleColor(el) || tagColor} textAnchor="middle">{el.width}×{el.height} · {panels}f</text>
              </g>
              {isDoor && doorProjection(el, widthPx, panels)}
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
        {(gestureAnchor || pending) && hoverPos && (tool === "parede" || tool === "escada") && (
          <line x1={(gestureAnchor || pending).x} y1={(gestureAnchor || pending).y} x2={hoverPos.x} y2={hoverPos.y} stroke="#1B1E1A" strokeWidth="4" strokeLinecap="square" opacity="0.6" pointerEvents="none" />
        )}
        {pending && <circle cx={pending.x} cy={pending.y} r="4.5" fill="#4A4A46" stroke="#1B1E1A" strokeWidth="1" />}
        {marqueeRect && (
          <rect x={Math.min(marqueeRect.x1, marqueeRect.x2)} y={Math.min(marqueeRect.y1, marqueeRect.y2)}
            width={Math.abs(marqueeRect.x2 - marqueeRect.x1)} height={Math.abs(marqueeRect.y2 - marqueeRect.y1)}
            fill={C.goldTint} stroke={C.gold} strokeWidth="1.5" strokeDasharray="6,4" pointerEvents="none" />
        )}
        {selectionIds.size > 0 && elements.filter(el => selectionIds.has(el.id)).map(el => {
          const b = elementBounds(el);
          if (!b) return null;
          const pad = 8;
          return (
            <rect key={`sel-${el.id}`} x={b.minX - pad} y={b.minY - pad} width={(b.maxX - b.minX) + pad * 2} height={(b.maxY - b.minY) + pad * 2}
              fill="none" stroke={C.gold} strokeWidth="2" strokeDasharray="5,3" rx="4" pointerEvents="none" />
          );
        })}
        </g>
      </svg>

      {/* The selected-element editor is the other watermark layer, pinned
          to the bottom of the canvas in fullscreen — same translucent
          backing as the top row (not a near-opaque block) so the two read
          as one consistent treatment; the controls underneath keep their
          own normal (already legible) styling either way. */}
      <div ref={belowCanvasRef} className={fullscreen ? "absolute bottom-0 left-0 right-0 z-20 pt-1.5 max-h-[60vh] overflow-y-auto" : undefined}
        style={fullscreen ? {
          background: "rgba(20,19,17,0.55)", backdropFilter: "blur(3px)",
          paddingLeft: "max(8px, env(safe-area-inset-left))", paddingRight: "max(8px, env(safe-area-inset-right))",
          paddingBottom: "max(8px, env(safe-area-inset-bottom))",
        } : undefined}>
      {multiSelectMode && selectionIds.size === 0 && (
        <div className="mt-2 p-2.5 rounded-lg text-[11px]" style={{ background: C.panelAlt, color: C.mute, border: `1px solid ${C.line}` }}>
          Toque em cada parede, porta, janela, ambiente ou piso que quer selecionar.
        </div>
      )}
      {selectionIds.size > 0 && (
        <div className="mt-2 p-2.5 rounded-lg flex items-center justify-between gap-2" style={{ background: C.goldTint, border: `1px solid ${C.gold}` }}>
          <span className="text-[11px] font-medium" style={{ color: C.gold }}>{selectionIds.size} selecionado(s)</span>
          <div className="flex items-center gap-1.5">
            <button onClick={deleteSelectionBatch} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded" style={{ background: "rgba(193,84,63,0.16)", color: C.bad, border: `1px solid ${C.bad}` }}>
              <Trash2 size={12} /> Apagar selecionados
            </button>
            <button onClick={() => setSelectionIds(new Set())} title="Cancelar seleção"><X size={14} color={C.gold} /></button>
          </div>
        </div>
      )}
      {selected && (
        <div className="mt-2 p-2.5 rounded-lg" style={{ background: C.goldTint, border: `1px solid ${C.gold}` }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium" style={{ color: C.gold }}>
              {selected.type === "wall" ? `Parede ${selected.tag}` : selected.type === "door" ? `Porta ${selected.tag}` : selected.type === "window" ? `Janela ${selected.tag}` : selected.type === "room" ? `Ambiente: ${selected.name || "sem nome"}` : selected.type === "floor" ? `Piso · ${selected.floorType}` : selected.type === "stair" ? `Escada ${selected.tag}` : selected.type === "cota" ? `Cota · ${COTA_MODE_LABEL[selected.mode] || ""}` : "Luminária"}
            </span>
            <button onClick={() => setSelectedId(null)}><X size={14} color={C.gold} /></button>
          </div>

          {selected.type === "wall" && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap text-[11px]" style={{ color: C.chalk }}>
                <NumField value={selected.length} onCommit={v => setWallLengthDirect(selected.id, v)} unit="m comprimento" />
                <NumField value={selected.height} onChange={v => patchSelected({ height: v })} unit="m altura" />
                <ConditionSelect value={selected.condition} onChange={v => patchSelected({ condition: v })} />
                <PhaseToggles demolir={selected.demolir} construir={selected.construir} onChange={patchSelected} />
              </div>
              <div className="flex items-center gap-2 flex-wrap text-[11px]" style={{ color: C.chalk }}>
                <span style={{ color: C.mute }}>Tipo:</span>
                {/* Picking a family resets any custom thickness typed below,
                    so switching from "Concreto" back to "Alvenaria 15cm"
                    doesn't leave a stale 20cm override behind — typing a
                    new value in the field itself is what creates one, for
                    a wall whose real thickness doesn't match any preset
                    (a 19cm block wall, say). */}
                <TypeSelect value={selected.wallType || WALL_TYPES[0]} options={WALL_TYPES} onChange={v => patchSelected({
                  wallType: v, wallThickness: undefined,
                  // A guarda-corpo is never floor-to-ceiling like a real
                  // wall — switching to it also drops the height to the
                  // standard guardrail height (NBR 6494/9077) so it doesn't
                  // render as a full-height wall until the user notices and
                  // fixes it by hand.
                  ...(v.startsWith("Guarda-corpo") ? { height: "1.05" } : {}),
                })} />
                <NumField value={Math.round(wallThicknessM(selected) * 100)} onCommit={v => patchSelected({ wallThickness: Math.max(1, toNum(v, 15)) / 100 })} unit="cm espessura" />
              </div>
              {findMergeableWall(selected, elements) && (
                <button onClick={tryMergeSelected} className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded" style={{ ...heading, fontWeight: 600, background: C.gold, color: "#141311" }}>
                  <Link2 size={12} /> Unir com parede adjacente (mesmo alinhamento)
                </button>
              )}
              {findCornerWall(selected, elements) && (
                <button onClick={tryTrimCorner} className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded" style={{ ...heading, fontWeight: 600, background: C.gold, color: "#141311" }}>
                  <CornerUpRight size={12} /> Aparar/unir canto com parede próxima
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
              <PhaseToggles demolir={selected.demolir} construir={selected.construir} onChange={patchSelected} />
              <button onClick={() => patchSelected({ tagRotation: ((selected.tagRotation || 0) + 90) % 360 })}
                className="flex items-center gap-1 px-2 py-1 rounded" style={{ ...heading, fontWeight: 600, background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
                <RotateCcw size={11} /> Girar etiqueta 90°
              </button>
              <button onClick={() => substituteOpening(selected, selected.type === "door" ? "window" : "door")}
                className="flex items-center gap-1 px-2 py-1 rounded" style={{ ...heading, fontWeight: 600, background: C.goldTint, color: C.gold, border: `1px solid ${C.gold}` }}>
                <Repeat size={11} /> Substituir por {selected.type === "door" ? "janela" : "porta"}
              </button>
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
          {selected.type === "door" && (
            <div className="flex items-center gap-2 flex-wrap text-[11px] mt-1.5">
              {/correr/i.test(selected.doorType || "") ? (
                <button onClick={() => patchSelected({ slideDir: (selected.slideDir === -1 ? 1 : -1) })} className="flex items-center gap-1 px-2 py-1 rounded" style={{ ...heading, fontWeight: 600, background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
                  <ArrowLeftRight size={11} /> Inverter sentido de correr
                </button>
              ) : (
                <>
                  <button onClick={() => patchSelected({ swingSide: (selected.swingSide === -1 ? 1 : -1) })} className="flex items-center gap-1 px-2 py-1 rounded" style={{ ...heading, fontWeight: 600, background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
                    <RotateCcw size={11} /> Inverter lado da abertura
                  </button>
                  {Math.max(1, Math.round(toNum(selected.panels, 1))) === 1 && (
                    <button onClick={() => patchSelected({ swingHand: selected.swingHand === "right" ? "left" : "right" })} className="flex items-center gap-1 px-2 py-1 rounded" style={{ ...heading, fontWeight: 600, background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
                      <ArrowLeftRight size={11} /> Inverter dobradiça
                    </button>
                  )}
                </>
              )}
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
              <div className="flex items-center gap-1.5 flex-wrap">
                <button onClick={() => { setNamingId(selected.id); setNamingValue(selected.name || ""); }} className="flex items-center gap-1 px-2 py-1 rounded" style={{ ...heading, fontWeight: 600, background: C.goldTint, color: C.gold, border: `1px solid ${C.gold}` }}>
                  <Pencil size={11} /> Renomear
                </button>
                <button onClick={() => rotateRoomLabel(selected)} className="flex items-center gap-1 px-2 py-1 rounded" style={{ ...heading, fontWeight: 600, background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
                  <RotateCcw size={11} /> Girar {planMode === "forro" ? "forro" : "nome"} 90° (arraste pra reposicionar)
                </button>
              </div>
            </div>
          )}
          {selected.type === "floor" && (
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span style={{ color: C.mute }}>Família:</span>
                <TypeSelect value={selected.floorType || FLOOR_TYPES[0]} options={FLOOR_TYPES} onChange={v => patchSelected({ floorType: v })} />
                <input type="color" value={selected.floorColor || "#B08A5C"} onChange={e => patchSelected({ floorColor: e.target.value })}
                  title="Cor de referência (usada quando a família não tem textura própria)"
                  className="w-6 h-6 rounded" style={{ border: `1px solid ${C.line}`, background: "transparent" }} />
                <span style={{ color: C.mute }}>{selected.area} m²</span>
              </div>
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
          {selected.type === "cota" && (() => {
            const g = cotaGeometry(selected, elements, scale);
            const refEl = selected.mode === "opening" ? elements.find(e => e.id === selected.refId) : null;
            const defaultColor = refEl?.type === "window" ? windowDimColor : refEl?.type === "door" ? doorDimColor : dimColor;
            const defaultFontSize = refEl ? doorWindowDimFontSize : dimFontSize;
            return (
              <div className="flex items-center gap-2 flex-wrap text-[11px]" style={{ color: C.chalk }}>
                <span style={{ color: C.mute }}>Valor:</span>
                <span style={{ ...mono, fontWeight: 700 }}>
                  {g ? (selected.mode === "espessura" ? `${Math.round(g.valueM * 100)} cm` : `${g.valueM.toFixed(2)} m`) : "— (referência apagada)"}
                </span>
                <span style={{ color: C.mute }}>Cor:</span>
                <input type="color" value={selected.color || defaultColor} onChange={e => patchSelected({ color: e.target.value })}
                  className="w-6 h-6 rounded" style={{ border: `1px solid ${C.line}`, background: "transparent" }} />
                {selected.color && (
                  <button onClick={() => patchSelected({ color: undefined })} className="text-[10px] underline" style={{ color: C.mute }}>usar cor padrão{refEl ? ` (${refEl.type === "window" ? "janela" : "porta"})` : ""}</button>
                )}
                <NumField value={toNum(selected.fontSize, defaultFontSize)} onChange={v => patchSelected({ fontSize: v })} unit="tam. fonte" w="w-10" />
                <span style={{ color: C.mute }}>Fonte:</span>
                <select value={selected.fontFamily || level.fontFamily || "padrao"} onChange={e => patchSelected({ fontFamily: e.target.value })}
                  className="text-[11px] px-1.5 py-1 rounded" style={{ background: "rgba(255,255,255,0.06)", color: C.chalk, border: `1px solid ${C.line}` }}>
                  {FONT_FAMILIES.map(f => <option key={f.id} value={f.id} style={{ fontFamily: f.css }}>{f.label}</option>)}
                </select>
              </div>
            );
          })()}
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
      </div>
    </div>
  );
  if (fullscreen) {
    return createPortal(
      <div className="fixed inset-0 overflow-hidden" style={{ zIndex: 999, background: "#141311" }}>
        <div className="relative w-full h-full">{content}</div>
      </div>,
      document.body
    );
  }
  return content;
}
