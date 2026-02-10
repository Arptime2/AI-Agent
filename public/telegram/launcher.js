#!/usr/bin/env node

const http = require('http');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;
const LMSTUDIO_HOST = process.env.LMSTUDIO_HOST || 'localhost';
const LMSTUDIO_PORT = process.env.LMSTUDIO_PORT || 1234;

const serverCode = `
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = ${PORT};
const LMSTUDIO_HOST = '${LMSTUDIO_HOST}';
const LMSTUDIO_PORT = ${LMSTUDIO_PORT};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, \`http://localhost:\${PORT}\`);
  
  if (url.pathname === '/' || url.pathname === '/index.html') {
    fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading page');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(data);
    });
    return;
  }
  
  if (url.pathname === '/bot.js') {
    fs.readFile(path.join(__dirname, 'bot.js'), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading bot');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(data);
    });
    return;
  }
  
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(\`Telegram bot UI running at http://localhost:\${PORT}/telegram/\`);
});
`;

fs.writeFileSync('/tmp/telegram-server.js', serverCode);

console.log('Starting Telegram bot UI...');

const server = spawn('node', ['/tmp/telegram-server.js'], {
  stdio: 'inherit',
  cwd: process.cwd()
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  server.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.kill('SIGTERM');
  process.exit(0);
});
