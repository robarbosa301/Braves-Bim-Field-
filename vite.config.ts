import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  // Publicado no GitHub Pages em https://<usuário>.github.io/Braves-Bim-Field-/ — um "projeto de
  // site" (não um domínio próprio), então o build de produção precisa do prefixo do nome do
  // repositório nos assets. Só se aplica ao build (`npm run build`) — no servidor de
  // desenvolvimento (`npm run dev`) continua servindo na raiz, como sempre.
  base: command === 'build' ? '/Braves-Bim-Field-/' : '/',
  plugins: [react()],
  server: {
    host: true,
  },
}));
