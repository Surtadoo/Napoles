# Deploy LiveDC

O projeto usa o fluxo padrao do Vite e nao depende de `wrangler.jsonc`. Isso permite hospedar o site em qualquer servico que aceite um projeto Vite/React.

## Cloudflare Pages ou outro servico de hospedagem

- **Root directory:** `/`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Production branch:** a branch que voce usa para publicar, normalmente `main`

## Build local

Para gerar os arquivos prontos para hospedagem, rode:

```bash
npm run build
```

Depois, envie somente a pasta `dist/` para o seu provedor. Em serviços com deploy conectado ao Git, informe o comando `npm run build` e a pasta de saída `dist`.

## Cloudflare Workers

Se quiser usar especificamente Workers, o Cloudflare pode gerar a configuração automaticamente pelo comando `npx wrangler deploy --x-autoconfig` após o login. Para hospedagem estática comum, prefira Cloudflare Pages com os campos acima.