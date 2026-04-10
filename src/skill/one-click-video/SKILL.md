---
name: one-click-video
description: Use this skill when the user wants to produce a complete short video from a topic with fast CLI-driven workflow: scene planning, storyboard creation, scene video generation, optional background music, and final ffmpeg composition.
homepage: "https://github.com/liubei-ai/zerocut-cli"
source: "https://github.com/liubei-ai/zerocut-cli"
requires_binaries:
  - "zerocut-cli"
  - "npx"
---

# One-Click Video

## Purpose

Create a deliverable final video by orchestrating `zerocut-cli` commands only.

## Runtime Requirements

- Use CLI commands only, never MCP tool names.
- Ensure `zerocut-cli` is available:
  - `pnpm dlx zerocut-cli help`
  - `pnpm add -g zerocut-cli && zerocut-cli help`
  - `npx zerocut-cli help`

## Required Pre-Check

Run config check first:

```bash
npx zerocut-cli config list
```

If `apiKey` is missing, stop and request user OTT token:

```bash
npx zerocut-cli config --ott <token> --region <cn|us>
```

## Video Parameter Contract

When generating scene videos, only use legal `video` command parameters:

- `--prompt <prompt>` required
- `--duration <seconds>`
- `--model <model>`
- `--sourceVideo <video>`
- `--seed <seed>`
- `--firstFrame <image>`
- `--lastFrame <image>`
- `--storyboard <image>`
- `--persons <persons>` comma-separated image paths/URLs, mapped to `type=person`
- `--refs <assets>`
- `--resolution <resolution>`
- `--aspectRatio <ratio>`
- `--withAudio`
- `--withBGM <withBGM>` `true|false`, default `true`
- `--optimizeCameraMotion`
- `--output <file>`

## Output Naming Rules

- If user does not provide output path, generate meaningful names with 3-digit prefix:
  - `001_storyboard_scene1.png`
  - `002_scene1.mp4`
  - `003_scene2.mp4`
  - `004_bgm.mp3`
  - `005_final.mp4`

## Workflow

1. Understand topic, goal, duration, platform orientation, and style.
2. Split into 1-5 scenes with clear narrative progression.
3. Create one storyboard image for each scene.
4. Generate one video clip for each scene using only legal video parameters.
5. Optionally generate one background music track with `music` command.
6. Compose final video with `ffmpeg` command.

## Scene Storyboard Step

Generate storyboard for each scene:

```bash
npx zerocut-cli image --prompt "<scene storyboard prompt>" --model banana2 --aspectRatio 16:9 --resolution 1K --output 001_storyboard_scene1.png
```

## Scene Video Step

Use storyboard as `--storyboard`, optional character images via `--persons`, and optional extra references via `--refs`.

```bash
npx zerocut-cli video \
  --prompt "<scene video prompt>" \
  --model seedance-2.0 \
  --duration 12 \
  --resolution 720p \
  --aspectRatio 16:9 \
  --storyboard 001_storyboard_scene1.png \
  --persons actor_front.png,actor_side.png \
  --refs prop_ref.png,env_ref.png \
  --withAudio \
  --withBGM true \
  --output 002_scene1.mp4
```

## Background Music Step

Generate one BGM track when needed:

```bash
npx zerocut-cli music --prompt "<bgm prompt>" --output 004_bgm.mp3
```

## Final Composition Step (ffmpeg only)

Create concat list:

```bash
printf "file '002_scene1.mp4'\nfile '003_scene2.mp4'\n" > concat.txt
```

Concatenate scene clips:

```bash
npx zerocut-cli ffmpeg --args -f concat -safe 0 -i concat.txt -c copy 005_concat.mp4 --resources concat.txt 002_scene1.mp4 003_scene2.mp4
```

Mix BGM with original video audio:

```bash
npx zerocut-cli ffmpeg --args -i 005_concat.mp4 -i 004_bgm.mp3 -filter_complex "[1:a]volume=0.2[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac 005_final.mp4 --resources 005_concat.mp4 004_bgm.mp3
```

## Hard Rules

- Do not introduce non-CLI tool calls.
- Do not use parameters outside the legal `video` parameter contract.
- Keep single scene duration within model limits.
- Keep visual style consistent across all scenes.
- Keep role identity consistent when using `--persons`.
- Do not generate subtitles in this workflow.
