# Server Preview Endpoint with Priorities

## Updated Behavior

The `/preview.html` endpoint now correctly:
1. ✅ Uses the `from` date (not current date) for the newsletter title
2. ✅ Supports optional `priorities` parameters for the priorities section

## How to Use

### Basic Preview (Date Only)
```
http://localhost:3100/preview.html?from=2025-10-01&to=2025-11-01
```

**Result:**
- Title: "October 2025 Engineering Newsletter" ✅ (September 1st + 1 month = October)
- Date: 2025-10-01 (in YYYY-MM-DD format, used for derivation)
- Priorities section: NOT shown (no data provided)

### With Priorities Section

```
http://localhost:3100/preview.html?from=2025-10-01&to=2025-11-01&prioritiesHeading=Q4%20Focus:%20Customer%20Impact&prioritiesContent=As%20we%20enter%20Q4,%20engineering%20focuses%20on%20customer%20experience%20and%20operational%20efficiency.%20Every%20project%20supports%20revenue%20growth%20and%20cost%20reduction%20goals.
```

**Result:**
- Title: "October 2025 Engineering Newsletter" ✅
- Priorities section: ✅ Shows with heading and content
- Project cards: Rendered from JIRA data

### URL Parameters

| Parameter | Required | Example | Notes |
|-----------|----------|---------|-------|
| `from` | ✅ Yes | `2025-10-01` | Start date (YYYY-MM-DD). Used for title derivation. |
| `to` | ✅ Yes | `2025-11-01` | End date (YYYY-MM-DD). Filters JIRA issues by date range. |
| `project` | ❌ No | `PROJ1,PROJ2` | Comma-separated project keys. Defaults to env config. |
| `statuses` | ❌ No | `In%20Progress,Done` | Comma-separated statuses. Defaults to env config. |
| `prioritiesHeading` | ❌ No | `Q4%20Focus` | Heading for priorities section (URL-encoded). |
| `prioritiesContent` | ❌ No | `As%20we%20enter...` | Content for priorities section (URL-encoded). |

## Title Derivation Logic

The newsletter title is now derived from the `from` date using the **"next month"** rule:

```
from date: 2025-10-01 (October 1)
  ↓ (add 1 month)
newsletter title: "November 2025 Engineering Newsletter"
```

**Examples:**
- `from=2025-09-01` → "October 2025 Engineering Newsletter"
- `from=2025-10-01` → "November 2025 Engineering Newsletter"
- `from=2025-11-01` → "December 2025 Engineering Newsletter"

## Example Complete URLs

### Example 1: October Newsletter with Priorities
```
http://localhost:3100/preview.html?from=2025-09-01&to=2025-10-01&prioritiesHeading=Q4%20Engineering%20Focus&prioritiesContent=This%20quarter%20we%20focus%20on%20customer%20impact%20and%20operational%20efficiency.
```

### Example 2: November Newsletter (No Priorities)
```
http://localhost:3100/preview.html?from=2025-10-01&to=2025-11-01
```

### Example 3: Custom Projects with Priorities
```
http://localhost:3100/preview.html?from=2025-10-01&to=2025-11-01&project=PLATFORM,TOOLS&prioritiesHeading=Platform%20Modernization&prioritiesContent=Modernizing%20our%20platform%20for%20scalability.
```

## Testing

### Without Server (Local JSON)
```bash
node scripts/generate-newsletter.mjs --input newsletter.example.json --out newsletter-output.html
```

### With Server (Web UI)
1. Start server: `npm start`
2. Navigate to `http://localhost:3100`
3. Enter "From" date: `2025-10-01`
4. Enter "To" date: `2025-11-01`
5. Click "Preview"
6. Result: "October 2025 Engineering Newsletter" ✅

## URL Encoding Reference

When passing text parameters, URL-encode special characters:

| Character | Encoded |
|-----------|---------|
| Space | `%20` |
| `:` | `%3A` |
| `&` | `%26` |
| `(` | `%28` |
| `)` | `%29` |

**Example:**
```
Raw: "Q4 Focus: Customer Impact"
Encoded: "Q4%20Focus%3A%20Customer%20Impact"
```

## Notes

- **Backward Compatible:** Existing URLs without priorities parameters continue to work
- **JIRA Integration:** The `from` and `to` dates still filter JIRA issue queries by comment/resolution date
- **Priorities Optional:** If no priorities parameters provided, the section simply doesn't render
- **Format:** Always use YYYY-MM-DD format for date parameters
