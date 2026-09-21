import { Line } from '@react-three/drei';
import type { GrupoArmaduraResultado, TipoElemento } from '../../types';

function posicoesEquidistantes(qtd: number, vao: number): number[] {
  if (qtd <= 1) return [0];
  const passo = vao / (qtd - 1);
  return Array.from({ length: qtd }, (_, i) => -vao / 2 + i * passo);
}

/** Limite de barras desenhadas por grupo — grupos com 20-30 barras reais viram uma "amostra"
 * representativa, pra não virar uma parede sólida de cilindros. Os números reais vêm do rótulo. */
const MAX_BARRAS_VISUAL = 14;

interface Props {
  grupo: GrupoArmaduraResultado;
  comprimentoDisponivel: number; // extensão em X (m)
  larguraDisponivel: number; // extensão em Z (m)
  /** Altura real do elemento (m) — só usada pro laço do estribo de viga (largura × altura). */
  alturaElemento?: number;
  tipoElemento?: TipoElemento;
  cor: string;
}

function retanguloEstribo(w: number, h: number): [number, number, number][] {
  return [
    [-w / 2, 0, -h / 2],
    [w / 2, 0, -h / 2],
    [w / 2, 0, h / 2],
    [-w / 2, 0, h / 2],
    [-w / 2, 0, -h / 2],
  ];
}

/**
 * Representação de um grupo de barras já unidirecional. A malha do fundo da sapata (o IFC soma
 * as duas direções — ex. as posições N6/N7 do desenho — num único grupo "Sapatas (...)", sem
 * preservar os números de posição) chega aqui já separada por direção real na importação
 * (`separarPorDirecao`, em rebarExtract.ts), então cada grupo desta função é sempre um feixe de
 * barras paralelas correndo numa só direção: "direção X — comprimento" corre ao longo de X,
 * espaçada em Z; "direção Z — largura" corre ao longo de Z, espaçada em X. Os demais grupos
 * (longitudinais, superior/inferior de viga) já eram unidirecionais e usam o mesmo feixe ao longo
 * de X. Estribo é desenhado como o laço fechado real (não uma barra reta) — é a geometria que vai
 * pro canteiro, não uma barra solta.
 */
export function GrupoArmaduraVisual({ grupo, comprimentoDisponivel, larguraDisponivel, alturaElemento, tipoElemento, cor }: Props) {
  const raio = grupo.diametroMm / 2000;
  const comprimentoBarra = Math.max(grupo.comprimentoUnitarioM, 0.05);
  const desc = grupo.descricao.toLowerCase();
  const correEmZ = desc.includes('direção z');
  const n = Math.max(1, Math.min(grupo.quantidade, MAX_BARRAS_VISUAL));

  if (desc.includes('estribo')) {
    // laço do estribo, na seção real que ele abraça — pilar: a própria seção (comprimento ×
    // largura, plano XZ, igual à vista geral); viga: largura × altura (plano YZ, já que o
    // comprimento da viga é o vão, não faz parte do laço).
    const ehViga = tipoElemento === 'viga_baldrame';
    const [ladoX, ladoZ] = ehViga ? [alturaElemento ?? larguraDisponivel, larguraDisponivel] : [comprimentoDisponivel, larguraDisponivel];
    const laco = retanguloEstribo(Math.max(ladoX - 2 * raio, 0.05), Math.max(ladoZ - 2 * raio, 0.05));
    // Estribo real é bem menor que o vão do elemento — se espalhar os laços dentro do próprio
    // comprimentoDisponivel eles ficam maiores que o espaço entre eles e se sobrepõem, virando um
    // borrão. Espaça pelo próprio tamanho do laço (+ uma folga fixa) em vez do vão do elemento.
    const nEstribos = Math.max(1, Math.min(grupo.quantidade, 6));
    const passo = ladoX + 0.06;
    const vaoEstribos = (nEstribos - 1) * passo;
    const xs = posicoesEquidistantes(nEstribos, vaoEstribos);
    return (
      <group>
        {xs.map((x, i) => (
          <group key={i} position={[x, 0, 0]} rotation={ehViga ? [0, 0, Math.PI / 2] : [0, 0, 0]}>
            <Line points={laco} color={cor} lineWidth={2} />
          </group>
        ))}
      </group>
    );
  }

  if (correEmZ) {
    const xs = posicoesEquidistantes(n, comprimentoDisponivel * 0.85);
    return (
      <group>
        {xs.map((x, i) => (
          <mesh key={i} position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[raio, raio, comprimentoBarra, 8]} />
            <meshStandardMaterial color={cor} />
          </mesh>
        ))}
      </group>
    );
  }

  const zs = posicoesEquidistantes(n, larguraDisponivel * 0.85);
  return (
    <group>
      {zs.map((z, i) => (
        <mesh key={i} position={[0, 0, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[raio, raio, comprimentoBarra, 8]} />
          <meshStandardMaterial color={cor} />
        </mesh>
      ))}
    </group>
  );
}
