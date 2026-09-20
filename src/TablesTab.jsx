// Spreadsheet-style schedules (paredes/portas/janelas/ambientes) — every
// cell edits the exact same state the Croqui (2D) and 3D view already read
// from, through the exact same update functions App.jsx hands VectorSketch
// and the Elementos tab, so a change here shows up in both without any
// separate sync step. Wall length is the one exception: it's derived from
// two endpoints, not a stored scalar, so editing it goes through
// resizeWallLength (App.jsx) instead of a plain field patch.
import { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { C, mono, heading } from "./theme.js";
import { toNum, wallNetAreaM2 } from "./utils.js";
import { WALL_TYPES, DOOR_TYPES, WINDOW_TYPES, FLOOR_TYPES, CEILING_TYPES, wallThicknessM } from "./constants.js";
import { NumField, TypeSelect, ConditionSelect, PhaseToggles } from "./ElementRows.jsx";

const SUBS = [
  { id: "resumo", label: "Resumo" },
  { id: "paredes", label: "Paredes" },
  { id: "portas", label: "Portas" },
  { id: "janelas", label: "Janelas" },
  { id: "ambientes", label: "Ambientes" },
  { id: "pisos", label: "Pisos" },
];

function Th({ children, className = "" }) {
  return (
    <th className={`text-left px-2 py-1.5 text-[10px] font-semibold whitespace-nowrap ${className}`}
      style={{ ...heading, color: C.mute, background: C.panel, borderBottom: `1px solid ${C.line}` }}>
      {children}
    </th>
  );
}
function Td({ children, className = "" }) {
  return (
    <td className={`px-2 py-1.5 text-[11px] align-middle whitespace-nowrap ${className}`} style={{ borderBottom: `1px solid ${C.line}`, color: C.chalk }}>
      {children}
    </td>
  );
}
function EmptyRow({ span, msg }) {
  return <tr><td colSpan={span} className="px-2 py-6 text-center text-[11px]" style={{ color: C.mute }}>{msg}</td></tr>;
}
// Same draft-until-blur/Enter pattern as ElementRows' NumField, but a plain
// text field (no inputMode="decimal", which on mobile pops the numeric
// keypad — wrong for a room name).
function NameField({ value, onCommit, w = "w-28" }) {
  const [draft, setDraft] = useState(null);
  useEffect(() => { setDraft(null); }, [value]);
  const display = draft !== null ? draft : value;
  return (
    <input type="text" value={display}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { if (draft !== null) onCommit(draft); setDraft(null); }}
      onKeyDown={e => { if (e.key === "Enter") { onCommit(draft ?? display); e.target.blur(); } }}
      className={`${w} px-1.5 py-1 rounded text-[11px]`} style={{ background: "rgba(255,255,255,0.06)", color: C.chalk, border: `1px solid ${C.line}` }} />
  );
}

// Groups items by a field (or by levelName), summing valueFn(item) and
// counting entries per group — shared by every "Por X" breakdown in the
// Resumo tab so paredes/pisos/ambientes/portas/janelas all read the same
// way instead of each rolling its own reduce.
function groupBy(items, keyFn, valueFn) {
  const map = {};
  items.forEach(it => {
    const k = keyFn(it) || "A definir";
    if (!map[k]) map[k] = { key: k, count: 0, value: 0 };
    map[k].count += 1;
    map[k].value += valueFn(it);
  });
  return Object.values(map).sort((a, b) => b.value - a.value);
}
function SummaryBlock({ title, unit, items, valueFn, groupField, groupLabel, valueFn2, unit2 }) {
  const total = items.reduce((s, it) => s + valueFn(it), 0);
  const byLevel = groupBy(items, it => it.levelName, valueFn);
  const byGroup = groupBy(items, it => it[groupField], valueFn);
  // A second metric (volume alongside área, so far only paredes) piggybacks
  // on the exact same per-level/per-tipo grouping instead of a parallel
  // block, keeping the two figures for the same row next to each other.
  const total2 = valueFn2 ? items.reduce((s, it) => s + valueFn2(it), 0) : null;
  const byLevel2 = valueFn2 ? groupBy(items, it => it.levelName, valueFn2) : null;
  const byGroup2 = valueFn2 ? groupBy(items, it => it[groupField], valueFn2) : null;
  const val2For = (map2, key) => map2?.find(g => g.key === key)?.value ?? 0;
  return (
    <div className="p-3 rounded-lg mb-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: C.chalk }}>{title}</span>
        <span className="text-sm font-semibold" style={{ ...mono, color: C.gold }}>
          {total.toFixed(1)} {unit}{valueFn2 && <span style={{ color: C.mute }}> · {total2.toFixed(2)} {unit2}</span>}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="text-[11px] italic" style={{ color: C.mute }}>Nada lançado ainda.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] mb-1" style={{ ...heading, color: C.mute }}>Por nível</div>
            <div className="space-y-1">
              {byLevel.map(g => (
                <div key={g.key} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate" style={{ color: C.chalk }}>{g.key}</span>
                  <span className="shrink-0" style={{ ...mono, color: C.mute }}>
                    {g.value.toFixed(1)} {unit}{valueFn2 && ` · ${val2For(byLevel2, g.key).toFixed(2)} ${unit2}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[10px] mb-1" style={{ ...heading, color: C.mute }}>Por {groupLabel}</div>
            <div className="space-y-1">
              {byGroup.map(g => (
                <div key={g.key} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate" style={{ color: C.chalk }}>{g.key}</span>
                  <span className="shrink-0" style={{ ...mono, color: C.mute }}>
                    {g.count}× · {g.value.toFixed(1)} {unit}{valueFn2 && ` · ${val2For(byGroup2, g.key).toFixed(2)} ${unit2}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TablesTab({ levels, rooms, updateLevelElement, removeLevelElement, resizeWallLength, nameRoomPolygon }) {
  const [sub, setSub] = useState("resumo");
  // Finds a row by tag (P1, J5…) or ambiente name — a flat table with no
  // per-level grouping like Resumo's own breakdown is otherwise a long
  // scroll on a project with many paredes/portas/janelas.
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const matchesTag = (el) => !q || (el.tag || "").toLowerCase().includes(q);

  const rowsOf = (type) => {
    const out = [];
    levels.forEach(l => (l.sketchElements || []).forEach(e => { if (e.type === type) out.push({ ...e, levelId: l.id, levelName: l.name }); }));
    return out;
  };
  // A door/window's own área comes back out of its wall's gross length×
  // height — same net figure the 3D view's own selected-wall panel shows,
  // so a door isn't counted once under "Portas" and again inside its
  // wall's full, un-punched área/volume here.
  const openingsByWall = {};
  levels.forEach(l => (l.sketchElements || []).forEach(e => {
    if (e.type === "door" || e.type === "window") {
      const k = l.id + ":" + e.wallId;
      (openingsByWall[k] || (openingsByWall[k] = [])).push(e);
    }
  }));
  const wallNetArea = w => wallNetAreaM2(w.length, toNum(w.height, 2.8), openingsByWall[w.levelId + ":" + w.id]);
  const wallNetVolume = w => wallNetArea(w) * wallThicknessM(w);
  const walls = sub === "paredes" ? rowsOf("wall").filter(matchesTag) : null;
  const doors = sub === "portas" ? rowsOf("door").filter(matchesTag) : null;
  const windows = sub === "janelas" ? rowsOf("window").filter(matchesTag) : null;
  const floors = sub === "pisos" ? rowsOf("floor").filter(el => !q || (el.floorType || "").toLowerCase().includes(q)) : null;

  // Each room's editable bits (name, area, floor/ceiling finish) actually
  // live on its polygon in sketchElements, not on the rooms[] entry itself
  // (that array just mirrors name/area for the Ambientes tab's own use) —
  // so every edit here needs the polygon's own element+level id, found by
  // matching roomId back to whichever polygon points at it. The Resumo
  // tab's own "Ambientes" block needs the same lookup, just read-only, to
  // pull each room's real area/acabamento instead of the rooms[] mirror.
  const roomPolyByRoomId = {};
  if (sub === "ambientes" || sub === "resumo") {
    levels.forEach(l => (l.sketchElements || []).forEach(e => {
      if (e.type === "room" && e.roomId) roomPolyByRoomId[e.roomId] = { ...e, levelId: l.id };
    }));
  }
  const filteredRooms = sub === "ambientes" ? rooms.filter(r => !q || (r.name || "").toLowerCase().includes(q)) : null;
  const roomSummaryItems = sub === "resumo"
    ? rooms.map(r => {
        const poly = roomPolyByRoomId[r.id];
        return { levelName: r.level, area: toNum(poly?.area ?? r.area, 0), floorFinish: poly?.floorFinish || "A definir" };
      })
    : null;

  return (
    <div>
      <div className="flex gap-1.5 mb-3 flex-wrap">
        {SUBS.map(s => (
          <button key={s.id} onClick={() => setSub(s.id)} className="px-2.5 py-1.5 rounded text-xs"
            style={{ ...heading, fontWeight: 600, background: sub === s.id ? C.goldTint : C.panelAlt, color: sub === s.id ? C.gold : C.mute, border: `1px solid ${sub === s.id ? "#FFFFFF" : C.line}` }}>
            {s.label}
          </button>
        ))}
      </div>

      {sub !== "resumo" && (
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={sub === "ambientes" ? "Buscar por nome do ambiente…" : sub === "pisos" ? "Buscar por material…" : "Buscar por tag (P1, J5…)"}
          className="w-full px-2.5 py-1.5 rounded text-xs mb-2"
          style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
      )}

      {sub === "resumo" && (
        <div>
          <SummaryBlock title="Paredes" unit="m²" items={rowsOf("wall")}
            valueFn={wallNetArea} valueFn2={wallNetVolume} unit2="m³" groupField="wallType" groupLabel="tipo" />
          <SummaryBlock title="Pisos" unit="m²" items={rowsOf("floor")}
            valueFn={f => toNum(f.area, 0)} groupField="floorType" groupLabel="material" />
          <SummaryBlock title="Ambientes" unit="m²" items={roomSummaryItems}
            valueFn={r => r.area} groupField="floorFinish" groupLabel="acabamento de piso" />
          <SummaryBlock title="Portas" unit="m²" items={rowsOf("door")}
            valueFn={d => toNum(d.width, 0) * toNum(d.height, 0)} groupField="doorType" groupLabel="família" />
          <SummaryBlock title="Janelas" unit="m²" items={rowsOf("window")}
            valueFn={w => toNum(w.width, 0) * toNum(w.height, 0)} groupField="windowType" groupLabel="família" />
        </div>
      )}

      {sub === "paredes" && (
        <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${C.line}` }}>
          <table className="w-full border-collapse">
            <thead><tr>
              <Th>Nível</Th><Th>Tag</Th><Th>Tipo</Th><Th>Esp. (cm)</Th><Th>Compr. (m)</Th><Th>Alt. (m)</Th><Th>Área líq. (m²)</Th><Th>Vol. líq. (m³)</Th><Th>Condição</Th><Th>Fase</Th><Th></Th>
            </tr></thead>
            <tbody>
              {walls.length === 0 && <EmptyRow span={11} msg="Nenhuma parede lançada ainda." />}
              {walls.map(w => (
                <tr key={w.id}>
                  <Td>{w.levelName}</Td>
                  <Td><span style={{ ...mono, color: C.gold }}>{w.tag}</span></Td>
                  <Td><TypeSelect value={w.wallType || WALL_TYPES[0]} options={WALL_TYPES} onChange={v => updateLevelElement(w.levelId, w.id, { wallType: v, wallThickness: undefined })} /></Td>
                  <Td><NumField value={Math.round(wallThicknessM(w) * 100)} onCommit={v => updateLevelElement(w.levelId, w.id, { wallThickness: Math.max(1, toNum(v, 15)) / 100 })} w="w-10" /></Td>
                  <Td><NumField value={w.length} onCommit={v => resizeWallLength(w.levelId, w.id, v)} w="w-12" /></Td>
                  <Td><NumField value={w.height} onCommit={v => updateLevelElement(w.levelId, w.id, { height: v })} w="w-12" /></Td>
                  <Td><span style={{ ...mono, color: C.mute }}>{wallNetArea(w).toFixed(2)}</span></Td>
                  <Td><span style={{ ...mono, color: C.mute }}>{wallNetVolume(w).toFixed(3)}</span></Td>
                  <Td><ConditionSelect value={w.condition} onChange={v => updateLevelElement(w.levelId, w.id, { condition: v })} /></Td>
                  <Td><div className="flex items-center gap-1"><PhaseToggles demolir={w.demolir} construir={w.construir} onChange={p => updateLevelElement(w.levelId, w.id, p)} /></div></Td>
                  <Td><button onClick={() => removeLevelElement(w.levelId, w.id)}><Trash2 size={12} color={C.mute} /></button></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sub === "portas" && (
        <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${C.line}` }}>
          <table className="w-full border-collapse">
            <thead><tr>
              <Th>Nível</Th><Th>Tag</Th><Th>Família</Th><Th>Larg. (m)</Th><Th>Alt. (m)</Th><Th>Folhas</Th><Th>Condição</Th><Th></Th>
            </tr></thead>
            <tbody>
              {doors.length === 0 && <EmptyRow span={8} msg="Nenhuma porta lançada ainda." />}
              {doors.map(d => (
                <tr key={d.id}>
                  <Td>{d.levelName}</Td>
                  <Td><span style={{ ...mono, color: C.gold }}>{d.tag}</span></Td>
                  <Td><TypeSelect value={d.doorType || DOOR_TYPES[0]} options={DOOR_TYPES} onChange={v => updateLevelElement(d.levelId, d.id, { doorType: v })} /></Td>
                  <Td><NumField value={d.width} onCommit={v => updateLevelElement(d.levelId, d.id, { width: v })} w="w-12" /></Td>
                  <Td><NumField value={d.height} onCommit={v => updateLevelElement(d.levelId, d.id, { height: v })} w="w-12" /></Td>
                  <Td><NumField value={d.panels || 1} onCommit={v => updateLevelElement(d.levelId, d.id, { panels: v })} w="w-8" /></Td>
                  <Td><ConditionSelect value={d.condition} onChange={v => updateLevelElement(d.levelId, d.id, { condition: v })} /></Td>
                  <Td><button onClick={() => removeLevelElement(d.levelId, d.id)}><Trash2 size={12} color={C.mute} /></button></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sub === "janelas" && (
        <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${C.line}` }}>
          <table className="w-full border-collapse">
            <thead><tr>
              <Th>Nível</Th><Th>Tag</Th><Th>Família</Th><Th>Larg. (m)</Th><Th>Alt. (m)</Th><Th>Peitoril (m)</Th><Th>Folhas</Th><Th>Condição</Th><Th></Th>
            </tr></thead>
            <tbody>
              {windows.length === 0 && <EmptyRow span={9} msg="Nenhuma janela lançada ainda." />}
              {windows.map(w => (
                <tr key={w.id}>
                  <Td>{w.levelName}</Td>
                  <Td><span style={{ ...mono, color: C.gold }}>{w.tag}</span></Td>
                  <Td><TypeSelect value={w.windowType || WINDOW_TYPES[0]} options={WINDOW_TYPES} onChange={v => updateLevelElement(w.levelId, w.id, { windowType: v })} /></Td>
                  <Td><NumField value={w.width} onCommit={v => updateLevelElement(w.levelId, w.id, { width: v })} w="w-12" /></Td>
                  <Td><NumField value={w.height} onCommit={v => updateLevelElement(w.levelId, w.id, { height: v })} w="w-12" /></Td>
                  <Td><NumField value={w.peitoril} onCommit={v => updateLevelElement(w.levelId, w.id, { peitoril: v })} w="w-12" /></Td>
                  <Td><NumField value={w.panels || 2} onCommit={v => updateLevelElement(w.levelId, w.id, { panels: v })} w="w-8" /></Td>
                  <Td><ConditionSelect value={w.condition} onChange={v => updateLevelElement(w.levelId, w.id, { condition: v })} /></Td>
                  <Td><button onClick={() => removeLevelElement(w.levelId, w.id)}><Trash2 size={12} color={C.mute} /></button></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sub === "ambientes" && (
        <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${C.line}` }}>
          <table className="w-full border-collapse">
            <thead><tr>
              <Th>Nível</Th><Th>Nome</Th><Th>Área (m²)</Th><Th>Piso</Th><Th>Forro</Th>
            </tr></thead>
            <tbody>
              {filteredRooms.length === 0 && <EmptyRow span={5} msg="Nenhum ambiente nomeado ainda." />}
              {filteredRooms.map(r => {
                const poly = roomPolyByRoomId[r.id];
                return (
                  <tr key={r.id}>
                    <Td>{r.level}</Td>
                    <Td>
                      {poly ? (
                        <NameField value={r.name} onCommit={v => nameRoomPolygon(poly.levelId, poly.id, v.trim())} />
                      ) : <span style={{ color: C.mute }}>{r.name}</span>}
                    </Td>
                    <Td>{toNum(poly?.area ?? r.area, 0).toFixed(1)}</Td>
                    <Td>{poly ? <TypeSelect value={poly.floorFinish || "A definir"} options={FLOOR_TYPES} onChange={v => updateLevelElement(poly.levelId, poly.id, { floorFinish: v })} /> : "—"}</Td>
                    <Td>{poly ? <TypeSelect value={poly.ceilingFinish || "A definir"} options={CEILING_TYPES} onChange={v => updateLevelElement(poly.levelId, poly.id, { ceilingFinish: v })} /> : "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sub === "pisos" && (
        <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${C.line}` }}>
          <table className="w-full border-collapse">
            <thead><tr>
              <Th>Nível</Th><Th>Material</Th><Th>Área (m²)</Th><Th>Cor</Th><Th></Th>
            </tr></thead>
            <tbody>
              {floors.length === 0 && <EmptyRow span={5} msg="Nenhum piso lançado ainda." />}
              {floors.map(f => (
                <tr key={f.id}>
                  <Td>{f.levelName}</Td>
                  <Td><TypeSelect value={f.floorType || FLOOR_TYPES[0]} options={FLOOR_TYPES} onChange={v => updateLevelElement(f.levelId, f.id, { floorType: v })} /></Td>
                  <Td>{toNum(f.area, 0).toFixed(1)}</Td>
                  <Td><input type="color" value={f.floorColor || "#B08A5C"} onChange={e => updateLevelElement(f.levelId, f.id, { floorColor: e.target.value })}
                    className="w-6 h-6 rounded" style={{ border: `1px solid ${C.line}`, background: "transparent" }} /></Td>
                  <Td><button onClick={() => removeLevelElement(f.levelId, f.id)}><Trash2 size={12} color={C.mute} /></button></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
