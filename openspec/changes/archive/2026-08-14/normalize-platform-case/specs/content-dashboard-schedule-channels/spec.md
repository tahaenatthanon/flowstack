# content-dashboard-schedule-channels Specification (delta)

## ADDED Requirements

### Requirement: นับจำนวนแพลตฟอร์มแบบ case-insensitive
The dashboard SHALL count platform content in a case-insensitive manner, so the same platform written with different casing (e.g. "Facebook" vs "facebook") is aggregated into a single entry.

#### Scenario: รวมแพลตฟอร์มเดียวกัน
- **WHEN** the dashboard loads with `content_items` where some items have `platform = "Facebook"` and others `platform = "facebook"`
- **THEN** the widget shows a single "Facebook" entry with a combined count (not two separate entries)
