# Projeto: execução, criação e uso do Git

Este documento descreve como executar a POC, como o repositório e o Angular foram criados e como voltar a um ponto anterior.

## Pré-requisitos

- Node.js `^20.19.0`, `^22.12.0` ou `>=24` (exigência do Angular 21).
- npm.

As dependências de `tag-config/` e `portal/` são instaladas uma vez em cada pasta, com `npm install`. O `mock-server/` não tem dependências.

## Como executar

São três serviços, cada um em um terminal, a partir da raiz do repositório.

```bash
# Terminal 1: API simulada, em http://localhost:3001
cd mock-server
node server.mjs
```

```bash
# Terminal 2: micro-frontend, em http://localhost:4202
cd tag-config
npm install
npm start
```

```bash
# Terminal 3: Portal, em http://localhost:3000
cd portal
npm install
npm run dev
```

Com os três serviços ativos, a página `http://localhost:3000` mostra o Portal com a tela de configuração. Cada serviço é encerrado com `Ctrl+C` no terminal dele.

| Pasta | Comando | Finalidade |
|---|---|---|
| `tag-config/` | `npm run build` | Gerar os arquivos finais e encontrar erros de compilação |
| `tag-config/` | `npx ng test --watch=false` | Executar todos os testes uma vez |
| `portal/` | `npm run build` | Checar os tipos e gerar os arquivos finais |
| Qualquer uma | `curl -i http://localhost:3001/plugins` | Testar a API sem o Angular |

A porta 4202 está em `serve.options` do `angular.json`, por isso o servidor de desenvolvimento não precisa de `--port`.

## Como o repositório foi criado

```bash
git init -b main
git rev-parse --show-toplevel
```

O segundo comando mostra de qual repositório a pasta faz parte. É útil quando o projeto fica dentro de uma pasta que já é um repositório Git: um commit feito no lugar errado iria para o repositório de fora.

## Como o Angular foi criado

```bash
ng new tag-config --style=scss --ssr=false --routing=false --skip-git --ai-config=none --defaults
cd tag-config
ng add @angular/material --skip-confirmation --defaults
```

| Opção | Motivo |
|---|---|
| `--style=scss` | A geração do tema do Angular Material usa Sass. Os estilos foram migrados para CSS depois (commit `0dddf52`) |
| `--ssr=false` | O código roda no navegador, e a Shell só precisa baixar arquivos prontos |
| `--routing=false` | A POC é uma tela só, e a navegação fica com a Shell |
| `--skip-git` | O Git fica na raiz da POC; sem isso, haveria outro repositório dentro de `tag-config/` |
| `--ai-config=none` | Não gera arquivos de configuração para ferramentas de IA |
| `--defaults` | Usa os valores padrão, sem perguntas no terminal |

O `ng add` faz mais que instalar o pacote: adiciona `@angular/material` e `@angular/cdk`, cria o tema e altera `src/index.html`.

Um componente é criado com:

```bash
ng generate component features/dynamic-config/dynamic-config --flat
```

O `--flat` coloca os arquivos direto na pasta indicada, sem criar outra subpasta.

## Arquivos principais

| Arquivo | Responsabilidade |
|---|---|
| `package.json` | Lista as dependências e os scripts |
| `angular.json` | Configura build, servidor local e testes |
| `src/index.html` | Página usada para rodar a tela sozinha, com a tag `<tag-config>` |
| `src/main.ts` | Ponto de entrada; registra o Web Component |
| `src/app/app.config.ts` | Recursos globais, como o `HttpClient` |
| `src/app/app.ts` e `app.html` | Componente raiz e seu template |
| `src/app/app.css` | Tema do Angular Material, declarado em `:host` |
| `src/styles.css` | Só o `margin: 0` da página |

## Fluxo de commits

Regra do projeto: um commit por parte concluída, somente com build e testes passando.

```bash
git status                 # o que mudou
git diff                   # quais linhas mudaram
git add <pasta>            # escolhe o que entra no commit
git commit -m "mensagem"   # cria o ponto de retorno
git log --oneline          # lista os commits
```

Os prefixos das mensagens indicam o tipo da mudança:

| Prefixo | Significado |
|---|---|
| `feat:` | Funcionalidade nova |
| `fix:` | Correção de erro |
| `chore:` | Tarefa de manutenção, como criar o projeto |
| `style:` | Formatação, sem mudar o comportamento |
| `refactor:` | Reorganização do código, sem mudar o comportamento |

## Como voltar se algo der errado

Os comandos devem rodar na raiz do repositório, porque `git restore .` só alcança a pasta atual e as subpastas.

| Situação | Comando | Efeito |
|---|---|---|
| Arquivos alterados, sem commit | `git restore .` | Desfaz as alterações em arquivos versionados |
| Arquivos novos que se quer remover | `git clean -nd`, depois `git clean -fd` | O primeiro só lista; o segundo apaga definitivamente |
| Commit já feito | `git revert HEAD` | Cria um commit que desfaz o último e preserva o histórico |

`git revert` é o caminho padrão. `git reset --hard` deve ser evitado, porque descarta trabalho e pode apagar alterações sem volta.

## Glossário

- **Repositório:** pasta cujo histórico é controlado pelo Git.
- **Commit:** ponto salvo no histórico.
- **Monorepo:** um repositório com vários projetos independentes.
- **Build:** processo que transforma o código nos arquivos finais.
- **Dependência:** pacote de terceiros usado pelo projeto.
