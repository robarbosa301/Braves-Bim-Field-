import { useEffect, useRef } from 'react';
import { Grid, OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
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
 * destacado (contorno amarelo) mas fora do enquadramento, e passa despercebido. Também ajusta a
 * distância da câmera pra uma faixa razoável pro tamanho do elemento — sem isso, um zoom que já
 * estava bem próximo (de olhar outra peça de perto) ficava "colado" ao trocar de elemento, e como
 * as peças no projeto real ficam a vários metros umas das outras, o resto da obra sumia ao fundo.
 */
function FocoNaSelecao({ elementos, elementoSelecionadoId }: { elementos: BimElement[]; elementoSelecionadoId: string | null }) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const alvo = useRef<Vector3 | null>(null);
  const distanciaAlvo = useRef<number | null>(null);
  const direcao = useRef(new Vector3(0.6, 0.5, 0.6).normalize());

  useEffect(() => {
    const el = elementos.find((e) => e.id === elementoSelecionadoId);
    if (!el) {
      alvo.current = null;
      return;
    }
    alvo.current = new Vector3(el.posicao.x, el.posicao.y + el.geometria.altura / 2, el.posicao.z);

    const controls = controlsRef.current;
    const distanciaAtual = controls ? camera.position.distanceTo(controls.target) : 0;
    if (distanciaAtual > 0.05) direcao.current.copy(camera.position).sub(controls!.target).normalize();

    const tamanho = Math.max(el.geometria.comprimento, el.geometria.largura, el.geometria.altura, 0.3);
    const distanciaIdeal = Math.min(Math.max(tamanho * 6, 2.5), 12);
    // só corrige o zoom se estiver bem fora da faixa razoável pro tamanho da peça — preserva o
    // zoom do usuário quando ele já está numa distância sensata.
    distanciaAlvo.current = distanciaAtual < distanciaIdeal * 0.4 || distanciaAtual > distanciaIdeal * 3 ? distanciaIdeal : null;
  }, [elementoSelecionadoId, elementos, camera]);

  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls || !alvo.current) return;
    const target = controls.target;
    target.lerp(alvo.current, 0.12);

    if (distanciaAlvo.current !== null) {
      const distanciaAtual = camera.position.distanceTo(target);
      const novaDistancia = distanciaAtual + (distanciaAlvo.current - distanciaAtual) * 0.12;
      camera.position.copy(target).addScaledVector(direcao.current, novaDistancia);
    }

    controls.update();

    const chegouAlvo = target.distanceTo(alvo.current) < 0.01;
    const chegouZoom = distanciaAlvo.current === null || Math.abs(camera.position.distanceTo(target) - distanciaAlvo.current) < 0.05;
    if (chegouAlvo && chegouZoom) {
      alvo.current = null;
      distanciaAlvo.current = null;
    }
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
