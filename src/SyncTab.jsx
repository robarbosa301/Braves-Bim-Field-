import { RefreshCw, FileJson, FileText, FileDown, CheckCircle2 } from "lucide-react";
import { C, mono } from "./theme.js";

// The Sincronização tab: manual sync trigger, JSON/CSV/PDF export, and the
// sync log — split out of App.jsx since it only needs these few pieces
// of state/callbacks from the parent.
export default function SyncTab({ syncing, runSync, exportJSON, exportCSV, exportPDF, pdfExporting, log }) {
  return (
          <div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button onClick={runSync} disabled={syncing}
                className="py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
                style={{ background: syncing ? C.panelAlt : C.gold, color: "#141311", opacity: syncing ? 0.7 : 1 }}>
                <RefreshCw size={15} className={syncing ? "animate-spin" : ""} /> {syncing ? "Sincronizando…" : "Sincronizar agora"}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={exportJSON} className="py-3 rounded-lg text-xs flex flex-col items-center justify-center gap-1" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
                  <FileJson size={15} color={C.gold} /> JSON
                </button>
                <button onClick={exportCSV} className="py-3 rounded-lg text-xs flex flex-col items-center justify-center gap-1" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
                  <FileText size={15} color={C.gold} /> CSV
                </button>
              </div>
            </div>
            <button onClick={exportPDF} disabled={pdfExporting}
              className="w-full py-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 mb-3"
              style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}`, opacity: pdfExporting ? 0.7 : 1 }}>
              <FileDown size={15} color={C.gold} className={pdfExporting ? "animate-pulse" : ""} />
              {pdfExporting ? "Gerando PDF (planta + 3D)…" : "Exportar PDF (planta + 3D + dados)"}
            </button>
            <div className="rounded-lg p-3 mb-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-[11px] mb-2" style={{ color: C.mute }}>REGISTRO DE SINCRONIZAÇÃO</div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {log.map(entry => (
                  <div key={entry.id} className="flex items-start gap-2 text-[11px]">
                    <span style={{ ...mono, color: C.mute }}>{entry.t}</span>
                    <span style={{ color: entry.kind === "done" ? C.gold : entry.kind === "revit" || entry.kind === "cad" ? C.gold : C.chalk, flex: 1 }}>
                      {entry.kind === "done" && <CheckCircle2 size={11} className="inline mr-1" style={{ marginBottom: "1px" }} />}
                      {entry.msg}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <a href={`${import.meta.env.BASE_URL}privacidade.html`} target="_blank" rel="noopener noreferrer"
              className="block text-center text-[11px] py-2" style={{ color: C.muteDim }}>
              Política de Privacidade
            </a>
          </div>
  );
}
