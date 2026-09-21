import type { BimElement, TipoElemento } from '../../types';
import { calcularResumoEtapa, type TotaisMateriais } from '../../lib/resumo';

const ROTULO_TIPO: Record<TipoElemento, string> = {
  sapata: 'Sapatas',
  pilar_arranque: 'Pilares',
  viga_baldrame: 'Vigas',
};

function n(v: number, casas = 2) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function LinhaTotais({ titulo, totais, destaque }: { titulo: string; totais: TotaisMateriais; destaque?: boolean }) {
  return (
    <tr className={destaque ? 'linha-destaque' : ''}>
      <td className="col-titulo">
        {titulo}
        <span className="col-qtd"> ({totais.quantidadeElementos})</span>
      </td>
      <td>{n(totais.volumeConcretoM3, 3)}</td>
      <td>{n(totais.areaFormaM2)}</td>
      <td>{n(totais.pesoAcoKg, 1)}</td>
      <td>{n(totais.cimentoSacos, 1)}</td>
    </tr>
  );
}

/**
 * Totais de material da etapa de fundação (hoje a única etapa do projeto): geral e por tipo de
 * elemento, pra saber quanto do total é sapata, quanto é pilar, quanto é viga. Aparece no lugar
 * do placeholder quando nada está selecionado.
 */
export function PainelResumo({ elementos }: { elementos: BimElement[] }) {
  if (elementos.length === 0) {
    return <div className="placeholder">Nenhum elemento ainda. Adicione uma sapata ou importe um IFC.</div>;
  }

  const resumo = calcularResumoEtapa(elementos);

  return (
    <div className="painel-resumo">
      <h3>Etapa: Fundação</h3>
      <p className="resumo-legenda">Sapatas, pilares de arranque e vigas baldrame — total da etapa e por tipo de elemento.</p>
      <table>
        <thead>
          <tr>
            <th>Elemento</th>
            <th>Concreto<br />m³</th>
            <th>Fôrma<br />m²</th>
            <th>Aço<br />kg</th>
            <th>Cimento<br />sacos</th>
          </tr>
        </thead>
        <tbody>
          {resumo.porTipo.map(({ tipo, totais }) => (
            <LinhaTotais key={tipo} titulo={ROTULO_TIPO[tipo]} totais={totais} />
          ))}
          <LinhaTotais titulo="Total" totais={resumo.total} destaque />
        </tbody>
      </table>
      <p className="resumo-nota">Areia: {n(resumo.total.areiaM3)} m³ · Brita: {n(resumo.total.britaM3)} m³</p>
    </div>
  );
}
