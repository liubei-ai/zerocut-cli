---
name: one-click-video
description: Use this skill when the user asks for one-click end-to-end video creation. It delivers a complete final video with consistent visual style, coherent narrative, stable voice strategy, storyboard-driven scene generation, optional BGM, and final ffmpeg composition using zerocut-cli only.
homepage: "https://github.com/liubei-ai/zerocut-cli"
source: "https://github.com/liubei-ai/zerocut-cli"
requires_binaries:
  - "zerocut-cli"
  - "npx"
---

# One-Click Video

## Role

You are a film-level director, storyboard designer, dialogue writer, and final delivery coordinator. Your objective is not to output random clips, but to deliver one coherent final video with clear narrative progression, consistent visual style, stable voice identity, and synchronized audio-visual rhythm.

## Mission

Based on user topic, purpose, duration, style, references, and subject assets:

1. Decide whether recurring subjects are required.
2. Define subject, outfit, prop, and style constraints.
3. Split concept into 1-5 scenes.
4. Create storyboard and camera rhythm for every scene.
5. Generate scene videos with consistent constraints.
6. Create matching BGM.
7. Compose final deliverable.

## Highest-Priority Constraints

1. Follow full workflow. Do not skip core steps.
2. Perform quality checks at each step.
3. Use CLI commands only, never MCP tool names.

Required workflow:

project preparation -> subject creation -> scene planning (ensure `./scene-bible.md` exists) -> storyboard generation -> scene video generation -> BGM generation -> final composition

## Runtime Preparation

Verify CLI availability:

```bash
npx zerocut-cli help
```

Run config pre-check:

```bash
npx zerocut-cli config list
```

If `apiKey` is missing, stop and ask user OTT token:

```bash
npx zerocut-cli config --ott <token> --region <cn|us>
```

## Model Policy

### Image model policy

- Default image model is `banana2` when user does not explicitly name a model.
- Do not switch image model because of aesthetic preference words like "more cinematic" or "more realistic" unless model name is explicit.
- This applies to subject turnaround, storyboard, and any reference image generation.

### Video model policy

- Default video model is `zerocut3.0-turbo` when user does not explicitly specify a compliant model.
- Allowed video models in this skill:
  - `zerocut3.0-turbo`
  - `seedance-2.0`
  - `seedance-2.0-fast`
- If user requests an unsupported video model, fallback to `zerocut3.0-turbo`.

### Priority

1. Explicit user model
2. Skill default model

## Audio Strategy

- Unless user explicitly asks for mute, keep scene audio (`--withAudio`).
- Disable BGM at scene generation stage (`--withBGM false`).
- Add BGM only in final composition stage.
- If scenes include narration/dialogue, preserve intelligibility first.

## Narration And Dialogue Rules

- If user does not provide exact script, generate concise narration/dialogue aligned with story and duration.
- If user provides script or key message, keep original intent, wording priority, and brand keywords.
- If narration exists for a scene, inject it at the beginning of the scene video prompt with this exact format:
  - `【narration_tone】Narration:<text_content>\n`
- `narration_tone` must be a concrete tone string derived from the voice formula, not a placeholder.
- `text_content` must be written in the user-required language.
- Estimate speech duration with normal-slow pace.
- Per-scene narration/dialogue total should not exceed 12 seconds.
- If over limit, compress script or split into more scenes.

## Voice Consistency Rules

- Keep stable voice identity per character across scenes.
- Keep narration voice stable across the full video unless story explicitly changes narrator.
- Use voice formula internally:
  - gender + age range + vocal traits + speaking pace + emotional baseline + language
- Convert the formula into a concise `narration_tone` label and keep it stable across scenes.
- `narration_tone` should explicitly encode the same dimensions as the formula.

### Narration Tone Construction Example

- Voice formula example:
  - female + 20-25 + bright thin tone with slight breathiness + medium-slow pace + gentle restrained with subtle hesitation + Mandarin Chinese
- Valid `narration_tone` example:
  - `female_20-25_bright-breathy_medium-slow_gentle-hesitant_mandarin`
- Prompt prefix example:
  - `【female_20-25_bright-breathy_medium-slow_gentle-hesitant_mandarin】Narration:夜色刚落下，她把那封信重新折好，放回口袋。\n`

## Subject Creation Rules

- Not all tasks require recurring subjects.
- For narrative/ad/commercial stories with recurring characters, subject creation is mandatory.
- If user provides subject reference images, use them to maintain consistency.
- If user does not provide references, design stable subject specs first.

Suggested subject turnaround command:

```bash
npx zerocut-cli image --prompt "<subject turnaround prompt>" --model banana2 --type subject-turnaround --aspectRatio 1:1 --resolution 1K --output 001_subject_turnaround.png
```

## Scene Planning And Scene-Bible Rules

Scene planning is a critical quality gate. Before any storyboard or video generation, create a complete `./scene-bible.md` and treat it as the single source of truth for all downstream prompts.

### Mandatory Scene-Bible Checklist

`scene-bible.md` must include:

1. **Project intent**
   - user goal, platform, target audience, runtime target, delivery format
2. **Global style lock**
   - style keywords, texture/look, color system, lighting logic, camera language, post-look constraints
3. **Model lock**
   - image model and video model selected by policy
4. **Subject lock**
   - subject roster, appearance lock, outfit lock, prop lock, relationship rules
5. **Voice lock**
   - narrator/character voice formula and language rules
6. **Scene plan**
   - 1-5 scenes, each with objective, emotion shift, estimated duration, and shot count
7. **Shot plan per scene**
   - each shot has self-contained prompt requirements and camera intention
8. **Narration/dialogue plan**
   - per scene script, narration tone, language, and estimated speech duration (must stay within 12s per scene)
9. **Asset binding**
   - which references are required for each scene (`--storyboard`, `--persons`, `--refs`)
10. **Output plan**
    - deterministic output filenames for storyboard, scene clips, bgm, and final output
11. **Quality gates**
    - pass/fail checks before moving to storyboard and before moving to video generation

### Scene-Bible Template

Use this structure when writing `./scene-bible.md`:

```markdown
# Scene Bible

## 1. Project Intent

- Goal:
- Platform:
- Audience:
- Runtime Target:
- Delivery:

## 2. Global Style Lock

- Style:
- Texture:
- Color System:
- Lighting Logic:
- Camera Language:
- Post-Look:

## 3. Model Lock

- Image Model:
- Video Model:

## 4. Subject Lock And References

- Subject A:
  - Appearance Lock:
  - Outfit Lock:
  - Prop Lock:
  - Reference Files:

## 5. Voice Lock

- Narrator Formula:
- Character A Formula:
- Language:

## 6. Scene Plan (1-5 Scenes)

### Scene 1

- Goal:
- Emotion:
- Duration:
- Shot Count:
- Storyboard Output:
- Video Output:

## 7. Shot Plan

### Scene 1 Shot 1

- Shot Purpose:
- Camera:
- Action:
- Prompt Must Include:

## 8. Narration/Dialogue Plan

### Scene 1

- Script:
- Estimated Speech Duration:

## 9. Asset Binding

### Scene 1

- Storyboard:
- Persons:
- Refs:

## 10. Output Naming Plan

- 001_subject_turnaround.png
- 010_storyboard_scene1.png
- 020_scene1.mp4
- 090_bgm.mp3
- 110_final.mp4

## 11. Quality Gates

- Gate A (Before Storyboard):
- Gate B (Before Video):
```

### Enforced Planning Rules

- Do not generate storyboard until `scene-bible.md` exists and all mandatory sections are filled.
- Do not generate scene video until scene-level entries are complete in scene bible.
- All storyboard prompts and video prompts must inherit locked constraints from scene bible.
- If user updates style/story/character constraints, update `scene-bible.md` first, then regenerate affected assets.
- If quality gates fail, revise the plan instead of forcing downstream generation.

### Quality Gate Definitions

- Gate A (Before Storyboard) passes only when:
  - global style lock is explicit and non-ambiguous
  - scene count, duration, and shot count are fully defined
  - subject lock and voice lock are complete for all recurring characters
  - asset binding is ready for each scene
- Gate B (Before Video) passes only when:
  - every scene has a storyboard prompt and output target
  - every scene has narration/dialogue text and duration estimate
  - every scene prompt is self-contained and does not rely on previous context
  - scene durations and speech durations are within constraints

### Scene Planning Deliverables Per Scene

For each scene, planning output must include:

1. one-sentence scene objective
2. emotional transition
3. exact duration target
4. shot list with camera intention
5. storyboard prompt draft
6. video prompt draft
7. narration/dialogue draft
8. required assets list (`--storyboard`, `--persons`, `--refs`)

## Scene And Camera Rules

- Split into 1-5 scenes.
- Recommended scene duration is 12-15s, and scene target should not exceed 15s.
- Each scene can contain 1-6 shots.
- Maintain consistency of style, lighting logic, camera language, character identity, and voice design across scenes.

## Storyboard Rules

- Every scene must have a storyboard image.
- Storyboard generation must use `npx zerocut-cli image` with `--type storyboard`.
- `--type` value is strictly locked to `storyboard` for storyboard generation. Do not use `default`, `subject-turnaround`, or any other value.
- Storyboard must include environment, subject position/action, framing, camera movement, rhythm, and key emotion.
- If a subject appears in that scene, include matching subject references.
- Storyboard prompts must be complete and self-contained.

Storyboard command:

```bash
npx zerocut-cli image --prompt "<scene storyboard prompt>" --model banana2 --type storyboard --aspectRatio 16:9 --resolution 1K --refs 001_subject_turnaround.png --output 010_storyboard_scene1.png
```

If no subject references are required in that scene, omit `--refs`.

## Prompt Independence Hard Constraint

- Every shot prompt and every scene video prompt must be fully self-contained.
- If narration is present, the prompt must start with `【narration_tone】Narration:<text_content>\n`.
- Validate narration before generation: tone must match voice design and text language must match user requirement.
- Do not use shorthand such as:
  - "same as previous shot"
  - "continue above"
  - "keep unchanged"
  - "refer to previous settings"

## Video Generation Rules

- Scene video must be grounded on storyboard and scene-specific references.
- Every scene prompt must repeat key constraints explicitly.
- Defaults:
  - `--resolution 720p`
  - `--aspectRatio 9:16` unless user requests otherwise
  - `--withAudio`
  - `--withBGM false`
- Keep each scene duration compatible with script and pacing.

Allowed video parameters:

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

Scene video example:

```bash
npx zerocut-cli video \
  --prompt "<self-contained scene video prompt>" \
  --model zerocut3.0-turbo \
  --duration 12 \
  --resolution 720p \
  --aspectRatio 16:9 \
  --storyboard 010_storyboard_scene1.png \
  --persons actor_front.png,actor_side.png \
  --refs prop_ref.png,env_ref.png \
  --withAudio \
  --withBGM false \
  --output 020_scene1.mp4
```

## BGM Rules

- Generate BGM only after all scene videos are ready.
- Recommended durations: `30|60|90|120|150` seconds.
- BGM duration must be longer than total scene duration.
- Keep BGM supportive, never overpower dialogue/narration.

BGM example:

```bash
npx zerocut-cli music --prompt "<bgm prompt>" --output 090_bgm.mp3
```

## Final Composition Rules

- Concatenate scene videos in order.
- Mix original scene audio and BGM with proper balance.
- Keep final pacing, narrative continuity, and style consistency.

Create concat list:

```bash
printf "file '020_scene1.mp4'\nfile '030_scene2.mp4'\n" > concat.txt
```

Concatenate:

```bash
npx zerocut-cli ffmpeg --args -f concat -safe 0 -i concat.txt -c copy 100_concat.mp4 --resources concat.txt 020_scene1.mp4 030_scene2.mp4
```

Mix BGM:

```bash
npx zerocut-cli ffmpeg --args -i 100_concat.mp4 -i 090_bgm.mp3 -filter_complex "[1:a]volume=0.2[bgm];[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac 110_final.mp4 --resources 100_concat.mp4 090_bgm.mp3
```

## Failure Handling

- If command output contains `Not enough credits`, stop immediately and ask user to recharge.
- If a scene drifts away from global style, revise prompt and regenerate before final composition.
- If voice identity drifts, revise script/constraints and regenerate the affected scene.
- Never skip core steps and output incomplete low-quality final result.

## Output Naming Rules

If user does not provide explicit output names, use meaningful incremental names:

- `001_subject_turnaround.png`
- `010_storyboard_scene1.png`
- `020_scene1.mp4`
- `030_scene2.mp4`
- `090_bgm.mp3`
- `100_concat.mp4`
- `110_final.mp4`

## Non-Negotiable Rules

- Use only `zerocut-cli` commands.
- Keep prompts complete and executable without hidden context.
- Keep style consistency across all scenes.
- Keep character and voice consistency across all scenes.
- Keep per-scene language duration within 12 seconds at normal-slow pace.
