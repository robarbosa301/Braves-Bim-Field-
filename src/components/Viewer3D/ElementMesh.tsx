import type { ThreeEvent } from '@react-three/fiber';
import type { BimElement, CamadaVisivel } from '../../types';
import { ConcretoBox } from './ConcretoBox';
import { FormaBox } from './FormaBox';
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

  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    onSelecionar(elemento.id);
  }

  return (
    <group position={[elemento.posicao.x, elemento.posicao.y, elemento.posicao.z]} onClick={handleClick}>
      {camadas.has('concreto') && (
        <group>
          <ConcretoBox comprimento={comprimento} altura={altura} largura={largura} cor={corConcreto(elemento)} />
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
        <FormaBox comprimento={comprimento} altura={altura} largura={largura} cor={corForma(elemento)} />
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
    </group>
  );
}
