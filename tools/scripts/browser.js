const http = require('http');
const https = require('https');
const { createTool } = require('../../server-lib');

const SEARXNG_URL = 'http://127.0.0.1:8080';
const LMSTUDIO_HOST = 'localhost';
const LMSTUDIO_PORT = 1234;

async function searxngSearch(query) {
  const url = new URL(`${SEARXNG_URL}/search`);
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');

  return new Promise((resolve, reject) => {
    http.get(url.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse SearXNG response'));
        }
      });
    }).on('error', reject).end();
  });
}

async function fetchHtml(url) {
  const isHttps = url.startsWith('https');
  const client = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    client.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject).end();
  });
}

async function summarizeHtml(html, summaryPrompt = null) {
  const content = html.slice(0, 15000);

  let prompt;
  if (summaryPrompt) {
    prompt = `Please analyze the following HTML page and ${summaryPrompt}. Return only the relevant information without any introduction or conclusion.

HTML content:
${content}`;
  } else {
    prompt = `Please summarize the following HTML page content into clear, readable text. Extract the main information, headlines, and important content. Remove HTML tags and formatting. Return only the summarized text without any introduction or conclusion.

HTML content:
${content}`;
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: LMSTUDIO_HOST,
      port: LMSTUDIO_PORT,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const summary = json.choices?.[0]?.message?.content || '';
          resolve(summary);
        } catch (e) {
          reject(new Error('Failed to parse AI response'));
        }
      });
    });

    req.on('error', reject);

    req.write(JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1000
    }));

    req.end();
  });
}

async function search(params) {
  const query = params.query || params[Object.keys(params).find(k => k !== 'limit' && k !== 'fetch' && k !== 'summary')];
  const limit = parseInt(params.limit) || 10;
  const doFetch = params.fetch === 'true' || params.fetch === true;
  const summaryPrompt = params.summary || null;

  if (!query) {
    return { error: 'Missing query parameter' };
  }

  try {
    const data = await searxngSearch(query);
    const results = (data.results || []).slice(0, limit).map(r => ({
      title: r.title || 'No title',
      url: r.url,
      snippet: r.content || '',
      engine: r.engine || 'unknown'
    }));

    if (doFetch) {
      for (let i = 0; i < results.length; i++) {
        try {
          const html = await fetchHtml(results[i].url);
          const summary = await summarizeHtml(html, summaryPrompt);
          results[i].html = summary;
        } catch (e) {
          results[i].html = null;
          results[i].fetchError = e.message;
        }
      }
    }

    return {
      query,
      count: results.length,
      results
    };
  } catch (error) {
    return { error: `Search failed: ${error.message}` };
  }
}

createTool('Browser', {
  search,
  '': search,
  default: search
});
