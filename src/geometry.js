// Pure 2D geometry helpers shared between App.jsx (levelToMeters/
// levelToMetersForRoom/wallRoomAdjacency need pointInPolygon and GRID) and
// VectorSketch.jsx (the Croqui editor, which is what most of these exist
// for) — kept in their own module so VectorSketch.jsx doesn't have to
// import them from App.jsx, which would create a circular import once
// App.jsx imports VectorSketch from there.

export const GRID = 20;
export function snap(v) { return Math.round(v / GRID) * GRID; }
export function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
// Rotates p by degClockwise degrees around pivot, in the same y-down sense
// as SVG's own rotate(deg, cx, cy) transform — used both to build that
// transform's inverse (screen tap -> true element coordinates) and to
// mirror it forward (element coordinates -> current screen position) when
// the Croqui sheet itself has been spun with a two-finger twist.
export function rotatePoint(p, degClockwise, pivot) {
  if (!degClockwise) return p;
  const rad = (degClockwise * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const dx = p.x - pivot.x, dy = p.y - pivot.y;
  return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
}
export function projectPointOnSegment(p, a, b) {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ap = { x: p.x - a.x, y: p.y - a.y };
  const lenSq = ab.x * ab.x + ab.y * ab.y || 1;
  let t = (ap.x * ab.x + ap.y * ab.y) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + ab.x * t, y: a.y + ab.y * t, t };
}
export function pointInPolygon(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
export function polygonCentroid(points) {
  let x = 0, y = 0;
  points.forEach(p => { x += p.x; y += p.y; });
  return { x: x / points.length, y: y / points.length };
}
// Shared by VectorSketch's "Centralizar e enquadrar tudo" button and its
// initial view — every time the canvas (re)mounts (e.g. switching away from
// the Croqui tab and back) it must land centered on the actual drawing
// instead of at a fixed {0,0} origin, or the sketch reappears displaced.
export function fitViewBoxToElements(elements, w, h) {
  if (!elements.length) return { x: 0, y: 0, w, h };
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
  if (!isFinite(minX)) return { x: 0, y: 0, w, h };
  const aspect = w / h;
  // A door/window sitting near a wall's midpoint pushes that wall's own
  // length label out further (see wallLabelOffset's "extra" in
  // VectorSketch) so it clears the opening's own two-line tag (name, then
  // dimensions — same break as the Elevação view) instead of landing on
  // top of it. Reserve a little extra room around the whole drawing only
  // when that situation actually exists, so the pushed-out label has
  // somewhere to go instead of this fit's own edge immediately clamping
  // it back down to where it started — every other layout (the common
  // case) keeps the exact same framing as before.
  const walls = elements.filter(e => e.type === "wall" || e.type === "stair");
  const hasCenteredOpening = elements.some(o => {
    if (o.type !== "door" && o.type !== "window") return false;
    const wl = walls.find(ww => ww.id === o.wallId);
    if (!wl) return false;
    const wdx = wl.x2 - wl.x1, wdy = wl.y2 - wl.y1, wlen = Math.hypot(wdx, wdy) || 1;
    const p = ((o.x - wl.x1) * wdx + (o.y - wl.y1) * wdy) / wlen;
    return Math.abs(p - wlen * 0.5) < 45;
  });
  const pad = hasCenteredOpening ? 35 : 0;
  const contentW = Math.max(30, maxX - minX) + pad, contentH = Math.max(30, maxY - minY) + pad;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  let newW = contentW * 1.3, newH = newW / aspect;
  if (newH < contentH * 1.3) { newH = contentH * 1.3; newW = newH * aspect; }
  newW = Math.max(60, Math.min(4000, newW));
  newH = newW / aspect;
  return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
}
// The <svg> has no preserveAspectRatio override, so it defaults to "xMidYMid
// meet": whenever the viewBox's own aspect ratio doesn't match the element's
// actual on-screen box, the browser letterboxes the drawing (grey bars,
// content shrunk and centered) rather than stretching it. That's the right
// call visually — walls shouldn't distort — but every screen-to-drawing tap
// conversion in this file assumes the drawing fills the box edge to edge,
// so a stale viewBox left over from before the box's aspect ratio changed
// (e.g. selecting an element reveals its editor panel below the canvas,
// shrinking the available height) reads taps at the wrong point — clicking
// a spot near the top of the visible drawing can land on a point further
// down, since the math still divides by the full (now taller-than-content)
// box. Called whenever the box is remeasured, this keeps an existing
// viewBox's width/x (the zoom level and horizontal framing the person left
// it at) and only resizes/recenters its height to match the box's new
// aspect ratio, so the drawing keeps filling the box exactly — no
// letterboxing, and no coordinate drift — instead of only ever being set
// once and left to drift out of sync.
export function resyncVbAspect(v, w, h) {
  const newH = v.w * (h / w);
  const cy = v.y + v.h / 2;
  return { ...v, h: newH, y: cy - newH / 2 };
}
// Shoelace area of a planar polygon given as 3D points {x, z} (y/height is
// ignored) — used both directly (the eave loop) and for a roof plane's own
// slanted area, which for a uniformly-pitched face equals its flat plan
// projection divided by cos(pitch) (the standard roofing-takeoff formula —
// true for a rectangular/trapezoidal face AND for a true 45°-hip's
// triangular ends, since a 45° hip is exactly the construction that keeps
// every face at the same conventional pitch).
export function polygonAreaXZ(points) {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    area += a.x * b.z - b.x * a.z;
  }
  return Math.abs(area / 2);
}
// Builds a roof's 3D planes (each an array of 3-4 coplanar vertices, already
// wound as a polygon) from a wall footprint (minX/maxX/minY/maxY, in the
// same plan meters as everything else) and the roof's own settings —
// shared by App.jsx (to fill in each água's area automatically) and
// ThreeDView (to actually mesh it). baseElevation is where the roof's LOW
// eave sits (a level's own elevation + its wall height).
//
// "1agua" (mono-pitch/lean-to): one full-footprint plane, rising from
// whichever edge highEdge names toward the opposite one.
// "2aguas" (gable): two equal planes meeting at a ridge line down the
// middle, parallel to whichever axis is longer (or ridgeAxis, if set).
// "4aguas" (hip): the same two planes, but only as wide as the ridge —
// shortened by half the short dimension at each end (the standard 45°-hip
// proportion when every face shares one pitch) — plus a triangular hip
// face filling each shortened end. A footprint close to square collapses
// the ridge to a single point (ridgeHalfLen <= 0), giving a 4-sided pyramid
// instead of 4 trapezoids-and-triangles.
export function computeRoofPlanes(settings, footprint, baseElevation) {
  // Negative overhang recesses the roof inward from the wall's outer face
  // (footprint is already built from that face, not the wall centerline —
  // see roofFootprintFromLevel) instead of projecting a beiral past it —
  // clamped so the footprint itself never collapses to zero or flips
  // inside-out on a small building.
  const rawOverhang = settings.overhangM ?? 0.4;
  const minSpan = Math.min(footprint.maxX - footprint.minX, footprint.maxY - footprint.minY);
  const overhang = Math.max(-minSpan / 2 + 0.2, rawOverhang);
  const pitch = (Math.max(0, Math.min(89, settings.pitchDeg ?? 30)) * Math.PI) / 180;
  const minX = footprint.minX - overhang, maxX = footprint.maxX + overhang;
  const minY = footprint.minY - overhang, maxY = footprint.maxY + overhang;
  const W = maxX - minX, D = maxY - minY;
  const eaveLoop = [{ x: minX, z: minY }, { x: maxX, z: minY }, { x: maxX, z: maxY }, { x: minX, z: maxY }];
  const V = (x, z, h) => ({ x, y: baseElevation + h, z });
  const axis = settings.ridgeAxis === "x" || settings.ridgeAxis === "y" ? settings.ridgeAxis : (W >= D ? "x" : "y");

  if (settings.shape === "1agua") {
    const highEdge = settings.highEdge || "maxY";
    const rise = (highEdge === "minX" || highEdge === "maxX" ? W : D) * Math.tan(pitch);
    let plane;
    if (highEdge === "minX") plane = [V(minX, minY, rise), V(minX, maxY, rise), V(maxX, maxY, 0), V(maxX, minY, 0)];
    else if (highEdge === "maxX") plane = [V(maxX, minY, rise), V(maxX, maxY, rise), V(minX, maxY, 0), V(minX, minY, 0)];
    else if (highEdge === "minY") plane = [V(minX, minY, rise), V(maxX, minY, rise), V(maxX, maxY, 0), V(minX, maxY, 0)];
    else plane = [V(minX, maxY, rise), V(maxX, maxY, rise), V(maxX, minY, 0), V(minX, minY, 0)];
    return { planes: [plane], ridge: null, eaveLoop };
  }

  if (settings.shape === "4aguas") {
    if (axis === "x") {
      const rise = (D / 2) * Math.tan(pitch);
      const ridgeHalf = (W - D) / 2, midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
      if (ridgeHalf > 0.001) {
        const rx1 = midX - ridgeHalf, rx2 = midX + ridgeHalf;
        return {
          planes: [
            [V(minX, minY, 0), V(maxX, minY, 0), V(rx2, midY, rise), V(rx1, midY, rise)],
            [V(maxX, maxY, 0), V(minX, maxY, 0), V(rx1, midY, rise), V(rx2, midY, rise)],
            [V(minX, maxY, 0), V(minX, minY, 0), V(rx1, midY, rise)],
            [V(maxX, minY, 0), V(maxX, maxY, 0), V(rx2, midY, rise)],
          ],
          ridge: [{ x: rx1, z: midY }, { x: rx2, z: midY }], eaveLoop,
        };
      }
      const apex = V(midX, midY, rise);
      return { planes: [
        [V(minX, minY, 0), V(maxX, minY, 0), apex], [V(maxX, minY, 0), V(maxX, maxY, 0), apex],
        [V(maxX, maxY, 0), V(minX, maxY, 0), apex], [V(minX, maxY, 0), V(minX, minY, 0), apex],
      ], ridge: null, eaveLoop };
    }
    const rise = (W / 2) * Math.tan(pitch);
    const ridgeHalf = (D - W) / 2, midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
    if (ridgeHalf > 0.001) {
      const ry1 = midY - ridgeHalf, ry2 = midY + ridgeHalf;
      return {
        planes: [
          [V(minX, maxY, 0), V(minX, minY, 0), V(midX, ry1, rise), V(midX, ry2, rise)],
          [V(maxX, minY, 0), V(maxX, maxY, 0), V(midX, ry2, rise), V(midX, ry1, rise)],
          [V(minX, minY, 0), V(maxX, minY, 0), V(midX, ry1, rise)],
          [V(maxX, maxY, 0), V(minX, maxY, 0), V(midX, ry2, rise)],
        ],
        ridge: [{ x: midX, z: ry1 }, { x: midX, z: ry2 }], eaveLoop,
      };
    }
    const apex = V(midX, midY, rise);
    return { planes: [
      [V(minX, minY, 0), V(minX, maxY, 0), apex], [V(minX, maxY, 0), V(maxX, maxY, 0), apex],
      [V(maxX, maxY, 0), V(maxX, minY, 0), apex], [V(maxX, minY, 0), V(minX, minY, 0), apex],
    ], ridge: null, eaveLoop };
  }

  // "2aguas" (also the fallback for any unrecognized shape).
  if (axis === "x") {
    const midY = (minY + maxY) / 2, rise = (D / 2) * Math.tan(pitch);
    return {
      planes: [
        [V(minX, minY, 0), V(maxX, minY, 0), V(maxX, midY, rise), V(minX, midY, rise)],
        [V(maxX, maxY, 0), V(minX, maxY, 0), V(minX, midY, rise), V(maxX, midY, rise)],
      ],
      ridge: [{ x: minX, z: midY }, { x: maxX, z: midY }], eaveLoop,
    };
  }
  const midX = (minX + maxX) / 2, rise = (W / 2) * Math.tan(pitch);
  return {
    planes: [
      [V(minX, minY, 0), V(minX, maxY, 0), V(midX, maxY, rise), V(midX, minY, rise)],
      [V(maxX, maxY, 0), V(maxX, minY, 0), V(midX, minY, rise), V(midX, maxY, rise)],
    ],
    ridge: [{ x: midX, z: minY }, { x: midX, z: maxY }], eaveLoop,
  };
}
export function wrapTextLines(text, maxChars) {
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
