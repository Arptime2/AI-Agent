const http = require('http');
const https = require('https');
const { createTool } = require('../../server-lib');

const LMSTUDIO_HOST = 'localhost';
const LMSTUDIO_PORT = 1234;

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
      headers: { 'Content-Type': 'application/json' }
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

async function fetch(params) {
  const url = params.url;
  const summaryPrompt = params.summary || null;

  if (!url) {
    return { error: 'Missing url parameter' };
  }

  try {
    const html = await fetchHtml(url);

    try {
      const summary = await summarizeHtml(html, summaryPrompt);
      return { url, summary };
    } catch (e) {
      return { url, error: `Summary failed: ${e.message}` };
    }
  } catch (e) {
    return { error: `Failed to fetch ${url}: ${e.message}` };
  }
}

createTool('Fetch', { fetch, '': fetch, default: fetch });
