import { Line } from '@react-three/drei';
import type { GrupoArmaduraResultado, TipoElemento } from '../../types';
import { pontosPerimetro } from './ArmaduraMeshes';

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
  /** Altura real do elemento (m) — pro laço do estribo de viga (largura × altura) e pro espalhamento vertical do estribo de pilar. */
  alturaElemento?: number;
  /** Espaçamento real do estribo, em cm (vindo do projeto/IFC) — se não vier, usa uma folga artificial. */
  espacamentoEstriboCm?: number;
  tipoElemento?: TipoElemento;
  cor: string;
}

const GANCHO_ESTRIBO_M = 0.06;

/** Laço fechado do estribo + a ponta do gancho (dobra) num dos cantos — geometria real de execução, não uma barra reta. */
function retanguloEstriboComGancho(w: number, h: number): [number, number, number][] {
  const c1: [number, number, number] = [-w / 2, 0, -h / 2];
  const c2: [number, number, number] = [w / 2, 0, -h / 2];
  const c3: [number, number, number] = [w / 2, 0, h / 2];
  const c4: [number, number, number] = [-w / 2, 0, h / 2];
  // gancho: continua na diagonal pra fora do canto onde o laço fecha (mesma direção do centro até o canto)
  const norma = Math.hypot(c1[0], c1[2]) || 1;
  const gancho: [number, number, number] = [c1[0] + (c1[0] / norma) * GANCHO_ESTRIBO_M, 0, c1[2] + (c1[2] / norma) * GANCHO_ESTRIBO_M];
  return [c1, c2, c3, c4, c1, gancho];
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
export function GrupoArmaduraVisual({
  grupo,
  comprimentoDisponivel,
  larguraDisponivel,
  alturaElemento,
  espacamentoEstriboCm,
  tipoElemento,
  cor,
}: Props) {
  const raio = grupo.diametroMm / 2000;
  const comprimentoBarra = Math.max(grupo.comprimentoUnitarioM, 0.05);
  const desc = grupo.descricao.toLowerCase();
  const correEmZ = desc.includes('direção z');
  const n = Math.max(1, Math.min(grupo.quantidade, MAX_BARRAS_VISUAL));

  if (desc.includes('estribo')) {
    const ehViga = tipoElemento === 'viga_baldrame';
    // Viga: os estribos correm em fila no eixo X (comprimento do vão), como são montados no
    // canteiro. Pilar: correm empilhados no eixo Y (altura), um acima do outro — o próprio laço
    // fica deitado no plano XZ, igual à vista geral, sem precisar girar.
    const [ladoX, ladoZ] = ehViga ? [alturaElemento ?? larguraDisponivel, larguraDisponivel] : [comprimentoDisponivel, larguraDisponivel];
    const laco = retanguloEstriboComGancho(Math.max(ladoX - 2 * raio, 0.05), Math.max(ladoZ - 2 * raio, 0.05));
    // Usa o espaçamento real do projeto quando disponível — senão (elemento sem esse dado ainda),
    // cai numa folga baseada no próprio tamanho do laço, só pra não sobrepor.
    const passoReal = espacamentoEstriboCm ? espacamentoEstriboCm / 100 : ladoX + 0.06;
    const nEstribos = Math.max(1, Math.min(grupo.quantidade, 10));
    const vaoEstribos = (nEstribos - 1) * passoReal;
    const posicoes = posicoesEquidistantes(nEstribos, vaoEstribos);
    return (
      <group>
        {posicoes.map((p, i) => (
          <group key={i} position={ehViga ? [p, 0, 0] : [0, p, 0]} rotation={ehViga ? [0, 0, Math.PI / 2] : [0, 0, 0]}>
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

  if (desc.includes('longitudinal') && tipoElemento === 'pilar_arranque') {
    // Pilar é vertical — a longitudinal corre em pé (eixo Y), distribuída no perímetro da seção,
    // igual a como fica montada de verdade (a gaiola), não deitada como na viga (horizontal).
    const larguraExibicao = Math.max(comprimentoDisponivel, 0.3);
    const alturaExibicao = Math.max(larguraDisponivel, 0.3);
    const pontos = pontosPerimetro(n, larguraExibicao, alturaExibicao);
    return (
      <group>
        {pontos.map(([x, z], i) => (
          <mesh key={i} position={[x, 0, z]}>
            <cylinderGeometry args={[raio, raio, comprimentoBarra, 8]} />
            <meshStandardMaterial color={cor} />
          </mesh>
        ))}
      </group>
    );
  }

  // Largura real (seção de pilar/viga) costuma ser bem menor que o comprimento total da cena
  // explodida — espalhar as barras só nessa largura verdadeira faz elas ficarem próximas demais
  // pra distinguir a essa escala (viram uma barra só, visualmente). Usa uma largura mínima de
  // exibição só pra separar as barras na tela; a largura real continua nas cotas e no card.
  const zs = posicoesEquidistantes(n, Math.max(larguraDisponivel, 0.3) * 0.85);
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
