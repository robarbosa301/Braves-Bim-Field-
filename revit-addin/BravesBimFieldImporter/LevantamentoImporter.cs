using System;
using System.Collections.Generic;
using System.Linq;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Architecture;
using Autodesk.Revit.DB.Structure;

namespace BravesBimFieldImporter
{
    public class ImportResult
    {
        public int Niveis, Paredes, Portas, Janelas, Ambientes;

        public override string ToString() =>
            $"{Niveis} nível(is)\n{Paredes} parede(s)\n{Portas} porta(s)\n{Janelas} janela(s)\n{Ambientes} ambiente(s)";
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
                            result.Portas++;
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
    }
}
