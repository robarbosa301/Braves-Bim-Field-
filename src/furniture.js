// Shared furniture family catalog — the single source of truth both the
// Croqui's 2D "Mobília" tool and ThreeDView's 3D render build a placed
// instance from, so a bed drawn in the 2D plan is the EXACT same bed (same
// proportions, same part list) that shows up in 3D and in the exported
// JSON, instead of two independently-drawn approximations drifting apart.
//
// Each family is a flat list of box/cylinder/sphere/canopy "parts" in
// METERS, local to the instance's own origin and rotation: dx runs along
// the family's own width axis, dy along its own depth axis (dy<0 = the
// family's own "back"/headboard/backrest side, by convention — arbitrary
// but consistent), and baseY is each part's own height off the floor (its
// BOTTOM, for box/cyl; a sphere/canopy's own baseY+r is its CENTER, since
// neither has a flat bottom face to measure from). A placed element then
// only needs to store {familyId, x, y, rotation} — every part's real-world
// position/size is derived from here, both for the 2D top-down footprint
// and the 3D mesh.
//
// "canopy" is a 2D-only distinction from "sphere" — same single sphere in
// 3D (a cluster of tiny spheres would cost more geometry than it's worth
// at plant scale), but drawn as CANOPY_CLUSTER's fixed "fluffy cloud" of
// overlapping circles in the 2D plan instead of one flat circle, reading
// as an actual tree/shrub symbol the way a real architectural plan draws
// landscaping, not a geometric dot.
export const CANOPY_CLUSTER = [
  { dx: 0, dy: 0, rf: 0.62 },
  { dx: -0.45, dy: -0.35, rf: 0.42 },
  { dx: 0.42, dy: -0.4, rf: 0.4 },
  { dx: -0.4, dy: 0.38, rf: 0.38 },
  { dx: 0.38, dy: 0.4, rf: 0.4 },
  { dx: 0.05, dy: -0.58, rf: 0.3 },
];

// A dining/outdoor chair as its own little plan symbol (seat + a thinner
// backrest panel on the side FACING AWAY from the table) instead of a
// bare circle — "dir" is the unit vector pointing from the table center
// out through the chair (where its backrest sits), "axis" picks which
// side of the seat that panel spans (the seat's own width or depth).
function chairParts(dx, dy, dir, axis, color) {
  const back = axis === "x"
    ? { shape: "box", dx: dx + dir[0] * 0.19, dy, w: 0.36, d: 0.05, h: 0.43, baseY: 0.4, color }
    : { shape: "box", dx, dy: dy + dir[1] * 0.19, w: 0.05, d: 0.36, h: 0.43, baseY: 0.4, color };
  return [
    { shape: "box", dx, dy, w: 0.36, d: 0.36, h: 0.4, baseY: 0, color },
    back,
  ];
}

export const FURNITURE_FAMILIES = {
  cama_casal: {
    label: "Cama de casal", category: "Dormitório", wM: 1.4, dM: 2.0, hM: 0.55,
    parts: [
      { shape: "box", dx: 0, dy: 0.04, w: 1.4, d: 2.0, h: 0.32, baseY: 0, color: "#8A6A47" },
      { shape: "box", dx: 0, dy: 0.04, w: 1.34, d: 1.9, h: 0.2, baseY: 0.32, color: "#EAE5D8" },
      { shape: "box", dx: -0.33, dy: -0.78, w: 0.32, d: 0.24, h: 0.12, baseY: 0.52, color: "#F2F0EA" },
      { shape: "box", dx: 0.33, dy: -0.78, w: 0.32, d: 0.24, h: 0.12, baseY: 0.52, color: "#F2F0EA" },
      { shape: "box", dx: 0, dy: -1.0, w: 1.46, d: 0.06, h: 0.55, baseY: 0, color: "#9C8468" },
      // Folded-back duvet edge at the foot of the bed — the one detail that
      // reads "made bed" instead of a flat upholstered slab from above.
      { shape: "box", dx: 0, dy: 0.86, w: 1.34, d: 0.22, h: 0.04, baseY: 0.52, color: "#DCD4BE" },
    ],
  },
  cama_solteiro: {
    label: "Cama de solteiro", category: "Dormitório", wM: 0.95, dM: 1.9, hM: 0.55,
    parts: [
      { shape: "box", dx: 0, dy: 0.04, w: 0.95, d: 1.9, h: 0.32, baseY: 0, color: "#8A6A47" },
      { shape: "box", dx: 0, dy: 0.04, w: 0.89, d: 1.8, h: 0.2, baseY: 0.32, color: "#EAE5D8" },
      { shape: "box", dx: 0, dy: -0.73, w: 0.5, d: 0.26, h: 0.12, baseY: 0.52, color: "#F2F0EA" },
      { shape: "box", dx: 0, dy: -0.95, w: 1.0, d: 0.06, h: 0.55, baseY: 0, color: "#9C8468" },
      { shape: "box", dx: 0, dy: 0.78, w: 0.83, d: 0.2, h: 0.04, baseY: 0.52, color: "#DCD4BE" },
    ],
  },
  guarda_roupa: {
    label: "Guarda-roupa", category: "Dormitório", wM: 1.6, dM: 0.6, hM: 2.1,
    parts: [
      { shape: "box", dx: 0, dy: 0, w: 1.6, d: 0.6, h: 2.1, baseY: 0, color: "#D9D4C8" },
      // Door-panel seams — two thin darker strips reading as the gaps
      // between a 3-door wardrobe's own panels, instead of one blank slab.
      { shape: "box", dx: -0.27, dy: 0, w: 0.02, d: 0.6, h: 2.1, baseY: 0, color: "#8C8880" },
      { shape: "box", dx: 0.27, dy: 0, w: 0.02, d: 0.6, h: 2.1, baseY: 0, color: "#8C8880" },
      // Door handles — small vertical pulls on the two inner doors, next to
      // the seams, so the panels read as openable doors, not a solid block.
      { shape: "box", dx: -0.2, dy: 0.31, w: 0.03, d: 0.03, h: 0.18, baseY: 1.0, color: "#4A4A46" },
      { shape: "box", dx: 0.2, dy: 0.31, w: 0.03, d: 0.03, h: 0.18, baseY: 1.0, color: "#4A4A46" },
    ],
  },
  sofa: {
    label: "Sofá", category: "Sala", wM: 2.0, dM: 0.85, hM: 0.8,
    parts: [
      { shape: "box", dx: 0, dy: 0.15, w: 2.0, d: 0.55, h: 0.4, baseY: 0, color: "#6E7C8C" },
      { shape: "box", dx: 0, dy: -0.35, w: 2.0, d: 0.15, h: 0.65, baseY: 0, color: "#6E7C8C" },
      { shape: "box", dx: -0.925, dy: 0, w: 0.15, d: 0.85, h: 0.55, baseY: 0, color: "#5E6C7C" },
      { shape: "box", dx: 0.925, dy: 0, w: 0.15, d: 0.85, h: 0.55, baseY: 0, color: "#5E6C7C" },
      // Cushion seams — splits the seat into 3 cushions, same read as a
      // real 3-seat sofa plan symbol instead of one solid cushion block.
      { shape: "box", dx: -0.33, dy: 0.15, w: 0.02, d: 0.53, h: 0.39, baseY: 0.005, color: "#5E6C7C" },
      { shape: "box", dx: 0.33, dy: 0.15, w: 0.02, d: 0.53, h: 0.39, baseY: 0.005, color: "#5E6C7C" },
      // Throw pillows propped in the corners against the backrest.
      { shape: "box", dx: -0.65, dy: -0.2, w: 0.3, d: 0.26, h: 0.3, baseY: 0.4, color: "#B08968" },
      { shape: "box", dx: 0.65, dy: -0.2, w: 0.3, d: 0.26, h: 0.3, baseY: 0.4, color: "#B08968" },
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
      // Centerpiece bowl — the small detail that keeps the tabletop from
      // reading as a bare board between place settings.
      { shape: "cyl", dx: 0, dy: 0, r: 0.12, h: 0.06, baseY: 0.75, color: "#8C9C7C" },
      ...chairParts(0, -0.75, [0, -1], "x", "#8C8478"),
      ...chairParts(0, 0.75, [0, 1], "x", "#8C8478"),
      ...chairParts(-1.05, 0, [-1, 0], "y", "#8C8478"),
      ...chairParts(1.05, 0, [1, 0], "y", "#8C8478"),
    ],
  },
  bancada_cozinha: {
    label: "Bancada de cozinha", category: "Cozinha", wM: 2.0, dM: 0.6, hM: 0.9,
    parts: [
      { shape: "box", dx: 0, dy: 0, w: 2.0, d: 0.6, h: 0.9, baseY: 0, color: "#F2F0EA" },
      { shape: "box", dx: 0, dy: 0.01, w: 2.0, d: 0.62, h: 0.04, baseY: 0.9, color: "#D9D4C8" },
      // Sink basin (inset rectangle) on one end, cooktop burners (4 small
      // circles) on the other — the same two fixtures a real kitchen-plan
      // symbol always marks on a run of bancada, instead of a blank slab.
      { shape: "box", dx: -0.65, dy: 0, w: 0.5, d: 0.38, h: 0.015, baseY: 0.94, color: "#B9B6AE" },
      { shape: "cyl", dx: 0.42, dy: -0.12, r: 0.07, h: 0.01, baseY: 0.945, color: "#3A3834" },
      { shape: "cyl", dx: 0.7, dy: -0.12, r: 0.07, h: 0.01, baseY: 0.945, color: "#3A3834" },
      { shape: "cyl", dx: 0.42, dy: 0.12, r: 0.07, h: 0.01, baseY: 0.945, color: "#3A3834" },
      { shape: "cyl", dx: 0.7, dy: 0.12, r: 0.07, h: 0.01, baseY: 0.945, color: "#3A3834" },
      // Cabinet-door seams under the counter, same wardrobe convention —
      // splits the base run into 3 doors instead of one blind panel.
      { shape: "box", dx: -0.33, dy: 0, w: 0.02, d: 0.6, h: 0.9, baseY: 0, color: "#C9C4B8" },
      { shape: "box", dx: 0.33, dy: 0, w: 0.02, d: 0.6, h: 0.9, baseY: 0, color: "#C9C4B8" },
    ],
  },
  // ---- Área externa ----
  piscina: {
    label: "Piscina", category: "Área externa", wM: 4.0, dM: 8.0, hM: 1.3,
    parts: [
      { shape: "box", dx: 0, dy: 0, w: 4.0, d: 8.0, h: 0.06, baseY: 0, color: "#C9C4B8" },
      { shape: "box", dx: 0, dy: 0, w: 3.5, d: 7.5, h: 1.3, baseY: -1.3, color: "#4A9CB0" },
      // Access ladder rails in one corner — reads as a real pool, not a
      // water-filled rectangle.
      { shape: "cyl", dx: -1.55, dy: -3.55, r: 0.02, h: 0.5, baseY: 0, color: "#C9C4B8" },
      { shape: "cyl", dx: -1.35, dy: -3.55, r: 0.02, h: 0.5, baseY: 0, color: "#C9C4B8" },
    ],
  },
  banco: {
    label: "Banco", category: "Área externa", wM: 1.2, dM: 0.45, hM: 0.8,
    parts: [
      { shape: "box", dx: 0, dy: 0.08, w: 1.2, d: 0.4, h: 0.45, baseY: 0, color: "#8A6A47" },
      { shape: "box", dx: 0, dy: -0.17, w: 1.2, d: 0.06, h: 0.35, baseY: 0.45, color: "#8A6A47" },
      // Armrests at both ends.
      { shape: "box", dx: -0.57, dy: 0, w: 0.04, d: 0.4, h: 0.22, baseY: 0.45, color: "#8A6A47" },
      { shape: "box", dx: 0.57, dy: 0, w: 0.04, d: 0.4, h: 0.22, baseY: 0.45, color: "#8A6A47" },
    ],
  },
  mesa_externa: {
    label: "Mesa externa (4 lugares)", category: "Área externa", wM: 1.3, dM: 1.3, hM: 0.75,
    parts: [
      { shape: "cyl", dx: 0, dy: 0, r: 0.6, h: 0.05, baseY: 0.7, color: "#E8E4DA" },
      { shape: "cyl", dx: 0, dy: 0, r: 0.08, h: 0.7, baseY: 0, color: "#8C8C86" },
      { shape: "cyl", dx: 0, dy: 0, r: 0.035, h: 0.04, baseY: 0.75, color: "#8C8C86" },
      ...chairParts(0, -0.85, [0, -1], "x", "#D9D4C8"),
      ...chairParts(0, 0.85, [0, 1], "x", "#D9D4C8"),
      ...chairParts(-0.85, 0, [-1, 0], "y", "#D9D4C8"),
      ...chairParts(0.85, 0, [1, 0], "y", "#D9D4C8"),
    ],
  },
  // ---- Paisagismo ----
  vaso_planta: {
    label: "Vaso de planta", category: "Paisagismo", wM: 0.5, dM: 0.5, hM: 0.8,
    parts: [
      { shape: "cyl", dx: 0, dy: 0, r: 0.16, h: 0.25, baseY: 0, color: "#B5623A" },
      // Lighter rim ring at the pot's lip.
      { shape: "cyl", dx: 0, dy: 0, r: 0.17, h: 0.025, baseY: 0.225, color: "#C9733E" },
      { shape: "canopy", dx: 0, dy: 0, r: 0.26, baseY: 0.25, color: "#4A7C3F" },
    ],
  },
  planta_alta: {
    label: "Planta alta", category: "Paisagismo", wM: 0.8, dM: 0.8, hM: 1.1,
    parts: [
      { shape: "cyl", dx: 0, dy: 0, r: 0.2, h: 0.3, baseY: 0, color: "#B5623A" },
      { shape: "cyl", dx: 0, dy: 0, r: 0.21, h: 0.03, baseY: 0.27, color: "#C9733E" },
      { shape: "canopy", dx: 0, dy: 0, r: 0.4, baseY: 0.3, color: "#3C6E38" },
    ],
  },
  planta_baixa: {
    label: "Planta baixa", category: "Paisagismo", wM: 0.5, dM: 0.5, hM: 0.5,
    parts: [
      { shape: "canopy", dx: 0, dy: 0, r: 0.25, baseY: 0, color: "#5A8C4E" },
      // A second, smaller offset clump so it reads as a fuller shrub
      // instead of one perfectly round bush.
      { shape: "canopy", dx: 0.12, dy: 0.09, r: 0.16, baseY: 0, color: "#6B9C5E" },
    ],
  },
  palmeira: {
    label: "Palmeira", category: "Paisagismo", wM: 1.6, dM: 1.6, hM: 3.2,
    parts: [
      { shape: "cyl", dx: 0, dy: 0, r: 0.1, h: 2.2, baseY: 0, color: "#8A6A47" },
      // Bark rings along the trunk.
      { shape: "cyl", dx: 0, dy: 0, r: 0.105, h: 0.05, baseY: 0.65, color: "#6E5438" },
      { shape: "cyl", dx: 0, dy: 0, r: 0.105, h: 0.05, baseY: 1.35, color: "#6E5438" },
      { shape: "canopy", dx: 0, dy: 0, r: 0.7, baseY: 2.3, color: "#3C6E38" },
      { shape: "canopy", dx: 0.3, dy: 0.15, r: 0.42, baseY: 2.65, color: "#4A7C3F" },
    ],
  },
  // ---- Banheiro ----
  vaso_sanitario: {
    label: "Vaso sanitário", category: "Banheiro", wM: 0.4, dM: 0.65, hM: 0.4,
    parts: [
      { shape: "box", dx: 0, dy: -0.28, w: 0.38, d: 0.18, h: 0.38, baseY: 0, color: "#F2F0EA" },
      { shape: "cyl", dx: 0, dy: 0.1, r: 0.19, h: 0.4, baseY: 0, color: "#F2F0EA" },
      // The seat/lid split line — same thin-seam trick the wardrobe/sofa
      // use, just here it's what actually reads a round bowl as a TOILET
      // instead of a sink or a stool from directly above.
      { shape: "box", dx: 0, dy: 0.02, w: 0.3, d: 0.02, h: 0.015, baseY: 0.4, color: "#C9C4B8" },
      // Flush lever on the tank.
      { shape: "box", dx: 0.14, dy: -0.32, w: 0.05, d: 0.025, h: 0.03, baseY: 0.3, color: "#C9C4B8" },
    ],
  },
  pia_banheiro: {
    label: "Pia de banheiro", category: "Banheiro", wM: 0.6, dM: 0.45, hM: 0.85,
    parts: [
      { shape: "box", dx: 0, dy: 0, w: 0.6, d: 0.45, h: 0.78, baseY: 0, color: "#D9D4C8" },
      { shape: "cyl", dx: 0, dy: -0.02, r: 0.17, h: 0.07, baseY: 0.78, color: "#F2F0EA" },
      // Faucet and a cabinet-door seam under the basin.
      { shape: "cyl", dx: 0, dy: -0.16, r: 0.015, h: 0.12, baseY: 0.85, color: "#8C8C86" },
      { shape: "box", dx: 0, dy: 0, w: 0.02, d: 0.45, h: 0.78, baseY: 0, color: "#C9C4B8" },
    ],
  },
  box_chuveiro: {
    label: "Box de chuveiro", category: "Banheiro", wM: 0.9, dM: 0.9, hM: 2.0,
    parts: [
      { shape: "box", dx: 0, dy: 0, w: 0.9, d: 0.9, h: 0.03, baseY: 0, color: "#DCE6EA" },
      { shape: "cyl", dx: 0, dy: 0, r: 0.05, h: 0.01, baseY: 0.03, color: "#8C8C86" },
      // The glass panel on the open side (the other two sides sit flush
      // against the room's own walls, same convention a real box-de-vidro
      // plan symbol uses — one thin line marking just the door/panel run).
      { shape: "box", dx: 0, dy: 0.45, w: 0.9, d: 0.02, h: 1.9, baseY: 0, color: "#BFD9E0" },
      // Shower head on the back wall, and a handle on the glass panel.
      { shape: "cyl", dx: -0.3, dy: -0.43, r: 0.04, h: 0.04, baseY: 1.9, color: "#8C8C86" },
      { shape: "box", dx: 0.35, dy: 0.46, w: 0.03, d: 0.02, h: 0.15, baseY: 1.0, color: "#8C8C86" },
    ],
  },
  // ---- Cozinha (continuação) ----
  geladeira: {
    label: "Geladeira", category: "Cozinha", wM: 0.7, dM: 0.7, hM: 1.8,
    parts: [
      { shape: "box", dx: 0, dy: 0, w: 0.7, d: 0.7, h: 1.8, baseY: 0, color: "#F2F0EA" },
      { shape: "box", dx: 0, dy: 0, w: 0.02, d: 0.7, h: 1.8, baseY: 0, color: "#C9C4B8" },
      // Door handles on both sides of the center seam.
      { shape: "box", dx: -0.08, dy: 0.36, w: 0.025, d: 0.025, h: 0.9, baseY: 0.45, color: "#8C8C86" },
      { shape: "box", dx: 0.08, dy: 0.36, w: 0.025, d: 0.025, h: 0.9, baseY: 0.45, color: "#8C8C86" },
    ],
  },
  fogao: {
    label: "Fogão", category: "Cozinha", wM: 0.6, dM: 0.6, hM: 0.9,
    parts: [
      { shape: "box", dx: 0, dy: 0, w: 0.6, d: 0.6, h: 0.9, baseY: 0, color: "#D9D4C8" },
      { shape: "cyl", dx: -0.14, dy: -0.14, r: 0.08, h: 0.01, baseY: 0.9, color: "#3A3834" },
      { shape: "cyl", dx: 0.14, dy: -0.14, r: 0.08, h: 0.01, baseY: 0.9, color: "#3A3834" },
      { shape: "cyl", dx: -0.14, dy: 0.14, r: 0.08, h: 0.01, baseY: 0.9, color: "#3A3834" },
      { shape: "cyl", dx: 0.14, dy: 0.14, r: 0.08, h: 0.01, baseY: 0.9, color: "#3A3834" },
      // Control knobs and the oven-door seam on the front face.
      { shape: "cyl", dx: -0.2, dy: 0.31, r: 0.025, h: 0.02, baseY: 0.75, color: "#4A4A46" },
      { shape: "cyl", dx: -0.07, dy: 0.31, r: 0.025, h: 0.02, baseY: 0.75, color: "#4A4A46" },
      { shape: "cyl", dx: 0.07, dy: 0.31, r: 0.025, h: 0.02, baseY: 0.75, color: "#4A4A46" },
      { shape: "cyl", dx: 0.2, dy: 0.31, r: 0.025, h: 0.02, baseY: 0.75, color: "#4A4A46" },
      { shape: "box", dx: 0, dy: 0.305, w: 0.5, d: 0.01, h: 0.02, baseY: 0.3, color: "#8C8880" },
    ],
  },
  // ---- Área de serviço ----
  maquina_lavar: {
    label: "Máquina de lavar", category: "Área de serviço", wM: 0.6, dM: 0.6, hM: 0.85,
    parts: [
      { shape: "box", dx: 0, dy: 0, w: 0.6, d: 0.6, h: 0.85, baseY: 0, color: "#F2F0EA" },
      { shape: "cyl", dx: 0, dy: 0, r: 0.2, h: 0.01, baseY: 0.85, color: "#C9C4B8" },
      // Control panel strip and knob.
      { shape: "box", dx: 0, dy: -0.26, w: 0.55, d: 0.06, h: 0.015, baseY: 0.85, color: "#D9D4C8" },
      { shape: "cyl", dx: 0.22, dy: -0.26, r: 0.025, h: 0.02, baseY: 0.865, color: "#8C8C86" },
    ],
  },
  tanque_lavanderia: {
    label: "Tanque", category: "Área de serviço", wM: 0.5, dM: 0.45, hM: 0.85,
    parts: [
      { shape: "box", dx: 0, dy: 0, w: 0.5, d: 0.45, h: 0.78, baseY: 0, color: "#D9D4C8" },
      { shape: "box", dx: 0, dy: -0.02, w: 0.4, d: 0.3, h: 0.07, baseY: 0.78, color: "#F2F0EA" },
      // Faucet.
      { shape: "cyl", dx: 0, dy: -0.1, r: 0.015, h: 0.1, baseY: 0.85, color: "#8C8C86" },
    ],
  },
  // ---- Garagem ----
  // A real top-view car plan symbol, not a box with blocks stuck to its
  // corners: a rounded body silhouette (dy<0 = front, matching the mirrors/
  // lights below), a narrower rounded cabin/greenhouse inset to read as the
  // car's roof+glass, and the wheels sitting INSIDE the body footprint
  // (flush with the flanks, like real wheel arches) instead of poking out
  // past the edges — that corner-block look was the "5-year-old" tell.
  carro: {
    label: "Carro", category: "Garagem", wM: 1.8, dM: 4.5, hM: 1.4,
    parts: [
      { shape: "box", dx: 0, dy: 0, w: 1.8, d: 4.5, h: 1.4, baseY: 0, color: "#6B7280", rx: 0.4 },
      // Cabin/greenhouse — narrower and set slightly rear-of-center, the
      // one feature that reads "car" instead of "box" from directly above.
      { shape: "box", dx: 0, dy: 0.15, w: 1.42, d: 2.3, h: 0.08, baseY: 1.4, color: "#262A31", rx: 0.3 },
      // Wheels inset within the body footprint, flush with the flanks.
      { shape: "box", dx: -0.68, dy: -1.55, w: 0.26, d: 0.6, h: 0.32, baseY: 0, color: "#1C1E22", rx: 0.08 },
      { shape: "box", dx: 0.68, dy: -1.55, w: 0.26, d: 0.6, h: 0.32, baseY: 0, color: "#1C1E22", rx: 0.08 },
      { shape: "box", dx: -0.68, dy: 1.55, w: 0.26, d: 0.6, h: 0.32, baseY: 0, color: "#1C1E22", rx: 0.08 },
      { shape: "box", dx: 0.68, dy: 1.55, w: 0.26, d: 0.6, h: 0.32, baseY: 0, color: "#1C1E22", rx: 0.08 },
      // Side mirrors — just a small flush bump, not a slab.
      { shape: "box", dx: -0.93, dy: -0.85, w: 0.06, d: 0.16, h: 0.05, baseY: 0.95, color: "#C9CDD1", rx: 0.02 },
      { shape: "box", dx: 0.93, dy: -0.85, w: 0.06, d: 0.16, h: 0.05, baseY: 0.95, color: "#C9CDD1", rx: 0.02 },
      // Headlight and taillight pods, inset from the very front/rear edge.
      { shape: "box", dx: -0.55, dy: -2.17, w: 0.3, d: 0.07, h: 0.12, baseY: 0.35, color: "#F2E4B0", rx: 0.03 },
      { shape: "box", dx: 0.55, dy: -2.17, w: 0.3, d: 0.07, h: 0.12, baseY: 0.35, color: "#F2E4B0", rx: 0.03 },
      { shape: "box", dx: -0.55, dy: 2.17, w: 0.3, d: 0.07, h: 0.15, baseY: 0.5, color: "#B5423A", rx: 0.03 },
      { shape: "box", dx: 0.55, dy: 2.17, w: 0.3, d: 0.07, h: 0.15, baseY: 0.5, color: "#B5423A", rx: 0.03 },
    ],
  },
  moto: {
    label: "Moto", category: "Garagem", wM: 0.5, dM: 2.0, hM: 1.1,
    parts: [
      // Tapered teardrop body (tank narrower toward the tail) instead of a
      // plain bar, with a generous rx so it actually reads as a fairing.
      { shape: "box", dx: 0, dy: -0.15, w: 0.32, d: 0.75, h: 0.5, baseY: 0, color: "#4A5568", rx: 0.14 },
      { shape: "box", dx: 0, dy: 0.42, w: 0.22, d: 0.5, h: 0.42, baseY: 0, color: "#4A5568", rx: 0.1 },
      { shape: "cyl", dx: 0, dy: -0.75, r: 0.15, h: 0.6, baseY: 0, color: "#232220" },
      { shape: "cyl", dx: 0, dy: 0.75, r: 0.15, h: 0.6, baseY: 0, color: "#232220" },
      // Handlebar and seat.
      { shape: "box", dx: 0, dy: -0.78, w: 0.45, d: 0.04, h: 0.04, baseY: 0.95, color: "#232220", rx: 0.02 },
      { shape: "box", dx: 0, dy: 0.1, w: 0.3, d: 0.4, h: 0.08, baseY: 0.5, color: "#232220", rx: 0.08 },
    ],
  },
  bicicleta: {
    label: "Bicicleta", category: "Garagem", wM: 0.3, dM: 1.2, hM: 1.0,
    parts: [
      { shape: "box", dx: 0, dy: 0, w: 0.08, d: 1.0, h: 0.3, baseY: 0, color: "#3A3834", rx: 0.04 },
      { shape: "cyl", dx: 0, dy: -0.55, r: 0.12, h: 0.04, baseY: 0, color: "#232220" },
      { shape: "cyl", dx: 0, dy: 0.55, r: 0.12, h: 0.04, baseY: 0, color: "#232220" },
      // Handlebar and seat.
      { shape: "box", dx: 0, dy: -0.5, w: 0.4, d: 0.03, h: 0.03, baseY: 0.85, color: "#3A3834", rx: 0.015 },
      { shape: "box", dx: 0, dy: 0.38, w: 0.1, d: 0.22, h: 0.03, baseY: 0.78, color: "#232220", rx: 0.05 },
    ],
  },
  // ---- Sala (continuação) ----
  painel_tv: {
    label: "Painel de TV", category: "Sala", wM: 1.8, dM: 0.45, hM: 1.1,
    parts: [
      { shape: "box", dx: 0, dy: 0.08, w: 1.8, d: 0.4, h: 0.45, baseY: 0, color: "#8A6A47" },
      { shape: "box", dx: 0, dy: -0.12, w: 1.1, d: 0.06, h: 0.65, baseY: 0.45, color: "#1A1A1A" },
      // Screen glow inset within the bezel.
      { shape: "box", dx: 0, dy: -0.1, w: 1.02, d: 0.02, h: 0.57, baseY: 0.49, color: "#2E4057" },
    ],
  },
};
// Display order for the catalog picker — grouped by category (header rows
// in the 2D tool panel key off each family's own `category` field, in the
// order their first member appears here).
export const FURNITURE_LIST = [
  "cama_casal", "cama_solteiro", "guarda_roupa",
  "sofa", "mesa_jantar", "painel_tv",
  "bancada_cozinha", "geladeira", "fogao",
  "vaso_sanitario", "pia_banheiro", "box_chuveiro",
  "maquina_lavar", "tanque_lavanderia",
  "piscina", "banco", "mesa_externa",
  "vaso_planta", "planta_alta", "planta_baixa", "palmeira",
  "carro", "moto", "bicicleta",
];
