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

### Sincronização entre dispositivos (Firebase)

O app original (criado como Artifact no claude.ai) usava a API `window.storage` do runtime de Artifacts para sincronizar dados entre tablet e celular em tempo real. Essa API não existe fora do claude.ai — o projeto agora usa **Firebase Firestore** no lugar dela (`src/firebase.js` + `src/storage.js`).

Sem configurar o Firebase, o app funciona normalmente, mas cada dispositivo salva só localmente (IndexedDB), sem sincronizar com outros aparelhos.

#### Como configurar

1. Crie um projeto gratuito em [console.firebase.google.com](https://console.firebase.google.com).
2. No menu lateral, abra **Firestore Database** → **Criar banco de dados** → escolha uma região e inicie em **modo de teste** (regras abertas por 30 dias — ajuste depois, veja abaixo).
3. Em **Configurações do projeto** (ícone de engrenagem) → **Geral** → seção "Seus apps", clique no ícone `</>` (Web) para registrar um app e copiar as credenciais (`apiKey`, `authDomain`, `projectId`, etc.).
4. Copie `.env.example` para `.env` e cole os valores:
   ```bash
   cp .env.example .env
   ```
5. Rode `npm run dev` (ou `npm run build`) normalmente — as variáveis `VITE_FIREBASE_*` são lidas automaticamente pelo Vite.

#### Regras de segurança do Firestore

O app não tem autenticação de usuário (o "código do projeto" de 4 letras é o único controle de acesso, assim como no app original). Para uso pessoal/testes, regras abertas por tempo limitado (modo de teste) já bastam. Para produção, restrinja pelo menos a estrutura de chaves usadas — coleção `kv` (dados dos projetos) e `projects` (índice pesquisável por nome, usado pelo add-in de Revit) — por exemplo:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /kv/{key} {
      allow read, write: if true; // ajuste conforme sua necessidade de segurança
    }
    match /projects/{code} {
      allow read, write: if true; // ajuste conforme sua necessidade de segurança
    }
  }
}
```

Como não há autenticação por trás do próprio dado (o login abaixo é só uma conveniência de "achar meus projetos", não uma trava de acesso), qualquer pessoa com o código do projeto (ou que descubra a chave do Firebase) pode ler/escrever esses dados — é a mesma limitação de segurança que o app já tinha originalmente como Artifact.

### Login com Google (opcional — sincroniza "Meus Projetos" entre aparelhos)

Sem login, "Meus Projetos" (na tela inicial) só lista o que foi criado/aberto NESTE aparelho (IndexedDB). Com login pelo Google (`src/auth.js`), a mesma lista passa a acompanhar a conta: criar ou abrir um projeto logado grava o vínculo em `kv/user-projects:{uid}` (mesma coleção `kv` de cima, sem regra nova), e outro aparelho logado na mesma conta puxa esses códigos e mescla com o que já tem localmente. O app funciona 100% sem login — é opcional, e só aparece quando o Firebase está configurado.

#### Como ativar

1. No [console do Firebase](https://console.firebase.google.com), abra **Authentication** → **Sign-in method** (primeira vez: clique em "Get started").
2. Ative o provedor **Google**, escolha um e-mail de suporte do projeto e salve.
3. Em **Authentication → Settings → Authorized domains**, adicione o domínio onde o app é servido (por padrão `localhost` e os domínios `.firebaseapp.com`/`.web.app` já vêm liberados — um domínio próprio, como `usuario.github.io`, precisa ser adicionado manualmente ou o login falha com "auth/unauthorized-domain").

Usa `signInWithRedirect` (não popup) porque um popup de login costuma não abrir dentro de um PWA instalado em tela cheia no iOS — o redirect sempre funciona, mesmo nesse caso.

### Monitoramento de erros (Sentry)

Erros que acontecem no celular/tablet de quem está usando o app em campo não aparecem em lugar nenhum por padrão — ninguém está com o console do navegador aberto. O app reporta esses erros automaticamente pro [Sentry](https://sentry.io) quando configurado (`src/main.jsx`), incluindo uma tela de fallback (em vez de tela branca) caso o app quebre de vez.

Sem configurar, o app funciona normalmente, só não reporta nada.

#### Como configurar

1. Crie uma conta gratuita em [sentry.io](https://sentry.io) e um projeto da plataforma **React**.
2. Copie a DSN em **Settings → Projects → (seu projeto) → Client Keys (DSN)**.
3. Adicione `VITE_SENTRY_DSN=` (com o valor da DSN) no seu `.env`.

### Abrindo os levantamentos no Revit

Na aba **Sincronização**, o botão **JSON** exporta `levantamento_bim.json` com
toda a geometria do levantamento já convertida para metros (paredes, portas,
janelas, ambientes por nível), pronto para ser lido programaticamente.

Veja **[`revit-addin/`](revit-addin/)** para o add-in de Revit 2024 que lê
esse arquivo e cria os níveis/paredes/portas/janelas/ambientes direto no
projeto Revit aberto. É um projeto C# separado — precisa ser compilado no
Windows com Visual Studio (instruções completas no README daquela pasta).
