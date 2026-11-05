# portal

Shell mínima em TypeScript puro. Lê `public/microfrontends.json`, cria um botão para cada item e, ao clicar, insere a tag do micro-frontend e baixa o script que a registra.

```bash
npm install
npm run dev                    # http://localhost:3000 (falha se a porta estiver ocupada)
npm run build                  # checagem de tipos (tsc) + build do Vite
```

## Lista de micro-frontends

`public/microfrontends.json`:

```json
[
  {
    "tag": "tag-config",
    "title": "Configuração do Tag",
    "url": "http://localhost:4202/main.js"
  }
]
```

Adicionar uma tela é incluir uma entrada nessa lista, sem alterar o código do Portal. O funcionamento completo está em [docs/07-portal.md](../docs/07-portal.md).
