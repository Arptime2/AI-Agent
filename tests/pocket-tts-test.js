#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const POCKET_TTS_HOST = '127.0.0.1';
const POCKET_TTS_PORT = process.env.POCKET_TTS_PORT || 8100;
const OUTPUT_DIR = path.join(__dirname, 'tts_output');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function httpRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, data: Buffer.concat(data), headers: res.headers }));
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

async function checkServer() {
  try {
    const res = await httpRequest({ hostname: POCKET_TTS_HOST, port: POCKET_TTS_PORT, path: '/', method: 'GET' });
    return res.status === 200 && res.data.toString().includes('Pocket TTS');
  } catch {
    return false;
  }
}

async function generateSpeech(text, voice = 'alba', seed = null) {
  const boundary = '----PocketTTS' + Date.now();
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="text"\r\n\r\n${text}\r\n--${boundary}\r\nContent-Disposition: form-data; name="voice"\r\n\r\n${voice}\r\n--${boundary}--\r\n`;

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
    throw new Error(res.data.toString());
  }

  return res.data;
}

function playAudio(audioBuffer) {
  return new Promise((resolve, reject) => {
    const aplay = spawn('aplay', ['-q', '-t', 'wav'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    aplay.stderr.on('data', d => stderr += d.toString());
    aplay.on('error', reject);
    aplay.on('close', code => code === 0 ? resolve() : reject(new Error(`aplay exited ${code}: ${stderr}`)));
    aplay.stdin.write(audioBuffer);
    aplay.stdin.end();
  });
}

async function runTests() {
  console.log('═'.repeat(50));
  console.log('Pocket TTS Test Script');
  console.log('═'.repeat(50));
  console.log();

  console.log('[TEST] Checking pocket-tts server...');
  const isRunning = await checkServer();

  if (!isRunning) {
    console.log('[TEST] Server not running!');
    console.log('[TEST] Start it with:');
    console.log('    uvx pocket-tts serve --host 127.0.0.1 --port 8100');
    console.log();
    console.log('[TEST] Exiting.');
    process.exit(0);
  }

  console.log('[TEST] Server is running.');
  console.log();

  console.log('[TEST] Running synthesis tests...');
  console.log();

  const tests = [
    { text: 'Hello, this is a test of pocket TTS.', name: 'hello' },
    { text: 'The quick brown fox jumps over the lazy dog.', name: 'pangram' },
    { text: 'Artificial intelligence is transforming the world.', name: 'ai' }
  ];

  for (let i = 0; i < tests.length; i++) {
    const { text, name } = tests[i];
    const outputFile = path.join(OUTPUT_DIR, `${name}.wav`);

    try {
      console.log(`[TEST] Generating: "${text.substring(0, 40)}..."`);
      const audio = await generateSpeech(text, 'alba');
      console.log(`[TEST] Received ${audio.length} bytes`);
      fs.writeFileSync(outputFile, audio);
      console.log(`[TEST] Saved: ${outputFile}`);
      try {
        console.log('[TEST] Playing...');
        await playAudio(audio);
        console.log(`[TEST] ✓ Test ${i + 1} passed`);
      } catch (playErr) {
        console.log(`[TEST] ✓ Generated (play failed: ${playErr.message})`);
      }
    } catch (e) {
      console.log(`[TEST] ✗ Test ${i + 1} failed: ${e.message}`);
    }
    console.log();
  }

  console.log('═'.repeat(50));
  console.log('All tests completed!');
  console.log('═'.repeat(50));
}

runTests().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
