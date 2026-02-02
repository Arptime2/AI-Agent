const { createTool } = require('../../server-lib');

function add(params) {
  const a = parseFloat(params.a);
  const b = parseFloat(params.b);
  return { result: isNaN(a) || isNaN(b) ? 'Invalid numbers' : a + b };
}

function subtract(params) {
  const a = parseFloat(params.a);
  const b = parseFloat(params.b);
  return { result: isNaN(a) || isNaN(b) ? 'Invalid numbers' : a - b };
}

function multiply(params) {
  const a = parseFloat(params.a);
  const b = parseFloat(params.b);
  return { result: isNaN(a) || isNaN(b) ? 'Invalid numbers' : a * b };
}

function divide(params) {
  const a = parseFloat(params.a);
  const b = parseFloat(params.b);
  if (isNaN(a) || isNaN(b)) return { result: 'Invalid numbers' };
  if (b === 0) return { result: 'Division by zero' };
  return { result: a / b };
}

function pow(params) {
  const base = parseFloat(params.base);
  const exp = parseFloat(params.exp);
  return { result: isNaN(base) || isNaN(exp) ? 'Invalid numbers' : Math.pow(base, exp) };
}

function sqrt(params) {
  const num = parseFloat(params.number);
  if (isNaN(num)) return { result: 'Invalid number' };
  if (num < 0) return { result: 'Square root of negative number' };
  return { result: Math.sqrt(num) };
}

createTool('Calculator', { add, subtract, multiply, divide, pow, sqrt });
