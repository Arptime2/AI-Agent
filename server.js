const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const LMSTUDIO_HOST = process.env.LMSTUDIO_HOST || 'localhost';
const LMSTUDIO_PORT = process.env.LMSTUDIO_PORT || 1234;

const PROMPTS_DIR = path.join(__dirname, 'prompts');

let toolsRegistry = [];

function getPrompt(filename) {
  try {
    return fs.readFileSync(path.join(PROMPTS_DIR, filename), 'utf8').trim();
  } catch (e) {
    return '';
  }
}

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'text/plain';
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

function getToolsDocs() {
  const toolsMDPath = path.join(__dirname, 'toolsMD');
  if (!fs.existsSync(toolsMDPath)) return '# Available Tools\n\nNo tools available.';
  const files = fs.readdirSync(toolsMDPath).filter(f => f.endsWith('.md'));
  if (files.length === 0) return '# Available Tools\n\nNo tools available.';
  let combined = '# Available Tools\n\n';
  for (const file of files) {
    const content = fs.readFileSync(path.join(toolsMDPath, file), 'utf8');
    const toolName = file.replace('.md', '');
    combined += `## ${toolName.charAt(0).toUpperCase() + toolName.slice(1)}\n`;
    combined += content + '\n\n';
  }
  return combined;
}

function proxyRequest(req, res, targetHost, targetPort) {
  const options = {
    hostname: targetHost,
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: req.headers
  };
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', () => {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad gateway');
  });
  req.pipe(proxyReq);
}

const paramToEndpoint = {
  'url': 'getPage',
  'selector': 'getText',
  'text': 'getTextContent',
  'html': 'getHtml',
  'image': 'screenshot',
  'extract': 'extract',
  'script': 'evaluate',
  'milliseconds': 'wait',
  'direction': 'scroll',
  'close': 'close',
  'status': 'status',
  'search': 'search',
  'query': 'search',
  'fetch': 'fetch'
};

async function executeTool(toolName, port, params) {
  const { operation, ...restParams } = params;
  const filteredParams = {};
  for (const [key, value] of Object.entries(restParams)) {
    if (key.toLowerCase() !== 'tool' && key.toLowerCase() !== 'toolname') {
      filteredParams[key] = value;
    }
  }

  const possibleEndpoints = [];
  const paramKeys = Object.keys(filteredParams);
  if (paramKeys.length === 1 && paramToEndpoint[paramKeys[0]]) {
    possibleEndpoints.push(paramToEndpoint[paramKeys[0]]);
  }
  if (filteredParams.search || filteredParams.query) {
    possibleEndpoints.push('search', 'fetch');
  }
  if (operation) possibleEndpoints.push(operation.toLowerCase());
  possibleEndpoints.push(toolName.toLowerCase());
  possibleEndpoints.push('');
  possibleEndpoints.push('run');

  let lastError = null;

  for (const endpoint of possibleEndpoints) {
    try {
      const queryParams = new URLSearchParams(filteredParams).toString();
      const url = `http://localhost:${port}/${endpoint}${queryParams ? '?' + queryParams : ''}`;

      console.log('Trying endpoint:', url);

      const response = await fetch(url);

      if (response && response.ok) {
        const result = await response.json();
        return { toolName, result };
      } else {
        lastError = response?.status || 'Unknown error';
      }
    } catch (e) {
      lastError = e.message;
    }
  }

  return { toolName, error: `Tool returned ${lastError || 404}` };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === '/' || url.pathname === '/index.html') {
    serveStaticFile(res, path.join(__dirname, 'public', 'index.html'));
    return;
  }

  if (url.pathname.startsWith('/css/')) {
    serveStaticFile(res, path.join(__dirname, 'public', url.pathname));
    return;
  }

  if (url.pathname.startsWith('/js/')) {
    serveStaticFile(res, path.join(__dirname, 'public', url.pathname));
    return;
  }

  if (url.pathname === '/api/system-prompt') {
    const toolsDocs = getToolsDocs();
    const systemBase = getPrompt('system-base.txt');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      systemPrompt: `${systemBase}\n\n${toolsDocs}`
    }));
    return;
  }

  if (url.pathname === '/api/continue-prompt') {
    const continuePrompt = getPrompt('continue-prompt.txt');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ continuePrompt }));
    return;
  }

  if (url.pathname === '/api/tools') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(toolsRegistry));
    return;
  }

  if (url.pathname === '/api/tool-call') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { toolName, port, params } = JSON.parse(body);
        const result = await executeTool(toolName, port, params);
        res.writeHead(200);
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (url.pathname === '/api/register-tool') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { name, port } = JSON.parse(body);
        const existing = toolsRegistry.find(t => t.port === port);
        if (existing) {
          existing.name = name;
        } else {
          toolsRegistry.push({ name, port });
        }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    const apiPath = '/v1' + url.pathname.replace('/api', '');
    req.url = apiPath + url.search;
    proxyRequest(req, res, LMSTUDIO_HOST, LMSTUDIO_PORT);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`LM Studio Chat UI running at http://localhost:${PORT}`);
  console.log(`Proxying to LM Studio at ${LMSTUDIO_HOST}:${LMSTUDIO_PORT}`);
});
