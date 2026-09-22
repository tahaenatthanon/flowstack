# scene-generation-from-visuals

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

### Requirement: Generate scene images button in ContentCardDialog
The `ContentCardDialog` component SHALL include a "สร้างภาพทุกฉาก" button that triggers `generate-scene-images` for the current content item.

#### Scenario: Button visible and enabled
- **WHEN** a content item exists with `article_content` containing either `scenes` or `visuals`
- **THEN** the "สร้างภาพทุกฉาก" button SHALL be visible and enabled in the Video section

#### Scenario: Button shows loading state
- **WHEN** the user clicks "สร้างภาพทุกฉาก"
- **THEN** the button SHALL show a loading spinner with text "กำลังสร้างภาพทุกฉาก..."
- **AND** the button SHALL be disabled during generation

#### Scenario: Successful scene generation
- **WHEN** `generate-scene-images` completes successfully
- **THEN** a success toast SHALL appear with "สร้างภาพทุกฉากสำเร็จ!"
- **AND** content items and plans queries SHALL be invalidated to refresh the UI

### Requirement: Video section visible only for video script content
In `ContentCardDialog`, the Video Section (including "สร้างภาพทุกฉาก" and "สร้างวิดีโอด้วย AI" buttons) SHALL only be rendered when the content type is video script. Detection SHALL check `article_content.platform_type` first, then fall back to `content_items.type` from the DB.

#### Scenario: Video script content via article_content.platform_type
- **WHEN** a content item has `article_content.platform_type === 'video'`
- **THEN** the Video Section SHALL be visible with both "สร้างภาพทุกฉาก" and "สร้างวิดีโอด้วย AI" buttons

#### Scenario: Video script content via content_items.type fallback
- **WHEN** `article_content` has no `platform_type` field but `content_items.type === 'video'` (as set by `generate-article` for tiktok/youtube platforms)
- **THEN** the `isVideo` flag SHALL evaluate to `true` using `existingItem?.content_type` as fallback
- **AND** the Video Section SHALL be visible

#### Scenario: Article or social content
- **WHEN** a content item has `platform_type === 'article'` or `platform_type === 'social'` or no platform_type specified
- **THEN** the Video Section SHALL NOT be rendered
- **AND** only the image generation and caption fields SHALL be shown

### Requirement: Video generation disabled until first scene has a video_prompt
"สร้างวิดีโอด้วย AI" button SHALL be disabled until `scenes[0].video_prompt` is non-empty — SHALL NOT require every scene to have an `image_url` (removed — the system only ever uses the first scene, see `video-generation-provider-contract`)

#### Scenario: First scene has a video_prompt
- **WHEN** `article_content.scenes[0].video_prompt` is non-empty (regardless of whether scene 0 has an `image_url` or its `image_gen_status`)
- **THEN** the "สร้างวิดีโอด้วย AI" button SHALL be enabled

#### Scenario: First scene missing video_prompt
- **WHEN** `article_content.scenes[0].video_prompt` is empty or no scenes exist
- **THEN** the "สร้างวิดีโอด้วย AI" button SHALL be disabled
- **AND** the description SHALL guide the user to write or AI-generate a Video Prompt for the first scene first

#### Scenario: Other scenes lack images — no longer blocks video generation
- **WHEN** `article_content.scenes[0]` has a `video_prompt` but scenes at other indexes lack `image_url`
- **THEN** the "สร้างวิดีโอด้วย AI" button SHALL still be enabled (only the first scene matters)

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
