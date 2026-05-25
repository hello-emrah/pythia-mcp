#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import OpenAI from 'openai';
import { readFileSync, writeFileSync, mkdirSync, createReadStream } from 'fs';
import { dirname, resolve, extname } from 'path';
import { homedir } from 'os';

// ─── Config ───────────────────────────────────────────────────────────────────

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('ERROR: OPENAI_API_KEY env var is not set.');
  process.exit(1);
}

const IMAGE_DIR     = process.env.OPENAI_IMAGE_OUTPUT_DIR || `${homedir()}/Pictures/openai-images`;
const AUDIO_DIR     = process.env.OPENAI_AUDIO_OUTPUT_DIR || `${homedir()}/Music/openai-audio`;

const IMAGE_MODEL   = process.env.OPENAI_IMAGE_MODEL      || 'gpt-image-2';
const TTS_MODEL     = process.env.OPENAI_TTS_MODEL        || 'gpt-4o-mini-tts';
const TTS_VOICE     = process.env.OPENAI_TTS_VOICE        || 'marin';
const STT_MODEL     = process.env.OPENAI_STT_MODEL        || 'gpt-4o-transcribe';
const EMBED_MODEL   = process.env.OPENAI_EMBED_MODEL      || 'text-embedding-3-large';
const MOD_MODEL     = process.env.OPENAI_MODERATION_MODEL || 'omni-moderation-latest';

const IMAGE_SIZES     = ['1024x1024', '1024x1536', '1536x1024', '2048x2048', '2048x1152', '1152x2048', 'auto'];
const IMAGE_QUALITIES = ['low', 'medium', 'high', 'auto'];
const TTS_VOICES      = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
const TTS_FORMATS     = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'];

const openai = new OpenAI({ apiKey });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function expandPath(p) {
  if (!p) return p;
  if (p.startsWith('~')) p = p.replace(/^~/, homedir());
  return resolve(p);
}

function resolveOutputPath(output_path, root, fallbackName, defaultExt) {
  if (output_path) return expandPath(output_path);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return resolve(root, `${fallbackName}-${stamp}.${defaultExt}`);
}

function writeBinary(outputPath, buffer, validExts) {
  const ext = extname(outputPath).toLowerCase();
  if (validExts && !validExts.includes(ext)) {
    throw new Error(`Output file extension must be one of: ${validExts.join(', ')}. Got: ${ext || '(none)'}`);
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, buffer);
  return { path: outputPath, size_kb: Math.round(buffer.length / 1024) };
}

function writeJson(outputPath, data) {
  mkdirSync(dirname(outputPath), { recursive: true });
  const json = JSON.stringify(data);
  writeFileSync(outputPath, json);
  return { path: outputPath, size_kb: Math.round(Buffer.byteLength(json) / 1024) };
}

// ─── Image: generate ──────────────────────────────────────────────────────────

async function generateImage({ prompt, output_path, size = '1024x1024', quality = 'high', model = IMAGE_MODEL }) {
  if (!prompt) throw new Error('prompt is required.');
  if (size && !IMAGE_SIZES.includes(size) && size !== 'auto') {
    throw new Error(`Invalid size "${size}". Common values: ${IMAGE_SIZES.join(', ')}`);
  }
  if (quality && !IMAGE_QUALITIES.includes(quality)) {
    throw new Error(`Invalid quality "${quality}". Choose: ${IMAGE_QUALITIES.join(', ')}`);
  }

  const out = resolveOutputPath(output_path, IMAGE_DIR, 'image', 'png');
  const result = await openai.images.generate({ model, prompt, size, quality, n: 1 });
  const b64 = result.data[0].b64_json;
  if (!b64) throw new Error('No image data returned from OpenAI.');
  const file = writeBinary(out, Buffer.from(b64, 'base64'), ['.png', '.jpg', '.jpeg', '.webp']);

  return { model, size, quality, prompt_preview: prompt.slice(0, 200), output: file };
}

// ─── Image: edit ──────────────────────────────────────────────────────────────

async function editImage({ prompt, image_paths, mask_path, output_path, size = '1024x1024', quality = 'high', model = IMAGE_MODEL }) {
  if (!prompt) throw new Error('prompt is required.');
  if (!image_paths || !image_paths.length) throw new Error('image_paths is required (array of file paths).');

  const out = resolveOutputPath(output_path, IMAGE_DIR, 'edit', 'png');

  const { toFile } = await import('openai/uploads');
  const images = await Promise.all(image_paths.map(async (p) => {
    const abs = expandPath(p);
    const buf = readFileSync(abs);
    return toFile(buf, abs.split('/').pop(), { type: 'image/png' });
  }));

  const params = {
    model, prompt, n: 1, size, quality,
    image: images.length === 1 ? images[0] : images,
  };
  if (mask_path) {
    const maskAbs = expandPath(mask_path);
    params.mask = await toFile(readFileSync(maskAbs), maskAbs.split('/').pop(), { type: 'image/png' });
  }

  const result = await openai.images.edit(params);
  const b64 = result.data[0].b64_json;
  if (!b64) throw new Error('No image data returned from OpenAI.');
  const file = writeBinary(out, Buffer.from(b64, 'base64'), ['.png', '.jpg', '.jpeg', '.webp']);

  return { model, size, quality, prompt_preview: prompt.slice(0, 200), inputs: image_paths, mask: mask_path || null, output: file };
}

// ─── Audio: speak (TTS) ───────────────────────────────────────────────────────

async function speak({ text, output_path, voice = TTS_VOICE, model = TTS_MODEL, format = 'mp3', instructions, speed }) {
  if (!text) throw new Error('text is required.');
  if (voice && !TTS_VOICES.includes(voice)) {
    throw new Error(`Invalid voice "${voice}". Choose: ${TTS_VOICES.join(', ')}`);
  }
  if (format && !TTS_FORMATS.includes(format)) {
    throw new Error(`Invalid format "${format}". Choose: ${TTS_FORMATS.join(', ')}`);
  }

  const out = resolveOutputPath(output_path, AUDIO_DIR, 'speech', format);

  const params = { model, voice, input: text, response_format: format };
  if (instructions) params.instructions = instructions;
  if (typeof speed === 'number') params.speed = speed;

  const result = await openai.audio.speech.create(params);
  const buffer = Buffer.from(await result.arrayBuffer());
  const file = writeBinary(out, buffer, [`.${format}`, '.mp3', '.opus', '.aac', '.flac', '.wav', '.pcm']);

  return { model, voice, format, text_preview: text.slice(0, 200), output: file };
}

// ─── Audio: transcribe (STT) ──────────────────────────────────────────────────

async function transcribe({ audio_path, model = STT_MODEL, language, prompt, response_format = 'json', timestamp_granularities }) {
  if (!audio_path) throw new Error('audio_path is required.');
  const abs = expandPath(audio_path);

  const params = {
    file: createReadStream(abs),
    model,
    response_format,
  };
  if (language) params.language = language;
  if (prompt) params.prompt = prompt;
  if (timestamp_granularities) params.timestamp_granularities = timestamp_granularities;

  const result = await openai.audio.transcriptions.create(params);
  return { model, input: abs, ...(typeof result === 'string' ? { text: result } : result) };
}

// ─── Embeddings ───────────────────────────────────────────────────────────────

async function embed({ input, model = EMBED_MODEL, dimensions, output_path }) {
  if (!input) throw new Error('input is required (string or array of strings).');

  const params = { model, input };
  if (typeof dimensions === 'number') params.dimensions = dimensions;

  const result = await openai.embeddings.create(params);
  const summary = {
    model: result.model,
    dimensions: result.data[0].embedding.length,
    count: result.data.length,
    usage: result.usage,
  };

  if (output_path) {
    const out = expandPath(output_path);
    const file = writeJson(out, result);
    return { ...summary, output: file };
  }
  return { ...summary, embeddings: result.data.map((d) => d.embedding) };
}

// ─── Moderation ───────────────────────────────────────────────────────────────

async function moderate({ input, model = MOD_MODEL }) {
  if (!input) throw new Error('input is required (string, image url, or array of inputs).');
  const result = await openai.moderations.create({ model, input });
  return result;
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'generate_image',
    description: 'Generate a new image from a text prompt. Defaults to gpt-image-2 (configurable via OPENAI_IMAGE_MODEL).',
    inputSchema: {
      type: 'object',
      properties: {
        prompt:      { type: 'string', description: 'Text prompt describing the image.' },
        output_path: { type: 'string', description: 'Absolute or ~-relative output path. Defaults to OPENAI_IMAGE_OUTPUT_DIR.' },
        size:        { type: 'string', description: 'Image size. Default: 1024x1024.' },
        quality:     { type: 'string', enum: IMAGE_QUALITIES, description: 'Render quality. Default: high.' },
        model:       { type: 'string', description: 'Model override (e.g. gpt-image-1, gpt-image-2). Default: env-configured.' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'edit_image',
    description: 'Edit one or more existing images with a text prompt. Supports an optional mask for inpainting (gpt-image-1 only).',
    inputSchema: {
      type: 'object',
      properties: {
        prompt:      { type: 'string', description: 'Text prompt describing the edit.' },
        image_paths: { type: 'array', items: { type: 'string' }, description: 'One or more input image file paths.' },
        mask_path:   { type: 'string', description: 'Optional mask image path. gpt-image-1 only; gpt-image-2 ignores masks.' },
        output_path: { type: 'string', description: 'Absolute or ~-relative output path.' },
        size:        { type: 'string', description: 'Image size. Default: 1024x1024.' },
        quality:     { type: 'string', enum: IMAGE_QUALITIES, description: 'Render quality. Default: high.' },
        model:       { type: 'string', description: 'Model override. Default: env-configured.' },
      },
      required: ['prompt', 'image_paths'],
    },
  },
  {
    name: 'speak',
    description: 'Text to speech. Generates an audio file from text. Defaults to gpt-4o-mini-tts with voice "marin".',
    inputSchema: {
      type: 'object',
      properties: {
        text:         { type: 'string', description: 'The text to speak.' },
        output_path:  { type: 'string', description: 'Absolute or ~-relative output path. Defaults to OPENAI_AUDIO_OUTPUT_DIR.' },
        voice:        { type: 'string', enum: TTS_VOICES, description: 'Voice. Default: marin (or OPENAI_TTS_VOICE).' },
        model:        { type: 'string', description: 'Model override (tts-1, tts-1-hd, gpt-4o-mini-tts). Default: env-configured.' },
        format:       { type: 'string', enum: TTS_FORMATS, description: 'Audio format. Default: mp3.' },
        instructions: { type: 'string', description: 'Optional voice-prompting instructions (gpt-4o-mini-tts: accent, emotion, pace, tone, whisper, etc.).' },
        speed:        { type: 'number', description: 'Optional speed multiplier (0.25 to 4.0). Default: 1.0.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'transcribe',
    description: 'Speech to text. Transcribes an audio file. Defaults to gpt-4o-transcribe. Accepts mp3, mp4, mpeg, mpga, m4a, wav, webm (max 25 MB).',
    inputSchema: {
      type: 'object',
      properties: {
        audio_path:              { type: 'string', description: 'Path to an audio file.' },
        model:                   { type: 'string', description: 'Model override (whisper-1, gpt-4o-transcribe, gpt-4o-mini-transcribe, gpt-4o-transcribe-diarize). Default: env-configured.' },
        language:                { type: 'string', description: 'Optional ISO-639-1 language hint.' },
        prompt:                  { type: 'string', description: 'Optional context to improve accuracy.' },
        response_format:         { type: 'string', description: 'json, text, srt, verbose_json, vtt, or diarized_json (model-dependent). Default: json.' },
        timestamp_granularities: { type: 'array', items: { type: 'string' }, description: 'whisper-1 only: ["word"], ["segment"], or both.' },
      },
      required: ['audio_path'],
    },
  },
  {
    name: 'embed',
    description: 'Generate vector embeddings from one or more text inputs. Defaults to text-embedding-3-large (3072 dims).',
    inputSchema: {
      type: 'object',
      properties: {
        input:       { description: 'A string or array of strings to embed.' },
        model:       { type: 'string', description: 'Model override (text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002). Default: env-configured.' },
        dimensions:  { type: 'number', description: 'Optional output dimensions (v3 models only).' },
        output_path: { type: 'string', description: 'Optional JSON output path. If set, embeddings are written to disk and not returned inline.' },
      },
      required: ['input'],
    },
  },
  {
    name: 'moderate',
    description: 'Classify text and/or image inputs against OpenAI safety categories. Defaults to omni-moderation-latest (multimodal).',
    inputSchema: {
      type: 'object',
      properties: {
        input: { description: 'A string, image url, or array of inputs to moderate.' },
        model: { type: 'string', description: 'Model override (omni-moderation-latest, text-moderation-latest). Default: env-configured.' },
      },
      required: ['input'],
    },
  },
];

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'pythia-mcp', version: '2.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  try {
    let result;
    switch (name) {
      case 'generate_image': result = await generateImage(args); break;
      case 'edit_image':     result = await editImage(args); break;
      case 'speak':          result = await speak(args); break;
      case 'transcribe':     result = await transcribe(args); break;
      case 'embed':          result = await embed(args); break;
      case 'moderate':       result = await moderate(args); break;
      default: throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
