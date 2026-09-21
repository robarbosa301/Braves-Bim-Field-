import { Line, Html } from '@react-three/drei';

function formatarMedida(m: number): string {
  if (m >= 1) return `${m.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`;
  return `${Math.round(m * 1000)} mm`;
}

interface Props {
  /** Eixo ao longo do qual a medida corre — comprimento=X, altura=Y, largura=Z. */
  eixo: 'x' | 'y' | 'z';
  medidaM: number;
  /** Centro da linha de cota (já deslocado pra fora do volume medido). */
  offset: [number, number, number];
  rotulo?: string;
  cor?: string;
}

/** Linha de cota estilo desenho técnico: traço com marcas nas pontas + rótulo com a medida. */
export function CotaLinear({ eixo, medidaM, offset, rotulo, cor = '#67e8f9' }: Props) {
  const half = Math.max(medidaM, 0.001) / 2;
  const dir: [number, number, number] = eixo === 'x' ? [1, 0, 0] : eixo === 'y' ? [0, 1, 0] : [0, 0, 1];
  const p0: [number, number, number] = [offset[0] - dir[0] * half, offset[1] - dir[1] * half, offset[2] - dir[2] * half];
  const p1: [number, number, number] = [offset[0] + dir[0] * half, offset[1] + dir[1] * half, offset[2] + dir[2] * half];
  const tick = 0.04;
  const tickDir: [number, number, number] = eixo === 'y' ? [tick, 0, 0] : [0, tick, 0];
  const marca = (p: [number, number, number]): [number, number, number][] => [
    [p[0] - tickDir[0], p[1] - tickDir[1], p[2] - tickDir[2]],
    [p[0] + tickDir[0], p[1] + tickDir[1], p[2] + tickDir[2]],
  ];
  const texto = `${rotulo ? rotulo + ' ' : ''}${formatarMedida(medidaM)}`;

  return (
    <group>
      <Line points={[p0, p1]} color={cor} lineWidth={1} />
      <Line points={marca(p0)} color={cor} lineWidth={1} />
      <Line points={marca(p1)} color={cor} lineWidth={1} />
      <Html position={offset} center distanceFactor={7} occlude={false}>
        <div className="cota-3d">{texto}</div>
      </Html>
    </group>
  );
}

/**
 * Cotas de comprimento (X), largura (Z) e altura (Y) de um volume em caixa, deslocadas pra fora
 * dele. `espessuraTabua`, quando informada, soma uma 4ª cota mostrando a espessura da tábua da
 * fôrma (medida na quina, perpendicular à face) — as outras 3 já dão conta de cubo/tronco de
 * concreto, que não tem espessura de peça própria.
 */
export function CotasCaixa({
  comprimento,
  largura,
  altura,
  espessuraTabua,
  cor,
}: {
  comprimento: number;
  largura: number;
  altura: number;
  espessuraTabua?: number;
  cor?: string;
}) {
  const folga = 0.12;
  return (
    <group>
      <CotaLinear eixo="x" medidaM={comprimento} offset={[0, 0, -largura / 2 - folga]} rotulo="compr." cor={cor} />
      <CotaLinear eixo="z" medidaM={largura} offset={[comprimento / 2 + folga, 0, 0]} rotulo="larg." cor={cor} />
      <CotaLinear
        eixo="y"
        medidaM={altura}
        offset={[comprimento / 2 + folga, altura / 2, -largura / 2 - folga]}
        rotulo="alt."
        cor={cor}
      />
      {espessuraTabua !== undefined && (
        <CotaLinear
          eixo="z"
          medidaM={espessuraTabua}
          offset={[-comprimento / 2 - folga, altura + folga, largura / 2 + espessuraTabua / 2]}
          rotulo="esp. tábua"
          cor={cor}
        />
      )}
    </group>
  );
}
