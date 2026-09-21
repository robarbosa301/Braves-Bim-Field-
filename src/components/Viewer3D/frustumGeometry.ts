import * as THREE from 'three';

/**
 * Monta a geometria de um tronco de pirâmide reto de base retangular: um retângulo
 * comprimento×largura na base (y=0) afunilando para comprimentoTopo×larguraTopo no topo
 * (y=altura). Usado para o "dado"/pedestal da sapata.
 */
export function criarGeometriaTronco(
  comprimentoBase: number,
  larguraBase: number,
  comprimentoTopo: number,
  larguraTopo: number,
  altura: number,
  incluirTampas = true,
): THREE.BufferGeometry {
  const cb = comprimentoBase / 2;
  const lb = larguraBase / 2;
  const ct = comprimentoTopo / 2;
  const lt = larguraTopo / 2;

  // vértices: 0-3 base (y=0), 4-7 topo (y=altura), no sentido anti-horário visto de cima
  const positions = [
    [-cb, 0, -lb], [cb, 0, -lb], [cb, 0, lb], [-cb, 0, lb],
    [-ct, altura, -lt], [ct, altura, -lt], [ct, altura, lt], [-ct, altura, lt],
  ];

  const indices: number[] = [
    // frente (z negativo): base 0,1 / topo 4,5
    0, 1, 5, 0, 5, 4,
    // direita (x positivo): base 1,2 / topo 5,6
    1, 2, 6, 1, 6, 5,
    // fundo (z positivo): base 2,3 / topo 6,7
    2, 3, 7, 2, 7, 6,
    // esquerda (x negativo): base 3,0 / topo 7,4
    3, 0, 4, 3, 4, 7,
  ];
  if (incluirTampas) {
    indices.push(
      // base (y=0), normal pra baixo
      0, 2, 1, 0, 3, 2,
      // topo (y=altura), normal pra cima
      4, 5, 6, 4, 6, 7,
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions.flat(), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
