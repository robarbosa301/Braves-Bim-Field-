# Braves BIM Field

Prancheta eletrônica BIM para controle de execução de obra em campo — visualizador 3D por camadas (fôrma, concreto, armadura), quantitativos automáticos e controle de execução (previsto × executado).

**Status atual (MVP):** fundações — sapata isolada, pilar de arranque e viga baldrame, com criação manual de elementos. Importação de IFC/PDF, mais tipos de elemento e backend multiusuário ainda não implementados (ver Roadmap).

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
  store/useProjectStore.ts   estado global (zustand) + persistência em localStorage
  components/
    Viewer3D/                 cena Three.js: malhas de concreto, fôrma e armadura
    Sidebar/                  lista de elementos, formulários, quantitativos, execução
    LayerToggle.tsx            controle de camadas visíveis
```

## Roadmap (próximas fases, ainda não implementadas)

1. **Mais elementos estruturais**: pilares (elevação completa), vigas, lajes — reusando o mesmo padrão de camadas/quantitativos/execução já criado para fundações.
2. **Importação de IFC**: carregar um modelo BIM (ex. via `web-ifc`/IFC.js) e extrair automaticamente sapatas/pilares/vigas/lajes com geometria e armadura do projeto, em vez de criar elemento por elemento manualmente.
3. **Importação de PDF (planta baixa)**: leitura de plantas em PDF é um problema difícil (não é OCR simples — depende de vetores/CAD ou digitalização assistida). Provavelmente exige um passo de "digitalização" onde o usuário marca os elementos sobre a planta, ou integração com um formato intermediário (DXF/DWG) além do PDF puro.
4. **Backend + multiusuário**: hoje os dados vivem só no navegador de quem está usando. Para controlar obra de verdade (várias pessoas, campo x escritório) é necessário um servidor com banco de dados, autenticação e sincronização — e então o app pode virar PWA instalável/offline-first para uso em campo sem sinal.
5. **Evidências de execução**: foto/anexo por etapa, geolocalização, assinatura de quem executou/conferiu.
6. **5D completo**: hoje o app já cobre o "5D" no sentido de quantidade+execução; falta ligar isso a custo (orçamento por elemento, preço unitário de material/mão de obra) e a cronograma (linha do tempo prevista x realizada, curva S).
7. **Relatórios**: exportar quantitativos e status de execução (PDF/planilha) por elemento, por etapa ou da obra inteira.

Este README deve ser atualizado conforme cada fase do roadmap avançar.
