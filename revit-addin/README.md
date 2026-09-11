# Braves BIM Field — Importador para Revit

Add-in para Revit 2024 que lê o arquivo `levantamento_bim.json` exportado
pelo app (aba **Sincronização → JSON**) e cria no Revit, no projeto aberto:

- **Níveis** (reaproveitando um nível existente com nome ou cota parecida; cria os que faltarem)
- **Paredes** (tenta casar o tipo do levantamento — ex: "Alvenaria 15cm" — com um
  tipo de parede do seu projeto com o **mesmo nome exato**; se não achar, usa o
  tipo padrão do projeto)
- **Portas e janelas** (usa a primeira família de porta/janela carregada no
  projeto; ajusta largura/altura se a família tiver esses parâmetros)
- **Ambientes** (cria um `Room` no centro de cada contorno fechado desenhado
  no Croqui — precisa que as paredes já formem um contorno fechado)

**Ainda não implementado** (fica para uma próxima etapa): coberturas, escadas,
luminárias, e pisos/acabamentos como parâmetros de material.

## ⚠️ Aviso importante

Este código foi escrito consultando a documentação da API do Revit, mas
**nunca foi compilado nem testado contra uma instalação real do Revit** —
o ambiente onde ele foi criado não tem Windows nem Revit instalados. É bem
provável que a primeira tentativa de build dê algum erro de compilação ou
que algo precise de ajuste ao rodar de verdade. Isso é esperado — me manda
a mensagem de erro (do Visual Studio ou do Revit) que eu corrijo.

## Pré-requisitos

- Windows com **Revit 2024** instalado
- **Visual Studio 2022** (a versão Community, gratuita, serve) com a carga
  de trabalho **".NET desktop development"** marcada na instalação
- Conexão com a internet na primeira compilação (para baixar o pacote
  Newtonsoft.Json via NuGet)

## Como compilar

1. Abra `BravesBimFieldImporter.sln` no Visual Studio.
2. Se o seu Revit 2024 **não** estiver instalado em
   `C:\Program Files\Autodesk\Revit 2024`, edite essa pasta no arquivo
   `BravesBimFieldImporter\BravesBimFieldImporter.csproj` (propriedade
   `RevitInstallDir`).
3. Selecione a configuração **Release** e plataforma **x64** (barra de
   ferramentas do Visual Studio).
4. Menu **Compilar → Compilar Solução** (ou `Ctrl+Shift+B`).
5. O arquivo `BravesBimFieldImporter.dll` vai aparecer em
   `BravesBimFieldImporter\bin\x64\Release\net48\`.

## Como instalar no Revit

1. Localize a pasta de add-ins do Revit 2024 (crie se não existir):
   `%APPDATA%\Autodesk\Revit\Addins\2024\`
   (cole esse caminho no Explorer de arquivos — `%APPDATA%` já expande sozinho)
2. Copie para essa pasta:
   - `BravesBimFieldImporter.addin` (está na raiz de `revit-addin/`)
   - `BravesBimFieldImporter.dll` (gerado no passo anterior)
   - `Newtonsoft.Json.dll` (também vai estar na pasta `bin\x64\Release\net48\`
     junto com o .dll do add-in — copie ela também, pro Revit conseguir
     carregar a dependência)
3. Abra (ou reabra) o Revit.
4. Vá na aba **Complementos (Add-Ins)** → **Ferramentas Externas (External
   Tools)** → **Braves BIM Field - Importar levantamento**.
5. Escolha o arquivo `levantamento_bim.json` que você exportou do app.

## Fluxo de uso recomendado

1. No app (celular/tablet), faça o levantamento normalmente.
2. Na aba **Sincronização**, clique em **JSON** para baixar `levantamento_bim.json`.
3. Transfira esse arquivo pro computador com Revit (e-mail, nuvem, cabo USB — como preferir).
4. Abra o projeto Revit onde quer importar (de preferência um projeto que já
   tenha os níveis certos, já que você escolheu reaproveitar níveis existentes).
5. Rode o comando do add-in e selecione o arquivo.

## Personalizando o casamento de tipos

Hoje o add-in casa tipo de parede pelo **nome exato** (comparação sem diferenciar
maiúsculas/minúsculas) entre o `tipo` do JSON (ex: `"Alvenaria 15cm"`) e os
`WallType` já existentes no seu projeto/template Revit. Se os nomes não
baterem, ele usa o tipo padrão do projeto. Para ter tipos de parede corretos
automaticamente, crie no seu template Revit tipos de parede com esses nomes
exatos (a lista completa usada pelo app está em `WALL_TYPES` no arquivo
`src/App.jsx` do repositório principal).
