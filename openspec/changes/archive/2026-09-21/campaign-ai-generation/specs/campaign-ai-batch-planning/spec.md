## ADDED Requirements

### Requirement: Batch Plan Trigger
The Campaigns page toolbar SHALL offer an "AI วางแผนแคมเปญ" action that opens a dialog for configuring a multi-campaign AI-generated batch.

#### Scenario: User opens the batch planning dialog
- **WHEN** a user clicks "AI วางแผนแคมเปญ" in the Campaigns page toolbar
- **THEN** a dialog opens for configuring a batch of campaigns

### Requirement: Batch Configuration Inputs
The batch planning dialog SHALL require the user to select at least one product, and SHALL collect the number of emails to generate, the interval in days between each email's proposed send date, and a start date.

#### Scenario: Configuring a 3-email batch
- **WHEN** a user selects one product, sets count to 3, interval to 3 days, and a start date
- **THEN** the dialog accepts the configuration and allows the user to proceed with generation

#### Scenario: Product selection is required
- **WHEN** a user attempts to generate a batch without selecting any product
- **THEN** the system prevents generation and indicates a product must be selected

### Requirement: Batch Generation Creates Draft Campaigns Only
WHEN a batch is generated, the system SHALL create one `email_campaigns` row per planned email with `status='draft'` and a proposed `scheduled_at` derived from the start date and interval, and SHALL NOT set any created campaign to `scheduled` or send it.

#### Scenario: Generating a 3-email batch creates 3 drafts
- **WHEN** a user generates a batch configured for 3 emails
- **THEN** 3 new campaigns are created, each with status `draft`, and no email is sent as part of generation

### Requirement: Batch Grouping And Ordering
All campaigns created within one batch generation SHALL share the same batch identifier and SHALL each record their position within the batch.

#### Scenario: Batch campaigns share an identifier
- **WHEN** a batch of 3 campaigns is generated
- **THEN** all 3 campaigns store the same batch identifier and are ordered 1 through 3

### Requirement: Batch Indicator In Campaign List
The campaign list SHALL display an indicator on cards belonging to a batch, showing the batch's overall progress (how many of the batch have moved past draft status).

#### Scenario: Card shows batch progress
- **WHEN** a batch of 3 campaigns has 1 campaign already scheduled and 2 still in draft
- **THEN** each of the 3 campaign cards shows an indicator reflecting that 1 of 3 has progressed

### Requirement: Manual Approval Required Before Send
A batch-created draft campaign SHALL require the same explicit user action as a manually created campaign (editing and scheduling, or sending) before it can be sent. No automated process triggered by batch generation SHALL transition a batch-created campaign out of `draft` status.

#### Scenario: Batch draft is not sent automatically
- **WHEN** a batch of campaigns has just been generated
- **THEN** none of the generated campaigns are picked up by the scheduled-send cron until a user explicitly schedules or sends them
