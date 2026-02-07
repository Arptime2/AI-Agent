const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const TOOLS_DIR = path.join(__dirname, 'tools', 'scripts');
const BASE_PORT = 8081;
const SERVER_PORT = 3000;

function killPort(port) {
  try {
    const output = execSync(`lsof -ti :${port} 2>/dev/null`).toString().trim();
    if (output) {
      const pids = output.split('\n').filter(p => p);
      pids.forEach(pid => {
        try {
          execSync(`kill -9 ${pid} 2>/dev/null`);
          console.log(`  Killed process ${pid} on port ${port}`);
        } catch (e) {}
      });
    }
  } catch (e) {}
}

async function registerTool(name, port) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:${SERVER_PORT}/api/register-tool`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve());
    });
    req.on('error', reject);
    req.write(JSON.stringify({ name, port }));
    req.end();
  });
}

const tools = fs.readdirSync(TOOLS_DIR)
  .filter(f => f.endsWith('.js'))
  .map((file, index) => ({
    name: file.replace('.js', ''),
    file: path.join(TOOLS_DIR, file),
    port: BASE_PORT + index
  }));

console.log('Starting tools...\n');

tools.forEach(tool => {
  console.log(`Killing any existing process on port ${tool.port}...`);
  killPort(tool.port);
});

console.log('');

async function startAllTools() {
  for (const tool of tools) {
    console.log(`Starting ${tool.name} on port ${tool.port}`);

    const proc = spawn('node', [tool.file, String(tool.port)], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    proc.stdout.on('data', (data) => {
      process.stdout.write(`[${tool.name}] ${data}`);
    });

    proc.stderr.on('data', (data) => {
      process.stderr.write(`[${tool.name}] ${data}`);
    });

    proc.on('close', (code) => {
      console.log(`[${tool.name}] exited with code ${code}`);
    });

    await new Promise(resolve => setTimeout(resolve, 500));
    await registerTool(tool.name, tool.port);
    console.log(`  Registered ${tool.name} with server`);
  }

  console.log('\nAll tools started!');
  console.log('\nTools running:');
  tools.forEach(t => {
    console.log(`  - ${t.name}: http://localhost:${t.port}`);
  });
  console.log('\nPress Ctrl+C to stop all tools');
}

startAllTools().catch(console.error);

process.on('SIGINT', () => {
  console.log('\nStopping all tools...');
  tools.forEach(t => {
    try {
      execSync(`lsof -ti :${t.port} 2>/dev/null | xargs kill -9 2>/dev/null`);
    } catch (e) {}
  });
  process.exit(0);
});
