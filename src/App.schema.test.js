import { describe, it, expect } from "vitest";
import {
  composeAddress,
  wallToM,
  doorToM,
  windowToM,
  levelToMeters,
  buildLevantamentoSchema,
  wallSpanForRoom,
  wallsForRoom,
  isWallExterior,
  buildingElevationStack,
  levelToMetersForRoom,
} from "./App.jsx";
import { conditionColor, phaseColor } from "./theme.js";
import { wallThicknessM } from "./constants.js";

describe("wallThicknessM", () => {
  it("looks up known wall types", () => {
    expect(wallThicknessM("Alvenaria 15cm")).toBe(0.15);
    expect(wallThicknessM("Drywall")).toBe(0.10);
  });

  it("falls back to 0.15 for an unknown/missing type", () => {
    expect(wallThicknessM("???")).toBe(0.15);
    expect(wallThicknessM(undefined)).toBe(0.15);
  });
});

describe("conditionColor / phaseColor", () => {
  it("gives a distinct color per condition and falls back to muted for unset", () => {
    expect(conditionColor("Bom")).not.toBe(conditionColor("Ruim"));
    expect(conditionColor("A confirmar")).not.toBe(conditionColor("Bom"));
  });

  it("prioritizes demolir over construir when (invalidly) both are set", () => {
    expect(phaseColor({ demolir: true, construir: true })).toBe(phaseColor({ demolir: true }));
  });

  it("returns null (no phase override) for an untouched element", () => {
    expect(phaseColor({})).toBeNull();
  });
});

describe("wallSpanForRoom", () => {
  // A 10m wall (0..400px @ 0.5 sketchScale) — a partition splits off a
  // "Sala" whose own polygon, traced along the wall's inner face, only
  // covers the first ~4m of that run. The Elevação must clip to that
  // sub-span (and everything past it, like a door on the far side of the
  // partition), not the wall's full 10m length.
  const level = { sketchScale: "0.5" };
  const wall = { x1: 0, y1: 0, x2: 400, y2: 0, wallType: "Alvenaria 15cm" };

  it("clips to the room polygon's own span along the wall's face, not the wall's full length", () => {
    level.sketchElements = [{
      type: "room", name: "Sala",
      points: [{ x: 3, y: 3 }, { x: 157, y: 3 }, { x: 157, y: 297 }, { x: 3, y: 297 }],
    }];
    const span = wallSpanForRoom(level, wall, "Sala");
    expect(span.startPx).toBeCloseTo(3, 0);
    expect(span.endPx).toBeCloseTo(157, 0);
    expect(span.endPx).toBeLessThan(400); // never the wall's own full length
  });

  it("returns null when no room polygon matches this wall (e.g. the exterior side), instead of a fake full-length span", () => {
    level.sketchElements = [{ type: "room", name: "Outra sala", points: [{ x: 200, y: 3 }, { x: 397, y: 3 }, { x: 397, y: 297 }, { x: 200, y: 297 }] }];
    const span = wallSpanForRoom(level, wall, "Sala");
    expect(span).toBeNull();
  });

  it("returns null when the named room itself doesn't exist", () => {
    level.sketchElements = [];
    expect(wallSpanForRoom(level, wall, "Sala")).toBeNull();
  });

  it("ignores a lone far-away vertex that happens to sit within tolerance of the wall's line, when no actual room EDGE runs along it there", () => {
    // An L-shaped room whose real boundary along this wall only spans
    // 3..200px — but a "finger" elsewhere in its own outline pokes a
    // single vertex back up near the wall's line (x=350) without either
    // of ITS OWN two edges actually running alongside the wall. The old
    // per-vertex check picked up that lone coincidental vertex and
    // stretched the span out to it; requiring a full edge (both endpoints
    // within tolerance) correctly leaves it out.
    const wideWall = { x1: 0, y1: 0, x2: 600, y2: 0, wallType: "Alvenaria 15cm" };
    const lShapedLevel = {
      sketchScale: "0.5",
      sketchElements: [{
        type: "room", name: "Sala",
        points: [
          { x: 3, y: 3 }, { x: 200, y: 3 }, { x: 200, y: 150 },
          { x: 350, y: 150 }, { x: 350, y: 8 }, { x: 300, y: 150 }, { x: 3, y: 150 },
        ],
      }],
    };
    const span = wallSpanForRoom(lShapedLevel, wideWall, "Sala");
    expect(span.startPx).toBeCloseTo(3, 0);
    expect(span.endPx).toBeCloseTo(200, 0);
    expect(span.endPx).toBeLessThan(300); // never stretched out to the stray finger vertex at 350
  });

  it("ignores a short, disconnected wall elsewhere on the sheet that's merely collinear within tolerance — not this room's own bounding wall", () => {
    // "Sala" is bounded by a wall from x=0..300 (y=0). A completely
    // separate, unrelated wall sits on that exact same line but far off to
    // the side (x=500..600) — same perpendicular offset (0, well within
    // tolerance), but its own [0,len] physical span never actually
    // overlaps the room edge's projected range at all. It must read as
    // "doesn't border this room", not get pulled in as a bogus
    // near-zero-length span just because it's on the same infinite line.
    const level = {
      sketchScale: "0.5",
      sketchElements: [{
        type: "room", name: "Sala",
        points: [{ x: 3, y: 3 }, { x: 297, y: 3 }, { x: 297, y: 150 }, { x: 3, y: 150 }],
      }],
    };
    const strayWall = { x1: 500, y1: 0, x2: 600, y2: 0, wallType: "Alvenaria 15cm" };
    expect(wallSpanForRoom(level, strayWall, "Sala")).toBeNull();
  });
});

describe("wallsForRoom", () => {
  it("only includes walls whose face actually borders the room, even when another wall spans a T-junction into a different room", () => {
    // Two rooms side by side, sharing a partition. The TOP wall (0..400px)
    // runs the full width but only "Sala" (the left room) traces its face
    // along the first half — "Cozinha" borders a different sub-span.
    const level = {
      sketchScale: "0.5",
      sketchElements: [
        { id: "top", type: "wall", x1: 0, y1: 0, x2: 400, y2: 0, wallType: "Alvenaria 15cm" },
        { id: "left", type: "wall", x1: 0, y1: 0, x2: 0, y2: 300, wallType: "Alvenaria 15cm" },
        { id: "partition", type: "wall", x1: 200, y1: 0, x2: 200, y2: 300, wallType: "Alvenaria 15cm" },
        { id: "right", type: "wall", x1: 400, y1: 0, x2: 400, y2: 300, wallType: "Alvenaria 15cm" },
        { type: "room", name: "Sala", points: [{ x: 3, y: 3 }, { x: 197, y: 3 }, { x: 197, y: 297 }, { x: 3, y: 297 }] },
        { type: "room", name: "Cozinha", points: [{ x: 203, y: 3 }, { x: 397, y: 3 }, { x: 397, y: 297 }, { x: 203, y: 297 }] },
      ],
    };
    const salaWalls = wallsForRoom(level, "Sala").map(w => w.id).sort();
    expect(salaWalls).toEqual(["left", "partition", "top"]);
    const cozinhaWalls = wallsForRoom(level, "Cozinha").map(w => w.id).sort();
    expect(cozinhaWalls).toEqual(["partition", "right", "top"]);
  });
});

describe("isWallExterior", () => {
  // Same T-junction layout as wallsForRoom above: "top"/"left"/"right" all
  // have open air on their far side somewhere along their length (the
  // building's real perimeter); "partition" has a room on BOTH faces
  // along its whole run, so it's a pure interior wall.
  const level = {
    sketchScale: "0.5",
    sketchElements: [
      { id: "top", type: "wall", x1: 0, y1: 0, x2: 400, y2: 0, wallType: "Alvenaria 15cm" },
      { id: "left", type: "wall", x1: 0, y1: 0, x2: 0, y2: 300, wallType: "Alvenaria 15cm" },
      { id: "partition", type: "wall", x1: 200, y1: 0, x2: 200, y2: 300, wallType: "Alvenaria 15cm" },
      { id: "right", type: "wall", x1: 400, y1: 0, x2: 400, y2: 300, wallType: "Alvenaria 15cm" },
      { type: "room", name: "Sala", points: [{ x: 3, y: 3 }, { x: 197, y: 3 }, { x: 197, y: 297 }, { x: 3, y: 297 }] },
      { type: "room", name: "Cozinha", points: [{ x: 203, y: 3 }, { x: 397, y: 3 }, { x: 397, y: 297 }, { x: 203, y: 297 }] },
    ],
  };
  it("treats the T-junction wall shared end-to-end by two rooms as exterior", () => {
    const top = level.sketchElements.find(w => w.id === "top");
    expect(isWallExterior(level, top)).toBe(true);
  });
  it("treats single-room perimeter walls as exterior", () => {
    expect(isWallExterior(level, level.sketchElements.find(w => w.id === "left"))).toBe(true);
    expect(isWallExterior(level, level.sketchElements.find(w => w.id === "right"))).toBe(true);
  });
  it("treats a true partition (a room on each face along the whole run) as interior, not exterior", () => {
    const partition = level.sketchElements.find(w => w.id === "partition");
    expect(isWallExterior(level, partition)).toBe(false);
  });
  it("treats every wall as exterior when the level has no rooms traced yet", () => {
    const bareLevel = { sketchScale: "0.5", sketchElements: [{ id: "w1", type: "wall", x1: 0, y1: 0, x2: 400, y2: 0, wallType: "Alvenaria 15cm" }] };
    expect(isWallExterior(bareLevel, bareLevel.sketchElements[0])).toBe(true);
  });
});

describe("buildingElevationStack", () => {
  it("stacks the same wall footprint across pavimentos, sorted bottom-to-top, even with different sketchScale per level", () => {
    const terreo = { id: "L1", elevation: 0, sketchScale: "0.5", sketchElements: [{ id: "w-terreo", type: "wall", x1: 0, y1: 0, x2: 400, y2: 0 }] };
    const superior = { id: "L2", elevation: 2.8, sketchScale: "0.25", sketchElements: [{ id: "w-superior", type: "wall", x1: 0, y1: 0, x2: 800, y2: 0 }] };
    const levels = [superior, terreo]; // deliberately out of elevation order
    const stack = buildingElevationStack(levels, terreo, terreo.sketchElements[0]);
    expect(stack.map(s => s.level.id)).toEqual(["L1", "L2"]);
    expect(stack.map(s => s.wall.id)).toEqual(["w-terreo", "w-superior"]);
  });
  it("falls back to just the wall's own level when no other pavimento shares its footprint", () => {
    const onlyLevel = { id: "L1", elevation: 0, sketchScale: "0.5", sketchElements: [{ id: "w1", type: "wall", x1: 0, y1: 0, x2: 400, y2: 0 }] };
    const stack = buildingElevationStack([onlyLevel], onlyLevel, onlyLevel.sketchElements[0]);
    expect(stack).toEqual([{ level: onlyLevel, wall: onlyLevel.sketchElements[0] }]);
  });
});

describe("levelToMetersForRoom", () => {
  // Same T-junction layout used above: the "top" wall runs past the
  // partition into a completely different room. Before the 3D "Ambiente"
  // view clipped a member wall's own endpoints to its span for the room
  // actually being viewed, this always came back with the wall's FULL
  // corner-to-corner run (and any door/window sitting anywhere on it,
  // including ones that actually open into the OTHER room) — exactly the
  // "pegando a parede toda" bug reported for the isolated 3D ambiente view.
  const level = {
    sketchScale: "0.5",
    elevation: 0,
    sketchElements: [
      { id: "top", type: "wall", x1: 0, y1: 0, x2: 400, y2: 0, wallType: "Alvenaria 15cm" },
      { id: "left", type: "wall", x1: 0, y1: 0, x2: 0, y2: 300, wallType: "Alvenaria 15cm" },
      { id: "partition", type: "wall", x1: 200, y1: 0, x2: 200, y2: 300, wallType: "Alvenaria 15cm" },
      { id: "right", type: "wall", x1: 400, y1: 0, x2: 400, y2: 300, wallType: "Alvenaria 15cm" },
      { id: "door-sala", type: "door", wallId: "top", x: 100, y: 0, width: 0.8 },
      { id: "door-cozinha", type: "door", wallId: "top", x: 300, y: 0, width: 0.8 },
      { type: "room", roomId: "r-sala", name: "Sala", points: [{ x: 3, y: 3 }, { x: 197, y: 3 }, { x: 197, y: 297 }, { x: 3, y: 297 }] },
      { type: "room", roomId: "r-cozinha", name: "Cozinha", points: [{ x: 203, y: 3 }, { x: 397, y: 3 }, { x: 397, y: 297 }, { x: 203, y: 297 }] },
    ],
  };
  it("clips the shared T-junction wall to just this room's own span (not its full corner-to-corner run)", () => {
    const sala = levelToMetersForRoom(level, { id: "r-sala", name: "Sala" });
    const topInSala = sala.walls.find(w => w.id === "top");
    expect(topInSala.x1).toBeCloseTo(0.075, 2);
    expect(topInSala.x2).toBeCloseTo(4.925, 2);
    expect(topInSala.x2).toBeLessThan(10); // never the wall's own full 10m length

    const cozinha = levelToMetersForRoom(level, { id: "r-cozinha", name: "Cozinha" });
    const topInCozinha = cozinha.walls.find(w => w.id === "top");
    expect(topInCozinha.x1).toBeCloseTo(5.075, 2);
    expect(topInCozinha.x2).toBeCloseTo(9.925, 2);
  });
  it("only includes a door/window that actually falls within this room's own clipped span", () => {
    const sala = levelToMetersForRoom(level, { id: "r-sala", name: "Sala" });
    expect(sala.doors.map(d => d.id)).toEqual(["door-sala"]);

    const cozinha = levelToMetersForRoom(level, { id: "r-cozinha", name: "Cozinha" });
    expect(cozinha.doors.map(d => d.id)).toEqual(["door-cozinha"]);
  });
});

describe("composeAddress", () => {
  it("joins the pieces it has and skips the ones it doesn't", () => {
    expect(composeAddress({ street: "Rua A", number: "10", neighborhood: "Centro", city: "Atlanta", state: "GA" }))
      .toBe("Rua A, 10 — Centro, Atlanta, GA");
  });

  it("handles a partially-filled address", () => {
    expect(composeAddress({ city: "Atlanta" })).toBe("Atlanta");
  });

  it("returns an empty string for no address at all", () => {
    expect(composeAddress(null)).toBe("");
    expect(composeAddress({})).toBe("");
  });
});

// toM here mimics levelToMeters's own px->m conversion (GRID=20, scale=0.5)
// so tests can check the conversion math without duplicating its internals.
const toM = (px) => (px / 20) * 0.5;

describe("wallToM / doorToM / windowToM", () => {
  it("converts a wall's pixel coordinates to meters and keeps its reforma flags", () => {
    const w = wallToM({ id: "w1", x1: 0, y1: 0, x2: 100, y2: 0, wallType: "Concreto", demolir: true }, toM);
    expect(w.x2).toBeCloseTo(2.5, 6); // 100px / 20 * 0.5
    expect(w.wallType).toBe("Concreto");
    expect(w.demolir).toBe(true);
    expect(w.construir).toBe(false);
  });

  it("applies sensible defaults for a bare-minimum wall", () => {
    const w = wallToM({ id: "w1", x1: 0, y1: 0, x2: 0, y2: 0 }, toM);
    expect(w.height).toBe(2.8);
    expect(w.condition).toBe("A confirmar");
    expect(w.finishA).toBe("A definir");
  });

  it("converts a door's position and coerces numeric fields", () => {
    const d = doorToM({ id: "d1", x: 40, y: 0, width: "0,90", panels: "1" }, toM);
    expect(d.x).toBeCloseTo(1, 6);
    expect(d.width).toBeCloseTo(0.9, 6);
    expect(d.panels).toBe(1);
  });

  it("converts a window and rounds panels to the nearest integer", () => {
    const win = windowToM({ id: "j1", x: 0, y: 0, panels: 1.6 }, toM);
    expect(win.panels).toBe(2);
  });
});

describe("levelToMeters", () => {
  it("buckets sketch elements by type and converts each to meters", () => {
    const level = {
      elevation: "3.10",
      sketchScale: 0.5,
      sketchElements: [
        { type: "wall", id: "w1", x1: 0, y1: 0, x2: 100, y2: 0 },
        { type: "door", id: "d1", wallId: "w1", x: 40, y: 0 },
      ],
    };
    const m = levelToMeters(level);
    expect(m.elevation).toBe(3.1);
    expect(m.walls).toHaveLength(1);
    expect(m.doors).toHaveLength(1);
    expect(m.windows).toHaveLength(0);
  });
});

describe("buildLevantamentoSchema", () => {
  it("produces a schema_version 1 payload with the given levels/rooms nested inside", () => {
    const level = {
      id: "lvl1",
      name: "Térreo",
      elevation: "0.00",
      wallHeightDefault: "2.80",
      sketchScale: 0.5,
      sketchElements: [{ type: "wall", id: "w1", x1: 0, y1: 0, x2: 100, y2: 0, demolir: true }],
    };
    const schema = buildLevantamentoSchema({
      code: "7K2P",
      buildingInfo: { name: "Casa Teste" },
      rooms: [{ id: "r1", name: "Sala", level: "Térreo", area: 12.5 }],
      levels: [level],
      roofs: [],
    });

    expect(schema.schema_version).toBe(1);
    expect(schema.projeto.codigo).toBe("7K2P");
    expect(schema.projeto.nome).toBe("Casa Teste");
    expect(schema.niveis).toHaveLength(1);
    expect(schema.niveis[0].paredes).toHaveLength(1);
    expect(schema.niveis[0].paredes[0].demolir).toBe(true);
    expect(schema.ambientes).toHaveLength(1);
    expect(schema.ambientes[0].area_m2).toBe(12.5);
  });

  it("tolerates missing optional collections", () => {
    const schema = buildLevantamentoSchema({ code: "X", buildingInfo: null, rooms: null, levels: null, roofs: null });
    expect(schema.niveis).toEqual([]);
    expect(schema.ambientes).toEqual([]);
    expect(schema.coberturas).toEqual([]);
  });
});
