## MODIFIED Requirements

### Requirement: Fallback from visuals to scenes in generate-scene-images
The `generate-scene-images` endpoint SHALL automatically convert `visuals` array to `scenes` array when `scenes` is empty or missing in `article_content`, before proceeding with image generation. Each `visuals` entry MAY be a plain string (legacy format) or an object `{visual, motion}` (current format for video content) — the endpoint SHALL parse both. New scenes created by this conversion SHALL always be initialized with `image_gen_status: "none"`.

#### Scenario: No scenes but visuals exist (legacy string format)
- **WHEN** `article_content` has `visuals: ["Scene 1: description", "Scene 2: description"]` (plain strings) but no `scenes` array
- **THEN** the endpoint SHALL convert each visual to `{ visual_prompt, shot, image_gen_status: "none" }` by parsing `Scene N:` or `Shot N:` prefixes
- **AND** `video_prompt` SHALL be left empty since legacy visuals carry no motion data
- **AND** proceed with image generation using each scene's `visual_prompt`

#### Scenario: No scenes but visuals exist (object format with motion)
- **WHEN** `article_content` has `visuals: [{"visual": "Scene 1: description", "motion": "camera zooms in slowly"}, ...]` but no `scenes` array
- **THEN** the endpoint SHALL convert each visual to `{ visual_prompt, video_prompt, shot, image_gen_status: "none" }` extracting `visual_prompt` from `visual` and `video_prompt` from `motion`

#### Scenario: Both scenes and visuals exist
- **WHEN** `article_content` already has a non-empty `scenes` array
- **THEN** the endpoint SHALL use the existing `scenes` directly without fallback (existing `image_gen_status` values, if any, SHALL NOT be overwritten)

#### Scenario: Neither scenes nor visuals exist
- **WHEN** `article_content` has no `scenes` and no `visuals`
- **THEN** the endpoint SHALL return error "ไม่มี scenes หรือ visuals ใน article_content — กรุณาสร้างสคริปต์ก่อน"

#### Scenario: Visuals with mixed format entries
- **WHEN** some `visuals` entries match `Scene N:` pattern and others are plain text without prefix
- **THEN** entries matching the pattern SHALL have their prefix extracted as `shot` and remaining text as `visual_prompt`
- **AND** plain text entries SHALL use the full text as `visual_prompt` with empty `shot`

### Requirement: Fallback from visuals to scenes in generate-video
The `generate-video` endpoint SHALL apply the same visuals-to-scenes fallback as `generate-scene-images` (including object-shape parsing and the `image_gen_status: "none"` default for new scenes) before checking for scenes with image URLs.

#### Scenario: No scenes but visuals with image URLs present
- **WHEN** `article_content` has `visuals` but no `scenes`, and some visuals reference existing images via `image_url`
- **THEN** the endpoint SHALL convert visuals to scenes (with `image_gen_status: "none"` on the newly created entries), then filter for scenes with `image_url` before video generation

#### Scenario: Scenes exist with image URLs
- **WHEN** `article_content` already has `scenes` with at least one `image_url`
- **THEN** the endpoint SHALL use existing scenes directly without fallback

## ADDED Requirements

### Requirement: `generate-scene-images` persists per-scene image generation status
`generate-scene-images` SHALL write `image_gen_status` (`"done"` or `"failed"`) back into each scene object in `article_content.scenes[]` after attempting image generation for it — not only the top-level `content_items.image_gen_status` column.

#### Scenario: Scene succeeds
- **WHEN** image generation for scene index 0 succeeds
- **THEN** `scenes[0].image_gen_status` SHALL be `"done"` and `scenes[0].image_url` SHALL be the generated URL, persisted to `article_content`

#### Scenario: Scene fails
- **WHEN** image generation for scene index 1 fails
- **THEN** `scenes[1].image_gen_status` SHALL be `"failed"`, persisted to `article_content` (see `video-scene-motion-prompt` capability for `image_gen_error` persistence)

### Requirement: Backward-compatible derivation of `image_gen_status` for legacy scenes
When reading a scene that has no `image_gen_status` key at all (content generated before this capability existed), the system SHALL derive the status instead of treating it as unset: a non-empty `image_url` SHALL derive to `"done"`; an empty or missing `image_url` SHALL derive to `"none"`. This derivation SHALL happen at read time — existing `article_content` rows in the database SHALL NOT be rewritten by a migration.

#### Scenario: Legacy scene with an existing image
- **WHEN** a scene has `image_url: "https://.../scene1.jpg"` and no `image_gen_status` key
- **THEN** the system SHALL treat that scene's status as `"done"` wherever `image_gen_status` is read

#### Scenario: Legacy scene without an image
- **WHEN** a scene has no `image_url` and no `image_gen_status` key
- **THEN** the system SHALL treat that scene's status as `"none"` wherever `image_gen_status` is read
