# Recibos Braves

Modelo de recibo em PDF (A4, um recibo por página) com a identidade da Braves Construções Eficientes: faixa preta com a logo branca, detalhes em dourado e fontes Barlow / JetBrains Mono.

## Arquivos

| Arquivo | O que é |
|---|---|
| `gerar-recibo.js` | Monta o HTML de cada recibo e gera o PDF com Playwright. Calcula o valor por extenso sozinho. |
| `recibo.css` | Estilo do recibo (cores, faixa, tabela, assinaturas). |
| `logo-braves-branca.png` | Logo Braves em branco com fundo transparente, para a faixa preta. |
| `exemplo-recibos.json` | Dois recibos de exemplo, com dados fictícios. |

## Como gerar

```bash
node recibos/gerar-recibo.js recibos/exemplo-recibos.json recibos.pdf
```

Também dá para usar como módulo: `const { recibo, extenso, gerarPDF } = require('./recibos/gerar-recibo')`.

## Campos de cada recibo

| Campo | Exemplo | Observação |
|---|---|---|
| `numero` | `"0004"` | Sequência dos recibos. |
| `titulo` | `"Pagamento de mão de obra"` | Aparece ao lado do valor. |
| `valor` | `5865` | Número em reais. O texto por extenso é gerado automaticamente. |
| `declaracao` | `"Eu, Fulano, empreiteiro, inscrito no CPF …, declaro que recebi de Ciclano, …,"` | Início do texto, até antes de "a importância de". |
| `referente` | `"mão de obra de duas semanas …"` | Completa "referente ao pagamento de …". |
| `periodo` | `["1ª semana: 26/10 a 31/10/2026"]` | Opcional. Quadro "Período". |
| `servicos` | `["✓ Projeto arquitetônico"]` | Opcional. Quadro "Serviços incluídos". |
| `composicao` | `[["Mão de obra", 3965], ["Material", 650]]` | Opcional. Valores negativos aparecem como desconto. A tabela fecha com o total. |
| `detalhes` | `[["Forma de pagamento", "PIX em …"]]` | Pares rótulo/valor: forma de pagamento, ID do PIX, quem enviou etc. |
| `obra` | `"Residência … · endereço"` | |
| `cidade`, `dataQuitacao` | `"São Miguel do Guamá/PA"`, `"7 de novembro de 2026"` | Linha de local e data. |
| `dataEntrega` | `"09/11/2026"` | Opcional. Linha "Data de entrega do recibo". |
| `assinaturas` | `[{ "nome", "papel", "documento" }]` | Com 3 assinaturas, a primeira fica centralizada e as outras duas lado a lado. Com 2, ficam lado a lado. |

## Tipos de recibo já usados

1. **Mão de obra (empreiteiro → proprietário):** 3 assinaturas: empreiteiro (recebedor), proprietário (pagador) e engenheiro (testemunha). Período por semana, dias trabalhados e, quando houver, composição mão de obra + material.
2. **Contratação de projetos:** 2 assinaturas: engenheiro/Braves (recebedor) e proprietário (pagador). Lista de serviços do pacote e composição com desconto.
3. **Gerenciamento de obra (mensalidade):** 2 assinaturas. Mês de referência no campo `referente`.

Dados reais de clientes (nomes, CPFs, comprovantes) não ficam neste repositório. Os exemplos usam dados fictícios.
