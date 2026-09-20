// A 2D side-on cut of a single wall — length along the bottom, height up
// the side, doors/windows drawn at their real floor-to-sill/floor-to-top
// position, dimensioned the same way the plan already is. Reuses the
// per-level dimension/tag colors and font sizes set in VectorSketch's own
// "Cores e tamanhos de texto" panel, so an elevation reads as the same
// drawing as the floor plan it comes from, not a separate style.
import { useRef, useState } from "react";
import { C } from "./theme.js";
import { toNum } from "./utils.js";
import { GRID } from "./geometry.js";
import { fontFamilyCss } from "./constants.js";

const PX_PER_M = 70;
// Only the gap-dimension row sits above the wall now — the opening tag
// moved down to just above each door/window itself (see TAG_LINE_GAP
// below), so this only needs to clear that one row.
const MARGIN_TOP = 26;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 20;
const MARGIN_BOTTOM = 40;
const GAP_DIM_ROW_Y = -10;
// Vertical spacing for the two-line opening tag (name, then dimensions)
// stacked just above the door/window's own top edge.
const TAG_LINE_GAP = 10;

// onPatchOpening(openingId, patch) and onPatchDimStyle(key, patch) are how a
// drag here gets persisted — both optional, so a caller that hasn't wired
// them up yet (or a read-only context) just renders the same static view
// this always was, with no drag handles shown. onDragBegin() (also optional)
// fires once per gesture, right as it starts — the caller's hook for
// pushing an undo snapshot before the drag's own patches start landing.
// elevTool ("selecionar" | "cota") switches between that usual drag/select
// behavior and placing a manual dimension: pendingPointM is this wall's own
// half-placed first tap (if any), onElevCotaTap(xM, yM) reports each tap in
// this view's own local meters (0 at this span's own start/floor), and
// selectedCotaId/onSelectCota carry which manual cota (if any) is picked —
// a plain tap (no drag) on one selects it, same gesture that already
// distinguishes a tap from a drag everywhere else in this app.
export default function ElevationView({ level, wallId, spanStartM, spanEndM, onPatchOpening, onPatchDimStyle, onDragBegin, elevTool = "selecionar", pendingPointM, onElevCotaTap, selectedCotaId, onSelectCota }) {
  const elements = level.sketchElements || [];
  const wall = elements.find(e => e.id === wallId && e.type === "wall");
  const svgRef = useRef(null);
  // Which one thing (a dimension row, or an opening's own tag) is being
  // dragged right now, and where the drag started — kept as component
  // state (not a ref) since ElevHDim/ElevVDim below need to re-render with
  // the live offset on every move frame, the same way VectorSketch commits
  // an auto-dim's offset on every frame of its own drag.
  const [dragState, setDragState] = useState(null);
  if (!wall) {
    return <div className="text-center text-sm py-10" style={{ color: C.mute }}>Selecione uma parede para ver a elevação.</div>;
  }
  const scale = toNum(level.sketchScale, 0.5);
  const dimColor = level.dimColor || "#4A4A46";
  const doorDimColor = level.doorDimColor || "#4A4A46";
  const windowDimColor = level.windowDimColor || "#4A4A46";
  const dimFontSize = toNum(level.dimFontSize, 7.5);
  const doorWindowDimFontSize = toNum(level.doorWindowDimFontSize, dimFontSize);
  const tagColor = level.tagColor || "#4A4A46";
  const tagFontSize = toNum(level.tagFontSize, 7);
  const fontFamily = fontFamilyCss(level.fontFamily);

  // An Elevação is a view of what's actually visible from INSIDE one room —
  // a wall's own stored length runs corner to corner, which can reach well
  // past a partition into a completely different room. spanStartM/spanEndM
  // (from wallSpanForRoom, App.jsx) clip this view to just the sub-run
  // whose face actually borders the selected room; omitted, it falls back
  // to the wall's own full length (e.g. any other future caller).
  const fullLengthM = toNum(wall.length, 1);
  const spanStart = spanStartM ?? 0, spanEnd = spanEndM ?? fullLengthM;
  const lengthM = Math.max(0.1, spanEnd - spanStart);
  const heightM = toNum(wall.height, 2.8);
  const dx = wall.x2 - wall.x1, dy = wall.y2 - wall.y1, wlen = Math.hypot(dx, dy) || 1;
  const ux = dx / wlen, uy = dy / wlen;

  // Door/window x,y live in the plan's own drawing units (the same space
  // as the wall's own x1/y1/x2/y2) — projecting onto the wall's direction,
  // converting GRID units -> meters (the same conversion wallDimensions
  // uses in VectorSketch) and shifting by spanStart gives each opening's
  // position along THIS view's own horizontal axis, 0 at the clipped span's
  // own start rather than the wall's far corner. Openings whose center
  // falls outside the span belong to the wall's other room-facing run, not
  // this one, so they're left out entirely.
  const opens = elements
    .filter(e => (e.type === "door" || e.type === "window") && e.wallId === wall.id)
    .map(o => {
      const posUnits = (o.x - wall.x1) * ux + (o.y - wall.y1) * uy;
      return { ...o, posM: (posUnits / GRID) * scale - spanStart };
    })
    .filter(o => o.posM >= -0.01 && o.posM <= lengthM + 0.01)
    .sort((a, b) => a.posM - b.posM);

  const lengthPx = lengthM * PX_PER_M, heightPx = heightM * PX_PER_M;
  const wallX = MARGIN_LEFT, wallTopY = MARGIN_TOP, wallBottomY = MARGIN_TOP + heightPx;
  const viewW = wallX + lengthPx + MARGIN_RIGHT + 20;
  const viewH = wallBottomY + MARGIN_BOTTOM;

  // Same corner-to-opening / opening-to-opening gap chain wallDimensions
  // computes in the plan, just along this one wall and in meters directly
  // (no GRID/scale round-trip needed — everything here is already in it).
  const gaps = [];
  {
    const ivs = opens.map(o => {
      const halfW = toNum(o.width, 0.8) / 2;
      return { start: o.posM - halfW, end: o.posM + halfW, type: o.type };
    });
    let cursor = 0;
    ivs.forEach(iv => { if (iv.start - cursor > 0.03) gaps.push({ start: cursor, end: iv.start, type: iv.type }); cursor = Math.max(cursor, iv.end); });
    if (lengthM - cursor > 0.03) gaps.push({ start: cursor, end: lengthM, type: null });
  }

  // Every dimension row's own offset lives in level.elevDimStyles, keyed by
  // this wall's id (the same level's meta is shared by every wall's own
  // elevation, so two different walls dragging their own "wallHeight" row
  // must never collide) plus a name for which row it is.
  const elevDimStyles = level.elevDimStyles || {};
  function dimOffset(key) {
    const s = elevDimStyles[wall.id + ":" + key];
    return s ? { dx: toNum(s.dx, 0), dy: toNum(s.dy, 0) } : { dx: 0, dy: 0 };
  }
  function svgUnitsPerClientPx() {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect && rect.width ? viewW / rect.width : 1;
  }
  // A dimension only ever moves along the ONE axis that matches its own
  // orientation — a horizontal dim (the gap chain, the overall length)
  // slides up/down to find its own clear row, a vertical one (sill,
  // height, overall wall height) slides left/right — never both, or it
  // ends up floating free over the drawing instead of staying aligned
  // with the geometry it's actually measuring. Only "dim" drags are
  // constrained this way; a tag's own position (kind "tag") is free in
  // both directions, since it's a label, not a measuring line.
  function beginDrag(kind, key, startDx, startDy, axis, e) {
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    const p = e.touches ? e.touches[0] : e;
    onDragBegin?.();
    setDragState({ kind, key, axis, startClientX: p.clientX, startClientY: p.clientY, startDx, startDy, moved: false });
  }
  function onSvgMove(e) {
    if (!dragState) return;
    if (e.cancelable) e.preventDefault();
    const p = e.touches ? e.touches[0] : e;
    const f = svgUnitsPerClientPx();
    const rawDx = dragState.startDx + (p.clientX - dragState.startClientX) * f;
    const rawDy = dragState.startDy + (p.clientY - dragState.startClientY) * f;
    // Distinguishes a plain tap from a real drag — a manual cota (kind
    // "elevCota") uses this below to select itself on a tap instead of
    // nudging its position by a stray sub-pixel jiggle.
    if (!dragState.moved && Math.hypot(p.clientX - dragState.startClientX, p.clientY - dragState.startClientY) > 4) {
      setDragState(s => (s ? { ...s, moved: true } : s));
    }
    if (dragState.kind === "tag") {
      onPatchOpening?.(dragState.key, { elevTagDx: rawDx, elevTagDy: rawDy });
    } else {
      const ndx = dragState.axis === "y" ? dragState.startDx : rawDx;
      const ndy = dragState.axis === "x" ? dragState.startDy : rawDy;
      onPatchDimStyle?.(wall.id + ":" + dragState.key, { dx: ndx, dy: ndy });
    }
  }
  function endDrag() {
    if (dragState && dragState.kind === "elevCota" && !dragState.moved) onSelectCota?.(dragState.key);
    setDragState(null);
  }
  // The "Cota" tool's own tap-to-place — snaps to whatever's actually
  // measurable on this wall (its own corners, each opening's edges/sill/
  // top) within a small tolerance, same idea as the plan's own manual Cota
  // tool only ever measuring between real elements instead of arbitrary
  // pixels, so a placed dimension reads a clean value instead of whatever
  // a finger happened to land on.
  const candidateXs = [0, lengthM, ...opens.flatMap(o => { const halfW = toNum(o.width, 0.8) / 2; return [o.posM - halfW, o.posM + halfW]; })];
  const candidateYs = [0, heightM, ...opens.flatMap(o => {
    const isDoor = o.type === "door", oH = toNum(o.height, isDoor ? 2.1 : 1.2), sill = isDoor ? 0 : toNum(o.peitoril, 1);
    return [sill, sill + oH];
  })];
  function snapTo(raw, candidates) {
    let best = null, bestD = Infinity;
    candidates.forEach(c => { const d = Math.abs(c - raw); if (d < bestD) { bestD = d; best = c; } });
    return (best !== null && bestD <= 0.08) ? best : Math.round(raw * 100) / 100;
  }
  function handleSvgClick(e) {
    if (elevTool !== "cota" || !onElevCotaTap) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return;
    const f = viewW / rect.width;
    const svgX = (e.clientX - rect.left) * f, svgY = (e.clientY - rect.top) * f;
    const rawX = (svgX - wallX) / PX_PER_M, rawY = (wallBottomY - svgY) / PX_PER_M;
    const xM = Math.max(0, Math.min(lengthM, snapTo(rawX, candidateXs)));
    const yM = Math.max(0, Math.min(heightM, snapTo(rawY, candidateYs)));
    onElevCotaTap(xM, yM);
  }

  // Every EXISTING drag handle (auto rows, opening tags) only makes sense
  // in the view's usual mode — with the Cota tool active, a tap anywhere
  // should place a point instead, so those hit-rects are left out entirely
  // rather than fighting the placement tap for the same gesture.
  const dragEnabled = elevTool !== "cota";
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "#DCDCD8" }}>
      <svg ref={svgRef} viewBox={`0 0 ${viewW} ${viewH}`} width="100%"
        style={{ display: "block", touchAction: dragState ? "none" : undefined, cursor: elevTool === "cota" ? "crosshair" : undefined }} fontFamily={fontFamily}
        onClick={handleSvgClick}
        onMouseMove={onSvgMove} onMouseUp={endDrag} onMouseLeave={endDrag}
        onTouchMove={onSvgMove} onTouchEnd={endDrag} onTouchCancel={endDrag}>
        <rect x={wallX} y={wallTopY} width={lengthPx} height={heightPx} fill="#EDEAE2" stroke="#1B1E1A" strokeWidth="2" />
        <line x1={wallX - 14} y1={wallBottomY} x2={wallX + lengthPx + 14} y2={wallBottomY} stroke="#1B1E1A" strokeWidth="2" />

        {pendingPointM && (
          <circle cx={wallX + pendingPointM.xM * PX_PER_M} cy={wallBottomY - pendingPointM.yM * PX_PER_M} r="4"
            fill="none" stroke="#C1543F" strokeWidth="1.5" pointerEvents="none" />
        )}

        {gaps.map((g, i) => {
          const key = "gap" + i;
          const off = dimOffset(key);
          return (
            <ElevHDim key={key} y={wallTopY + GAP_DIM_ROW_Y} x1={wallX + g.start * PX_PER_M} x2={wallX + g.end * PX_PER_M}
              label={(g.end - g.start).toFixed(2)}
              color={g.type === "door" ? doorDimColor : g.type === "window" ? windowDimColor : dimColor}
              fontSize={g.type ? doorWindowDimFontSize : dimFontSize}
              dx={off.dx} dy={off.dy}
              onDragStart={dragEnabled && onPatchDimStyle ? (e => beginDrag("dim", key, off.dx, off.dy, "y", e)) : undefined} />
          );
        })}

        {elements.filter(e => e.type === "elevCota" && e.wallId === wall.id).map(el => {
          const off = dimOffset(el.id);
          const isSel = selectedCotaId === el.id;
          const color = isSel ? "#726F68" : dimColor;
          const onDragStart = dragEnabled && onPatchDimStyle
            ? (e => beginDrag("elevCota", el.id, off.dx, off.dy, el.axis === "h" ? "y" : "x", e))
            : undefined;
          return el.axis === "h" ? (
            <ElevHDim key={el.id} y={wallTopY - 22} x1={wallX + el.aM * PX_PER_M} x2={wallX + el.bM * PX_PER_M}
              label={(el.bM - el.aM).toFixed(2)} color={color} fontSize={dimFontSize} bold={isSel}
              dx={off.dx} dy={off.dy} onDragStart={onDragStart} />
          ) : (
            <ElevVDim key={el.id} x={wallX - 40} y1={wallBottomY - el.aM * PX_PER_M} y2={wallBottomY - el.bM * PX_PER_M}
              label={(el.bM - el.aM).toFixed(2)} color={color} fontSize={dimFontSize} bold={isSel}
              dx={off.dx} dy={off.dy} onDragStart={onDragStart} />
          );
        })}

        {opens.map(o => {
          const isDoor = o.type === "door";
          const wPx = toNum(o.width, 0.8) * PX_PER_M;
          const oHeightM = toNum(o.height, isDoor ? 2.1 : 1.2);
          const hPx = oHeightM * PX_PER_M;
          const sillM = isDoor ? 0 : toNum(o.peitoril, 1);
          const oX = wallX + o.posM * PX_PER_M - wPx / 2;
          const oBottomY = wallBottomY - sillM * PX_PER_M;
          const oTopY = oBottomY - hPx;
          const color = isDoor ? doorDimColor : windowDimColor;
          const tagDx = toNum(o.elevTagDx, 0), tagDy = toNum(o.elevTagDy, 0);
          const sillOff = dimOffset("sill:" + o.id), heightOff = dimOffset("height:" + o.id);
          return (
            <g key={o.id}>
              <rect x={oX} y={oTopY} width={wPx} height={hPx}
                fill={isDoor ? "rgba(74,74,70,0.35)" : "rgba(120,160,196,0.35)"} stroke="#1B1E1A" strokeWidth="1.2" />
              {/* Two lines right above the element itself — the name
                  (tag) on top, dimensions below it — instead of one line
                  floating up by the wall's own top edge, disconnected
                  from whichever opening it actually labels. Dragged as one
                  unit (elevTagDx/elevTagDy, stored on the opening itself)
                  so the name and its dimensions never drift apart. */}
              {o.tag && (
                <text x={oX + wPx / 2 + tagDx} y={oTopY - 4 - TAG_LINE_GAP + tagDy} fontSize={tagFontSize} fill={tagColor} textAnchor="middle" style={{ pointerEvents: "none" }}>{o.tag}</text>
              )}
              <text x={oX + wPx / 2 + tagDx} y={oTopY - 4 + tagDy} fontSize={tagFontSize} fill={tagColor} textAnchor="middle" style={{ pointerEvents: "none" }}>{o.width}×{o.height}</text>
              {dragEnabled && onPatchOpening && (
                <rect x={oX + wPx / 2 + tagDx - 24} y={oTopY - 4 - TAG_LINE_GAP + tagDy - 10} width="48" height="26" fill="transparent" style={{ cursor: "move" }}
                  onMouseDown={e => beginDrag("tag", o.id, tagDx, tagDy, null, e)} onTouchStart={e => beginDrag("tag", o.id, tagDx, tagDy, null, e)} />
              )}
              {!isDoor && sillM > 0 && (
                <ElevVDim x={oX - 8} y1={wallBottomY} y2={oBottomY} label={sillM.toFixed(2)} color={color} fontSize={doorWindowDimFontSize}
                  dx={sillOff.dx} dy={sillOff.dy}
                  onDragStart={dragEnabled && onPatchDimStyle ? (e => beginDrag("dim", "sill:" + o.id, sillOff.dx, sillOff.dy, "x", e)) : undefined} />
              )}
              <ElevVDim x={oX + wPx + 8} y1={oBottomY} y2={oTopY} label={oHeightM.toFixed(2)} color={color} fontSize={doorWindowDimFontSize}
                dx={heightOff.dx} dy={heightOff.dy}
                onDragStart={dragEnabled && onPatchDimStyle ? (e => beginDrag("dim", "height:" + o.id, heightOff.dx, heightOff.dy, "x", e)) : undefined} />
            </g>
          );
        })}

        {(() => {
          const off = dimOffset("wallHeight");
          return (
            <ElevVDim x={wallX - 30} y1={wallBottomY} y2={wallTopY} label={heightM.toFixed(2)} color={dimColor} fontSize={dimFontSize} bold
              dx={off.dx} dy={off.dy}
              onDragStart={dragEnabled && onPatchDimStyle ? (e => beginDrag("dim", "wallHeight", off.dx, off.dy, "x", e)) : undefined} />
          );
        })()}
        {(() => {
          const off = dimOffset("wallLength");
          return (
            <ElevHDim y={wallBottomY + 24} x1={wallX} x2={wallX + lengthPx} label={lengthM.toFixed(2)} color={dimColor} fontSize={dimFontSize} bold
              dx={off.dx} dy={off.dy}
              onDragStart={dragEnabled && onPatchDimStyle ? (e => beginDrag("dim", "wallLength", off.dx, off.dy, "y", e)) : undefined} />
          );
        })()}
      </svg>
    </div>
  );
}

function ElevVDim({ x, y1, y2, label, color, fontSize, bold, dx = 0, dy = 0, onDragStart }) {
  const midY = (y1 + y2) / 2 + dy;
  const lx = x + dx;
  return (
    <g>
      <line x1={lx} y1={y1 + dy} x2={lx} y2={y2 + dy} stroke={color} strokeWidth="0.75" pointerEvents="none" />
      <line x1={lx - 3} y1={y1 + dy} x2={lx + 3} y2={y1 + dy} stroke={color} strokeWidth="0.75" pointerEvents="none" />
      <line x1={lx - 3} y1={y2 + dy} x2={lx + 3} y2={y2 + dy} stroke={color} strokeWidth="0.75" pointerEvents="none" />
      <text x={lx - 3} y={midY} fontSize={fontSize} fontWeight={bold ? 700 : 400} fill={color} textAnchor="middle"
        transform={`rotate(-90 ${lx - 3} ${midY})`} style={{ pointerEvents: "none" }}>{label}</text>
      {onDragStart && (
        <rect x={lx - 15} y={midY - 15} width="30" height="30" fill="transparent" style={{ cursor: "move" }}
          onMouseDown={onDragStart} onTouchStart={onDragStart} />
      )}
    </g>
  );
}
function ElevHDim({ y, x1, x2, label, color, fontSize, bold, dx = 0, dy = 0, onDragStart }) {
  const midX = (x1 + x2) / 2 + dx;
  const ly = y + dy;
  return (
    <g>
      <line x1={x1 + dx} y1={ly} x2={x2 + dx} y2={ly} stroke={color} strokeWidth="0.75" pointerEvents="none" />
      <line x1={x1 + dx} y1={ly - 3} x2={x1 + dx} y2={ly + 3} stroke={color} strokeWidth="0.75" pointerEvents="none" />
      <line x1={x2 + dx} y1={ly - 3} x2={x2 + dx} y2={ly + 3} stroke={color} strokeWidth="0.75" pointerEvents="none" />
      <text x={midX} y={ly - 3} fontSize={fontSize} fontWeight={bold ? 700 : 400} fill={color} textAnchor="middle" style={{ pointerEvents: "none" }}>{label}</text>
      {onDragStart && (
        <rect x={midX - 18} y={ly - 18} width="36" height="24" fill="transparent" style={{ cursor: "move" }}
          onMouseDown={onDragStart} onTouchStart={onDragStart} />
      )}
    </g>
  );
}
