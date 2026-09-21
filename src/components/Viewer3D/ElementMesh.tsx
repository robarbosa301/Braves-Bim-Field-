import type { ThreeEvent } from '@react-three/fiber';
import type { BimElement, CamadaVisivel } from '../../types';
import { ConcretoBox } from './ConcretoBox';
import { FormaBox } from './FormaBox';
import { TroncoConcreto, TroncoForma } from './TroncoMesh';
import { ArmaduraPilarMesh, ArmaduraSapataMesh, ArmaduraVigaMesh } from './ArmaduraMeshes';
import { corArmadura, corConcreto, corForma } from './statusColor';
import { Edges } from '@react-three/drei';

interface Props {
  elemento: BimElement;
  camadas: Set<CamadaVisivel>;
  selecionado: boolean;
  onSelecionar: (id: string) => void;
}

export function ElementMesh({ elemento, camadas, selecionado, onSelecionar }: Props) {
  const { geometria } = elemento;
  const comprimento = geometria.comprimento;
  const largura = geometria.largura;
  const altura = geometria.altura;
  const tronco = elemento.tipo === 'sapata' ? elemento.tronco : undefined;

  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    onSelecionar(elemento.id);
  }

  return (
    <group position={[elemento.posicao.x, elemento.posicao.y, elemento.posicao.z]} onClick={handleClick}>
      {camadas.has('concreto') && (
        <group>
          <ConcretoBox comprimento={comprimento} altura={altura} largura={largura} cor={corConcreto(elemento)} />
          {tronco && (
            <TroncoConcreto
              comprimentoBase={comprimento}
              larguraBase={largura}
              comprimentoTopo={tronco.comprimento}
              larguraTopo={tronco.largura}
              altura={tronco.altura}
              y0={altura}
              cor={corConcreto(elemento)}
            />
          )}
          {selecionado && (
            <mesh position={[0, altura / 2, 0]}>
              <boxGeometry args={[comprimento, altura, largura]} />
              <meshBasicMaterial visible={false} />
              <Edges color="#ffcc00" scale={1.002} />
            </mesh>
          )}
        </group>
      )}
      {camadas.has('forma') && (
        <group>
          <FormaBox comprimento={comprimento} altura={altura} largura={largura} cor={corForma(elemento)} />
          {tronco && (
            <TroncoForma
              comprimentoBase={comprimento}
              larguraBase={largura}
              comprimentoTopo={tronco.comprimento}
              larguraTopo={tronco.largura}
              altura={tronco.altura}
              y0={altura}
              cor={corForma(elemento)}
            />
          )}
        </group>
      )}
      {camadas.has('armadura') && elemento.tipo === 'sapata' && (
        <ArmaduraSapataMesh geometria={elemento.geometria} armadura={elemento.armadura} cor={corArmadura(elemento)} />
      )}
      {camadas.has('armadura') && elemento.tipo === 'pilar_arranque' && (
        <ArmaduraPilarMesh geometria={elemento.geometria} armadura={elemento.armadura} cor={corArmadura(elemento)} />
      )}
      {camadas.has('armadura') && elemento.tipo === 'viga_baldrame' && (
        <ArmaduraVigaMesh geometria={elemento.geometria} armadura={elemento.armadura} cor={corArmadura(elemento)} />
      )}
      {camadas.has('concreto') && elemento.tipo === 'pilar_arranque' && elemento.continuaAteM && (
        <mesh position={[0, altura + elemento.continuaAteM / 2, 0]}>
          <boxGeometry args={[comprimento, elemento.continuaAteM, largura]} />
          <meshStandardMaterial color="#6f7580" transparent opacity={0.55} />
        </mesh>
      )}
    </group>
  );
}
