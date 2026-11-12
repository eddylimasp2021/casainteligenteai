# 🚀 Deploy Profissional na Vercel (100% Independente do Lovable)

Este guia prático mostra como publicar o **Casa Inteligente AI** na **Vercel** com suporte a rotas SPA (TanStack Router), HTTPS automático e integração com o túnel Cloudflare CFTV.

---

## 🛠️ Passo 1: O arquivo de configuração (`vercel.json`)
O arquivo `vercel.json` **já foi criado e enviado para o seu GitHub** (`commit 2c4e382`). Ele garante que rotas como `/dvr-nvr`, `/devices` e `/dashboard` não dêem erro 404 ao recarregar a página.

---

## 🌐 Passo 2: Importar o Projeto na Vercel

1. Acesse **[vercel.com](https://vercel.com)** e faça login com a sua conta do **GitHub**.
2. Clique no botão **"Add New..."** ➔ **"Project"**.
3. Na lista de repositórios do seu GitHub, localize:
   👉 **`casainteligenteai`** (ou `eddylimasp2021/casainteligenteai`)
4. Clique em **"Import"**.

---

## ⚙️ Passo 3: Configurar o Projeto na Vercel

Na tela de configuração que se abrirá:

1. **Framework Preset:** Selecione **`Vite`**.
2. **Root Directory:** Mantenha `./` (padrão).
3. **Build Command:** `npm run build` (ou `vite build`).
4. **Output Directory:** `dist`.

### 🔑 Passo 4: Adicionar as Variáveis de Ambiente (Environment Variables)

Expanda a seção **"Environment Variables"** na Vercel e adicione as seguintes chaves do seu arquivo `.env`:

| Key (Nome da Variável) | Onde pegar o valor |
| :--- | :--- |
| `VITE_SUPABASE_URL` | Copie do seu arquivo `.env` local |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Copie do seu arquivo `.env` local |
| `VITE_SUPABASE_PROJECT_ID` | Copie do seu arquivo `.env` local |

> *(Nota: Todas com o prefixo `VITE_` são expostas ao frontend para comunicação com o banco de dados Supabase em tempo real).*

---

## 🚀 Passo 5: Clicar em "Deploy"

1. Clique no botão azul **"Deploy"**.
2. A Vercel vai instalar os pacotes, compilar o código Vite e em menos de 1 minuto vai gerar o link oficial do seu sistema:
   `https://casainteligenteai.vercel.app` (ou o nome que você escolher).

---

## 🔒 Passo 6: Integração com Cloudflare (CFTV 100% Plug & Play)

Para que o seu site na Vercel fale com as câmeras da sua casa sem depender de nada manual:

1. **Quando você abrir o site da Vercel pela primeira vez:**
   - Acesse `https://seu-projeto.vercel.app/dvr-nvr`.
   - Clique em **`⚡ 1-Clique Auto-Reconectar`** ou configure o link gerado pelo `INICIAR_CFTV_1_CLIQUE.bat`.
2. Como o Gateway sincroniza o link do túnel no Supabase na nuvem, **todas as pessoas que acessarem pelo link da Vercel (no celular, tablet ou outro PC) já carregarão as câmeras conectadas automaticamente!**

---

## 🎯 Vantagens de rodar na Vercel:
- **Zero custo:** Plano Hobby gratuito suporta tráfego ilimitado de CDN.
- **Domínio Próprio:** Você pode colocar `cftv.seudominio.com.br` ou `app.suacasa.com` com SSL grátis emitido em segundos.
- **Git Push Contínuo:** Toda alteração que enviarmos para o GitHub atualiza o site na Vercel automaticamente em tempo real!
