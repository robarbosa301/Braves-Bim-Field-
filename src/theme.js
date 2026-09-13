// ---- BRAVES brand tokens (dark metallic theme) -----------------------------
// Shared between App.jsx and any code-split view (e.g. ThreeDView.jsx) that
// needs the same palette — kept in its own module so those views don't have
// to import from App.jsx itself (which would create a circular import once
// App.jsx lazy-loads them).
export const C = {
  chalk: "#F3F1EA",
  mute: "#A39D90",
  muteDim: "#7A756B",
  panel: "rgba(255,255,255,0.045)",
  panelAlt: "rgba(255,255,255,0.065)",
  line: "rgba(255,255,255,0.11)",
  gold: "#FFFFFF",
  goldTint: "rgba(255,255,255,0.14)",
  bad: "#C1543F",
  good: "#6B9C5A",
};
