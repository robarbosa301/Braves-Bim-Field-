// Dropdown option lists shared between App.jsx (VectorSketch's Croqui tool
// and the Elementos tab) and ElementRows.jsx (the per-element edit rows) —
// kept in their own module so neither file has to import these from the
// other.
export const WALL_TYPES = ["Alvenaria 15cm", "Alvenaria 20cm", "Concreto", "Drywall", "Divisória de granito", "Vidro", "Guarda-corpo (vidro)", "Guarda-corpo (metálico)"];
const WALL_THICKNESS_M = { "Alvenaria 15cm": 0.15, "Alvenaria 20cm": 0.20, "Concreto": 0.20, "Drywall": 0.10, "Divisória de granito": 0.03, "Vidro": 0.10, "Guarda-corpo (vidro)": 0.01, "Guarda-corpo (metálico)": 0.05 };
// Takes either a wall's own type name (legacy call sites, e.g. tests) or
// the wall element itself — an element's own wallThickness, when set,
// overrides whatever its wallType would otherwise imply, so a wall isn't
// stuck at one of the fixed presets (e.g. a real 19cm block wall that
// doesn't match either "15cm" or "20cm").
export function wallThicknessM(wallTypeOrEl) {
  if (wallTypeOrEl && typeof wallTypeOrEl === "object") {
    const t = Number(wallTypeOrEl.wallThickness);
    if (isFinite(t) && t > 0) return t;
    return WALL_THICKNESS_M[wallTypeOrEl.wallType] ?? 0.15;
  }
  return WALL_THICKNESS_M[wallTypeOrEl] ?? 0.15;
}
export const FINISH_TYPES = ["A definir", "Pintura", "Reboco sem pintura", "Sem reboco (aparente)", "Revestimento cerâmico", "Textura acrílica"];
export const DOOR_TYPES = ["Madeira maciça", "Madeira semi-oca", "Alumínio", "Vidro temperado", "Correr — alumínio", "Correr — vidro", "Pivotante", "Sanfonada", "Camarão", "Blindada", "Portão de giro", "Portão de correr", "Portão basculante", "Portão veneziana"];
export const WINDOW_TYPES = ["Alumínio de correr", "Vidro de correr", "Basculante", "Maxim-ar", "Vidro fixo", "Guilhotina", "Veneziana", "Pivotante"];
// Rough material split of each door/window family's own volume (frame vs.
// glass vs. structural material), as fractions summing to 1 — an estimate
// for the 3D view's "volume by material" readout, not a real bill of
// materials (a hollow-core door, a gate's mesh infill etc. all get folded
// into a single dominant material rather than modeled exactly).
export const DOOR_MATERIAL_MIX = {
  "Madeira maciça": [{ material: "Madeira", fraction: 1 }],
  "Madeira semi-oca": [{ material: "Madeira", fraction: 1 }],
  "Alumínio": [{ material: "Alumínio", fraction: 0.3 }, { material: "Vidro", fraction: 0.7 }],
  "Vidro temperado": [{ material: "Vidro", fraction: 0.95 }, { material: "Alumínio", fraction: 0.05 }],
  "Correr — alumínio": [{ material: "Alumínio", fraction: 0.35 }, { material: "Vidro", fraction: 0.65 }],
  "Correr — vidro": [{ material: "Vidro", fraction: 0.9 }, { material: "Alumínio", fraction: 0.1 }],
  "Pivotante": [{ material: "Vidro", fraction: 0.85 }, { material: "Alumínio", fraction: 0.15 }],
  "Sanfonada": [{ material: "Alumínio", fraction: 0.4 }, { material: "Vidro", fraction: 0.6 }],
  "Camarão": [{ material: "Alumínio", fraction: 0.25 }, { material: "Vidro", fraction: 0.75 }],
  "Blindada": [{ material: "Aço", fraction: 0.7 }, { material: "Madeira", fraction: 0.3 }],
  "Portão de giro": [{ material: "Aço", fraction: 1 }],
  "Portão de correr": [{ material: "Aço", fraction: 1 }],
  "Portão basculante": [{ material: "Aço", fraction: 1 }],
  "Portão veneziana": [{ material: "Aço", fraction: 0.85 }, { material: "Alumínio", fraction: 0.15 }],
};
export const WINDOW_MATERIAL_MIX = {
  "Alumínio de correr": [{ material: "Alumínio", fraction: 0.2 }, { material: "Vidro", fraction: 0.8 }],
  "Vidro de correr": [{ material: "Vidro", fraction: 0.9 }, { material: "Alumínio", fraction: 0.1 }],
  "Basculante": [{ material: "Alumínio", fraction: 0.25 }, { material: "Vidro", fraction: 0.75 }],
  "Maxim-ar": [{ material: "Alumínio", fraction: 0.25 }, { material: "Vidro", fraction: 0.75 }],
  "Vidro fixo": [{ material: "Vidro", fraction: 0.95 }, { material: "Alumínio", fraction: 0.05 }],
  "Guilhotina": [{ material: "Madeira", fraction: 0.2 }, { material: "Vidro", fraction: 0.8 }],
  "Veneziana": [{ material: "Madeira", fraction: 0.9 }, { material: "Alumínio", fraction: 0.1 }],
  "Pivotante": [{ material: "Alumínio", fraction: 0.2 }, { material: "Vidro", fraction: 0.8 }],
};
export const FLOOR_TYPES = ["Porcelanato", "Cerâmica", "Contrapiso aparente", "Madeira/Laminado", "Vinílico", "Korodur", "Deck", "A definir"];
export const CEILING_TYPES = ["Laje aparente", "Forro de gesso", "Forro em PVC", "Forro mineral (lay-in)", "A definir"];
export const TILE_TYPES = ["Cerâmica", "Concreto", "Fibrocimento", "Metálica (telha zinco)", "Shingle (americana)"];
// Every css value here needs its own web-safe fallback chain — id "padrao"
// mirrors theme.js's own `heading` font stack, so leaving the picker on
// its default looks exactly like it always has.
export const FONT_FAMILIES = [
  { id: "padrao", label: "Padrão", css: "'Poppins',-apple-system,'SF Pro Display','Segoe UI',Roboto,sans-serif" },
  { id: "inter", label: "Inter (limpa)", css: "'Inter',-apple-system,'Segoe UI',Roboto,sans-serif" },
  { id: "mono", label: "Mono (técnica)", css: "'JetBrains Mono','IBM Plex Mono',monospace" },
  { id: "condensada", label: "Condensada", css: "'Roboto Condensed',Arial,sans-serif" },
  { id: "manuscrita", label: "Manuscrita (arquiteto)", css: "'Architects Daughter',cursive" },
];
export function fontFamilyCss(id) { return FONT_FAMILIES.find(f => f.id === id)?.css || FONT_FAMILIES[0].css; }
