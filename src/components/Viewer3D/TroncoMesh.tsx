import { useMemo } from 'react';
import { DoubleSide } from 'three';
import { Edges } from '@react-three/drei';
import { criarGeometriaTronco } from './frustumGeometry';

const ESPESSURA_TABUA = 0.025; // m, mesma espessura usada em FormaBox

interface Props {
  comprimentoBase: number;
  larguraBase: number;
  comprimentoTopo: number;
  larguraTopo: number;
  altura: number;
  /** Altura (Y) onde a base do tronco começa — normalmente o topo do bloco da sapata. */
  y0: number;
  cor: string;
}

/** Volume de concreto do tronco de pirâmide (dado/pedestal) sobre a base da sapata. */
export function TroncoConcreto({ comprimentoBase, larguraBase, comprimentoTopo, larguraTopo, altura, y0, cor }: Props) {
  const geo = useMemo(
    () => criarGeometriaTronco(comprimentoBase, larguraBase, comprimentoTopo, larguraTopo, altura, true),
    [comprimentoBase, larguraBase, comprimentoTopo, larguraTopo, altura],
  );
  return (
    <mesh geometry={geo} position={[0, y0, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={cor} side={DoubleSide} />
      {/* aresta sempre visível — o afunilamento do tronco é sutil e some no volume geral da obra sem ela */}
      <Edges color="#000000" opacity={0.35} transparent scale={1} />
    </mesh>
  );
}

/** Fôrma de madeira do tronco: só as 4 faces laterais (trapézios), sem tampa de topo/fundo. */
export function TroncoForma({ comprimentoBase, larguraBase, comprimentoTopo, larguraTopo, altura, y0, cor }: Props) {
  const geo = useMemo(
    () =>
      criarGeometriaTronco(
        comprimentoBase + 2 * ESPESSURA_TABUA,
        larguraBase + 2 * ESPESSURA_TABUA,
        comprimentoTopo + 2 * ESPESSURA_TABUA,
        larguraTopo + 2 * ESPESSURA_TABUA,
        altura,
        false,
      ),
    [comprimentoBase, larguraBase, comprimentoTopo, larguraTopo, altura],
  );
  return (
    <mesh geometry={geo} position={[0, y0, 0]}>
      <meshStandardMaterial color={cor} side={DoubleSide} />
      <Edges color="#000000" opacity={0.35} transparent scale={1} />
    </mesh>
  );
}
