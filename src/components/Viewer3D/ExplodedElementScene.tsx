import { Bounds, Html } from '@react-three/drei';
import type { BimElement } from '../../types';
import { calcularQuantitativo } from '../../lib/quantities';
import { ConcretoBox } from './ConcretoBox';
import { FormaBox } from './FormaBox';
import { TroncoConcreto, TroncoForma } from './TroncoMesh';
import { ArmaduraPilarMesh, ArmaduraSapataMesh, ArmaduraVigaMesh } from './ArmaduraMeshes';
import { corArmadura, corConcreto, corForma } from './statusColor';

function n(v: number, casas = 2) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function Rotulo({
  posicao,
  titulo,
  linhas,
}: {
  posicao: [number, number, number];
  titulo: string;
  linhas: string[];
}) {
  return (
    <Html position={posicao} center distanceFactor={6} occlude={false}>
      <div className="rotulo-3d">
        <strong>{titulo}</strong>
        {linhas.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </Html>
  );
}

function ArmaduraDoElemento({ elemento, cor }: { elemento: BimElement; cor: string }) {
  if (elemento.tipo === 'sapata') {
    return <ArmaduraSapataMesh geometria={elemento.geometria} armadura={elemento.armadura} cor={cor} />;
  }
  if (elemento.tipo === 'pilar_arranque') {
    return <ArmaduraPilarMesh geometria={elemento.geometria} armadura={elemento.armadura} cor={cor} />;
  }
  return <ArmaduraVigaMesh geometria={elemento.geometria} armadura={elemento.armadura} cor={cor} />;
}

/**
 * Vista isolada de um único elemento, em formato de explosão vertical: a fôrma de madeira
 * "abre" embaixo (os taipais se separam do volume), no meio fica a montagem da armadura, e o
 * concreto "sobe" por cima — cada camada com um rótulo mostrando seus quantitativos. A câmera
 * se ajusta sozinha (drei Bounds).
 */
export function ExplodedElementScene({ elemento }: { elemento: BimElement }) {
  const q = calcularQuantitativo(elemento);
  const { geometria } = elemento;
  const tronco = elemento.tipo === 'sapata' ? elemento.tronco : undefined;
  const alturaTotal = geometria.altura + (tronco?.altura ?? 0);
  const maiorDimensaoHoriz = Math.max(geometria.comprimento, geometria.largura, 0.3);
  const gap = Math.max(alturaTotal, maiorDimensaoHoriz) * 0.7 + 0.25;
  const explodeForma = 0.12 + maiorDimensaoHoriz * 0.15;
  const xRotulo = maiorDimensaoHoriz / 2 + explodeForma + 0.35;

  const yForma = 0;
  const yArmadura = yForma + alturaTotal + gap;
  const yConcreto = yArmadura + alturaTotal + gap;

  return (
    <Bounds fit clip observe margin={1.25} key={elemento.id}>
      <group>
        {/* Fôrma — taipais afastados do volume ("abertos") */}
        <group position={[0, yForma, 0]}>
          <FormaBox
            comprimento={geometria.comprimento}
            altura={geometria.altura}
            largura={geometria.largura}
            cor={corForma(elemento)}
            explode={explodeForma}
          />
          {tronco && (
            <TroncoForma
              comprimentoBase={geometria.comprimento}
              larguraBase={geometria.largura}
              comprimentoTopo={tronco.comprimento}
              larguraTopo={tronco.largura}
              altura={tronco.altura}
              y0={geometria.altura}
              cor={corForma(elemento)}
            />
          )}
          <Rotulo
            posicao={[xRotulo, alturaTotal / 2, 0]}
            titulo="Fôrma de madeira"
            linhas={[`${n(q.forma.areaTotalM2)} m² de área`, `${n(geometria.comprimento)} × ${n(geometria.largura)} × ${n(alturaTotal)} m`]}
          />
        </group>

        {/* Armadura — a montagem, flutuando no meio */}
        <group position={[0, yArmadura, 0]}>
          <ArmaduraDoElemento elemento={elemento} cor={corArmadura(elemento)} />
          <Rotulo
            posicao={[xRotulo, alturaTotal / 2, 0]}
            titulo="Armadura"
            linhas={
              q.armadura.grupos.length > 0
                ? q.armadura.grupos.map((g) => `${g.descricao}: ${g.quantidade}un · ${n(g.pesoKg, 1)}kg`)
                : ['sem barras']
            }
          />
        </group>

        {/* Concreto — "sobe" por cima de tudo */}
        <group position={[0, yConcreto, 0]}>
          <ConcretoBox comprimento={geometria.comprimento} altura={geometria.altura} largura={geometria.largura} cor={corConcreto(elemento)} />
          {tronco && (
            <TroncoConcreto
              comprimentoBase={geometria.comprimento}
              larguraBase={geometria.largura}
              comprimentoTopo={tronco.comprimento}
              larguraTopo={tronco.largura}
              altura={tronco.altura}
              y0={geometria.altura}
              cor={corConcreto(elemento)}
            />
          )}
          <Rotulo
            posicao={[xRotulo, alturaTotal / 2, 0]}
            titulo="Concreto"
            linhas={[
              `${n(q.volumeConcretoM3, 3)} m³`,
              `${n(q.concreto.cimentoSacos, 1)} sacos cimento`,
              `${n(q.concreto.areiaM3, 2)} m³ areia · ${n(q.concreto.britaM3, 2)} m³ brita`,
            ]}
          />
        </group>
      </group>
    </Bounds>
  );
}
