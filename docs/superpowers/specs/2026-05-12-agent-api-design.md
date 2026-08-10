# Agent API — AI Agent Integration Design

**Date:** 2026-05-12
**Status:** Approved
**Approach:** A — API Key → JWT Bridge

## Overview

Enable AI agents (n8n, Make, Claude, GPT, custom scripts, and internal automation) to interact with Flowstack programmatically. Agents authenticate via API key, receive a JWT, and use all existing API endpoints with the same permissions as the owning user.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Auth model | API Key → JWT Bridge | Zero changes to existing endpoints; agent inherits user permissions |
| Key format | `fsk_` + 48 hex chars (~192-bit entropy) | Distinguishable prefix; brute-force infeasible |
| Key storage | SHA-256 hash in DB; plaintext shown once | Even if DB leaks, keys cannot be recovered |
| Permission model | Inherit user's role permissions | Simple, predictable, no extra RBAC surface |
| Rate limiting | 3 attempts / 15 min / IP on auth endpoint | Prevents brute-force against the auth exchange |

## Architecture

```
Agent (n8n / Python / Claude)
    │
    │ 1. POST /api/agent-auth.php  (X-API-Key: fsk_...)
    │    → gets JWT
    │
    │ 2. GET/POST/PUT/DELETE /api/*.php  (Authorization: Bearer <JWT>)
    │    → all existing endpoints work unchanged
    │
    ▼
Flowstack APIs (zero changes needed)
```

## Deliverables

### 1. Database Migration
- **File:** `database/migrations/YYYY_MM_DD_HHMMSS_agent_api_keys.sql`
- **Table:** `agent_api_keys` (id, user_id, tenant_id, name, key_hash, key_prefix, permissions, last_used_at, expires_at, is_active, created_by, created_at, updated_at)
- FKs to `users(id)` and `tenants(id)` ON DELETE CASCADE

### 2. `api/agent-keys.php` — API Key CRUD
- `GET` — list user's keys or get single key metadata (plaintext never returned)
- `POST` — create new key; returns plaintext key ONCE in response
- `PUT` — update key (rename, revoke/reactivate, change expiry)
- `DELETE` — permanently delete key
- All operations scoped to current user+tenant (admin can manage others)

### 3. `api/agent-auth.php` — Key Exchange
- Accepts `X-API-Key` header or `Authorization: Bearer fsk_...`
- Validates key hash, is_active, expires_at, and that the owning user is still active in the tenant
- Returns JWT (7-day expiry, same as normal login)
- Updates `last_used_at` on each successful exchange
- Logs to `activity_logs`
- Rate limited: 3 attempts / 15 min / IP

### 4. UI — API Key Management Tab
- New tab in AdminPage (or Profile section) for managing API keys
- Table: name, prefix, last used, status, expiry
- Create dialog with one-time key copy
- Revoke / Delete actions

### 5. `docs/agent-api-guide.md` — Thai-language Guide
- Overview, setup, authentication flow
- Full endpoint reference table
- Code examples: curl, Python, JavaScript, n8n
- Best practices (key rotation, env vars, rate limits)

### 6. `docs/agent-api.openapi.yaml` — OpenAPI 3.0 Spec
- Machine-readable specification of all endpoints
- `securitySchemes`: Bearer JWT and API Key
- Paths, parameters, request bodies, responses for every endpoint

## Security Model

| Concern | Mitigation |
|---|---|
| Key leakage | SHA-256 hash in DB; plaintext shown once at creation |
| Brute-force auth | Rate limit: 3 req / 15 min / IP |
| Compromised key | Revoke instantly via PUT is_active=0 or DELETE |
| User deactivation | Key becomes invalid when user is_active=0 or removed from tenant |
| Audit trail | Every auth exchange logged to activity_logs with IP and timestamp |
| Stale keys | Optional expires_at; review via UI |
