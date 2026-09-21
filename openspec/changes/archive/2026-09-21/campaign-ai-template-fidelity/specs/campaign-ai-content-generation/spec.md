## MODIFIED Requirements

### Requirement: Generated Body Always Populates The Editor
Regardless of whether the Subject Line was pre-filled, generation SHALL always produce structured content (`heading`, `blocks[]`, optional `cta_text`) that the system composes deterministically into the selected template's chrome, and SHALL always write the resulting content into the campaign's content editor.

#### Scenario: Body appears after generation
- **WHEN** generation completes successfully
- **THEN** the campaign content editor shows the composed body (heading + blocks rendered with the selected template's style), replacing any placeholder/empty state

#### Scenario: Composed content is editable like template-based content
- **WHEN** generation completes and writes composed content into the editor
- **THEN** the raw structured content is stored as the campaign's editable content (not only the composed HTML), so reopening the draft loads the same editable content back into the editor per the existing template content composition mechanism

## ADDED Requirements

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
