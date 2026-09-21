import { useState } from 'react';
import { useProjectStore } from './store/useProjectStore';
import { Viewer } from './components/Viewer3D/Viewer';
import { ElementList } from './components/Sidebar/ElementList';
import { ElementInspector } from './components/Sidebar/ElementInspector';
import { PainelResumo } from './components/Sidebar/PainelResumo';
import { LayerToggle } from './components/LayerToggle';
import type { CamadaVisivel } from './types';

export default function App() {
  const nomeObra = useProjectStore((s) => s.nomeObra);
  const setNomeObra = useProjectStore((s) => s.setNomeObra);
  const elementos = useProjectStore((s) => s.elementos);
  const elementoSelecionadoId = useProjectStore((s) => s.elementoSelecionadoId);
  const selecionarElemento = useProjectStore((s) => s.selecionarElemento);

  const [camadas, setCamadas] = useState<Set<CamadaVisivel>>(new Set(['forma', 'concreto', 'armadura']));
  const [modoIsolado, setModoIsolado] = useState(false);

  function toggleCamada(camada: CamadaVisivel) {
    setCamadas((prev) => {
      const next = new Set(prev);
      if (next.has(camada)) next.delete(camada);
      else next.add(camada);
      return next;
    });
  }

  const elementoSelecionado = elementos.find((e) => e.id === elementoSelecionadoId) ?? null;

  function selecionarEManterIsolado(id: string | null) {
    selecionarElemento(id);
    if (!id) setModoIsolado(false);
  }

  return (
    <div className="app">
      <header className="topbar">
        <input className="obra-nome" value={nomeObra} onChange={(e) => setNomeObra(e.target.value)} />
        <div className="topbar-right">
          {elementoSelecionado && (
            <button className={`toggle-isolado ${modoIsolado ? 'active' : ''}`} onClick={() => setModoIsolado((v) => !v)}>
              {modoIsolado ? '← Ver obra inteira' : 'Vista isolada / explodida'}
            </button>
          )}
          {!modoIsolado && <LayerToggle camadas={camadas} onToggle={toggleCamada} />}
        </div>
      </header>

      <div className="body">
        <aside className="sidebar-left">
          <ElementList />
        </aside>

        <main className="viewer-area">
          <Viewer
            elementos={elementos}
            camadas={camadas}
            elementoSelecionadoId={elementoSelecionadoId}
            onSelecionar={selecionarEManterIsolado}
            elementoIsolado={modoIsolado ? elementoSelecionado : null}
          />
        </main>

        <aside className="sidebar-right">
          {elementoSelecionado ? <ElementInspector elemento={elementoSelecionado} /> : <PainelResumo elementos={elementos} />}
        </aside>
      </div>
    </div>
  );
}
