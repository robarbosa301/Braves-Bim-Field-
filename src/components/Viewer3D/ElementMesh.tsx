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

  // Altura total da peça (base + tronco + trecho de continuação, quando existem) — o destaque de
  // seleção envolve a peça inteira, não só o bloco da base, e fica visível em qualquer combinação
  // de camadas ligadas (não depende da camada Concreto estar ativa).
  const alturaTotalDestaque = altura + (tronco?.altura ?? 0) + (elemento.tipo === 'pilar_arranque' ? elemento.continuaAteM ?? 0 : 0);
  const folgaDestaque = 0.03;

  return (
    <group
      position={[elemento.posicao.x, elemento.posicao.y, elemento.posicao.z]}
      rotation={[0, elemento.rotacaoY ?? 0, 0]}
      onClick={handleClick}
    >
      {selecionado && (
        <mesh position={[0, alturaTotalDestaque / 2, 0]}>
          <boxGeometry
            args={[comprimento + folgaDestaque, alturaTotalDestaque + folgaDestaque, largura + folgaDestaque]}
          />
          <meshBasicMaterial visible={false} />
          <Edges color="#ffd23f" scale={1} />
        </mesh>
      )}
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
        <ArmaduraPilarMesh
          geometria={elemento.geometria}
          armadura={elemento.armadura}
          cor={corArmadura(elemento)}
          continuaAteM={elemento.continuaAteM}
        />
      )}
      {camadas.has('armadura') && elemento.tipo === 'viga_baldrame' && (
        <ArmaduraVigaMesh geometria={elemento.geometria} armadura={elemento.armadura} cor={corArmadura(elemento)} />
      )}
      {camadas.has('concreto') && elemento.tipo === 'pilar_arranque' && elemento.continuaAteM && (
        <group position={[0, altura, 0]}>
          <ConcretoBox comprimento={comprimento} altura={elemento.continuaAteM} largura={largura} cor={corConcreto(elemento)} />
        </group>
      )}
    </group>
  );
}
