using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Architecture;
using Autodesk.Revit.DB.Structure;

namespace BravesBimFieldImporter
{
    public class ImportResult
    {
        public int Niveis, Paredes, Portas, Janelas, Ambientes;

        // Counts openings where no loaded Revit family/type really matched the
        // surveyed "tipo"/"folhas" — a generic stand-in was used instead. The
        // real values are never lost even then: they're written to each
        // element's "Comentários" field. See PickBestSymbol/SetSurveyComments.
        public int PortasParaRevisar, JanelasParaRevisar;

        public override string ToString()
        {
            string revisar = (PortasParaRevisar + JanelasParaRevisar) > 0
                ? $"\n\n⚠ {PortasParaRevisar + JanelasParaRevisar} porta(s)/janela(s) sem família correspondente no projeto — " +
                  "o tipo/folhas real do levantamento foi gravado no campo \"Comentários\" de cada uma; ajuste a família manualmente."
                : "";
            return $"{Niveis} nível(is)\n{Paredes} parede(s)\n{Portas} porta(s)\n{Janelas} janela(s)\n{Ambientes} ambiente(s)" + revisar;
        }
    }

    // Shared by both the file-based and the cloud-based (Firestore) import
    // commands. v1 scope: Levels, Walls, Doors, Windows, Rooms (from closed
    // "ambiente" outlines drawn in the app's Croqui). Roofs, stairs and
    // luminárias are in the schema but not created yet — future work.
    public static class LevantamentoImporter
    {
        public static ImportResult Importar(Document doc, LevantamentoSchema schema)
        {
            if (schema?.niveis == null || schema.niveis.Count == 0)
                throw new InvalidOperationException("O levantamento não contém níveis para importar.");

            var result = new ImportResult { Niveis = schema.niveis.Count };

            using (Transaction tx = new Transaction(doc, "Importar levantamento Braves BIM Field"))
            {
                tx.Start();
                try
                {
                    var levelIdByNivelId = MapOrCreateLevels(doc, schema.niveis);

                    ElementId defaultWallTypeId = doc.GetDefaultElementTypeId(ElementTypeGroup.WallType);
                    Dictionary<string, ElementId> wallTypesByName = new FilteredElementCollector(doc)
                        .OfClass(typeof(WallType)).Cast<WallType>()
                        .GroupBy(w => w.Name, StringComparer.OrdinalIgnoreCase)
                        .ToDictionary(g => g.Key, g => g.First().Id, StringComparer.OrdinalIgnoreCase);

                    // Cache every loaded door/window type once — each opening below picks
                    // whichever of these best matches its own "tipo"/"folhas" (e.g. a
                    // "Correr — alumínio" door with folhas=4 favors a loaded type whose
                    // family/type name mentions "correr" and "4 folhas"), instead of the
                    // previous behavior of using just the first loaded type for everything.
                    List<FamilySymbol> doorSymbols = new FilteredElementCollector(doc)
                        .OfClass(typeof(FamilySymbol)).OfCategory(BuiltInCategory.OST_Doors)
                        .Cast<FamilySymbol>().ToList();
                    List<FamilySymbol> windowSymbols = new FilteredElementCollector(doc)
                        .OfClass(typeof(FamilySymbol)).OfCategory(BuiltInCategory.OST_Windows)
                        .Cast<FamilySymbol>().ToList();

                    // Pass 1: walls (so pass 2 has a host wall to place doors/windows on).
                    var wallIdByParedeId = new Dictionary<string, ElementId>();
                    foreach (NivelInfo nivel in schema.niveis)
                    {
                        ElementId levelId = levelIdByNivelId[nivel.id];
                        double defaultHeightFeet = MetersToFeet(nivel.pe_direito_padrao_m > 0 ? nivel.pe_direito_padrao_m : 2.8);

                        foreach (ParedeInfo parede in nivel.paredes ?? new List<ParedeInfo>())
                        {
                            XYZ p1 = new XYZ(MetersToFeet(parede.x1), MetersToFeet(parede.y1), 0);
                            XYZ p2 = new XYZ(MetersToFeet(parede.x2), MetersToFeet(parede.y2), 0);
                            if (p1.DistanceTo(p2) < 0.01) continue;

                            ElementId wallTypeId = (!string.IsNullOrEmpty(parede.tipo) && wallTypesByName.TryGetValue(parede.tipo, out ElementId wtId))
                                ? wtId : defaultWallTypeId;
                            double heightFeet = parede.altura_m > 0 ? MetersToFeet(parede.altura_m) : defaultHeightFeet;

                            Wall wall = Wall.Create(doc, Line.CreateBound(p1, p2), wallTypeId, levelId, heightFeet, 0, false, false);
                            SetMark(wall, parede.tag);
                            wallIdByParedeId[parede.id] = wall.Id;
                            result.Paredes++;
                        }
                    }

                    doc.Regenerate();

                    // Pass 2: doors, windows, rooms.
                    foreach (NivelInfo nivel in schema.niveis)
                    {
                        Level level = doc.GetElement(levelIdByNivelId[nivel.id]) as Level;

                        foreach (PortaInfo porta in nivel.portas ?? new List<PortaInfo>())
                        {
                            FamilySymbol doorSymbol = PickBestSymbol(doorSymbols, porta.tipo, porta.folhas, out bool doorMatched);
                            if (doorSymbol == null || !wallIdByParedeId.TryGetValue(porta.parede_id, out ElementId hostId)) continue;
                            Wall host = doc.GetElement(hostId) as Wall;
                            XYZ pos = new XYZ(MetersToFeet(porta.x), MetersToFeet(porta.y), level.Elevation);
                            // If this 5-arg overload (location, symbol, host, level, structuralType) doesn't
                            // resolve for your Revit API version, drop `level` — the 4-arg host overload
                            // (location, symbol, host, structuralType) hosts it on the wall just as well.
                            FamilyInstance inst = doc.Create.NewFamilyInstance(pos, doorSymbol, host, level, StructuralType.NonStructural);
                            TrySetDimension(inst, new[] { "Height", "Altura", "Altura da porta" }, porta.altura_m);
                            TrySetDimension(inst, new[] { "Width", "Largura", "Largura da porta" }, porta.largura_m);
                            SetMark(inst, porta.tag);
                            SetSurveyComments(inst, porta.tipo, porta.folhas, porta.largura_m, porta.altura_m, null, doorMatched);
                            if (!doorMatched) result.PortasParaRevisar++;
                            result.Portas++;
                        }

                        foreach (JanelaInfo janela in nivel.janelas ?? new List<JanelaInfo>())
                        {
                            FamilySymbol windowSymbol = PickBestSymbol(windowSymbols, janela.tipo, janela.folhas, out bool windowMatched);
                            if (windowSymbol == null || !wallIdByParedeId.TryGetValue(janela.parede_id, out ElementId hostId)) continue;
                            Wall host = doc.GetElement(hostId) as Wall;
                            double sillFeet = MetersToFeet(janela.peitoril_m);
                            XYZ pos = new XYZ(MetersToFeet(janela.x), MetersToFeet(janela.y), level.Elevation + sillFeet);
                            FamilyInstance inst = doc.Create.NewFamilyInstance(pos, windowSymbol, host, level, StructuralType.NonStructural);
                            TrySetDimension(inst, new[] { "Height", "Altura", "Altura da janela" }, janela.altura_m);
                            TrySetDimension(inst, new[] { "Width", "Largura", "Largura da janela" }, janela.largura_m);
                            SetMark(inst, janela.tag);
                            SetSurveyComments(inst, janela.tipo, janela.folhas, janela.largura_m, janela.altura_m, janela.peitoril_m, windowMatched);
                            if (!windowMatched) result.JanelasParaRevisar++;
                            result.Janelas++;
                        }

                        foreach (AmbienteCroquiInfo ambiente in nivel.ambientes_croqui ?? new List<AmbienteCroquiInfo>())
                        {
                            if (ambiente.pontos == null || ambiente.pontos.Count < 3) continue;
                            double cx = ambiente.pontos.Average(p => p.x);
                            double cy = ambiente.pontos.Average(p => p.y);
                            try
                            {
                                Room room = doc.Create.NewRoom(level, new UV(MetersToFeet(cx), MetersToFeet(cy)));
                                if (room != null)
                                {
                                    if (!string.IsNullOrEmpty(ambiente.nome))
                                        room.get_Parameter(BuiltInParameter.ROOM_NAME)?.Set(ambiente.nome);
                                    result.Ambientes++;
                                }
                            }
                            catch
                            {
                                // No closed wall loop at this point yet (e.g. missing wall) — skip rather than fail the whole import.
                            }
                        }
                    }

                    tx.Commit();
                }
                catch
                {
                    tx.RollBack();
                    throw;
                }
            }

            return result;
        }

        private static Dictionary<string, ElementId> MapOrCreateLevels(Document doc, List<NivelInfo> niveis)
        {
            var existing = new FilteredElementCollector(doc).OfClass(typeof(Level)).Cast<Level>().ToList();
            var result = new Dictionary<string, ElementId>();

            foreach (NivelInfo nivel in niveis)
            {
                double elevFeet = MetersToFeet(nivel.cota_m);
                double toleranceFeet = MetersToFeet(0.05);

                Level match = existing.FirstOrDefault(l =>
                    string.Equals(l.Name, nivel.nome, StringComparison.OrdinalIgnoreCase) ||
                    Math.Abs(l.Elevation - elevFeet) < toleranceFeet);

                if (match == null)
                {
                    match = Level.Create(doc, elevFeet);
                    match.Name = nivel.nome;
                    existing.Add(match);
                }

                result[nivel.id] = match.Id;
            }

            return result;
        }

        // Picks whichever loaded family/type best matches the surveyed opening's
        // "tipo" (e.g. "Correr — alumínio") and panel count ("folhas"), by keyword
        // overlap against the family+type name. This is necessarily best-effort:
        // the add-in can't invent a 4-panel sliding door family that isn't loaded
        // in the target Revit project. For reliable matches, load (or rename) door/
        // window types in your template so their names mention the opening style
        // (e.g. "correr") and panel count (e.g. "4 folhas") — same idea as the
        // exact-name matching already used for wall types.
        // `matched` tells the caller whether the chosen family/type actually looks
        // like the surveyed opening (true), or is just a fallback stand-in because
        // nothing loaded in the project resembled it (false) — callers use this to
        // flag the element for manual review, since the real tipo/folhas/dimensões
        // are recorded separately (see SetSurveyComments) regardless either way.
        private static FamilySymbol PickBestSymbol(List<FamilySymbol> symbols, string tipo, int folhas, out bool matched)
        {
            matched = false;
            if (symbols.Count == 0) return null;

            FamilySymbol best = symbols[0];
            string[] keywords = ExtractKeywords(tipo);
            bool hasCriteria = keywords.Length > 0 || folhas > 0;

            if (!hasCriteria)
            {
                matched = true; // nothing specific was surveyed to compare against
            }
            else if (symbols.Count == 1)
            {
                matched = false; // only one type loaded — no way to tell if it actually fits
            }
            else
            {
                int bestScore = 0;
                foreach (FamilySymbol sym in symbols)
                {
                    string name = NormalizeForMatch(sym.Family.Name + " " + sym.Name);
                    int score = keywords.Count(kw => name.Contains(kw)) * 2;
                    if (folhas > 0 && name.Contains("folha") && name.Contains(folhas.ToString(CultureInfo.InvariantCulture)))
                        score += 3;
                    if (score > bestScore) { bestScore = score; best = sym; }
                }
                matched = bestScore > 0;
            }

            if (!best.IsActive) best.Activate();
            return best;
        }

        // The Revit family placed may not really look like what was surveyed (see
        // `matched` above) — so the actual tipo/folhas/dimensões/peitoril are always
        // written out as plain text in "Comentários" too, on every door/window,
        // so that information is never lost even when no matching family exists.
        private static void SetSurveyComments(FamilyInstance inst, string tipo, int folhas, double larguraM, double alturaM, double? peitorilM, bool familyMatched)
        {
            var parts = new List<string>();
            if (!string.IsNullOrEmpty(tipo)) parts.Add(tipo);
            if (folhas > 0) parts.Add($"{folhas} folha(s)");
            parts.Add($"{larguraM:0.00}×{alturaM:0.00} m");
            if (peitorilM.HasValue && peitorilM.Value > 0) parts.Add($"peitoril {peitorilM.Value:0.00} m");

            string text = "Levantamento: " + string.Join(" · ", parts);
            if (!familyMatched)
                text += " — família/tipo não encontrado no projeto, AJUSTAR MANUALMENTE.";

            Parameter p = inst.get_Parameter(BuiltInParameter.ALL_MODEL_INSTANCE_COMMENTS);
            if (p != null && !p.IsReadOnly) p.Set(text);
        }

        private static string[] ExtractKeywords(string tipo)
        {
            if (string.IsNullOrWhiteSpace(tipo)) return Array.Empty<string>();
            return NormalizeForMatch(tipo)
                .Split(new[] { ' ', '-', '(', ')', '/', ',' }, StringSplitOptions.RemoveEmptyEntries)
                .Where(w => w.Length >= 4)
                .ToArray();
        }

        // Lowercases and strips accents (á->a, í->i, ç->c, ã->a, ê->e, ...) so
        // matching doesn't depend on the loaded family's names using the exact
        // same diacritics as the app's own "tipo" strings.
        private static string NormalizeForMatch(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            string decomposed = s.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(decomposed.Length);
            foreach (char c in decomposed)
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                    sb.Append(c);
            return sb.ToString().ToLowerInvariant();
        }

        // Door/window width/height are usually Type parameters (shared by every
        // instance of that type), not Instance ones, and Brazilian templates often
        // use Portuguese names — so try each candidate name against both the
        // instance and, failing that, its type/symbol before giving up.
        private static void TrySetDimension(FamilyInstance inst, string[] candidateNames, double meters)
        {
            if (meters <= 0) return;
            double feet = MetersToFeet(meters);

            foreach (string name in candidateNames)
            {
                Parameter p = inst.LookupParameter(name);
                if (p != null && !p.IsReadOnly) { p.Set(feet); return; }
            }

            FamilySymbol symbol = inst.Symbol;
            foreach (string name in candidateNames)
            {
                Parameter p = symbol?.LookupParameter(name);
                if (p != null && !p.IsReadOnly) { p.Set(feet); return; }
            }
        }

        private static void SetMark(Element el, string tag)
        {
            if (string.IsNullOrEmpty(tag)) return;
            el.LookupParameter("Mark")?.Set(tag);
        }

        private static double MetersToFeet(double meters) => UnitUtils.ConvertToInternalUnits(meters, UnitTypeId.Meters);
    }
}
