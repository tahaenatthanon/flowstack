## ADDED Requirements

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
The tone selector in the AI generation panel SHALL offer an "ให้ AI เลือกเอง" (let AI decide) option, and this option SHALL be the default selection.

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
