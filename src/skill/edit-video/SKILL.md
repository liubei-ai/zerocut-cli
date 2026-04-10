---
name: edit-video
description: Use this skill when the user wants to edit existing videos, replace visual elements, preserve camera language, or stitch multiple clips. Execute with zerocut-cli commands only.
homepage: "https://github.com/liubei-ai/zerocut-cli"
source: "https://github.com/liubei-ai/zerocut-cli"
requires_binaries:
  - "zerocut-cli"
  - "npx"
---

# Edit Video

## Runtime Requirements

- Use CLI commands only.
- Do not use MCP tool names in instructions.
- Ensure CLI is available:
  - `pnpm dlx zerocut-cli help`
  - `pnpm add -g zerocut-cli && zerocut-cli help`
  - `npx zerocut-cli help`

## Required Pre-Check

```bash
npx zerocut-cli config list
```

If `apiKey` is missing, stop and request OTT token:

```bash
npx zerocut-cli config --ott <token> --region <cn|us>
```

## Video Edit Defaults

- Default model is `seedance-2.0` unless user explicitly specifies another legal video model.
- Unless user explicitly specifies, keep original visual specs by not forcing `--aspectRatio` and `--resolution`.
- Keep user-requested camera language and motion intent.

## Legal Video Parameters

Only use legal `video` command options:

- `--prompt <prompt>` required
- `--duration <seconds>`
- `--model <model>`
- `--sourceVideo <video>`
- `--seed <seed>`
- `--firstFrame <image>`
- `--lastFrame <image>`
- `--storyboard <image>`
- `--persons <persons>`
- `--refs <assets>`
- `--resolution <resolution>`
- `--aspectRatio <ratio>`
- `--withAudio`
- `--withBGM <withBGM>`
- `--optimizeCameraMotion`
- `--output <file>`

## Replace Elements In Existing Video

When user asks to replace objects/subjects in an existing clip, pass source video and references to `video` command:

```bash
npx zerocut-cli video \
  --prompt "Replace the perfume gift-box product with the cream from reference image, keep original camera movement." \
  --model seedance-2.0 \
  --sourceVideo input.mp4 \
  --refs product_ref.png \
  --withAudio \
  --withBGM true \
  --output edited.mp4
```

## Character-Aware Editing

If user provides character photos, pass them with `--persons` so they map to `type=person`:

```bash
npx zerocut-cli video \
  --prompt "Keep scene pacing, replace actor with provided character while preserving performance rhythm." \
  --model seedance-2.0 \
  --sourceVideo input.mp4 \
  --persons actor_front.png,actor_side.png \
  --withAudio \
  --output edited_person.mp4
```

## Stitch Multiple Videos

Use ffmpeg command path for deterministic stitching.

Create concat list:

```bash
printf "file 'clip1.mp4'\nfile 'clip2.mp4'\nfile 'clip3.mp4'\n" > concat.txt
```

Concatenate:

```bash
npx zerocut-cli ffmpeg --args -f concat -safe 0 -i concat.txt -c copy merged.mp4 --resources concat.txt clip1.mp4 clip2.mp4 clip3.mp4
```

## Hard Rules

- Never use non-CLI tool calls in this skill.
- Do not use unsupported video parameters.
- Keep edits faithful to user instructions and preserve continuity.
- If a command returns `Not enough credits`, stop immediately and ask user to recharge before continuing.
