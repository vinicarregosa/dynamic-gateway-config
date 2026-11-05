# Dynamic Gateway Config

Prova de conceito de uma **tela de configuração orientada a metadados**, entregue como micro-frontend. A API informa quais gateways existem (Kong, 3scale...) e quais campos cada um exige; a interface desenha o formulário a partir dessa descrição, sem uma tela escrita para cada gateway. Adicionar um gateway novo muda dados na API, não o código do frontend.

A POC foi criada para o projeto API Center, durante uma residência de software, para servir de referência a outras equipes.

## Como funciona

```text
Navegador ──> Portal (:3000)          lê /microfrontends.json e monta a página
   │
   ├──────> tag-config (:4202)        main.js registra a tag <tag-config> (Web Component)
   │
   └──────> Mock server (:3001)       GET /plugins
                                      GET /plugins/{id}/attributes
```

1. O **Portal** lê uma lista de micro-frontends, cria a tag `<tag-config>` e baixa o `main.js` correspondente.
2. O **tag-config** é uma aplicação Angular empacotada como Web Component, com estilos isolados por Shadow DOM.
3. A tela busca os gateways e, ao clicar em um deles, os metadados dos campos. Cada metadado (`type: "url"` ou `"select"`) decide qual campo desenhar.
4. O **mock server** faz o papel da API real e serve os dados de `mock-server/data/`.

## Tecnologias

| Parte | Tecnologias |
|---|---|
| `tag-config/` | Angular 21 (signals, zoneless, formulários reativos), Angular Material, Angular Elements, RxJS |
| `portal/` | TypeScript puro e Vite |
| `mock-server/` | Node.js, apenas módulos nativos (`node:http`) |

## Estrutura

```text
dynamic-gateway-config/
├── docs/            documentação técnica, uma parte por documento
├── mock-server/     API simulada, sem dependências
├── portal/          Shell mínima que carrega os micro-frontends
└── tag-config/      micro-frontend Angular exportado como Web Component
```

## Como executar

Pré-requisito: Node.js `^20.19.0`, `^22.12.0` ou `>=24`.

Cada serviço roda em um terminal próprio, a partir da raiz do repositório:

```bash
# 1. API simulada, em http://localhost:3001
cd mock-server
node server.mjs
```

```bash
# 2. Micro-frontend, em http://localhost:4202
cd tag-config
npm install
npm start
```

```bash
# 3. Portal, em http://localhost:3000
cd portal
npm install
npm run dev
```

Depois, é só abrir `http://localhost:3000`.

## Testes e build

```bash
cd tag-config
npx ng test --watch=false     # testes do service e do componente
npm run build                 # build de produção (gera dist/tag-config/browser/main.js)

cd ../portal
npm run build                 # checagem de tipos + build
```

## Documentação

A pasta [docs/](docs/README.md) explica cada parte do código, com decisões, alternativas descartadas e erros encontrados:

1. [Arquitetura](docs/01-arquitetura.md)
2. [Projeto, execução e Git](docs/02-projeto.md)
3. [Mock server](docs/03-mock-server.md)
4. [Service de plugins](docs/04-service.md)
5. [Tela de configuração](docs/05-tela.md)
6. [Web Component](docs/06-web-component.md)
7. [Portal](docs/07-portal.md)

## Estado atual e próximos passos

Implementado: lista de gateways, formulário dinâmico (`url` e `select`), tratamento de erro e de resposta atrasada, empacotamento como Web Component e Portal que o carrega.

Ainda não implementado:

- Login com Keycloak e envio do token (`Authorization: Bearer`) pela tela.
- Salvar os valores (`PUT /plugins/{id}/configuration`).
- `docker-compose.yml` e entrega do `main.js` por Nginx.
- Endereços configuráveis por ambiente (hoje, `localhost` fixo no código).

Os campos do 3scale em `mock-server/data/` são ilustrativos e não foram conferidos na documentação oficial.
