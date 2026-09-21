# campaign-ai-batch-planning Specification

## Purpose

TBD - ให้ผู้ใช้วางแผนและสร้างชุดแคมเปญอีเมลหลายฉบับพร้อมกันด้วย AI (กำหนดจำนวน, ระยะห่างวัน, วันเริ่มต้น) โดยแคมเปญทั้งหมดที่สร้างจะเป็นสถานะ draft และต้องได้รับการอนุมัติ/ตั้งเวลาด้วยตนเองก่อนส่งจริงเสมอ

## Requirements

### Requirement: Batch Plan Trigger
The Campaigns page toolbar SHALL offer an "AI วางแผนแคมเปญ" action that opens a dialog for configuring a multi-campaign AI-generated batch.

#### Scenario: User opens the batch planning dialog
- **WHEN** a user clicks "AI วางแผนแคมเปญ" in the Campaigns page toolbar
- **THEN** a dialog opens for configuring a batch of campaigns

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

### Requirement: Batch Generation Creates Draft Campaigns Only
WHEN a batch is generated, the system SHALL create one `email_campaigns` row per planned email with `status='draft'`. Each row's proposed `scheduled_at` SHALL combine a date derived from the start date and interval with a send time decided by the AI for that specific email. The system SHALL NOT set any created campaign to `scheduled` or send it.

#### Scenario: Generating a 3-email batch creates 3 drafts
- **WHEN** a user generates a batch configured for 3 emails
- **THEN** 3 new campaigns are created, each with status `draft`, and no email is sent as part of generation

#### Scenario: Send times vary across the batch
- **WHEN** a batch of more than one email is generated
- **THEN** the proposed `scheduled_at` values are not required to share the same time-of-day, and the dates still follow the start date and interval configured by the user

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
