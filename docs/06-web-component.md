# A tela como uma tag HTML

Este documento explica como o Angular virou a tag `<tag-config>`. Cobre `tag-config/src/main.ts`, `app.ts`, `app.css`, `styles.css`, `index.html` e o `angular.json`.

## O problema

Em uma aplicação Angular comum, o framework é dono da página inteira: `bootstrapApplication` procura `<app-root>` no HTML e desenha a aplicação ali. Um micro-frontend não pode funcionar assim, porque a página pertence ao Portal.

É necessário um contrato mínimo entre os dois. A solução é um padrão do próprio navegador: **qualquer página que tenha a tag e baixe o script recebe a tela**, sem saber que ela foi feita em Angular.

```text
Portal sabe:                 Portal não sabe:
- o nome da tag              - que a tela é em Angular
- o endereço do main.js      - quais componentes existem
                             - como a tela chama a API
```

## O que o navegador oferece

"Web Components" é o nome de um conjunto de recursos nativos do navegador, sem biblioteca. Dois deles importam aqui:

| Recurso | Para que serve |
|---|---|
| **Custom Elements** | Criar tags próprias, como `<tag-config>` |
| **Shadow DOM** | Isolar o HTML e o CSS de um elemento |

### Custom Element sem Angular

Este exemplo mostra o mecanismo puro:

```js
class SaudacaoCartao extends HTMLElement {
  // Roda quando a tag entra na página.
  connectedCallback() {
    this.textContent = 'Olá!';
  }

  // Roda quando a tag sai da página.
  disconnectedCallback() {
    console.log('Removida');
  }
}

customElements.define('saudacao-cartao', SaudacaoCartao);
```

```html
<saudacao-cartao></saudacao-cartao>
```

| Método | Quando roda |
|---|---|
| `connectedCallback` | A tag entrou na página |
| `disconnectedCallback` | A tag saiu da página |
| `attributeChangedCallback` | Um atributo observado mudou |

Três regras do navegador:

- **O nome precisa ter hífen:** `tag-config` é válido; `tagconfig` não é. Isso evita conflito com tags futuras do HTML.
- **Uma tag só pode ser registrada uma vez:** registrar de novo gera um erro.
- **Não dá para remover um registro:** ele dura até a página recarregar.

Por isso, cada equipe precisa de um nome de tag único. Se duas equipes usarem o mesmo nome, a segunda falha ao registrar.

### Upgrade

O navegador aceita tags que ainda não conhece. Elas ficam vazias até a definição chegar:

```text
1. O Portal cria <tag-config>      a tag existe, mas está vazia
2. O main.js é baixado             ainda vazia
3. customElements.define(...)      o navegador acha a tag na página
4. connectedCallback roda          o Angular desenha a tela
```

Isso se chama **upgrade**, e é o motivo de o Portal poder criar a tag antes de baixar o script.

## O que o `@angular/elements` faz

Ele cria uma classe de Custom Element que dirige um componente Angular. O comportamento abaixo foi conferido no código-fonte do pacote:

| Evento da tag | O que o Angular faz |
|---|---|
| Entrou na página | Cria o componente, se ainda não existir |
| Saiu da página | Agenda a destruição para 10 ms depois |
| Voltou em menos de 10 ms | Cancela a destruição e mantém o componente |
| Atributo mudou | Atualiza o `input` correspondente |
| `output` emitiu | Dispara um `CustomEvent` na tag |

O atraso de 10 ms existe porque mover um elemento no HTML equivale a remover e adicionar. Sem ele, uma simples mudança de posição destruiria a tela.

Os nomes viram `kebab-case`: um `input` chamado `projectId` vira o atributo `project-id`. A POC ainda não usa `input` nem `output`, mas é assim que micro-frontends conversam com a Shell.

**Limite importante:** atributos HTML são sempre texto. Objetos e listas precisam ser passados por propriedade JavaScript, não por atributo.

## `main.ts` comentado

```ts
import { createCustomElement } from '@angular/elements';
import { createApplication } from '@angular/platform-browser';

import { App } from './app/app';
import { appConfig } from './app/app.config';

// O nome da tag fica em um único lugar.
const TAG_NAME = 'tag-config';

async function defineElement(): Promise<void> {
  // Evita o erro de registrar duas vezes, se o script rodar de novo.
  if (customElements.get(TAG_NAME)) {
    return;
  }

  // Inicia o Angular sem desenhar nada e aplica o appConfig (HttpClient etc.).
  const app = await createApplication(appConfig);

  // Cria a classe do Custom Element. O injector é a "caixa de dependências"
  // de onde a tela vai tirar o HttpClient e o PluginService.
  const element = createCustomElement(App, { injector: app.injector });

  // Ensina a tag ao navegador. As tags já existentes recebem o upgrade.
  customElements.define(TAG_NAME, element);
}

// A função é assíncrona, então uma falha só aparece neste catch.
defineElement().catch((error) => console.error(error));
```

| | `bootstrapApplication` | `createApplication` |
|---|---|---|
| Inicia o Angular | Sim | Sim |
| Desenha um componente | Sim, na tag do `selector` | Não |
| Quem define o momento de desenhar | O próprio Angular | O Custom Element |
| Uso típico | Aplicação dona da página | Micro-frontend |

**Por que `App`, e não `DynamicConfig`?** O `App` é a casca do micro-frontend: traz o tema e a Shadow DOM. Assim, o `DynamicConfig` continua sendo uma feature comum, que não sabe que está dentro de um Web Component.

O `selector: 'app-root'` do `App` deixou de ser usado para localizar a tag. Quem manda agora é o `TAG_NAME`, e a tela roda dentro de `<tag-config>`.

## Shadow DOM

A Shadow DOM cria uma árvore de HTML separada, presa a um elemento:

```text
<tag-config>                    elemento normal, visível para a página
  #shadow-root (open)           fronteira
    <app-dynamic-config>        só alcançável pela shadowRoot
```

`open` significa que o JavaScript de fora ainda pode entrar, por `elemento.shadowRoot`. A fronteira protege contra acidentes, não é um mecanismo de segurança.

### As três opções de encapsulamento do Angular

| Modo | Como funciona | Quem vaza |
|---|---|---|
| `Emulated` (padrão) | Angular adiciona atributos como `_ngcontent-abc` aos seletores | O CSS global ainda entra |
| `ShadowDom` | Usa a Shadow DOM real do navegador | Quase nada: só o que atravessa a fronteira |
| `None` | Nenhum isolamento | Tudo, para os dois lados |

O `App` usa `ViewEncapsulation.ShadowDom`.

### O que foi testado

Uma regra invasora foi colocada no Portal: `h1 { color: red !important }`.

| Modo | Cor do título | Resultado |
|---|---|---|
| `Emulated` | Vermelha | O CSS do Portal atingiu a tela |
| `ShadowDom` | Preta | O CSS do Portal foi barrado |

### O que atravessa a fronteira

A Shadow DOM não isola tudo. Esse é um ponto frequente em entrevistas e revisões de código:

| Atravessa | Exemplo |
|---|---|
| Propriedades herdadas | `color` e `font-family` do `body` chegam a quem não define o próprio valor |
| Variáveis CSS | Um `--cor` definido fora pode ser lido dentro |
| Eventos com `composed: true` | Um clique sobe até o `document` |

Um clique dentro da tela chega ao Portal, mas o `event.target` aparece como `<tag-config>`. Esse ajuste se chama **retargeting**: quem está fora não enxerga o interior.

É por isso que o `app.css` define `color` e `font` no `:host`: a tela não fica dependendo do que o Portal herdar.

Também é por isso que `document.querySelector('h1')` não acha o título. Um teste precisa usar `shadowRoot.querySelector('h1')`.

## Por que o tema fica no componente

O tema do Angular Material é um conjunto de variáveis CSS, como `--mat-sys-surface`. Declaradas no `html`, por um arquivo global de estilos, elas quebrariam no Portal:

```text
Portal baixa:     main.js
Portal não baixa: styles.css, onde o tema ficaria
```

Sem as variáveis, a tela ficaria sem cores. Com o tema no `:host`, as variáveis nascem na própria tag, e o `main.js` leva toda a aparência.

```css
:host {
  display: block;                              /* tags próprias nascem inline */
  color-scheme: light;                         /* resolve as cores claras do tema */
  background-color: var(--mat-sys-surface);
  color: var(--mat-sys-on-surface);
  font: var(--mat-sys-body-medium);

  --mat-sys-primary: light-dark(#005cbb, #abc7ff);
  --mat-sys-surface: light-dark(#faf9fd, #121316);
  /* ... demais variáveis --mat-sys-* do tema ... */
}
```

Originalmente, as variáveis eram geradas pelo mixin `mat.theme(...)`, em SCSS. Na migração dos estilos para CSS (commit `0dddf52`), os valores resultantes passaram a ser declarados diretamente no `:host` do `app.css`. A consequência é que o projeto não depende mais do Sass, e o custo é que uma mudança de paleta exige gerar os valores de novo.

**Custo:** o tema é repetido em cada micro-frontend. Por isso, as equipes precisam usar as mesmas paletas, ou as telas ficarão diferentes. Em um projeto real, vale publicar o tema em um pacote compartilhado.

## O risco do `mat-select`

Em versões anteriores, o painel do `select` abria em um contêiner no `body`, fora da Shadow DOM, e perdia os estilos. Por isso, esse risco foi apontado desde o início.

Na versão usada aqui, ele não se confirmou. O código-fonte do `@angular/material` define o local do painel como `'inline'` por padrão, usando o recurso nativo de **popover** do navegador:

```text
Antes: <body> → .cdk-overlay-container → painel        fora da Shadow DOM
Agora: <tag-config> → #shadow-root → ... → painel      dentro da Shadow DOM
```

O popover aparece sobre todo o restante da página mesmo estando dentro do componente, porque o navegador o coloca em uma camada superior. O teste no Chrome confirmou: o painel ficou dentro da `shadowRoot`, com fundo e fonte corretos.

**Lição:** um risco deve ser testado na versão real, porque ele pode já não existir. Vale para os dois lados: outros componentes com overlay ainda precisam ser testados.

## Mudanças no `angular.json`

### `outputHashing: "none"`

| | Com hash (padrão) | Sem hash (POC) |
|---|---|---|
| Nome do arquivo | `main-X7K2AB.js` | `main.js` |
| Muda a cada build? | Sim | Não |
| Cache do navegador | Pode ser eterno | Precisa de cuidado |
| Endereço estável para o Portal | Não | Sim |

O hash serve para o navegador saber que o arquivo mudou. Ao removê-lo, essa garantia se perde, e uma versão antiga pode ficar em cache. Por essa razão, o servidor que entregar o `main.js` em produção, como o Nginx, deve enviar `Cache-Control: no-cache` nesse arquivo. Isso ainda não está implementado nesta POC.

Uma alternativa, mais comum em produção, é manter o hash e publicar um arquivo de manifesto que informa o nome atual. Traz mais segurança de cache, com mais complexidade.

### Limite de CSS (`budgets`)

`anyComponentStyle` limita o CSS de cada componente, para evitar que o tamanho cresça sem ninguém notar. O padrão de 8 kB foi ultrapassado quando o tema passou a morar em um componente, e o limite subiu para 12 kB (aviso) e 16 kB (erro).

Aumentar um limite só é aceitável quando se entende o motivo. Aqui, a causa é conhecida e pontual.

### `serve.options`

```json
"options": {
  "port": 4202,
  "headers": {
    "Access-Control-Allow-Origin": "*"
  }
}
```

O `main.js` é baixado da origem `:3000`, e módulos JavaScript exigem CORS. Sem esse cabeçalho, o navegador bloqueia o script. O `*` é aceitável para desenvolvimento local.

## Desenvolvimento e produção

| | `ng serve` | `ng build` |
|---|---|---|
| Uso | Desenvolvimento | Publicação |
| `main.js` | Pequeno; importa vários módulos | Arquivo único |
| Tamanho | Não comparável | 468 kB, 104 kB transferidos (com compressão) |
| Observado na rede | `main.js`, `@vite/client`, `/@fs/...` | Só `main.js` |

As duas versões foram testadas dentro da Shell. Testar só o `ng serve` não bastaria, porque é o `main.js` de produção que um servidor web entregará.

## Custos desta abordagem

| Custo | Efeito | Como reduzir |
|---|---|---|
| Cada `main.js` leva o Angular inteiro | Dois micro-frontends baixam o Angular duas vezes | Module Federation ou import maps, ao custo de mais acoplamento de versões |
| Tema repetido | Mais CSS por tela | Pacote compartilhado |
| Nome de tag global | Duas equipes podem colidir | Convenção de prefixo |
| Comunicação só por atributos e eventos | Dados complexos dão mais trabalho | Contrato escrito entre as equipes |

**Module Federation** é uma técnica que compartilha dependências entre aplicações em execução. Evita baixar o Angular várias vezes, mas exige versões compatíveis. O Web Component escolhido aqui tem um custo de tamanho maior, em troca de independência.

## Erros encontrados

| Erro | Causa | Lição |
|---|---|---|
| `Cannot find module 'angular/element'` | Faltavam o `@` e o `s` | O nome do pacote precisa ser exato |
| `Cannot find module '@angular/elements'` | O pacote não foi instalado | Com o `import` certo, a causa está no `node_modules` |
| `package.json` sem o pacote | `npm i` não rodou na pasta certa | O npm instala na pasta atual |
| `TS1136: Property assignment expected` | Vírgula dupla em `styleUrl: '...',,` | Ler a linha apontada pela mensagem |
| `Unknown argument: watch` | `angular.json` com `}` faltando | A mensagem pode enganar: a causa estava em outro arquivo |
| `exceeded maximum budget` | Tema em componente | Ajustar o limite, sabendo o motivo |
| Teste não achava `h1` | Conteúdo dentro da Shadow DOM | Consultar `shadowRoot` |

## Perguntas frequentes

**Por que não usar iframe?** Isolaria tudo, mas cada tela seria uma página separada, com dificuldade para tamanho, rolagem, comunicação e acessibilidade.

**Por que não usar Module Federation?** Reduz o tamanho, mas amarra as versões entre as equipes. A POC prioriza independência e simplicidade.

**Web Component funciona fora do Angular?** Sim. O Portal é TypeScript puro e usa a tag normalmente.

**O Portal consegue ler os campos da tela?** Tecnicamente sim, porque a Shadow DOM está `open`, mas não deve. O acordo são os atributos e eventos.

**Se o Portal mudar de versão, a tela quebra?** Não, porque eles não compartilham código, só o contrato: tag, endereço e, futuramente, o token.

## Glossário

- **Custom Element:** tag HTML criada pelo desenvolvedor.
- **Upgrade:** momento em que uma tag desconhecida recebe sua definição.
- **Shadow DOM:** árvore de HTML isolada, presa a um elemento.
- **`:host`:** seletor que representa a própria tag, visto de dentro.
- **Injector:** objeto que fornece as dependências do Angular.
- **Popover:** recurso nativo que mostra um elemento acima da página.
- **Retargeting:** ajuste que esconde o interior da Shadow DOM em eventos.
- **Hash no nome do arquivo:** código que muda quando o conteúdo muda.
- **Module Federation:** compartilhamento de código entre aplicações em execução.
