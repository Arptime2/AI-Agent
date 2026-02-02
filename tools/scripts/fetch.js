const axios = require('axios');
const { createTool } = require('../../server-lib');

async function fetch(params) {
  const url = params.url;
  if (!url) {
    return { error: 'Missing url' };
  }

  try {
    const response = await axios.get(url, { timeout: 5000 });
    return {
      status: response.status,
      data: response.data.slice(0, 10000)
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function json(params) {
  const url = params.url;
  if (!url) {
    return { error: 'Missing url' };
  }

  try {
    const response = await axios.get(url, { timeout: 5000 });
    return { json: response.data };
  } catch (e) {
    return { error: e.message };
  }
}

createTool('Fetch', { fetch, json });
