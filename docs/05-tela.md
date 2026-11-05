# Tela de configuração

Este documento explica o componente `DynamicConfig`, em `tag-config/src/app/features/dynamic-config/`.

## Como a tela funciona

| Momento | O que a pessoa vê | O que acontece por trás |
|---|---|---|
| Abre a tela | Barra de carregamento, depois a lista | `GET /plugins` |
| Clica em um gateway | Item destacado, barra de carregamento, depois os campos | `GET /plugins/{id}/attributes` |
| Troca de gateway | Saem os campos antigos e entram os novos | Formulário novo, sem os valores anteriores |
| Clica rápido em vários | Só os campos do último | `switchMap` cancela a chamada anterior |
| Clica de novo no mesmo | Nada muda | A chamada é ignorada, e o que foi digitado continua lá |
| A API falha | Mensagem de erro | Na lista de atributos, clicar de novo tenta outra vez |
| Chega um tipo desconhecido | Aviso naquele campo; os demais continuam | O caso `@default` do template |

## Responsabilidades

| Peça | Responsabilidade | O que não faz |
|---|---|---|
| `dynamic-config.ts` | Guarda o estado e reage aos cliques | Não conhece URLs |
| `dynamic-config.html` | Desenha a tela conforme o estado | Não chama a API |
| `plugin.service.ts` | Conversa com a API | Não sabe como a tela é |
| API (mock) | Decide quais gateways e campos existem | Não sabe que o Angular existe |

**A ideia da POC:** nenhum arquivo do Angular cita Kong ou 3scale. Um gateway novo muda só os dados da API.

O `App` é a casca do micro-frontend: traz o tema e a Shadow DOM, e renderiza o `DynamicConfig`. Veja [06-web-component.md](06-web-component.md).

## Fluxo de um clique

```text
Clique no botão
  │  (click)="selectPlugin(plugin)"
  ▼
selectPlugin          ignora o clique repetido no mesmo gateway
  │  pluginSelection.next(plugin)
  ▼
Subject               canal que recebe cada seleção
  ▼
tap                   marca o gateway, limpa os campos, status = carregando
  ▼
switchMap             chama a API e cancela a chamada anterior
  │  catchError trata a falha daquela chamada
  ▼
subscribe             monta o formulário, guarda os atributos, status = pronto
  ▼
Template              os signals mudaram, e o Angular redesenha os campos
```

## `dynamic-config.ts` comentado

O trecho abaixo reproduz o essencial do arquivo, com comentários explicativos.

```ts
// Estados possíveis de um carregamento. Um único valor evita combinações
// impossíveis, como "carregando" e "erro" ao mesmo tempo.
type LoadStatus = 'aguardando' | 'carregando' | 'pronto' | 'erro';

@Component({
  // Nome da tag que representa este componente no HTML.
  selector: 'app-dynamic-config',
  // Tudo o que o template usa precisa estar listado aqui.
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    MatProgressBarModule,
    MatSelectModule,
    ReactiveFormsModule,
  ],
  templateUrl: './dynamic-config.html',
  styleUrl: './dynamic-config.css',
})
export class DynamicConfig {
  // private: só esta classe usa. O template não precisa acessar.
  private readonly pluginService = inject(PluginService);

  // Subject é um canal: next() envia um valor e o subscribe recebe.
  private readonly pluginSelection = new Subject<Plugin>();

  // protected: o template pode ler. Com private, o build falha.
  // signal é uma caixa com um valor: lê com plugins() e altera com plugins.set().
  protected readonly plugins = signal<Plugin[]>([]);
  protected readonly pluginStatus = signal<LoadStatus>('carregando');
  protected readonly selectedPlugin = signal<Plugin | null>(null);

  protected readonly attributes = signal<PluginAttribute[]>([]);
  protected readonly attributeStatus = signal<LoadStatus>('aguardando');

  // FormRecord aceita campos definidos em execução, vindos dos metadados.
  protected readonly form = signal(new FormRecord<FormControl<string>>({}));

  constructor() {
    this.pluginService
      .getPlugins()
      // Encerra a assinatura quando o componente sai da tela.
      .pipe(takeUntilDestroyed())
      // subscribe dispara a chamada. Sem ele, nada é enviado à API.
      .subscribe({
        next: (plugins) => {
          this.plugins.set(plugins);
          this.pluginStatus.set('pronto');
        },
        error: () => this.pluginStatus.set('erro'),
      });

    this.pluginSelection
      .pipe(
        // tap faz uma ação no caminho, sem alterar o dado.
        tap((plugin) => {
          this.selectedPlugin.set(plugin);
          this.attributes.set([]);
          this.attributeStatus.set('carregando');
        }),
        // switchMap troca a chamada antiga pela nova e cancela a antiga.
        // Assim, uma resposta atrasada não sobrescreve o gateway atual.
        switchMap((plugin) =>
          this.pluginService.getAttributes(plugin.id).pipe(
            // catchError fica aqui dentro de propósito. Fora do switchMap,
            // o erro encerraria o fluxo e os próximos cliques parariam.
            catchError(() => {
              this.attributeStatus.set('erro');
              // EMPTY termina esta chamada sem emitir nada.
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((attributes) => {
        // A ordem importa: o formulário precisa existir antes dos campos.
        this.form.set(this.buildForm(attributes));
        this.attributes.set(attributes);
        this.attributeStatus.set('pronto');
      });
  }

  protected selectPlugin(plugin: Plugin): void {
    // ?. evita erro quando nenhum gateway foi selecionado (null).
    const isSamePlugin = plugin.id === this.selectedPlugin()?.id;

    // Repetir o clique apagaria o que foi digitado. Depois de um erro,
    // o clique é permitido porque funciona como nova tentativa.
    if (isSamePlugin && this.attributeStatus() !== 'erro') {
      return;
    }

    this.pluginSelection.next(plugin);
  }

  // Cria um formulário novo a cada gateway.
  // É isso que impede os valores antigos de passarem para o próximo.
  private buildForm(attributes: PluginAttribute[]): FormRecord<FormControl<string>> {
    const form = new FormRecord<FormControl<string>>({});

    for (const attribute of attributes) {
      // O name do metadado vira a chave do campo, e default vira o valor inicial.
      // nonNullable faz o campo voltar ao default, e não a null, se for reiniciado.
      form.addControl(attribute.name, new FormControl(attribute.default, { nonNullable: true }));
    }

    return form;
  }
}
```

## Aprofundamento: por que `switchMap`

O RxJS tem quatro operadores parecidos. A diferença é o que fazem quando chega um clique novo com uma chamada ainda em andamento:

| Operador | Comportamento | Bom para |
|---|---|---|
| `switchMap` | Cancela a anterior | Busca e seleção: só a última importa |
| `mergeMap` | Roda todas ao mesmo tempo | Tarefas independentes |
| `concatMap` | Enfileira, uma por vez | Salvamentos em ordem |
| `exhaustMap` | Ignora o novo até terminar | Botão de enviar, contra clique duplo |

Sem o `switchMap`, a tela teria uma **condição de corrida**: clicar em Kong, que demora, e depois em 3scale, que responde rápido, faria o Kong chegar por último e sobrescrever a tela. Esse caso foi testado no Chrome, com atraso artificial na resposta do Kong.

**Por que o `catchError` fica dentro?** Um erro encerra o Observable. Fora do `switchMap`, a primeira falha encerraria o fluxo principal, e nenhum clique funcionaria depois. Dentro, só a chamada interna termina, e o `Subject` continua vivo.

## Aprofundamento: signals e Observables

| | Signal | Observable |
|---|---|---|
| Representa | Um valor atual | Eventos ao longo do tempo |
| Leitura | `plugins()` | `subscribe` |
| Tem sempre um valor? | Sim | Não |
| Uso na tela | Estado exibido | Cliques e chamadas à API |

A regra da tela: **Observable para o que acontece, signal para o que está**. O fluxo termina gravando em um signal, e o template só lê signals.

Este projeto é **zoneless**: sem `zone.js`, o Angular não detecta mudanças sozinho. Quando um signal muda, ele avisa o template que o lê. Por isso, guardar a resposta em uma propriedade comum não atualizaria a tela.

## Aprofundamento: formulário reativo

Existem duas formas de fazer formulário no Angular:

| | Template-driven (`ngModel`) | Reativo (`FormControl`) |
|---|---|---|
| Onde é definido | No HTML | No TypeScript |
| Campos dinâmicos | Difícil | Natural |
| Testes | Dependem da tela | Direto na classe |

Um formulário com campos fixos funciona bem com `ngModel`. Aqui, os campos só são conhecidos em execução, por isso o reativo é a escolha adequada.

O `FormRecord` é um `FormGroup` em que todas as chaves têm o mesmo tipo e podem ser criadas depois. Um `form.getRawValue()` produziria o objeto que iria no `PUT`:

```json
{ "endpoint": "https://kong.exemplo.local", "environment": "development" }
```

## `dynamic-config.html`: o trecho principal

O trecho abaixo está simplificado, sem as classes e os atributos de aparência, para destacar a lógica.

```html
<!-- Liga o <form> ao FormRecord criado no TypeScript. -->
<form class="dynamic-config__form" [formGroup]="form()">
  <!-- Repete o bloco para cada atributo recebido da API. -->
  @for (attribute of attributes(); track attribute.name) {
    <!-- O type do metadado escolhe qual campo desenhar. -->
    @switch (attribute.type) {
      @case ('url') {
        <mat-form-field>
          <mat-label>{{ attribute.name }}</mat-label>
          <!-- Liga este input ao campo com o mesmo name no FormRecord. -->
          <input matInput type="url" [formControlName]="attribute.name" />
        </mat-form-field>
      }
      @case ('select') {
        <mat-form-field>
          <mat-label>{{ attribute.name }}</mat-label>
          <mat-select [formControlName]="attribute.name">
            <!-- values do metadado viram as opções. -->
            @for (value of attribute.values; track value) {
              <mat-option [value]="value">{{ value }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
      @default {
        <!-- Tipo desconhecido: avisa e mantém os outros campos. -->
        <p role="alert">
          O campo "{{ attribute.name }}" usa o tipo "{{ attribute.type }}", ainda não suportado.
        </p>
      }
    }
  }
</form>
```

| Sintaxe | Significado |
|---|---|
| `{{ valor }}` | Mostra um valor no texto |
| `[propriedade]="valor"` | Liga um valor do TypeScript a uma propriedade |
| `[class.nome]="condição"` | Aplica a classe só quando a condição é verdadeira |
| `[formGroup]` e `[formControlName]` | Ligam o HTML ao formulário reativo |
| `(click)="metodo()"` | Chama um método quando o evento acontece |
| `@if` e `@else` | Mostram um bloco conforme uma condição |
| `@if (valor(); as plugin)` | Mostra o bloco se houver valor e dá um nome a ele |
| `@for (...; track ...)` | Repete um bloco; `track` identifica cada item |
| `@empty` | Aparece quando a lista do `@for` está vazia |
| `@switch` e `@case` | Mostram só o bloco do caso atual |
| `@default` | Aparece quando nenhum `@case` corresponde |

## Por que usar uma classe própria para o destaque

Três caminhos foram testados para destacar o gateway selecionado:

| Caminho | Resultado |
|---|---|
| `mat-action-list` com `[activated]` | A classe entra, mas essa lista não desenha nenhum destaque |
| `mat-nav-list` com `button` | Destaca, mas o botão ganha borda e texto centralizado |
| `mat-action-list` com classe própria | Destaca e mantém o visual da lista. **Foi o escolhido.** |

A cor vem de `--mat-sys-secondary-container`, uma variável do tema do Material, então ela acompanha o tema.

Enquanto o botão tem o foco, o Material escurece um pouco esse fundo. Por isso, o item fica mais claro quando o foco passa para um campo do formulário.

## Organização visual

```text
┌ dynamic-config ───────────────────────────────┐
│ header: título e subtítulo                    │
│ ┌ panel ────────┐ ┌ panel ──────────────────┐ │
│ │ Gateways      │ │ Campos ou mensagem      │ │
│ └───────────────┘ └─────────────────────────┘ │
└───────────────────────────────────────────────┘
```

| Decisão | Motivo |
|---|---|
| `display: grid` em `dynamic-config__layout` | Coloca os dois painéis lado a lado: 260px e o restante |
| `minmax(0, 1fr)` | Deixa a coluna encolher, evitando rolagem horizontal |
| `@media (max-width: 720px)` | Em telas estreitas, os painéis viram uma coluna só |
| `align-items: start` | Cada painel fica com a altura do próprio conteúdo |
| Variáveis `--mat-sys-*` | Cores e fontes vêm do tema, sem valores soltos no CSS |
| `box-shadow` em vez de borda | Separa os painéis do fundo sem acrescentar cor |
| `appearance="outline"` | Desenha o campo com contorno, o que combina com os painéis |
| `subscriptSizing="dynamic"` | Remove o espaço reservado para mensagens que a POC não usa |
| `@if (plugins().length > 0)` | O painel da direita só aparece quando há gateways para escolher |

Os nomes das classes seguem o padrão BEM: `bloco__elemento--variação`. Por exemplo, em `dynamic-config__plugin--selected`, `dynamic-config` é o bloco, `plugin` é o elemento e `selected` é a variação.

## Testes

Os testes de `dynamic-config.spec.ts` simulam a API com `HttpTestingController` e examinam o HTML desenhado.

| Teste | O que protege |
|---|---|
| Mostra os gateways | A lista vem da resposta da API |
| Erro na lista | A falha vira mensagem, e a tela não quebra |
| Desenha os campos | Os metadados viram campos, e o `default` é aplicado |
| Troca de gateway | Os valores antigos são descartados |
| Última resposta | A chamada antiga é cancelada (`cancelled`) |
| Tipo desconhecido | Aparece um aviso, e os demais campos continuam |
| Tentar de novo | O fluxo sobrevive a um erro |
| Destaque | Só o gateway selecionado recebe a classe |
| Clique repetido | Não há nova chamada (`expectNone`) |

`fixture.whenStable()` espera o Angular atualizar a tela. Sem isso, o teste olharia a página antes da mudança.

Os testes não enxergam aparência: o teste de destaque confirma a classe, não a cor. O problema do `[activated]` só apareceu ao olhar a tela no Chrome.

## Erros encontrados ou evitados

| Erro | Quem detectou | Lição |
|---|---|---|
| Signals como `private` | Compilador do Angular (`TS2341`) | O template precisa de `protected` ou `public` |
| `signal` e `title` sobrando no `app.ts` | Revisão do código | Código morto compila, mas confunde quem lê |
| `Hello, tag-config` no `app.spec.ts` antigo | Revisão do código, antes de rodar | Um teste gerado precisa acompanhar a tela nova |
| Falta de `HttpClient` no `app.spec.ts` | Revisão do código, antes de rodar | O teste de um componente pai herda as dependências dos filhos |
| Mensagem "Selecione" junto com o erro | Ensaio no navegador | Cada estado deve mostrar só o que faz sentido |
| `[activated]` sem efeito visual | Captura de tela do ensaio | Teste automatizado não substitui olhar a tela |

## Glossário

- **Componente:** parte da tela, com lógica e template.
- **Signal:** valor que avisa o Angular quando muda.
- **Formulário reativo:** formulário definido no TypeScript, e ligado ao HTML depois.
- **`FormRecord`:** formulário reativo com campos definidos em execução.
- **`Subject`:** canal do RxJS que recebe valores por `next()`.
- **Operador:** função usada no `pipe`, como `tap`, `switchMap` e `catchError`.
- **Metadado:** dado que descreve outro dado; aqui, descreve os campos da tela.
- **Zoneless:** modo sem `zone.js`, no qual os signals avisam o Angular sobre as mudanças.
