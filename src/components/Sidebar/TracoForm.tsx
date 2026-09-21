import type { TracoConcreto } from '../../types';
import { NumberField } from './NumberField';

interface Props {
  traco: TracoConcreto;
  onChange: (traco: TracoConcreto) => void;
}

export function TracoForm({ traco, onChange }: Props) {
  return (
    <fieldset className="group">
      <legend>Traço do concreto (1 : areia : brita, em massa)</legend>
      <NumberField label="Areia" value={traco.areia} step={0.1} onChange={(v) => onChange({ ...traco, areia: v })} />
      <NumberField label="Brita" value={traco.brita} step={0.1} onChange={(v) => onChange({ ...traco, brita: v })} />
      <NumberField
        label="Fator água/cimento"
        value={traco.fatorAguaCimento}
        step={0.01}
        onChange={(v) => onChange({ ...traco, fatorAguaCimento: v })}
      />
      <NumberField
        label="Consumo de cimento (override manual)"
        value={traco.consumoCimentoKgM3Override ?? 0}
        step={1}
        suffix="kg/m³"
        onChange={(v) => onChange({ ...traco, consumoCimentoKgM3Override: v > 0 ? v : undefined })}
      />
      <p className="hint">
        Deixe o override em 0 para usar o cálculo teórico (método dos volumes absolutos). Preencha se a obra já
        tem um traço de referência em kg/m³ ou sacos/m³.
      </p>
    </fieldset>
  );
}
