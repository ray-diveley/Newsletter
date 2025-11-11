import dayjs from 'dayjs';
import { cleanBulletLine, stripNames, capWords, extractTextFromADF } from './utils.js';
import { generateIcon, generateClosingStatement, generateQuickWinsDescription, generateCardSummary, generateBullets, generatePriorities } from './icon-generator.js';
import cache from './simple-cache.js';

function escapeHtml(str){
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function pickColorForStatus(status = '', labels = []){
  const s = (status||'').toLowerCase();
  if (['done','deployed','live in production','released'].includes(s)) return '#28a745';
  if (['uat','testing','in review','in qa','qa'].includes(s)) return '#6c757d';
  if (labels.map(l=>l.toLowerCase()).includes('hotfix')) return '#ff6b6b';
  return '#0052cc';
}

function selectIcon(issue){
  const status = (issue.status||'').toLowerCase();
  if (['done','deployed','released','live in production'].includes(status)) return '🎯';
  if (['uat','testing','in review','qa'].includes(status)) return '🧪';
  const labels = (issue.labels||[]).map(l=>l.toLowerCase());
  if (labels.includes('security')) return '🔒';
  if (labels.includes('performance')) return '⚡';
  if (labels.includes('ux') || labels.includes('ui')) return '🎨';
  // summary keyword heuristics
  const s = (issue.summary||'').toLowerCase();
  if (s.match(/pay|billing|invoice|revenue|wallet/)) return '💳';
  if (s.match(/call|phone|audio|record/)) return '📞';
  if (s.match(/data|analytics|report|intel/)) return '📊';
  if (s.match(/ai|automation|bot|intelligent/)) return '🤖';
  if (s.match(/portal|website|web|client/)) return '🌐';
  return '🔄';
}

function isDoneStatus(status){
  const s = (status||'').toLowerCase();
  return ['done','deployed','live in production','released'].includes(s);
}

function cleanMarkdownAndTeamPlaceholders(text) {
  if (!text) return '';
  // Remove [team] placeholders completely (replace with empty string, not keep them)
  let cleaned = String(text).replace(/\[team\]/gi, '');
  // Remove markdown bold markers ** and other markdown artifacts
  cleaned = cleaned.replace(/\*\*/g, '');
  // Clean up multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

/**
 * Remove metadata labels and technical codes from bullet points per instructions.
 * Removes: "highlight:", "status:", "note:", "update:", "progress:", "EBP-XXX", etc.
 */
function cleanBulletMetadata(text) {
  if (!text) return '';
  let cleaned = String(text);
  
  // Remove common metadata prefixes (case-insensitive)
  cleaned = cleaned.replace(/^(highlight|status|note|update|progress|achievement|activity|activity|task|item|point|update|info|detail|note|finding|result|outcome|action|step|milestone|accomplishment):\s*/i, '');
  
  // Remove technical issue codes (e.g., "EBP-142", "JIRA-123", "R79306")
  cleaned = cleaned.replace(/\b[A-Z]{1,10}-?\d{1,6}\b/g, '');
  
  // Remove story points notation (e.g., "5 points", "story points")
  cleaned = cleaned.replace(/\d+\s*(?:story\s*)?points?\b/i, '');
  
  // Remove sprint references (e.g., "sprint 12", "sprint-12")
  cleaned = cleaned.replace(/sprint\s*-?\d+/i, '');
  
  // Clean up multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

export async function mapPreviewToTemplate(preview, openai = null){
  // Support both modern preview.issues and legacy preview.items shapes.
  let source = [];
  if (Array.isArray(preview.issues) && preview.issues.length) {
    source = preview.issues.map(i => ({
      key: i.key,
      summary: i.summary,
      status: i.status,
      labels: i.labels || [],
      bullets: i.bullets || [],
      comments: i.comments || [],
      oneLiner: i.oneLiner || '',
      url: i.url
    }));
  } else if (Array.isArray(preview.items) && preview.items.length) {
    // Legacy mapping: items may already contain icon/color/body; convert to issue-like objects
    source = preview.items.map(it => {
      const heading = it.heading || '';
      // attempt to split "KEY — Summary"
      const parts = heading.split('—').map(p=>p.trim());
      const key = it.id || parts[0] || '';
      // Prefer the left side of the heading as the human-friendly title/summary
      const title = parts[0] || it.id || '';
      const statusFromHeading = parts[1] || '';
      const summary = it.summary || title;
      return {
        key,
        summary,
        status: statusFromHeading,
        labels: it.labels || [],
        bullets: it.bullets || [],
        comments: it.comments || [],
        oneLiner: it.oneLiner || '',
        url: it.url,
        _providedIcon: it.icon,
        _providedColor: it.color,
        _providedBody: it.body
      };
    });
  }

  // Build items with colors/icons and safe HTML body. Heading does NOT include the icon
  // Apply editorial rules: remove 'internal' labeled items, strip names, pick 3-5 bullets, trim bullets to 15 words
  const filteredSource = source.filter(s => !(Array.isArray(s.labels) && s.labels.map(l=>String(l).toLowerCase()).includes('internal')));

  const items = filteredSource.map(i=>{
    const providedColor = i._providedColor;
    const providedIcon = i._providedIcon;
    const providedBody = i._providedBody;
    const color = providedColor || pickColorForStatus(i.status, i.labels || []);
    const icon = providedIcon || '⚙️'; // Will be replaced by AI-generated icon later
    // Prefer a human-friendly title (summary or title) for display; use key only for id generation
    const displayTitle = escapeHtml(i.summary || i.title || i.key || '');
    const keyText = escapeHtml(i.key || (i.title || displayTitle).toLowerCase().replace(/[^a-z0-9]+/gi,'-'));
    const summaryText = escapeHtml(i.summary || '');
    const heading = `${displayTitle}`;
    const bulletsHtml = (i.bullets || []).length ? `<ul>${i.bullets.map(b=>`<li>${escapeHtml(b)}</li>`).join('')}</ul>` : '';
    // Process bullets: clean metadata first, then pick 3-5, strip names, cap to 15 words
    const rawBullets = i.bullets || [];
    // Clean metadata from all bullets first
    const cleanedBullets = rawBullets
      .map(b => cleanBulletMetadata(String(b)))
      .filter(b => b.trim().length > 0); // Remove empty bullets after cleaning
    
    // Choose between 3 and 5 bullets from the cleaned list (prefer first items)
    const pickedCount = Math.max(0, Math.min(5, Math.max(3, cleanedBullets.length)));
    const picked = cleanedBullets.slice(0, pickedCount)
      .map(b => capWords(cleanMarkdownAndTeamPlaceholders(stripNames(cleanBulletLine(b))), 15));
    
    const bulletsHtmlSafe = picked.length ? `<ul>${picked.map(b=>`<li>${b}</li>`).join('')}</ul>` : '';

    const commentsHtml = ''; // Comments section hidden per user request; Notes no longer shown
    const displayTitleCleaned = cleanMarkdownAndTeamPlaceholders(displayTitle);
    // Simpler body: just bullets, no oneLiner or displayTitle (those go in template)
    const body = providedBody || `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.6;">${bulletsHtmlSafe}${commentsHtml}</div>`;
    return { id: String(i.key).toLowerCase().replace(/[^a-z0-9]+/gi,'-'), color, icon, key: keyText, summary: summaryText, heading, url: i.url, body, status: i.status || '', description: displayTitle, bullets: picked };
  });

  // Generate AI-powered icons, bullets, closing statements, and summary for each item (async)
  const enrichedItems = await Promise.all(items.map(async (item) => {
    // Generate AI bullets (clean, business-focused, concise)
    const aiBullets = await generateBullets(openai, {
      summary: item.heading,
      status: item.status,
      description: item.heading,
      bullets: item.bullets || []
    });
    
    const aiIcon = await generateIcon(openai, {
      summary: item.heading,
      status: item.status,
      labels: [],
      bullets: item.bullets || []
    });
    const aiClosing = await generateClosingStatement(openai, {
      summary: item.heading,
      status: item.status,
      description: item.heading,
      bullets: item.bullets || []
    });
    const aiSummary = await generateCardSummary(openai, {
      summary: item.heading,
      status: item.status,
      description: item.heading,
      bullets: item.bullets || []
    });
    
    // Rebuild body with AI-generated bullets instead of original picked bullets
    const bulletsHtmlAi = aiBullets.length ? `<ul>${aiBullets.map(b=>`<li>${escapeHtml(b)}</li>`).join('')}</ul>` : '';
    const bodyWithAiBullets = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.6;">${bulletsHtmlAi}</div>`;
    
    return { 
      ...item, 
      bullets: aiBullets, 
      body: bodyWithAiBullets,
      icon: aiIcon, 
      closingStatement: aiClosing, 
      cardSummary: aiSummary 
    };
  }));

  const quickWins = (preview.quickWins || []).map(qw=>({ title: qw.key, description: qw.summary, resolutionDate: qw.resolutionDate, url: qw.url }));

  // Calculate balanced distribution: items + Quick Wins should be distributed evenly
  const totalItemsForToc = enrichedItems.length + 1; // +1 for Quick Wins
  const leftTocCount = Math.ceil(totalItemsForToc / 2);
  
  // Build TOC entries with matching AI icons (now available after enrichment)
  let tocEntries = enrichedItems.map(it=>({ id: it.id, icon: it.icon, heading: it.heading, done: isDoneStatus(it.status) }));
  // Add Quick Wins at the end
  tocEntries.push({ id: 'quick-wins', icon: '⚡', heading: 'Quick Wins' });
  
  // Split TOC entries balanced: left gets ceil(n/2), right gets floor(n/2)
  const tocLeft = tocEntries.slice(0, leftTocCount);
  const tocRight = tocEntries.slice(leftTocCount);

  // Split card items similarly for balanced visual layout
  const total = enrichedItems.length;
  const leftCount = Math.ceil(total / 2);
  const leftItems = enrichedItems.slice(0, leftCount);
  const rightItems = enrichedItems.slice(leftCount);

  // Derive dynamic title from the date field using the "next month" rule per instructions.md
  // If date is "2025-09-01", derive title as "October 2025 Engineering Newsletter"
  let dynamicTitle = preview.title || 'Engineering Update';
  if (preview.date) {
    const dateObj = dayjs(preview.date);
    if (dateObj.isValid()) {
      const nextMonth = dateObj.add(1, 'month').format('MMMM');
      const year = dateObj.year();
      dynamicTitle = `${nextMonth} ${year} Engineering Newsletter`;
    }
  }

  // Generate AI-powered Quick Wins section description
  const quickWinsDescription = await generateQuickWinsDescription(openai, preview.date);

  // Extract priorities section if present (editorial input). Otherwise auto-generate via AI.
  let prioritiesSection = preview.priorities ? {
    heading: preview.priorities.heading || 'Strategic Focus',
    content: preview.priorities.content || ''
  } : null;

  if (!prioritiesSection) {
    // Attempt to load cached priorities (keyed by preview.date) before calling AI
    try {
      const cacheKey = `priorities:${preview.date || 'unknown'}`;
      const cached = await cache.readCache(cacheKey);
      if (cached) {
        prioritiesSection = cached;
      } else {
        const aiPriorities = await generatePriorities(openai, preview);
        if (aiPriorities) {
          prioritiesSection = aiPriorities;
          // store in cache; TTL configurable via OPENAI_PRIORITIES_CACHE_DAYS (default 30)
          const ttl = parseInt(process.env.OPENAI_PRIORITIES_CACHE_DAYS || '30', 10) || 30;
          await cache.writeCache(cacheKey, aiPriorities, ttl);
        }
      }
    } catch (e) {
      // If generation or cache fails, we'll fall back to a deterministic summary below
      console.error('Auto priorities generation or cache failed:', e.message || e);
    }

    // Ensure we always have a prioritiesSection (fallback deterministic content)
    if (!prioritiesSection) {
      const issueCount = Array.isArray(preview.issues) ? preview.issues.length : 0;
      const quickCount = Array.isArray(preview.quickWins) ? preview.quickWins.length : 0;
      // derive simple focus nouns from titles (lightweight heuristics)
      const keywords = [];
      const titleText = (preview.issues || []).map(i => (i.summary || i.heading || '')).join(' ').toLowerCase();
      if (titleText.match(/customer|client|portal|app|mobile/)) keywords.push('customer experience');
      if (titleText.match(/performance|speed|latency|optimi/)) keywords.push('performance');
      if (titleText.match(/database|migration|cloud|infrastructure|scalab/)) keywords.push('infrastructure');
      if (titleText.match(/security|auth|sso|encryption/)) keywords.push('security');
      if (titleText.match(/payment|billing|invoice|revenue/)) keywords.push('payments');
      if (titleText.match(/automatio|ai|bot|workflow/)) keywords.push('automation');
      const focus = keywords.length ? keywords.slice(0,2).join(' and ') : 'customer impact and operational efficiency';

      prioritiesSection = {
        heading: 'Strategic Focus',
        content: `This period we focused on ${focus}, across ${issueCount} project(s) and ${quickCount} quick win(s), to deliver measurable business value and improve reliability.`
      };

      // write fallback to cache to avoid repeated null-generation attempts
      try{
        const ttl = parseInt(process.env.OPENAI_PRIORITIES_CACHE_DAYS || '30', 10) || 30;
        await cache.writeCache(cacheKey, prioritiesSection, ttl);
      }catch(e){/* ignore cache errors */}
    }
  }

  // Sanitize prioritiesSection strings (remove markdown artifacts like ** and trim)
  if (prioritiesSection && typeof prioritiesSection.heading === 'string') {
    prioritiesSection.heading = prioritiesSection.heading.replace(/\*\*/g, '').trim();
  }
  if (prioritiesSection && typeof prioritiesSection.content === 'string') {
    prioritiesSection.content = prioritiesSection.content.replace(/\*\*/g, '').trim();
  }

  return {
    title: dynamicTitle,
    author: preview.author || 'Engineering',
    date: preview.date || dayjs().format('MMMM D, YYYY'),
    prioritiesSection,
    tocLeft,
    tocRight,
    leftItems,
    rightItems,
    quickWins,
    quickWinsDescription
  };
}

export default { mapPreviewToTemplate };

