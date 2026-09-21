import { asNum, asStr, getArgs, getType, type StepModel } from './stepParser';
import { findEntity, collectRefIds } from './geometryExtract';

function dist(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function pointOf(model: StepModel, id: number): [number, number, number] | undefined {
  const args = getArgs(model, id);
  if (!args || getType(model, id) !== 'IFCCARTESIANPOINT') return undefined;
  const list = args[0];
  if (list?.k !== 'list') return undefined;
  const [x, y, z] = list.items.map((a) => asNum(a) ?? 0);
  return [x, y ?? 0, z ?? 0];
}

function polylineLengthCm(model: StepModel, polylineId: number): number {
  const args = getArgs(model, polylineId);
  if (!args) return 0;
  const pointRefs = collectRefIds(args);
  const pts = pointRefs.map((id) => pointOf(model, id)).filter((p): p is [number, number, number] => !!p);
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  return total;
}

/** Soma o comprimento de uma diretriz (IfcPolyline ou IfcCompositeCurve de segmentos IfcPolyline). */
function curveLengthCm(model: StepModel, curveId: number, depth = 0): number {
  if (depth > 8) return 0;
  const type = getType(model, curveId);
  const args = getArgs(model, curveId);
  if (!args) return 0;

  if (type === 'IFCPOLYLINE') {
    return polylineLengthCm(model, curveId);
  }
  if (type === 'IFCCOMPOSITECURVE') {
    const segmentsList = args[0];
    if (segmentsList?.k !== 'list') return 0;
    let total = 0;
    for (const seg of segmentsList.items) {
      if (seg.k !== 'ref') continue;
      const segArgs = getArgs(model, seg.id);
      if (!segArgs) continue;
      const parentCurve = segArgs[2];
      if (parentCurve?.k === 'ref') {
        total += curveLengthCm(model, parentCurve.id, depth + 1);
      }
    }
    return total;
  }
  // Curvas não suportadas (arcos/trimmed curves) — não deveria ocorrer nas barras
  // exportadas pelo Eberick, que usam apenas polilinhas retas.
  return 0;
}

/**
 * Resolve o comprimento real (cm) de uma barra a partir da geometria (IfcSweptDiskSolid),
 * cacheando por sólido — muitas barras reaproveitam a mesma forma via IfcMappedItem.
 */
export function resolverComprimentoBarraCm(
  model: StepModel,
  representationId: number,
  cache: Map<number, number>,
): number {
  const solidId = findEntity(model, representationId, 'IFCSWEPTDISKSOLID');
  if (solidId === undefined) return 0;
  const cached = cache.get(solidId);
  if (cached !== undefined) return cached;

  const args = getArgs(model, solidId)!;
  const directrixId = args[0]?.k === 'ref' ? args[0].id : undefined;
  const length = directrixId !== undefined ? curveLengthCm(model, directrixId) : 0;
  cache.set(solidId, length);
  return length;
}

export interface BarraInfo {
  tag: string;
  categoria: string;
  diametroMm: number;
  comprimentoCm: number;
}

/** Separa "P1 - Estribo" em { tag: "P1", categoria: "Estribo" }. */
function separarNome(nome: string): { tag: string; categoria: string } {
  const idx = nome.indexOf(' - ');
  if (idx === -1) return { tag: nome, categoria: '' };
  return { tag: nome.slice(0, idx), categoria: nome.slice(idx + 3) };
}

export function parseReinforcingBar(
  model: StepModel,
  id: number,
  comprimentoCache: Map<number, number>,
): BarraInfo | undefined {
  const args = getArgs(model, id);
  if (!args) return undefined;
  const nome = asStr(args[2]) ?? '';
  const representationId = args[6]?.k === 'ref' ? args[6].id : undefined;
  const diametroCm = asNum(args[9]) ?? 0;
  if (!nome || representationId === undefined || diametroCm <= 0) return undefined;

  const { tag, categoria } = separarNome(nome);
  const comprimentoCm = resolverComprimentoBarraCm(model, representationId, comprimentoCache);

  return { tag, categoria, diametroMm: diametroCm * 10, comprimentoCm };
}

export interface GrupoArmaduraImportada {
  tag: string;
  categoria: string;
  quantidade: number;
  diametroMm: number;
  comprimentoMedioM: number;
}

/** Agrupa barras por (tag, categoria), tirando diâmetro e comprimento médio de cada grupo. */
export function agruparBarras(barras: BarraInfo[]): GrupoArmaduraImportada[] {
  const grupos = new Map<string, BarraInfo[]>();
  for (const b of barras) {
    const chave = `${b.tag}::${b.categoria}`;
    const lista = grupos.get(chave) ?? [];
    lista.push(b);
    grupos.set(chave, lista);
  }
  const resultado: GrupoArmaduraImportada[] = [];
  for (const [, lista] of grupos) {
    const { tag, categoria } = lista[0];
    const quantidade = lista.length;
    const diametroMm = lista.reduce((a, b) => a + b.diametroMm, 0) / quantidade;
    const comprimentoMedioM = lista.reduce((a, b) => a + b.comprimentoCm, 0) / quantidade / 100;
    resultado.push({ tag, categoria, quantidade, diametroMm, comprimentoMedioM });
  }
  return resultado;
}
