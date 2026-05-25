#!/usr/bin/env python3
"""
Ether OS — Image Generation Script
Model: gpt-image-1 (OpenAI)
Usage: see IMAGE-GEN-HOWTO.md in this folder

Run from terminal:
  OPENAI_API_KEY="sk-..." python3 image-gen.py \
    --prompt "your prompt here" \
    --output "/absolute/path/to/output.png" \
    --size 1024x1536 \
    --quality high
"""

import argparse
import base64
import os
import sys
from pathlib import Path


def generate_image(prompt: str, output_path: str, size: str = "1024x1024", quality: str = "high") -> None:
    try:
        from openai import OpenAI
    except ImportError:
        print("ERROR: openai not installed. Run: pip3 install openai --break-system-packages")
        sys.exit(1)

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("ERROR: OPENAI_API_KEY environment variable not set.")
        sys.exit(1)

    valid_sizes = ["1024x1024", "1024x1536", "1536x1024"]
    if size not in valid_sizes:
        print(f"ERROR: Invalid size '{size}'. Choose from: {', '.join(valid_sizes)}")
        sys.exit(1)

    valid_qualities = ["low", "medium", "high"]
    if quality not in valid_qualities:
        print(f"ERROR: Invalid quality '{quality}'. Choose from: {', '.join(valid_qualities)}")
        sys.exit(1)

    output = Path(output_path).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    if output.suffix.lower() not in [".png", ".jpg", ".jpeg", ".webp"]:
        print(f"ERROR: Output file must be .png, .jpg, .jpeg, or .webp")
        sys.exit(1)

    print(f"Generating image...")
    print(f"  Model:   gpt-image-1")
    print(f"  Size:    {size}")
    print(f"  Quality: {quality}")
    print(f"  Output:  {output}")
    print(f"  Prompt:  {prompt[:80]}{'...' if len(prompt) > 80 else ''}")
    print()

    client = OpenAI(api_key=api_key)

    result = client.images.generate(
        model="gpt-image-1",
        prompt=prompt,
        size=size,
        quality=quality,
        n=1,
    )

    image_data = base64.b64decode(result.data[0].b64_json)
    output.write_bytes(image_data)

    size_kb = len(image_data) / 1024
    print(f"Done. Saved to: {output}")
    print(f"File size: {size_kb:.1f} KB")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate images via OpenAI gpt-image-1")
    parser.add_argument("--prompt", required=True, help="Image generation prompt")
    parser.add_argument("--output", required=True, help="Absolute output file path (.png, .jpg, .webp)")
    parser.add_argument("--size", default="1024x1024", help="Image size: 1024x1024, 1024x1536, 1536x1024")
    parser.add_argument("--quality", default="high", help="Quality: low, medium, high")
    args = parser.parse_args()

    generate_image(
        prompt=args.prompt,
        output_path=args.output,
        size=args.size,
        quality=args.quality,
    )
