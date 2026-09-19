// Dropdown option lists shared between App.jsx (VectorSketch's Croqui tool
// and the Elementos tab) and ElementRows.jsx (the per-element edit rows) —
// kept in their own module so neither file has to import these from the
// other.
export const WALL_TYPES = ["Alvenaria 15cm", "Alvenaria 20cm", "Concreto", "Drywall", "Divisória de granito", "Vidro"];
const WALL_THICKNESS_M = { "Alvenaria 15cm": 0.15, "Alvenaria 20cm": 0.20, "Concreto": 0.20, "Drywall": 0.10, "Divisória de granito": 0.03, "Vidro": 0.10 };
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
export const DOOR_TYPES = ["Madeira maciça", "Madeira semi-oca", "Alumínio", "Vidro temperado", "Correr — alumínio", "Correr — vidro", "Pivotante", "Sanfonada", "Camarão", "Blindada"];
export const WINDOW_TYPES = ["Alumínio de correr", "Vidro de correr", "Basculante", "Maxim-ar", "Vidro fixo", "Guilhotina", "Veneziana", "Pivotante"];
export const FLOOR_TYPES = ["Porcelanato", "Cerâmica", "Contrapiso aparente", "Madeira/Laminado", "Vinílico", "A definir"];
export const CEILING_TYPES = ["Laje aparente", "Forro de gesso", "Forro em PVC", "Forro mineral (lay-in)", "A definir"];
export const TILE_TYPES = ["Cerâmica", "Concreto", "Fibrocimento", "Metálica (telha zinco)", "Shingle (americana)"];
