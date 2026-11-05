// Cópia comentada do mock-server/server.mjs, para fins didáticos.
// Diferenças em relação ao original:
//   1. a porta padrão é 3101, para não disputar a 3001 com o mock de verdade;
//   2. os dados vêm de ../../mock-server/data/, para não duplicar os JSON.
//
// Para rodar, a partir da raiz do repositório:
//   node docs/exemplos/server.comentado.mjs

// ---------------------------------------------------------------------------
// PARTE 1: PREPARAÇÃO
// ---------------------------------------------------------------------------

// createServer cria um servidor web. Vem do próprio Node (prefixo "node:").
import { createServer } from 'node:http';

// readFile lê um arquivo do disco. A versão de "fs/promises" funciona com await.
import { readFile } from 'node:fs/promises';

// process.env.PORT lê a variável de ambiente PORT.
// O ?? usa 3101 quando essa variável não existe.
// Number() converte para número, porque variáveis de ambiente chegam como texto.
const PORT = Number(process.env.PORT ?? 3101);

// import.meta.url é o endereço deste arquivo.
// A partir dele, chega-se à pasta de dados sem depender de onde o node foi rodado.
// A barra final importa: sem ela, a pasta seria tratada como um arquivo.
const DATA_DIR = new URL('../../mock-server/data/', import.meta.url);

// Cabeçalhos são informações que acompanham a resposta. Estes são lidos pelo
// navegador e dizem o que a página pode fazer com a API.
// Um nome escrito errado não gera erro no servidor: o navegador apenas bloqueia.
const CORS_HEADERS = {
  // Qualquer site pode ler a resposta. O * serve para o mock, não para produção.
  'Access-Control-Allow-Origin': '*',
  // Métodos HTTP aceitos.
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  // Cabeçalhos que o pedido pode enviar. Authorization é o do token do Keycloak.
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

// Lê um arquivo de data/ e devolve o conteúdo como objeto JavaScript.
// async: a função faz algo demorado e devolve o resultado depois.
async function readJson(path) {
  // new URL monta o caminho completo: plugins.json -> .../data/plugins.json
  // await espera a leitura sem travar os outros pedidos.
  // 'utf8' é a codificação do texto; ela preserva os acentos.
  const content = await readFile(new URL(path, DATA_DIR), 'utf8');

  // JSON.parse transforma texto em objetos e listas.
  return JSON.parse(content);
}

// Envia uma resposta JSON. res é a resposta que está sendo montada.
function sendJson(res, status, body) {
  // writeHead define o status e os cabeçalhos.
  // ...CORS_HEADERS copia os cabeçalhos de CORS para dentro deste objeto.
  res.writeHead(status, { ...CORS_HEADERS, 'Content-Type': 'application/json' });

  // JSON.stringify faz o inverso do parse: de objeto para texto.
  // res.end envia o conteúdo e encerra a resposta.
  // Cada resposta só pode ser encerrada uma vez.
  res.end(JSON.stringify(body));
}

// Envia um erro no formato ErrorResponse do Swagger: status, message e timestamp.
function sendError(res, status, message) {
  // { status, message } é um atalho para { status: status, message: message }.
  // new Date() cria a data atual: o espaço depois de "new" é obrigatório.
  sendJson(res, status, { status, message, timestamp: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// PARTE 2: DECISÃO
// ---------------------------------------------------------------------------

// Roda uma vez para cada pedido. req é o pedido, res é a resposta.
// Funciona como uma triagem: cada if testa um caso e o return encerra a função.
async function handleRequest(req, res) {
  // Preflight: a pergunta prévia do navegador ("posso fazer esta chamada?").
  if (req.method === 'OPTIONS') {
    // 204 significa sucesso, sem conteúdo. A autorização vai nos cabeçalhos.
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // req.url traz só o final do endereço, como /plugins?pagina=1.
  // new URL precisa de uma base para interpretar esse valor.
  // { pathname } pega só o caminho (/plugins) e ignora o que vem depois do ?.
  const { pathname } = new URL(req.url, 'http://localhost');

  // Expressão regular: confere o formato /plugins/ALGUMA-COISA/attributes.
  //   ^              início do texto
  //   \/plugins\/    o texto /plugins/ (a \ indica que a barra é literal)
  //   ([^/]+)        um ou mais caracteres que não sejam /, guardados
  //   \/attributes   o texto /attributes
  //   $              fim do texto
  // Se casar, attributesRoute[1] é o trecho guardado, como 'kong'.
  // Se não casar, attributesRoute é null.
  const attributesRoute = pathname.match(/^\/plugins\/([^/]+)\/attributes$/);

  // Rota 1: GET /plugins devolve a lista de gateways.
  if (req.method === 'GET' && pathname === '/plugins') {
    sendJson(res, 200, await readJson('plugins.json'));
    return;
  }

  // Rota 2: GET /plugins/{id}/attributes devolve os metadados de um gateway.
  if (req.method === 'GET' && attributesRoute) {
    const plugins = await readJson('plugins.json');

    // find devolve o primeiro item que satisfaz a condição, ou undefined.
    // ({ id }) pega só a propriedade id de cada item.
    const plugin = plugins.find(({ id }) => id === attributesRoute[1]);

    // !plugin é verdadeiro quando find não encontrou nada.
    if (!plugin) {
      sendError(res, 404, 'Plugin não encontrado');
      return;
    }

    // O nome do arquivo usa plugin.id, que veio de plugins.json, e não a URL.
    // Assim, ninguém consegue manipular o endereço para ler outro arquivo.
    sendJson(res, 200, await readJson(`attributes/${plugin.id}.json`));

    // Sem este return, a função continuaria até o sendError abaixo e tentaria
    // responder pela segunda vez, o que derruba o servidor.
    return;
  }

  // Chegou aqui: nenhum if respondeu, então a rota não existe.
  sendError(res, 404, 'Rota não encontrada');
} // handleRequest termina aqui. Todo o código que usa req e res fica dentro dela.

// ---------------------------------------------------------------------------
// PARTE 3: INICIALIZAÇÃO
// ---------------------------------------------------------------------------

// Esta parte fica fora de handleRequest: ela roda uma vez, ao iniciar o node.
// A função passada para createServer é que roda a cada pedido.
createServer((req, res) => {
  // handleRequest é async, então uma falha dentro dela chega neste .catch.
  handleRequest(req, res).catch((error) => {
    // Mostra o erro no terminal e responde 500 ao cliente.
    console.error(error);
    sendError(res, 500, 'Erro interno do mock');
  });
}).listen(PORT, () => {
  // listen começa a escutar a porta e avisa quando estiver pronto.
  console.log(`Mock server em http://localhost:${PORT}`);
});
