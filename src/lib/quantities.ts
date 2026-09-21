import type { BimElement } from '../types';
import { calcularConcreto, calcularForma, DENSIDADE_ACO_KG_M3, ResultadoConcreto, ResultadoForma } from './concrete';
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
 */
export function calcularQuantitativo(elemento: BimElement): QuantitativoElemento {
  const { geometria } = elemento;
  const volumeConcretoM3 = geometria.comprimento * geometria.largura * geometria.altura;

  const forma = calcularForma(geometria.comprimento, geometria.largura, geometria.altura);
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
