![status: WIP](https://img.shields.io/badge/status-WIP-orange)

# ZeroCut CLI

ZeroCut CLI is a modular, extensible command-line toolkit that lets an AI assistant create and edit media across images, audio, and video. It is built with Node.js (TypeScript), uses CommonJS output, and follows a one-command-per-file architecture.

## Features

- Media creation and editing for images, audio, and video
- Modular commands (one file per command under `src/commands/*`)
- Dynamic external command loading via `ZEROCUT_COMMANDS_DIR` (.js/.cjs files)
- Configuration interceptor that validates required keys (`apiKey`, `projectDir`)
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
zerocut config apiKey <key>         # Get an API key at https://workspace.zerocut.cn/
zerocut config projectDir <dir>     # Will be created if missing
```

If configuration is missing, Zerocut prints:

```
Missing required configuration: apiKey, projectDir
Configure using:
  zerocut config apiKey <key>
  zerocut config projectDir <dir>
```

## Configuration

- Config file primary path: `~/.zerocut/config.json`
- Keys:
  - `apiKey`: string
  - `projectDir`: absolute directory path
  - `region`: environment region, one of `us` or `cn` (default: `us`)
- Key-path API (internal): `getConfigValueSync('a.b')`, `setConfigValueSync('a.b.c','value')`


### Interactive configuration

Both config subcommands accept optional arguments and will prompt if omitted:

```bash
zerocut config apiKey                 # prompts: Enter API key (get one at workspace.zerocut.cn)
zerocut config projectDir             # prompts: Enter project directory [~/zerocut-projects/default]
zerocut config region [region]        # set region (us|cn); default us
zerocut config list                   # print masked configuration
```

## Commands

- `help` — show available commands
- `config` — configuration management (parent)
  - `apiKey [key]` — set API key (prompts if omitted)
  - `projectDir [dir]` — set project directory (prompts if omitted; creates directory if missing)
  - `region [region]` — set region (`us|cn`; default `us`)
  - `list` — print masked configuration
- `image` — image commands (parent)
  - `create` — create a new image; requires `--prompt`
    - Options:
      - `--prompt <prompt>` (required)
      - `--type <type>` (seedream|seedream-pro|banana|banana-pro|wan)
      - `--size <size>` (e.g., 512x512)
      - `--refs <img1,img2,...>` (comma-separated paths/URLs)
      - `--output <file>` (output file path)
  - `edit` — edit an existing image by applying modifications
    - Options:
      - `--source <source>` (required; inserted to refs list head)
      - `--prompt <prompt>` (required)
      - `--type <type>` (same enum as create)
      - `--size <size>`
      - `--refs <img1,img2,...>`
      - `--output <file>`
  - Notes:
    - During image generation, CLI displays a lightweight spinner-based progress indicator to show that inference is running.
- `audio` — audio commands (parent) — planned
  - `create` — synthesize or compose audio from text or references — planned
  - `edit` — trim, mix, or apply effects to existing audio — planned
- `video` — video commands (parent)
  - `create` — generate video from prompt and references (placeholder implementation)
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
  - `edit` — apply modifications to an existing video (placeholder implementation)
    - Options:
      - `--source <source>` (required)
      - `--prompt <prompt>` (required)
      - `--type <type>` (enum: `edit|lipsync|extend|upscale`)
      - `--duration <seconds>` (integer 1–16)
      - `--resolution <resolution>` (enum: `720p|1080p|2K|4K`)
      - `--refs <assets>`
      - `--output <file>`

### Examples

```bash
# Create an image
zerocut image create --prompt "a cat" --type seedream --size 512x512 --refs ref1.png,ref2.jpg --output out.png

# Edit an image
zerocut image edit --source base.png --prompt "make it vintage" --type banana-pro --refs mask.png --output edited.png

# Create video
zerocut video create --prompt "city night drive" --duration 12 --type vidu --refs frame1.png,frame2.png --resolution 720p --output movie.mp4

# Edit video
zerocut video edit --source movie.mp4 --prompt "brighten" --type edit --duration 8 --resolution 1080p --refs mask.png --output final.mp4
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
