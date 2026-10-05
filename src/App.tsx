import { useState } from 'react';
import { useProjectStore } from './store/useProjectStore';
import { Viewer } from './components/Viewer3D/Viewer';
import { ElementList } from './components/Sidebar/ElementList';
import { ElementInspector } from './components/Sidebar/ElementInspector';
import { PainelResumo } from './components/Sidebar/PainelResumo';
import { LayerToggle } from './components/LayerToggle';
import type { CamadaVisivel } from './types';

type TelaMobile = 'lista' | '3d' | 'detalhes';

const ABAS_MOBILE: { id: TelaMobile; rotulo: string; icone: JSX.Element }[] = [
  {
    id: 'lista',
    rotulo: 'Lista',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="4" y1="6" x2="20" y2="6" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="18" x2="14" y2="18" />
      </svg>
    ),
  },
  {
    id: '3d',
    rotulo: 'Obra 3D',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M12 3 L21 8 L21 16 L12 21 L3 16 L3 8 Z" />
        <path d="M3 8 L12 13 L21 8" />
        <path d="M12 13 L12 21" />
      </svg>
    ),
  },
  {
    id: 'detalhes',
    rotulo: 'Detalhes',
    icone: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <line x1="8" y1="8" x2="16" y2="8" />
        <line x1="8" y1="12" x2="16" y2="12" />
        <line x1="8" y1="16" x2="12" y2="16" />
      </svg>
    ),
  },
];

export default function App() {
  const nomeObra = useProjectStore((s) => s.nomeObra);
  const setNomeObra = useProjectStore((s) => s.setNomeObra);
  const elementos = useProjectStore((s) => s.elementos);
  const elementoSelecionadoId = useProjectStore((s) => s.elementoSelecionadoId);
  const selecionarElemento = useProjectStore((s) => s.selecionarElemento);

  const [camadas, setCamadas] = useState<Set<CamadaVisivel>>(new Set(['forma', 'concreto', 'armadura']));
  const [modoIsolado, setModoIsolado] = useState(false);
  // No celular/tablet, as 3 colunas (lista/3D/detalhes) viram telas cheias alternadas por uma
  // barra de abas embaixo, estilo app — em telas largas o CSS ignora isso e mostra as 3 juntas.
  const [telaMobile, setTelaMobile] = useState<TelaMobile>('3d');

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
    // Selecionar um elemento (lista ou clique no 3D) leva direto pra tela 3D no celular, pra
    // dar o mesmo retorno visual imediato que o layout de 3 colunas dá no desktop.
    setTelaMobile('3d');
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-identidade">
          {/* Identidade fixa do app (visualizador BIM 5D) — separada do nome da obra/projeto,
              que é editável. Esse app é uma ferramenta própria, não faz parte do Braves Minfield
              nem de qualquer outro app da Braves. */}
          <span className="app-nome">Vizion5</span>
          <input className="obra-nome" value={nomeObra} onChange={(e) => setNomeObra(e.target.value)} />
        </div>
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
        <aside className={`sidebar-left screen ${telaMobile === 'lista' ? 'screen--ativa' : ''}`}>
          <ElementList />
        </aside>

        <main className={`viewer-area screen ${telaMobile === '3d' ? 'screen--ativa' : ''}`}>
          <Viewer
            elementos={elementos}
            camadas={camadas}
            elementoSelecionadoId={elementoSelecionadoId}
            onSelecionar={selecionarEManterIsolado}
            elementoIsolado={modoIsolado ? elementoSelecionado : null}
          />
        </main>

        <aside className={`sidebar-right screen ${telaMobile === 'detalhes' ? 'screen--ativa' : ''}`}>
          {elementoSelecionado ? <ElementInspector elemento={elementoSelecionado} /> : <PainelResumo elementos={elementos} />}
        </aside>
      </div>

      <nav className="bottom-tabs">
        {ABAS_MOBILE.map((aba) => (
          <button
            key={aba.id}
            className={telaMobile === aba.id ? 'ativa' : ''}
            onClick={() => setTelaMobile(aba.id)}
          >
            {aba.icone}
            <span>{aba.rotulo}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
