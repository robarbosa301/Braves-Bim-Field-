import { useState, type ReactNode } from 'react';
import { Bounds, Html, Line } from '@react-three/drei';
import type { BimElement } from '../../types';
import { calcularQuantitativo } from '../../lib/quantities';
import { calcularConcreto, calcularForma, calcularTroncoPiramide } from '../../lib/concrete';
import { ConcretoBox } from './ConcretoBox';
import { FormaBox, ESPESSURA_TABUA } from './FormaBox';
import { TroncoConcreto, TroncoForma } from './TroncoMesh';
import { GrupoArmaduraVisual } from './GrupoArmaduraVisual';
import { CotaLinear, CotasCaixa } from './CotaLinear';
import { corArmadura, corConcreto, corForma } from './statusColor';

function n(v: number, casas = 2) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function RotuloCompacto({ posicao, texto, onClick }: { posicao: [number, number, number]; texto: string; onClick: () => void }) {
  return (
    <Html position={posicao} center distanceFactor={6} occlude={false}>
      <div className="rotulo-compacto-3d" onClick={onClick}>
        {texto}
      </div>
    </Html>
  );
}

function Rotulo({
  posicao,
  titulo,
  linhas,
  onClick,
}: {
  posicao: [number, number, number];
  titulo: string;
  linhas: string[];
  onClick?: () => void;
}) {
  return (
    <Html position={posicao} center distanceFactor={6} occlude={false}>
      <div className="rotulo-3d" onClick={onClick}>
        <strong>{titulo}</strong>
        {linhas.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </Html>
  );
}

interface NivelDef {
  altura: number;
  gapExtra?: number;
  /** Altura (Y) local, dentro do nível, onde a etiqueta/linha de chamada se ancora. */
  anchoraY: number;
  titulo: string;
  linhas: string[];
  /** Conteúdo 3D (malhas/cotas) — sem lidar com rótulo ou clique, isso a montagem final cuida. */
  conteudo: ReactNode;
}

/**
 * Vista isolada de um único elemento, em explosão vertical: cada sub-componente real do
 * elemento (o bloco da base e o tronco de pirâmide da sapata; cada grupo de armadura —
 * malha inferior/superior, longitudinais/estribos, superior/inferior/estribos da viga) fica
 * no seu próprio nível. Cada nível mostra só uma etiqueta compacta (peça + identificação do
 * elemento, ex. "S6 · Fôrma — bloco da base") por padrão, pra não poluir a visualização — clicar
 * na peça ou na etiqueta abre o card com os números, afastado e ligado por uma linha de chamada.
 * A câmera se ajusta sozinha (drei Bounds).
 */
export function ExplodedElementScene({ elemento }: { elemento: BimElement }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const q = calcularQuantitativo(elemento);
  const { geometria, tag } = elemento;
  const tronco = elemento.tipo === 'sapata' ? elemento.tronco : undefined;
  const larguraDisponivel = Math.max(geometria.comprimento, geometria.largura, 0.3);
  const slotAltura = Math.max(geometria.altura, tronco?.altura ?? 0, 0.35);
  const gap = slotAltura * 0.55 + 0.25;
  const xCompacto = larguraDisponivel / 2 + 0.2;
  const xDetalhe = larguraDisponivel / 2 + 1.4;

  const espacamentoEstriboCm =
    elemento.tipo === 'pilar_arranque' || elemento.tipo === 'viga_baldrame' ? elemento.armadura.estribo.espacamento : undefined;

  const formaBase = calcularForma(geometria.comprimento, geometria.largura, geometria.altura);
  const concretoBase = calcularConcreto(geometria.comprimento * geometria.largura * geometria.altura, elemento.traco);
  const troncoCalc = tronco
    ? calcularTroncoPiramide(geometria.comprimento, geometria.largura, tronco.comprimento, tronco.largura, tronco.altura)
    : undefined;
  const concretoTronco = troncoCalc ? calcularConcreto(troncoCalc.volumeM3, elemento.traco) : undefined;

  // Monta a pilha de níveis, de baixo pra cima: fôrma(s) -> cada grupo de armadura -> concreto(s).
  const niveis: NivelDef[] = [];

  niveis.push({
    altura: geometria.altura,
    conteudo: (
      <>
        <FormaBox comprimento={geometria.comprimento} altura={geometria.altura} largura={geometria.largura} cor={corForma(elemento)} explode={0.1} />
        <CotasCaixa comprimento={geometria.comprimento} largura={geometria.largura} altura={geometria.altura} espessuraTabua={ESPESSURA_TABUA} />
      </>
    ),
    anchoraY: geometria.altura / 2,
    titulo: tronco ? 'Fôrma — bloco da base' : 'Fôrma de madeira',
    linhas: [`${n(formaBase.areaTotalM2)} m² de área`, `${n(geometria.comprimento)} × ${n(geometria.largura)} × ${n(geometria.altura)} m`],
  });

  if (tronco && troncoCalc) {
    niveis.push({
      altura: tronco.altura,
      conteudo: (
        <>
          <TroncoForma comprimentoBase={geometria.comprimento} larguraBase={geometria.largura} comprimentoTopo={tronco.comprimento} larguraTopo={tronco.largura} altura={tronco.altura} y0={0} cor={corForma(elemento)} />
          <CotasCaixa comprimento={tronco.comprimento} largura={tronco.largura} altura={tronco.altura} espessuraTabua={ESPESSURA_TABUA} />
        </>
      ),
      anchoraY: tronco.altura / 2,
      titulo: 'Fôrma — tronco de pirâmide',
      linhas: [`${n(troncoCalc.areaTotalM2)} m² de área`, `topo ${n(tronco.comprimento)} × ${n(tronco.largura)} m, altura ${n(tronco.altura)} m`],
    });
  }

  for (const grupo of q.armadura.grupos) {
    const descLower = grupo.descricao.toLowerCase();
    const barraCorreEmZ = descLower.includes('direção z');
    const barraCorreEmY = descLower.includes('longitudinal') && elemento.tipo === 'pilar_arranque';
    niveis.push({
      altura: slotAltura,
      // grupos de armadura ficam mais espaçados entre si que fôrma/concreto — ajuda a
      // distinguir camadas parecidas, como as duas direções da malha inferior da sapata.
      gapExtra: gap * 1.1,
      conteudo: (
        <>
          <GrupoArmaduraVisual
            grupo={grupo}
            comprimentoDisponivel={geometria.comprimento}
            larguraDisponivel={geometria.largura}
            alturaElemento={geometria.altura}
            espacamentoEstriboCm={grupo.descricao.toLowerCase().includes('estribo') ? espacamentoEstriboCm : undefined}
            tipoElemento={elemento.tipo}
            cor={corArmadura(elemento)}
          />
          <CotaLinear
            eixo={barraCorreEmY ? 'y' : barraCorreEmZ ? 'z' : 'x'}
            medidaM={grupo.comprimentoUnitarioM}
            offset={
              barraCorreEmY
                ? [Math.max(geometria.comprimento, 0.3) / 2 + 0.15, 0, 0]
                : barraCorreEmZ
                  ? [geometria.comprimento / 2 + 0.12, 0.1, 0]
                  : [0, 0.1, -geometria.largura / 2 - 0.12]
            }
            rotulo={`⌀${n(grupo.diametroMm, 1)}mm`}
          />
        </>
      ),
      anchoraY: 0,
      titulo: grupo.descricao,
      linhas: [
        `${grupo.quantidade} barras · ⌀${n(grupo.diametroMm, 1)}mm`,
        `${n(grupo.comprimentoUnitarioM)} m linear/barra`,
        `${n(grupo.comprimentoTotalM)} m linear total · ${n(grupo.pesoKg, 1)} kg`,
      ],
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
    anchoraY: geometria.altura / 2,
    titulo: tronco ? 'Concreto — bloco da base' : 'Concreto',
    linhas: [
      `${n(geometria.comprimento * geometria.largura * geometria.altura, 3)} m³`,
      `${n(concretoBase.cimentoSacos, 1)} sacos cimento`,
      `${n(concretoBase.areiaM3, 2)} m³ areia · ${n(concretoBase.britaM3, 2)} m³ brita`,
    ],
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
      anchoraY: tronco.altura / 2,
      titulo: 'Concreto — tronco de pirâmide',
      linhas: [
        `${n(troncoCalc.volumeM3, 3)} m³`,
        `${n(concretoTronco.cimentoSacos, 1)} sacos cimento`,
        `${n(concretoTronco.areiaM3, 2)} m³ areia · ${n(concretoTronco.britaM3, 2)} m³ brita`,
      ],
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
        {posicionados.map((nivel, i) => {
          const selecionado = ativo === i;
          const anchor: [number, number, number] = [0, nivel.anchoraY, 0];
          const compacto: [number, number, number] = [xCompacto, nivel.anchoraY, 0];
          const detalhe: [number, number, number] = [xDetalhe, nivel.anchoraY, 0];
          const titulo = `${tag} · ${nivel.titulo}`;
          const alternar = () => setAtivo(selecionado ? null : i);
          return (
            <group key={i} position={[0, nivel.y, 0]}>
              <group
                onClick={(e) => {
                  e.stopPropagation();
                  alternar();
                }}
              >
                {nivel.conteudo}
              </group>
              <RotuloCompacto posicao={compacto} texto={titulo} onClick={alternar} />
              {selecionado && (
                <>
                  <Line points={[anchor, detalhe]} color="#7fa6f5" lineWidth={1} dashed dashSize={0.04} gapSize={0.04} />
                  <Rotulo posicao={detalhe} titulo={titulo} linhas={nivel.linhas} onClick={alternar} />
                </>
              )}
            </group>
          );
        })}
      </group>
    </Bounds>
  );
}
