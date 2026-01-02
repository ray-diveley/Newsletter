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

## Writing Style & Content Quality

The newsletter emphasizes **natural, engaging language** that communicates business impact without robotic patterns. AI-generated content is guided by specific prompts to produce varied, conversational output.

### Card Summary Principles
**Goal**: 25 words max, structure varies, focuses on innovation + business impact, avoids overused verbs like "Enhanced/Enabled/Streamlined"

**December 2025 Examples** (demonstrating varied, engaging style):
- "Transforms client management workflow with automated engagement tracking, enabling advisors to focus on strategic relationships rather than manual updates."
- "Consolidates recruitment list management into a single interface, reducing cognitive load and enabling faster decision-making for hiring managers."
- "Provides granular control over bidding outcomes, allowing project managers to optimize resource allocation based on real-time market dynamics."

**When to customize**: For key strategic initiatives or cross-functional projects, write custom summaries in `mapper.js` that highlight specific business value. Otherwise, rely on AI with strong prompts.

### Bullet Point Principles
**Goal**: 2-3 bullets, 12 words each, natural conversational language with varied structure (avoid forcing every bullet to start with action verbs)

**December 2025 Examples** (showing natural variation):
- "Advisors now see client interaction history automatically, no manual tracking required"
- "New dashboard consolidates three separate recruitment tools into one unified view"
- "Bidding outcomes can be adjusted in real-time based on capacity and priority"
- "The system automatically applies pricing rules without requiring manual calculations"

**AI Prompt Guidance**: Emphasize "conversational language" and "varied sentence structures" to avoid robotic patterns like "Delivered X", "Enabled Y" on every line.

### Closing Statement Principles
**Goal**: Enthusiastic, specific to the work delivered, reinforces business value or team momentum, uses varied language

**December 2025 Examples** (showing diverse patterns):
- "🚀 Excited for the scalability these infrastructure improvements will unlock as we grow!"
- "✨ Bringing measurable efficiency gains to the team!"
- "🎯 Aligned with our strategic priorities for Q4!"
- "💡 Solving a long-standing pain point!"
- "🌟 Opening new possibilities for client engagement!"
- "These enhancements are creating a scalable model for onboarding future whitelabeled clients!"

**AI Prompt Guidance**: Explicitly instruct to avoid repetitive patterns like "Exciting..." or "Looking forward to..." - vary emojis, sentence structures, and ways to express impact.

**When to customize**: For milestone releases or new client launches, write custom closings in `mapper.js` that celebrate the specific achievement.

### Technical Implementation Notes
- **Quick Wins JQL**: `resolutiondate >= -30d` (shows items resolved in the last 30 days, ordered by resolved date)
- **Issue Filtering**: Exclude administrative or duplicate issues (e.g., "1099 MISC copy available in users account") via `mapper.js` filter logic
- **Visualization**: Horizontal bar chart with two-column layout - left side shows "Engineering Investment Distribution" with labeled bars (category name, bar, percentage), right side shows AI-generated narrative explaining the distribution strategy
- **Bar Chart Style**: Each category displays on one line with label (140px), progress bar (flexible width), and percentage (45px right-aligned) for clean, scannable visualization
- **Icon Spacing**: 8-12px margin-right for visual balance
- **JIRA Fields**: Fetches `description` field for richer AI summarization context

### Monthly Workflow: Content Quality Review
1. **Run the newsletter** with your date range
2. **Review card summaries**: Do they sound engaging and varied? If too generic, consider custom summaries for key initiatives
3. **Review bullet points**: Do they sound natural and conversational? Should vary in structure (not all starting with verbs)
4. **Review closing statements**: Does it match the energy and significance of the month's work?
5. **Edit `mapper.js`** if you identify patterns worth customizing (major releases, new clients, strategic pivots)

### Year-End Summary (December Newsletters)
When you generate a newsletter for December (e.g., `from=2025-12-01`), the system automatically includes a **Year in Review** section at the top with a modern gradient background and metric cards showing:

**Visual Design:**
- Purple gradient background with white metric cards
- Grid layout (responsive, 4 cards across on desktop)
- Each card has a decorative gradient accent in the top-right corner
- Growth indicators with directional arrows (↗ up, ↘ down, → same)
- Strikethrough on previous year's numbers for clear before/after comparison

**Metrics Displayed:**
- 📊 **Projects Delivered** - Total projects completed with % growth badge
- 🐛 **Bugs Squashed** - Total bugs fixed with change indicator
- ⚡ **Quick Wins** - Quick wins delivered (shows "New!" if none in 2024)
- 🎯 **Top Focus Area** - Primary investment category for the year
- **AI-generated narrative** - Contextual summary of the year's achievements

**Data Sources (JQL):**
```
Projects 2024/2025:
  project = EBP AND statusCategory = Done AND statusCategoryChangedDate >= "YYYY-01-01" AND statusCategoryChangedDate <= "YYYY-12-31"

Bugs 2024/2025:
  issuetype = Bug AND statusCategory = Done AND statusCategoryChangedDate >= "YYYY-01-01" AND statusCategoryChangedDate <= "YYYY-12-31"
```

You can run `node check-year-stats.js` to preview the year-over-year statistics before generating the newsletter.

## License
MIT – see `LICENSE`.

---
Refactored from original simple summarizer into an insights-focused dashboard with strategic alignment & categorization.
