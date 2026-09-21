# Hospedar o LiveDC

Este projeto é um site Vite/React puro, sem `wrangler.jsonc`.
Use **Cloudflare Pages** (não Workers).

## Configuração no Cloudflare Pages

- **Framework preset:** Vite
- **Root directory:** `/`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Branch de produção:** `main`

É só conectar o repositório e fazer o deploy. Não precisa de `wrangler deploy`.

## Por que aparecia `dist/wrangler.json` no log?

Aquela mensagem não era erro. O build tinha dado certo (`✓ built in 3.28s`).

O trecho:

> Using redirected Wrangler configuration.
> Configuration being used: "dist/wrangler.json"
> Original user's configuration: "wrangler.jsonc"

aparece quando o projeto está ligado como **Workers** e ainda existe um `wrangler.jsonc` antigo no Git ou no cache do Cloudflare.

Para resolver:

1. Garanta que não existe mais `wrangler.jsonc`, `wrangler.json`, `wrangler.toml` ou pasta `.wrangler` no repositório.
2. No painel do Cloudflare, crie o projeto como **Pages**, não como **Workers**.
3. Se já criou como Workers, desconecte ou crie um novo projeto Pages apontando para o mesmo repositório.
4. Faça um novo commit para forçar um build limpo.
