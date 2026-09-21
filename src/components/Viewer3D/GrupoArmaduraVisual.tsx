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
  larguraDisponivel: number; // espaço (m) pra distribuir o feixe de barras
  cor: string;
}

/** Representação genérica de um grupo de barras (malha, longitudinais, estribos...): um feixe
 * de cilindros paralelos, um por barra (até um limite visual), com o diâmetro/comprimento reais. */
export function GrupoArmaduraVisual({ grupo, larguraDisponivel, cor }: Props) {
  const raio = grupo.diametroMm / 2000;
  const n = Math.max(1, Math.min(grupo.quantidade, MAX_BARRAS_VISUAL));
  const xs = posicoesEquidistantes(n, larguraDisponivel * 0.85);
  const comprimento = Math.max(grupo.comprimentoUnitarioM, 0.05);

  return (
    <group>
      {xs.map((x, i) => (
        <mesh key={i} position={[x, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[raio, raio, comprimento, 8]} />
          <meshStandardMaterial color={cor} />
        </mesh>
      ))}
    </group>
  );
}
