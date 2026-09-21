import type { BimElement, TipoElemento } from '../types';
import { calcularQuantitativo } from './quantities';

export interface TotaisMateriais {
  quantidadeElementos: number;
  volumeConcretoM3: number;
  areaFormaM2: number;
  pesoAcoKg: number;
  cimentoSacos: number;
  areiaM3: number;
  britaM3: number;
}

export interface ResumoEtapa {
  /** Totais somando todos os elementos da etapa. */
  total: TotaisMateriais;
  /** Totais por tipo de elemento (só entram os tipos com pelo menos 1 elemento). */
  porTipo: { tipo: TipoElemento; totais: TotaisMateriais }[];
}

function totaisVazios(quantidadeElementos = 0): TotaisMateriais {
  return { quantidadeElementos, volumeConcretoM3: 0, areaFormaM2: 0, pesoAcoKg: 0, cimentoSacos: 0, areiaM3: 0, britaM3: 0 };
}

function somar(a: TotaisMateriais, b: TotaisMateriais): TotaisMateriais {
  return {
    quantidadeElementos: a.quantidadeElementos + b.quantidadeElementos,
    volumeConcretoM3: a.volumeConcretoM3 + b.volumeConcretoM3,
    areaFormaM2: a.areaFormaM2 + b.areaFormaM2,
    pesoAcoKg: a.pesoAcoKg + b.pesoAcoKg,
    cimentoSacos: a.cimentoSacos + b.cimentoSacos,
    areiaM3: a.areiaM3 + b.areiaM3,
    britaM3: a.britaM3 + b.britaM3,
  };
}

function totaisDoElemento(elemento: BimElement): TotaisMateriais {
  const q = calcularQuantitativo(elemento);
  return {
    quantidadeElementos: 1,
    volumeConcretoM3: q.volumeConcretoM3,
    areaFormaM2: q.forma.areaTotalM2,
    pesoAcoKg: q.armadura.pesoTotalKg,
    cimentoSacos: q.concreto.cimentoSacos,
    areiaM3: q.concreto.areiaM3,
    britaM3: q.concreto.britaM3,
  };
}

const ORDEM_TIPO: TipoElemento[] = ['sapata', 'pilar_arranque', 'viga_baldrame'];

/**
 * Totais de material da etapa de fundação (hoje, todo elemento do projeto é dessa etapa — sapata,
 * pilar de arranque e viga baldrame), no total geral e por tipo de elemento (quanto é de sapata,
 * quanto é de pilar, quanto é de viga).
 */
export function calcularResumoEtapa(elementos: BimElement[]): ResumoEtapa {
  const porTipoMap = new Map<TipoElemento, TotaisMateriais>();
  let total = totaisVazios();

  for (const elemento of elementos) {
    const totaisEl = totaisDoElemento(elemento);
    total = somar(total, totaisEl);
    porTipoMap.set(elemento.tipo, somar(porTipoMap.get(elemento.tipo) ?? totaisVazios(), totaisEl));
  }

  const porTipo = ORDEM_TIPO.filter((tipo) => porTipoMap.has(tipo)).map((tipo) => ({ tipo, totais: porTipoMap.get(tipo)! }));

  return { total, porTipo };
}
