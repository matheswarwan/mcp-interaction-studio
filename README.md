# mcp-interaction-studio

MCP (Model Context Protocol) server for **Salesforce Interaction Studio** / **Marketing Cloud Personalization** admin APIs.

Connect Cursor, Claude Desktop, or any MCP client to your Interaction Studio instance to list datasets, campaigns, segments, templates, recipes, and campaign performance stats through natural language.

## How it works

Interaction Studio’s admin UI uses **undocumented internal APIs** under `/internal/...`. This server authenticates the same way your browser does: with a **session cookie** (`JSESSIONID`) from an active UI login.

| Auth method | Used for |
|-------------|----------|
| `JSESSIONID` session cookie | All tools in this package (`/internal/*`) |
| API token (Basic auth) | Public `/api/*` endpoints only — **not** used by this MCP yet |

---

## Prerequisites

- **Node.js 18+**
- Access to Interaction Studio admin UI (Gears) for your org
- An MCP host (e.g. **Cursor**, Claude Desktop)

---

## Step 1 — Find your `IS_BASE_URL`

Log into Interaction Studio. The URL in your browser looks like:

```text
https://{accountName}.{instance}.evergage.com/ui/...
```

Your base URL is everything **before** `/ui`:

```text
https://{accountName}.{instance}.evergage.com
```

**Example:** if you see  
`https://demo.us-1.evergage.com/ui/`  
then:

```text
IS_BASE_URL=https://demo.us-1.evergage.com
```

Do **not** include a trailing slash.

You can also find this from any Network request to `*.evergage.com` — use the scheme + host only.

---

## Step 2 — Get your `IS_SESSION_ID` (JSESSIONID)

The session ID is a cookie set when you log into the admin UI. It expires when you log out or after idle timeout.

### Chrome / Edge

1. Log into Interaction Studio at `{IS_BASE_URL}/ui/`
2. Open **DevTools** → **Network** tab
3. Reload the page (or click any screen that loads data)
4. Click any request to your `*.evergage.com` host
5. Under **Request Headers**, find the `Cookie` header
6. Copy the value after `JSESSIONID=` up to the next `;`

Example cookie header:

```text
Cookie: JSESSIONID=274fb681-ebf1-4dbb-8e4d-5b03bb8a1752; AWSALBTG=...
```

Copy only:

```text
274fb681-ebf1-4dbb-8e4d-5b03bb8a1752
```

### Firefox

1. Log into the UI
2. DevTools → **Network** → select a request → **Headers** → **Cookie**
3. Copy the `JSESSIONID` value the same way

### Verify with curl

```bash
curl -k "https://YOUR_ACCOUNT.us-4.evergage.com/internal/datasetSummaries/" \
  -H "Cookie: JSESSIONID=YOUR_SESSION_ID_HERE" \
  -H "X-Requested-With: XMLHttpRequest"
```

If you get a JSON array of datasets, the session is valid. If you get `401` or `"Bad Credentials"`, log in again and copy a fresh `JSESSIONID`.

> **Security:** Treat `JSESSIONID` like a password. Do not commit it to git or share it in chat. Refresh it when it expires.

---

## Step 3 — Install the MCP server

### Option A — Run with npx (recommended)

No global install needed:

```bash
npx mcp-interaction-studio
```

### Option B — Global install

```bash
npm install -g mcp-interaction-studio
mcp-interaction-studio
```

### Option C — Clone and run locally

```bash
git clone <your-repo-url>
cd mcp-interaction-studio
npm install
npm start
```

---

## Step 4 — Configure your MCP host

### Cursor

Open **Cursor Settings → MCP** (or edit `~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "interaction-studio": {
      "command": "npx",
      "args": ["-y", "mcp-interaction-studio"],
      "env": {
        "IS_BASE_URL": "https://YOUR_ACCOUNT.us-4.evergage.com",
        "IS_SESSION_ID": "paste-your-JSESSIONID-here",
        "IS_DEFAULT_DATASET": "my-dataset",
        "IS_TLS_INSECURE": "true"
      }
    }
  }
}
```

If installed globally:

```json
{
  "mcpServers": {
    "interaction-studio": {
      "command": "mcp-interaction-studio",
      "env": {
        "IS_BASE_URL": "https://YOUR_ACCOUNT.us-4.evergage.com",
        "IS_SESSION_ID": "paste-your-JSESSIONID-here",
        "IS_DEFAULT_DATASET": "my-dataset",
        "IS_TLS_INSECURE": "true"
      }
    }
  }
}
```

Restart MCP in Cursor Settings after changing config.

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "interaction-studio": {
      "command": "npx",
      "args": ["-y", "mcp-interaction-studio"],
      "env": {
        "IS_BASE_URL": "https://YOUR_ACCOUNT.us-4.evergage.com",
        "IS_SESSION_ID": "paste-your-JSESSIONID-here",
        "IS_DEFAULT_DATASET": "my-dataset",
        "IS_TLS_INSECURE": "true"
      }
    }
  }
}
```

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `IS_BASE_URL` | **Yes** | Interaction Studio host, e.g. `https://demo.us-1.evergage.com` (no trailing slash) |
| `IS_SESSION_ID` | **Yes** | `JSESSIONID` cookie value from an active UI session |
| `IS_DEFAULT_DATASET` | No | Default dataset name when a tool omits the `dataset` parameter |
| `IS_TLS_INSECURE` | No | Set to `true` if curl/Node fails with SSL certificate errors (common behind Zscaler/corporate proxies). Equivalent to `curl -k`. |
| `IS_WRITES_ENABLED` | No | Set to `true` to enable write tools (`set_campaign_state`, `set_segment_enabled`). Off by default. |
| `NODE_EXTRA_CA_CERTS` | No | Path to your corporate root CA `.pem` file — preferred over `IS_TLS_INSECURE` for production use |

Copy `.env.example` to `.env` when running locally:

```bash
cp .env.example .env
# edit .env, then:
npm start
```

---

## Corporate SSL (Zscaler / proxy)

If you see:

```text
SSL certificate problem: unable to get local issuer certificate
```

**Quick fix (dev):** set `IS_TLS_INSECURE=true`

**Proper fix:** export your org’s Zscaler/corporate root CA and set:

```bash
export NODE_EXTRA_CA_CERTS=/path/to/corporate-root.pem
```

Then remove `IS_TLS_INSECURE`.

---

## Session expiration

When `JSESSIONID` expires, tools return:

```text
Session expired or invalid (401). Log into Interaction Studio, copy a fresh JSESSIONID...
```

**Fix:** log into the UI again → copy new `JSESSIONID` → update `IS_SESSION_ID` in MCP config → restart MCP.

There is no API token alternative for `/internal/*` admin routes today.

---

## Available tools

| Tool | Description |
|------|-------------|
| `check_session` | Validate `JSESSIONID` and list datasets (use when you get 401 errors) |
| `list_datasets` | All datasets in the account |
| `get_dataset` | Dataset metadata and content zones |
| `list_campaigns` | Campaigns in a dataset |
| `get_campaign` | Campaign details: state, targeting, experiences |
| `get_campaign_stats` | Impressions, clicks, goals, orders, revenue |
| `list_segments` | Segments in a dataset |
| `get_segment` | Segment details and targeting rules |
| `list_all_segments` | Segments across all datasets (or filter one) |
| `list_templates` | Item/message templates |
| `list_recipes` | Recommendation recipes |
| `get_campaign_context` | Campaign experiences, messages, and runtime context |
| `list_surveys` | Surveys in a dataset |
| `list_content_zone_logs` | Content zone activity logs |
| `get_segment_details` | Extended segment info including membership counts |
| `audit_dataset` | Dataset audit report (markdown or JSON); optional file output |
| `audit_mcp_dataset` | **Executive-ready** orchestrated audit: narrative, health score, governance, consumption, settings; markdown + DOCX |
| `compare_datasets` | Side-by-side comparison of two datasets |
| `get_recipe_usage` | Map recipes to campaigns (resolves inUse vs actual linkage) |
| `list_segment_stats` | Batch segment membership counts and calc status |
| `set_campaign_state` | Publish or disable a campaign (write; gated) |
| `set_segment_enabled` | Enable or disable a segment (write; gated) |

Set `IS_DEFAULT_DATASET` to skip passing `dataset` on every call.

### Write tools (v1.0)

Write operations are **disabled by default**. To enable:

1. Set `IS_WRITES_ENABLED=true` in MCP config
2. Call with `dry_run=false` and `confirm=true`

Always preview first with `dry_run=true` (default):

- *"Dry run: publish campaign Q07yv in eharper"*
- *"Disable segment uvoSx in eharper — dry run only"*

Execute only when intentional:

- *"Set campaign qDArI to Disabled in eharper with dry_run false and confirm true"*

| Endpoint | Method | Operation |
|----------|--------|-----------|
| `/internal/dataset/{ds}/campaign/{id}/` | PUT | Publish / disable campaign (full object, `state` field) |
| `/internal/dataset/{ds}/segments/disableOrEnable/` | POST | Enable / disable segment (`segmentIds` query param) |

### Executive audit (`audit_mcp_dataset`)

Board-ready assessment with health rating, strengths/gaps narrative, domain assessments, and prioritized recommendations. Writes **markdown** and **DOCX** when `output_path` is set.

| Parameter | Description |
|-----------|-------------|
| `report_style` | `executive` (default) or `technical` |
| `output_format` | `markdown`, `json`, or `docx` |
| `export_docx` | When saving `.md`, also write `.docx` (default: `true`) |
| `sections` | `governance`, `consumption`, `settings` (default: all) |

Example:

- *"Full MCP audit of eharper — save to audit/eharper-audit.md"*
- *"audit_mcp_dataset dataset=eharper report_style=executive output_path=audit/report.md"*

### Example prompts

- *"Check my Interaction Studio session"*
- *"List my Interaction Studio datasets"*
- *"Audit the eharper dataset and save to audit/eharper-audit.md"*
- *"Full executive MCP audit of eharper with markdown and docx"*
- *"Compare mathes and eharper datasets"*
- *"Which campaigns use recipe 4RhQk in eharper?"*
- *"List segment stats for all segments in eharper"*
- *"Get stats for campaign ABC123 in my-dataset"*
- *"List all segments across every dataset"*
- *"Get segment XYZ789 from my-dataset"*

### Campaign stats time ranges

For `get_campaign_stats` and `list_campaigns`, use `time_range`:

- `pastDay`, `pastWeek` (default), `pastMonth`, `pastQuarter`, `Today`
- Custom: `YYYY-MM-DD..YYYY-MM-DD` (max range limits apply per IS API)

### CLI audit script

After building locally, run a full audit from the command line:

```bash
npm run build
node dist/scripts/audit-dataset.js eharper --output ../audit/eharper-audit.md
```

Or use the npm script:

```bash
npm run audit -- eharper --output ../audit/eharper-audit.md
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `401` / Bad Credentials | Refresh `IS_SESSION_ID` from DevTools |
| SSL certificate error | `IS_TLS_INSECURE=true` or `NODE_EXTRA_CA_CERTS` |
| Tool not found in Cursor | Restart MCP after upgrading the package |
| `Missing IS_BASE_URL` | Set env in MCP config `env` block |
| Zero campaign stats | Campaign may have no traffic in the selected time window; try a wider custom range |
| `Query param [timeRange] is required` | Use a valid `time_range` value (see above) |

---

## License

MIT
