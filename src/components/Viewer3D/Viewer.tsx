import { Canvas } from '@react-three/fiber';
import type { BimElement, CamadaVisivel } from '../../types';
import { Scene } from './Scene';

interface Props {
  elementos: BimElement[];
  camadas: Set<CamadaVisivel>;
  elementoSelecionadoId: string | null;
  onSelecionar: (id: string | null) => void;
  elementoIsolado: BimElement | null;
}

export function Viewer({ elementos, camadas, elementoSelecionadoId, onSelecionar, elementoIsolado }: Props) {
  return (
    <Canvas shadows camera={{ position: [4, 3, 4], fov: 45 }}>
      <color attach="background" args={['#1b1e22']} />
      <Scene
        elementos={elementos}
        camadas={camadas}
        elementoSelecionadoId={elementoSelecionadoId}
        onSelecionar={onSelecionar}
        elementoIsolado={elementoIsolado}
      />
    </Canvas>
  );
}
