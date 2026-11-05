# tag-config

Micro-frontend Angular que desenha a tela de configuração de gateways e a expõe como o Web Component `<tag-config>`.

Gerado com [Angular CLI](https://github.com/angular/angular-cli) 21.

## Comandos

```bash
npm install
npm start                      # servidor de desenvolvimento em http://localhost:4202
npm run build                  # build de produção em dist/tag-config/browser/
npx ng test --watch=false      # testes unitários, uma execução
```

A página `http://localhost:4202` mostra a tela sozinha, com a tag `<tag-config>` em `src/index.html`. Para ver a tela dentro do Portal, consulte o [README da raiz](../README.md).

A tela espera a API em `http://localhost:3001` (constante `API_URL` em `src/app/features/dynamic-config/plugin.service.ts`), que o `mock-server/` oferece.

## Estrutura

```text
src/
├── main.ts                                   registra o Custom Element <tag-config>
├── index.html                                página para rodar a tela sozinha
└── app/
    ├── app.ts                                casca: tema e Shadow DOM
    ├── app.config.ts                         providers globais (HttpClient)
    └── features/dynamic-config/
        ├── dynamic-config.ts / .html / .css  componente da tela
        ├── plugin.model.ts                   tipos Plugin e PluginAttribute
        └── plugin.service.ts                 chamadas à API
```

O build gera `main.js` sem hash no nome (`outputHashing: "none"`), para que o Portal tenha um endereço estável. Os detalhes estão em [docs/06-web-component.md](../docs/06-web-component.md).
