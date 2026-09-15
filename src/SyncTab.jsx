import { useState, useEffect } from "react";
import { RefreshCw, FileJson, FileText, FileDown, CheckCircle2, ImagePlus, X, RectangleVertical, RectangleHorizontal } from "lucide-react";
import { C, mono } from "./theme.js";

// The Sincronização tab: manual sync trigger, JSON/CSV/PDF export, the
// carimbo (title block) identification fields used on the PDF's cover
// sheet, and the sync log — split out of App.jsx since it only needs these
// few pieces of state/callbacks from the parent.
export default function SyncTab({ syncing, runSync, exportJSON, exportCSV, exportPDF, pdfExporting, log, buildingInfo, onUpdateBuildingInfo, onLogoFileChange, pdfOrientation, onSetPdfOrientation }) {
  // CEP auto-fill, same lookup JoinScreen's own building step does at
  // project creation — this panel is the only place to fix or update that
  // address afterward, since the creation step never comes back around.
  const [cepStatus, setCepStatus] = useState("");
  useEffect(() => {
    const digits = (buildingInfo?.cep || "").replace(/\D/g, "");
    if (digits.length !== 8) { setCepStatus(""); return; }
    let cancelled = false;
    setCepStatus("buscando");
    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (data.erro) { setCepStatus("nao-encontrado"); return; }
        onUpdateBuildingInfo({
          street: data.logradouro || buildingInfo?.street || "",
          neighborhood: data.bairro || buildingInfo?.neighborhood || "",
          city: data.localidade || buildingInfo?.city || "",
          state: data.uf || buildingInfo?.state || "",
          country: "Brasil",
        });
        setCepStatus("ok");
      })
      .catch(() => { if (!cancelled) setCepStatus("nao-encontrado"); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingInfo?.cep]);

  return (
          <div>
            <div className="rounded-lg p-3 mb-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-[11px] mb-2" style={{ color: C.mute }}>DADOS DO IMÓVEL</div>
              <div className="space-y-2">
                <input placeholder="Nome do imóvel / projeto" value={buildingInfo?.name || ""}
                  onChange={e => onUpdateBuildingInfo({ name: e.target.value })}
                  className="w-full px-3 py-2 rounded text-xs" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
                <div className="relative">
                  <input placeholder="CEP" value={buildingInfo?.cep || ""} onChange={e => onUpdateBuildingInfo({ cep: e.target.value })}
                    className="w-full px-3 py-2 rounded text-xs" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
                  {cepStatus === "buscando" && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: C.mute }}>buscando…</span>}
                  {cepStatus === "ok" && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: C.chalk }}>✓ encontrado</span>}
                  {cepStatus === "nao-encontrado" && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: C.mute }}>não encontrado</span>}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input placeholder="Rua" value={buildingInfo?.street || ""} onChange={e => onUpdateBuildingInfo({ street: e.target.value })}
                    className="col-span-2 px-3 py-2 rounded text-xs" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
                  <input placeholder="Número" value={buildingInfo?.number || ""} onChange={e => onUpdateBuildingInfo({ number: e.target.value })}
                    className="px-3 py-2 rounded text-xs" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
                </div>
                <input placeholder="Bairro" value={buildingInfo?.neighborhood || ""} onChange={e => onUpdateBuildingInfo({ neighborhood: e.target.value })}
                  className="w-full px-3 py-2 rounded text-xs" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Cidade" value={buildingInfo?.city || ""} onChange={e => onUpdateBuildingInfo({ city: e.target.value })}
                    className="px-3 py-2 rounded text-xs" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
                  <input placeholder="Estado" value={buildingInfo?.state || ""} onChange={e => onUpdateBuildingInfo({ state: e.target.value })}
                    className="px-3 py-2 rounded text-xs" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="País" value={buildingInfo?.country || ""} onChange={e => onUpdateBuildingInfo({ country: e.target.value })}
                    className="px-3 py-2 rounded text-xs" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
                  <select value={buildingInfo?.type || "Residencial"} onChange={e => onUpdateBuildingInfo({ type: e.target.value })}
                    className="px-3 py-2 rounded text-xs" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
                    {["Residencial", "Comercial", "Industrial", "Institucional", "Misto"].map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="rounded-lg p-3 mb-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-[11px] mb-2" style={{ color: C.mute }}>CARIMBO DO PROJETO (aparece em todas as folhas do PDF)</div>
              <div className="space-y-2">
                <input placeholder="Projetista / responsável técnico" value={buildingInfo?.projetista || ""}
                  onChange={e => onUpdateBuildingInfo({ projetista: e.target.value })}
                  className="w-full px-3 py-2 rounded text-xs" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Registro (CREA/CAU)" value={buildingInfo?.projetistaRegistro || ""}
                    onChange={e => onUpdateBuildingInfo({ projetistaRegistro: e.target.value })}
                    className="px-3 py-2 rounded text-xs" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
                  <input placeholder="Empresa" value={buildingInfo?.empresa || ""}
                    onChange={e => onUpdateBuildingInfo({ empresa: e.target.value })}
                    className="px-3 py-2 rounded text-xs" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-2 rounded text-xs cursor-pointer shrink-0" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }}>
                    <ImagePlus size={13} color={C.gold} /> {buildingInfo?.logoDataUrl ? "Trocar logo" : "Adicionar logo"}
                    <input type="file" accept="image/*" onChange={onLogoFileChange} className="hidden" />
                  </label>
                  {buildingInfo?.logoDataUrl && (
                    <>
                      <img src={buildingInfo.logoDataUrl} alt="Logo da empresa" style={{ height: 28, width: "auto", maxWidth: 90, borderRadius: 4, background: "#fff", padding: 2, objectFit: "contain" }} />
                      <button onClick={() => onUpdateBuildingInfo({ logoDataUrl: null, logoW: null, logoH: null })} className="p-1 rounded shrink-0" style={{ color: C.muteDim }}>
                        <X size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
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
            <div className="rounded-lg p-3 mb-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-[11px] mb-2" style={{ color: C.mute }}>PLANTA DE SITUAÇÃO (mapa do endereço no PDF)</div>
              <input placeholder="Chave de API do Geoapify" value={buildingInfo?.siteMapApiKey || ""}
                onChange={e => onUpdateBuildingInfo({ siteMapApiKey: e.target.value.trim() })}
                className="w-full px-3 py-2 rounded text-xs mb-1.5" style={{ ...mono, background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
              <p className="text-[10px] leading-snug" style={{ color: C.muteDim }}>
                Sem essa chave, a planta de situação não entra no PDF (o resto do relatório sai normal). Crie uma gratuita em myprojects.geoapify.com — não pede cartão — e cole aqui. Fica salva com este levantamento.
              </p>
            </div>
            <div className="rounded-lg p-3 mb-3" style={{ background: C.panel, border: `1px solid ${C.line}` }}>
              <div className="text-[11px] mb-2" style={{ color: C.mute }}>OBSERVAÇÕES GERAIS (uma por linha, numeradas nos dados do levantamento)</div>
              <textarea rows={4} placeholder={"Ex.: Será instalado hidrômetro conforme padrão da concessionária\nCotas prevalecem sobre a escala\nAntes de iniciar a obra, verificar medidas in loco"}
                value={buildingInfo?.observacoes || ""} onChange={e => onUpdateBuildingInfo({ observacoes: e.target.value })}
                className="w-full px-3 py-2 rounded text-xs resize-y" style={{ background: C.panelAlt, color: C.chalk, border: `1px solid ${C.line}` }} />
            </div>
            <div className="flex gap-1.5 mb-2">
              <button onClick={() => onSetPdfOrientation("retrato")} className="flex-1 py-1.5 rounded text-[11px] flex items-center justify-center gap-1.5"
                style={{ background: pdfOrientation !== "paisagem" ? C.goldTint : C.panelAlt, color: pdfOrientation !== "paisagem" ? C.gold : C.mute, border: `1px solid ${pdfOrientation !== "paisagem" ? C.gold : C.line}` }}>
                <RectangleVertical size={13} /> Retrato
              </button>
              <button onClick={() => onSetPdfOrientation("paisagem")} className="flex-1 py-1.5 rounded text-[11px] flex items-center justify-center gap-1.5"
                style={{ background: pdfOrientation === "paisagem" ? C.goldTint : C.panelAlt, color: pdfOrientation === "paisagem" ? C.gold : C.mute, border: `1px solid ${pdfOrientation === "paisagem" ? C.gold : C.line}` }}>
                <RectangleHorizontal size={13} /> Paisagem
              </button>
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
