import { asNum, asRefId, asStr, getArgs, getType, type StepModel } from './stepParser';
import { findEntity, collectRefIds } from './geometryExtract';
import { applyTransform, resolvePlacement, type Transform } from './placement';

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
  /** Posição Z (mundo, cm, eixo vertical do IFC) da origem do placement da barra — usada só pra
   * medir espaçamento REAL entre barras de um mesmo grupo (ex. estribos de um pilar), já que o
   * IFC não exporta "espaçamento" como propriedade. Só faz sentido pra elementos verticais
   * (pilares): pra vigas, a distribuição é horizontal, não em Z. */
  zMundoCm?: number;
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
  placementCache?: Map<number, Transform>,
): BarraInfo | undefined {
  const args = getArgs(model, id);
  if (!args) return undefined;
  const nome = asStr(args[2]) ?? '';
  const representationId = args[6]?.k === 'ref' ? args[6].id : undefined;
  const diametroCm = asNum(args[9]) ?? 0;
  if (!nome || representationId === undefined || diametroCm <= 0) return undefined;

  const { tag, categoria } = separarNome(nome);
  const comprimentoCm = resolverComprimentoBarraCm(model, representationId, comprimentoCache);

  let zMundoCm: number | undefined;
  if (placementCache) {
    const objectPlacementId = asRefId(args[5]);
    if (objectPlacementId !== undefined) {
      const world = resolvePlacement(model, objectPlacementId, placementCache);
      zMundoCm = applyTransform(world, [0, 0, 0])[2];
    }
  }

  return { tag, categoria, diametroMm: diametroCm * 10, comprimentoCm, zMundoCm };
}

/**
 * Espaçamento real (cm) entre barras de um grupo vertical (ex. estribos de um pilar), medido
 * direto das posições no IFC — não uma reconstrução a partir da altura modelada do elemento
 * (que pode ser só um trecho, como o toco embutido na sapata, não o vão real onde as barras
 * estão distribuídas). Só confiável pra grupos com 2+ barras com posição conhecida.
 */
export function espacamentoRealCm(barras: BarraInfo[]): number | undefined {
  const zs = barras.map((b) => b.zMundoCm).filter((z): z is number => z !== undefined);
  if (zs.length < 2) return undefined;
  zs.sort((a, b) => a - b);
  const span = zs[zs.length - 1] - zs[0];
  return span / (zs.length - 1);
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

export interface GrupoPorDirecao {
  direcao: 'comprimento' | 'largura';
  quantidade: number;
  diametroMm: number;
  comprimentoMedioM: number;
}

function paraGrupoPorDirecao(lista: BarraInfo[], direcao: GrupoPorDirecao['direcao']): GrupoPorDirecao {
  return {
    direcao,
    quantidade: lista.length,
    diametroMm: lista.reduce((a, b) => a + b.diametroMm, 0) / lista.length,
    comprimentoMedioM: lista.reduce((a, b) => a + b.comprimentoCm, 0) / lista.length / 100,
  };
}

/**
 * Separa as barras da malha inferior/superior da sapata pelas suas duas direções reais (o IFC do
 * Eberick soma X e Y num único grupo "Sapatas (inferior)", sem preservar as posições N do projeto
 * — ex. N6/N7 — então a única forma de recuperar as duas camadas é pelo comprimento de cada barra:
 * numa sapata retangular, as barras que correm ao longo do comprimento medem diferente das que
 * correm ao longo da largura). Agrupa por comprimento arredondado ao cm e funde clusters a menos
 * de 3cm um do outro (ruído numérico).
 *
 * O comprimento real de cada barra inclui dobras/folgas que a gente não modela com exatidão, então
 * casar cada cluster com a dimensão de referência mais próxima em valor absoluto não é confiável
 * (uma barra pode "sobrar" ou "faltar" alguns cm por causa disso). O que é sempre verdade é a
 * ORDEM: a barra que corre na maior dimensão da sapata é sempre a mais longa das duas. Por isso,
 * com exatamente 2 clusters, casamos pela ordem (mais curta → menor dimensão, mais longa → maior
 * dimensão) em vez do valor absoluto. Sapata quadrada (só um cluster) devolve um único grupo.
 */
export function separarPorDirecao(
  barras: BarraInfo[],
  comprimentoRefCm: number,
  larguraRefCm: number,
): GrupoPorDirecao[] {
  if (barras.length === 0) return [];
  const porComprimento = new Map<number, BarraInfo[]>();
  for (const b of barras) {
    const chave = Math.round(b.comprimentoCm);
    const lista = porComprimento.get(chave) ?? [];
    lista.push(b);
    porComprimento.set(chave, lista);
  }
  const clusters = [...porComprimento.entries()].sort((a, b) => a[0] - b[0]);

  const fundidos: BarraInfo[][] = [];
  for (const [, lista] of clusters) {
    const ultimo = fundidos[fundidos.length - 1];
    if (ultimo) {
      const mediaUltimo = ultimo.reduce((a, b) => a + b.comprimentoCm, 0) / ultimo.length;
      const mediaAtual = lista.reduce((a, b) => a + b.comprimentoCm, 0) / lista.length;
      if (Math.abs(mediaAtual - mediaUltimo) < 3) {
        ultimo.push(...lista);
        continue;
      }
    }
    fundidos.push([...lista]);
  }

  if (fundidos.length === 1) {
    const mediaCm = fundidos[0].reduce((a, b) => a + b.comprimentoCm, 0) / fundidos[0].length;
    const direcao: GrupoPorDirecao['direcao'] =
      Math.abs(mediaCm - comprimentoRefCm) <= Math.abs(mediaCm - larguraRefCm) ? 'comprimento' : 'largura';
    return [paraGrupoPorDirecao(fundidos[0], direcao)];
  }

  if (fundidos.length === 2) {
    const ordenados = [...fundidos].sort(
      (a, b) => a.reduce((s, x) => s + x.comprimentoCm, 0) / a.length - b.reduce((s, x) => s + x.comprimentoCm, 0) / b.length,
    );
    const [menorDim, maiorDim]: GrupoPorDirecao['direcao'][] =
      comprimentoRefCm <= larguraRefCm ? ['comprimento', 'largura'] : ['largura', 'comprimento'];
    return [paraGrupoPorDirecao(ordenados[0], menorDim), paraGrupoPorDirecao(ordenados[1], maiorDim)];
  }

  // mais de 2 clusters é incomum (ex. sapata com barras de reforço extra) — casa cada um pela
  // proximidade absoluta com uma das duas dimensões, como aproximação razoável.
  return fundidos.map((lista) => {
    const mediaCm = lista.reduce((a, b) => a + b.comprimentoCm, 0) / lista.length;
    const direcao: GrupoPorDirecao['direcao'] =
      Math.abs(mediaCm - comprimentoRefCm) <= Math.abs(mediaCm - larguraRefCm) ? 'comprimento' : 'largura';
    return paraGrupoPorDirecao(lista, direcao);
  });
}
