using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Windows.Forms;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Newtonsoft.Json;

namespace BravesBimFieldImporter
{
    // v1 scope: Levels, Walls, Doors, Windows, Rooms (from closed "ambiente"
    // outlines drawn in the app's Croqui). Roofs, stairs and luminárias are
    // in the exported JSON but not created yet — future work.
    [Transaction(TransactionMode.Manual)]
    [Regeneration(RegenerationOption.Manual)]
    public class ImportLevantamentoCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            UIDocument uidoc = commandData.Application.ActiveUIDocument;
            Document doc = uidoc.Document;

            string jsonPath = PickJsonFile();
            if (string.IsNullOrEmpty(jsonPath))
                return Result.Cancelled;

            LevantamentoSchema schema;
            try
            {
                schema = JsonConvert.DeserializeObject<LevantamentoSchema>(File.ReadAllText(jsonPath));
            }
            catch (Exception ex)
            {
                message = "Não foi possível ler o arquivo JSON: " + ex.Message;
                return Result.Failed;
            }

            if (schema?.niveis == null || schema.niveis.Count == 0)
            {
                message = "O arquivo não contém níveis para importar.";
                return Result.Failed;
            }

            int paredesCount = 0, portasCount = 0, janelasCount = 0, ambientesCount = 0;

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

                    FamilySymbol doorSymbol = FindOrActivateSymbol(doc, BuiltInCategory.OST_Doors);
                    FamilySymbol windowSymbol = FindOrActivateSymbol(doc, BuiltInCategory.OST_Windows);

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
                            paredesCount++;
                        }
                    }

                    doc.Regenerate();

                    // Pass 2: doors, windows, rooms.
                    foreach (NivelInfo nivel in schema.niveis)
                    {
                        Level level = doc.GetElement(levelIdByNivelId[nivel.id]) as Level;

                        foreach (PortaInfo porta in nivel.portas ?? new List<PortaInfo>())
                        {
                            if (doorSymbol == null || !wallIdByParedeId.TryGetValue(porta.parede_id, out ElementId hostId)) continue;
                            Wall host = doc.GetElement(hostId) as Wall;
                            XYZ pos = new XYZ(MetersToFeet(porta.x), MetersToFeet(porta.y), level.Elevation);
                            // If this 5-arg overload (location, symbol, host, level, structuralType) doesn't
                            // resolve for your Revit API version, drop `level` — the 4-arg host overload
                            // (location, symbol, host, structuralType) hosts it on the wall just as well.
                            FamilyInstance inst = doc.Create.NewFamilyInstance(pos, doorSymbol, host, level, StructuralType.NonStructural);
                            TrySetDimension(inst, "Height", porta.altura_m);
                            TrySetDimension(inst, "Width", porta.largura_m);
                            SetMark(inst, porta.tag);
                            portasCount++;
                        }

                        foreach (JanelaInfo janela in nivel.janelas ?? new List<JanelaInfo>())
                        {
                            if (windowSymbol == null || !wallIdByParedeId.TryGetValue(janela.parede_id, out ElementId hostId)) continue;
                            Wall host = doc.GetElement(hostId) as Wall;
                            double sillFeet = MetersToFeet(janela.peitoril_m);
                            XYZ pos = new XYZ(MetersToFeet(janela.x), MetersToFeet(janela.y), level.Elevation + sillFeet);
                            FamilyInstance inst = doc.Create.NewFamilyInstance(pos, windowSymbol, host, level, StructuralType.NonStructural);
                            TrySetDimension(inst, "Height", janela.altura_m);
                            TrySetDimension(inst, "Width", janela.largura_m);
                            SetMark(inst, janela.tag);
                            janelasCount++;
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
                                    ambientesCount++;
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
                catch (Exception ex)
                {
                    tx.RollBack();
                    message = "Erro ao importar: " + ex.Message;
                    return Result.Failed;
                }
            }

            TaskDialog.Show("Braves BIM Field",
                $"Importação concluída:\n{schema.niveis.Count} nível(is)\n{paredesCount} parede(s)\n{portasCount} porta(s)\n{janelasCount} janela(s)\n{ambientesCount} ambiente(s)");

            return Result.Succeeded;
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

        private static FamilySymbol FindOrActivateSymbol(Document doc, BuiltInCategory category)
        {
            FamilySymbol symbol = new FilteredElementCollector(doc)
                .OfClass(typeof(FamilySymbol))
                .OfCategory(category)
                .Cast<FamilySymbol>()
                .FirstOrDefault();

            if (symbol != null && !symbol.IsActive)
                symbol.Activate();

            return symbol;
        }

        private static void TrySetDimension(FamilyInstance inst, string paramName, double meters)
        {
            if (meters <= 0) return;
            Parameter p = inst.LookupParameter(paramName);
            if (p != null && !p.IsReadOnly)
                p.Set(MetersToFeet(meters));
        }

        private static void SetMark(Element el, string tag)
        {
            if (string.IsNullOrEmpty(tag)) return;
            el.LookupParameter("Mark")?.Set(tag);
        }

        private static double MetersToFeet(double meters) => UnitUtils.ConvertToInternalUnits(meters, UnitTypeId.Meters);

        private static string PickJsonFile()
        {
            using (var dlg = new OpenFileDialog
            {
                Filter = "Levantamento BIM (*.json)|*.json",
                Title = "Selecione o levantamento_bim.json exportado do app",
            })
            {
                return dlg.ShowDialog() == DialogResult.OK ? dlg.FileName : null;
            }
        }
    }
}
