# Tool Server Library

Create tools easily with Node.js and this library.

## Quick Start

1. Create a file in `tools/` folder
2. Use the library
3. Run with port as argument

## Example

```js
// tools/weather.js
const { createTool } = require('../server-lib');

function current(params) {
  return { temp: 72, city: params.city || 'Unknown' };
}

function forecast(params) {
  return { days: 7, city: params.city };
}

createTool('Weather', { current, forecast });
```

## Run a Tool

```bash
node tools/weather.js 8081
```

**Port is required** - pass it as the first argument.

## Endpoints

Each function becomes an endpoint at `/<function-name>`:

```js
function current(params) { return { temp: 72 }; }
```

Calling `GET /current?city=London` returns `{ temp: 72, city: 'London' }`.

## Parameters

Query parameters are passed to your function as an object:

```js
function greet(params) {
  return { message: 'Hello ' + (params.name || 'World') };
}

// GET /greet?name=John -> { message: 'Hello John' }
```

## Health Check

Every tool has a `/health` endpoint:

```bash
curl http://localhost:8081/health
# { "status": "ok", "tool": "Weather" }
```

## Create a New Tool

1. Create `tools/mytool.js`
2. Add functions
3. Run `node tools/mytool.js <port>`

Example:

```js
// tools/calculator.js
const { createTool } = require('../server-lib');

function add(params) {
  return { result: parseInt(params.a) + parseInt(params.b) };
}

function multiply(params) {
  return { result: parseInt(params.a) * parseInt(params.b) };
}

createTool('Calculator', { add, multiply });
```

Run: `node tools/calculator.js 8082`

## Directory Structure

```
/home/arptime/Programming/AI Agent
├── server-lib/
│   ├── index.js       # Library
│   ├── template.js    # Example
│   └── README.md      # This file
└── tools/
    ├── time.js        # Time tool
    └── weather.js     # Weather tool
```
