interface Props {
  comprimento: number; // X
  altura: number; // Y
  largura: number; // Z
  cor: string;
  opacidade?: number;
}

/** Volume de concreto do elemento, centrado verticalmente sobre a base do grupo pai. */
export function ConcretoBox({ comprimento, altura, largura, cor, opacidade = 1 }: Props) {
  return (
    <mesh position={[0, altura / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[comprimento, altura, largura]} />
      <meshStandardMaterial color={cor} transparent={opacidade < 1} opacity={opacidade} />
    </mesh>
  );
}
