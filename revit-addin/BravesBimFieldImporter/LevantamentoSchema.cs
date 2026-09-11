using System.Collections.Generic;

namespace BravesBimFieldImporter
{
    // Mirrors the JSON produced by buildSchema()/exportJSON() in the web app
    // (Sincronização → JSON). Only the fields this add-in actually uses are
    // declared; Newtonsoft.Json ignores anything else in the file.

    public class LevantamentoSchema
    {
        public int schema_version;
        public ProjetoInfo projeto;
        public List<NivelInfo> niveis;
    }

    public class ProjetoInfo
    {
        public string empresa;
        public string codigo;
        public string nome;
        public string unidade;
    }

    public class NivelInfo
    {
        public string id;
        public string nome;
        public double cota_m;
        public double pe_direito_padrao_m;
        public List<ParedeInfo> paredes;
        public List<PortaInfo> portas;
        public List<JanelaInfo> janelas;
        public List<AmbienteCroquiInfo> ambientes_croqui;
    }

    public class ParedeInfo
    {
        public string id;
        public string tag;
        public double x1, y1, x2, y2;
        public double altura_m;
        public string tipo;
        public string condicao;
    }

    public class PortaInfo
    {
        public string id;
        public string tag;
        public string parede_id;
        public double x, y;
        public double largura_m, altura_m;
        public int folhas;
        public string tipo;
    }

    public class JanelaInfo
    {
        public string id;
        public string tag;
        public string parede_id;
        public double x, y;
        public double largura_m, altura_m, peitoril_m;
        public int folhas;
        public string tipo;
    }

    public class PontoInfo
    {
        public double x, y;
    }

    public class AmbienteCroquiInfo
    {
        public string id;
        public string ambiente_id;
        public string nome;
        public double area_m2;
        public List<PontoInfo> pontos;
    }
}
