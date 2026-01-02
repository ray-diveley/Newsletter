import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load the simplified instructions from the markdown file for injection into prompts.
 */
function getInstructionsContext() {
  try {
    const instructionsPath = path.join(__dirname, '..', 'Simplified_Newsletter_Instructions.md');
    const content = fs.readFileSync(instructionsPath, 'utf8');
    
    // Extract the Content Tone & Audience section
    const toneStart = content.indexOf('## Content Tone & Audience');
    const toneEnd = content.indexOf('## Input Data');
    if (toneStart !== -1 && toneEnd !== -1) {
      return content.substring(toneStart, toneEnd).trim();
    }
    
    return '';
  } catch (err) {
    console.error('Error loading instructions:', err.message);
    return '';
  }
}

const INSTRUCTIONS_CONTEXT = getInstructionsContext();

/**
 * Generate an appropriate icon (single emoji) based on project context using OpenAI.
 * Falls back to a generic icon if OpenAI is not available or fails.
 * @param {Object} openai - OpenAI client instance
 * @param {Object} context - Project context
 * @param {Set} usedIcons - Set of already-used icons to avoid duplicates
 */
export async function generateIcon(openai, context, usedIcons = new Set()) {
  if (!openai) {
    // Fallback icons if OpenAI not available
    const status = (context.status || '').toLowerCase();
    if (['done', 'deployed', 'released'].includes(status)) return '✅';
    if (['uat', 'testing', 'in review'].includes(status)) return '🧪';
    return '⚙️';
  }

  try {
    const usedList = Array.from(usedIcons).join(', ');
    const excludeClause = usedList ? `\n\nDO NOT use these emojis (already used): ${usedList}` : '';
    
    const prompt = `Choose a single, appropriate emoji for this project context. Return ONLY the emoji character, nothing else.

Project Title: ${context.summary || ''}
Status: ${context.status || ''}
Labels: ${(context.labels || []).join(', ') || 'none'}
Bullets: ${(context.bullets || []).slice(0, 2).join('; ') || 'none'}

Choose an emoji that best represents the project's domain, purpose, or status. Be concise.${excludeClause}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 5,
      messages: [{ role: 'user', content: prompt }]
    });

    const emoji = (response.choices[0]?.message?.content || '').trim();
    // Validate that the result is actually an emoji (or at least a single character)
    const validEmoji = emoji && emoji.length <= 2 ? emoji : '⚙️';
    usedIcons.add(validEmoji);
    return validEmoji;
  } catch (err) {
    console.error('Error generating icon:', err.message);
    const fallback = '⚙️';
    usedIcons.add(fallback);
    return fallback;
  }
}

/**
 * Generate a positive closing statement for a card using OpenAI.
 * Falls back to a generic statement if OpenAI is not available or fails.
 */
export async function generateClosingStatement(openai, context) {
  if (!openai) {
    const status = (context.status || '').toLowerCase();
    if (['done', 'deployed', 'released'].includes(status)) {
      return '✅ Delivered and live!';
    }
    if (['uat', 'testing'].includes(status)) {
      return '🧪 On track for completion.';
    }
    return '⚙️ Great progress ahead!';
  }

  try {
    const prompt = `Generate a short, positive, single-sentence closing statement (max 12 words) for a project update. Start with an emoji that matches the project's content/theme.

Project Title: ${context.summary || ''}
Status: ${context.status || ''}
Bullets: ${(context.bullets || []).slice(0, 2).join('; ') || 'none'}
Description: ${context.description || ''}

ICON SELECTION GUIDE - Choose emojis based on project content:
- Client/Customer work: 👥 🤝 💬 🎨 🌐
- Data/Analytics: 📊 📈 💹 🔍 📉
- Performance/Speed: ⚡ 🏃 ⏱️ 🚀 💨
- Security/Auth: 🔒 🛡️ 🔐 🔑 ✅
- Money/Billing: 💰 💳 💵 💸 🏦
- Tools/Systems: 🛠️ ⚙️ 🔧 🔨 🧰
- Integration: 🔗 🔌 🌉 🤖 📡
- Communication: 📞 💬 📧 📢 🗣️
- Quality/Testing: ✅ 🧪 🔬 ✔️ 🎯
- Launch/Release: 🎉 🎊 🚀 ⭐ 🎯
- Infrastructure: 🏗️ 🧱 🌁 🏢 🔧
- Innovation: 💡 🚀 ✨ 🔮 💫

EXAMPLES with content-matched icons:
- 💳 Streamlining payment workflows for faster revenue recognition!
- 🔒 Strengthening security across all authentication touchpoints!
- 📊 Unlocking deeper insights for data-driven decisions!
- 🤝 Enhancing client experience with seamless portal access!
- ⚡ Boosting performance for smoother user interactions!
- 🛠️ Automating manual processes to save team time!
- 🔗 Connecting systems for unified data flow!

CRITICAL RULES:
1. Choose an emoji that DIRECTLY relates to the project's content/domain
2. DO NOT use 🌟 or 🌈 - these are overused
3. Vary sentence structure - avoid formulaic patterns
4. Be specific to the project's actual impact
5. Keep it professional and uplifting

Return only the closing statement, nothing else.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 30,
      messages: [{ role: 'user', content: prompt }]
    });

    const statement = (response.choices[0]?.message?.content || '').trim();
    return statement || '⚙️ Great progress!';
  } catch (err) {
    console.error('Error generating closing statement:', err.message);
    return '⚙️ Great progress!';
  }
}

/**
 * Generate an inspiring intro/description for the Quick Wins section using OpenAI.
 * Falls back to a generic description if OpenAI is not available or fails.
 */
export async function generateQuickWinsDescription(openai, date) {
  if (!openai) {
    return 'Small enhancements delivered to boost performance and usability.';
  }

  try {
    const prompt = `Generate a short, inspiring, single-sentence description (max 15 words) for a "Quick Wins" section of an engineering newsletter, highlighting recent deliverables.

Date context: ${date || 'recent period'}

Return only the description, nothing else. Make it uplifting and professional. Start with a verb if possible.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 40,
      messages: [{ role: 'user', content: prompt }]
    });

    const description = (response.choices[0]?.message?.content || '').trim();
    return description || 'Small enhancements delivered to boost performance and usability.';
  } catch (err) {
    console.error('Error generating quick wins description:', err.message);
    return 'Small enhancements delivered to boost performance and usability.';
  }
}

/**
 * Generate a high-level summary sentence for a project card (one sentence or less).
 * Summarizes the entire card update with business impact focus.
 * Falls back to a generic summary if OpenAI is not available or fails.
 */
export async function generateCardSummary(openai, context) {
  if (!openai) {
    return 'Delivering business value and engineering excellence.';
  }

  try {
    const prompt = `You are generating a newsletter summary for an engineering project. Follow these guidelines:

${INSTRUCTIONS_CONTEXT}

TASK: Generate a concise, professional one-sentence summary (max 25 words) for a project card in this exact style: [Strong verb] [key innovation/change] [business benefits and impact].

Examples of GOOD summaries:
- Transforms how we manage client data with flexible, account-tagged contacts that accelerate the client portal project while simplifying daily operations.
- Centralizes recruitment list management in one powerful tool, bringing compliance tracking and operational efficiency together for seamless project execution.
- Empowers Shapiro + Raj with their own dedicated Qualstage environment, delivering enterprise-grade security and scalability while establishing our blueprint for future white-labeled partnerships.
- Automates expert matching with intelligent scoring algorithms that eliminate manual searches and accelerate project staffing.
- Unifies bidding workflows into a single interface that reveals market dynamics and guides strategic resource decisions.

Project Title: ${context.summary || ''}
Status: ${context.status || ''}
Bullets: ${(context.bullets || []).slice(0, 3).join('; ') || 'none'}
Description: ${context.description || ''}

FORBIDDEN WORDS - DO NOT START WITH THESE VERBS:
Enhanced, Enabled, Streamlined, Improved, Delivered, Completed, Launched, Introduced, Advanced, Expanded, Optimized, Integrated, Upgraded, Updated, Implemented, Developed, Built, Created, Added, Fixed

INSTEAD USE VERBS LIKE:
Transforms, Centralizes, Empowers, Automates, Unifies, Simplifies, Consolidates, Revolutionizes, Reimagines, Redefines, Elevates, Unlocks, Bridges, Connects, Orchestrates, Accelerates (if describing future impact, not completion)

CRITICAL REQUIREMENTS:
- Start with a verb from the APPROVED list (NOT from the forbidden list)
- Describe the specific innovation or change in concrete terms
- Highlight business benefits and strategic impact
- Use active voice, vivid language, and unique phrasing
- Make it inspiring and forward-looking
- Return ONLY the summary sentence, nothing else.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 40,
      messages: [{ role: 'user', content: prompt }]
    });

    const summary = (response.choices[0]?.message?.content || '').trim();
    return summary || 'Delivering business value and engineering excellence.';
  } catch (err) {
    console.error('Error generating card summary:', err.message);
    return 'Delivering business value and engineering excellence.';
  }
}

/**
 * Generate clean, business-focused bullet points using OpenAI.
 * Removes technical jargon, metadata, and focuses on business impact.
 * Falls back to empty array if OpenAI is not available.
 */
export async function generateBullets(openai, context) {
  if (!openai) {
    return [];
  }

  try {
    const prompt = `You are generating brief, impactful bullet points for an engineering newsletter targeting the entire company (technical and non-technical staff).

${INSTRUCTIONS_CONTEXT}

TASK: Generate 2-3 concise, business-focused bullet points (max 12 words each) for this project.

Project Title: ${context.summary || ''}
Status: ${context.status || ''}
Raw Updates: ${(context.bullets || []).slice(0, 5).join('; ') || 'none'}

CRITICAL REQUIREMENTS:
- Each bullet must be 1-12 words maximum
- Focus ONLY on business impact and outcomes (not technical processes)
- Use natural, conversational language - write as if explaining to a colleague in simple terms
- Vary your sentence structure naturally - DO NOT force every bullet to start with the same pattern or verb
- Make it sound human and engaging, not robotic or templated
- NO technical details, acronyms (unless explained), or issue codes
- NO metadata labels (remove "highlight:", "update:", "note:", "achievement:", "status:")
- NO team member names
- NO internal jargon or processes
- Make it clear and actionable for non-technical readers
- Return exactly 2-3 bullets, one per line, no numbering or dashes
- Return ONLY the bullets, nothing else`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 80,
      messages: [{ role: 'user', content: prompt }]
    });

    const bulletsText = (response.choices[0]?.message?.content || '').trim();
    // Split by newline and filter empty lines
    const bullets = bulletsText
      .split('\n')
      .map(b => b.replace(/^[-•*]\s*/, '').trim())
      .filter(b => b.length > 0)
      .slice(0, 3); // Max 3 bullets
    
    return bullets.length > 0 ? bullets : [];
  } catch (err) {
    console.error('Error generating bullets:', err.message);
    return [];
  }
}

/**
 * Generate a year-end summary celebrating accomplishments and comparing to previous year.
 * Returns { narrative, comparison } or null.
 */
export async function generateYearEndSummary(openai, stats2024, stats2025) {
  if (!openai) {
    const growth = stats2024.total > 0 ? Math.round(((stats2025.total - stats2024.total) / stats2024.total) * 100) : 0;
    return {
      narrative: `In 2025, we delivered ${stats2025.total} projects${growth > 0 ? ` (${growth}% growth from 2024)` : ''}, advancing our product capabilities and operational excellence.`,
      comparison: growth > 0 ? 'up' : growth < 0 ? 'down' : 'stable'
    };
  }

  try {
    const growth = stats2024.total > 0 ? Math.round(((stats2025.total - stats2024.total) / stats2024.total) * 100) : 0;
    const prompt = `Write a brief, celebratory 2-3 sentence year-end summary for an engineering team newsletter.

2024 Stats: ${stats2024.total} projects delivered, top focus: ${stats2024.topCategory}
2025 Stats: ${stats2025.total} projects delivered, top focus: ${stats2025.topCategory}
Growth: ${growth}%

REQUIREMENTS:
- Celebrate team accomplishments with an uplifting tone
- Mention year-over-year growth (if positive)
- Highlight impact on customers or business outcomes
- Keep it brief (max 50 words, 2-3 sentences)
- Professional but warm tone

Return ONLY the summary text, no extra formatting.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 100,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }]
    });

    const narrative = (response.choices[0]?.message?.content || '').trim();
    return {
      narrative: narrative || `In 2025, we delivered ${stats2025.total} projects, ${growth > 0 ? `growing ${growth}% from 2024` : 'maintaining our strong delivery pace'}.`,
      comparison: growth > 0 ? 'up' : growth < 0 ? 'down' : 'stable'
    };
  } catch (err) {
    console.error('Error generating year-end summary:', err.message);
    const growth = stats2024.total > 0 ? Math.round(((stats2025.total - stats2024.total) / stats2024.total) * 100) : 0;
    return {
      narrative: `In 2025, we delivered ${stats2025.total} projects${growth > 0 ? ` (${growth}% growth from 2024)` : ''}.`,
      comparison: growth > 0 ? 'up' : growth < 0 ? 'down' : 'stable'
    };
  }
}

/**
 * Generate a short "Priorities & Strategic Direction" paragraph based on the preview content.
 * Returns an object { heading, content } or null. Uses OpenAI when available; falls back to a sensible
 * default if not.
 */
export async function generatePriorities(openai, preview) {
  if (!openai) {
    // If OpenAI isn't configured, return a simple placeholder only when there is meaningful content
    const countIssues = Array.isArray(preview.issues) ? preview.issues.length : 0;
    const countQuick = Array.isArray(preview.quickWins) ? preview.quickWins.length : 0;
    if (countIssues + countQuick === 0) return null;
    return {
      heading: 'Strategic Focus',
      content: `This period we focused on ${countIssues} project(s) and ${countQuick} quick win(s) that advance product value and operational efficiency.`
    };
  }

  try {
    // Build a compact context from issues and quickWins to feed to the model
    const issuesText = (preview.issues || []).slice(0, 8).map(i => `- ${i.summary || i.heading || i.key || ''} (${i.status || 'status unknown'})`).join('\n');
    const quickText = (preview.quickWins || []).slice(0, 8).map(q => `- ${q.title || q.key || q.summary || ''}`).join('\n');

    const prompt = `You are an editorial assistant that writes a short strategic "Priorities & Strategic Direction" paragraph for an engineering newsletter aimed at company-wide (technical and non-technical) staff.\n\n` +
      `Using the following items, produce: 1) a concise heading (<=6 words) and 2) one engaging paragraph (2-3 sentences, max 45 words) that explains the engineering priorities and ties them to business outcomes (customer impact, revenue, efficiency, reliability). Avoid technical jargon, team names, or internal codes.\n\n` +
      `Context - Projects:\n${issuesText || 'none'}\n\nQuick wins:\n${quickText || 'none'}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 120,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = (response.choices[0]?.message?.content || '').trim();
    if (!text) return null;

    // Heuristically split into heading and paragraph if the model returned both
    // We'll attempt to detect a first line that looks like a heading (short)
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let heading = 'Strategic Focus';
    let content = text;
    if (lines.length >= 2 && lines[0].length <= 40) {
      heading = lines[0].replace(/^\W+/, '').trim();
      content = lines.slice(1).join(' ');
    } else if (lines.length === 1) {
      // Single-line output: try to split after first sentence for heading
      const firstSentenceEnd = lines[0].indexOf('. ');
      if (firstSentenceEnd !== -1 && firstSentenceEnd <= 40) {
        heading = lines[0].slice(0, firstSentenceEnd).replace(/[^\w\s]/g,'').trim();
        content = lines[0].slice(firstSentenceEnd + 2).trim();
      } else {
        // fallback: short heading and the line as content
        heading = 'Strategic Focus';
        content = lines[0];
      }
    }

    // Ensure content is not overly long
    content = content.split('\n').join(' ').replace(/\s+/g, ' ').trim();
    if (content.length > 300) content = content.slice(0, 300) + '...';

    return { heading, content };
  } catch (err) {
    console.error('Error generating priorities:', err.message || err);
    return null;
  }
}

/**
 * Generate an AI-powered narrative for the Impact & Investment Overview section.
 * Explains where engineering effort is going and the business rationale.
 * Falls back to heuristic text if OpenAI is not available.
 */
export async function generateInvestmentNarrative(openai, categoriesArray, totalIssues) {
  if (!openai || !categoriesArray || categoriesArray.length === 0) {
    // Fallback heuristic
    if (!categoriesArray || categoriesArray.length === 0) {
      return 'Engineering efforts distributed across operational priorities.';
    }
    const top = categoriesArray[0];
    if (categoriesArray.length === 1) {
      return `This period focused primarily on ${top.label.toLowerCase()} (${top.percent}%).`;
    }
    const second = categoriesArray[1];
    const tail = categoriesArray.slice(2).map(c => c.label.split(' ')[0]).join(', ');
    return `Investment centered on ${top.label.toLowerCase()} (${top.percent}%) and ${second.label.toLowerCase()} (${second.percent}%)${tail ? `, with additional capacity on ${tail}` : ''}.`;
  }

  try {
    const categoriesText = categoriesArray
      .map(c => `- ${c.label}: ${c.count} issues (${c.percent}%)`)
      .join('\n');

    const prompt = `You are writing a short "Impact & Investment Overview" narrative for an engineering newsletter read by executives and company-wide staff (technical and non-technical).

TASK: Generate 2-3 concise sentences (max 60 words total) that:
1. Summarizes where engineering effort is going this period based on the categories below
2. Explains the business rationale (why these areas matter: customer value, cost savings, efficiency, reliability, risk reduction, revenue impact)
3. Uses clear, accessible language (avoid jargon)

Categories & Distribution:
${categoriesText}

Total issues: ${totalIssues}

REQUIREMENTS:
- Focus on BUSINESS OUTCOMES and strategic value, not just category names
- Connect effort to company goals (customer experience, revenue, operational excellence, risk management)
- Keep it inspiring and forward-looking
- Use simple language accessible to non-technical readers
- Return ONLY the narrative text (2-3 sentences), nothing else`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 120,
      temperature: 0.4,
      messages: [{ role: 'user', content: prompt }]
    });

    const narrative = (response.choices[0]?.message?.content || '').trim();
    return narrative || 'Engineering efforts distributed across operational priorities.';
  } catch (err) {
    console.error('Error generating investment narrative:', err.message);
    // Fallback on error
    if (!categoriesArray || categoriesArray.length === 0) {
      return 'Engineering efforts distributed across operational priorities.';
    }
    const top = categoriesArray[0];
    if (categoriesArray.length === 1) {
      return `This period focused primarily on ${top.label.toLowerCase()} (${top.percent}%).`;
    }
    const second = categoriesArray[1];
    return `Investment centered on ${top.label.toLowerCase()} (${top.percent}%) and ${second.label.toLowerCase()} (${second.percent}%).`;
  }
}

export default { generateIcon, generateClosingStatement, generateQuickWinsDescription, generateCardSummary, generateBullets, generatePriorities, generateInvestmentNarrative };
