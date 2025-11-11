# Quick Reference: Priorities Section

## What Changed?
1. **Header Icon:** 🎃 → 📢 (announcement megaphone)
2. **New Section:** "Priorities & Strategic Direction" after header, before "In This Issue"
3. **Optional:** Only renders if `priorities` data is provided

## How to Use

### JSON Format
```json
{
  "date": "2025-10-01",
  "issues": [...],
  "priorities": {
    "heading": "Strategic Focus Text",
    "content": "Explanation of priorities (2-3 sentences)..."
  }
}
```

### Server Endpoint
When calling `/preview?from=YYYY-MM-DD&to=YYYY-MM-DD`, the response includes:
```json
{
  "issues": [...],
  "quickWins": [...],
  "priorities": {
    "heading": "...",
    "content": "..."
  }
}
```

## Sample Priorities Texts

**Example 1: Customer Focus**
```
Heading: "Q4 Priority: Customer Experience & Revenue Growth"
Content: "As we enter Q4, engineering focuses on customer-facing product enhancements and platform stability. Key projects support revenue goals through improved adoption and reduced churn. Infrastructure improvements enable faster feature delivery and cost savings."
```

**Example 2: Operational Efficiency**
```
Heading: "November Focus: Backend Optimization & Scalability"
Content: "This month's engineering efforts concentrate on infrastructure modernization and system optimization. These projects reduce operational costs, improve reliability, and accelerate feature deployment cycles. Both initiatives directly impact operational efficiency metrics."
```

**Example 3: Strategic Reset**
```
Heading: "Engineering Strategic Alignment: Business-Driven Development"
Content: "Every project in this newsletter addresses specific business outcomes: revenue growth, cost reduction, or customer retention. We measure success by business impact, not just features shipped. This focus ensures engineering efforts align with company strategic goals."
```

## When to Include

✅ **Include:**
- Quarterly strategy changes
- Major business initiative announcements
- Addressing feedback on priorities
- Setting company-wide expectations
- Clarifying why projects matter

❌ **Omit:**
- Routine monthly updates
- When context is already clear
- Space/formatting concerns
- Regular project highlights only

## Files Modified

| File | Changes |
|------|---------|
| `src/templates/base.hbs` | Icon + priorities section added |
| `src/lib/mapper.js` | Priority extraction logic |
| `src/Simplified_Newsletter_Instructions.md` | Documentation |

## Testing

Generate test newsletter:
```bash
node scripts/generate-newsletter.mjs --input newsletter.test-priorities.json --out test-output.html
```

Result: Priorities section renders between header and "In This Issue"

## Visual Layout

```
┌─────────────────────────────────────────┐
│ 📢 November 2025 Engineering Newsletter  │  ← HEADER
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Q4 Focus: Customer Impact & Efficiency  │  ← NEW: PRIORITIES
│ (if provided in JSON)                   │
│                                         │
│ As we head into Q4, engineering...      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ IN THIS ISSUE                           │  ← TOC (unchanged)
└─────────────────────────────────────────┘

PROJECT CARDS ... QUICK WINS ...          ← UNCHANGED
```

## Markdown Files for Reference

1. **`PRIORITIES_SECTION_GUIDE.md`** — Full comprehensive guide
2. **`STRUCTURE_REFERENCE.md`** — Visual newsletter structure
3. **`IMPLEMENTATION_SUMMARY.md`** — Technical implementation details
4. **`src/Simplified_Newsletter_Instructions.md`** — Official documentation

## Key Benefits

✅ **Leadership Visibility** — Strategic direction visible to entire company  
✅ **Business Alignment** — Connects engineering work to business outcomes  
✅ **Context Setting** — Explains why projects matter, not just what was done  
✅ **Optional Flexibility** — Include when relevant, omit when not needed  
✅ **Backward Compatible** — Existing newsletters work unchanged  
✅ **Professional Appearance** — Matches design system and accessibility standards

---

**Status:** ✅ Ready for use | **Tested:** ✅ Yes | **Backward Compatible:** ✅ Yes
