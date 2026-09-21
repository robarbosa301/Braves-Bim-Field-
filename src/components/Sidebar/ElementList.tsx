import { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import type { BimElement, TipoElemento } from '../../types';
import { calcularQuantitativo } from '../../lib/quantities';
import { ImportIfc } from './ImportIfc';

const ROTULOS: Record<TipoElemento, string> = {
  sapata: 'Sapata',
  pilar_arranque: 'Pilar de arranque',
  viga_baldrame: 'Viga baldrame',
};

const ORDEM_TIPO: TipoElemento[] = ['sapata', 'pilar_arranque', 'viga_baldrame'];

function statusResumo(el: BimElement): string {
  const feitos = el.etapas.filter((e) => e.executado).length;
  return `${feitos}/${el.etapas.length}`;
}

function n(v: number) {
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function ordenarTags(elementos: BimElement[]): BimElement[] {
  return [...elementos].sort((a, b) => a.tag.localeCompare(b.tag, 'pt-BR', { numeric: true }));
}

export function ElementList() {
  const elementos = useProjectStore((s) => s.elementos);
  const selecionadoId = useProjectStore((s) => s.elementoSelecionadoId);
  const selecionar = useProjectStore((s) => s.selecionarElemento);
  const adicionar = useProjectStore((s) => s.adicionarElemento);
  const [novaTag, setNovaTag] = useState('');
  // Lista grande (dezenas de elementos importados) fica mais fácil de navegar agrupada por tipo,
  // com cada grupo retraível — por padrão retraído, só expande o que interessa no momento.
  const [expandido, setExpandido] = useState<Set<TipoElemento>>(new Set());

  function handleAdicionar(tipo: BimElement['tipo']) {
    const prefixo = tipo === 'sapata' ? 'S' : tipo === 'pilar_arranque' ? 'P' : 'VB';
    const tag = novaTag.trim() || `${prefixo}${elementos.length + 1}`;
    adicionar(tipo, tag);
    setNovaTag('');
  }

  // Selecionar um elemento pelo 3D (não pela lista) expande o grupo dele sozinho, senão o item
  // selecionado fica escondido atrás de um grupo retraído.
  useEffect(() => {
    const el = elementos.find((e) => e.id === selecionadoId);
    if (!el) return;
    setExpandido((prev) => (prev.has(el.tipo) ? prev : new Set(prev).add(el.tipo)));
  }, [selecionadoId, elementos]);

  function alternarGrupo(tipo: TipoElemento) {
    setExpandido((prev) => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo);
      else next.add(tipo);
      return next;
    });
  }

  const pesos = useMemo(() => {
    const m = new Map<string, number>();
    for (const el of elementos) m.set(el.id, calcularQuantitativo(el).pesoTotalKg);
    return m;
  }, [elementos]);

  const grupos = useMemo(() => {
    return ORDEM_TIPO.map((tipo) => {
      const doTipo = ordenarTags(elementos.filter((e) => e.tipo === tipo));
      const pesoTotal = doTipo.reduce((acc, el) => acc + (pesos.get(el.id) ?? 0), 0);
      return { tipo, elementos: doTipo, pesoTotal };
    }).filter((g) => g.elementos.length > 0);
  }, [elementos, pesos]);

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

      {grupos.map((g) => {
        const aberto = expandido.has(g.tipo);
        return (
          <div key={g.tipo} className="grupo-tipo">
            <button className="grupo-cabecalho" onClick={() => alternarGrupo(g.tipo)}>
              <span className={`seta ${aberto ? 'aberta' : ''}`}>▸</span>
              <span className="grupo-titulo">
                {ROTULOS[g.tipo]} <span className="grupo-qtd">({g.elementos.length})</span>
              </span>
              <span className="grupo-peso">{n(g.pesoTotal)} kg</span>
            </button>
            {aberto && (
              <ul>
                {g.elementos.map((el) => (
                  <li key={el.id} className={el.id === selecionadoId ? 'selected' : ''} onClick={() => selecionar(el.id)}>
                    <span className="tag">
                      {el.tag}
                      {el.armaduraImportada && el.armaduraImportada.length > 0 && <span className="badge-ifc">IFC</span>}
                    </span>
                    <span className="peso">{n(pesos.get(el.id) ?? 0)} kg</span>
                    <span className="status">{statusResumo(el)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {elementos.length === 0 && <p className="empty">Nenhum elemento ainda. Adicione uma sapata ou importe um IFC.</p>}
    </div>
  );
}
