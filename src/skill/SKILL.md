---
name: "zerocut-cli-tools"
description: "Use ZeroCut CLI media and document tools. Invoke when user needs generate media, run ffmpeg/pandoc, sync resources, or save outputs."
homepage: "https://github.com/liubei-ai/zerocut-cli"
source: "https://github.com/liubei-ai/zerocut-cli"
requires_binaries:
  - "zerocut-cli"
  - "npx"
---

# ZeroCut CLI Tools

## Purpose

This skill provides a single reference for using ZeroCut CLI commands:

- image generation
- video generation
- music generation
- text-to-speech
- ffmpeg sandbox execution
- pandoc sandbox execution

## When To Invoke

Invoke this skill when the user asks to:

- generate image, video, music, or speech audio
- run ffmpeg or ffprobe command in sandbox
- run pandoc conversion in sandbox
- sync local/remote resources into sandbox
- save generated results to local output files

## Runtime Requirements

- Runtime expects `zerocut-cli` to be available in current environment.
- If `zerocut-cli` is unavailable, use one of:
  - `pnpm dlx zerocut-cli help`
  - `pnpm add -g zerocut-cli && zerocut-cli help`
  - `npx zerocut-cli help`
- This skill is instruction-only and relies on the installed CLI binary for actual enforcement.

## Safety Boundaries

- Only sync files or URLs that user explicitly requests for the current task.
- Never auto-discover, crawl, or fetch unrelated remote URLs.
- Treat remote resources as untrusted input and pass through CLI validation.
- Never sync secrets, key files, token files, or unrelated private directories.
- Keep all output writes in user-requested path or current working directory naming rules.
- Do not bypass CLI command guards; ffmpeg/pandoc restrictions are enforced by the CLI implementation.

## Credentials And Data Transfer

- Required credential is `apiKey` in local ZeroCut config.
- If `apiKey` is missing, stop immediately and request OTT token exchange.
- `TOS` in this document means object storage used by ZeroCut backend for media URLs.
- No extra credential beyond ZeroCut config is required for normal media sync/download flows.
- Do not send data to any external service other than endpoints used by configured ZeroCut session.

## Required Pre-Check

Before every task, the agent must check configuration first:

```bash
npx zerocut-cli config list
```

If `apiKey` is missing or empty, the agent must immediately stop task execution and request an OTT token from the user. Do not continue any generation, conversion, or sandbox command until configuration is completed.

Required user action:

```bash
npx zerocut-cli config --ott <token> --region <cn|us>
```

Notes:

- `region` must be `cn` or `us`
- OTT exchange writes `apiKey` and `region` into config
- when running `config key` without direct key, region must be `cn|us` and OTT is required

## Command Reference

### image

Default action: `create`

```bash
npx zerocut-cli image --prompt "a cat on a bike" --output out.png
npx zerocut-cli image create --prompt "a cat on a bike" --model seedream-5l --aspectRatio 1:1 --resolution 1K --refs ref1.png,ref2.jpg --output out.png
```

Options:

- `--prompt <prompt>` required
- `--model <model>`
- `--aspectRatio <ratio>`
- `--resolution <resolution>`
- `--refs <refs>` comma-separated local paths or URLs
- `--output <file>` save generated file

Validation rules:

- `--prompt` must be non-empty
- `--model` allowed: `seedream|seedream-pro|seedream-5l|banana|banana2|banana-pro|wan`
- `--aspectRatio` allowed: `1:1|3:4|4:3|16:9|9:16|2:3|3:2|21:9|1:4|4:1|1:8|8:1`
- unless user specifies aspect ratio, default to `16:9`
- `--resolution` allowed: `1K|2K|4K`
- unless user specifies resolution, default to `1K`

### video

Default action: `create`

```bash
npx zerocut-cli video --prompt "city night drive" --model vidu --duration 8 --output out.mp4
npx zerocut-cli video create --prompt "city night drive" --model vidu --aspectRatio 1:1 --refs ref1.png,ref2.png --output out.mp4
npx zerocut-cli video --prompt "remix this clip" --model vidu --sourceVideo input.mp4 --duration 6 --output edited.mp4
```

Options:

- `--prompt <prompt>` required
- `--model <model>`
- `--duration <seconds>` model-dependent integer
- `--sourceVideo <video>` base video for edit mode
- `--seed <seed>`
- `--firstFrame <image>`
- `--lastFrame <image>`
- `--refs <assets>`
- `--resolution <resolution>`
- `--aspectRatio <ratio>`
- `--withAudio`
- `--optimizeCameraMotion`
- `--output <file>`

Validation rules:

- `--prompt` must be non-empty
- `--model` allowed: `zerocut3.0|seedance-1.5-pro|vidu|vidu-pro|viduq3|viduq3-turbo|kling|kling-v3|wan|wan-flash|sora2|sora2-pro|veo3.1|veo3.1-pro|zerocut-avatar-1.0|zerocut-avatar-1.5|zerocut-mv-1.0`
- `--duration` must follow model range:
  - default models: `1-16`
  - `zerocut-avatar-1.0` / `zerocut-avatar-1.5`: `5-240`
  - `zerocut-mv-1.0`: `1-240`
- `--aspectRatio` allowed: `9:16|16:9|1:1`
- unless user specifies aspect ratio, default to `16:9`
- unless user specifies resolution, default to `720p`

Long video guidance:

- for default models, if required duration is over 16s, split into multiple generations (each 1-16s)
- then concatenate clips with ffmpeg
- example:

```bash
printf "file 'part1.mp4'\nfile 'part2.mp4'\nfile 'part3.mp4'\n" > concat.txt
npx zerocut-cli ffmpeg --args -f concat -safe 0 -i concat.txt -c copy final.mp4 --resources concat.txt part1.mp4 part2.mp4 part3.mp4
```

### music

Default action: `create`

```bash
npx zerocut-cli music --prompt "lofi beat" --output music.mp3
npx zerocut-cli music create --prompt "lofi beat" --output music.mp3
```

Options:

- `--prompt <prompt>` required
- `--output <file>`

Validation rules:

- `--prompt` must be non-empty

### tts

Default action: `create`

```bash
npx zerocut-cli tts --text "你好，欢迎使用 ZeroCut" --voiceId voice_xxx --output speech.mp3
npx zerocut-cli tts create --prompt "calm tone" --text "Hello world" --voiceId voice_xxx --output speech.mp3
```

Options:

- `--prompt <prompt>`
- `--text <text>` required
- `--voiceId <voiceId>`
- `--output <file>`

Validation rules:

- `--text` must be non-empty

### ffmpeg

```bash
npx zerocut-cli ffmpeg --args -i input.mp4 -vn output.mp3 --resources input.mp4
npx zerocut-cli ffmpeg --args -i input.mp4 -vf scale=1280:720 output.mp4 --resources input.mp4
```

Options:

- `--args <args...>` required, arguments appended after `ffmpeg`
- `--resources <resources...>` optional, files/URLs to sync into sandbox materials

Behavior:

- `--args` must be provided
- command prefix is fixed as `ffmpeg`
- for `ffmpeg`, `-y` is auto-injected when absent
- output file is auto-downloaded from sandbox to local current directory

### pandoc

```bash
npx zerocut-cli pandoc --args input.md -o output.pdf --resources input.md
npx zerocut-cli pandoc --args input.md --output=output.docx --resources input.md template.docx
```

Options:

- `--args <args...>` required, arguments appended after `pandoc`
- `--resources <resources...>` optional, files/URLs to sync into sandbox materials

Behavior:

- `--args` must be provided
- command prefix is fixed as `pandoc`
- output file is auto-downloaded only when args include `-o`, `--output`, or `--output=...`

## Output And Sync Rules

- Media URLs from generation are synced to TOS when available.
- `--output` saves files to an absolute path resolved from current working directory.
- Missing parent directories for `--output` are created automatically.
- File type constraints:
  - image output uses `.png`
  - video output uses `.mp4`
  - audio output (`music`/`tts`) uses `.mp3`
- If user does not explicitly provide output file name, agent must generate one in current directory:
  - use 3-digit incremental prefix to avoid collisions, like `001_...`, `002_...`
  - keep file name meaningful by task content, e.g. `001_city-night-drive.mp4`, `002_lofi-beat.mp3`
- ffmpeg and pandoc outputs follow the same naming rule:
  - if output path is not explicitly specified by user, agent should generate a meaningful file name with `NNN_` prefix and correct extension
  - for pandoc, keep extension aligned with conversion target format
