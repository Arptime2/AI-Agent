const http = require('http');
const fs = require('fs');
const path = require('path');
const { createTool } = require('../../../server-lib');

const POCKET_TTS_HOST = '127.0.0.1';
const POCKET_TTS_PORT = 8100;
const AUDIO_DIR = path.join(__dirname, 'audio');

if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

function httpRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(data) }));
    });
    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    if (body) req.write(body);
    req.end();
  });
}

async function speak(params) {
  const text = params.text || params.speak || params.input || '';
  const voice = params.voice || 'alba';

  if (!text) {
    return { error: 'Missing text parameter' };
  }

  const boundary = '----PocketTTS' + Date.now();
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="text"\r\n\r\n${text}\r\n--${boundary}\r\nContent-Disposition: form-data; name="voice"\r\n\r\n${voice}\r\n--${boundary}--\r\n`;

  try {
    const res = await httpRequest({
      hostname: POCKET_TTS_HOST,
      port: POCKET_TTS_PORT,
      path: '/tts',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, body);

    if (res.status !== 200) {
      return { error: `Pocket TTS error: ${res.data.toString()}` };
    }

    const filename = `tts_${Date.now()}.wav`;
    const filepath = path.join(AUDIO_DIR, filename);
    fs.writeFileSync(filepath, res.data);

    return {
      message: 'Audio generated successfully',
      file: filename,
      downloadUrl: `/tts-audio/${filename}`,
      text: text.substring(0, 100),
      voice: voice
    };
  } catch (error) {
    return { error: `TTS failed: ${error.message}` };
  }
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${process.env.PORT || 8088}`);
  const pathname = url.pathname.replace(/^\/tts/, '').replace(/^\//, '') || '';

  if (pathname === '' || pathname === 'speak') {
    const params = Object.fromEntries(url.searchParams);
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const contentType = req.headers['content-type'] || '';
          let parsedParams = params;

          if (contentType.includes('application/json')) {
            parsedParams = { ...params, ...JSON.parse(body) };
          } else if (contentType.includes('application/x-www-form-urlencoded')) {
            const formParams = new URLSearchParams(body);
            for (const [key, value] of formParams) {
              parsedParams[key] = value;
            }
          }

          const result = await speak(parsedParams);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
    } else {
      const result = await speak(params);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}

createTool('TTS', {
  speak,
  '': speak,
  tts: speak,
  default: speak
});
