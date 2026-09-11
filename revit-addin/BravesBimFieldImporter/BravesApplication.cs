using System;
using System.IO;
using System.Reflection;
using System.Windows.Media.Imaging;
using Autodesk.Revit.UI;

namespace BravesBimFieldImporter
{
    // Registers the "Braves BIM Field" ribbon tab with the Cloud/Import
    // buttons (running the same commands already exposed under Complementos
    // → Ferramentas Externas — this just gives them a dedicated, branded
    // home instead of being buried in that generic dropdown) plus a third,
    // purely informational "Braves BIM Field" button showing the logo.
    public class BravesApplication : IExternalApplication
    {
        private const string TabName = "Braves BIM Field";

        public Result OnStartup(UIControlledApplication application)
        {
            try
            {
                application.CreateRibbonTab(TabName);
            }
            catch (Exception)
            {
                // Tab already exists (e.g. add-in reloaded in the same session) — fine.
            }

            RibbonPanel panel = application.CreateRibbonPanel(TabName, "Levantamento");
            string assemblyPath = Assembly.GetExecutingAssembly().Location;

            // Revit's ribbon does not scale these — LargeImage must be exactly
            // 32x32 and Image exactly 16x16, or it silently shows no icon at all
            // (confirmed: a 128/64px source loaded fine in memory but never
            // rendered). Keep the source vector-traced (see the icon generator
            // in scratch history) so 32/16 still comes out crisp, not blurry.
            var cloudButton = new PushButtonData(
                "BravesCloudButton", "Cloud", assemblyPath, typeof(ImportarDaNuvemCommand).FullName)
            {
                ToolTip = "Importa o levantamento direto da nuvem (Firebase) — escolha o projeto pelo nome, sem precisar de arquivo.",
                LargeImage = LoadImage("braves_cloud_32.png"),
                Image = LoadImage("braves_cloud_16.png"),
            };

            var importButton = new PushButtonData(
                "BravesImportButton", "Import", assemblyPath, typeof(ImportLevantamentoCommand).FullName)
            {
                ToolTip = "Importa o levantamento a partir de um arquivo levantamento_bim.json exportado do app.",
                LargeImage = LoadImage("braves_import_32.png"),
                Image = LoadImage("braves_import_16.png"),
            };

            var aboutButton = new PushButtonData(
                "BravesAboutButton", "Braves BIM\nField", assemblyPath, typeof(AboutCommand).FullName)
            {
                ToolTip = "BRAVES Engenharia — Levantamento de campo integrado ao Revit.",
                LargeImage = LoadImage("braves_logo_32.png"),
                Image = LoadImage("braves_logo_16.png"),
            };

            panel.AddItem(cloudButton);
            panel.AddItem(importButton);
            panel.AddSeparator();
            panel.AddItem(aboutButton);

            return Result.Succeeded;
        }

        public Result OnShutdown(UIControlledApplication application) => Result.Succeeded;

        private static BitmapImage LoadImage(string fileName)
        {
            string resourceName = $"{Assembly.GetExecutingAssembly().GetName().Name}.Resources.{fileName}";
            using (Stream stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(resourceName))
            {
                if (stream == null) return null;

                var image = new BitmapImage();
                image.BeginInit();
                image.CacheOption = BitmapCacheOption.OnLoad;
                image.StreamSource = stream;
                image.EndInit();
                image.Freeze();
                return image;
            }
        }
    }
}
