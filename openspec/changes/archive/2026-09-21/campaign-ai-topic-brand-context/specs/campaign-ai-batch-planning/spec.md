## MODIFIED Requirements

### Requirement: Batch Configuration Inputs
The batch planning dialog SHALL collect the number of emails to generate, the interval in days between each email's proposed send date, and a start date. The dialog SHALL let the user select zero or more products, and SHALL let the user type a free-form topic/idea describing the overall theme of the batch, and SHALL let the user enable brand context — per the minimum-input requirement defined below, the user is not required to select a product if a topic/idea is typed or brand context is enabled.

#### Scenario: Configuring a 3-email batch with a product
- **WHEN** a user selects one product, sets count to 3, interval to 3 days, and a start date
- **THEN** the dialog accepts the configuration and allows the user to proceed with generation

#### Scenario: Configuring a batch by topic/idea alone
- **WHEN** a user types a topic/idea describing the batch's theme, selects no product, sets count/interval/start date, and does not enable brand context
- **THEN** the dialog accepts the configuration and allows the user to proceed with generation

#### Scenario: At least one input source is required
- **WHEN** a user attempts to generate a batch with no product selected, no topic/idea typed, and brand context not enabled
- **THEN** the system prevents generation and indicates at least one of product, topic/idea, or brand context is needed

## ADDED Requirements

### Requirement: Batch Topic/Idea Grounds Holistic Topic Planning
WHEN a user has typed a topic/idea for the batch, the system SHALL pass it into the holistic topic-planning step (that decides each individual email's topic and send time) as the batch's primary theme, so that individually planned topics stay consistent with the user's stated idea rather than being invented independently of it.

#### Scenario: Batch topics follow the stated idea
- **WHEN** a user types a topic/idea and generates a batch of several emails
- **THEN** the topics planned for each email in the batch relate to that stated idea

### Requirement: Batch-Created Campaigns May Have No Product
WHEN a batch is generated without any product selected, the system SHALL create the batch's campaigns with no product association, rather than requiring a product to exist.

#### Scenario: Batch generated from idea alone has no product on its campaigns
- **WHEN** a user generates a batch using only a typed topic/idea (no product selected)
- **THEN** each created campaign has no product association, and displays and behaves normally in the campaign list
