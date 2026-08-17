## MODIFIED Requirements

### Requirement: Status badge displayed after article title
The system SHALL display a status badge after each content item title in ContentListTab.

#### Scenario: Status badge rendered with title
- **WHEN** ContentListTab renders a content item row
- **THEN** the item title is displayed followed by a status badge showing the Thai label from `STATUS_MAP[item.status].label`

#### Scenario: Status badge uses consistent text colors only
- **WHEN** a status badge is rendered
- **THEN** the badge uses ONLY text color classes from `STATUS_MAP[item.status].color` (e.g. `text-green-700 dark:text-green-300`)
- **AND** the badge has NO background color, no bg classes, no pill style
- **AND** the text colors match the approval Stat Card icon semantic tokens (draft=gray, revision=blue/info, pending_approval=amber/warning, approved=green/success, published=green, rejected=red/destructive)

#### Scenario: Status badge hidden when filtered by that status
- **WHEN** ContentListTab is showing a specific status tab (e.g., "ฉบับร่าง")
- **AND** `statusFilter === item.status`
- **THEN** the status badge is NOT displayed (all rows in this tab have the same status)

#### Scenario: Status badge shown in "ทั้งหมด" tab
- **WHEN** ContentListTab is showing the "ทั้งหมด" tab (`statusFilter === 'all'`)
- **THEN** the status badge IS displayed for every row regardless of status

#### Scenario: Status badge shown when filtering by type or platform
- **WHEN** ContentListTab has a type or platform filter active
- **AND** `statusFilter === 'all'`
- **THEN** the status badge IS displayed
