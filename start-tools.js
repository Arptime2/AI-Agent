const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TOOLS_DIR = path.join(__dirname, 'tools', 'scripts');
const BASE_PORT = 8081;

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

const processes = tools.map(tool => {
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

  return { ...tool, proc };
});

console.log('\nAll tools started!');
console.log('\nTools running:');
processes.forEach(t => {
  console.log(`  - ${t.name}: http://localhost:${t.port}`);
});

console.log('\nPress Ctrl+C to stop all tools');

process.on('SIGINT', () => {
  console.log('\nStopping all tools...');
  processes.forEach(t => {
    t.proc.kill('SIGINT');
  });
  process.exit(0);
});
