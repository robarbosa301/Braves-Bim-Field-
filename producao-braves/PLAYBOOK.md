# Guia de produção de vídeos da Braves (EDIT IA PRO)

Este guia reúne o que foi **aprovado**, os **erros a não repetir** e o **passo a passo técnico** do vídeo 1 ("Projetos da Braves não são só planta"). Leia inteiro antes de editar qualquer vídeo da Braves. A conversa com o cliente é sempre em português do Brasil, frases curtas, sem mostrar código ou caminho de arquivo.

## 0. Regra principal do cliente: nunca simplificar
O cliente pediu, com todas as letras: **não simplificar nada; deixar sempre bem chamativo e bem trabalhado; entender o nicho, o público e o objetivo; entregar imagens, animações e motions melhores.** Isso vale para todos os vídeos.
- **Padrão mínimo de riqueza em cada vídeo:** capa animada; gancho animado; pelo menos 1 motion ilustrativo próprio (planta CAD, 3D montado por etapas ou diagrama); pelo menos 1 cena de apontamento ou lista animada; 4 ou mais transições **diferentes**; efeitos sonoros por animação; final com chamada animada e logo; tratamento de cor profissional.
- **Chamativo não é poluído.** Cada elemento precisa ter função ligada à fala (a fita zebrada e os prédios com janelas foram reprovados). Uma ideia por vez, legível no celular, fora do rosto e dentro da zona segura.
- **Imagens melhores:** use o 4K original com a cor HDR convertida certo; peça ao cliente **plantas, renders e imagens reais de obras da Braves** para trocar as ilustrações genéricas. Sempre avise o que é ilustração minha.
- **Banco de motions já criados** (reaproveitar e evoluir, em `montar_v21.py` e `casa.py`): planta CAD com cursor, modelo 3D montado por etapas com câmera e etiquetas, pessoas com balão e X, palavras de impacto, escada com seta, lista de ícones (vigas, laje, cobertura, hidráulica, pia, vaso, chuveiro, lavanderia, armar), carimbo, barra de andamento, bússola/escudo/gráfico, apontamento com B e personagens, comentário digitando com confete, logo revelado, capa animada.

## 0.1 Nicho, público e objetivo (a confirmar com o cliente)
O que o cliente já disse e o que se deduz:
- **Nicho:** engenharia civil, projeto e obra com **modelagem BIM** (projeto 2D e 3D), com foco na **experiência visual do projeto antes de construir**. Empresa: Braves Construções Eficientes.
- **Público:** (1) o **cliente** que vai construir ou reformar e precisa entender o projeto; (2) a **mão de obra** (equipe, mestre de obras) que executa. O vídeo 1 fala dos dois.
- **Objetivo:** gerar conversa qualificada no **direct** ("Chama no direct") e posicionar a Braves como quem entrega a **melhor experiência visual em projetos**, com segurança física e orçamentária na obra.
- **Tom:** profissional, didático e confiante, de engenheiro. Sem preço, prazo ou promessa de ganho (política das plataformas).
- **Ainda não sabemos (perguntar):** cidade ou região de atuação; tipo de cliente principal; serviços (projeto, execução, gestão); obras entregues e imagens reais para prova; diferenciais frente à concorrência; meta (quantos contatos, qual rede é a principal).

## 0.2 Ganchos (padrão e ideias)
- Sempre nos **3 primeiros segundos**: tarjas animadas (branca e azul-ciano) com a ideia central em até 2 linhas e 6 a 8 palavras, tiradas da fala, acompanhadas de um **motion que ilustra** (ex.: "só uma planta" riscada de vermelho).
- Formatos para variar: contraste ("não é X, é Y"); pergunta ao cliente; antes e depois (planta vira 3D); erro comum; "próxima etapa da obra".
- Exemplos aprovados: "NÃO É SÓ UMA PLANTA / É EXPERIÊNCIA VISUAL", "PRÓXIMA ETAPA DA OBRA / VIGAS E LAJE".

## 1. Identidade (não mudar sem pedido)
- **Empresa:** Braves Construções Eficientes. Escreva sempre **"Braves"** (nunca "Bravos"). O logo oficial está em `logos/` (versão branca com fundo transparente; o ícone do B sozinho é `icon_white.png`).
- **Pessoa:** Rogério Otávio, Engenheiro Civil. Nome e cargo foram dados pelo cliente. **Nunca invente nome, cargo, slogan, handle ou número.**
- **Chamada final:** "Chama no direct". **Sem número de WhatsApp na tela.** Se a fala já disser "toca no link da bio", mantém (o cliente aprovou).
- **Cores:** azul-marinho de projeto (fundo com grade, `#091634` para `#050C22`), **ciano `#00E5FF`** (cor da marca nas legendas, linhas e anéis), **amarelo `#FFC400`** (destaque), branco, vermelho `#E10600` só para X, carimbos e riscos.
- **Fontes:** Anton (títulos, ganchos) e Montserrat 800 (legenda). Estão em `fontes/`.
- **Onde usar o B do logo:** só no encerramento (logo completo e avatar do campo de comentário) e no círculo central da cena de apontamento. Não usar marca d'água do B nos quadros.

## 2. O que o cliente aprovou (repita)
**Legenda:** estilo **C, "caixa na palavra"**: Montserrat 800 branco com contorno escuro; a palavra falada ganha uma caixa azul-ciano com texto escuro; 1 a 3 palavras por vez, pequeno "pulo" ao trocar de grupo, tamanho que diminui sozinho se a frase for comprida. Em tela cheia fica no peito (y≈1100); em cenas com cartão de imagem fica **abaixo do cartão** (y≈1395), dentro da área segura. **Nunca por cima de imagem filmada.**

**Cor da imagem:** vídeos de iPhone são **HDR (HLG, BT.2020)**. Converta com `zscale ... tonemap=mobius:param=0.3 ... eq=gamma=1.08:saturation=1.05` (está em `HDRC` no `montar_v21.py`). Aplique, no final, só `eq=contrast=1.03:saturation=1.03` e `unsharp` leve. **Não use** bloom, grão, teal-orange nem vinheta na pessoa.

**Enquadramento da pessoa:** da **cintura para cima**, nunca pernas. Use o arquivo original em 4K (recorte `crop=1022:1816:1080:785` do IMG_2302) em vez do vídeo exportado com legenda embutida. Etiqueta de identificação acima da cabeça.

**Estrutura do vídeo 1 (≈28 s + capa de 1,2 s):**
1. Capa animada (0,8 s) e transição de lente para o vídeo. O primeiro quadro já é a capa completa.
2. Tela cheia 0 a 1,75 s com etiqueta (logo + nome + cargo) acima da cabeça; depois a pessoa encolhe para um cartão sobre fundo azul de planta animado.
3. Motion que ilustra a fala: pessoas + balão "projeto = planta" riscado com X (sincronizado com as palavras).
4. Planta 2D estilo CAD desenhada com cursor, que "sobe" em modelo 3D montado por etapas (alvenaria, laje, pintura, esquadrias, solar, paisagismo, câmera girando, etiquetas). Código em `casa.py`.
5. Palavras "MELHOR / EXPERIÊNCIA / VISUAL" e escada (Planta, Modelo, Experiência Visual) com seta "vai muito além".
6. Apontamento: B no centro com setas para operário (mão de obra) e cliente.
7. Bússola, escudo e gráfico para "nortear a obra, segurança física e orçamentária".
8. Campo de comentário "Chama no direct" digitando + confete, depois o logo completo.

**Transições aprovadas:** lente de topógrafo, parede de tijolos, linha de corte A-A, blocos virando. Uma **diferente** em cada corte. **Sons:** um por animação, nunca dois a menos de 0,6 s, pop nos cards, impacto nas palavras fortes, whoosh nas transições.

**Capa:** `capa.py` gera a imagem 1080x1920 (logo, título, "planta 2D" e "só papel" com X, cenário 3D, faixas azul e amarela). Mantenha o conteúdo importante entre y 285 e 1635 (grade 4:5 do Instagram). Entregar também o PNG para o cliente usar como capa.

**Textos de postagem:** o cliente aprovou um modelo (legenda Instagram longa e curta, TikTok curta e com pergunta, hashtags #construcaocivil #engenhariacivil #bim #projeto3d #obra #braves). Sem preço, prazo ou promessa de ganho.

## 3. Erros que NÃO devem se repetir
1. **Ler HDR como vídeo comum.** Causou cor lavada e levou a filtros que pioraram a imagem. Sempre rode `ffprobe` e veja `color_transfer` (arib-std-b67 = HLG).
2. **Assumir a função de cada arquivo.** Um vídeo de 1:45 de obra era só **b-roll do modelo 3D**, mas foi editado como vídeo principal (versão 2 descartada). **Antes de editar, pergunte para cada arquivo: é a fala principal ou só imagem de apoio?**
3. **Fita zebrada de obra na abertura:** cobria o rosto e o cliente não entendeu a função. Removida. Toda animação precisa ter um motivo ligado à fala.
4. **Transição "prédios com janelas":** poluída. Removida. Prefira transições limpas.
5. **Take longo de filmagem (mais de ~4 s) sem motion:** o cliente reclama. Troque por animação ou corte.
6. **Legenda sobre as imagens ou sobre o rosto/corpo.** Sempre fora do cartão e do rosto.
7. **Etiqueta sobre o peito / enquadramento aberto com pernas:** o cliente reprovou. Mantenha cintura para cima e etiqueta acima da cabeça.
8. **Texto estourando a caixa** ("Chama no dire" atrás do botão): meça o texto e reduza a fonte automaticamente.
9. **Nome errado ("Bravos"):** o transcritor entendeu errado e a legenda saiu errada. Revise sempre os nomes próprios na transcrição (usar `initial_prompt` com termos da fala).
10. **Inventar conteúdo** (slogan, número, cargo). Pergunte.
11. **Números na tela que não foram falados.** Só mostre número que a pessoa disse (cotas da planta saíram sem número).
12. **Arquivos pesados** (56 MB com grão). Meta: 7 a 15 MB. `crf 20 a 25`, sem grão, H.264 High, `yuv420p`, `faststart` (o app não abre prévia de arquivos fora disso).
13. **Apagar código sem querer** ao trocar um bloco: sempre conferir quadros do vídeo depois de cada edição.

## 4. Como o trabalho com o cliente deve fluir
- Uma decisão por vez, opções numeradas com a recomendação. Quando for escolha de estilo, **mande prévias em imagem** (ex.: `exemplos/previas_legendas.png`).
- Antes de renderizar o vídeo todo, teste só os primeiros segundos ou os quadros-chave e **olhe os quadros** (extraia imagens com ffmpeg e confira rosto livre, texto na zona segura, nada cortado).
- Entregue sempre com: o que mudou, o que continua igual, avisos honestos (o que é ilustração minha, o que não deu para fazer) e 2 perguntas no máximo. Lembre como salvar: "Toque no vídeo, depois em compartilhar e em Salvar vídeo."
- O cliente fala "mais motion", "mais criativo": significa mais animação **ligada à fala**, não mais efeitos soltos.

## 5. Passo a passo técnico
1. **Preparar:** `bash configurar.sh`; ponha os vídeos em `video1/original/`. Instale `pip install faster-whisper pillow numpy opencv-python-headless gdown`. Para baixar do Google Drive, o ambiente precisa liberar `drive.google.com`, `docs.google.com` e os hosts `doc-XX-1g-docs.googleusercontent.com` (use `update_environment`; hosts curinga não são aceitos). O modelo do Whisper vem de `huggingface.co` e `cas-*.xethub.hf.co`, `us.aws.cdn.hf.co`.
2. **Transcrever:** `transcrever2.py` (modelo small, `word_timestamps`, com `initial_prompt` de termos). Alinhe áudio de tomadas diferentes com correlação de envelope.
3. **Montar:** `montar_v21.py` renderiza quadro a quadro (Pillow + OpenCV) e escreve o vídeo sem áudio. Ajuste `SEGS`, `SHOTS`, textos e tempos conforme a fala nova. `casa.py` é o motor de planta CAD e do modelo 3D.
4. **Capa e abertura:** `capa.py` (imagem) e `intro.py` (capa animada + lente).
5. **Mixar:** `mix_final3.py` junta voz, efeitos, `loudnorm -14 LUFS`, grade leve e codifica. Efeitos em `video1/*.wav`.
6. **Conferir:** extraia 8 a 12 quadros, veja zona segura (y 230 a 1530, x 140 a 940), duração, som (`volumedetect`).
7. **Entregar** com o arquivo e a capa.

## 6. Arquivos desta pasta
- `PLAYBOOK.md` este guia · `configurar.sh` ajusta caminhos · `montar_v21.py` vídeo 1 final · `casa.py` planta e 3D · `capa.py` capa · `intro.py` capa animada · `mix_final3.py` áudio e export · `previa_legendas.py` prévias de estilos de legenda · `transcrever2.py` transcrição.
- `fontes/`, `logos/`, `video1/*.wav` recursos · `exemplos/` capa, prévias e o estado aprovado do vídeo 1.
- Os vídeos originais e os vídeos prontos **não** estão no repositório (são pesados); ficam no Drive do cliente.
