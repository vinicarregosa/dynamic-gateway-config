# Service de plugins

Este documento explica a parte do Angular que conversa com a API: `app.config.ts`, `plugin.model.ts`, `plugin.service.ts` e seus testes, todos em `tag-config/src/app/`.

## Mapa das peças

```text
app.config.ts            libera o HttpClient para a aplicação
plugin.model.ts          define o formato dos dados
plugin.service.ts        chama a API usando as duas peças acima
plugin.service.spec.ts   confere o service sem servidor real
```

Fluxo de uma chamada:

```text
Componente
  │  pede os atributos de "kong"
  ▼
PluginService
  │  GET http://localhost:3001/plugins/kong/attributes
  ▼
API (mock server)
  │  { "attributes": [ ... ] }
  ▼
PluginService
  │  map retira a lista de dentro de attributes
  ▼
Componente recebe a lista e desenha os campos
```

## `app.config.ts`

```ts
// provideHttpClient disponibiliza o HttpClient para injeção.
import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';

// Configuração global, entregue ao Angular em src/main.ts.
export const appConfig: ApplicationConfig = {
  providers: [
    // Encaminha erros não tratados do navegador para o tratamento do Angular.
    provideBrowserGlobalErrorListeners(),
    // Sem esta linha, o inject(HttpClient) falha ao rodar.
    provideHttpClient(),
  ],
};
```

## `plugin.model.ts`

```ts
// Item da lista devolvida por GET /plugins.
export interface Plugin {
  id: string;   // valor usado na URL dos atributos
  name: string; // texto exibido na tela
}

// Metadado de um campo da tela.
export interface PluginAttribute {
  name: string;     // identifica o campo
  type: string;     // string porque a API pode enviar um tipo novo
  values: string[]; // opções de um select; vazia em url
  default: string;  // valor inicial
}

// Resposta completa de GET /plugins/{id}/attributes.
// A lista vem embrulhada em um objeto, por isso existem duas interfaces.
export interface PluginAttributesResponse {
  attributes: PluginAttribute[];
}
```

Uma `interface` existe só durante a compilação. Ela ajuda o editor e o build, mas não verifica a resposta real da API.

## `plugin.service.ts`

```ts
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { Plugin, PluginAttribute, PluginAttributesResponse } from './plugin.model';

// localhost porque este código roda no navegador, fora da rede Docker.
// URL fixa basta na POC; um projeto real precisa de configuração por ambiente.
const API_URL = 'http://localhost:3001';

// O decorator precisa ficar antes da classe, sem ponto e vírgula entre eles.
// providedIn: 'root' cria uma única instância para a aplicação inteira.
@Injectable({ providedIn: 'root' })
export class PluginService {
  // inject pede ao Angular o HttpClient liberado no app.config.ts.
  private readonly http = inject(HttpClient);

  // Observable representa uma resposta futura.
  // A chamada só acontece quando alguém faz subscribe.
  getPlugins(): Observable<Plugin[]> {
    // get<Plugin[]> informa ao TypeScript o formato esperado.
    return this.http.get<Plugin[]>(`${API_URL}/plugins`);
  }

  getAttributes(pluginId: string): Observable<PluginAttribute[]> {
    return this.http
      // ${...} insere um valor no texto. Só funciona com crases e chaves.
      // encodeURIComponent protege a URL contra caracteres especiais no id.
      .get<PluginAttributesResponse>(`${API_URL}/plugins/${encodeURIComponent(pluginId)}/attributes`)
      // pipe encadeia transformações; map converte cada resposta recebida.
      // Entra { attributes: [...] } e sai só a lista.
      .pipe(map((response) => response.attributes));
  }
}
```

### Por que usar um service

O componente não precisa saber URLs nem o formato da resposta. Se o endereço mudar, só o service muda. Isso também facilita o teste, porque a chamada à API fica isolada.

## Injeção de dependência

Sem injeção, cada classe criaria o que usa:

```ts
class PluginService {
  private http = new HttpClient(/* e o que ele exigir */);
}
```

O problema: a classe precisaria saber montar o `HttpClient`, e o teste não conseguiria trocá-lo. Com a injeção, a classe só **pede**, e o Angular entrega:

```ts
private readonly http = inject(HttpClient);
```

```text
provideHttpClient()          ensina a fornecer o HttpClient
inject(HttpClient)           pede o HttpClient
provideHttpClientTesting()   no teste, troca a rede real por uma simulada
```

O service não muda em nada para ser testado. Essa é a maior vantagem prática da injeção.

No Web Component, quem entrega esse injector é a linha `createCustomElement(App, { injector: app.injector })`.

## Como o tipo do `get` funciona

```ts
this.http.get<Plugin[]>(url)
```

`<Plugin[]>` é um **generic**: um tipo passado como parâmetro. Ele é uma promessa feita ao TypeScript, não uma verificação. Se a API devolver outro formato, nada avisa na compilação. O erro aparece mais tarde, ao usar o dado.

Em projetos maiores, é comum validar a resposta em execução ou gerar os tipos a partir do Swagger. Na POC, a interface basta.

## Onde o erro HTTP aparece

| Resposta | Observable |
|---|---|
| `200` | `next` recebe o corpo |
| `404` ou `500` | `error` recebe um `HttpErrorResponse` |
| Sem conexão | `error`, com `status: 0` |

O `HttpClient` trata `4xx` e `5xx` como erro. O `fetch` do Portal não faz isso, e por essa razão precisa do teste de `response.ok`.

## `plugin.service.spec.ts`

| Trecho | Função |
|---|---|
| `describe` | Agrupa os testes do service |
| `it` | Define um caso de teste |
| `beforeEach` | Roda antes de cada teste e monta o ambiente |
| `TestBed` | Cria um ambiente Angular para o teste |
| `provideHttpClientTesting()` | Troca a rede real por uma simulada |
| `HttpTestingController` | Permite controlar as chamadas simuladas |
| `expectOne(url)` | Exige exatamente uma chamada para aquela URL |
| `request.flush(dados)` | Entrega a resposta simulada |
| `httpTesting.verify()` | Falha se sobrar alguma chamada sem resposta |

Cada teste segue a mesma ordem:

```text
1. Chama o método do service e faz subscribe
2. Confere a URL e o método HTTP
3. Entrega uma resposta simulada com flush
4. Confere o resultado que o service devolveu
```

Esses testes conferem o service, não o mock. O mock é verificado com `curl`, e a integração real entre os dois é vista no navegador.

## Erros encontrados na primeira versão

| Erro | Correção | Quem detecta |
|---|---|---|
| `attributes: PluginAttributesResponse[]` | `attributes: PluginAttribute[]` | TypeScript, no editor |
| `;` depois de `@Injectable(...)` | Remover o `;` | TypeScript, no build |
| `$(API_URL)` | `${API_URL}` | Só o teste ou a execução |
| `/attributes` ausente na URL | Adicionar ao final | Só o teste ou a execução |

Para o TypeScript, qualquer texto é uma URL válida. Por isso, os dois últimos erros passariam pelo build, e é para isso que serve o teste com `expectOne`.

Ao ler uma mensagem longa do TypeScript, as últimas linhas costumam apontar a diferença real entre os tipos. O erro também pode aparecer em um arquivo e ter origem em outro: nesse caso, ele surgiu no service, mas a causa estava no model.

## Glossário

- **Injeção de dependência:** o Angular entrega um objeto pronto, em vez de a classe criá-lo.
- **Provider:** regra que ensina o Angular a fornecer algo para injeção.
- **Decorator:** anotação com `@` que adiciona informações a uma classe.
- **Observable:** valor que chega no futuro e pode ser observado com `subscribe`.
- **Mock:** substituto controlado de algo real, usado em desenvolvimento ou em testes.
