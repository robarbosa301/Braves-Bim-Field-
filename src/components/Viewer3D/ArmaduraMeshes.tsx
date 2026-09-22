import { Line } from '@react-three/drei';
import type { ArmaduraPilar, ArmaduraSapata, ArmaduraViga, PilarArranque, Sapata, VigaBaldrame } from '../../types';

function posicoesEquidistantes(qtd: number, vao: number): number[] {
  if (qtd <= 1) return [0];
  const passo = vao / (qtd - 1);
  return Array.from({ length: qtd }, (_, i) => -vao / 2 + i * passo);
}

/** Distribui n pontos ao longo do perímetro de um retângulo w x d, começando por um canto. */
export function pontosPerimetro(n: number, w: number, d: number): [number, number][] {
  const perimetro = 2 * (w + d);
  const pontos: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    let s = (i * perimetro) / n;
    let x: number, z: number;
    if (s <= w) {
      x = -w / 2 + s;
      z = -d / 2;
    } else if (s <= w + d) {
      s -= w;
      x = w / 2;
      z = -d / 2 + s;
    } else if (s <= 2 * w + d) {
      s -= w + d;
      x = w / 2 - s;
      z = d / 2;
    } else {
      s -= 2 * w + d;
      x = -w / 2;
      z = d / 2 - s;
    }
    pontos.push([x, z]);
  }
  return pontos;
}

interface SapataProps {
  geometria: Sapata['geometria'];
  armadura: ArmaduraSapata;
  cor: string;
}

/** Malha inferior de armadura da sapata: barras cruzadas em X e Y. */
export function ArmaduraSapataMesh({ geometria, armadura, cor }: SapataProps) {
  const cobM = armadura.cobrimento / 100;
  const y = cobM;
  const raioX = armadura.diametroX / 2000;
  const raioY = armadura.diametroY / 2000;
  const compX = geometria.comprimento - 2 * cobM;
  const compY = geometria.largura - 2 * cobM;
  const qtdX = Math.max(1, Math.floor((geometria.largura - 2 * cobM) / (armadura.espacamentoX / 100)) + 1);
  const qtdY = Math.max(1, Math.floor((geometria.comprimento - 2 * cobM) / (armadura.espacamentoY / 100)) + 1);

  return (
    <group>
      {posicoesEquidistantes(qtdX, geometria.largura - 2 * cobM).map((z, i) => (
        <mesh key={`x-${i}`} position={[0, y, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[raioX, raioX, compX, 8]} />
          <meshStandardMaterial color={cor} />
        </mesh>
      ))}
      {posicoesEquidistantes(qtdY, geometria.comprimento - 2 * cobM).map((x, i) => (
        <mesh key={`y-${i}`} position={[x, y + raioX + raioY, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[raioY, raioY, compY, 8]} />
          <meshStandardMaterial color={cor} />
        </mesh>
      ))}
    </group>
  );
}

interface PilarProps {
  geometria: PilarArranque['geometria'];
  armadura: ArmaduraPilar;
  cor: string;
  /** Trecho do pilar acima da altura própria (lance fora do escopo) que continua até a face
   * superior da viga baldrame — quando existe, a armadura longitudinal e os estribos acompanham
   * o pilar até lá, preenchendo o mesmo volume que o concreto (ver ElementMesh). */
  continuaAteM?: number;
  /** Quantidade real de estribos do projeto (do IFC), quando disponível — usada no lugar da
   * contagem reconstruída a partir do espaçamento, pra o 3D bater exatamente com o projeto. */
  qtdEstriboReal?: number;
}

/** Comprimento visual do "pé" do gancho de ancoragem (só ilustrativo — não é uma cota de projeto). */
const GANCHO_ANCORAGEM_M = 0.12;
/** Comprimento visual da dobra do gancho do estribo, na diagonal do canto onde o laço fecha. */
const GANCHO_ESTRIBO_M = 0.06;

/** Retângulo fechado (laço) do estribo em coordenadas locais (u,v) + a ponta do gancho/dobra num
 * dos cantos — geometria real de execução (o estribo é um laço fechado com dobra, não uma barra
 * reta), igual ao usado na vista explodida. */
function pontosEstriboComGancho(w: number, h: number): [number, number][] {
  const c1: [number, number] = [-w / 2, -h / 2];
  const c2: [number, number] = [w / 2, -h / 2];
  const c3: [number, number] = [w / 2, h / 2];
  const c4: [number, number] = [-w / 2, h / 2];
  const norma = Math.hypot(c1[0], c1[1]) || 1;
  const gancho: [number, number] = [c1[0] + (c1[0] / norma) * GANCHO_ESTRIBO_M, c1[1] + (c1[1] / norma) * GANCHO_ESTRIBO_M];
  return [c1, c2, c3, c4, c1, gancho];
}

/**
 * Barras longitudinais ao redor do perímetro + estribos ao longo da altura do pilar, mais a
 * ancoragem na sapata: cada barra longitudinal desce `comprimentoAncoragem` abaixo da base do
 * pilar (dentro do volume da sapata) e faz um gancho em L na ponta — é essa ancoragem que
 * amarra o pilar de arranque à armadura da sapata. Quando o pilar continua até a viga
 * (`continuaAteM`), a barra e os estribos acompanham esse trecho, chegando até a face superior
 * da viga junto com o concreto.
 */
export function ArmaduraPilarMesh({ geometria, armadura, cor, continuaAteM = 0, qtdEstriboReal }: PilarProps) {
  const cobM = armadura.cobrimento / 100;
  // w = extensão em X, d = extensão em Z — mesma convenção do ConcretoBox (X=comprimento, Z=largura).
  const w = geometria.comprimento - 2 * cobM;
  const d = geometria.largura - 2 * cobM;
  const raio = armadura.longitudinais.diametro / 2000;
  const pontos = pontosPerimetro(armadura.longitudinais.quantidade, w, d);
  const ancoragemM = armadura.comprimentoAncoragem / 100;

  const alturaTotalPilar = geometria.altura + continuaAteM;
  // Quando vem do IFC, usa a quantidade real de estribos do projeto (não uma reconstrução a
  // partir do espaçamento, que arredondava pra baixo e podia mostrar a menos que o real). O
  // espaçamento real (armadura.estribo.espacamento) ainda dá o ritmo de mais quantos estribos
  // entram no trecho de continuação até a viga, que é fora do escopo importado.
  const passoRealM = armadura.estribo.espacamento / 100;
  const qtdEstribosBase = qtdEstriboReal ?? Math.max(1, Math.round(geometria.altura / passoRealM) + 1);
  const qtdEstribosExtra = continuaAteM > 0 ? Math.max(0, Math.round(continuaAteM / passoRealM)) : 0;
  const qtdEstribos = qtdEstribosBase + qtdEstribosExtra;
  const alturasEstribo = posicoesEquidistantes(qtdEstribos, alturaTotalPilar).map((v) => v + alturaTotalPilar / 2);
  const lacoEstribo = pontosEstriboComGancho(w, d);

  const topoBarraM = geometria.altura + continuaAteM;
  const alturaTotalBarra = topoBarraM + ancoragemM;
  const centroYBarra = topoBarraM - alturaTotalBarra / 2;

  return (
    <group>
      {pontos.map(([x, z], i) => {
        const raioRadial = Math.hypot(x, z) || 1;
        const dirX = x / raioRadial;
        const dirZ = z / raioRadial;
        const yPe = -ancoragemM;
        // Dobra em L do gancho de ancoragem: segmento horizontal sólido (mesmo raio da barra),
        // não uma linha fina — é a geometria de execução real, embutida na sapata.
        const ganchoMeioX = x + (dirX * GANCHO_ANCORAGEM_M) / 2;
        const ganchoMeioZ = z + (dirZ * GANCHO_ANCORAGEM_M) / 2;
        const anguloGancho = Math.atan2(dirZ, -dirX);
        return (
          <group key={`long-${i}`}>
            <mesh position={[x, centroYBarra, z]}>
              <cylinderGeometry args={[raio, raio, alturaTotalBarra, 8]} />
              <meshStandardMaterial color={cor} />
            </mesh>
            <mesh position={[ganchoMeioX, yPe, ganchoMeioZ]} rotation={[0, anguloGancho, Math.PI / 2]}>
              <cylinderGeometry args={[raio, raio, GANCHO_ANCORAGEM_M, 8]} />
              <meshStandardMaterial color={cor} />
            </mesh>
          </group>
        );
      })}
      {alturasEstribo.map((y, i) => (
        <group key={`estribo-${i}`} position={[0, y, 0]}>
          <Line points={lacoEstribo.map(([u, v]) => [u, 0, v] as [number, number, number])} color={cor} lineWidth={2} />
        </group>
      ))}
    </group>
  );
}

interface VigaProps {
  geometria: VigaBaldrame['geometria'];
  armadura: ArmaduraViga;
  cor: string;
  /** Quantidade real de estribos do projeto (do IFC), quando disponível — usada no lugar da
   * contagem reconstruída a partir do espaçamento, pra o 3D bater exatamente com o projeto. */
  qtdEstriboReal?: number;
}

/** Barras longitudinais superior/inferior + estribos ao longo do comprimento da viga. */
export function ArmaduraVigaMesh({ geometria, armadura, cor, qtdEstriboReal }: VigaProps) {
  const cobM = armadura.cobrimento / 100;
  const comp = geometria.comprimento - 2 * cobM;
  const w = geometria.largura - 2 * cobM;

  const raioSup = armadura.superior.diametro / 2000;
  const raioInf = armadura.inferior.diametro / 2000;
  const ySup = geometria.altura - cobM;
  const yInf = cobM;

  const qtdEstribos =
    qtdEstriboReal ?? Math.max(1, Math.floor((geometria.comprimento - 2 * cobM) / (armadura.estribo.espacamento / 100)) + 1);
  const posEstribos = posicoesEquidistantes(qtdEstribos, comp);
  const alturaEstribo = geometria.altura - 2 * cobM;
  const lacoEstribo = pontosEstriboComGancho(w, alturaEstribo);

  return (
    <group>
      {posicoesEquidistantes(armadura.superior.quantidade, w).map((z, i) => (
        <mesh key={`sup-${i}`} position={[0, ySup, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[raioSup, raioSup, comp, 8]} />
          <meshStandardMaterial color={cor} />
        </mesh>
      ))}
      {posicoesEquidistantes(armadura.inferior.quantidade, w).map((z, i) => (
        <mesh key={`inf-${i}`} position={[0, yInf, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[raioInf, raioInf, comp, 8]} />
          <meshStandardMaterial color={cor} />
        </mesh>
      ))}
      {posEstribos.map((x, i) => (
        <Line
          key={`estribo-${i}`}
          points={lacoEstribo.map(([z, y]) => [x, y + geometria.altura / 2, z] as [number, number, number])}
          color={cor}
          lineWidth={2}
        />
      ))}
    </group>
  );
}
