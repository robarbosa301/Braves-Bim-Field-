// Pure 2D geometry helpers shared between App.jsx (levelToMeters/
// levelToMetersForRoom/wallRoomAdjacency need pointInPolygon and GRID) and
// VectorSketch.jsx (the Croqui editor, which is what most of these exist
// for) — kept in their own module so VectorSketch.jsx doesn't have to
// import them from App.jsx, which would create a circular import once
// App.jsx imports VectorSketch from there.

export const GRID = 20;
export function snap(v) { return Math.round(v / GRID) * GRID; }
export function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
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
  // VectorSketch) so it clears the opening's own tag instead of landing
  // on top of it. Reserve a little extra room around the whole drawing
  // only when that situation actually exists, so the pushed-out label
  // has somewhere to go instead of this fit's own edge immediately
  // clamping it back down to where it started — every other layout
  // (the common case) keeps the exact same framing as before.
  const walls = elements.filter(e => e.type === "wall" || e.type === "stair");
  const hasCenteredOpening = elements.some(o => {
    if (o.type !== "door" && o.type !== "window") return false;
    const wl = walls.find(ww => ww.id === o.wallId);
    if (!wl) return false;
    const wdx = wl.x2 - wl.x1, wdy = wl.y2 - wl.y1, wlen = Math.hypot(wdx, wdy) || 1;
    const p = ((o.x - wl.x1) * wdx + (o.y - wl.y1) * wdy) / wlen;
    return Math.abs(p - wlen * 0.5) < 45;
  });
  const pad = hasCenteredOpening ? 26 : 0;
  const contentW = Math.max(30, maxX - minX) + pad, contentH = Math.max(30, maxY - minY) + pad;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  let newW = contentW * 1.3, newH = newW / aspect;
  if (newH < contentH * 1.3) { newH = contentH * 1.3; newW = newH * aspect; }
  newW = Math.max(60, Math.min(4000, newW));
  newH = newW / aspect;
  return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
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
