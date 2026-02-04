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

Note: Image commands are implemented. Audio and video commands are planned and will be added next.

## Requirements

- Node.js >= 18
- pnpm (package manager)

## Installation

### From Registry (recommended)

```bash
# pnpm global install (preferred)
pnpm add -g zerocut-cli

# npm global install (alternative)
npm i -g zerocut-cli

# Run directly without installing
npx -y zerocut-cli help
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
- On filesystem permission errors while writing to the home directory, the project may fall back to `./.zerocut/config.json`.

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
- `image` — image commands (parent)
  - `create` — create a new image; requires `--prompt`
    - Options:
      - `--prompt <prompt>` (required)
      - `--type <type>` (seedream|seedream-pro|banana|banana-pro|wan)
      - `--size <size>` (e.g., 512x512)
      - `--refs <img1,img2,...>` (comma-separated paths/URLs)
      - `--output <file>` (output file path)
  - `edit` — edit an existing image by applying modifications
  - Notes:
    - During image generation, CLI displays a lightweight spinner-based progress indicator to show that inference is running.
- `audio` — audio commands (parent) — planned
  - `create` — synthesize or compose audio from text or references — planned
  - `edit` — trim, mix, or apply effects to existing audio — planned
- `video` — video commands (parent) — planned
  - `create` — generate video from prompt and references — planned
  - `edit` — cut, merge, and apply effects — planned

### Examples

```bash
# Create an image
zerocut image create --prompt "a cat" --type seedream --size 512x512 --refs ref1.png,ref2.jpg --output out.png

# Edit an image (placeholder)
zerocut image edit

# Planned examples (coming soon)
# Create audio
zerocut audio create --prompt "ambient music" --length 30s --output track.wav

# Edit audio
zerocut audio edit --input track.wav --trim 00:00-00:30 --output trimmed.wav

# Create video
zerocut video create --prompt "a sunrise timelapse" --refs frame1.png,frame2.png --output movie.mp4

# Edit video
zerocut video edit --input movie.mp4 --cut 00:00-00:10 --merge intro.mp4 --output final.mp4
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
