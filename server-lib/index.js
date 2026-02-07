const http = require('http');

function createTool(name, endpoints) {
  const PORT = process.argv[2] || 8081;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (pathname === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', tool: name }));
      return;
    }

    const normalizedPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    const handler = endpoints[normalizedPath] || endpoints[pathname];

    if (handler) {
      const params = Object.fromEntries(url.searchParams);
      let result = typeof handler === 'function' ? handler(params) : handler;
      
      if (result && typeof result.then === 'function') {
        result = await result;
      }
      
      res.writeHead(200);
      res.end(JSON.stringify(result));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found', tool: name, available: Object.keys(endpoints) }));
  });

  server.listen(PORT, () => {
    console.log(`${name} running on http://localhost:${PORT}`);
    console.log('Endpoints:', Object.keys(endpoints).join(', '));
  });

  return server;
}

module.exports = { createTool };
