const { createTool } = require('../server-lib');

function greet(params) {
  return { message: 'Hello ' + (params.name || 'World') };
}

function double(params) {
  return { result: parseInt(params.number) * 2 };
}

function uppercase(params) {
  return { result: (params.text || '').toUpperCase() };
}

createTool('Example Tool', { greet, double, uppercase });
