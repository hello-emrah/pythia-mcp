#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import OpenAI from 'openai';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve, extname } from 'path';
import { homedir } from 'os';

// ─── Config ───────────────────────────────────────────────────────────────────

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('ERROR: OPENAI_API_KEY env var is not set.');
  process.exit(1);
}

const DEFAULT_OUTPUT_DIR = process.env.OPENAI_IMAGE_OUTPUT_DIR || `${homedir()}/Pictures/openai-images`;
const MODEL = 'gpt-image-1';
const VALID_SIZES = ['1024x1024', '1024x1536', '1536x1024', 'auto'];
const VALID_QUALITIES = ['low', 'medium', 'high', 'auto'];

const openai = new OpenAI({ apiKey });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function expandPath(p) {
  if (!p) return p;
  if (p.startsWith('~')) p = p.replace(/^~/, homedir());
  return resolve(p);
}

function resolveOutputPath(output_path, fallbackName) {
  if (output_path) return expandPath(output_path);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return resolve(DEFAULT_OUTPUT_DIR, `${fallbackName}-${stamp}.png`);
}

function writeImage(outputPath, b64) {
  const ext = extname(outputPath).toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    throw new Error(`Output file must be .png, .jpg, .jpeg, or .webp. Got: ${ext || '(none)'}`);
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  const buffer = Buffer.from(b64, 'base64');
  writeFileSync(outputPath, buffer);
  return { path: outputPath, size_kb: Math.round(buffer.length / 1024) };
}

function validate({ size, quality }) {
  if (size && !VALID_SIZES.includes(size)) {
    throw new Error(`Invalid size "${size}". Choose: ${VALID_SIZES.join(', ')}`);
  }
  if (quality && !VALID_QUALITIES.includes(quality)) {
    throw new Error(`Invalid quality "${quality}". Choose: ${VALID_QUALITIES.join(', ')}`);
  }
}

// ─── API functions ────────────────────────────────────────────────────────────

async function generateImage({ prompt, output_path, size = '1024x1024', quality = 'high' }) {
  if (!prompt) throw new Error('prompt is required.');
  validate({ size, quality });

  const resolved = resolveOutputPath(output_path, 'image');

  const result = await openai.images.generate({
    model: MODEL,
    prompt,
    size,
    quality,
    n: 1,
  });

  const b64 = result.data[0].b64_json;
  if (!b64) throw new Error('No image data returned from OpenAI.');
  const file = writeImage(resolved, b64);

  return {
    model: MODEL,
    size,
    quality,
    prompt_preview: prompt.slice(0, 200),
    output: file,
  };
}

async function editImage({ prompt, image_paths, output_path, size = '1024x1024', quality = 'high', mask_path }) {
  if (!prompt) throw new Error('prompt is required.');
  if (!image_paths || !image_paths.length) throw new Error('image_paths is required (array of file paths).');
  validate({ size, quality });

  const resolved = resolveOutputPath(output_path, 'edit');

  // OpenAI SDK accepts File objects; in Node we use toFile from openai/uploads
  const { toFile } = await import('openai/uploads');

  const images = await Promise.all(
    image_paths.map(async (p) => {
      const abs = expandPath(p);
      const buf = readFileSync(abs);
      return toFile(buf, abs.split('/').pop(), { type: 'image/png' });
    })
  );

  const params = {
    model: MODEL,
    prompt,
    image: images.length === 1 ? images[0] : images,
    size,
    quality,
    n: 1,
  };

  if (mask_path) {
    const maskAbs = expandPath(mask_path);
    const maskBuf = readFileSync(maskAbs);
    params.mask = await toFile(maskBuf, maskAbs.split('/').pop(), { type: 'image/png' });
  }

  const result = await openai.images.edit(params);

  const b64 = result.data[0].b64_json;
  if (!b64) throw new Error('No image data returned from OpenAI.');
  const file = writeImage(resolved, b64);

  return {
    model: MODEL,
    size,
    quality,
    prompt_preview: prompt.slice(0, 200),
    inputs: image_paths,
    mask: mask_path || null,
    output: file,
  };
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'generate_image',
    description: 'Generate a new image from a text prompt using OpenAI gpt-image-1. Saves to disk.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Text prompt describing the image to generate.' },
        output_path: {
          type: 'string',
          description: 'Absolute or ~-relative output path (.png, .jpg, .jpeg, .webp). Defaults to OPENAI_IMAGE_OUTPUT_DIR with a timestamped filename.',
        },
        size: {
          type: 'string',
          enum: VALID_SIZES,
          description: 'Image size. Default: 1024x1024.',
        },
        quality: {
          type: 'string',
          enum: VALID_QUALITIES,
          description: 'Render quality. Default: high.',
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'edit_image',
    description: 'Edit one or more existing images with a text prompt using OpenAI gpt-image-1. Supports an optional mask for inpainting.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Text prompt describing the edit.' },
        image_paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'One or more input image file paths (absolute or ~-relative).',
        },
        mask_path: {
          type: 'string',
          description: 'Optional mask image path (transparent pixels mark edit regions).',
        },
        output_path: {
          type: 'string',
          description: 'Absolute or ~-relative output path. Defaults to OPENAI_IMAGE_OUTPUT_DIR.',
        },
        size: { type: 'string', enum: VALID_SIZES, description: 'Image size. Default: 1024x1024.' },
        quality: { type: 'string', enum: VALID_QUALITIES, description: 'Render quality. Default: high.' },
      },
      required: ['prompt', 'image_paths'],
    },
  },
];

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'openai-images-mcp', version: '1.0.0' },
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
      default: throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
