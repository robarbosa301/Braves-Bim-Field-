// Small pure helpers shared between App.jsx and any code-split view (e.g.
// ThreeDView.jsx) — kept out of App.jsx itself so those views don't need to
// import from it, which would create a circular import once App.jsx
// lazy-loads them.
export const toNum = (v, fallback = 0) => {
  if (v === null || v === undefined || v === "") return fallback;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? fallback : n;
};

export const uid = () => Math.random().toString(36).slice(2, 9);
export const genCode = () => Math.random().toString(36).slice(2, 6).toUpperCase();

// A wall's gross rectangle (length × height) minus whatever door/window
// openings actually punch through it — the same net figure every table,
// panel and export that reports a wall's own área/volume should show,
// since counting a door's area both under "Portas" AND inside its wall's
// full gross área double-counts it project-wide.
export function wallOpeningsAreaM2(openings) {
  return (openings || []).reduce((s, o) => s + toNum(o.width, 0) * toNum(o.height, 0), 0);
}
export function wallNetAreaM2(lengthM, heightM, openings) {
  return Math.max(0, toNum(lengthM, 0) * toNum(heightM, 0) - wallOpeningsAreaM2(openings));
}

export function composeAddress(b) {
  if (!b) return "";
  const line1 = [b.street, b.number].filter(Boolean).join(", ");
  const line2 = [b.neighborhood, b.city, b.state].filter(Boolean).join(", ");
  return [line1, line2].filter(Boolean).join(" — ");
}
