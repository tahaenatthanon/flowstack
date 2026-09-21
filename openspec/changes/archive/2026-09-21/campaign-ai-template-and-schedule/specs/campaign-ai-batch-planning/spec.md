## MODIFIED Requirements

### Requirement: Batch Generation Creates Draft Campaigns Only
WHEN a batch is generated, the system SHALL create one `email_campaigns` row per planned email with `status='draft'`. Each row's proposed `scheduled_at` SHALL combine a date derived from the start date and interval with a send time decided by the AI for that specific email. The system SHALL NOT set any created campaign to `scheduled` or send it.

#### Scenario: Generating a 3-email batch creates 3 drafts
- **WHEN** a user generates a batch configured for 3 emails
- **THEN** 3 new campaigns are created, each with status `draft`, and no email is sent as part of generation

#### Scenario: Send times vary across the batch
- **WHEN** a batch of more than one email is generated
- **THEN** the proposed `scheduled_at` values are not required to share the same time-of-day, and the dates still follow the start date and interval configured by the user

## ADDED Requirements

### Requirement: Batch Topics Are Planned Holistically For Diversity
Before writing any individual email, the system SHALL plan the full set of topics (and their proposed send times) for the batch in a single step that has visibility into all planned emails at once, rather than deciding each email's topic independently and in isolation.

#### Scenario: A 7-email batch produces 7 distinct topics
- **WHEN** a user generates a batch of 7 emails for one product
- **THEN** the 7 generated campaigns cover 7 distinct topics/angles, not a small fixed set of angles repeated in a cycle

#### Scenario: Batch of 2 or 3 emails still plans holistically
- **WHEN** a user generates a batch of 2 or 3 emails
- **THEN** the same holistic topic-planning step is used, even though the batch is small enough that a naive fixed-angle approach might have appeared to work

### Requirement: Each Batch Email Selects Its Own Template
WHEN writing the full content for one email in a batch, the system SHALL let the AI select a template for that specific email based on its own content, independently of the templates chosen for other emails in the same batch.

#### Scenario: Different emails in one batch use different templates
- **WHEN** a batch of 3 emails is generated with 3 different topics/angles
- **THEN** the 3 resulting campaigns may each reference a different template, chosen to fit each email's own content

### Requirement: Proposed Schedule Is Visible While Still Draft
The system SHALL display each batch-generated campaign's proposed date and time in the batch generation's completion view and in the main campaign list, even while the campaign's status is still `draft`, using wording that distinguishes it from a confirmed/scheduled send time.

#### Scenario: Completion screen lists each campaign's proposed date/time
- **WHEN** a batch generation finishes successfully
- **THEN** the completion view lists each created campaign along with its proposed send date and time

#### Scenario: Campaign list shows proposed schedule for a draft
- **WHEN** a batch-generated campaign is still in `draft` status and has a stored proposed schedule
- **THEN** its card in the campaign list displays that proposed date/time, labeled distinctly from a confirmed "กำหนดส่ง" (scheduled) label

#### Scenario: Sent campaigns display their full sent timestamp
- **WHEN** a campaign has been sent
- **THEN** its card displays the date and time it was sent, not only the date
