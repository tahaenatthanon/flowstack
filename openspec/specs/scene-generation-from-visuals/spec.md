# scene-generation-from-visuals

### Requirement: Fallback from visuals to scenes in generate-scene-images
The `generate-scene-images` endpoint SHALL automatically convert `visuals` array to `scenes` array when `scenes` is empty or missing in `article_content`, before proceeding with image generation.

#### Scenario: No scenes but visuals exist
- **WHEN** `article_content` has `visuals: ["Scene 1: description", "Scene 2: description"]` but no `scenes` array
- **THEN** the endpoint SHALL convert each visual to `{ visual_prompt, shot }` by parsing `Scene N:` or `Shot N:` prefixes
- **AND** proceed with image generation using each scene's `visual_prompt`

#### Scenario: Both scenes and visuals exist
- **WHEN** `article_content` already has a non-empty `scenes` array
- **THEN** the endpoint SHALL use the existing `scenes` directly without fallback

#### Scenario: Neither scenes nor visuals exist
- **WHEN** `article_content` has no `scenes` and no `visuals`
- **THEN** the endpoint SHALL return error "ไม่มี scenes หรือ visuals ใน article_content — กรุณาสร้างสคริปต์ก่อน"

#### Scenario: Visuals with mixed format entries
- **WHEN** some `visuals` entries match `Scene N:` pattern and others are plain text without prefix
- **THEN** entries matching the pattern SHALL have their prefix extracted as `shot` and remaining text as `visual_prompt`
- **AND** plain text entries SHALL use the full text as `visual_prompt` with empty `shot`

### Requirement: Fallback from visuals to scenes in generate-video
The `generate-video` endpoint SHALL apply the same visuals-to-scenes fallback as `generate-scene-images` before checking for scenes with image URLs.

#### Scenario: No scenes but visuals with image URLs present
- **WHEN** `article_content` has `visuals` but no `scenes`, and some visuals reference existing images via `image_url`
- **THEN** the endpoint SHALL convert visuals to scenes, then filter for scenes with `image_url` before video generation

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

### Requirement: Video generation disabled until all scenes have images
"สร้างวิดีโอด้วย AI" button SHALL be disabled until every scene in the content has an `image_url` (AI-generated image).

#### Scenario: All scenes have images
- **WHEN** all scenes in `article_content.scenes` have a non-empty `image_url`
- **THEN** the "สร้างวิดีโอด้วย AI" button SHALL be enabled

#### Scenario: Some scenes missing images
- **WHEN** at least one scene lacks `image_url` or no scenes exist
- **THEN** the "สร้างวิดีโอด้วย AI" button SHALL be disabled
- **AND** the description SHALL show "ต้องกดสร้างภาพทุกฉากก่อน"
