import { asNum, asVec3, getArgs, getType, type Arg, type StepModel } from './stepParser';
import { applyTransform, readAxis2Placement3D, type Vec3 } from './placement';

function collectRefIds(args: Arg[]): number[] {
  const out: number[] = [];
  function walk(a: Arg) {
    if (a.k === 'ref') out.push(a.id);
    else if (a.k === 'list') a.items.forEach(walk);
    else if (a.k === 'typed') a.items.forEach(walk);
  }
  args.forEach(walk);
  return out;
}

function findEntity(
  model: StepModel,
  id: number,
  type: string,
  depth = 0,
  seen: Set<number> = new Set(),
  maxDepth = 16,
): number | undefined {
  if (depth > maxDepth || seen.has(id)) return undefined;
  seen.add(id);
  if (getType(model, id) === type) return id;
  const args = getArgs(model, id);
  if (!args) return undefined;
  for (const refId of collectRefIds(args)) {
    const found = findEntity(model, refId, type, depth + 1, seen, maxDepth);
    if (found !== undefined) return found;
  }
  return undefined;
}

function collectPoints(
  model: StepModel,
  id: number,
  out: [number, number, number][],
  depth = 0,
  seen: Set<number> = new Set(),
  maxDepth = 16,
) {
  if (depth > maxDepth || seen.has(id)) return;
  seen.add(id);
  const type = getType(model, id);
  const args = getArgs(model, id);
  if (!args) return;
  if (type === 'IFCCARTESIANPOINT') {
    const v = asVec3(args[0]);
    if (v) out.push(v);
    return;
  }
  for (const refId of collectRefIds(args)) {
    collectPoints(model, refId, out, depth + 1, seen, maxDepth);
  }
}

export interface GeometriaExtraida {
  /** Dimensões locais em cm: para prismas extrudados, a/b = seção transversal e depth = comprimento da extrusão. */
  a: number;
  b: number;
  depth: number;
  origem: 'extrusao' | 'bbox';
  /** Ponto de referência (centro do footprint em X/Y, base em Z) no referencial LOCAL do objeto, em cm. */
  centroBaseLocal: [number, number, number];
  /**
   * Direções mundiais (coordenadas IFC, X/Y horizontais) dos eixos locais X e Y da Position da
   * extrusão — usadas pra descobrir a orientação horizontal real do elemento: pilar usa o eixo Y
   * (direção do "comprimento" = yDim do perfil); viga usa o eixo Z, que é a própria direção da
   * extrusão (`eixoZMundo`, abaixo). Undefined quando a geometria veio do fallback bbox (sem
   * Position explícita pra ler).
   */
  eixoXMundo?: Vec3;
  eixoYMundo?: Vec3;
  eixoZMundo?: Vec3;
}

/**
 * Extrai as dimensões de um elemento a partir da sua Representation (IfcProductDefinitionShape).
 * Prioriza IfcExtrudedAreaSolid + IfcRectangleProfileDef (pilares/vigas, prismas simples).
 * Se não encontrar extrusão (ex.: sapata modelada como sólido explícito/frustum), cai para o
 * bounding box de todos os IfcCartesianPoint alcançáveis a partir da representação.
 */
export function extrairGeometria(model: StepModel, representationId: number): GeometriaExtraida | undefined {
  const extrusionId = findEntity(model, representationId, 'IFCEXTRUDEDAREASOLID');
  if (extrusionId !== undefined) {
    const args = getArgs(model, extrusionId)!;
    const profileId = args[0]?.k === 'ref' ? args[0].id : undefined;
    const depth = asNum(args[3]) ?? 0;
    if (profileId !== undefined && getType(model, profileId) === 'IFCRECTANGLEPROFILEDEF') {
      const profileArgs = getArgs(model, profileId)!;
      const xDim = asNum(profileArgs[3]) ?? 0;
      const yDim = asNum(profileArgs[4]) ?? 0;
      const positionId = args[1]?.k === 'ref' ? args[1].id : undefined;

      if (xDim > 0 && yDim > 0 && depth > 0) {
        // O perfil (xDim x yDim) fica no plano local da Position, centrado na sua origem;
        // a extrusão (depth) vai ao longo do eixo Z dessa mesma Position. Para achar o
        // centro/base no referencial do OBJETO (não da Position, que pode estar rotacionada
        // em relação ao objeto — comum em vigas, cujo perfil "deitado" usa outro eixo como
        // vertical), transformamos os 8 cantos do prisma pela Position e tiramos o bbox.
        const positionTransform = positionId !== undefined ? readAxis2Placement3D(model, positionId) : undefined;
        const corners: [number, number, number][] = [];
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            for (const sz of [0, 1]) {
              const local: [number, number, number] = [(sx * xDim) / 2, (sy * yDim) / 2, sz * depth];
              corners.push(positionTransform ? applyTransform(positionTransform, local) : local);
            }
          }
        }
        const xs = corners.map((p) => p[0]);
        const ys = corners.map((p) => p[1]);
        const zs = corners.map((p) => p[2]);
        const centroBaseLocal: [number, number, number] = [
          (Math.min(...xs) + Math.max(...xs)) / 2,
          (Math.min(...ys) + Math.max(...ys)) / 2,
          Math.min(...zs),
        ];
        return {
          a: xDim,
          b: yDim,
          depth,
          origem: 'extrusao',
          centroBaseLocal,
          eixoXMundo: positionTransform ? [positionTransform.rot[0][0], positionTransform.rot[1][0], positionTransform.rot[2][0]] : undefined,
          eixoYMundo: positionTransform ? [positionTransform.rot[0][1], positionTransform.rot[1][1], positionTransform.rot[2][1]] : undefined,
          eixoZMundo: positionTransform ? [positionTransform.rot[0][2], positionTransform.rot[1][2], positionTransform.rot[2][2]] : undefined,
        };
      }
    }
  }

  const points: [number, number, number][] = [];
  collectPoints(model, representationId, points);
  if (points.length === 0) return undefined;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const zs = points.map((p) => p[2]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const dx = maxX - minX;
  const dy = maxY - minY;
  const dz = maxZ - minZ;
  if (dx <= 0 || dy <= 0 || dz <= 0) return undefined;
  return {
    a: dx,
    b: dy,
    depth: dz,
    origem: 'bbox',
    centroBaseLocal: [(minX + maxX) / 2, (minY + maxY) / 2, minZ],
  };
}

export interface GeometriaSapata {
  base: { comprimento: number; largura: number; altura: number };
  /** Presente quando o sólido tem um footprint mais estreito no topo (tronco de pirâmide/dado). */
  tronco?: { comprimento: number; largura: number; altura: number };
  centroBaseLocal: [number, number, number];
}

/**
 * Extrai a geometria de uma sapata a partir do sólido explícito do IFC, detectando o
 * formato em tronco de pirâmide: agrupa os vértices por nível Z e procura o primeiro nível
 * cujo footprint (X/Y) é visivelmente menor que o da base — esse é o início do tronco, que
 * vai até o nível mais alto (o topo, onde nasce o pilar). Sem essa redução de footprint, cai
 * para um bloco simples (sem tronco).
 */
export function extrairGeometriaSapata(model: StepModel, representationId: number): GeometriaSapata | undefined {
  const points: [number, number, number][] = [];
  collectPoints(model, representationId, points);
  if (points.length === 0) return undefined;

  const porZ = new Map<number, { minX: number; maxX: number; minY: number; maxY: number }>();
  for (const [x, y, z] of points) {
    const zr = Math.round(z * 100) / 100; // cm, arredonda p/ evitar ruído de ponto flutuante
    const cur = porZ.get(zr);
    if (!cur) porZ.set(zr, { minX: x, maxX: x, minY: y, maxY: y });
    else {
      cur.minX = Math.min(cur.minX, x);
      cur.maxX = Math.max(cur.maxX, x);
      cur.minY = Math.min(cur.minY, y);
      cur.maxY = Math.max(cur.maxY, y);
    }
  }
  const niveis = [...porZ.entries()].map(([z, bb]) => ({ z, ...bb })).sort((a, b) => a.z - b.z);
  if (niveis.length < 2) return undefined;

  // Convenção do resto do pipeline (posicaoMundo, ConcretoBox): comprimento corre no eixo X do
  // app, que é o mesmo X do IFC sem troca nenhuma; largura corre no eixo Z do app, que é o Y do
  // IFC (troca Z-up→Y-up). Ou seja: comprimento = extensão em X (IFC), largura = extensão em Y
  // (IFC) — nessa ordem, não o contrário (bug histórico: estava invertido aqui, sem dar problema
  // visível em sapatas quase quadradas, mas ficando óbvio no tronco, bem mais alongado, e depois
  // que o pilar por cima passou a ter sua orientação real, gerando desalinhamento nítido).
  const fundo = niveis[0];
  const extXFundo = fundo.maxX - fundo.minX;
  const extYFundo = fundo.maxY - fundo.minY;
  if (extXFundo <= 0 || extYFundo <= 0) return undefined;

  const centroBaseLocal: [number, number, number] = [(fundo.minX + fundo.maxX) / 2, (fundo.minY + fundo.maxY) / 2, fundo.z];

  // procura o primeiro nível com footprint visivelmente menor (>1cm) que o da base
  let indiceMudanca = -1;
  for (let i = 1; i < niveis.length; i++) {
    const extX = niveis[i].maxX - niveis[i].minX;
    const extY = niveis[i].maxY - niveis[i].minY;
    if (extX < extXFundo - 1 || extY < extYFundo - 1) {
      indiceMudanca = i;
      break;
    }
  }

  if (indiceMudanca === -1) {
    // sem redução de footprint: bloco simples até o nível mais alto
    const topo = niveis[niveis.length - 1];
    const altura = topo.z - fundo.z;
    if (altura <= 0) return undefined;
    return { base: { comprimento: extXFundo, largura: extYFundo, altura }, centroBaseLocal };
  }

  const baseTopoNivel = niveis[indiceMudanca - 1];
  const alturaBase = baseTopoNivel.z - fundo.z;
  if (alturaBase <= 0) return undefined;

  const topoNivel = niveis[niveis.length - 1];
  const alturaTronco = topoNivel.z - baseTopoNivel.z;
  const extXTopo = topoNivel.maxX - topoNivel.minX;
  const extYTopo = topoNivel.maxY - topoNivel.minY;

  return {
    base: { comprimento: extXFundo, largura: extYFundo, altura: alturaBase },
    tronco: alturaTronco > 0 && extXTopo > 0 && extYTopo > 0 ? { comprimento: extXTopo, largura: extYTopo, altura: alturaTronco } : undefined,
    centroBaseLocal,
  };
}

export { findEntity, collectPoints, collectRefIds };
