import type { GrupoArmaduraResultado } from '../../types';

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
  cor: string;
}

/**
 * Representação genérica de um grupo de barras. Grupos de malha de sapata (o IFC soma as duas
 * direções — X e Y — num único grupo "Sapatas (...)") são desenhados como uma grade cruzada:
 * metade das barras correndo em X, metade em Z, com um pequeno desnível de ~1 diâmetro entre as
 * duas — igual ao corte real, onde uma direção sempre passa por cima da outra no cruzamento (não
 * são duas camadas separadas, é a mesma malha). Os demais grupos (longitudinais, estribos,
 * superior/inferior de viga — já unidirecionais) viram um feixe reto simples.
 */
export function GrupoArmaduraVisual({ grupo, comprimentoDisponivel, larguraDisponivel, cor }: Props) {
  const raio = grupo.diametroMm / 2000;
  const comprimentoBarra = Math.max(grupo.comprimentoUnitarioM, 0.05);
  const ehMalhaSapata = grupo.descricao.toLowerCase().includes('sapata');

  if (ehMalhaSapata) {
    const total = Math.max(2, Math.min(grupo.quantidade, MAX_BARRAS_VISUAL));
    const nX = Math.ceil(total / 2); // barras correndo ao longo de X, espaçadas em Z
    const nY = total - nX; // barras correndo ao longo de Z, espaçadas em X
    const zsX = posicoesEquidistantes(nX, larguraDisponivel * 0.85);
    const xsY = posicoesEquidistantes(nY, comprimentoDisponivel * 0.85);

    return (
      <group>
        {zsX.map((z, i) => (
          <mesh key={`x-${i}`} position={[0, 0, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[raio, raio, comprimentoBarra, 8]} />
            <meshStandardMaterial color={cor} />
          </mesh>
        ))}
        {xsY.map((x, i) => (
          <mesh key={`y-${i}`} position={[x, raio * 2.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[raio, raio, comprimentoBarra, 8]} />
            <meshStandardMaterial color={cor} />
          </mesh>
        ))}
      </group>
    );
  }

  const n = Math.max(1, Math.min(grupo.quantidade, MAX_BARRAS_VISUAL));
  const xs = posicoesEquidistantes(n, comprimentoDisponivel * 0.85);
  return (
    <group>
      {xs.map((x, i) => (
        <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[raio, raio, comprimentoBarra, 8]} />
          <meshStandardMaterial color={cor} />
        </mesh>
      ))}
    </group>
  );
}
