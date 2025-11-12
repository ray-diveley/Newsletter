# Newsletter Investment & Priorities Dashboard

This Express + Handlebars service builds an internal engineering newsletter by querying JIRA and enriching output with OpenAI (summaries, icons, priorities, investment narrative).

## Core Capabilities
| Area | Description |
|------|-------------|
| Strategic Priorities | AI generated (with file TTL cache + deterministic fallback) placed under the header |
| Impact & Investment Overview | Categorizes all issues across 11 tuned buckets, renders SVG pie + table |
| AI Narrative | Business rationale & insight text for category distribution (graceful fallback) |
| Issue Cards | AI summarization + icon + cleaned bullet list (metadata removed) |
| Quick Wins | Highlight section with optional AI description sentence |

## Category Set (Tuned w/ 6‑Month History)
```
product_features
integration_apis
client_experience
financial_systems
data_analytics
internal_tools
performance_reliability
infrastructure_platform
security_compliance
testing_quality
general_improvements
```

Heuristics live in `src/lib/mapper.js` inside `categorizeIssue` (precedence ordered). Historic analysis scripts (`analyze-6months.js`) guided regex refinements to keep `general_improvements` low (< ~5%).

## High Level Flow
1. JIRA issues fetched for date window (`from`, `to` query params).
2. Items normalized & cleaned (names removed, bullets trimmed, metadata stripped).
3. AI enrichment: bullets, icon, closing statement, summary, priorities, investment narrative.
4. Categorization + counts -> pie arcs + percentage table.
5. Render Handlebars template to HTML (`base` by default or `cool` theme when requested).

## Quick Start
```
cp .env.example .env   # create & edit secrets (create .env.example if needed)
npm install
npm start              # or: npm run dev
# Base theme:
http://localhost:3100/preview.html?from=2025-10-01&to=2025-11-01
# Cool theme (dark, masonry cards):
http://localhost:3100/preview.html?from=2025-10-01&to=2025-11-01&theme=cool
```

### Essential Environment Variables
```
OPENAI_API_KEY=
JIRA_BASE_URL=
JIRA_EMAIL=
JIRA_API_TOKEN=
PORT=3100
```

## Repository Structure (Key Files)
| Path | Purpose |
|------|---------|
| `src/index.js` | Express server & routes |
| `src/lib/mapper.js` | Transformation pipeline + categorization + priorities & investment overview assembly |
| `src/lib/icon-generator.js` | OpenAI helper calls (icons, summaries, narratives) |
| `src/templates/base.hbs` | Main Handlebars template (classic light) |
| `src/templates/cool.hbs` | Alternate modern dark “cool” theme |
| `test-categorization.js` | Offline categorization tester (ad-hoc) |
| `analyze-6months.js` | One-time historical distribution analysis |

## Testing & CI
Minimal smoke test (`tests/sanity.mjs`) ensures the mapper produces an investment overview structure without invoking external calls (OpenAI dependency passed as null).
```
npm test
```
GitHub Actions workflow: `.github/workflows/ci.yml` (Node 20) installs dependencies and runs the smoke test.

## Adding / Adjusting Categories
1. Edit `categorizeIssue` regex/precedence in `mapper.js`.
2. Run `npm test` (update test fixture if distribution drastically changes).
3. Manually review generated newsletter to confirm business clarity.

## Caching Strategy
Priorities: file-based cache keyed by date (`priorities:<date>`). TTL configurable via `OPENAI_PRIORITIES_CACHE_DAYS` (default 30). Narrative & summaries degrade safely to deterministic fallbacks on error.

## Possible Next Enhancements
- Trend deltas vs prior month (sparkline or up/down indicators)
- Slack / email export integration
- PDF rendering (wkhtmltopdf or Playwright)
- Config-driven category toggle

## Deployment Notes
- Stateless except for small cache directory (.cache/)
- Ensure `.env` variables injected at runtime
- Optionally containerize (simple `Dockerfile` could: FROM node:20-alpine, copy, `npm ci`, expose 3100, `CMD ["node","src/index.js"]`).

## Creating The Remote Repository
```
git init                # already present locally
git add .
git commit -m "feat: initial investment & priorities dashboard"
# Create empty GitHub repo (e.g. your-org/jira-newsletter) then:
git remote add origin git@github.com:your-org/jira-newsletter.git
git push -u origin main
```

## License
MIT – see `LICENSE`.

---
Refactored from original simple summarizer into an insights-focused dashboard with strategic alignment & categorization.
