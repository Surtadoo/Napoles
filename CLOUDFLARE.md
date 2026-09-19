# Deploy LiveDC no Cloudflare Workers

O projeto ja esta configurado para publicar o build estatico no Worker `napoles` usando Workers Static Assets.

## Pela tela de Builds do Cloudflare

- **Root directory:** `/`
- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`
- **Production branch:** a branch que voce usa para publicar, normalmente `main`

O arquivo `wrangler.jsonc` aponta os arquivos gerados em `dist/` para o Worker `napoles` e configura o fallback de SPA para `index.html`.

## Pelo terminal local

Depois de autenticar na conta correta, rode:

```bash
npx wrangler login
npm run build
npx wrangler deploy
```

O comando de deploy deve ser executado na raiz do projeto. O Wrangler vai publicar o conteudo de `dist/` no Worker configurado.

## Observacao importante

Este repositorio nao consegue acessar o painel privado nem publicar diretamente sem uma sessao ou token da sua conta Cloudflare. Nao coloque um token no codigo ou no Git; use o login do Wrangler ou as variaveis secretas do Cloudflare Builds.