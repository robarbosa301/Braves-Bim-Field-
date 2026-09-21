import type { BimElement } from '../types';
import {
  calcularConcreto,
  calcularForma,
  calcularTroncoPiramide,
  DENSIDADE_ACO_KG_M3,
  ResultadoConcreto,
  ResultadoForma,
} from './concrete';
import { calcularArmaduraPilar, calcularArmaduraSapata, calcularArmaduraViga, ResultadoArmadura, totalizar } from './steel';

export interface QuantitativoElemento {
  volumeConcretoM3: number;
  forma: ResultadoForma;
  concreto: ResultadoConcreto;
  armadura: ResultadoArmadura;
}

/**
 * Regra de fôrma por tipo de elemento: sapata e pilar de arranque assentam sobre
 * lastro/solo (sem fôrma no fundo, topo aberto); viga baldrame idem por padrão.
 * Ajuste aqui se a prática da obra for diferente (ex.: baldrame armado sobre escoramento).
 * Sapata com tronco de pirâmide (dado/pedestal) soma o volume/fôrma do bloco da base com
 * os do tronco.
 */
export function calcularQuantitativo(elemento: BimElement): QuantitativoElemento {
  const { geometria } = elemento;
  const baseVolumeM3 = geometria.comprimento * geometria.largura * geometria.altura;
  const baseForma = calcularForma(geometria.comprimento, geometria.largura, geometria.altura);

  let volumeConcretoM3 = baseVolumeM3;
  let forma = baseForma;

  if (elemento.tipo === 'sapata' && elemento.tronco) {
    const tronco = calcularTroncoPiramide(
      geometria.comprimento,
      geometria.largura,
      elemento.tronco.comprimento,
      elemento.tronco.largura,
      elemento.tronco.altura,
    );
    volumeConcretoM3 = baseVolumeM3 + tronco.volumeM3;
    forma = {
      comprimentoM: geometria.comprimento,
      larguraM: geometria.largura,
      alturaM: geometria.altura + elemento.tronco.altura,
      faces: [...baseForma.faces, ...tronco.faces],
      areaTotalM2: baseForma.areaTotalM2 + tronco.areaTotalM2,
    };
  }

  const concreto = calcularConcreto(volumeConcretoM3, elemento.traco);

  let armadura: ResultadoArmadura;
  if (elemento.armaduraImportada && elemento.armaduraImportada.length > 0) {
    armadura = totalizar(
      elemento.armaduraImportada.map((g) => ({
        descricao: `${g.descricao}`,
        quantidade: g.quantidade,
        diametroMm: g.diametroMm,
        comprimentoUnitarioM: g.comprimentoUnitarioM,
        comprimentoTotalM: g.comprimentoTotalM,
        pesoKg: g.pesoKg,
        volumeM3: g.volumeM3 ?? (g.pesoKg / DENSIDADE_ACO_KG_M3),
      })),
      'importada',
    );
  } else {
    switch (elemento.tipo) {
      case 'sapata':
        armadura = calcularArmaduraSapata(elemento.geometria, elemento.armadura);
        break;
      case 'pilar_arranque':
        armadura = calcularArmaduraPilar(elemento.geometria, elemento.armadura);
        break;
      case 'viga_baldrame':
        armadura = calcularArmaduraViga(elemento.geometria, elemento.armadura);
        break;
    }
  }

  return { volumeConcretoM3, forma, concreto, armadura };
}
