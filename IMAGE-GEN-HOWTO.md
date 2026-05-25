---
title: "Image Generation — How To"
slug: "image-gen-howto"
type: reference
maintained_by:
  - "[[Ether Dev]]"
created: "[[2026-04-24]]"
updated: "[[2026-04-24]]"
---

# Image Generation — How To

Reference for any agent or Cowork session generating images for Ether OS projects. Uses OpenAI `gpt-image-1`.

---

## Prerequisites

1. **OpenAI API key** — must be set as `OPENAI_API_KEY` in the environment
2. **openai Python package** — install once with:
   ```bash
   pip3 install openai --break-system-packages
   ```
3. **Funded OpenAI account** — gpt-image-1 costs approx $0.02–0.19 per image depending on quality. Top up at platform.openai.com/settings/organization/billing

---

## Script location

```
OS/Skills/image-gen/image-gen.py
```

The script accepts `--prompt`, `--output`, `--size`, and `--quality` arguments. Run it from the terminal or invoke it via Cowork bash.

---

## Usage

```bash
OPENAI_API_KEY="sk-..." python3 "path/to/image-gen.py" \
  --prompt "your prompt" \
  --output "/absolute/path/to/output.png" \
  --size 1024x1024 \
  --quality high
```

### Size options

| Size | Ratio | Use for |
|---|---|---|
| `1024x1024` | 1:1 | Square images, thumbnails, OG images |
| `1024x1536` | 2:3 portrait | Hero images (tall), profile shots |
| `1536x1024` | 3:2 landscape | Wide banners, background images |

### Quality options

| Quality | Cost | Use for |
|---|---|---|
| `low` | ~$0.02 | Drafts, quick previews |
| `medium` | ~$0.07 | Standard web use |
| `high` | ~$0.19 | Hero images, client deliverables |

---

## Output naming conventions

Always save images to the project's `assets/images/` folder. Use descriptive hyphenated filenames that encode the subject and intended placement.

**Pattern:** `{placement}-{subject}-{variant}.png`

**Examples:**

| Filename | Meaning |
|---|---|
| `hero-carer-participant.png` | Hero section, carer with participant |
| `hero-carer-participant-v2.png` | Second variation of the above |
| `about-team-outdoor.png` | About section, team photo, outdoor setting |
| `og-home.png` | Open Graph image for Home page |
| `og-contact.png` | Open Graph image for Contact page |

**Project asset paths by vertical:**

| Vertical | Images path |
|---|---|
| Sadie Grace | `Workbench/Clients/Sadie Grace/Project - SadieGrace/assets/images/` |
| Mira | `Workbench/Clients/Mira/{project}/assets/images/` |
| 311 | `Workbench/Clients/311/{project}/assets/images/` |
| Koda Moss | `Workbench/Ventures/Koda Moss/{project}/assets/images/` |
| Lune | `Workbench/Ventures/Lune/{project}/assets/images/` |
| Kensington Produce | `Workbench/Clients/Kensington Produce/{project}/assets/images/` |

Always use absolute paths. Always call `os.makedirs(..., exist_ok=True)` before writing.

---

## Prompt writing guide

`gpt-image-1` responds well to structured prompts. Use this format:

```
{Orientation/format}. {Subject and action}. {Setting}. {Mood/lighting}. {Style}. {Exclusions}.
```

**Example (Sadie Grace hero):**
```
Portrait orientation photograph. A warm, natural moment between a female NDIS support worker 
of African or South Asian background and an elderly participant outdoors in an Australian 
garden. Sharing a genuine smile. Natural light, soft warm tones. Photorealistic. 
No text, no logos.
```

**Tips:**
- State orientation first (`portrait`, `landscape`, `square`)
- Name the subject's background/ethnicity if diversity is important — the model respects this
- Say `photorealistic` for photos; omit for illustration
- Always include `no text, no logos` to keep images clean
- Avoid vague adjectives like "beautiful" — describe what you see instead
- For warm tones: `soft warm tones, golden hour light, natural daylight`
- For clinical/clean: `clean white background, studio lighting, neutral tones`

---

## Generating multiple variations

To generate variants, run the script multiple times with slightly different prompts and append `-v2`, `-v3` to the filename. Example:

```bash
# Variation 1
OPENAI_API_KEY="sk-..." python3 image-gen.py \
  --prompt "Portrait photo, female carer of African background with elderly participant, Australian garden, warm light" \
  --output "/path/to/assets/images/hero-carer-participant-v1.png" \
  --size 1024x1536 --quality high

# Variation 2 — different angle
OPENAI_API_KEY="sk-..." python3 image-gen.py \
  --prompt "Portrait photo, female carer of South Asian background walking alongside young adult with disability in suburban park, natural light, warm tones" \
  --output "/path/to/assets/images/hero-carer-participant-v2.png" \
  --size 1024x1536 --quality high
```

---

## Cowork one-liner pattern

For Cowork sessions where the sandbox cannot reach the OpenAI API, give Emrah a terminal one-liner:

```bash
OPENAI_API_KEY="sk-..." python3 -c "
import base64, os, sys
sys.path.insert(0, '')
from openai import OpenAI
client = OpenAI()
r = client.images.generate(model='gpt-image-1', prompt='YOUR PROMPT', size='1024x1536', quality='high', n=1)
data = base64.b64decode(r.data[0].b64_json)
path = os.path.expanduser('~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Ether/YOUR/PATH/filename.png')
os.makedirs(os.path.dirname(path), exist_ok=True)
open(path, 'wb').write(data)
print('Done:', path)
"
```

Replace `YOUR PROMPT` and `YOUR/PATH/filename.png` before handing to Emrah.

---

## After generation

1. Open the image in Finder/Preview and review before using in client work
2. If rejected, regenerate with a refined prompt — append `-v2` to the filename
3. Once approved, record the final filename in the project ledger or session notes
4. Upload to Webflow/CMS as needed — Webflow accepts PNG, JPG, WebP up to 4MB
