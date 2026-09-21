import { Grid, OrbitControls } from '@react-three/drei';
import type { BimElement, CamadaVisivel } from '../../types';
import { ElementMesh } from './ElementMesh';

interface Props {
  elementos: BimElement[];
  camadas: Set<CamadaVisivel>;
  elementoSelecionadoId: string | null;
  onSelecionar: (id: string | null) => void;
}

export function Scene({ elementos, camadas, elementoSelecionadoId, onSelecionar }: Props) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1} castShadow />
      <directionalLight position={[-5, 4, -5]} intensity={0.3} />
      <Grid
        args={[40, 40]}
        cellColor="#3a3f47"
        sectionColor="#565d66"
        fadeDistance={30}
        infiniteGrid
        position={[0, -0.001, 0]}
      />
      <group onPointerMissed={() => onSelecionar(null)}>
        {elementos.map((el) => (
          <ElementMesh
            key={el.id}
            elemento={el}
            camadas={camadas}
            selecionado={el.id === elementoSelecionadoId}
            onSelecionar={onSelecionar}
          />
        ))}
      </group>
      <OrbitControls makeDefault />
    </>
  );
}
