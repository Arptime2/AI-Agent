const { createTool } = require('../../../server-lib');

async function number(params) {
  const min = parseInt(params.min) || 1;
  const max = parseInt(params.max) || 100;
  const count = parseInt(params.count) || 1;

  if (count === 1) {
    const result = Math.floor(Math.random() * (max - min + 1)) + min;
    return { random: result };
  }

  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(Math.floor(Math.random() * (max - min + 1)) + min);
  }
  return { random: results };
}

createTool('Random', {
  number,
  '': number,
  default: number
});
