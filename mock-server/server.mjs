import {createServer}from 'node:http';
import {readFile}from 'node:fs/promises';

const PORT = Number(process.env.PORT ?? 3001);
const DATA_DIR = new URL('./data/', import.meta.url);

const CORS_HEADERS = {

    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',

};

async function readJson(path) {
    const content = await readFile(new URL(path,DATA_DIR), 'utf8');
    return JSON.parse(content);
}

function sendJson(res, status, body) {
    res.writeHead(status, { ...CORS_HEADERS, 'Content-Type': 'application/json' }  )
    res.end(JSON.stringify(body));
}

function sendError(res, status, message) {
    sendJson(res,status, {status, message,timestamp: new Date().toISOString() });
}

async function handleRequest(req, res) {

    if(req.method === 'OPTIONS') {
        res.writeHead(204, CORS_HEADERS);
        res.end();
        return;
    }



const { pathname } = new URL(req.url, 'http://localhost');
const attributesRoute = pathname.match(/^\/plugins\/([^/]+)\/attributes$/);

    if (req.method === 'GET' && pathname === '/plugins') {
        sendJson(res, 200, await readJson('plugins.json'));
        return;
  }
   if (req.method === 'GET' && attributesRoute) {
      const plugins = await readJson('plugins.json');
      const plugin = plugins.find(({id}) => id === attributesRoute[1]);

      if(!plugin){
        sendError(res, 404, 'Plugin não encontrado');
        return;
      }

      sendJson(res, 200, await readJson(`attributes/${plugin.id}.json`));
      return;
  }
  sendError(res, 404, 'Rota não encontrada');
}
  createServer ((req,res) => {
    handleRequest(req,res).catch((error) => { 
        console.error(error);
        sendError(res,500, 'Erro interno do mock');

    });
  }).listen(PORT, () => {

    console.log(`Mock server em http://localhost:${PORT}`)

  }


)