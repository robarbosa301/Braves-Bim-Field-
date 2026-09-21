import type { PilarArranque, Sapata, VigaBaldrame } from '../../types';
import { NumberField } from './NumberField';

export function SapataFields({ el, onChange }: { el: Sapata; onChange: (patch: Partial<Sapata>) => void }) {
  const g = el.geometria;
  const a = el.armadura;
  return (
    <>
      <fieldset className="group">
        <legend>Geometria (bloco da base)</legend>
        <NumberField label="Comprimento" suffix="m" value={g.comprimento} onChange={(v) => onChange({ geometria: { ...g, comprimento: v } })} />
        <NumberField label="Largura" suffix="m" value={g.largura} onChange={(v) => onChange({ geometria: { ...g, largura: v } })} />
        <NumberField label="Altura" suffix="m" value={g.altura} onChange={(v) => onChange({ geometria: { ...g, altura: v } })} />
      </fieldset>
      {el.tronco && (
        <fieldset className="group">
          <legend>Tronco de pirâmide (dado/pedestal)</legend>
          <NumberField
            label="Comprimento (topo)"
            suffix="m"
            value={el.tronco.comprimento}
            onChange={(v) => onChange({ tronco: { ...el.tronco!, comprimento: v } })}
          />
          <NumberField
            label="Largura (topo)"
            suffix="m"
            value={el.tronco.largura}
            onChange={(v) => onChange({ tronco: { ...el.tronco!, largura: v } })}
          />
          <NumberField
            label="Altura do tronco"
            suffix="m"
            value={el.tronco.altura}
            onChange={(v) => onChange({ tronco: { ...el.tronco!, altura: v } })}
          />
          <p className="hint">Vindo do sólido real do IFC — o pilar nasce nas dimensões do topo.</p>
        </fieldset>
      )}
      <fieldset className="group">
        <legend>Armadura (malha inferior)</legend>
        <NumberField label="⌀ direção X" suffix="mm" step={0.5} value={a.diametroX} onChange={(v) => onChange({ armadura: { ...a, diametroX: v } })} />
        <NumberField label="Espaçamento X" suffix="cm" value={a.espacamentoX} onChange={(v) => onChange({ armadura: { ...a, espacamentoX: v } })} />
        <NumberField label="⌀ direção Y" suffix="mm" step={0.5} value={a.diametroY} onChange={(v) => onChange({ armadura: { ...a, diametroY: v } })} />
        <NumberField label="Espaçamento Y" suffix="cm" value={a.espacamentoY} onChange={(v) => onChange({ armadura: { ...a, espacamentoY: v } })} />
        <NumberField label="Cobrimento" suffix="cm" value={a.cobrimento} onChange={(v) => onChange({ armadura: { ...a, cobrimento: v } })} />
        <NumberField label="Gancho" suffix="cm" value={a.gancho} onChange={(v) => onChange({ armadura: { ...a, gancho: v } })} />
      </fieldset>
    </>
  );
}

export function PilarFields({ el, onChange }: { el: PilarArranque; onChange: (patch: Partial<PilarArranque>) => void }) {
  const g = el.geometria;
  const a = el.armadura;
  return (
    <>
      <fieldset className="group">
        <legend>Geometria</legend>
        <NumberField label="Largura (seção)" suffix="m" value={g.largura} onChange={(v) => onChange({ geometria: { ...g, largura: v } })} />
        <NumberField label="Comprimento (seção)" suffix="m" value={g.comprimento} onChange={(v) => onChange({ geometria: { ...g, comprimento: v } })} />
        <NumberField label="Altura" suffix="m" value={g.altura} onChange={(v) => onChange({ geometria: { ...g, altura: v } })} />
      </fieldset>
      <fieldset className="group">
        <legend>Armadura</legend>
        <NumberField
          label="Qtd. longitudinais"
          suffix="un"
          step={1}
          min={4}
          value={a.longitudinais.quantidade}
          onChange={(v) => onChange({ armadura: { ...a, longitudinais: { ...a.longitudinais, quantidade: Math.max(4, Math.round(v)) } } })}
        />
        <NumberField
          label="⌀ longitudinais"
          suffix="mm"
          step={0.5}
          value={a.longitudinais.diametro}
          onChange={(v) => onChange({ armadura: { ...a, longitudinais: { ...a.longitudinais, diametro: v } } })}
        />
        <NumberField
          label="⌀ estribo"
          suffix="mm"
          step={0.5}
          value={a.estribo.diametro}
          onChange={(v) => onChange({ armadura: { ...a, estribo: { ...a.estribo, diametro: v } } })}
        />
        <NumberField
          label="Espaçamento estribo"
          suffix="cm"
          value={a.estribo.espacamento}
          onChange={(v) => onChange({ armadura: { ...a, estribo: { ...a.estribo, espacamento: v } } })}
        />
        <NumberField label="Cobrimento" suffix="cm" value={a.cobrimento} onChange={(v) => onChange({ armadura: { ...a, cobrimento: v } })} />
        <NumberField
          label="Ancoragem na sapata"
          suffix="cm"
          value={a.comprimentoAncoragem}
          onChange={(v) => onChange({ armadura: { ...a, comprimentoAncoragem: v } })}
        />
      </fieldset>
    </>
  );
}

export function VigaFields({ el, onChange }: { el: VigaBaldrame; onChange: (patch: Partial<VigaBaldrame>) => void }) {
  const g = el.geometria;
  const a = el.armadura;
  return (
    <>
      <fieldset className="group">
        <legend>Geometria</legend>
        <NumberField label="Comprimento" suffix="m" value={g.comprimento} onChange={(v) => onChange({ geometria: { ...g, comprimento: v } })} />
        <NumberField label="Largura" suffix="m" value={g.largura} onChange={(v) => onChange({ geometria: { ...g, largura: v } })} />
        <NumberField label="Altura" suffix="m" value={g.altura} onChange={(v) => onChange({ geometria: { ...g, altura: v } })} />
      </fieldset>
      <fieldset className="group">
        <legend>Armadura</legend>
        <NumberField
          label="Qtd. superior"
          suffix="un"
          step={1}
          min={2}
          value={a.superior.quantidade}
          onChange={(v) => onChange({ armadura: { ...a, superior: { ...a.superior, quantidade: Math.max(2, Math.round(v)) } } })}
        />
        <NumberField label="⌀ superior" suffix="mm" step={0.5} value={a.superior.diametro} onChange={(v) => onChange({ armadura: { ...a, superior: { ...a.superior, diametro: v } } })} />
        <NumberField
          label="Qtd. inferior"
          suffix="un"
          step={1}
          min={2}
          value={a.inferior.quantidade}
          onChange={(v) => onChange({ armadura: { ...a, inferior: { ...a.inferior, quantidade: Math.max(2, Math.round(v)) } } })}
        />
        <NumberField label="⌀ inferior" suffix="mm" step={0.5} value={a.inferior.diametro} onChange={(v) => onChange({ armadura: { ...a, inferior: { ...a.inferior, diametro: v } } })} />
        <NumberField label="⌀ estribo" suffix="mm" step={0.5} value={a.estribo.diametro} onChange={(v) => onChange({ armadura: { ...a, estribo: { ...a.estribo, diametro: v } } })} />
        <NumberField
          label="Espaçamento estribo"
          suffix="cm"
          value={a.estribo.espacamento}
          onChange={(v) => onChange({ armadura: { ...a, estribo: { ...a.estribo, espacamento: v } } })}
        />
        <NumberField label="Cobrimento" suffix="cm" value={a.cobrimento} onChange={(v) => onChange({ armadura: { ...a, cobrimento: v } })} />
        <NumberField label="Gancho" suffix="cm" value={a.gancho} onChange={(v) => onChange({ armadura: { ...a, gancho: v } })} />
      </fieldset>
    </>
  );
}
