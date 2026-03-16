![status: WIP](https://img.shields.io/badge/status-WIP-orange)

# ZeroCut CLI

ZeroCut CLI is a modular, extensible command-line toolkit for media generation and sandbox tool execution. It is built with Node.js (TypeScript), uses CommonJS output, and follows a one-command-per-file architecture.

## Features

- Media generation for image/video/music/tts
- Sandbox tool execution for ffmpeg and pandoc
- Modular commands (one file per command under `src/commands/*`)
- Dynamic external command loading via `ZEROCUT_COMMANDS_DIR` (.js/.cjs files)
- Configuration interceptor that validates required keys (`apiKey`)
- Session lifecycle management using Cerevox (open on preAction, close on postAction)
- Built-in `skill` command to print tool usage spec
- Strict TypeScript, ESLint + Prettier, pnpm-based project

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

# Run directly with npx
npx zerocut-cli help
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
npx zerocut-cli help
```

- Configure required settings:

```bash
npx zerocut-cli config key <key>            # Or use OTT exchange below
# quick OTT exchange:
npx zerocut-cli config --ott <token> --region <cn|us>
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
- `skill` — print built-in `SKILL.md` content
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
- `video` — create a new video (default action; requires `--prompt`)
  - Options:
    - `--prompt <prompt>` (required)
    - `--duration <seconds>` (integer 1–16; when `--sourceVideo` is set, must be 3–10)
    - `--model <model>` (enum: `zerocut3.0|seedance-1.5-pro|vidu|vidu-pro|viduq3|viduq3-turbo|kling|kling-v3|wan|wan-flash|sora2|sora2-pro|veo3.1|veo3.1-pro`; default `vidu`)
    - `--sourceVideo <video>` (base video path/url for edit mode)
    - `--seed <seed>`
    - `--firstFrame <image>`
    - `--lastFrame <image>`
    - `--refs <assets>`
    - `--resolution <resolution>`
    - `--aspectRatio <ratio>` (9:16|16:9|1:1)
    - `--withAudio`
    - `--optimizeCameraMotion`
    - `--output <file>`
  - Notes:
    - long videos over 16 seconds should be split into multiple clips (each 1–16s)
    - merge split clips using `ffmpeg` command
- `music` — create music (default action; requires `--prompt`)
  - Options:
    - `--prompt <prompt>` (required)
    - `--output <file>`
- `tts` — text to speech (default action; requires `--text`)
  - Options:
    - `--prompt <prompt>`
    - `--text <text>` (required)
    - `--voiceId <voiceId>`
    - `--output <file>`
- `ffmpeg` — run ffmpeg in sandbox
  - Options:
    - `--args <args...>` (required)
    - `--resources <resources...>` (optional)
  - Notes:
    - only `ffmpeg`/`ffprobe` commands are allowed
    - `ffmpeg` auto-injects `-y` when missing
    - output file is auto-downloaded to current directory
- `pandoc` — run pandoc in sandbox
  - Options:
    - `--args <args...>` (required)
    - `--resources <resources...>` (optional)
  - Notes:
    - only `pandoc` command is allowed
    - output file must be specified with `-o` / `--output` / `--output=...`
    - output file is auto-downloaded to current directory

### Examples

```bash
# Create an image (default action)
npx zerocut-cli image --prompt "a cat" --model seedream --aspectRatio 1:1 --resolution 1K --refs ref1.png,ref2.jpg --output out.png

# Create video (default action)
npx zerocut-cli video --prompt "city night drive" --duration 12 --model vidu --refs frame1.png,frame2.png --resolution 720p --output movie.mp4

# Edit from source video (duration must be 3-10 when sourceVideo is set)
npx zerocut-cli video --prompt "remix this clip" --model vidu --sourceVideo input.mp4 --duration 6 --output edited.mp4

# Split long video需求并拼接
printf "file 'part1.mp4'\nfile 'part2.mp4'\nfile 'part3.mp4'\n" > concat.txt
npx zerocut-cli ffmpeg --args -f concat -safe 0 -i concat.txt -c copy final.mp4 --resources concat.txt part1.mp4 part2.mp4 part3.mp4

# Create speech audio (default action)
npx zerocut-cli tts --text "你好，欢迎使用 ZeroCut" --voiceId voice_xxx --output speech.mp3

# Create music (default action)
npx zerocut-cli music --prompt "lofi beat" --output music.mp3

# Run ffmpeg in sandbox
npx zerocut-cli ffmpeg --args -i input.mp4 -vn output.mp3 --resources input.mp4

# Run pandoc in sandbox
npx zerocut-cli pandoc --args input.md -o output.pdf --resources input.md

# Print built-in skill spec
npx zerocut-cli skill
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
