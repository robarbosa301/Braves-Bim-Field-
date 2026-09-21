# Braves BIM Field

Prancheta eletrônica BIM para controle de execução de obra em campo — visualizador 3D por camadas (fôrma, concreto, armadura), quantitativos automáticos e controle de execução (previsto × executado).

**Status atual (MVP):** fundações — sapata isolada, pilar de arranque e viga baldrame, com criação manual de elementos **ou importação de um arquivo IFC** (testado com export do AltoQi Eberick). Importação de PDF, mais tipos de elemento e backend multiusuário ainda não implementados (ver Roadmap).

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. Funciona em qualquer navegador moderno, incluindo tablet no canteiro (é uma SPA responsiva; ainda não é um PWA instalável — ver roadmap).

`npm run build` gera o build de produção em `dist/` (pode ser hospedado em qualquer servidor estático).

## O que o MVP faz

1. **Criar elementos** (barra lateral esquerda): sapata, pilar de arranque, viga baldrame — cada um com uma identificação (tag) de campo, ex. `S1`, `P1`, `VB1`.
2. **Visualizador 3D** (react-three-fiber/Three.js): cada elemento é renderizado com 3 camadas independentes, ligáveis/desligáveis no topo da tela:
   - **Fôrma**: taipais de madeira nas faces laterais.
   - **Concreto**: o volume de concreto, colorido em cinza (previsto) ou verde (concretado).
   - **Armadura**: barras longitudinais/malha e estribos, representados na quantidade calculada.
   - Clicar em um elemento no viewer (ou na lista) seleciona-o e abre o painel de detalhes.
3. **Quantitativos** (aba "Quantitativos" do painel direito), recalculados ao vivo a partir da geometria:
   - **Fôrma**: dimensões de cada face e área total (m²).
   - **Concreto**: volume (m³), sacos de cimento, m³/kg de areia e brita, litros de água — a partir do traço informado.
   - **Armadura**: por grupo de barras — quantidade, diâmetro, comprimento unitário/total, peso (kg) e volume.
4. **Execução** (aba "Execução"): cada elemento tem 3 etapas — Fôrma, Armação, Concretagem. Marcar como executado registra a data; a etapa de concretagem também aceita o volume real de concreto lançado, para comparar com o previsto. O status colore o elemento no viewer 3D.
5. Os dados ficam salvos no `localStorage` do navegador (projeto local, sem backend ainda).
6. **Importar IFC** (botão na barra lateral esquerda): lê um arquivo `.ifc` inteiro no navegador (sem enviar a nenhum servidor), escolhe automaticamente o pavimento de menor elevação (a fundação), e cria as sapatas/pilares de arranque/vigas baldrame desse pavimento já com geometria, cobrimento, classe de concreto e **armadura real do projeto** (quantidade, diâmetro e comprimento vindos das barras do IFC, não estimados). A importação substitui os elementos atuais do projeto — o app confirma antes.
7. **Vista isolada / explodida** (botão no topo, aparece com um elemento selecionado): mostra só aquele elemento, com fôrma/concreto/armadura separados espacialmente lado a lado — cada um com um rótulo flutuante com os números daquela camada (área, volume, sacos de cimento, peso das barras) — e a câmera se ajusta sozinha (não precisa procurar o elemento no meio da obra inteira). Bom pra conferir de perto qualquer peça antes/depois de executar.
8. **Sapata em tronco de pirâmide**: quando o sólido do IFC tem um "degrau" (footprint mais estreito no topo — o dado/pedestal onde nasce o pilar), o app detecta e desenha o formato real (bloco da base + tronco de pirâmide), em vez de um bloco único — volume e área de fôrma calculados com a geometria certa (o tronco usa a fórmula de volume de tronco de pirâmide e a área real dos 4 trapézios laterais, não uma aproximação).

## Importação de IFC — como funciona e limitações

O importador (`src/lib/ifc/`) é um parser próprio de STEP/IFC (não usa `web-ifc`/IFC.js) focado só no que a obra precisa:

- Lê o arquivo inteiro no navegador, indexa as entidades e resolve só o necessário (mais rápido e sem dependência pesada). Testado com um IFC4 real de ~185 mil entidades (exportado pelo Eberick) em menos de 1s.
- Escolhe o pavimento de **menor elevação** como "fundação" (na prática, o pavimento onde ficam sapata + pilar de arranque + viga baldrame juntos).
- Geometria: para pilares/vigas (prismas extrudados, `IfcExtrudedAreaSolid` + `IfcRectangleProfileDef`) usa a seção e o comprimento de extrusão direto. Para sapatas (sólido explícito, sem extrusão simples) agrupa os vértices por nível Z e detecta o formato em **tronco de pirâmide**: se o footprint (X/Y) fica mais estreito num nível mais alto, separa em bloco da base + tronco (dimensões do topo = onde nasce o pilar) — do contrário, cai para um bloco simples.
- Cobrimento e classe de concreto (ex. "C-25") vêm dos `Pset` do elemento (`Cobrimento`/`ConcreteCover`, `Classe de concreto`/`StrengthClass`). O **traço** (cimento:areia:brita) não vem do IFC — só a classe de resistência —, então o app mantém o traço padrão editável para você calibrar.
- Armadura: cada `IfcReinforcingBar` do pavimento é agrupada pelo próprio nome que o Eberick usa (ex. `"P1 - Estribo"`, `"V3 - Longitudinal superior"`, `"P1 - Sapatas (inferior)"`) e associada ao elemento certo por esse nome — inclusive separando sapata de pilar mesmo quando os dois têm a mesma tag (`P1`), porque só a sapata usa a categoria "Sapatas". O comprimento de cada barra é o comprimento real (com dobras/ganchos) calculado a partir da geometria da barra (`IfcSweptDiskSolid`), não uma fórmula aproximada. Esses grupos aparecem na aba Quantitativos com a marca "dados reais do IFC" — eles substituem o cálculo paramétrico para aquele elemento (que continua existindo, com uma estimativa compatível, só para alimentar a visualização 3D e ficar editável).
- **Posição 3D**: é resolvida a partir da cadeia real de `IfcLocalPlacement` do projeto (rotação + translação, não só translação), incluindo a correção para prismas com o perfil rotacionado em relação à extrusão (comum em vigas "deitadas"). Conferimos a matemática à mão contra os números brutos do arquivo (sapata→pilar bate exatamente, gap zero) e ela reproduz fielmente o que está no IFC. Ainda assim, em alguns casos o vão entre o topo do pilar de arranque e a base da viga baldrame que aparenta dever apoiar nele fica maior do que se espera visualmente — isso pode refletir um elemento intermediário não incluído neste IFC estrutural (ex. embasamento em alvenaria) ou uma particularidade de como o projeto foi modelado, não necessariamente um erro de importação. Isso não afeta quantitativos (área, volume, peso) — só a posição; qualquer elemento pode ser reposicionado à mão na aba Editar.
- Só foi testado contra arquivos gerados pelo Eberick. Outro software BIM pode nomear as barras de armadura de outro jeito, e nesse caso o agrupamento por nome não vai funcionar — os elementos ainda seriam importados (geometria/cobrimento/classe), só ficariam sem `armaduraImportada` (o app cai de volta pro cálculo paramétrico nesse caso).

## Base de cálculo (transparência para quem for conferir os números)

- **Fôrma**: área das 4 faces laterais do prisma (comprimento×altura e largura×altura). Sapata, pilar de arranque e baldrame são tratados como apoiados sobre lastro/solo, sem fôrma no fundo e com topo aberto — ajustável em `src/lib/concrete.ts` (`calcularForma`) se a prática da obra for outra (ex. baldrame suspenso/escorado).
- **Concreto**: dosagem racional pelo método dos volumes absolutos (NBR 12655), a partir do traço unitário em massa (1 : areia : brita) e do fator água/cimento — ver `src/lib/concrete.ts` (`calcularConcreto`). Densidades reais assumidas: cimento 3100 kg/m³, areia/brita 2650 kg/m³, água 1000 kg/m³, ar incorporado 1,5%. Para conversão de areia/brita de massa para volume de compra, usa densidade aparente (areia 1500 kg/m³, brita 1550 kg/m³). **Se a obra já tem um traço de referência em kg de cimento/m³** (de um estudo de dosagem ou tabela própria), preencha o campo "Consumo de cimento (override manual)" no traço — ele substitui o cálculo teórico.
- **Armadura**: fórmulas práticas usuais de quantitativo de campo — ver `src/lib/steel.ts`.
  - Peso linear do aço: `0,00617 × d²` (kg/m, d em mm) — fórmula padrão CA-50/CA-60.
  - Sapata: malha inferior, barras em duas direções, quantidade pelo espaçamento entre eixos dentro do cobrimento, comprimento com desconto de cobrimento e acréscimo de gancho nas pontas.
  - Pilar: barras longitudinais distribuídas no perímetro da seção + estribos ao longo da altura, com folga prática de 20 cm por estribo para dobras/ganchos.
  - Viga baldrame: barras superior/inferior ao longo do vão + estribos, mesma lógica do pilar.
  - Esses valores são estimativas de projeto para planejamento de compra/mão de obra — **não substituem o detalhamento estrutural do projetista** (dobras, transpasses e ancoragens reais podem variar).

Todas as constantes acima (densidades, folgas, regra de fôrma) estão isoladas em `src/lib/concrete.ts` e `src/lib/steel.ts` para serem fáceis de calibrar com a realidade da obra.

## Estrutura do código

```
src/
  types.ts                  modelo de dados (elementos, traço, armadura, etapas)
  lib/
    concrete.ts              cálculo de fôrma e de materiais do concreto
    steel.ts                 cálculo de armadura (peso, comprimento, volume)
    quantities.ts             agrega fôrma+concreto+armadura por elemento
    factories.ts              criação de elementos com valores padrão
    ifc/
      stepParser.ts            parser genérico de STEP/IFC (índice de entidades + tokenizer)
      placement.ts             resolve IfcLocalPlacement (rotação+translação) até o mundo
      geometryExtract.ts       extrai dimensões (extrusão ou bbox) de cada elemento
      rebarExtract.ts          agrupa IfcReinforcingBar e calcula comprimento real das barras
      importIfc.ts             orquestra tudo e monta a lista de BimElement
  store/useProjectStore.ts   estado global (zustand) + persistência em localStorage
  components/
    Viewer3D/                 cena Three.js: malhas de concreto, fôrma, armadura
      ExplodedElementScene.tsx  vista isolada/explodida de um elemento, com rótulos de quantitativo
      TroncoMesh.tsx            malhas de concreto/fôrma do tronco de pirâmide (sapata)
      frustumGeometry.ts        geometria 3D (BufferGeometry) do tronco de pirâmide
    Sidebar/                  lista de elementos, formulários, quantitativos, execução, importação de IFC
    LayerToggle.tsx            controle de camadas visíveis
```

## Roadmap (próximas fases, ainda não implementadas)

1. **Mais elementos estruturais**: pilares (elevação completa, não só o arranque), vigas de piso, lajes — reusando o mesmo padrão de camadas/quantitativos/execução já criado para fundações, e estendendo o importador de IFC para os pavimentos superiores.
2. **Importação de IFC — refinar**: melhorar a extração de posição/orientação 3D para prismas com perfil rotacionado (o caso que hoje pode gerar desalinhamento visual entre elementos conectados), e testar contra exports de outros softwares (Revit, ArchiCAD, TQS) além do Eberick.
3. **Importação de PDF (planta baixa)**: leitura de plantas em PDF é um problema difícil (não é OCR simples — depende de vetores/CAD ou digitalização assistida). Provavelmente exige um passo de "digitalização" onde o usuário marca os elementos sobre a planta, ou integração com um formato intermediário (DXF/DWG) além do PDF puro. Com IFC cobrindo a extração estrutural, o PDF fica mais como referência visual (imagem de fundo) do que fonte de geometria.
4. **Backend + multiusuário**: hoje os dados vivem só no navegador de quem está usando. Para controlar obra de verdade (várias pessoas, campo x escritório) é necessário um servidor com banco de dados, autenticação e sincronização — e então o app pode virar PWA instalável/offline-first para uso em campo sem sinal.
5. **Evidências de execução**: foto/anexo por etapa, geolocalização, assinatura de quem executou/conferiu.
6. **5D completo**: hoje o app já cobre o "5D" no sentido de quantidade+execução; falta ligar isso a custo (orçamento por elemento, preço unitário de material/mão de obra) e a cronograma (linha do tempo prevista x realizada, curva S).
7. **Relatórios**: exportar quantitativos e status de execução (PDF/planilha) por elemento, por etapa ou da obra inteira.

Este README deve ser atualizado conforme cada fase do roadmap avançar.
