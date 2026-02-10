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
# Step 1: Start container to generate default config
docker rm -f searxng 2>/dev/null
docker run -d --name searxng -p 8080:8080 ghcr.io/privau/searxng

# Step 2: Copy the default settings
docker cp searxng:/etc/searxng/settings.yml /tmp/searxng-settings.yml

# Step 3: Add json to formats (edit the file)
# Edit /tmp/searxng-settings.yml and change:
#   formats:
#     - html
# to:
#   formats:
#     - html
#     - json

# Step 4: Copy to /etc/searxng/ (optional, for persistence)
sudo mkdir -p /etc/searxng
sudo cp /tmp/searxng-settings.yml /etc/searxng/settings.yml

# Step 5: Restart with corrected config
docker rm -f searxng
docker run -d --name searxng -p 8080:8080 \
  -e "SEARXNG_LIMITER=false" \
  -v "/etc/searxng/settings.yml:/etc/searxng/settings.yml:ro" \
  ghcr.io/privau/searxng

# Set autostart
docker update --restart unless-stopped searxng

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
