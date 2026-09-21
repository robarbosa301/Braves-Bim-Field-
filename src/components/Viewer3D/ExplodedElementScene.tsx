import type { ReactNode } from 'react';
import { Bounds, Html } from '@react-three/drei';
import type { BimElement } from '../../types';
import { calcularQuantitativo } from '../../lib/quantities';
import { calcularConcreto, calcularForma, calcularTroncoPiramide } from '../../lib/concrete';
import { ConcretoBox } from './ConcretoBox';
import { FormaBox } from './FormaBox';
import { TroncoConcreto, TroncoForma } from './TroncoMesh';
import { GrupoArmaduraVisual } from './GrupoArmaduraVisual';
import { CotaLinear, CotasCaixa } from './CotaLinear';
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

/**
 * Vista isolada de um único elemento, em explosão vertical: cada sub-componente real do
 * elemento (o bloco da base e o tronco de pirâmide da sapata; cada grupo de armadura —
 * malha inferior/superior, longitudinais/estribos, superior/inferior/estribos da viga) fica
 * no seu próprio nível, com um rótulo mostrando só os números daquele pedaço. A câmera se
 * ajusta sozinha (drei Bounds).
 */
export function ExplodedElementScene({ elemento }: { elemento: BimElement }) {
  const q = calcularQuantitativo(elemento);
  const { geometria } = elemento;
  const tronco = elemento.tipo === 'sapata' ? elemento.tronco : undefined;
  const larguraDisponivel = Math.max(geometria.comprimento, geometria.largura, 0.3);
  const slotAltura = Math.max(geometria.altura, tronco?.altura ?? 0, 0.35);
  const gap = slotAltura * 0.55 + 0.25;
  const xRotulo = larguraDisponivel / 2 + 0.4;

  const formaBase = calcularForma(geometria.comprimento, geometria.largura, geometria.altura);
  const concretoBase = calcularConcreto(geometria.comprimento * geometria.largura * geometria.altura, elemento.traco);
  const troncoCalc = tronco
    ? calcularTroncoPiramide(geometria.comprimento, geometria.largura, tronco.comprimento, tronco.largura, tronco.altura)
    : undefined;
  const concretoTronco = troncoCalc ? calcularConcreto(troncoCalc.volumeM3, elemento.traco) : undefined;

  // Monta a pilha de níveis, de baixo pra cima: fôrma(s) -> cada grupo de armadura -> concreto(s).
  type Nivel = { altura: number; conteudo: ReactNode; rotulo: ReactNode; gapExtra?: number };
  const niveis: Nivel[] = [];

  niveis.push({
    altura: geometria.altura,
    conteudo: (
      <>
        <FormaBox comprimento={geometria.comprimento} altura={geometria.altura} largura={geometria.largura} cor={corForma(elemento)} explode={0.1} />
        <CotasCaixa comprimento={geometria.comprimento} largura={geometria.largura} altura={geometria.altura} />
      </>
    ),
    rotulo: (
      <Rotulo
        posicao={[xRotulo, geometria.altura / 2, 0]}
        titulo={tronco ? 'Fôrma — bloco da base' : 'Fôrma de madeira'}
        linhas={[`${n(formaBase.areaTotalM2)} m² de área`, `${n(geometria.comprimento)} × ${n(geometria.largura)} × ${n(geometria.altura)} m`]}
      />
    ),
  });

  if (tronco && troncoCalc) {
    niveis.push({
      altura: tronco.altura,
      conteudo: (
        <>
          <TroncoForma comprimentoBase={geometria.comprimento} larguraBase={geometria.largura} comprimentoTopo={tronco.comprimento} larguraTopo={tronco.largura} altura={tronco.altura} y0={0} cor={corForma(elemento)} />
          <CotasCaixa comprimento={tronco.comprimento} largura={tronco.largura} altura={tronco.altura} />
        </>
      ),
      rotulo: (
        <Rotulo
          posicao={[xRotulo, tronco.altura / 2, 0]}
          titulo="Fôrma — tronco de pirâmide"
          linhas={[`${n(troncoCalc.areaTotalM2)} m² de área`, `topo ${n(tronco.comprimento)} × ${n(tronco.largura)} m, altura ${n(tronco.altura)} m`]}
        />
      ),
    });
  }

  for (const grupo of q.armadura.grupos) {
    const barraCorreEmZ = grupo.descricao.toLowerCase().includes('direção z');
    niveis.push({
      altura: slotAltura,
      // grupos de armadura ficam um pouco mais espaçados entre si que fôrma/concreto — ajuda a
      // distinguir camadas parecidas, como as duas direções da malha inferior da sapata.
      gapExtra: gap * 0.6,
      conteudo: (
        <>
          <GrupoArmaduraVisual
            grupo={grupo}
            comprimentoDisponivel={geometria.comprimento}
            larguraDisponivel={geometria.largura}
            cor={corArmadura(elemento)}
          />
          <CotaLinear
            eixo={barraCorreEmZ ? 'z' : 'x'}
            medidaM={grupo.comprimentoUnitarioM}
            offset={
              barraCorreEmZ
                ? [geometria.comprimento / 2 + 0.12, 0.1, 0]
                : [0, 0.1, -geometria.largura / 2 - 0.12]
            }
            rotulo={`⌀${n(grupo.diametroMm, 1)}mm ·`}
          />
        </>
      ),
      rotulo: (
        <Rotulo
          posicao={[xRotulo, 0, 0]}
          titulo={grupo.descricao}
          linhas={[
            `${grupo.quantidade} barras · ⌀${n(grupo.diametroMm, 1)}mm`,
            `${n(grupo.comprimentoUnitarioM)} m/un`,
            `${n(grupo.comprimentoTotalM)} m total · ${n(grupo.pesoKg, 1)} kg`,
          ]}
        />
      ),
    });
  }

  niveis.push({
    altura: geometria.altura,
    conteudo: (
      <>
        <ConcretoBox comprimento={geometria.comprimento} altura={geometria.altura} largura={geometria.largura} cor={corConcreto(elemento)} />
        <CotasCaixa comprimento={geometria.comprimento} largura={geometria.largura} altura={geometria.altura} />
      </>
    ),
    rotulo: (
      <Rotulo
        posicao={[xRotulo, geometria.altura / 2, 0]}
        titulo={tronco ? 'Concreto — bloco da base' : 'Concreto'}
        linhas={[
          `${n(geometria.comprimento * geometria.largura * geometria.altura, 3)} m³`,
          `${n(concretoBase.cimentoSacos, 1)} sacos cimento`,
          `${n(concretoBase.areiaM3, 2)} m³ areia · ${n(concretoBase.britaM3, 2)} m³ brita`,
        ]}
      />
    ),
  });

  if (tronco && troncoCalc && concretoTronco) {
    niveis.push({
      altura: tronco.altura,
      conteudo: (
        <>
          <TroncoConcreto comprimentoBase={geometria.comprimento} larguraBase={geometria.largura} comprimentoTopo={tronco.comprimento} larguraTopo={tronco.largura} altura={tronco.altura} y0={0} cor={corConcreto(elemento)} />
          <CotasCaixa comprimento={tronco.comprimento} largura={tronco.largura} altura={tronco.altura} />
        </>
      ),
      rotulo: (
        <Rotulo
          posicao={[xRotulo, tronco.altura / 2, 0]}
          titulo="Concreto — tronco de pirâmide"
          linhas={[
            `${n(troncoCalc.volumeM3, 3)} m³`,
            `${n(concretoTronco.cimentoSacos, 1)} sacos cimento`,
            `${n(concretoTronco.areiaM3, 2)} m³ areia · ${n(concretoTronco.britaM3, 2)} m³ brita`,
          ]}
        />
      ),
    });
  }

  let yAtual = 0;
  const posicionados = niveis.map((nivel) => {
    const y = yAtual;
    yAtual += nivel.altura + gap + (nivel.gapExtra ?? 0);
    return { ...nivel, y };
  });

  return (
    <Bounds fit clip observe margin={1.25} key={elemento.id}>
      <group>
        {posicionados.map((nivel, i) => (
          <group key={i} position={[0, nivel.y, 0]}>
            {nivel.conteudo}
            {nivel.rotulo}
          </group>
        ))}
      </group>
    </Bounds>
  );
}
