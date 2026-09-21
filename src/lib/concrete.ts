import type { TracoConcreto } from '../types';

/** Densidades reais (absolutas) dos materiais, kg/m³ — usadas na dosagem racional (método dos volumes absolutos). */
export const DENSIDADE_CIMENTO_KG_M3 = 3100;
export const DENSIDADE_AREIA_KG_M3 = 2650;
export const DENSIDADE_BRITA_KG_M3 = 2650;
export const DENSIDADE_AGUA_KG_M3 = 1000;
/** Densidades aparentes (material solto, como comprado/medido em obra), kg/m³ — usadas só para converter massa em volume de compra. */
export const DENSIDADE_APARENTE_AREIA_KG_M3 = 1500;
export const DENSIDADE_APARENTE_BRITA_KG_M3 = 1550;
/** Ar incorporado/aprisionado típico em concreto convencional adensado manualmente. */
export const AR_INCORPORADO_M3_POR_M3 = 0.015;
export const SACO_CIMENTO_KG = 50;
export const DENSIDADE_ACO_KG_M3 = 7850;

export interface ResultadoConcreto {
  volumeM3: number;
  consumoCimentoKgM3: number;
  cimentoKg: number;
  cimentoSacos: number;
  areiaKg: number;
  areiaM3: number;
  britaKg: number;
  britaM3: number;
  aguaLitros: number;
  /** true quando o consumo veio de override manual do usuário, não do cálculo teórico. */
  origemConsumo: 'calculado' | 'informado';
}

/**
 * Calcula o consumo de materiais para um volume de concreto dado um traço unitário
 * em massa (1 : areia : brita) e relação água/cimento, pelo método dos volumes
 * absolutos (NBR 12655). Se `consumoCimentoKgM3Override` estiver preenchido no traço,
 * ele é usado diretamente (útil quando a obra já tem um traço de referência em
 * sacos/m³ vindo de um estudo de dosagem ou tabela própria).
 */
export function calcularConcreto(volumeM3: number, traco: TracoConcreto): ResultadoConcreto {
  let consumoCimentoKgM3: number;
  let origemConsumo: ResultadoConcreto['origemConsumo'];

  if (traco.consumoCimentoKgM3Override && traco.consumoCimentoKgM3Override > 0) {
    consumoCimentoKgM3 = traco.consumoCimentoKgM3Override;
    origemConsumo = 'informado';
  } else {
    const volumePorKgCimento =
      1 / DENSIDADE_CIMENTO_KG_M3 +
      traco.areia / DENSIDADE_AREIA_KG_M3 +
      traco.brita / DENSIDADE_BRITA_KG_M3 +
      traco.fatorAguaCimento / DENSIDADE_AGUA_KG_M3;
    const volumeUtilM3 = 1 - AR_INCORPORADO_M3_POR_M3; // por m³ de concreto
    consumoCimentoKgM3 = volumeUtilM3 / volumePorKgCimento;
    origemConsumo = 'calculado';
  }

  const cimentoKg = consumoCimentoKgM3 * volumeM3;
  const areiaKg = traco.areia * cimentoKg;
  const britaKg = traco.brita * cimentoKg;
  const aguaLitros = traco.fatorAguaCimento * cimentoKg;

  return {
    volumeM3,
    consumoCimentoKgM3,
    cimentoKg,
    cimentoSacos: cimentoKg / SACO_CIMENTO_KG,
    areiaKg,
    areiaM3: areiaKg / DENSIDADE_APARENTE_AREIA_KG_M3,
    britaKg,
    britaM3: britaKg / DENSIDADE_APARENTE_BRITA_KG_M3,
    aguaLitros,
    origemConsumo,
  };
}

export interface FaceForma {
  nome: string;
  larguraM: number;
  alturaM: number;
  areaM2: number;
}

export interface ResultadoForma {
  comprimentoM: number;
  larguraM: number;
  alturaM: number;
  faces: FaceForma[];
  areaTotalM2: number;
}

/**
 * Área de forma (fôrma de madeira) para um prisma retangular comprimento x largura x altura.
 * Por padrão considera apenas as 4 faces laterais (prática usual em sapata/pilar/baldrame
 * apoiados sobre lastro, com topo aberto para lançamento). `incluirFundo`/`incluirTopo`
 * permitem ligar essas faces quando o elemento é suspenso/escorado.
 */
export function calcularForma(
  comprimentoM: number,
  larguraM: number,
  alturaM: number,
  opts: { incluirFundo?: boolean; incluirTopo?: boolean } = {},
): ResultadoForma {
  const faces: FaceForma[] = [
    { nome: 'frente', larguraM: comprimentoM, alturaM, areaM2: comprimentoM * alturaM },
    { nome: 'fundo (face oposta)', larguraM: comprimentoM, alturaM, areaM2: comprimentoM * alturaM },
    { nome: 'esquerda', larguraM: larguraM, alturaM, areaM2: larguraM * alturaM },
    { nome: 'direita', larguraM: larguraM, alturaM, areaM2: larguraM * alturaM },
  ];
  if (opts.incluirFundo) {
    faces.push({ nome: 'base', larguraM: comprimentoM, alturaM: larguraM, areaM2: comprimentoM * larguraM });
  }
  if (opts.incluirTopo) {
    faces.push({ nome: 'topo', larguraM: comprimentoM, alturaM: larguraM, areaM2: comprimentoM * larguraM });
  }
  const areaTotalM2 = faces.reduce((acc, f) => acc + f.areaM2, 0);
  return { comprimentoM, larguraM, alturaM, faces, areaTotalM2 };
}
