# LM Studio Chat

Chat UI for LM Studio with tool support.

## Requirements

- LM Studio running on localhost:1234
- Node.js 18+

## Tools

- **Browser** - Search via SearXNG (requires local SearXNG on port 8080)
- **TTS** - Text-to-speech using PocketTTS

## Starting PocketTTS

For TTS tool, start PocketTTS server:

```bash
uvx pocket-tts serve --host 127.0.0.1 --port 8100
```

## Running

```bash
# Start main server
node server.js

# Start tools (in separate terminal)
node start-tools.js
```

Open http://localhost:3000
