import { v4 as uuidv4 } from 'uuid';
import { TRACO_PADRAO, etapasIniciais, type BimElement, type PilarArranque, type Sapata, type VigaBaldrame } from '../types';

export function novaSapata(tag: string, posicao = { x: 0, y: 0, z: 0 }): Sapata {
  return {
    id: uuidv4(),
    tipo: 'sapata',
    tag,
    posicao,
    traco: { ...TRACO_PADRAO },
    etapas: etapasIniciais(),
    geometria: { comprimento: 1.2, largura: 1.2, altura: 0.4 },
    armadura: {
      diametroX: 10,
      espacamentoX: 15,
      diametroY: 10,
      espacamentoY: 15,
      cobrimento: 5,
      gancho: 10,
    },
  };
}

export function novoPilarArranque(tag: string, posicao = { x: 0, y: 0, z: 0 }): PilarArranque {
  return {
    id: uuidv4(),
    tipo: 'pilar_arranque',
    tag,
    posicao,
    traco: { ...TRACO_PADRAO },
    etapas: etapasIniciais(),
    geometria: { largura: 0.2, comprimento: 0.2, altura: 0.6 },
    armadura: {
      longitudinais: { diametro: 10, quantidade: 4 },
      estribo: { diametro: 5, espacamento: 15 },
      cobrimento: 3,
      comprimentoAncoragem: 40,
    },
  };
}

export function novaVigaBaldrame(tag: string, posicao = { x: 0, y: 0, z: 0 }): VigaBaldrame {
  return {
    id: uuidv4(),
    tipo: 'viga_baldrame',
    tag,
    posicao,
    traco: { ...TRACO_PADRAO },
    etapas: etapasIniciais(),
    geometria: { comprimento: 3, largura: 0.2, altura: 0.3 },
    armadura: {
      superior: { diametro: 10, quantidade: 2 },
      inferior: { diametro: 10, quantidade: 2 },
      estribo: { diametro: 5, espacamento: 15 },
      cobrimento: 3,
      gancho: 8,
    },
  };
}

export function criarElementoPadrao(tipo: BimElement['tipo'], tag: string, posicao?: { x: number; y: number; z: number }): BimElement {
  switch (tipo) {
    case 'sapata':
      return novaSapata(tag, posicao);
    case 'pilar_arranque':
      return novoPilarArranque(tag, posicao);
    case 'viga_baldrame':
      return novaVigaBaldrame(tag, posicao);
  }
}
