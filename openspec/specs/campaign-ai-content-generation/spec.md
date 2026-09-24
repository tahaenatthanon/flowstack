# campaign-ai-content-generation Specification

## Purpose

ให้ผู้ใช้สร้างเนื้อหาอีเมลแคมเปญ (หัวข้อ, ชื่อแคมเปญ, เนื้อหา) ด้วย AI จากภายในหน้าต่างสร้าง/แก้ไขแคมเปญ โดยอ้างอิง product catalog และ brand context ที่มีอยู่

## Requirements

### Requirement: AI Generate Action In Campaign Dialog
The email campaign create/edit dialog SHALL show the product selection, tone selection, and brand-context fields directly inside the "ข้อมูลแคมเปญ" (campaign info) section of the main form — always visible, not gated behind a collapsible panel that must be opened first. The action that triggers AI generation SHALL be placed in the dialog's footer, alongside the other footer actions (ยกเลิก, บันทึกร่าง, ตั้งเวลาส่ง, ส่งทันที).

#### Scenario: Fields are visible without any extra step
- **WHEN** a user opens the campaign create/edit dialog
- **THEN** the product selection, tone selection, and brand-context checkbox are visible immediately in the campaign info section, without needing to click any "เปิด"/toggle action first

#### Scenario: Generate action lives in the footer
- **WHEN** a user wants to trigger AI generation
- **THEN** the action is available among the dialog's footer buttons, not inside a separate panel within the form body

### Requirement: Product Selection For Generation
The campaign dialog's AI generation fields (in the campaign info section) SHALL let the user select zero or more products from the product catalog to inform the generated content. Product selection alone SHALL NOT be the only way to give the AI a direction — the user MAY instead (or additionally) provide a free-form topic/idea in the subject line field, or enable brand context, per the minimum-input requirement defined below.

#### Scenario: Generating with a selected product includes its details
- **WHEN** a user selects one product and triggers generation
- **THEN** the generation request includes that product's name, description, and USP, and the generated content is expected to reference that product

#### Scenario: Generating with no product selected succeeds when another input source is present
- **WHEN** a user triggers generation without selecting any product, but has typed a topic/idea in the subject line field or has enabled brand context
- **THEN** generation proceeds using that other input source, without error

### Requirement: Free-Form Idea Takes Priority Over Product When Both Are Present
WHEN a user has both typed a topic/idea (via the subject line field, used as source topic) and selected one or more products, the system SHALL treat the typed idea as the primary direction for the generated content and SHALL treat the selected product(s) as supplementary detail only, not as a competing or overriding topic.

#### Scenario: Idea and product both provided
- **WHEN** a user selects a product and also types a topic/idea distinct from that product's typical use
- **THEN** the generated content follows the typed idea as its main subject, while still being able to reference the selected product's details as supporting detail

### Requirement: Minimum Input Required Without Brand Context
WHEN brand context is not enabled for a generation request, the system SHALL require at least one of: a selected product, or a typed topic/idea in the subject line field. WHEN brand context is enabled, the system SHALL NOT require either of these.

#### Scenario: No product, no idea, no brand context
- **WHEN** a user triggers generation with no product selected, an empty subject line, and brand context not enabled
- **THEN** the system prevents generation and indicates at least one input source is needed

#### Scenario: Brand context alone is sufficient
- **WHEN** a user triggers generation with no product selected and an empty subject line, but has enabled brand context
- **THEN** generation proceeds without error, using brand context as the grounding source

### Requirement: Subject Line Reused As Source Topic
WHEN the campaign's Subject Line field already contains text at the time generation is triggered, the system SHALL use that text as the source topic for the AI and SHALL NOT overwrite the Subject Line or Campaign Name fields with AI-generated values.

#### Scenario: Existing subject line is preserved after generation
- **WHEN** a user has typed a subject line, selects a product, and triggers generation
- **THEN** the subject line field still shows the user's original text after generation completes, and the AI-written content reflects that subject as its topic

### Requirement: Auto-Fill Subject And Name When Empty
WHEN the campaign's Subject Line field is empty at the time generation is triggered, the system SHALL let the AI produce a subject line and a campaign name, and SHALL fill both fields with the generated values.

#### Scenario: Empty subject and name are filled by AI
- **WHEN** a user leaves Subject Line and Campaign Name empty, selects a product, and triggers generation
- **THEN** after generation both fields contain AI-generated text

### Requirement: Generated Body Always Populates The Editor
Regardless of whether the Subject Line was pre-filled, generation SHALL always produce structured content (`heading`, `blocks[]`, optional `cta_text`) that the system composes deterministically into the selected template's chrome, and SHALL always write the resulting content into the campaign's content editor.

#### Scenario: Body appears after generation
- **WHEN** generation completes successfully
- **THEN** the campaign content editor shows the composed body (heading + blocks rendered with the selected template's style), replacing any placeholder/empty state

#### Scenario: Composed content is editable like template-based content
- **WHEN** generation completes and writes composed content into the editor
- **THEN** the raw structured content is stored as the campaign's editable content (not only the composed HTML), so reopening the draft loads the same editable content back into the editor per the existing template content composition mechanism

### Requirement: Generated Fields Remain Editable
After AI generation completes, the user SHALL be able to further edit the Campaign Name, Subject Line, and body content before saving, scheduling, or sending.

#### Scenario: User edits AI-generated subject line
- **WHEN** a user changes the AI-generated subject line text after generation
- **THEN** the edited text is what gets saved when the campaign is created or updated

### Requirement: AI Always Selects A Template
WHEN generation completes, the system SHALL always associate the campaign with one of the available email templates. The system SHALL NOT produce a generated campaign with no template selected.

#### Scenario: No template selected before generation
- **WHEN** a user triggers generation without having selected any template
- **THEN** the AI's response includes a template selection, and the campaign dialog applies that template's chrome to the generated content

#### Scenario: Template already selected before generation
- **WHEN** a user has already selected a template before triggering generation
- **THEN** generation does not change the selected template, and the AI-written content is composed with the already-selected template's chrome

#### Scenario: AI returns an invalid template identifier
- **WHEN** the AI's response references a template identifier that does not exist in the available template list
- **THEN** the system falls back to a default template instead of failing the whole generation request

### Requirement: Tone Selection Includes An AI-Decided Default
The tone selector in the campaign info section SHALL offer an "ให้ AI เลือกเอง" (let AI decide) option, and this option SHALL be the default selection.

#### Scenario: Generating without changing the tone selector
- **WHEN** a user triggers generation without selecting a specific tone
- **THEN** the AI infers an appropriate tone from the product and topic context, rather than defaulting to a fixed tone such as "friendly"

#### Scenario: User explicitly picks a tone
- **WHEN** a user selects a specific tone (e.g. "เป็นทางการ") before triggering generation
- **THEN** the generated content follows that explicitly chosen tone

### Requirement: AI Suggests A Send Date And Time
WHEN generation completes, the system SHALL let the AI propose a send date and time for the campaign, and SHALL fill the schedule input with that suggestion only when the field was empty at the time generation was triggered.

#### Scenario: Schedule field empty before generation
- **WHEN** a user triggers generation with the schedule date/time field empty
- **THEN** after generation, the schedule field is pre-filled with the AI's suggested date and time

#### Scenario: Schedule field already set before generation
- **WHEN** a user has already set a schedule date/time before triggering generation
- **THEN** generation does not overwrite that value

#### Scenario: AI suggests a date in the past
- **WHEN** the AI's suggested date/time is not in the future relative to the current time
- **THEN** the system does not pre-fill the schedule field with that suggestion, and does not treat this as a generation failure

#### Scenario: Suggested schedule still requires explicit confirmation
- **WHEN** the schedule field has been pre-filled by an AI suggestion
- **THEN** the campaign is not scheduled or sent until the user explicitly triggers the existing schedule or send action

### Requirement: Draft Campaigns Persist Their Proposed Schedule
WHEN a campaign is saved as a draft (not scheduled or sent), the system SHALL persist the value currently in the schedule date/time field as the campaign's proposed schedule, so it is not lost if the user saves without scheduling.

#### Scenario: Saving a draft with an AI-suggested schedule
- **WHEN** a user saves a campaign as a draft after the schedule field was pre-filled by an AI suggestion, without clicking the schedule action
- **THEN** the proposed schedule value is stored with the campaign and is visible when the campaign is reopened or listed

#### Scenario: Proposed schedule does not imply the campaign will send
- **WHEN** a draft campaign has a stored proposed schedule
- **THEN** the campaign is not picked up by the scheduled-send process, and remains a draft until a user explicitly schedules or sends it

### Requirement: AI Does Not Author HTML Markup Or Links
The AI response schema used for content generation (both single-generate and batch-generate) SHALL NOT include a raw HTML field (e.g. `body_html`) and SHALL NOT allow the AI to specify any link URL. The AI SHALL only return structured plain content: a `heading` string, a `blocks` array of `paragraph` or `list` items, and an optional `cta_text` string.

#### Scenario: AI response contains no body_html field
- **WHEN** the system parses the AI's JSON response during generation
- **THEN** the parsed result has no `body_html` field, and any `<a>` tag or URL the AI might have written in plain text is not treated as a link when composed into the final HTML

#### Scenario: Single-generate and batch-generate use the same schema
- **WHEN** content generation is triggered from the single-generate panel or from batch AI planning (Phase 2)
- **THEN** both code paths request and parse the same `{heading, blocks, cta_text}` schema

#### Scenario: Optional CTA text flows into the template's existing CTA field
- **WHEN** the AI response includes a `cta_text` value
- **THEN** that value is used as the CTA button's text via the template's existing CTA field mechanism, and the CTA button's destination URL continues to come from the template configuration, never from the AI response

#### Scenario: Missing CTA text falls back to the template default
- **WHEN** the AI response omits `cta_text` or returns an empty value
- **THEN** the system uses the template's existing default CTA text, consistent with current non-AI behavior

### Requirement: Generated Content Is Composed Using The Selected Template's Style
The system SHALL render the AI's structured content (`heading`, `blocks[]`) into HTML using the selected template's own style metadata (heading color, body color, text alignment), rather than any styling the AI might imply.

#### Scenario: Generated heading uses the template's heading color and alignment
- **WHEN** generation completes for a campaign using a specific template
- **THEN** the composed heading HTML uses that template's configured heading color and text alignment, matching the visual convention of that template's own default content

#### Scenario: Generated paragraphs and lists use the template's body color and alignment
- **WHEN** the AI response contains one or more `paragraph` or `list` blocks
- **THEN** each block is rendered using the selected template's configured body color and text alignment

### Requirement: Generated Greeting Uses A Personalization Merge Tag
WHEN the AI generates a `heading`, the system SHALL instruct the AI to open the greeting with the `{{first_name}}` merge tag, consistent with the personalization convention already used by every template's own default content.

#### Scenario: Generated heading includes the first name merge tag
- **WHEN** generation completes successfully
- **THEN** the `heading` text contains the `{{first_name}}` merge tag as part of the opening greeting

#### Scenario: Missing merge tag does not fail the generation request
- **WHEN** the AI's response omits `{{first_name}}` from the `heading` despite the instruction
- **THEN** the system still accepts and composes the response (does not block or retry indefinitely), so a single non-compliant AI response does not fail the whole generation or batch
