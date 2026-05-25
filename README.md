<p align="center">
  <img src="assets/logo.png" alt="Pythia" width="240" />
</p>

<h1 align="center">Pythia</h1>

<p align="center">
  An MCP oracle for OpenAI image generation and editing, powered by <code>gpt-image-1</code>.
</p>

---

## Tools

- **`generate_image`** — create a new image from a text prompt
- **`edit_image`** — edit one or more existing images with a text prompt (supports an optional mask for inpainting)

Both tools save the result to disk and return the file path plus metadata.

## Requirements

- Node.js ≥ 18
- An OpenAI API key with access to `gpt-image-1`

## Install

```bash
git clone https://github.com/<your-user>/pythia-mcp.git
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
        "OPENAI_API_KEY": "sk-...",
        "OPENAI_IMAGE_OUTPUT_DIR": "/absolute/path/to/output/dir"
      }
    }
  }
}
```

Restart Claude Code. The `generate_image` and `edit_image` tools will appear under the `mcp__pythia__*` namespace.

## Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `OPENAI_API_KEY` | yes | — | Your OpenAI API key. |
| `OPENAI_IMAGE_OUTPUT_DIR` | no | `~/Pictures/openai-images` | Used when a tool call omits `output_path`. |

## Tool reference

### `generate_image`

| Param | Type | Required | Default |
|---|---|---|---|
| `prompt` | string | yes | — |
| `output_path` | string | no | `OPENAI_IMAGE_OUTPUT_DIR/image-<timestamp>.png` |
| `size` | string | no | `1024x1024` |
| `quality` | string | no | `high` |

Sizes: `1024x1024`, `1024x1536`, `1536x1024`, `auto`.
Qualities: `low`, `medium`, `high`, `auto`.

### `edit_image`

| Param | Type | Required | Default |
|---|---|---|---|
| `prompt` | string | yes | — |
| `image_paths` | string[] | yes | — |
| `mask_path` | string | no | — |
| `output_path` | string | no | `OPENAI_IMAGE_OUTPUT_DIR/edit-<timestamp>.png` |
| `size` | string | no | `1024x1024` |
| `quality` | string | no | `high` |

Input images must be PNG, JPG, or WebP. Mask is a PNG where transparent pixels mark the area to edit.

## CLI fallback

A standalone Python CLI (`image-gen.py`) is included for one-shot use without the MCP server. See `IMAGE-GEN-HOWTO.md`.

## Why "Pythia"

Pythia was the Oracle of Delphi, the priestess through whom visions came. The name signals what this tool does: you speak, and an image is given back.

## License

MIT
