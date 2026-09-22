import { v4 as uuidv4 } from 'uuid';
import type { BimElement, GrupoArmaduraResultado, PilarArranque, Sapata, VigaBaldrame } from '../../types';
import { TRACO_PADRAO, etapasIniciais } from '../../types';
import { DENSIDADE_ACO_KG_M3 } from '../concrete';
import { pesoLinearKgM } from '../steel';
import { asNum, asRefId, asStr, getArgs, getType, parseStepModel, type Arg, type StepModel } from './stepParser';
import { anguloRotacaoY, applyTransform, resolvePlacement, type Transform } from './placement';
import { extrairGeometria, extrairGeometriaSapata } from './geometryExtract';
import {
  agruparBarras,
  espacamentoRealCm,
  parseReinforcingBar,
  separarPorDirecao,
  type BarraInfo,
  type GrupoArmaduraImportada,
} from './rebarExtract';

export interface Pavimento {
  id: number;
  nome: string;
  elevacaoCm: number;
}

export function listarPavimentos(model: StepModel): Pavimento[] {
  const out: Pavimento[] = [];
  for (const [id, ent] of model.entities) {
    if (ent.type !== 'IFCBUILDINGSTOREY') continue;
    const args = getArgs(model, id);
    if (!args) continue;
    out.push({ id, nome: asStr(args[2]) ?? `Pavimento ${id}`, elevacaoCm: asNum(args[9]) ?? 0 });
  }
  return out.sort((a, b) => a.elevacaoCm - b.elevacaoCm);
}

function elementosDoPavimento(model: StepModel, storeyId: number): Set<number> {
  const out = new Set<number>();
  for (const [id, ent] of model.entities) {
    if (ent.type !== 'IFCRELCONTAINEDINSPATIALSTRUCTURE') continue;
    const args = getArgs(model, id);
    if (!args) continue;
    const relatingStructure = asRefId(args[5]);
    if (relatingStructure !== storeyId) continue;
    const relatedList = args[4];
    if (relatedList?.k === 'list') {
      for (const item of relatedList.items) {
        if (item.k === 'ref') out.add(item.id);
      }
    }
  }
  return out;
}

/** Índice global elementId -> lista de ids de IfcPropertySet que o definem. */
function indexarPropriedades(model: StepModel): Map<number, number[]> {
  const idx = new Map<number, number[]>();
  for (const [id, ent] of model.entities) {
    if (ent.type !== 'IFCRELDEFINESBYPROPERTIES') continue;
    const args = getArgs(model, id);
    if (!args) continue;
    const relatedList = args[4];
    const psetId = asRefId(args[5]);
    if (relatedList?.k !== 'list' || psetId === undefined) continue;
    for (const item of relatedList.items) {
      if (item.k !== 'ref') continue;
      const list = idx.get(item.id) ?? [];
      list.push(psetId);
      idx.set(item.id, list);
    }
  }
  return idx;
}

function lerPropriedades(model: StepModel, psetIds: number[]): Map<string, Arg> {
  const props = new Map<string, Arg>();
  for (const psetId of psetIds) {
    if (getType(model, psetId) !== 'IFCPROPERTYSET') continue;
    const psetArgs = getArgs(model, psetId);
    const propList = psetArgs?.[4];
    if (propList?.k !== 'list') continue;
    for (const item of propList.items) {
      if (item.k !== 'ref') continue;
      if (getType(model, item.id) !== 'IFCPROPERTYSINGLEVALUE') continue;
      const propArgs = getArgs(model, item.id);
      if (!propArgs) continue;
      const nome = asStr(propArgs[0]);
      if (!nome) continue;
      props.set(nome, propArgs[2]);
    }
  }
  return props;
}

function propNum(props: Map<string, Arg>, ...nomes: string[]): number | undefined {
  for (const n of nomes) {
    const v = props.get(n);
    if (v !== undefined) {
      const num = asNum(v);
      if (num !== undefined) return num;
    }
  }
  return undefined;
}

function propStr(props: Map<string, Arg>, ...nomes: string[]): string | undefined {
  for (const n of nomes) {
    const v = props.get(n);
    if (v !== undefined) {
      const str = asStr(v);
      if (str !== undefined) return str;
    }
  }
  return undefined;
}

function converterGrupo(g: GrupoArmaduraImportada): GrupoArmaduraResultado {
  const comprimentoTotalM = g.quantidade * g.comprimentoMedioM;
  const pesoKg = comprimentoTotalM * pesoLinearKgM(g.diametroMm);
  return {
    descricao: `${g.categoria} (⌀${g.diametroMm.toFixed(1)}mm)`,
    quantidade: g.quantidade,
    diametroMm: g.diametroMm,
    comprimentoUnitarioM: g.comprimentoMedioM,
    comprimentoTotalM,
    pesoKg,
    volumeM3: pesoKg / DENSIDADE_ACO_KG_M3,
  };
}

function converterGrupoDirecao(
  categoria: string,
  rotuloDirecao: string,
  d: { quantidade: number; diametroMm: number; comprimentoMedioM: number },
): GrupoArmaduraResultado {
  const comprimentoTotalM = d.quantidade * d.comprimentoMedioM;
  const pesoKg = comprimentoTotalM * pesoLinearKgM(d.diametroMm);
  return {
    descricao: `${categoria} — ${rotuloDirecao} (⌀${d.diametroMm.toFixed(1)}mm)`,
    quantidade: d.quantidade,
    diametroMm: d.diametroMm,
    comprimentoUnitarioM: d.comprimentoMedioM,
    comprimentoTotalM,
    pesoKg,
    volumeM3: pesoKg / DENSIDADE_ACO_KG_M3,
  };
}

function buscarGrupo(
  grupos: GrupoArmaduraImportada[],
  tag: string,
  filtro: (categoriaLower: string) => boolean,
): GrupoArmaduraImportada | undefined {
  return grupos.find((g) => g.tag === tag && filtro(g.categoria.toLowerCase()));
}

function posicaoMundo(model: StepModel, objectPlacementId: number, centroBaseLocalCm: [number, number, number], cache: Map<number, Transform>) {
  const world = resolvePlacement(model, objectPlacementId, cache);
  const [x, y, z] = applyTransform(world, centroBaseLocalCm);
  return { x: x / 100, y: z / 100, z: y / 100 }; // IFC é Z-up; app usa Y-up (three.js)
}

export interface ResultadoImportacao {
  elementos: BimElement[];
  avisos: string[];
  pavimentoUsado: string;
}

export function importarIfc(texto: string, storeyIdEscolhido?: number): ResultadoImportacao {
  const model = parseStepModel(texto);
  const avisos: string[] = [];
  const pavimentos = listarPavimentos(model);
  if (pavimentos.length === 0) {
    return { elementos: [], avisos: ['Nenhum pavimento (IfcBuildingStorey) encontrado no arquivo.'], pavimentoUsado: '' };
  }
  const pavimento = storeyIdEscolhido ? pavimentos.find((p) => p.id === storeyIdEscolhido) ?? pavimentos[0] : pavimentos[0];

  const idsNoPavimento = elementosDoPavimento(model, pavimento.id);
  const propIndex = indexarPropriedades(model);
  const placementCache = new Map<number, Transform>();
  const comprimentoCache = new Map<number, number>();

  // 1) Coleta e agrupa toda a armadura do pavimento
  const barras: BarraInfo[] = [];
  for (const id of idsNoPavimento) {
    if (getType(model, id) !== 'IFCREINFORCINGBAR') continue;
    const b = parseReinforcingBar(model, id, comprimentoCache, placementCache);
    if (b) barras.push(b);
  }
  const gruposArmadura = agruparBarras(barras);

  const elementos: BimElement[] = [];

  for (const id of idsNoPavimento) {
    const tipo = getType(model, id);
    if (tipo !== 'IFCFOOTING' && tipo !== 'IFCCOLUMN' && tipo !== 'IFCBEAM') continue;
    const args = getArgs(model, id);
    if (!args) continue;

    const tag = asStr(args[2]) ?? `#${id}`;
    const objectPlacementId = asRefId(args[5]);
    const representationId = asRefId(args[6]);
    if (objectPlacementId === undefined || representationId === undefined) {
      avisos.push(`${tag}: sem placement/representation, ignorado.`);
      continue;
    }

    const props = lerPropriedades(model, propIndex.get(id) ?? []);
    const cobrimento = propNum(props, 'Cobrimento', 'ConcreteCover') ?? 3;
    const classeConcreto = propStr(props, 'Classe de concreto', 'StrengthClass');

    if (tipo === 'IFCFOOTING') {
      const geoSapata = extrairGeometriaSapata(model, representationId);
      if (!geoSapata) {
        avisos.push(`${tag}: não foi possível extrair geometria da sapata, ignorada.`);
        continue;
      }
      const posicao = posicaoMundo(model, objectPlacementId, geoSapata.centroBaseLocal, placementCache);

      const comprimentoM = geoSapata.base.comprimento / 100;
      const larguraM = geoSapata.base.largura / 100;

      // O IFC do Eberick soma as duas direções da malha (ex. N6 e N7 no desenho) num único grupo
      // "Sapatas (inferior)" — sem os números de posição de projeto. Separamos pela direção real
      // de cada barra (comprimento dela bate com o comprimento ou com a largura da sapata), que é
      // a única informação disponível no IFC para reconstruir as duas camadas.
      const barrasSapataPorCategoria = new Map<string, BarraInfo[]>();
      for (const b of barras) {
        if (b.tag !== tag || !b.categoria.toLowerCase().includes('sapata')) continue;
        const lista = barrasSapataPorCategoria.get(b.categoria) ?? [];
        lista.push(b);
        barrasSapataPorCategoria.set(b.categoria, lista);
      }
      const armaduraImportadaSapata: GrupoArmaduraResultado[] = [];
      let direcoesMalhaPrincipal: ReturnType<typeof separarPorDirecao> = [];
      for (const [categoria, lista] of barrasSapataPorCategoria) {
        const direcoes = separarPorDirecao(lista, comprimentoM * 100 - 2 * cobrimento, larguraM * 100 - 2 * cobrimento);
        if (direcoesMalhaPrincipal.length === 0) direcoesMalhaPrincipal = direcoes;
        for (const d of direcoes) {
          const rotuloDirecao = d.direcao === 'comprimento' ? 'direção X — comprimento' : 'direção Z — largura';
          armaduraImportadaSapata.push(converterGrupoDirecao(categoria, rotuloDirecao, d));
        }
      }

      const dirX = direcoesMalhaPrincipal.find((d) => d.direcao === 'comprimento');
      const dirY = direcoesMalhaPrincipal.find((d) => d.direcao === 'largura');
      const diametro = dirX?.diametroMm ?? dirY?.diametroMm ?? 10;
      const qtdX = Math.max(1, dirX?.quantidade ?? Math.ceil((direcoesMalhaPrincipal[0]?.quantidade ?? 2) / 2));
      const qtdY = Math.max(1, dirY?.quantidade ?? Math.floor((direcoesMalhaPrincipal[0]?.quantidade ?? 2) / 2));
      const espX = qtdX > 1 ? (larguraM * 100 - 2 * cobrimento) / (qtdX - 1) : 15;
      const espY = qtdY > 1 ? (comprimentoM * 100 - 2 * cobrimento) / (qtdY - 1) : 15;

      const sapata: Sapata = {
        id: uuidv4(),
        tipo: 'sapata',
        tag,
        posicao,
        traco: { ...TRACO_PADRAO },
        etapas: etapasIniciais(),
        classeConcreto,
        cobrimentoProjeto: cobrimento,
        geometria: { comprimento: comprimentoM, largura: larguraM, altura: geoSapata.base.altura / 100 },
        tronco: geoSapata.tronco
          ? {
              comprimento: geoSapata.tronco.comprimento / 100,
              largura: geoSapata.tronco.largura / 100,
              altura: geoSapata.tronco.altura / 100,
            }
          : undefined,
        armadura: {
          diametroX: diametro,
          espacamentoX: Math.max(5, espX),
          diametroY: diametro,
          espacamentoY: Math.max(5, espY),
          cobrimento,
          gancho: 10,
        },
        armaduraImportada: armaduraImportadaSapata,
      };
      elementos.push(sapata);
      continue;
    }

    const geo = extrairGeometria(model, representationId);
    if (!geo) {
      avisos.push(`${tag}: não foi possível extrair geometria, ignorado.`);
      continue;
    }
    const posicao = posicaoMundo(model, objectPlacementId, geo.centroBaseLocal, placementCache);

    if (tipo === 'IFCCOLUMN') {
      const gLong = buscarGrupo(gruposArmadura, tag, (c) => c.includes('longitudinal'));
      const gEstribo = buscarGrupo(gruposArmadura, tag, (c) => c.includes('estribo') && !c.includes('aberto'));
      const gruposPilar = gruposArmadura.filter((g) => g.tag === tag && !g.categoria.toLowerCase().includes('sapata'));
      // geo.depth é só o trecho do IfcColumn embutido na sapata (nasce no fundo dela e atravessa
      // até o topo do tronco/dado — confirmado batendo a elevação do topo desse trecho com a
      // elevação do topo do tronco pra várias sapatas) — não é a altura real do pilar de arranque
      // visível. Vira a ancoragem real da armadura; a altura real do elemento (visível, contada
      // nos quantitativos de concreto/fôrma) só é conhecida depois de ler a posição de todas as
      // vigas do pavimento — resolvida no ajuste de altura logo após este laço.
      const ancoragemCm = geo.depth;
      const barrasEstriboPilar = barras.filter(
        (b) => b.tag === tag && b.categoria.toLowerCase().includes('estribo') && !b.categoria.toLowerCase().includes('aberto'),
      );
      const qtdEstribos = gEstribo?.quantidade ?? 1;
      // Espaçamento real medido pela posição das barras no IFC — a altura do IfcColumn não é o
      // vão real onde os estribos estão distribuídos (ver comentário acima), então reconstruir a
      // partir dela dava um valor errado (chegava a menos da metade do espaçamento real).
      const espacamentoReal = espacamentoRealCm(barrasEstriboPilar);
      const espEstribo = espacamentoReal ?? (qtdEstribos > 1 ? 100 / (qtdEstribos - 1) : 15);

      const pilar: PilarArranque = {
        id: uuidv4(),
        tipo: 'pilar_arranque',
        tag,
        posicao,
        traco: { ...TRACO_PADRAO },
        etapas: etapasIniciais(),
        classeConcreto,
        cobrimentoProjeto: cobrimento,
        // Altura provisória (o trecho embutido) — substituída pela altura real do arranque
        // visível no ajuste logo após este laço.
        geometria: { largura: geo.a / 100, comprimento: geo.b / 100, altura: ancoragemCm / 100 },
        // "comprimento" do pilar = yDim do perfil (geo.b) — a direção real dele no projeto é o
        // eixo Y local da Position da extrusão, não necessariamente o eixo X do app.
        rotacaoY: geo.eixoYMundo ? anguloRotacaoY(geo.eixoYMundo) : undefined,
        armadura: {
          longitudinais: { diametro: gLong?.diametroMm ?? 10, quantidade: gLong?.quantidade ?? 4 },
          estribo: { diametro: gEstribo?.diametroMm ?? 5, espacamento: Math.max(3, espEstribo) },
          cobrimento,
          comprimentoAncoragem: ancoragemCm,
        },
        armaduraImportada: gruposPilar.map(converterGrupo),
      };
      elementos.push(pilar);
    } else if (tipo === 'IFCBEAM') {
      const gSup = buscarGrupo(gruposArmadura, tag, (c) => c.includes('superior'));
      const gInf = buscarGrupo(gruposArmadura, tag, (c) => c.includes('inferior'));
      const gEstribo = buscarGrupo(gruposArmadura, tag, (c) => c.includes('estribo') && !c.includes('aberto'));
      const gruposViga = gruposArmadura.filter((g) => g.tag === tag);
      const comprimentoCm = geo.depth;
      const qtdEstribos = gEstribo?.quantidade ?? 1;
      const espEstribo = qtdEstribos > 1 ? comprimentoCm / (qtdEstribos - 1) : 15;

      const viga: VigaBaldrame = {
        id: uuidv4(),
        tipo: 'viga_baldrame',
        tag,
        posicao,
        traco: { ...TRACO_PADRAO },
        etapas: etapasIniciais(),
        classeConcreto,
        cobrimentoProjeto: cobrimento,
        geometria: { comprimento: comprimentoCm / 100, largura: geo.a / 100, altura: geo.b / 100 },
        // "comprimento" da viga = a própria extrusão (geo.depth) — a direção real dela no
        // projeto é o eixo Z local da Position (eixo da extrusão), não necessariamente X do app.
        rotacaoY: geo.eixoZMundo ? anguloRotacaoY(geo.eixoZMundo) : undefined,
        armadura: {
          superior: { diametro: gSup?.diametroMm ?? 10, quantidade: gSup?.quantidade ?? 2 },
          inferior: { diametro: gInf?.diametroMm ?? 10, quantidade: gInf?.quantidade ?? 2 },
          estribo: { diametro: gEstribo?.diametroMm ?? 5, espacamento: Math.max(5, espEstribo) },
          cobrimento,
          gancho: 8,
        },
        armaduraImportada: gruposViga.map(converterGrupo),
      };
      elementos.push(viga);
    }
  }

  // Corrige a altura do pilar de arranque: o que foi lido acima (geo.depth, guardado
  // provisoriamente em geometria.altura) é só o trecho do IfcColumn embutido dentro da sapata —
  // o pilar de arranque REAL e visível vai desse ponto até a face superior da viga baldrame
  // (confirmado: todos os arranques têm 1,50m de altura real, do topo da sapata até a emenda
  // com o pilar do térreo). Esse trecho visível é que entra nos quantitativos de concreto/fôrma
  // — diferente da abordagem anterior (um indicador só visual, fora do escopo), agora ele É o
  // elemento.
  const vigasImportadas = elementos.filter((e): e is VigaBaldrame => e.tipo === 'viga_baldrame');
  if (vigasImportadas.length > 0) {
    // Face SUPERIOR da viga (base da viga + a própria altura dela), não a base — o arranque vai
    // até onde a viga realmente termina em cima.
    const topoVigasY = Math.max(...vigasImportadas.map((v) => v.posicao.y + v.geometria.altura));
    for (const el of elementos) {
      if (el.tipo !== 'pilar_arranque') continue;
      const pilar = el as PilarArranque;
      // Neste ponto, geometria.altura ainda guarda o trecho embutido (ancoragem) — o topo dele é
      // onde o arranque visível começa.
      const baseArranqueVisivelY = pilar.posicao.y + pilar.geometria.altura;
      const alturaVisivel = topoVigasY - baseArranqueVisivelY;
      if (alturaVisivel > 0.01) {
        pilar.posicao.y = baseArranqueVisivelY;
        pilar.geometria.altura = alturaVisivel;
      } else {
        avisos.push(`${pilar.tag}: altura do arranque calculada a partir da viga ficou <= 0, mantendo o trecho modelado no IFC.`);
      }
    }
  }

  if (elementos.length > 0) {
    const minY = Math.min(...elementos.map((e) => e.posicao.y));
    for (const el of elementos) el.posicao.y -= minY;
  }

  return { elementos, avisos, pavimentoUsado: pavimento.nome };
}
