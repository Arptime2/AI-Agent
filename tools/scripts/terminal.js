const { exec, execSync } = require('child_process');
const { createTool } = require('../../server-lib');

function terminal(params) {
  const command = params.command;
  if (!command) {
    return { error: 'Missing command parameter' };
  }

  const timeout = parseInt(params.timeout) || 10000;
  
  return new Promise((resolve) => {
    exec(command, { timeout }, (error, stdout, stderr) => {
      const result = {
        command,
        exitCode: error ? error.code : 0
      };
      
      if (stdout) result.stdout = stdout.slice(0, 5000);
      if (stderr) result.stderr = stderr.slice(0, 1000);
      if (error && !stderr) result.error = error.message;
      
      resolve(result);
    });
  });
}

function runSync(params) {
  const command = params.command;
  if (!command) {
    return { error: 'Missing command parameter' };
  }

  try {
    const output = execSync(command, { encoding: 'utf8', timeout: 10000 });
    return {
      command,
      exitCode: 0,
      stdout: output.slice(0, 5000)
    };
  } catch (error) {
    return {
      command,
      exitCode: error.status || 1,
      error: error.message.slice(0, 500),
      stdout: error.stdout ? error.stdout.slice(0, 5000) : '',
      stderr: error.stderr ? error.stderr.slice(0, 1000) : ''
    };
  }
}

createTool('Terminal', { terminal, runSync });
