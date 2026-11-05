# Arquitetura: mapa do sistema e contrato

Este documento descreve como as peças do projeto se conectam e o que a prova de conceito (POC) trata como fato ou como hipótese.

## Objetivo da POC

A POC valida uma tela de configuração orientada a metadados: a API informa quais campos existem para cada gateway, e a interface os desenha sem ter uma implementação específica para cada um. O resultado serve de referência para equipes que precisem construir telas semelhantes dentro de um portal de micro-frontends.

## Micro-frontends

Um micro-frontend divide uma tela grande em aplicações menores, publicadas separadamente. A **Shell** é a aplicação principal: faz o login, monta o menu e carrega as outras aplicações sem conhecer o código delas.

O que define um micro-frontend é a independência de build e publicação, não o local da pasta:

- Cada aplicação tem o próprio `package.json` e o próprio build.
- Cada uma roda no próprio container e na própria porta.
- A Shell não importa código do micro-frontend: conhece só o endereço e a tag HTML.
- Uma aplicação pode ser alterada e publicada sem recompilar a outra.

| Ganho | Custo |
|---|---|
| Cada equipe publica de forma independente | Cada `main.js` carrega a própria cópia do Angular |
| A Shell não depende do framework de cada equipe | É preciso configurar CORS e endereços |
| Uma falha fica mais isolada | A comunicação depende de contratos, como eventos e atributos |

Para poucas telas de uma única equipe, um único projeto Angular seria mais simples. Micro-frontends compensam quando várias equipes precisam evoluir e publicar sem depender umas das outras.

## Código e dados

- **Código:** o `ng build` gera arquivos prontos, como `main.js`. Um servidor web, como o Nginx, apenas os entrega ao navegador.
- **Dados:** o código roda no navegador e chama a API, que aplica as regras de negócio. Em um ambiente real, esse papel é de uma aplicação como o Spring. Nesta POC, é do mock server.

## Caminho de uma requisição em uma Shell de referência

O exemplo abaixo descreve uma Shell já existente, com login por Keycloak e dois micro-frontends, que serviu de referência para esta POC.

```text
1. Navegador -> shell :3000           index.html e JS da Shell     CÓDIGO
2. Navegador -> keycloak :8080        login e retorno com token    AUTENTICAÇÃO
3. Navegador -> shell :3000           /microfrontends.json         CONFIGURAÇÃO
4. Shell cria os botões e as tags <project-list> e <member-manager> no HTML
5. Navegador -> project-list :4200    main.js do 1º item da lista  CÓDIGO
6. Clique -> member-manager :4201     main.js                      CÓDIGO
7. main.js registra <member-manager> e o Angular desenha a tela
8. Navegador -> mock-members :3002    /members?projectId=...       DADOS
```

O passo 4 cria tags que o navegador ainda não conhece, então elas ficam vazias. No passo 7, `customElements.define` ensina ao navegador o que aquela tag significa, e o elemento que já estava na página ganha vida. Esse processo se chama **upgrade**.

## Conceitos do caminho

- **Web Component:** tag HTML personalizada. Qualquer página pode usá-la, sem saber que foi feita em Angular.
- **CORS:** regra do navegador que controla o acesso entre origens diferentes.
- **Origem:** combinação de protocolo, domínio e porta. `:3000` e `:4201` são origens distintas.
- **Origem de execução:** um `main.js` servido pela porta 4201 roda na página da 3000, então suas chamadas partem da origem 3000.
- **Rede Docker:** liga os containers entre si. O navegador fica fora dela, por isso o código chama `localhost`, e não o nome do container.
- **Comunicação entre micro-frontends:** eles não se importam diretamente. Um dispara um evento, e a Shell repassa o dado por atributo.

## Ambiente de desenvolvimento e produção

| Camada | Desenvolvimento (POC) | Produção (esperado) |
|---|---|---|
| Entrega do frontend | Nginx em Docker | Nginx em containers |
| API | Mock server | Principalmente Spring |
| Execução dos containers | Docker Compose | Kubernetes |

- **Cluster:** conjunto de máquinas operado como uma só plataforma.
- **Kubernetes:** distribui os containers nessas máquinas e os reinicia quando falham.
- **API Gateway:** porta de entrada para as APIs, com regras como autenticação e limite de requisições. Kong e 3scale são exemplos.

## Estrutura do repositório

```text
dynamic-gateway-config/
├── docs/                  documentação
├── mock-server/           API simulada
├── portal/                Shell mínima
└── tag-config/            micro-frontend Angular
```

"Shell" é o nome do conceito, e **Portal** é o nome dado a ela nesta POC. A lista de micro-frontends fica em `portal/public/microfrontends.json`, porque quem a entrega é o próprio Portal.

**Decisão:** `portal/` e `tag-config/` ficam como pastas irmãs no mesmo repositório, para que um único clone rode tudo. Em um projeto real, cada equipe é dona do próprio micro-frontend, e repositórios separados são o mais comum nesse cenário.

## Caminho de uma requisição na POC

```text
1. Navegador -> portal :3000        index.html e JS do Portal     CÓDIGO
2. Navegador -> portal :3000        /microfrontends.json          CONFIGURAÇÃO
3. Portal cria o botão e a tag <tag-config>
4. Navegador -> tag-config :4202    main.js                       CÓDIGO
5. main.js registra <tag-config>, e o Angular desenha a tela
6. Navegador -> mock :3001          GET /plugins                  DADOS
7. Clique em Kong
8. Navegador -> mock :3001          GET /plugins/kong/attributes  DADOS
9. A tela desenha os campos a partir dos metadados
```

Nos passos 6 e 8, a origem da chamada é `:3000`, mesmo com o código tendo vindo da `:4202`. Por isso, o mock precisa autorizar essa origem por CORS.

## Decisões da POC

| Decisão | Alternativa descartada | Motivo |
|---|---|---|
| Web Component | iframe | Mantém a tela integrada à página |
| Web Component | Module Federation | Mais independência entre equipes, ao custo de um `main.js` maior |
| Shadow DOM | `Emulated` | Testado: o encapsulamento emulado não barrou o CSS do Portal |
| Metadados vindos da API | Tela específica por gateway | Um gateway novo muda dados, não código |
| Portal em TypeScript puro | Angular ou React | Pequeno e sem acoplamento |
| Mock próprio com `node:http` | Express ou json-server | Sem dependências, e o CORS fica visível |
| Monorepo | Repositórios separados | Um clone roda tudo |

Toda decisão acima tem custo. Registrar o que foi perdido é tão importante quanto registrar o que foi ganho.

## Por que uma POC do zero

Um formulário com campos fixos, como o de um CRUD comum, não foi reaproveitado. Copiá-lo reproduziria um padrão que a POC pretende evitar: uma tela por gateway, com os campos escritos no código.

## Fatos e hipóteses

### Fato: o Swagger do Tag

A API de tags usada como referência documenta tags, backends e integrações, mas não tem a configuração dinâmica. O arquivo Swagger é de uso interno e não faz parte deste repositório.

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "name": "Produção",
  "description": "Tag para ambientes de produção",
  "type": "Ambiente"
}
```

- Uma tag é uma classificação aplicada a um backend, ligada por `tagIds`.
- `GET /v1/tags` responde paginado, com os itens em `content`.
- A autenticação é por JWT do Keycloak, no cabeçalho `Authorization: Bearer ...`.

Termos úteis para ler um Swagger:

| Termo | Significado |
|---|---|
| `$ref` | Aponta para um modelo definido em outra parte do arquivo |
| `required` | Lista os campos obrigatórios |
| `readOnly` | O servidor gera o valor, e ele não é enviado na criação |
| `minLength: 1` | Impede texto vazio |

### Hipótese: o contrato da configuração dinâmica

| Operação | Endpoint | Status |
|---|---|---|
| Listar gateways | `GET /plugins` | Implementada |
| Buscar metadados | `GET /plugins/{pluginId}/attributes` | Implementada |
| Salvar valores | `PUT /plugins/{pluginId}/configuration` | Etapa adicional |

```json
{ "name": "environment", "type": "select", "values": ["development", "production"], "default": "development" }
```

Esses nomes vêm do briefing da POC e valem até a validação com a equipe responsável pela API. O formato `{ "id": "kong", "name": "Kong" }`, da lista de gateways, foi uma proposta para preencher o que o briefing não definiu.

## Metadado e valor

| Nível | Exemplo | Função |
|---|---|---|
| Metadado | "Existe um campo `endpoint`, do tipo `url`" | Diz ao Angular o que desenhar |
| Valor | `"https://kong.exemplo.local"` | É o que a pessoa preenche |

"Dinâmico" descreve a tela, não os dados. Kong e 3scale precisam existir em algum lugar, e esse lugar é a API. A diferença está em quem conhece esses nomes:

| Abordagem | Onde "Kong" aparece | Para adicionar um gateway |
|---|---|---|
| Fixa | No código da tela | Alterar o Angular e publicar de novo |
| Dinâmica | Só nos dados da API | Adicionar dados na API |

## Identificação e token

O token do Keycloak funciona como um crachá digital: a pessoa faz login uma vez, e cada chamada à API o apresenta no cabeçalho.

```text
1. A pessoa faz login no Keycloak pela Shell
2. O Keycloak entrega o token à Shell
3. Cada chamada da tela envia: Authorization: Bearer <token>
4. A API confere o token e sabe quem está pedindo
```

O token não fica no formulário porque expira, pertence à pessoa e não ao gateway, e é uma credencial. Na Shell de referência, o token ainda não é entregue aos micro-frontends, então a Shell mínima da POC precisará construir essa conexão. Hoje, a tela **não envia** o cabeçalho `Authorization`.

## Questões em aberto

**Dependem de validação com a equipe responsável pela API:**

1. Em qual API e entidade a configuração dinâmica deve ficar?
2. Como as tags com UUID do Swagger se relacionam com as `tags: string[]` do gateway?
3. Por que `/v1/backends` existe em duas APIs, com modelos diferentes?
4. A identificação é só o login pelo Keycloak, ou a tela precisa de um campo para uma credencial do gateway?
5. O cluster de produção é o OpenShift, plataforma baseada em Kubernetes? Ainda não foi confirmado.

**Dependem de conferência na documentação oficial:** os termos `adminPortal`, `deployment`, `hosted` e `self-managed` do mock do 3scale, que foram escritos de memória.

## Resumo

A Shell autentica o usuário e lê uma lista de micro-frontends. O navegador baixa o código de cada um e registra a tag correspondente. Esse código roda na página e chama a API. Nesta POC, a API informa os gateways e os campos de cada um, e a tela os desenha a partir desses metadados. Por isso, um gateway novo muda os dados, não o código da tela.
