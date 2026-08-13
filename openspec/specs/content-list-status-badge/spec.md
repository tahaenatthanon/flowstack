# content-list-status-badge Specification

## Purpose

Show each content item's workflow status inline next to its title in the content list, so an author scanning the "ทั้งหมด" (All) tab can tell draft, revision, pending_approval, approved, published, and rejected items apart at a glance — using text color only, without adding background fills to the row.

## Requirements

### Requirement: Status badge displayed after article title
The system SHALL display a status badge after each content item title in ContentListTab.

#### Scenario: Status badge rendered with title
- **WHEN** ContentListTab renders a content item row
- **THEN** the item title is displayed followed by a status badge showing the Thai label from `STATUS_MAP[item.status].label`

#### Scenario: Status badge uses consistent text colors only
- **WHEN** a status badge is rendered
- **THEN** the badge uses ONLY text color classes from `STATUS_MAP[item.status].color` (e.g. `text-green-700 dark:text-green-300`)
- **AND** the badge has NO background color, no bg classes, no pill style
- **AND** the text colors match the Status Filter tabs (draft=gray, revision=orange, pending_approval=amber, approved=blue, published=green, rejected=red)

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

### Requirement: Status badge format and positioning
The status badge SHALL be displayed inline after the title with text-only coloring and no background.

#### Scenario: Badge format
- **WHEN** a status badge is rendered
- **THEN** it is a plain `<span>` with colored text and no background fill
- **AND** it uses `text-[11px]` font size
- **AND** it is displayed inline after the title text
- **AND** it uses parentheses format: ` (สถานะ)` — including a leading space before the opening parenthesis
