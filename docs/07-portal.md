# Portal: a Shell mínima

Este documento explica a pasta `portal/`. "Shell" é o nome do conceito na arquitetura de micro-frontends, e **Portal** é o nome dado a ela nesta POC.

## Responsabilidade

O Portal é a aplicação que recebe a pessoa e monta a página com os micro-frontends.

| Faz | Não faz |
|---|---|
| Define o cabeçalho e o fundo da página | Regra de negócio |
| Lê a lista de micro-frontends | Chamar a API de plugins |
| Cria as tags e baixa os scripts | Conhecer os componentes de cada tela |
| Mostra um erro se algo não carregar | Importar código de uma equipe |
| Cuidará do login e do token (ainda não implementado) | Decidir como cada tela é desenhada |

**Regra de ouro:** se uma mudança em uma feature exigir alterar o código do Portal, o acoplamento está errado. O ideal é mudar só a lista.

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `index.html` | Estrutura fixa: cabeçalho, `#nav` e `#outlet` |
| `src/main.ts` | Toda a lógica |
| `src/style.css` | Estilos do Portal |
| `public/microfrontends.json` | A lista de micro-frontends |
| `package.json` | Scripts e dependências de desenvolvimento |
| `tsconfig.json` | Regras do TypeScript |
| `.gitignore` | Tira `node_modules` e `dist` do Git |

## Sequência completa

```text
Navegador                    Portal (:3000)    tag-config (:4202)   Mock (:3001)
   │ GET /                        │                   │                 │
   │─────────────────────────────>│                   │                 │
   │ index.html, main.ts, CSS     │                   │                 │
   │<─────────────────────────────│                   │                 │
   │ GET /microfrontends.json     │                   │                 │
   │─────────────────────────────>│                   │                 │
   │ iniciar() cria os botões e clica no primeiro     │                 │
   │ abrirMicrofrontend() cria <tag-config>           │                 │
   │ GET /main.js                                     │                 │
   │─────────────────────────────────────────────────>│                 │
   │ customElements.define → upgrade → Angular desenha│                 │
   │ GET /plugins                                                       │
   │───────────────────────────────────────────────────────────────────>│
   │ A tela mostra os gateways                                          │
   │<───────────────────────────────────────────────────────────────────│
```

O Portal só participa dos três primeiros passos. Depois, o navegador conversa direto com o micro-frontend e com a API.

## A lista

```json
[
  {
    "tag": "tag-config",
    "title": "Configuração do Tag",
    "url": "http://localhost:4202/main.js"
  }
]
```

| Campo | Papel |
|---|---|
| `tag` | Nome da tag que o Portal vai criar |
| `title` | Texto do botão |
| `url` | Endereço do script que registra a tag |

Esse formato é o mesmo de uma Shell de referência já existente. Ele é o **contrato** entre o Portal e as equipes.

Como o arquivo está em `public/`, o Vite o entrega na raiz: `/microfrontends.json`. Isso também permite trocar a lista sem recompilar o Portal, porque ela é buscada em execução. É o mesmo raciocínio dos metadados da tela, um nível acima: dados decidem o que aparece, não o código.

**Adicionar uma feature** é só mais uma entrada:

```json
{
  "tag": "gateway-config",
  "title": "Gateways",
  "url": "http://localhost:4203/main.js"
}
```

## `src/main.ts` comentado

```ts
// Descreve um item da lista. Interfaces só existem na compilação.
interface Microfrontend {
  tag: string;
  title: string;
  url: string;
}

// O ! garante ao TypeScript que o elemento existe, pois está no index.html.
// Sem ele, o tipo seria HTMLElement | null, e cada uso exigiria um teste.
const nav = document.querySelector<HTMLElement>('#nav')!;
const outlet = document.querySelector<HTMLElement>('#outlet')!;

function mostrarMensagem(text: string): void {
  const message = document.createElement('p');
  message.className = 'portal-message';
  message.setAttribute('role', 'alert');    // leitores de tela anunciam o erro
  message.textContent = text;               // textContent não interpreta HTML
  outlet.replaceChildren(message);          // troca o conteúdo inteiro
}

function carregarScript(entry: Microfrontend): Promise<void> {
  // Promise transforma os eventos onload e onerror em algo que aceita await.
  return new Promise((resolve, reject) => {
    // Se a tag já foi registrada, não há o que baixar.
    if (customElements.get(entry.tag)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.type = 'module';                 // o main.js do Angular é um módulo
    script.src = entry.url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Falha ao carregar ${entry.url}`));
    document.head.appendChild(script);      // o download começa aqui
  });
}

async function abrirMicrofrontend(entry: Microfrontend, button: HTMLButtonElement): Promise<void> {
  // Marca só o botão atual como ativo.
  nav.querySelectorAll('button').forEach((item) => item.removeAttribute('aria-current'));
  button.setAttribute('aria-current', 'true');

  // O nome vem do JSON: o Portal não cita tag-config no código.
  // A tag entra vazia e recebe o upgrade quando o script registrar a definição.
  outlet.replaceChildren(document.createElement(entry.tag));

  try {
    await carregarScript(entry);
  } catch {
    mostrarMensagem(`Não foi possível carregar "${entry.title}".`);
  }
}

async function iniciar(): Promise<void> {
  try {
    const response = await fetch('/microfrontends.json');

    // fetch só rejeita em falha de rede. Um 404 chega como resposta normal,
    // por isso o teste de response.ok é necessário.
    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }

    const microfrontends: Microfrontend[] = await response.json();

    for (const entry of microfrontends) {
      const button = document.createElement('button');
      button.type = 'button';               // evita agir como envio de formulário
      button.textContent = entry.title;
      button.addEventListener('click', () => abrirMicrofrontend(entry, button));
      nav.appendChild(button);
    }

    // O ?. evita erro se a lista estiver vazia.
    nav.querySelector('button')?.click();
  } catch {
    mostrarMensagem('Não foi possível carregar a lista de micro-frontends.');
  }
}

// void indica que a Promise é ignorada de propósito.
void iniciar();
```

### Por que a tag entra antes do script

Dá para fazer nos dois sentidos, porque o upgrade resolve os dois casos. Criar a tag antes mantém um único caminho para o primeiro acesso e para os seguintes: na segunda abertura, a tag já é conhecida e nasce pronta.

### Por que `textContent`, e não `innerHTML`

O `title` vem de um JSON. Com `innerHTML`, um texto contendo HTML seria executado pela página, o que abre espaço para XSS (execução de código injetado). `textContent` sempre trata o valor como texto.

### Por que `type = 'module'` exige CORS

| | Script clássico | Script `type="module"` |
|---|---|---|
| Pode vir de outra origem sem CORS | Sim | Não |
| Aceita `import` | Não | Sim |
| Execução | Na ordem, pode bloquear | Adiada até o HTML ser lido |
| Modo estrito | Opcional | Sempre |

O `main.js` do Angular usa `import`, então precisa ser um módulo. Por isso, o `ng serve` e o servidor de produção precisam enviar `Access-Control-Allow-Origin`.

## Promise e Observable

O Portal usa `Promise`, e o Angular usa `Observable`. É uma comparação frequente:

| | Promise | Observable |
|---|---|---|
| Quantos valores | Um | Vários |
| Começa | Na criação | No `subscribe` |
| Cancelamento | Não tem nativo | `unsubscribe` |
| Uso aqui | Carregar um script | Cliques e chamadas com `switchMap` |
| Sintaxe | `await` | `pipe` e operadores |

O `switchMap` da tela depende do cancelamento. Com `Promise`, seria preciso proteger manualmente contra respostas atrasadas. No Portal, não há essa necessidade, então a `Promise` é a opção mais simples.

## Vite

Vite é a ferramenta de desenvolvimento e build do Portal.

| Situação | O que faz |
|---|---|
| `npm run dev` | Sobe um servidor e converte TypeScript na hora |
| `npm run build` | Gera arquivos otimizados em `dist/` |
| Pasta `public/` | Copia sem alterar, para a raiz do site |

O script de build é `tsc --noEmit && vite build`, por dois motivos:

- O Vite remove os tipos do TypeScript, mas **não os verifica**. Quem verifica é o `tsc`.
- `--noEmit` faz o `tsc` só checar, sem gerar arquivos. O `&&` impede o build se a checagem falhar.

`--strictPort` faz o Vite falhar se a porta 3000 estiver ocupada. Sem isso, ele usaria outra porta sem avisar, e o restante da configuração continuaria apontando para a 3000.

## Por que sem framework

| Opção | Ganho | Custo |
|---|---|---|
| TypeScript puro (**escolhido**) | Poucas linhas, sem acoplamento | Tudo é escrito à mão |
| Angular | Mesmo framework da tela | Portal pesado e ligado à versão do Angular |
| React | Componentes prontos | Dependência sem necessidade aqui |

Um Portal sem framework reforça a mensagem da arquitetura: cada micro-frontend pode usar a própria tecnologia. Se ele crescer, com rotas e menus complexos, a decisão pode ser revista.

## Comparação com uma Shell completa

Uma Shell de produção é mais completa. O Portal mantém só o essencial:

| Recurso | Shell completa | Portal |
|---|---|---|
| Vite e TypeScript | Sim | Sim |
| Formato da lista | `{tag, title, url}` | Igual |
| Login com Keycloak | Sim | Ainda não implementado |
| Várias telas ao mesmo tempo | Mantém montadas, esconde com CSS | Só uma, troca o conteúdo |
| Comunicação entre telas | Evento e atributo | Ainda não precisa |

**Trocar ou esconder?** Ao trocar o conteúdo com `replaceChildren`, a tag sai da página, e o Angular destrói a tela depois de 10 ms. O formulário preenchido se perde. Esconder com CSS mantém o estado, mas consome memória, e as telas continuam ativas. Com um só micro-frontend, a troca é a opção mais simples.

## Falhas e o que a pessoa vê

| Falha | Resultado |
|---|---|
| Lista não carrega | "Não foi possível carregar a lista de micro-frontends." |
| `main.js` fora do ar | `Não foi possível carregar "Configuração do Tag".` |
| Mock fora do ar | O Portal segue normal, e a tela mostra o erro dela |

Esse é o isolamento de falhas na prática: com o micro-frontend fora do ar, o cabeçalho do Portal continuou funcionando.

**Limite:** a mensagem cobre a falha de **baixar** o script. Se o `main.js` baixar e quebrar depois, o `onload` já terá sido disparado, e a área fica vazia. Tratar isso exigiria um limite de tempo ou um sinal do micro-frontend.

## Erros encontrados

| Erro | Causa | Lição |
|---|---|---|
| `No inputs were found in config file` | `main.ts` na raiz, com `include: ["src"]` | O erro indica onde o TypeScript procurou |
| `style.scss` no Portal | O Vite exigiria o pacote `sass` | A extensão define qual ferramenta é necessária |
| `.gitignore` ausente | Sem ele, o `node_modules` iria para o commit | Conferir com `git add -n` antes de um primeiro commit |
| `404` no console | Pedido automático do `favicon.ico` | `<link rel="icon" href="data:,">` resolve |
| Classes `shell-*` após renomear | Sobrou o nome antigo | Procurar as referências depois de renomear |

## Perguntas frequentes

**Por que a lista é um JSON, e não código?** Porque adicionar uma feature não deve exigir recompilar o Portal.

**O Portal é um ponto único de falha?** Sim. Se ele cair, nada abre, por isso precisa ser pequeno e estável.

**Por que o Portal chama `/microfrontends.json`, e não uma API?** Na POC, um arquivo estático basta. Em produção, a lista pode vir de um serviço, e até variar por perfil de usuário.

**Qualquer equipe pode publicar sem falar com a equipe do Portal?** Sim para versões novas, se o endereço não mudar. Uma feature nova precisa de uma entrada na lista.

**Como garantir que um script da lista é confiável?** O `main.js` roda com acesso total à página, inclusive ao token. Por isso, a lista só pode apontar para origens confiáveis, e em produção é recomendável restringi-las com a CSP (Content Security Policy).

## Glossário

- **Shell:** aplicação que hospeda os micro-frontends.
- **Portal:** nome da Shell nesta POC.
- **Outlet:** área onde o micro-frontend é exibido.
- **Módulo JavaScript:** arquivo que usa `import` e `export`.
- **Promise:** valor único que chega no futuro.
- **XSS:** ataque que injeta código em uma página.
- **CSP:** regra que limita de onde a página pode carregar recursos.
- **Build:** geração dos arquivos finais para publicação.
