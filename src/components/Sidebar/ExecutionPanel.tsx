import { useState } from 'react';
import type { BimElement, IdEtapa } from '../../types';
import { useProjectStore } from '../../store/useProjectStore';

const NOMES_ETAPA: Record<IdEtapa, string> = {
  forma: 'Fôrma',
  armadura: 'Armação',
  concretagem: 'Concretagem',
};

export function ExecutionPanel({ elemento }: { elemento: BimElement }) {
  const marcarEtapa = useProjectStore((s) => s.marcarEtapa);
  const [volumeReal, setVolumeReal] = useState<Record<string, number>>({});

  return (
    <div className="execution-panel">
      {elemento.etapas.map((e) => (
        <div key={e.etapa} className={`etapa-row ${e.executado ? 'executado' : ''}`}>
          <label className="etapa-checkbox">
            <input
              type="checkbox"
              checked={e.executado}
              onChange={(ev) =>
                marcarEtapa(elemento.id, e.etapa, ev.target.checked, {
                  volumeRealM3: e.etapa === 'concretagem' ? volumeReal[elemento.id] : undefined,
                })
              }
            />
            <span>{NOMES_ETAPA[e.etapa]}</span>
          </label>
          {e.executado && <span className="etapa-data">executado em {e.dataExecucao}</span>}
          {e.etapa === 'concretagem' && (
            <input
              type="number"
              className="volume-real-input"
              placeholder="Vol. real (m³)"
              defaultValue={e.volumeRealM3 ?? ''}
              step={0.01}
              onChange={(ev) => setVolumeReal((v) => ({ ...v, [elemento.id]: parseFloat(ev.target.value) || 0 }))}
              onBlur={(ev) => {
                if (e.executado) {
                  marcarEtapa(elemento.id, 'concretagem', true, {
                    dataExecucao: e.dataExecucao,
                    volumeRealM3: parseFloat(ev.target.value) || 0,
                  });
                }
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
