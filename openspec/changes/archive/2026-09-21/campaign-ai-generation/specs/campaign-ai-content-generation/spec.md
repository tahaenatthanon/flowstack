## ADDED Requirements

### Requirement: AI Generate Action In Campaign Dialog
The email campaign create/edit dialog SHALL offer a "สร้างด้วย AI" action, placed alongside the existing "ดึงคอนเทนท์" action, that opens a panel for AI-assisted content generation.

#### Scenario: User opens the AI generation panel
- **WHEN** a user clicks "สร้างด้วย AI" inside the campaign dialog's content section
- **THEN** a panel appears offering product selection and tone selection, without leaving the campaign dialog

### Requirement: Product Selection For Generation
The AI generation panel SHALL let the user select zero or more products from the product catalog to inform the generated content.

#### Scenario: Generating with a selected product includes its details
- **WHEN** a user selects one product and triggers generation
- **THEN** the generation request includes that product's name, description, and USP, and the generated content is expected to reference that product

#### Scenario: Generating with no product selected still succeeds
- **WHEN** a user triggers generation without selecting any product
- **THEN** generation proceeds using only brand-level context, without error

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
Regardless of whether the Subject Line was pre-filled, generation SHALL always write the generated email body into the campaign's content editor.

#### Scenario: Body appears after generation
- **WHEN** generation completes successfully
- **THEN** the campaign content editor shows the generated body, replacing any placeholder/empty state

### Requirement: Generated Fields Remain Editable
After AI generation completes, the user SHALL be able to further edit the Campaign Name, Subject Line, and body content before saving, scheduling, or sending.

#### Scenario: User edits AI-generated subject line
- **WHEN** a user changes the AI-generated subject line text after generation
- **THEN** the edited text is what gets saved when the campaign is created or updated
