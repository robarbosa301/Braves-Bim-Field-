import { useMemo, useState } from 'react';
import type { BimElement } from '../../types';
import { useProjectStore } from '../../store/useProjectStore';
import { calcularQuantitativo } from '../../lib/quantities';
import { NumberField } from './NumberField';
import { TracoForm } from './TracoForm';
import { QuantitiesPanel } from './QuantitiesPanel';
import { ExecutionPanel } from './ExecutionPanel';
import { PilarFields, SapataFields, VigaFields } from './GeometryArmaduraForms';

type Aba = 'editar' | 'quantitativos' | 'execucao';

export function ElementInspector({ elemento }: { elemento: BimElement }) {
  const atualizarElemento = useProjectStore((s) => s.atualizarElemento);
  const removerElemento = useProjectStore((s) => s.removerElemento);
  const [aba, setAba] = useState<Aba>('editar');

  const quantitativo = useMemo(() => calcularQuantitativo(elemento), [elemento]);

  function onChange(patch: Partial<BimElement>) {
    atualizarElemento(elemento.id, patch);
  }

  return (
    <div className="inspector">
      <div className="inspector-header">
        <input
          className="tag-input"
          value={elemento.tag}
          onChange={(e) => onChange({ tag: e.target.value })}
        />
        <button className="danger" onClick={() => removerElemento(elemento.id)}>
          Remover
        </button>
      </div>

      <div className="tabs">
        <button className={aba === 'editar' ? 'active' : ''} onClick={() => setAba('editar')}>
          Editar
        </button>
        <button className={aba === 'quantitativos' ? 'active' : ''} onClick={() => setAba('quantitativos')}>
          Quantitativos
        </button>
        <button className={aba === 'execucao' ? 'active' : ''} onClick={() => setAba('execucao')}>
          Execução
        </button>
      </div>

      {aba === 'editar' && (
        <div className="tab-content">
          <fieldset className="group">
            <legend>Posição no canteiro</legend>
            <NumberField label="X" suffix="m" value={elemento.posicao.x} onChange={(v) => onChange({ posicao: { ...elemento.posicao, x: v } })} />
            <NumberField label="Y (elevação)" suffix="m" value={elemento.posicao.y} onChange={(v) => onChange({ posicao: { ...elemento.posicao, y: v } })} />
            <NumberField label="Z" suffix="m" value={elemento.posicao.z} onChange={(v) => onChange({ posicao: { ...elemento.posicao, z: v } })} />
          </fieldset>

          {elemento.tipo === 'sapata' && <SapataFields el={elemento} onChange={onChange} />}
          {elemento.tipo === 'pilar_arranque' && <PilarFields el={elemento} onChange={onChange} />}
          {elemento.tipo === 'viga_baldrame' && <VigaFields el={elemento} onChange={onChange} />}

          <TracoForm traco={elemento.traco} onChange={(traco) => onChange({ traco })} />
        </div>
      )}

      {aba === 'quantitativos' && (
        <div className="tab-content">
          <QuantitiesPanel q={quantitativo} />
        </div>
      )}

      {aba === 'execucao' && (
        <div className="tab-content">
          <ExecutionPanel elemento={elemento} />
        </div>
      )}
    </div>
  );
}
