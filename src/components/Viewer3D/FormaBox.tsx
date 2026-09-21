const ESPESSURA_TABUA = 0.025; // m, ~2.5cm — só para representação visual da fôrma

interface Props {
  comprimento: number; // X
  altura: number; // Y
  largura: number; // Z
  cor: string;
  /** Afasta cada taipal do volume de concreto na direção da sua própria normal (m) — para a vista explodida. */
  explode?: number;
}

/** Fôrma de madeira: 4 taipais nas faces laterais, encostados no volume de concreto (ou afastados, se `explode`). */
export function FormaBox({ comprimento, altura, largura, cor, explode = 0 }: Props) {
  const material = <meshStandardMaterial color={cor} />;
  return (
    <group position={[0, altura / 2, 0]}>
      {/* frente / trás (perpendiculares a Z) */}
      <mesh position={[0, 0, largura / 2 + ESPESSURA_TABUA / 2 + explode]}>
        <boxGeometry args={[comprimento + 2 * ESPESSURA_TABUA, altura, ESPESSURA_TABUA]} />
        {material}
      </mesh>
      <mesh position={[0, 0, -largura / 2 - ESPESSURA_TABUA / 2 - explode]}>
        <boxGeometry args={[comprimento + 2 * ESPESSURA_TABUA, altura, ESPESSURA_TABUA]} />
        {material}
      </mesh>
      {/* esquerda / direita (perpendiculares a X) */}
      <mesh position={[comprimento / 2 + ESPESSURA_TABUA / 2 + explode, 0, 0]}>
        <boxGeometry args={[ESPESSURA_TABUA, altura, largura]} />
        {material}
      </mesh>
      <mesh position={[-comprimento / 2 - ESPESSURA_TABUA / 2 - explode, 0, 0]}>
        <boxGeometry args={[ESPESSURA_TABUA, altura, largura]} />
        {material}
      </mesh>
    </group>
  );
}
