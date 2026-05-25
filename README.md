<p align="center">
  <img src="assets/logo.png" alt="Pythia" width="240" />
</p>

<h1 align="center">Pythia</h1>

<p align="center">
  An MCP oracle for the OpenAI multimodal API.<br/>
  Image, voice, transcription, memory, moderation.
</p>

---

The Pythia spoke for Apollo, god of music, poetry, prophecy, and the sun. Her oracular voice was the multimodal interface to a god's mind. This MCP server is the same idea, smaller god. Whatever the OpenAI API can generate, perceive, or judge, Pythia hands back to whatever model is driving Claude Code.

## Tools

| Tool | What it does | Default model |
|---|---|---|
| `generate_image` | Text to image. Saves to disk. | `gpt-image-2` |
| `edit_image` | Edits one or more existing images by prompt. Optional mask for inpainting (gpt-image-1). | `gpt-image-2` |
| `speak` | Text to speech. Saves an audio file. Voice prompting via `instructions`. | `gpt-4o-mini-tts` |
| `transcribe` | Speech to text from an audio file. Optional language hint, prompt, timestamps, diarization. | `gpt-4o-transcribe` |
| `embed` | Text to vector(s). Returns inline or writes JSON. | `text-embedding-3-large` |
| `moderate` | Classifies text and/or image against OpenAI safety categories. | `omni-moderation-latest` |

Every model default is overridable per call and via environment variable, so a new OpenAI model lands and the only thing you change is the default.

## Requirements

- Node.js ≥ 18
- An OpenAI API key with access to the models you intend to call

## Install

```bash
git clone https://github.com/hello-emrah/pythia-mcp.git
cd pythia-mcp
npm install
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

## Wire into Claude Code

Add an entry to `~/.claude.json` under `mcpServers`:

```json
{
  "mcpServers": {
    "pythia": {
      "command": "node",
      "args": ["/absolute/path/to/pythia-mcp/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

Restart Claude Code. The tools appear under the `mcp__pythia__*` namespace.

## Environment variables

| Variable | Required | Default |
|---|---|---|
| `OPENAI_API_KEY` | yes | — |
| `OPENAI_IMAGE_OUTPUT_DIR` | no | `~/Pictures/openai-images` |
| `OPENAI_AUDIO_OUTPUT_DIR` | no | `~/Music/openai-audio` |
| `OPENAI_IMAGE_MODEL` | no | `gpt-image-2` |
| `OPENAI_TTS_MODEL` | no | `gpt-4o-mini-tts` |
| `OPENAI_TTS_VOICE` | no | `marin` |
| `OPENAI_STT_MODEL` | no | `gpt-4o-transcribe` |
| `OPENAI_EMBED_MODEL` | no | `text-embedding-3-large` |
| `OPENAI_MODERATION_MODEL` | no | `omni-moderation-latest` |

## Tool reference

### `generate_image`

Generates a new image from a text prompt. Defaults to `gpt-image-2`.

| Param | Type | Required | Default |
|---|---|---|---|
| `prompt` | string | yes | — |
| `output_path` | string | no | `OPENAI_IMAGE_OUTPUT_DIR/image-<timestamp>.png` |
| `size` | string | no | `1024x1024` |
| `quality` | string | no | `high` |
| `model` | string | no | env-configured |

`gpt-image-2` supports sizes from 1024 to 3840 px on each edge (multiples of 16, max aspect ratio 3:1) and quality tiers `low`, `medium`, `high`, `auto`.

### `edit_image`

Edits one or more existing images with a text prompt.

| Param | Type | Required | Default |
|---|---|---|---|
| `prompt` | string | yes | — |
| `image_paths` | string[] | yes | — |
| `mask_path` | string | no | — |
| `output_path` | string | no | `OPENAI_IMAGE_OUTPUT_DIR/edit-<timestamp>.png` |
| `size` | string | no | `1024x1024` |
| `quality` | string | no | `high` |
| `model` | string | no | env-configured |

Masks are honored only by `gpt-image-1`. `gpt-image-2` processes every input image at high fidelity automatically.

### `speak`

Text to speech.

| Param | Type | Required | Default |
|---|---|---|---|
| `text` | string | yes | — |
| `output_path` | string | no | `OPENAI_AUDIO_OUTPUT_DIR/speech-<timestamp>.<format>` |
| `voice` | string | no | `marin` |
| `model` | string | no | env-configured |
| `format` | string | no | `mp3` |
| `instructions` | string | no | — |
| `speed` | number | no | `1.0` |

Voices: `alloy`, `ash`, `ballad`, `coral`, `echo`, `fable`, `nova`, `onyx`, `sage`, `shimmer`, `verse`, `marin`, `cedar`. The 13-voice set is supported by `gpt-4o-mini-tts`; the older `tts-1` family supports the first nine. Formats: `mp3`, `opus`, `aac`, `flac`, `wav`, `pcm`.

`instructions` is `gpt-4o-mini-tts` only: free-form direction on accent, emotion, intonation, pace, tone, or whispering.

### `transcribe`

Speech to text from an audio file. Up to 25 MB.

| Param | Type | Required | Default |
|---|---|---|---|
| `audio_path` | string | yes | — |
| `model` | string | no | env-configured |
| `language` | string | no | auto-detect |
| `prompt` | string | no | — |
| `response_format` | string | no | `json` |
| `timestamp_granularities` | string[] | no | — |

Accepted input formats: `mp3`, `mp4`, `mpeg`, `mpga`, `m4a`, `wav`, `webm`. Response formats vary by model: `whisper-1` supports `json`, `text`, `srt`, `verbose_json`, `vtt`; the GPT-4o transcribe family supports `json` or plain `text`; the diarized variant adds `diarized_json`.

### `embed`

Text to vector embeddings.

| Param | Type | Required | Default |
|---|---|---|---|
| `input` | string \| string[] | yes | — |
| `model` | string | no | env-configured |
| `dimensions` | number | no | model default |
| `output_path` | string | no | — |

Returns embeddings inline by default. Pass `output_path` to write the full response as JSON instead. v3 models (`text-embedding-3-small`, `text-embedding-3-large`) accept a `dimensions` parameter to truncate output (a shortened 3-large at 256 dims still outperforms full ada-002).

### `moderate`

Classifies inputs against OpenAI safety categories.

| Param | Type | Required | Default |
|---|---|---|---|
| `input` | string \| object \| array | yes | — |
| `model` | string | no | env-configured |

`omni-moderation-latest` is multimodal: it accepts text and image URLs and returns per-category confidence scores plus per-input-type flags. `text-moderation-latest` is the legacy text-only model.

## CLI fallback

A standalone Python CLI (`image-gen.py`) is included for one-shot image generation outside the MCP server. See `IMAGE-GEN-HOWTO.md`.

## Why "Pythia"

The Pythia was the Oracle of Delphi, the priestess through whom Apollo spoke. The name signals what this tool does: you speak, and something is given back. Pythia was not an image-specific oracle. She covered Apollo's full domain. So does this one.

## Design philosophy

The visual mark and the tool itself were built deliberately against the visual language of capitalist software design. No gradients, no neon, no glass, no drop shadows, no isometric stock illustration. Single-shade flat seals in warm earth tones, ancient-glyph silhouettes, generous whitespace. The mark could be pressed into wax or carved into stone.

This tool is built for personal use and shared openly. It is not productised, monetised, or instrumented. Use it for your own work or fork it for yours.

## License

MIT
