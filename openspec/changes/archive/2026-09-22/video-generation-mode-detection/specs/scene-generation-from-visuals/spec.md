## MODIFIED Requirements

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
