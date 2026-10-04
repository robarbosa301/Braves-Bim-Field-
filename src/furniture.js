// Shared furniture family catalog — the single source of truth both the
// Croqui's 2D "Mobília" tool and ThreeDView's 3D render build a placed
// instance from, so a bed drawn in the 2D plan is the EXACT same bed (same
// proportions, same part list) that shows up in 3D and in the exported
// JSON, instead of two independently-drawn approximations drifting apart.
//
// Each family is a flat list of box/cylinder/sphere "parts" in METERS,
// local to the instance's own origin and rotation: dx runs along the
// family's own width axis, dy along its own depth axis (dy<0 = the
// family's own "back"/headboard/backrest side, by convention — arbitrary
// but consistent), and baseY is each part's own height off the floor (its
// BOTTOM, for box/cyl; a sphere's own baseY+r is its center, since a
// sphere has no flat bottom face to measure from). A placed element then
// only needs to store {familyId, x, y, rotation} — every part's real-world
// position/size is derived from here, both for the 2D top-down footprint
// (w × d, or 2r × 2r — a sphere reads exactly like a cylinder from
// straight above, so 2D draws both the same way) and the 3D mesh (box,
// cylinder, or sphere).
export const FURNITURE_FAMILIES = {
  cama_casal: {
    label: "Cama de casal", category: "Dormitório", wM: 1.4, dM: 2.0, hM: 0.55,
    parts: [
      { shape: "box", dx: 0, dy: 0.04, w: 1.4, d: 2.0, h: 0.32, baseY: 0, color: "#8A6A47" },
      { shape: "box", dx: 0, dy: 0.04, w: 1.34, d: 1.9, h: 0.2, baseY: 0.32, color: "#EAE5D8" },
      { shape: "box", dx: -0.33, dy: -0.78, w: 0.32, d: 0.24, h: 0.12, baseY: 0.52, color: "#F2F0EA" },
      { shape: "box", dx: 0.33, dy: -0.78, w: 0.32, d: 0.24, h: 0.12, baseY: 0.52, color: "#F2F0EA" },
      { shape: "box", dx: 0, dy: -1.0, w: 1.46, d: 0.06, h: 0.55, baseY: 0, color: "#9C8468" },
    ],
  },
  cama_solteiro: {
    label: "Cama de solteiro", category: "Dormitório", wM: 0.95, dM: 1.9, hM: 0.55,
    parts: [
      { shape: "box", dx: 0, dy: 0.04, w: 0.95, d: 1.9, h: 0.32, baseY: 0, color: "#8A6A47" },
      { shape: "box", dx: 0, dy: 0.04, w: 0.89, d: 1.8, h: 0.2, baseY: 0.32, color: "#EAE5D8" },
      { shape: "box", dx: 0, dy: -0.73, w: 0.5, d: 0.26, h: 0.12, baseY: 0.52, color: "#F2F0EA" },
      { shape: "box", dx: 0, dy: -0.95, w: 1.0, d: 0.06, h: 0.55, baseY: 0, color: "#9C8468" },
    ],
  },
  guarda_roupa: {
    label: "Guarda-roupa", category: "Dormitório", wM: 1.6, dM: 0.6, hM: 2.1,
    parts: [
      { shape: "box", dx: 0, dy: 0, w: 1.6, d: 0.6, h: 2.1, baseY: 0, color: "#D9D4C8" },
    ],
  },
  sofa: {
    label: "Sofá", category: "Sala", wM: 2.0, dM: 0.85, hM: 0.8,
    parts: [
      { shape: "box", dx: 0, dy: 0.15, w: 2.0, d: 0.55, h: 0.4, baseY: 0, color: "#6E7C8C" },
      { shape: "box", dx: 0, dy: -0.35, w: 2.0, d: 0.15, h: 0.65, baseY: 0, color: "#6E7C8C" },
      { shape: "box", dx: -0.925, dy: 0, w: 0.15, d: 0.85, h: 0.55, baseY: 0, color: "#5E6C7C" },
      { shape: "box", dx: 0.925, dy: 0, w: 0.15, d: 0.85, h: 0.55, baseY: 0, color: "#5E6C7C" },
    ],
  },
  mesa_jantar: {
    label: "Mesa de jantar (4 lugares)", category: "Sala", wM: 1.5, dM: 0.9, hM: 0.75,
    parts: [
      { shape: "box", dx: 0, dy: 0, w: 1.5, d: 0.9, h: 0.05, baseY: 0.7, color: "#8A6A47" },
      { shape: "box", dx: -0.65, dy: -0.35, w: 0.06, d: 0.06, h: 0.7, baseY: 0, color: "#3A3834" },
      { shape: "box", dx: 0.65, dy: -0.35, w: 0.06, d: 0.06, h: 0.7, baseY: 0, color: "#3A3834" },
      { shape: "box", dx: -0.65, dy: 0.35, w: 0.06, d: 0.06, h: 0.7, baseY: 0, color: "#3A3834" },
      { shape: "box", dx: 0.65, dy: 0.35, w: 0.06, d: 0.06, h: 0.7, baseY: 0, color: "#3A3834" },
      { shape: "cyl", dx: 0, dy: -0.75, r: 0.18, h: 0.45, baseY: 0, color: "#8C8478" },
      { shape: "cyl", dx: 0, dy: 0.75, r: 0.18, h: 0.45, baseY: 0, color: "#8C8478" },
      { shape: "cyl", dx: -1.05, dy: 0, r: 0.18, h: 0.45, baseY: 0, color: "#8C8478" },
      { shape: "cyl", dx: 1.05, dy: 0, r: 0.18, h: 0.45, baseY: 0, color: "#8C8478" },
    ],
  },
  bancada_cozinha: {
    label: "Bancada de cozinha", category: "Cozinha", wM: 2.0, dM: 0.6, hM: 0.9,
    parts: [
      { shape: "box", dx: 0, dy: 0, w: 2.0, d: 0.6, h: 0.9, baseY: 0, color: "#F2F0EA" },
      { shape: "box", dx: 0, dy: 0.01, w: 2.0, d: 0.62, h: 0.04, baseY: 0.9, color: "#D9D4C8" },
    ],
  },
  // ---- Área externa ----
  piscina: {
    label: "Piscina", category: "Área externa", wM: 4.0, dM: 8.0, hM: 1.3,
    parts: [
      { shape: "box", dx: 0, dy: 0, w: 4.0, d: 8.0, h: 0.06, baseY: 0, color: "#C9C4B8" },
      { shape: "box", dx: 0, dy: 0, w: 3.5, d: 7.5, h: 1.3, baseY: -1.3, color: "#4A9CB0" },
    ],
  },
  banco: {
    label: "Banco", category: "Área externa", wM: 1.2, dM: 0.45, hM: 0.8,
    parts: [
      { shape: "box", dx: 0, dy: 0.08, w: 1.2, d: 0.4, h: 0.45, baseY: 0, color: "#8A6A47" },
      { shape: "box", dx: 0, dy: -0.17, w: 1.2, d: 0.06, h: 0.35, baseY: 0.45, color: "#8A6A47" },
    ],
  },
  mesa_externa: {
    label: "Mesa externa (4 lugares)", category: "Área externa", wM: 1.3, dM: 1.3, hM: 0.75,
    parts: [
      { shape: "cyl", dx: 0, dy: 0, r: 0.6, h: 0.05, baseY: 0.7, color: "#E8E4DA" },
      { shape: "cyl", dx: 0, dy: 0, r: 0.08, h: 0.7, baseY: 0, color: "#8C8C86" },
      { shape: "cyl", dx: 0, dy: -0.85, r: 0.18, h: 0.45, baseY: 0, color: "#D9D4C8" },
      { shape: "cyl", dx: 0, dy: 0.85, r: 0.18, h: 0.45, baseY: 0, color: "#D9D4C8" },
      { shape: "cyl", dx: -0.85, dy: 0, r: 0.18, h: 0.45, baseY: 0, color: "#D9D4C8" },
      { shape: "cyl", dx: 0.85, dy: 0, r: 0.18, h: 0.45, baseY: 0, color: "#D9D4C8" },
    ],
  },
  // ---- Paisagismo ----
  vaso_planta: {
    label: "Vaso de planta", category: "Paisagismo", wM: 0.5, dM: 0.5, hM: 0.8,
    parts: [
      { shape: "cyl", dx: 0, dy: 0, r: 0.16, h: 0.25, baseY: 0, color: "#B5623A" },
      { shape: "sphere", dx: 0, dy: 0, r: 0.26, baseY: 0.25, color: "#4A7C3F" },
    ],
  },
  planta_alta: {
    label: "Planta alta", category: "Paisagismo", wM: 0.8, dM: 0.8, hM: 1.1,
    parts: [
      { shape: "cyl", dx: 0, dy: 0, r: 0.2, h: 0.3, baseY: 0, color: "#B5623A" },
      { shape: "sphere", dx: 0, dy: 0, r: 0.4, baseY: 0.3, color: "#3C6E38" },
    ],
  },
  planta_baixa: {
    label: "Planta baixa", category: "Paisagismo", wM: 0.5, dM: 0.5, hM: 0.5,
    parts: [
      { shape: "sphere", dx: 0, dy: 0, r: 0.25, baseY: 0, color: "#5A8C4E" },
    ],
  },
  palmeira: {
    label: "Palmeira", category: "Paisagismo", wM: 1.6, dM: 1.6, hM: 3.2,
    parts: [
      { shape: "cyl", dx: 0, dy: 0, r: 0.1, h: 2.2, baseY: 0, color: "#8A6A47" },
      { shape: "sphere", dx: 0, dy: 0, r: 0.7, baseY: 2.3, color: "#3C6E38" },
      { shape: "sphere", dx: 0.3, dy: 0.15, r: 0.42, baseY: 2.65, color: "#4A7C3F" },
    ],
  },
};
// Display order for the catalog picker — grouped by category (header rows
// in the 2D tool panel key off each family's own `category` field, in the
// order their first member appears here).
export const FURNITURE_LIST = [
  "cama_casal", "cama_solteiro", "guarda_roupa",
  "sofa", "mesa_jantar",
  "bancada_cozinha",
  "piscina", "banco", "mesa_externa",
  "vaso_planta", "planta_alta", "planta_baixa", "palmeira",
];
