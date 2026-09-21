import { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import type { BimElement } from '../../types';
import { ImportIfc } from './ImportIfc';

const ROTULOS: Record<BimElement['tipo'], string> = {
  sapata: 'Sapata',
  pilar_arranque: 'Pilar de arranque',
  viga_baldrame: 'Viga baldrame',
};

const ORDEM_TIPO: Record<BimElement['tipo'], number> = {
  sapata: 0,
  pilar_arranque: 1,
  viga_baldrame: 2,
};

function statusResumo(el: BimElement): string {
  const feitos = el.etapas.filter((e) => e.executado).length;
  return `${feitos}/${el.etapas.length}`;
}

function ordenar(elementos: BimElement[]): BimElement[] {
  return [...elementos].sort((a, b) => {
    if (a.tipo !== b.tipo) return ORDEM_TIPO[a.tipo] - ORDEM_TIPO[b.tipo];
    return a.tag.localeCompare(b.tag, 'pt-BR', { numeric: true });
  });
}

export function ElementList() {
  const elementos = useProjectStore((s) => s.elementos);
  const selecionadoId = useProjectStore((s) => s.elementoSelecionadoId);
  const selecionar = useProjectStore((s) => s.selecionarElemento);
  const adicionar = useProjectStore((s) => s.adicionarElemento);
  const [novaTag, setNovaTag] = useState('');

  function handleAdicionar(tipo: BimElement['tipo']) {
    const prefixo = tipo === 'sapata' ? 'S' : tipo === 'pilar_arranque' ? 'P' : 'VB';
    const tag = novaTag.trim() || `${prefixo}${elementos.length + 1}`;
    adicionar(tipo, tag);
    setNovaTag('');
  }

  return (
    <div className="element-list">
      <div className="add-row">
        <input
          placeholder="Identificação (ex. S1)"
          value={novaTag}
          onChange={(e) => setNovaTag(e.target.value)}
        />
        <div className="add-buttons">
          <button onClick={() => handleAdicionar('sapata')}>+ Sapata</button>
          <button onClick={() => handleAdicionar('pilar_arranque')}>+ Pilar</button>
          <button onClick={() => handleAdicionar('viga_baldrame')}>+ Viga baldrame</button>
        </div>
      </div>

      <ImportIfc />

      <ul>
        {ordenar(elementos).map((el) => (
          <li
            key={el.id}
            className={el.id === selecionadoId ? 'selected' : ''}
            onClick={() => selecionar(el.id)}
          >
            <span className="tag">
              {el.tag}
              {el.armaduraImportada && el.armaduraImportada.length > 0 && <span className="badge-ifc">IFC</span>}
            </span>
            <span className="tipo">{ROTULOS[el.tipo]}</span>
            <span className="status">{statusResumo(el)}</span>
          </li>
        ))}
        {elementos.length === 0 && <li className="empty">Nenhum elemento ainda. Adicione uma sapata ou importe um IFC.</li>}
      </ul>
    </div>
  );
}
