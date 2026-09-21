import type { ArmaduraPilar, ArmaduraSapata, ArmaduraViga, Sapata, PilarArranque, VigaBaldrame } from '../types';
import { DENSIDADE_ACO_KG_M3 } from './concrete';

/** Peso linear do aço CA-50/CA-60 (kg/m), fórmula padrão: π/4 · (d/1000)² · 7850. */
export function pesoLinearKgM(diametroMm: number): number {
  return 0.00617 * diametroMm * diametroMm;
}

/** Folga prática somada ao perímetro de um estribo para cobrir as dobras/ganchos nos cantos. */
export const FOLGA_DOBRAS_ESTRIBO_M = 0.2;

export interface GrupoBarrasResultado {
  descricao: string;
  quantidade: number;
  diametroMm: number;
  comprimentoUnitarioM: number;
  comprimentoTotalM: number;
  pesoKg: number;
  volumeM3: number;
}

function grupoResultado(
  descricao: string,
  quantidade: number,
  diametroMm: number,
  comprimentoUnitarioM: number,
): GrupoBarrasResultado {
  const comprimentoTotalM = quantidade * comprimentoUnitarioM;
  const pesoKg = comprimentoTotalM * pesoLinearKgM(diametroMm);
  return {
    descricao,
    quantidade,
    diametroMm,
    comprimentoUnitarioM,
    comprimentoTotalM,
    pesoKg,
    volumeM3: pesoKg / DENSIDADE_ACO_KG_M3,
  };
}

export interface ResultadoArmadura {
  grupos: GrupoBarrasResultado[];
  pesoTotalKg: number;
  volumeTotalM3: number;
  comprimentoTotalM: number;
}

function totalizar(grupos: GrupoBarrasResultado[]): ResultadoArmadura {
  return {
    grupos,
    pesoTotalKg: grupos.reduce((a, g) => a + g.pesoKg, 0),
    volumeTotalM3: grupos.reduce((a, g) => a + g.volumeM3, 0),
    comprimentoTotalM: grupos.reduce((a, g) => a + g.comprimentoTotalM, 0),
  };
}

/** Malha inferior da sapata, barras em duas direções ortogonais. */
export function calcularArmaduraSapata(geo: Sapata['geometria'], arm: ArmaduraSapata): ResultadoArmadura {
  const cobM = arm.cobrimento / 100;
  const ganchoM = arm.gancho / 100;

  const qtdX = Math.max(1, Math.floor((geo.largura - 2 * cobM) / (arm.espacamentoX / 100)) + 1);
  const comprimentoX = geo.comprimento - 2 * cobM + 2 * ganchoM;

  const qtdY = Math.max(1, Math.floor((geo.comprimento - 2 * cobM) / (arm.espacamentoY / 100)) + 1);
  const comprimentoY = geo.largura - 2 * cobM + 2 * ganchoM;

  const grupos = [
    grupoResultado(`Barras direção X (⌀${arm.diametroX}mm)`, qtdX, arm.diametroX, comprimentoX),
    grupoResultado(`Barras direção Y (⌀${arm.diametroY}mm)`, qtdY, arm.diametroY, comprimentoY),
  ];
  return totalizar(grupos);
}

/** Armadura longitudinal + estribos de um pilar de arranque. */
export function calcularArmaduraPilar(geo: PilarArranque['geometria'], arm: ArmaduraPilar): ResultadoArmadura {
  const cobM = arm.cobrimento / 100;
  const ancoragemM = arm.comprimentoAncoragem / 100;

  const comprimentoLongitudinal = geo.altura + ancoragemM;
  const longitudinais = grupoResultado(
    `Longitudinais (⌀${arm.longitudinais.diametro}mm)`,
    arm.longitudinais.quantidade,
    arm.longitudinais.diametro,
    comprimentoLongitudinal,
  );

  const perimetroEstribo =
    2 * (geo.largura - 2 * cobM + (geo.comprimento - 2 * cobM)) + FOLGA_DOBRAS_ESTRIBO_M;
  const qtdEstribos = Math.max(1, Math.floor((geo.altura * 100) / arm.estribo.espacamento) + 1);
  const estribos = grupoResultado(
    `Estribos (⌀${arm.estribo.diametro}mm, a cada ${arm.estribo.espacamento}cm)`,
    qtdEstribos,
    arm.estribo.diametro,
    perimetroEstribo,
  );

  return totalizar([longitudinais, estribos]);
}

/** Armadura longitudinal (superior/inferior) + estribos de uma viga baldrame. */
export function calcularArmaduraViga(geo: VigaBaldrame['geometria'], arm: ArmaduraViga): ResultadoArmadura {
  const cobM = arm.cobrimento / 100;
  const ganchoM = arm.gancho / 100;
  const comprimentoLongitudinal = geo.comprimento - 2 * cobM + 2 * ganchoM;

  const superior = grupoResultado(
    `Superior (⌀${arm.superior.diametro}mm)`,
    arm.superior.quantidade,
    arm.superior.diametro,
    comprimentoLongitudinal,
  );
  const inferior = grupoResultado(
    `Inferior (⌀${arm.inferior.diametro}mm)`,
    arm.inferior.quantidade,
    arm.inferior.diametro,
    comprimentoLongitudinal,
  );

  const perimetroEstribo = 2 * (geo.largura - 2 * cobM + (geo.altura - 2 * cobM)) + FOLGA_DOBRAS_ESTRIBO_M;
  const qtdEstribos = Math.max(1, Math.floor((geo.comprimento - 2 * cobM) / (arm.estribo.espacamento / 100)) + 1);
  const estribos = grupoResultado(
    `Estribos (⌀${arm.estribo.diametro}mm, a cada ${arm.estribo.espacamento}cm)`,
    qtdEstribos,
    arm.estribo.diametro,
    perimetroEstribo,
  );

  return totalizar([superior, inferior, estribos]);
}
