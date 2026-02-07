# TTS (Text-to-Speech)

Generates audio from text using Pocket TTS (local neural TTS model).

## Installation

Pocket TTS must be running:

```bash
uvx pocket-tts serve --host 127.0.0.1 --port 8100
```

## Usage

```json
{
  "tool": "TTS",
  "params": {
    "text": "Hello, this is a text to speech test.",
    "voice": "alba"
  }
}
```

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `text` | string | Yes | - | Text to convert to speech |
| `voice` | string | No | `alba` | Voice name to use |

## Available Voices

See available voices at: http://127.0.0.1:8100/

Default voices include:
- `alba` - Default voice
- Other voices may be available

## Output

```json
{
  "message": "Audio generated successfully",
  "file": "tts_1234567890.wav",
  "downloadUrl": "/tts-audio/tts_1234567890.wav",
  "text": "Hello, this is a text to speech test.",
  "voice": "alba"
}
```

## Download Audio

Use the `downloadUrl` to download the audio file:
- URL format: `/tts-audio/<filename>.wav`
- Open in browser to download
- Click link to play audio

## Notes

- Audio files are stored in `tools/scripts/tts/audio/`
- Files are not automatically cleaned up
- Audio format: WAV (CD quality, 22050Hz mono)
- Generation typically takes 1-3 seconds for short text
