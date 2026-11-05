# Mock server

Este documento explica a pasta `mock-server/`, que simula a API de plugins usada pela tela.

| Arquivo | Conteúdo |
|---|---|
| `03-mock-server.md` | Mapa do mock, dados e erros encontrados |
| [`exemplos/server.comentado.mjs`](exemplos/server.comentado.mjs) | O servidor completo, comentado linha a linha |

## Como executar a versão comentada

A cópia comentada usa a porta 3101, para não disputar a 3001 com o mock real, e lê os mesmos arquivos de `mock-server/data/`.

```bash
node docs/exemplos/server.comentado.mjs
```

Em outro terminal:

```bash
curl -i http://localhost:3101/plugins
curl -i http://localhost:3101/plugins/kong/attributes
curl -i http://localhost:3101/plugins/nao-existe/attributes
```

As duas primeiras chamadas retornam `200`, e a terceira, `404`. O servidor é encerrado com `Ctrl+C`.

## Anatomia de uma conversa HTTP

Todo o trabalho do servidor é ler um pedido em texto e devolver uma resposta em texto. Com `curl -i`, é possível ver os dois lados:

```http
GET /plugins HTTP/1.1
Host: localhost:3001
Authorization: Bearer abc123
```

```http
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Content-Type: application/json

[{"id":"kong","name":"Kong"}]
```

| Parte | Exemplo | No código |
|---|---|---|
| Método | `GET` | `req.method` |
| Caminho | `/plugins` | `req.url` |
| Cabeçalhos do pedido | `Authorization` | `req.headers` |
| Status | `200` | 1º argumento de `writeHead` |
| Cabeçalhos da resposta | `Content-Type` | 2º argumento de `writeHead` |
| Corpo | O JSON | `res.end(...)` |

| Faixa de status | Significado | Exemplos usados |
|---|---|---|
| `2xx` | Sucesso | `200`, `204` |
| `4xx` | Erro do pedido | `404` |
| `5xx` | Erro do servidor | `500` |

**`404` ou `500`?** Um gateway listado em `plugins.json` cujo arquivo de atributos não existe é uma falha interna, então a resposta é `500`: a rota e o plugin existem, mas faltam dados. Um `id` fora da lista é erro do pedido, então a resposta é `404`.

## Como o CORS funciona

O CORS não protege o servidor: quem bloqueia é o navegador. Por isso, o `curl` nunca sofre esse bloqueio.

```text
1. A página em :3000 quer chamar :3001 com Authorization
2. O navegador pergunta antes: OPTIONS /plugins           preflight
3. O mock responde com os Access-Control-*                autorização
4. O navegador envia o GET de verdade
5. O navegador só entrega a resposta à página se o cabeçalho permitir
```

Pedidos simples podem ir direto, sem preflight. O cabeçalho `Authorization` torna o pedido "não simples", e é por isso que o mock já trata `OPTIONS`.

Por isso, um nome de cabeçalho escrito errado, como `Acess-Control` com um `c` a menos, não aparece no `curl`: quem lê esse cabeçalho é o navegador.

## Por que `async` não trava o servidor

O Node executa o JavaScript em uma única linha de execução. Se a leitura do arquivo travasse essa linha, todos os outros pedidos esperariam.

```text
1. await readFile(...)    o Node pede o arquivo ao sistema e libera a linha
2. Outros pedidos rodam
3. O arquivo fica pronto  a função continua depois do await
```

Esse mecanismo se chama **event loop**.

## Mapa do arquivo

```text
Importações e constantes      roda uma vez, ao iniciar
Funções auxiliares            readJson, sendJson, sendError
handleRequest                 roda a cada pedido e decide a resposta
createServer + listen         liga o servidor
```

## Caminho de um pedido

Exemplo: `GET /plugins/kong/attributes`

```text
1. createServer recebe o pedido e chama handleRequest
2. O método não é OPTIONS, então a triagem continua
3. pathname = /plugins/kong/attributes
4. A expressão regular guarda "kong"
5. O caminho não é /plugins, então a primeira rota é ignorada
6. A segunda rota é usada e encontra "kong" em plugins.json
7. O servidor lê attributes/kong.json
8. sendJson responde 200 com o conteúdo
```

Com `GET /plugins/abc/attributes`, o fluxo para no passo 6 e responde `404`.

## Tabela de respostas

| Pedido | Status | Resposta |
|---|---|---|
| `OPTIONS` em qualquer caminho | `204` | Só os cabeçalhos de CORS |
| `GET /plugins` | `200` | Lista de gateways |
| `GET /plugins/kong/attributes` | `200` | Metadados do gateway |
| `GET /plugins/nao-existe/attributes` | `404` | `Plugin não encontrado` |
| Qualquer outro pedido | `404` | `Rota não encontrada` |
| Falha inesperada, como um JSON inválido | `500` | `Erro interno do mock` |

## Arquivos de dados

Os arquivos em `mock-server/data/` fazem o papel do banco de dados da API. O Angular nunca os lê: ele só recebe o conteúdo pelos endpoints.

| Arquivo | Endpoint que o entrega |
|---|---|
| `plugins.json` | `GET /plugins` |
| `attributes/kong.json` | `GET /plugins/kong/attributes` |
| `attributes/3scale.json` | `GET /plugins/3scale/attributes` |

Cada objeto em `attributes` descreve um campo da tela:

| Propriedade | Significado |
|---|---|
| `name` | Identifica o campo |
| `type` | Define o tipo de campo: `url` ou `select` |
| `values` | Lista as opções de um `select`; fica vazia em `url` |
| `default` | Define o valor inicial |

A tela é dinâmica porque o Angular não conhece Kong nem 3scale: ele só desenha o que os metadados pedirem. Os nomes dos gateways precisam existir em algum lugar, e esse lugar é a API.

Os campos do 3scale são ilustrativos e ainda precisam ser conferidos na documentação oficial.

## Erros encontrados na primeira versão

Cada erro apareceu em um momento diferente, e essa é a parte que mais ajuda a depurar:

| Erro | Quando aparece | Mensagem | Lição |
|---|---|---|---|
| `}` de `handleRequest` fechada cedo demais | Ao iniciar | `SyntaxError: Illegal return statement` | `return` só existe dentro de uma função |
| `newDate()` sem espaço | Só no primeiro `404` | `ReferenceError: newDate is not defined` | Erro em caminho raro fica escondido até esse caminho rodar |
| `return` ausente depois de `sendJson` | Logo após um `200` | `ERR_HTTP_HEADERS_SENT` | Cada resposta só pode ser encerrada uma vez |
| `Acess-Control` com um `c` | Só no navegador | O servidor não mostra erro; o navegador bloqueia | O `curl` não aplica CORS, então não revela esse erro |

Testar só o caminho feliz não basta: é preciso testar também os erros.

## Glossário

- **Porta:** número que identifica um serviço na máquina, como a 3001.
- **Rota:** combinação de método e caminho que o servidor sabe atender.
- **Status HTTP:** código do resultado. `2xx` é sucesso, `4xx` é erro do pedido, `5xx` é erro do servidor.
- **Cabeçalho:** informação que acompanha o pedido ou a resposta.
- **CORS:** regra do navegador que controla o acesso entre origens diferentes.
- **Preflight:** pedido `OPTIONS` que o navegador faz antes de certas chamadas.
- **`async` e `await`:** forma de esperar algo demorado sem travar o programa.
- **`req` e `res`:** o pedido recebido e a resposta em construção.
