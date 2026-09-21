import { useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import type { BimElement } from '../../types';

const ROTULOS: Record<BimElement['tipo'], string> = {
  sapata: 'Sapata',
  pilar_arranque: 'Pilar de arranque',
  viga_baldrame: 'Viga baldrame',
};

function statusResumo(el: BimElement): string {
  const feitos = el.etapas.filter((e) => e.executado).length;
  return `${feitos}/${el.etapas.length}`;
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

      <ul>
        {elementos.map((el) => (
          <li
            key={el.id}
            className={el.id === selecionadoId ? 'selected' : ''}
            onClick={() => selecionar(el.id)}
          >
            <span className="tag">{el.tag}</span>
            <span className="tipo">{ROTULOS[el.tipo]}</span>
            <span className="status">{statusResumo(el)}</span>
          </li>
        ))}
        {elementos.length === 0 && <li className="empty">Nenhum elemento ainda. Adicione uma sapata para começar.</li>}
      </ul>
    </div>
  );
}
