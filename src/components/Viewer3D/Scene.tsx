import { useEffect, useRef } from 'react';
import { Grid, OrbitControls } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { BimElement, CamadaVisivel } from '../../types';
import { ElementMesh } from './ElementMesh';
import { ExplodedElementScene } from './ExplodedElementScene';

interface Props {
  elementos: BimElement[];
  camadas: Set<CamadaVisivel>;
  elementoSelecionadoId: string | null;
  onSelecionar: (id: string | null) => void;
  elementoIsolado: BimElement | null;
}

/**
 * Ao selecionar um elemento (clique no 3D ou na lista lateral), gira a câmera pra centralizar
 * nele — sem isso, um elemento selecionado longe do ponto onde a câmera já está olhando fica
 * destacado (contorno amarelo) mas fora do enquadramento, e passa despercebido.
 */
function FocoNaSelecao({ elementos, elementoSelecionadoId }: { elementos: BimElement[]; elementoSelecionadoId: string | null }) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const alvo = useRef<Vector3 | null>(null);

  useEffect(() => {
    const el = elementos.find((e) => e.id === elementoSelecionadoId);
    alvo.current = el ? new Vector3(el.posicao.x, el.posicao.y + el.geometria.altura / 2, el.posicao.z) : null;
  }, [elementoSelecionadoId, elementos]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls || !alvo.current) return;
    if (controls.target.distanceTo(alvo.current) < 0.01) {
      alvo.current = null;
      return;
    }
    controls.target.lerp(alvo.current, 0.12);
    controls.update();
  });

  return <OrbitControls ref={controlsRef} makeDefault />;
}

export function Scene({ elementos, camadas, elementoSelecionadoId, onSelecionar, elementoIsolado }: Props) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1} castShadow />
      <directionalLight position={[-5, 4, -5]} intensity={0.3} />

      {elementoIsolado ? (
        <>
          <ExplodedElementScene elemento={elementoIsolado} />
          <OrbitControls makeDefault />
        </>
      ) : (
        <>
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
          <FocoNaSelecao elementos={elementos} elementoSelecionadoId={elementoSelecionadoId} />
        </>
      )}
    </>
  );
}
