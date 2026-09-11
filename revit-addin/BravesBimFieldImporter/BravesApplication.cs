using System;
using System.IO;
using System.Reflection;
using System.Windows.Media.Imaging;
using Autodesk.Revit.UI;

namespace BravesBimFieldImporter
{
    // Registers the "Braves BIM Field" ribbon tab with two buttons (Braves
    // Cloud / Braves Import) that run the same commands already exposed under
    // Complementos → Ferramentas Externas — this just gives them a dedicated,
    // branded home instead of being buried in that generic dropdown.
    public class BravesApplication : IExternalApplication
    {
        private const string TabName = "Braves BIM Field";

        public Result OnStartup(UIControlledApplication application)
        {
            try
            {
                return OnStartupCore(application);
            }
            catch (Exception ex)
            {
                // If anything below throws, Revit otherwise just silently disables
                // the add-in with no visible clue — surface it instead.
                TaskDialog.Show("Braves BIM Field — erro ao iniciar", ex.ToString());
                return Result.Failed;
            }
        }

        private Result OnStartupCore(UIControlledApplication application)
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

            // Source bitmaps are 128/64px — well above the ~32/16 DIP slot Revit
            // actually renders these in — so WPF always downscales rather than
            // upscales, which is what keeps the icon crisp on displays running
            // above 100% Windows scaling (common on CAD workstations).
            var cloudButton = new PushButtonData(
                "BravesCloudButton", "Cloud", assemblyPath, typeof(ImportarDaNuvemCommand).FullName)
            {
                ToolTip = "Importa o levantamento direto da nuvem (Firebase) — escolha o projeto pelo nome, sem precisar de arquivo.",
                LargeImage = LoadImage("braves_cloud_128.png"),
                Image = LoadImage("braves_cloud_64.png"),
            };

            var importButton = new PushButtonData(
                "BravesImportButton", "Import", assemblyPath, typeof(ImportLevantamentoCommand).FullName)
            {
                ToolTip = "Importa o levantamento a partir de um arquivo levantamento_bim.json exportado do app.",
                LargeImage = LoadImage("braves_import_128.png"),
                Image = LoadImage("braves_import_64.png"),
            };

            panel.AddItem(cloudButton);
            panel.AddItem(importButton);

            // TEMPORARY diagnostic — the icons aren't showing up and every code
            // path looks correct, so report exactly what LoadImage found instead
            // of guessing further. Safe to remove once the cause is confirmed.
            ShowIconDiagnostics(cloudButton.LargeImage, cloudButton.Image, importButton.LargeImage, importButton.Image);

            return Result.Succeeded;
        }

        public Result OnShutdown(UIControlledApplication application) => Result.Succeeded;

        private static void ShowIconDiagnostics(params System.Windows.Media.ImageSource[] images)
        {
            string[] labels = { "cloud LargeImage (128)", "cloud Image (64)", "import LargeImage (128)", "import Image (64)" };
            var lines = new System.Collections.Generic.List<string>();
            for (int i = 0; i < images.Length; i++)
            {
                var bmp = images[i] as BitmapSource;
                lines.Add(bmp == null
                    ? $"{labels[i]}: NULL (recurso não encontrado)"
                    : $"{labels[i]}: OK — {bmp.PixelWidth}x{bmp.PixelHeight}");
            }

            string[] allResources = Assembly.GetExecutingAssembly().GetManifestResourceNames();
            lines.Add("");
            lines.Add("Todos os recursos embutidos no .dll:");
            lines.AddRange(allResources.Length == 0 ? new[] { "(nenhum!)" } : allResources);

            TaskDialog.Show("Braves BIM Field — diagnóstico de ícones", string.Join("\n", lines));
        }

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
