/**
 * Modelo de dados do MVP: Fundações (sapata isolada), Pilar de arranque e Viga baldrame.
 * Cada elemento carrega geometria, traço de concreto, armadura e etapas de execução
 * (previsto x executado), para permitir o controle 5D em campo.
 */

export type TipoElemento = 'sapata' | 'pilar_arranque' | 'viga_baldrame';

export type IdEtapa = 'forma' | 'armadura' | 'concretagem';

export interface EtapaExecucao {
  etapa: IdEtapa;
  dataPrevista?: string; // ISO date
  executado: boolean;
  dataExecucao?: string; // ISO date
  observacao?: string;
  /** Preenchido apenas na etapa de concretagem: volume de concreto realmente lançado (m³). */
  volumeRealM3?: number;
}

export function etapasIniciais(): EtapaExecucao[] {
  return [
    { etapa: 'forma', executado: false },
    { etapa: 'armadura', executado: false },
    { etapa: 'concretagem', executado: false },
  ];
}

/**
 * Traço de concreto em massa, unitário em relação ao cimento (1 : a : b),
 * com relação água/cimento (a/c). É o formato usado em dosagem racional
 * (NBR 12655) e permite calcular consumo de materiais por m³ com o método
 * dos volumes absolutos. Quem só conhece o traço "em volume" (ex.: 1:2:3
 * com padiola) pode preencher consumoCimentoKgM3Override com o valor de
 * uma tabela de referência da obra — nesse caso ele prevalece sobre o
 * cálculo teórico.
 */
export interface TracoConcreto {
  cimento: number; // sempre 1
  areia: number; // partes de areia por 1 de cimento (massa)
  brita: number; // partes de brita por 1 de cimento (massa)
  fatorAguaCimento: number; // a/c, ex. 0.55
  /** kg de cimento por m³ de concreto, se o usuário quiser sobrepor o cálculo teórico. */
  consumoCimentoKgM3Override?: number;
}

export const TRACO_PADRAO: TracoConcreto = {
  cimento: 1,
  areia: 2,
  brita: 3,
  fatorAguaCimento: 0.55,
};

export interface ArmaduraSapata {
  diametroX: number; // mm
  espacamentoX: number; // cm, entre eixos
  diametroY: number; // mm
  espacamentoY: number; // cm, entre eixos
  cobrimento: number; // cm
  gancho: number; // cm, comprimento do gancho em cada ponta da barra
}

export interface GrupoBarras {
  diametro: number; // mm
  quantidade: number;
}

export interface ArmaduraPilar {
  longitudinais: GrupoBarras;
  estribo: { diametro: number; espacamento: number }; // mm, cm
  cobrimento: number; // cm
  comprimentoAncoragem: number; // cm, embutido na sapata + gancho no topo
}

export interface ArmaduraViga {
  superior: GrupoBarras;
  inferior: GrupoBarras;
  estribo: { diametro: number; espacamento: number }; // mm, cm
  cobrimento: number; // cm
  gancho: number; // cm, comprimento do gancho longitudinal nas pontas
}

interface ElementoBase {
  id: string;
  tag: string; // identificação de campo, ex. "S1", "P3", "VB2"
  observacoes?: string;
  traco: TracoConcreto;
  etapas: EtapaExecucao[];
  /** Posição no canteiro, para posicionar no viewer 3D (m). */
  posicao: { x: number; y: number; z: number };
}

export interface Sapata extends ElementoBase {
  tipo: 'sapata';
  geometria: {
    comprimento: number; // m (eixo X)
    largura: number; // m (eixo Y)
    altura: number; // m (eixo Z)
  };
  armadura: ArmaduraSapata;
}

export interface PilarArranque extends ElementoBase {
  tipo: 'pilar_arranque';
  geometria: {
    largura: number; // m (eixo X)
    comprimento: number; // m (eixo Y) — para pilar retangular; quadrado se igual à largura
    altura: number; // m, do topo da sapata até o topo do arranque
  };
  armadura: ArmaduraPilar;
}

export interface VigaBaldrame extends ElementoBase {
  tipo: 'viga_baldrame';
  geometria: {
    comprimento: number; // m, vão
    largura: number; // m
    altura: number; // m
  };
  armadura: ArmaduraViga;
}

export type BimElement = Sapata | PilarArranque | VigaBaldrame;

export type CamadaVisivel = 'forma' | 'concreto' | 'armadura';
