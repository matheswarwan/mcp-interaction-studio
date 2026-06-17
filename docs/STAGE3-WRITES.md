# Stage 3 — Write Operations (v1.0)

Discovered admin write endpoints for Interaction Studio `/internal/*` APIs.

## Implemented (v1.0.0)

| Tool | API | Notes |
|------|-----|-------|
| `set_campaign_state` | `PUT /internal/dataset/{ds}/campaign/{id}/` | GET full campaign → set `state` → PUT |
| `set_segment_enabled` | `POST /internal/dataset/{ds}/segments/disableOrEnable/?segmentIds={id}` | Query param `segmentIds`; optional `disabled=true/false` |

### Safety gates

- `IS_WRITES_ENABLED=true` required in MCP env
- `dry_run=true` by default (preview only)
- `confirm=true` required when `dry_run=false`

## Valid campaign states

Observed in UI and API: `Published`, `Disabled`

## Future write operations (need Network capture)

| Operation | Likely endpoint | Status |
|-----------|-----------------|--------|
| Clone campaign | `POST /internal/dataset/{ds}/campaign/` | Not implemented — UI uses `campaignCloneDestinationPOST` |
| Save campaign content | `PUT /internal/dataset/{ds}/campaign/{id}/` | Same endpoint; needs full experience payload |
| Create segment | `POST /internal/dataset/{ds}/segments/` | Not probed |
| Delete campaign | Unknown | Capture from UI delete action |

## How to capture new write endpoints

1. Open Interaction Studio UI → DevTools → Network
2. Perform the action (publish, clone, delete)
3. Find the `*.evergage.com` request (usually POST or PUT under `/internal/`)
4. Copy: method, path, query params, request body
5. Add API client + MCP tool with the same safety gates

## Testing checklist

```text
# Dry run (no IS_WRITES_ENABLED needed)
set_campaign_state campaign_id=qDArI state=Published dataset=eharper
set_segment_enabled segment_id=uvoSx enabled=true dataset=eharper

# Live write (IS_WRITES_ENABLED=true, dry_run=false, confirm=true)
# Use only on test campaigns/segments
```
