# Documentação

Esta pasta explica cada parte do código da prova de conceito. Cada documento cobre uma parte do projeto e pode ser lido de forma independente, mas a ordem abaixo vai do panorama geral ao detalhe.

| Documento | Parte do projeto | Conteúdo |
|---|---|---|
| [01-arquitetura.md](01-arquitetura.md) | Visão geral | Micro-frontends, caminho de uma requisição, contrato da API, token e decisões |
| [02-projeto.md](02-projeto.md) | Repositório e `tag-config/` | Como executar, como o projeto foi criado, fluxo de commits e como desfazer alterações |
| [03-mock-server.md](03-mock-server.md) | `mock-server/` | Conversa HTTP, CORS, estrutura do servidor, dados e erros comuns |
| [04-service.md](04-service.md) | `app.config.ts`, model e service | Injeção de dependência, tipagem, testes e erros |
| [05-tela.md](05-tela.md) | Componente `DynamicConfig` | Fluxo da tela, `switchMap`, signals, formulário reativo, testes e erros |
| [06-web-component.md](06-web-component.md) | `main.ts`, `App` e `angular.json` | Custom Elements, Shadow DOM, tema, custos e perguntas frequentes |
| [07-portal.md](07-portal.md) | `portal/` | Sequência completa, código comentado, Vite, falhas e perguntas frequentes |

## Exemplos

| Arquivo | Conteúdo |
|---|---|
| [exemplos/server.comentado.mjs](exemplos/server.comentado.mjs) | Cópia do `mock-server/server.mjs` com comentários linha a linha, executável na porta 3101 |

## Convenções

- Os documentos descrevem o estado atual do código. Quando um trecho aparece "simplificado", o texto avisa.
- Termos técnicos são definidos na primeira vez em que aparecem, e cada documento termina com um glossário.
- Cada decisão de projeto é registrada com a alternativa descartada e o custo assumido.
