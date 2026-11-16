#!/bin/bash
# Uso: bash configurar.sh   (rode dentro da pasta producao-braves; ajusta os caminhos dos scripts para esta pasta)
AQUI="$(cd "$(dirname "$0")" && pwd)/"
ANTIGO="/tmp/claude-0/-home-user-Braves-Bim-Field-/3f640666-8982-5ee9-9c23-19b2a7448cf6/scratchpad/edit-ia-pro/"
for f in "$AQUI"*.py; do sed -i "s#${ANTIGO}#${AQUI}#g" "$f"; done
mkdir -p "$AQUI/video1/original"
echo "Caminhos ajustados para: $AQUI"
echo "Coloque os vídeos originais em: ${AQUI}video1/original/"
