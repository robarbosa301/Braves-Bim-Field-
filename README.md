# Braves-Bim-Field-
Prancheta Eletrônica para construção civil

## Braves BIM Field

App React (Vite) para levantamento de campo de edificações: níveis, paredes, portas, janelas, escadas, coberturas, ambientes com pisos/forros, visualização 3D (three.js) e exportação para JSON/CSV.

### Rodando localmente

```bash
npm install
npm run dev       # ambiente de desenvolvimento
npm run build     # build de produção em dist/
npm run preview   # serve o build de produção
```

### Limitação conhecida: sincronização entre dispositivos

O app original (criado como Artifact no claude.ai) usava a API `window.storage` do runtime de Artifacts para sincronizar dados entre tablet e celular em tempo real. Essa API não existe fora do claude.ai, então aqui ela falha silenciosamente (try/catch) e o app funciona **por dispositivo**, salvando localmente via IndexedDB — sem sincronização entre aparelhos.

Para restaurar a sincronização em tempo real (multi-dispositivo) é necessário um backend próprio (Firebase, Supabase, um serviço WebSocket, etc.) substituindo as funções `safeGet`/`safeSet`/`safeList`/`safeDelete` em `src/App.jsx`.
