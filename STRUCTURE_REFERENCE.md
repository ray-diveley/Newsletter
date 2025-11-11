```
NEWSLETTER STRUCTURE (with new Priorities section)
═══════════════════════════════════════════════════

┌─────────────────────────────────────────────────────┐
│  📢 November 2025 Engineering Newsletter             │  ← HEADER (icon changed from 🎃)
│  (blue background, white text, centered)            │
└─────────────────────────────────────────────────────┘

    [16px spacer]

┌─────────────────────────────────────────────────────┐
│ Q4 Engineering Focus: Customer Impact & Efficiency  │  ← NEW: PRIORITIES SECTION
│ (blue left border, white background)                │
│                                                     │
│ As we head into Q4, engineering priorities are...   │
│ (2-3 sentences explaining business focus)           │
└─────────────────────────────────────────────────────┘

    [16px spacer]

┌─────────────────────────────────────────────────────┐
│                IN THIS ISSUE                        │
│ ─────────────────────────────────────────────────   │
│ Left Column          │  Right Column                │
│                      │                              │
│ ✓ Project Alpha      │  Project Beta                │
│ Project Gamma        │  ✓ Project Delta             │
│ Quick Wins           │  Project Epsilon             │
└─────────────────────────────────────────────────────┘

┌──────────────────────┬──────────────────────┐
│  LEFT COLUMN         │  RIGHT COLUMN        │
│                      │                      │
│ ┌────────────────┐   │ ┌────────────────┐   │
│ │ 🎯 Project A   │   │ │ 🔄 Project B   │   │
│ │ — Done         │   │ │ — In Progress  │   │
│ │                │   │ │                │   │
│ │ Description... │   │ │ Description... │   │
│ │ • Bullet 1     │   │ │ • Bullet 1     │   │
│ │ • Bullet 2     │   │ │ • Bullet 2     │   │
│ │ • Bullet 3     │   │ │ • Bullet 3     │   │
│ └────────────────┘   │ └────────────────┘   │
│                      │                      │
│ ┌────────────────┐   │ ┌────────────────┐   │
│ │ 📊 Project C   │   │ │ ⚙️ Project D   │   │
│ │ — In Progress  │   │ │ — Testing      │   │
│ │ ...            │   │ │ ...            │   │
│ └────────────────┘   │ └────────────────┘   │
│                      │                      │
└──────────────────────┴──────────────────────┘

┌─────────────────────────────────────────────────────┐
│         ⚡ QUICK WINS — September Highlights        │
│  (light blue background, centered)                  │
│                                                     │
│  Small enhancements delivered in September...       │
│                                                     │
│  🔄 Recent Wins:                                    │
│  • Feature X improved performance                   │
│  • Resolved payment processing issue                │
│                                                     │
│  ‼ These quick improvements enhanced UX!            │
│                                                     │
│  Back to Top                                        │
└─────────────────────────────────────────────────────┘


RENDERING LOGIC
═══════════════

{
  "date": "2025-10-01",
  "issues": [...],
  "quickWins": [...],
  "priorities": {                    ← OPTIONAL
    "heading": "Q4 Focus...",        ← Conditional rendering
    "content": "As we enter Q4..."   ← Only if provided
  }
}

If priorities = null/undefined → section not rendered
If priorities provided → section appears after header


VERTICAL FLOW
═════════════

1. HEADER (📢 icon, blue background)
   ↓
2. [OPTIONAL] PRIORITIES (white card, blue border)
   ↓
3. IN THIS ISSUE (TOC with project links)
   ↓
4. PROJECT CARDS (2-column layout with icons/colors)
   ↓
5. QUICK WINS (light blue, centered)


STYLING DETAILS
═══════════════

PRIORITIES SECTION:
  Background: #fff (white)
  Border-left: 5px solid #0b79ff (blue)
  Padding: 20px
  Margin-bottom: 16px
  Border-radius: 8px

HEADING:
  Font: Arial, 16px, bold
  Color: #0b79ff (blue)
  Margin-bottom: 12px

CONTENT:
  Font: Arial, 14px
  Color: #333 (dark grey)
  Line-height: 1.6
  2-3 sentences max (150-200 words)

POSITION:
  After header spacer
  Before "In This Issue"
  Full width of newsletter


EXAMPLE DATA
════════════

{
  "heading": "Q4 Engineering Focus: Customer Impact & Operational Efficiency",
  "content": "As we head into Q4, engineering priorities are strategically aligned on two pillars: (1) delivering customer-facing enhancements that directly improve product adoption and client retention, and (2) optimizing backend infrastructure to reduce operational costs and improve system reliability. Every project in this newsletter contributes to one of these business goals."
}

Result (rendered):
  ┌──────────────────────────────────────────┐
  │ Q4 Engineering Focus: Customer Impact... │
  │ As we head into Q4, engineering...       │
  └──────────────────────────────────────────┘


BACKWARD COMPATIBILITY
══════════════════════

✅ Works with existing newsletters (priorities omitted)
✅ No changes to project cards
✅ No changes to Quick Wins section
✅ No changes to "In This Issue" TOC
✅ Template conditional: {{#if prioritiesSection}}
✅ Mapper handles null/undefined gracefully
```
