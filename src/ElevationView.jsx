// A 2D side-on cut of a single wall — length along the bottom, height up
// the side, doors/windows drawn at their real floor-to-sill/floor-to-top
// position, dimensioned the same way the plan already is. Reuses the
// per-level dimension/tag colors and font sizes set in VectorSketch's own
// "Cores e tamanhos de texto" panel, so an elevation reads as the same
// drawing as the floor plan it comes from, not a separate style.
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

export default function ElevationView({ level, wallId, spanStartM, spanEndM }) {
  const elements = level.sketchElements || [];
  const wall = elements.find(e => e.id === wallId && e.type === "wall");
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

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "#DCDCD8" }}>
      <svg viewBox={`0 0 ${viewW} ${viewH}`} width="100%" style={{ display: "block" }} fontFamily={fontFamily}>
        <rect x={wallX} y={wallTopY} width={lengthPx} height={heightPx} fill="#EDEAE2" stroke="#1B1E1A" strokeWidth="2" />
        <line x1={wallX - 14} y1={wallBottomY} x2={wallX + lengthPx + 14} y2={wallBottomY} stroke="#1B1E1A" strokeWidth="2" />

        {gaps.map((g, i) => (
          <ElevHDim key={"gap" + i} y={wallTopY + GAP_DIM_ROW_Y} x1={wallX + g.start * PX_PER_M} x2={wallX + g.end * PX_PER_M}
            label={(g.end - g.start).toFixed(2)}
            color={g.type === "door" ? doorDimColor : g.type === "window" ? windowDimColor : dimColor}
            fontSize={g.type ? doorWindowDimFontSize : dimFontSize} />
        ))}

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
          return (
            <g key={o.id}>
              <rect x={oX} y={oTopY} width={wPx} height={hPx}
                fill={isDoor ? "rgba(74,74,70,0.35)" : "rgba(120,160,196,0.35)"} stroke="#1B1E1A" strokeWidth="1.2" />
              {/* Two lines right above the element itself — the name
                  (tag) on top, dimensions below it — instead of one line
                  floating up by the wall's own top edge, disconnected
                  from whichever opening it actually labels. */}
              {o.tag && (
                <text x={oX + wPx / 2} y={oTopY - 4 - TAG_LINE_GAP} fontSize={tagFontSize} fill={tagColor} textAnchor="middle">{o.tag}</text>
              )}
              <text x={oX + wPx / 2} y={oTopY - 4} fontSize={tagFontSize} fill={tagColor} textAnchor="middle">{o.width}×{o.height}</text>
              {!isDoor && sillM > 0 && (
                <ElevVDim x={oX - 8} y1={wallBottomY} y2={oBottomY} label={sillM.toFixed(2)} color={color} fontSize={doorWindowDimFontSize} />
              )}
              <ElevVDim x={oX + wPx + 8} y1={oBottomY} y2={oTopY} label={oHeightM.toFixed(2)} color={color} fontSize={doorWindowDimFontSize} />
            </g>
          );
        })}

        <ElevVDim x={wallX - 30} y1={wallBottomY} y2={wallTopY} label={heightM.toFixed(2)} color={dimColor} fontSize={dimFontSize} bold />
        <ElevHDim y={wallBottomY + 24} x1={wallX} x2={wallX + lengthPx} label={lengthM.toFixed(2)} color={dimColor} fontSize={dimFontSize} bold />
      </svg>
    </div>
  );
}

function ElevVDim({ x, y1, y2, label, color, fontSize, bold }) {
  const midY = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={color} strokeWidth="0.75" />
      <line x1={x - 3} y1={y1} x2={x + 3} y2={y1} stroke={color} strokeWidth="0.75" />
      <line x1={x - 3} y1={y2} x2={x + 3} y2={y2} stroke={color} strokeWidth="0.75" />
      <text x={x - 3} y={midY} fontSize={fontSize} fontWeight={bold ? 700 : 400} fill={color} textAnchor="middle"
        transform={`rotate(-90 ${x - 3} ${midY})`}>{label}</text>
    </g>
  );
}
function ElevHDim({ y, x1, x2, label, color, fontSize, bold }) {
  const midX = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth="0.75" />
      <line x1={x1} y1={y - 3} x2={x1} y2={y + 3} stroke={color} strokeWidth="0.75" />
      <line x1={x2} y1={y - 3} x2={x2} y2={y + 3} stroke={color} strokeWidth="0.75" />
      <text x={midX} y={y - 3} fontSize={fontSize} fontWeight={bold ? 700 : 400} fill={color} textAnchor="middle">{label}</text>
    </g>
  );
}
