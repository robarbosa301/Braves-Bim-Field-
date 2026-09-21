import { Line } from '@react-three/drei';
import type { ArmaduraPilar, ArmaduraSapata, ArmaduraViga, PilarArranque, Sapata, VigaBaldrame } from '../../types';

function posicoesEquidistantes(qtd: number, vao: number): number[] {
  if (qtd <= 1) return [0];
  const passo = vao / (qtd - 1);
  return Array.from({ length: qtd }, (_, i) => -vao / 2 + i * passo);
}

/** Distribui n pontos ao longo do perímetro de um retângulo w x d, começando por um canto. */
function pontosPerimetro(n: number, w: number, d: number): [number, number][] {
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
}

/** Barras longitudinais ao redor do perímetro + estribos ao longo da altura do pilar. */
export function ArmaduraPilarMesh({ geometria, armadura, cor }: PilarProps) {
  const cobM = armadura.cobrimento / 100;
  // w = extensão em X, d = extensão em Z — mesma convenção do ConcretoBox (X=comprimento, Z=largura).
  const w = geometria.comprimento - 2 * cobM;
  const d = geometria.largura - 2 * cobM;
  const raio = armadura.longitudinais.diametro / 2000;
  const pontos = pontosPerimetro(armadura.longitudinais.quantidade, w, d);

  const qtdEstribos = Math.max(1, Math.floor((geometria.altura * 100) / armadura.estribo.espacamento) + 1);
  const alturasEstribo = posicoesEquidistantes(qtdEstribos, geometria.altura).map((v) => v + geometria.altura / 2);
  const retanguloEstribo: [number, number, number][] = [
    [-w / 2, 0, -d / 2],
    [w / 2, 0, -d / 2],
    [w / 2, 0, d / 2],
    [-w / 2, 0, d / 2],
    [-w / 2, 0, -d / 2],
  ];

  return (
    <group>
      {pontos.map(([x, z], i) => (
        <mesh key={`long-${i}`} position={[x, geometria.altura / 2, z]}>
          <cylinderGeometry args={[raio, raio, geometria.altura, 8]} />
          <meshStandardMaterial color={cor} />
        </mesh>
      ))}
      {alturasEstribo.map((y, i) => (
        <Line key={`estribo-${i}`} points={retanguloEstribo.map(([x, , z]) => [x, y, z])} color={cor} lineWidth={2} />
      ))}
    </group>
  );
}

interface VigaProps {
  geometria: VigaBaldrame['geometria'];
  armadura: ArmaduraViga;
  cor: string;
}

/** Barras longitudinais superior/inferior + estribos ao longo do comprimento da viga. */
export function ArmaduraVigaMesh({ geometria, armadura, cor }: VigaProps) {
  const cobM = armadura.cobrimento / 100;
  const comp = geometria.comprimento - 2 * cobM;
  const w = geometria.largura - 2 * cobM;

  const raioSup = armadura.superior.diametro / 2000;
  const raioInf = armadura.inferior.diametro / 2000;
  const ySup = geometria.altura - cobM;
  const yInf = cobM;

  const qtdEstribos = Math.max(1, Math.floor((geometria.comprimento - 2 * cobM) / (armadura.estribo.espacamento / 100)) + 1);
  const posEstribos = posicoesEquidistantes(qtdEstribos, comp);
  const alturaEstribo = geometria.altura - 2 * cobM;
  const retanguloEstribo: [number, number][] = [
    [-w / 2, -alturaEstribo / 2],
    [w / 2, -alturaEstribo / 2],
    [w / 2, alturaEstribo / 2],
    [-w / 2, alturaEstribo / 2],
    [-w / 2, -alturaEstribo / 2],
  ];

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
          points={retanguloEstribo.map(([z, y]) => [x, y + geometria.altura / 2, z])}
          color={cor}
          lineWidth={2}
        />
      ))}
    </group>
  );
}
