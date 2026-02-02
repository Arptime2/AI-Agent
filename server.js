const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const LMSTUDIO_HOST = process.env.LMSTUDIO_HOST || 'localhost';
const LMSTUDIO_PORT = process.env.LMSTUDIO_PORT || 1234;

const PROMPTS_DIR = path.join(__dirname, 'prompts');

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
  
  if (!fs.existsSync(toolsMDPath)) {
    return '# Available Tools\n\nNo tools available.';
  }
  
  const files = fs.readdirSync(toolsMDPath).filter(f => f.endsWith('.md'));
  
  if (files.length === 0) {
    return '# Available Tools\n\nNo tools available.';
  }
  
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

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad gateway');
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

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

  if (url.pathname === '/api/tools-docs') {
    const docs = getToolsDocs();
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(docs);
    return;
  }

  if (url.pathname === '/api/decide/action') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { lastUserMessage, toolsAvailable } = JSON.parse(body);
        console.log('[DECIDER-SERVER] Request:', { lastUserMessage, toolsAvailable });

        const systemPrompt = getPrompt('decider-action.txt');
        console.log('[DECIDER-SERVER] System prompt:', systemPrompt);

        const proxyReq = http.request({
          hostname: LMSTUDIO_HOST,
          port: LMSTUDIO_PORT,
          path: '/v1/chat/completions',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, (proxyRes) => {
          let result = '';
          proxyRes.on('data', chunk => result += chunk);
          proxyRes.on('end', () => {
            try {
              const data = JSON.parse(result);
              let content = data.choices?.[0]?.message?.content || 'ANSWER';
              console.log('[DECIDER-SERVER] LM Studio response:', content);
              content = content.replace(/[^A-Z]/gi, '').toUpperCase().trim();
              const match = content.match(/(TOOL|ANSWER|DONE)/);
              const decision = match ? match[1] : 'ANSWER';
              console.log('[DECIDER-SERVER] Final decision:', decision);
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end(decision);
            } catch (e) {
              console.log('[DECIDER-SERVER] Error parsing response:', e.message);
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end('ANSWER');
            }
          });
        });
        proxyReq.on('error', (e) => {
          console.log('[DECIDER-SERVER] LM Studio error:', e.message);
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('ANSWER');
        });
        proxyReq.write(JSON.stringify({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: lastUserMessage }
          ],
          max_tokens: 5,
          temperature: 0.0
        }));
        proxyReq.end();
      } catch (e) {
        console.log('[DECIDER-SERVER] Error:', e.message);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ANSWER');
      }
      });
      return;
    }

    if (url.pathname === '/api/decide/tool') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { lastUserMessage, toolsAvailable } = JSON.parse(body);
        console.log('[TOOL-DECIDER-SERVER] Request:', { lastUserMessage, toolsAvailable });
        const toolsList = toolsAvailable.join(', ');
        console.log('[TOOL-DECIDER-SERVER] Available tools:', toolsList);

        const systemPrompt = getPrompt('decider-tool.txt');
        console.log('[TOOL-DECIDER-SERVER] System prompt:', systemPrompt);

        const proxyReq = http.request({
          hostname: LMSTUDIO_HOST,
          port: LMSTUDIO_PORT,
          path: '/v1/chat/completions',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }, (proxyRes) => {
          let result = '';
          proxyRes.on('data', chunk => result += chunk);
          proxyRes.on('end', () => {
            try {
              const data = JSON.parse(result);
              const content = data.choices?.[0]?.message?.content || toolsAvailable[0] || '';
              console.log('[TOOL-DECIDER-SERVER] LM Studio response:', content);
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end(content.trim());
            } catch (e) {
              console.log('[TOOL-DECIDER-SERVER] Error:', e.message);
              res.writeHead(200, { 'Content-Type': 'text/plain' });
              res.end(toolsAvailable[0] || '');
            }
          });
        });
        proxyReq.on('error', (e) => {
          console.log('[TOOL-DECIDER-SERVER] LM Studio error:', e.message);
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end(toolsAvailable[0] || '');
        });
        proxyReq.write(JSON.stringify({
          messages: [
            { role: 'system', content: `${systemPrompt}\n\nAvailable tools: ${toolsList}` },
            { role: 'user', content: lastUserMessage }
          ],
          max_tokens: 20,
          temperature: 0.1
        }));
        proxyReq.end();
      } catch (e) {
        console.log('[TOOL-DECIDER-SERVER] Error:', e.message);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('');
      }
    });
    return;
  }

  if (url.pathname === '/api/prompts/params') {
    const prompt = getPrompt('params.txt');
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(prompt);
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
