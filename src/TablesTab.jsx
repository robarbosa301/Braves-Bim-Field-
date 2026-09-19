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
import { toNum } from "./utils.js";
import { WALL_TYPES, DOOR_TYPES, WINDOW_TYPES, FLOOR_TYPES, CEILING_TYPES, wallThicknessM } from "./constants.js";
import { NumField, TypeSelect, ConditionSelect, PhaseToggles } from "./ElementRows.jsx";

const SUBS = [
  { id: "paredes", label: "Paredes" },
  { id: "portas", label: "Portas" },
  { id: "janelas", label: "Janelas" },
  { id: "ambientes", label: "Ambientes" },
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

export default function TablesTab({ levels, rooms, updateLevelElement, removeLevelElement, resizeWallLength, nameRoomPolygon }) {
  const [sub, setSub] = useState("paredes");

  const rowsOf = (type) => {
    const out = [];
    levels.forEach(l => (l.sketchElements || []).forEach(e => { if (e.type === type) out.push({ ...e, levelId: l.id, levelName: l.name }); }));
    return out;
  };
  const walls = sub === "paredes" ? rowsOf("wall") : null;
  const doors = sub === "portas" ? rowsOf("door") : null;
  const windows = sub === "janelas" ? rowsOf("window") : null;

  // Each room's editable bits (name, area, floor/ceiling finish) actually
  // live on its polygon in sketchElements, not on the rooms[] entry itself
  // (that array just mirrors name/area for the Ambientes tab's own use) —
  // so every edit here needs the polygon's own element+level id, found by
  // matching roomId back to whichever polygon points at it.
  const roomPolyByRoomId = {};
  if (sub === "ambientes") {
    levels.forEach(l => (l.sketchElements || []).forEach(e => {
      if (e.type === "room" && e.roomId) roomPolyByRoomId[e.roomId] = { ...e, levelId: l.id };
    }));
  }

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

      {sub === "paredes" && (
        <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${C.line}` }}>
          <table className="w-full border-collapse">
            <thead><tr>
              <Th>Nível</Th><Th>Tag</Th><Th>Tipo</Th><Th>Esp. (cm)</Th><Th>Compr. (m)</Th><Th>Alt. (m)</Th><Th>Condição</Th><Th>Fase</Th><Th></Th>
            </tr></thead>
            <tbody>
              {walls.length === 0 && <EmptyRow span={9} msg="Nenhuma parede lançada ainda." />}
              {walls.map(w => (
                <tr key={w.id}>
                  <Td>{w.levelName}</Td>
                  <Td><span style={{ ...mono, color: C.gold }}>{w.tag}</span></Td>
                  <Td><TypeSelect value={w.wallType || WALL_TYPES[0]} options={WALL_TYPES} onChange={v => updateLevelElement(w.levelId, w.id, { wallType: v, wallThickness: undefined })} /></Td>
                  <Td><NumField value={Math.round(wallThicknessM(w) * 100)} onCommit={v => updateLevelElement(w.levelId, w.id, { wallThickness: Math.max(1, toNum(v, 15)) / 100 })} w="w-10" /></Td>
                  <Td><NumField value={w.length} onCommit={v => resizeWallLength(w.levelId, w.id, v)} w="w-12" /></Td>
                  <Td><NumField value={w.height} onCommit={v => updateLevelElement(w.levelId, w.id, { height: v })} w="w-12" /></Td>
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
              {rooms.length === 0 && <EmptyRow span={5} msg="Nenhum ambiente nomeado ainda." />}
              {rooms.map(r => {
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
    </div>
  );
}
