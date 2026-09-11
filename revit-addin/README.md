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

### Importar de novo não duplica

Rodar qualquer um dos dois comandos de novo no mesmo projeto Revit
**atualiza** as paredes/portas/janelas/ambientes já importados (posição,
tipo, dimensões) em vez de criar um segundo conjunto por cima do primeiro —
o add-in reconhece cada elemento por um identificador oculto gravado no
campo Comentários dele. Elementos **novos** no levantamento (ex: uma porta
que você acabou de adicionar no app) são criados normalmente.

Importante: se você **apagar** algo no app (uma parede, porta, etc.) e
importar de novo, o elemento correspondente **não é apagado automaticamente**
do Revit — isso é proposital, pra nunca descartar sem avisar algo que você
possa ter ajustado manualmente lá. Nesse caso, apague-o você mesmo no Revit
(pode identificar pelo texto em Comentários).

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
   (cole esse caminho no Explorer de arquivos — `%APPDATA%` já expande sozinho.
   Repare que é `Addins\2024\` — não crie uma subpasta `Addins` **dentro**
   de `2024`, os arquivos ficam soltos direto ali.)
2. Copie para essa pasta, da pasta `BravesBimFieldImporter\bin\x64\Release\net48\`:
   - `BravesBimFieldImporter.dll`
   - `Newtonsoft.Json.dll` (dependência — o Revit precisa dela junto)
   - `firebase.config.json.example`
   
   E da raiz de `revit-addin/`:
   - `BravesBimFieldImporter.addin`
3. **Se os arquivos vieram de um ZIP baixado da internet**, clique com o
   botão direito em `BravesBimFieldImporter.dll` e `Newtonsoft.Json.dll` →
   **Propriedades** → marque **"Desbloquear"** (se aparecer essa opção) → OK.
   O Windows marca arquivos baixados como "bloqueados" e o Revit ignora
   add-ins bloqueados sem avisar nada.
4. Renomeie `firebase.config.json.example` para `firebase.config.json` e
   edite ele com as mesmas credenciais do `.env` do app (veja
   [Configurar a importação pela nuvem](#configurar-a-importação-pela-nuvem)
   abaixo) — só precisa disso se for usar o comando "Importar da nuvem".
5. Abra (ou reabra) o Revit.
6. Vá na aba **Complementos (Add-Ins)** → **Ferramentas Externas (External
   Tools)** → deve aparecer dois comandos:
   - **Braves BIM Field - Importar de arquivo**
   - **Braves BIM Field - Importar da nuvem**

## Importar da nuvem (recomendado — sem precisar de arquivo)

Com o Firebase já configurado no app (veja o README principal do repositório),
o levantamento sincroniza sozinho pra nuvem a cada alteração. O comando
**"Importar da nuvem"**:

1. Pede as credenciais do seu Firebase (arquivo `firebase.config.json` — passo
   4 acima)
2. Mostra uma janela com todos os projetos já sincronizados, com uma caixa de
   busca por nome
3. Digite parte do nome do projeto, escolha na lista (ou dê duplo clique) e
   clique em **Abrir**
4. Importa direto — sem precisar exportar/transferir nenhum arquivo

### Configurar a importação pela nuvem

Abra o arquivo `.env` que você criou pra configurar o Firebase do app (na
raiz do repositório principal) e copie dois valores pro
`firebase.config.json` do add-in:

```json
{
  "apiKey": "valor de VITE_FIREBASE_API_KEY no seu .env",
  "projectId": "valor de VITE_FIREBASE_PROJECT_ID no seu .env"
}
```

Esse arquivo precisa estar na **mesma pasta** do `BravesBimFieldImporter.dll`
(dentro de `Addins\2024\`).

## Importar de arquivo (alternativa, sem Firebase)

1. No app (celular/tablet), faça o levantamento normalmente.
2. Na aba **Sincronização**, clique em **JSON** para baixar `levantamento_bim.json`.
3. Transfira esse arquivo pro computador com Revit (e-mail, nuvem, cabo USB — como preferir).
4. Abra o projeto Revit onde quer importar (de preferência um projeto que já
   tenha os níveis certos, já que você escolheu reaproveitar níveis existentes).
5. Rode o comando **"Importar de arquivo"** e selecione o arquivo.

## Personalizando o casamento de tipos

Hoje o add-in casa tipo de parede pelo **nome exato** (comparação sem diferenciar
maiúsculas/minúsculas) entre o `tipo` do JSON (ex: `"Alvenaria 15cm"`) e os
`WallType` já existentes no seu projeto/template Revit. Se os nomes não
baterem, ele usa o tipo padrão do projeto. Para ter tipos de parede corretos
automaticamente, crie no seu template Revit tipos de parede com esses nomes
exatos (a lista completa usada pelo app está em `WALL_TYPES` no arquivo
`src/App.jsx` do repositório principal).

### Portas e janelas — tipo (correr, pivotante...) e número de folhas

O add-in **não modela a geometria da porta/janela** — ele só escolhe, entre as
famílias de porta/janela **já carregadas no seu projeto Revit**, a que parecer
mais parecida com o que foi levantado no app, comparando o nome da família/tipo
com o campo `tipo` (ex: `"Correr — alumínio"`) e o número de `folhas` (ex: `4`).
Se o seu projeto só tiver uma porta genérica de 1 folha carregada, é essa que
vai ser usada mesmo que o levantamento diga "4 folhas" — o Revit não sabe criar
uma família de 4 folhas do nada.

Para o casamento funcionar (e a porta/janela sair com o número de folhas certo):

1. Carregue no projeto Revit as famílias de porta/janela que você realmente
   usa (inclusive as de correr com múltiplas folhas — o próprio Revit tem
   famílias como `Porta de Correr - 4 Folhas` na biblioteca padrão).
2. Nomeie os **tipos** dessas famílias de um jeito que inclua a palavra-chave
   do estilo (ex: "correr", "pivotante", "sanfonada", "basculante") e, quando
   for o caso, a palavra "folhas" junto do número (ex: `"Correr 4 folhas"`).
3. O add-in escolhe o tipo carregado com mais palavras em comum com o `tipo`
   do levantamento (ignorando acentos/maiúsculas) — quanto mais parecido o
   nome, melhor o casamento.

Já a **largura e altura** de cada porta/janela são sempre ajustadas para bater
com o que foi medido no app (tentando os parâmetros `Height`/`Width` e também
`Altura`/`Largura`, seja como parâmetro de instância ou de tipo) — isso
funciona independente do casamento de família ter sido perfeito ou não.

#### Nenhuma informação do levantamento é perdida

Mesmo quando nenhuma família carregada no projeto parece com o que foi
levantado (ex: você levantou uma porta de correr de 4 folhas mas só tem uma
porta genérica de 1 folha no Revit), o add-in **nunca descarta** o que foi
medido: o tipo real (`"Correr — alumínio"`), o número de folhas, as dimensões
e (nas janelas) o peitoril são sempre escritos no campo **Comentários** de
cada porta/janela importada, por exemplo:

> Levantamento: Correr — alumínio · 4 folha(s) · 1.60×2.10 m — família/tipo
> não encontrado no projeto, AJUSTAR MANUALMENTE.

Ao final da importação, a mensagem de resumo do Revit avisa quantas
portas/janelas caíram nesse caso. Pra revisar todas de uma vez, crie uma
**Tabela de quantidades** de Portas (ou Janelas) no Revit e adicione a coluna
"Comentários" — as que precisam de ajuste manual aparecem com o aviso.
