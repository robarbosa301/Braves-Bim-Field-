import { useRef, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { importarIfc } from '../../lib/ifc/importIfc';

export function ImportIfc() {
  const importarElementos = useProjectStore((s) => s.importarElementos);
  const elementosAtuais = useProjectStore((s) => s.elementos);
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleFile(file: File) {
    if (elementosAtuais.length > 0) {
      const ok = window.confirm(
        `Importar vai substituir os ${elementosAtuais.length} elemento(s) atuais do projeto. Continuar?`,
      );
      if (!ok) return;
    }
    setCarregando(true);
    setStatus(null);
    try {
      const texto = await file.text();
      const resultado = importarIfc(texto);
      importarElementos(resultado.elementos);
      const resumo = `Importados ${resultado.elementos.length} elementos do pavimento "${resultado.pavimentoUsado}".`;
      setStatus(resultado.avisos.length > 0 ? `${resumo} (${resultado.avisos.length} avisos)` : resumo);
    } catch (err) {
      setStatus(`Erro ao importar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="import-ifc">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={carregando}
        className="secondary"
      >
        {carregando ? 'Importando…' : 'Importar IFC'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".ifc"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      {status && <p className="hint">{status}</p>}
    </div>
  );
}
