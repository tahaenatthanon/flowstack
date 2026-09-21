## MODIFIED Requirements

### Requirement: Product Selection For Generation
The AI generation panel SHALL let the user select zero or more products from the product catalog to inform the generated content. Product selection alone SHALL NOT be the only way to give the AI a direction — the user MAY instead (or additionally) provide a free-form topic/idea in the subject line field, or enable brand context, per the minimum-input requirement defined below.

#### Scenario: Generating with a selected product includes its details
- **WHEN** a user selects one product and triggers generation
- **THEN** the generation request includes that product's name, description, and USP, and the generated content is expected to reference that product

#### Scenario: Generating with no product selected succeeds when another input source is present
- **WHEN** a user triggers generation without selecting any product, but has typed a topic/idea in the subject line field or has enabled brand context
- **THEN** generation proceeds using that other input source, without error

## ADDED Requirements

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
