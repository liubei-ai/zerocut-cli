![status: WIP](https://img.shields.io/badge/status-WIP-orange)

# ZeroCut CLI

ZeroCut CLI is a modular, extensible command-line toolkit that lets an AI assistant create and edit media across images, audio, and video. It is built with Node.js (TypeScript), uses CommonJS output, and follows a one-command-per-file architecture.

## Features

- Media creation and editing for images, audio, and video
- Modular commands (one file per command under `src/commands/*`)
- Dynamic external command loading via `ZEROCUT_COMMANDS_DIR` (.js/.cjs files)
- Configuration interceptor that validates required keys (`apiKey`)
- Session lifecycle management using Cerevox (open on preAction, close on postAction)
- Strict TypeScript, ESLint + Prettier, pnpm-based project

Note: Image commands are implemented. Video commands are available with placeholder implementations and validated parameters. Audio commands are planned.

## Requirements

- Node.js >= 18
- pnpm (package manager)

## Installation

### From Registry (recommended)

```bash
# pnpm global install (preferred)
pnpm add -g zerocut-cli

# Run directly without installing
pnpm dlx zerocut-cli help
```

### Local Development

```bash
# install deps and build
pnpm install
pnpm run build

# link globally for local testing
pnpm link --global

# verify
zerocut help
```

## Quick Start

- Show help:

```bash
zerocut help
```

- Configure required settings:

```bash
zerocut config key <key>            # Or use OTT exchange below
# quick OTT exchange:
zerocut config --ott <token> --region <cn|us>
```

If configuration is missing, Zerocut prints:

```
Missing required configuration: apiKey
Configure using:
  zerocut config key <key>
or:
  zerocut config --ott <token> --region <cn|us>
```

## Configuration

- Config file primary path: `~/.zerocut/config.json`
- Keys:
  - `apiKey`: string
  - `region`: environment region, one of `us` or `cn` (default: `us`)
- Key-path API (internal): `getConfigValueSync('a.b')`, `setConfigValueSync('a.b.c','value')`

### Interactive configuration
Key setup supports direct input or OTT exchange:
```bash
zerocut config key                   # prompts: choose region (cn/us), then enter OTT
zerocut config --ott <token> --region <cn|us>   # non-interactive
```

## Commands

- `help` — show available commands
- `config` — configuration management
  - `key [key]` — set API key (prompts if omitted; supports OTT exchange)
- `image` — create a new image (default action; requires `--prompt`)
  - Options:
    - `--prompt <prompt>` (required)
    - `--model <model>` (seedream|seedream-pro|seedream-5l|banana|banana2|banana-pro|wan)
    - `--aspectRatio <ratio>` (1:1|3:4|4:3|16:9|9:16|2:3|3:2|21:9|1:4|4:1|1:8|8:1)
    - `--resolution <resolution>` (1K|2K|4K)
    - `--refs <img1,img2,...>` (comma-separated paths/URLs)
    - `--output <file>` (output file path)
  - Notes:
    - During image generation, CLI displays a lightweight spinner-based progress indicator to show that inference is running.
- `audio` — audio commands (parent) — planned
  - `create` — synthesize or compose audio from text or references — planned
  - `edit` — trim, mix, or apply effects to existing audio — planned
- `video` — create a new video (default action; requires `--prompt`)
    - Options:
      - `--prompt <prompt>` (required)
      - `--duration <seconds>` (integer 1–16)
      - `--type <type>` (enum: `sora2|sora2-pro|veo3.1|veo3.1-pro|wan|vidu|vidu-pro|seedance|kling`; default `vidu`)
      - `--seed <seed>`
      - `--firstFrame <image>`
      - `--lastFrame <image>`
      - `--refs <assets>`
      - `--resolution <resolution>`
      - `--aspectRatio <ratio>`
      - `--withAudio`
      - `--optimizeCameraMotion`
      - `--output <file>`

### Examples

```bash
# Create an image (default action)
zerocut image --prompt "a cat" --model seedream --aspectRatio 1:1 --resolution 1K --refs ref1.png,ref2.jpg --output out.png

# Create video (default action)
zerocut video --prompt "city night drive" --duration 12 --type vidu --refs frame1.png,frame2.png --resolution 720p --output movie.mp4
```

## Dynamic External Commands

Set `ZEROCUT_COMMANDS_DIR` to a directory containing `.js` or `.cjs` files that export a `register(program: Command)` function. Zerocut auto-loads them at runtime.

```bash
export ZEROCUT_COMMANDS_DIR=/path/to/commands
zerocut help
```

## Development

- Build: `pnpm run build`
- Typecheck: `pnpm run typecheck`
- Lint: `pnpm run lint`
- Format: `pnpm run format`
- Dev (CLI entry): `pnpm run dev`

## License

MIT
