# LM Studio Chat

Chat UI for LM Studio with tool support.

## Requirements

- LM Studio running on localhost:1234
- Node.js 18+

## Tools

- **Browser** - Search via SearXNG (requires local SearXNG on port 8080)
- **TTS** - Text-to-speech using PocketTTS

## Starting SearXNG

For the browser tool, start SearXNG Docker container:

```bash
# Create limiter.toml to disable bot detection
cat > limiter.toml << 'EOF'
[botdetection]
trusted_proxies = [
  "127.0.0.0/8",
  "::1",
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "fd00::/8"
]

[botdetection.ip_lists]
pass_ip = [
  "0.0.0.0/0",
  "::/0"
]
EOF

# Start SearXNG with limiter.toml mounted
docker rm -f searxng 2>/dev/null
docker run -d --name searxng -p 8080:8080 -v "$(pwd)/limiter.toml:/etc/searxng/limiter.toml:ro" searxng/searxng

# Test it's working
curl "http://127.0.0.1:8080/search?q=test&format=json"
```

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
