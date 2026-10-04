# LiveDC no Cloudflare Pages

## Publicar (igual antes)

- **Framework:** Vite · **Build:** `npm run build` · **Output:** `dist` · **Root:** `/`
- Branch de produção: `main`

## ⚠️ OBRIGATÓRIO pra todo mundo ver as salas: ligar o banco (KV)

Um site estático não grava arquivo. Então o LiveDC traz uma **API própria** (`functions/api/rooms.ts`)
que salva as salas num **KV do Cloudflare** — é o "arquivo na nuvem". Grátis. Leva 2 minutos:

1. Cloudflare → **Workers & Pages** → **KV** → **Create a namespace** → nome: `livedc-rooms` → Add
2. Abra o seu projeto Pages → **Settings** → **Bindings** (ou "Functions") → **Add** → **KV namespace**
   - Variable name: `LIVEDC_ROOMS` (exatamente assim, maiúsculas)
   - KV namespace: `livedc-rooms`
   - Salvar
3. **Deployments** → **Retry deployment** (ou faça um commit novo) pra ativar o binding.

Pronto. No site, o topo do lobby mostra **🟢 Banco online**. A partir daí:
- toda sala pública/privada criada é gravada em `/api/rooms`
- todo mundo, em qualquer rede, carrega de lá (atualiza sozinho a cada 8s)
- a senha nunca vai pro banco (só o hash)

Se aparecer **🔴 Erro no banco** = a API subiu mas o KV não está ligado (volte no passo 2).
Se aparecer **🟡 Sem banco** = você está num preview local/sem Functions; no Pages de verdade some.

## Testar a API

```
https://SEU-SITE.pages.dev/api/rooms
```
Deve responder `{"rooms":[...],"count":N}`. Se responder 503, o KV não está ligado.

## Ver/editar as salas na mão

Cloudflare → Workers & Pages → KV → `livedc-rooms` → **View**. Cada sala é a chave `room:CODIGO`
e a lista fica em `rooms:index`. Pode apagar chaves por ali.

## (Opcional) Usar Firebase em vez do KV

Se preferir, coloque a URL de um Realtime Database em `public/livedc-config.json` (`databaseUrl`).
Quando preenchido, ele tem prioridade sobre o KV.
