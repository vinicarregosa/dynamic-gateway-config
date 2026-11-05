# mock-server

API simulada que serve os gateways e os metadados dos campos usados pela tela. Usa só módulos nativos do Node.js, então não há `npm install`.

```bash
node server.mjs                # http://localhost:3001
PORT=4000 node server.mjs      # outra porta
```

## Endpoints

| Pedido | Resposta |
|---|---|
| `GET /plugins` | `200` com a lista de gateways: `[{ "id": "kong", "name": "Kong" }, ...]` |
| `GET /plugins/{id}/attributes` | `200` com `{ "attributes": [...] }`; `404` se o `id` não existir |
| `OPTIONS` (qualquer caminho) | `204` com os cabeçalhos de CORS |
| Qualquer outro | `404` |

Os dados ficam em `data/`: `plugins.json` e um arquivo por gateway em `data/attributes/`. Para incluir um gateway, basta adicioná-lo a `plugins.json` e criar `data/attributes/{id}.json`.

```bash
curl -i http://localhost:3001/plugins
curl -i http://localhost:3001/plugins/kong/attributes
```

O CORS está aberto (`Access-Control-Allow-Origin: *`), o que serve ao desenvolvimento local, mas não à produção. Uma explicação linha a linha do servidor está em [docs/03-mock-server.md](../docs/03-mock-server.md).
