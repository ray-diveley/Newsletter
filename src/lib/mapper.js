import dayjs from 'dayjs';
import { cleanBulletLine, stripNames, capWords, extractTextFromADF } from './utils.js';
import { generateIcon, generateClosingStatement, generateQuickWinsDescription, generateCardSummary, generateBullets, generatePriorities, generateInvestmentNarrative, generateYearEndSummary } from './icon-generator.js';
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
 * Aggregate year statistics from JIRA issues
 */
function aggregateYearStats(issues) {
  // Use the categorizeIssue function defined below
  const categoryCounts = {};

  issues.forEach(issue => {
    // Map JIRA API fields to the format expected by categorizeIssue
    const mappedIssue = {
      _originalSummary: issue.fields?.summary || issue.summary || '',
      _originalLabels: issue.fields?.labels || [],
      _originalComments: [],
      summary: issue.fields?.summary || issue.summary || '',
      heading: issue.fields?.summary || issue.summary || '',
      description: issue.fields?.description?.content?.[0]?.content?.[0]?.text ||
                   issue.fields?.description ||
                   issue.description || '',
      status: issue.fields?.status?.name || issue.status || '',
      labels: issue.fields?.labels || []
    };

    const category = categorizeIssue(mappedIssue);
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  });

  const topCategory = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])[0];

  return {
    total: issues.length,
    topCategory: topCategory ? topCategory[0].replace(/_/g, ' ') : 'general improvements',
    topCategoryCount: topCategory ? topCategory[1] : 0,
    categories: categoryCounts
  };
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
  
  // Remove specific unwanted phrases (e.g., "1099 MISC copy")
  cleaned = cleaned.replace(/1099\s*MISC\s*copy/gi, '');
  
  // Clean up multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Categorize a JIRA issue based on its content
 */
function categorizeIssue(issue){
  const summary = issue._originalSummary || issue.summary || issue.heading || '';
  const status = issue.status || '';
  const labels = issue._originalLabels || [];
  const comments = issue._originalComments || [];
  const commentsText = comments.map(c => c.text || '').join(' ');
  const text = `${summary} ${status} ${issue.heading || ''} ${issue.description || ''} ${commentsText}`.toLowerCase();
  const labelText = labels.map(l=>String(l).toLowerCase()).join(' ');
  const has = (re) => re.test(text) || re.test(labelText);
  
  // Client Experience (portals, UI/UX, client-facing improvements, first experience) - check first as it's specific
  if (has(/client portal|customer portal|front[- ]end portal|user portal|self[- ]service|first experience/)) return 'client_experience';
  
  // Integration & APIs (third-party integrations, API work, major integration projects) - prioritize over product features
  if (has(/integration|\ api[\s\b]|sso|azure ad|authentication.*api|maven|hubspot|nexmo|dotdigital|third[- ]party|webhook|consent.*recording|expert.*network|authentication.*permission/)) return 'integration_apis';
  
  // Financial Systems (billing, payments, revenue, invoicing) - specific financial keywords
  if (has(/\bbilling\b|\binvoice\b|revenue|payment|pricing|\bfinance\b|financial system|discount program|incentive program|accrual/)) return 'financial_systems';
  
  // Internal Tools & Admin (admin panels, internal tooling, system management)
  if (has(/admin tool|contact management|\bcontact.{0,15}table|account management|client contact|master.*tool|duplicate|system tool|internal tool|crm|feasibility.*boost/)) return 'internal_tools';
  
  // Data & Analytics (reporting, data management, analytics tools)
  if (has(/\bdata\b.*tool|\breport|analytic|business intelligence|desk research|purchased data|centrali[sz]ed.*data|kpi|ad.*intel|m3mi/)) return 'data_analytics';
  
  // Product & Features (new offerings, major features, product development, platform products) - broader catch-all for products
  if (has(/bidding|dragonfly|audience.*dynamic|dynamic.*audience|wallet.*note|registration.*process|discount.*calculat|list.*match|qualstage|m3teor|verification.*tool|bulk.*email|campaign.*automat/)) return 'product_features';
  
  // Testing & Quality (UAT, testing, QA) - after feature categories so it doesn't override
  if (has(/\buat\b|user acceptance test|testing phase|test coverage|qa phase|quality assurance|bug fix.*phase|defect/)) return 'testing_quality';
  
  // Performance & Reliability (optimization, stability, performance)
  if (has(/performance|speed improvement|latency|optimi[zs]ation|scalab|throughput|efficiency gain|reliability|stability|monitor|uptime/)) return 'performance_reliability';
  
  // Infrastructure & Platform (migrations, architecture, platform work)
  if (has(/infrastructure|migration|upgrade.*platform|platform.*upgrade|architecture|moderni[zs]|docker|kubernetes|deployment.*automat|devops/)) return 'infrastructure_platform';
  
  // Security & Compliance (security, auth, compliance, risk)
  if (has(/security|encrypt|compliance|gdpr|risk.*assess|privacy|pci|vulnerability|audit|pen[- ]?test/)) return 'security_compliance';
  
  return 'general_improvements';
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
      url: i.url,
      description: i.description || ''
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
  const filteredSource = source.filter(s => !(Array.isArray(s.labels) && s.labels.map(l=>String(l).toLowerCase()).includes('internal')) && !String(s.summary).trim().includes('1099 MISC copy available in users account'));

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
    return { 
      id: String(i.key).toLowerCase().replace(/[^a-z0-9]+/gi,'-'), 
      color, 
      icon, 
      key: keyText, 
      summary: summaryText, 
      heading, 
      url: i.url, 
      body, 
      status: i.status || '', 
      description: i.description || '', 
      bullets: picked,
      // Preserve original data for categorization
      _originalSummary: i.summary,
      _originalLabels: i.labels,
      _originalComments: i.comments
    };
  });

  // Generate AI-powered icons, bullets, closing statements, and summary for each item (async)
  const usedIcons = new Set(); // Track icons to prevent duplicates
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
    }, usedIcons);
    const aiClosing = await generateClosingStatement(openai, {
      summary: item.heading,
      status: item.status,
      description: item.heading,
      bullets: item.bullets || []
    });
    
    // Custom closing for Shapiro Raj
    const closingStatement = item.heading.toLowerCase().includes('shapiro') ? 'These enhancements are creating a scalable model for onboarding future whitelabeled clients!' : aiClosing;
    
    // Custom summaries for specific projects (preferred descriptions)
    let customSummary = null;
    const headingLower = item.heading.toLowerCase();
    if (headingLower.includes('updated client contacts table') || headingLower.includes('client contacts')) {
      customSummary = 'Transforms client management by eliminating duplicates and introducing flexible account tagging that paves the way for our upcoming client portal.';
    } else if (headingLower.includes('list manager tool')) {
      customSummary = 'Consolidates recruitment list operations into a single, powerful hub that simplifies compliance tracking while accelerating project workflows.';
    } else if (headingLower.includes('shapiro')) {
      customSummary = "Establishes Shapiro + Raj's independent Qualstage environment with customized project management tools and enterprise-level security, creating our blueprint for future white-labeled partnerships.";
    } else if (headingLower.includes('dragonfly') || headingLower.includes('consent with recordings')) {
      customSummary = 'Delivers secure call recording and consent management that strengthens compliance while improving client transparency and trust.';
    } else if (headingLower.includes('dynamic audience')) {
      customSummary = 'Intelligently surfaces only relevant questions based on audience selection, cutting through survey complexity to make data collection faster and more intuitive.';
    } else if (headingLower.includes('client portal')) {
      customSummary = 'Introduces our M3GR-branded client portal with unified single sign-on, creating a seamless hub where clients access all project resources across platforms.';
    } else if (headingLower.includes('bidding 2.3')) {
      customSummary = 'Reimagines pricing management with an intuitive new interface that improves accuracy and catches errors before they impact operations.';
    } else if (headingLower.includes('automatic discount')) {
      customSummary = 'Automates discount calculations to eliminate manual errors and boost profitability, freeing teams from spreadsheet complexity to focus on strategic work.';
    } else if (headingLower.includes('expert networks')) {
      customSummary = 'Expands consulting opportunities while automating payment workflows, giving experts better visibility and a smoother path from opportunity to compensation.';
    }
    
    const aiSummary = await generateCardSummary(openai, {
      summary: item.heading,
      status: item.status,
      description: item.description,
      bullets: item.bullets || []
    });
    
    const finalSummary = customSummary || aiSummary;
    
    // Rebuild body with AI-generated bullets instead of original picked bullets
    const bulletsHtmlAi = aiBullets.length ? `<ul>${aiBullets.map(b=>`<li>${escapeHtml(b)}</li>`).join('')}</ul>` : '';
    const bodyWithAiBullets = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#333;line-height:1.6;">${bulletsHtmlAi}</div>`;
    
    return { 
      ...item, 
      bullets: aiBullets, 
      body: bodyWithAiBullets,
      icon: aiIcon, 
      closingStatement: closingStatement, 
      cardSummary: finalSummary 
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
  // If date is "2025-12-01", derive title as "January 2026 Engineering Newsletter"
  let dynamicTitle = 'Engineering Update';
  if (preview.date) {
    const dateObj = dayjs(preview.date);
    if (dateObj.isValid()) {
      const nextMonthObj = dateObj.add(1, 'month');
      const nextMonth = nextMonthObj.format('MMMM');
      const year = nextMonthObj.year(); // Use the year from the next month
      dynamicTitle = `${nextMonth} ${year} Engineering Newsletter`;
    }
  } else if (preview.title) {
    // Only use preview.title if no date is available
    dynamicTitle = preview.title;
  }

  // Generate AI-powered Quick Wins section description
  const quickWinsDescription = await generateQuickWinsDescription(openai, preview.date);

  // ---------------- Impact / Investment Overview Section ----------------
  // Categorize each enriched item to show where engineering effort is going.
  const categoryMeta = {
    product_features: { label: 'Product & Features', color: '#0b79ff' },
    client_experience: { label: 'Client Experience', color: '#17a2b8' },
    integration_apis: { label: 'Integration & APIs', color: '#6610f2' },
    data_analytics: { label: 'Data & Analytics', color: '#20c997' },
    financial_systems: { label: 'Financial Systems', color: '#f39c12' },
    internal_tools: { label: 'Internal Tools & Admin', color: '#6c757d' },
    performance_reliability: { label: 'Performance & Reliability', color: '#28a745' },
    infrastructure_platform: { label: 'Infrastructure & Platform', color: '#8e44ad' },
    security_compliance: { label: 'Security & Compliance', color: '#e74c3c' },
    testing_quality: { label: 'Testing & Quality', color: '#fd7e14' },
    general_improvements: { label: 'General Improvements', color: '#95a5a6' }
  };

  const categoryCounts = {};
  // Attach category metadata to each enriched item for display
  enrichedItems.forEach(it=>{
    const c = categorizeIssue(it);
    it.category = c;
    it.categoryLabel = categoryMeta[c]?.label || 'General';
    it.categoryColor = categoryMeta[c]?.color || '#95a5a6';
    categoryCounts[c] = (categoryCounts[c]||0)+1;
  });
  const totalCategorized = enrichedItems.length || 1; // avoid div/0
  const categoriesArray = Object.keys(categoryMeta)
    .filter(k => categoryCounts[k])
    .map(k => {
      const count = categoryCounts[k];
      const percent = +( (count / totalCategorized) * 100 ).toFixed(1);
      // Calculate bar height for table-based visualization (minimum 8px for visibility, max 140px total)
      const barHeight = Math.max(8, Math.round((percent / 100) * 140));
      return { key: k, label: categoryMeta[k].label, color: categoryMeta[k].color, count, percent, barHeight };
    })
    .sort((a,b)=> b.percent - a.percent);

  // Build pie chart paths (SVG) using arc segments.
  function buildPiePaths(cats){
    const paths = [];
    let cumulative = 0; // in degrees
    cats.forEach(cat => {
      const startAngle = cumulative;
      const sweep = (cat.percent/100) * 360;
      const endAngle = cumulative + sweep;
      cumulative += sweep;
      // Convert polar to cartesian
      const cx = 60, cy = 60, r = 55;
      const polar = (angleDeg) => {
        const rad = (angleDeg - 90) * Math.PI/180; // start from top
        return { x: cx + (r * Math.cos(rad)), y: cy + (r * Math.sin(rad)) };
      };
      const start = polar(startAngle);
      const end = polar(endAngle);
      const largeArcFlag = sweep > 180 ? 1 : 0;
      const d = `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
      paths.push({ d, color: cat.color, label: cat.label, percent: cat.percent });
    });
    return paths;
  }
  const piePaths = buildPiePaths(categoriesArray);

  // AI-powered narrative (explains business rationale for investment distribution)
  const investmentNarrative = await generateInvestmentNarrative(openai, categoriesArray, enrichedItems.length);

  const investmentOverview = categoriesArray.length ? {
    totalIssues: enrichedItems.length,
    categories: categoriesArray,
    piePaths,
    narrative: investmentNarrative
  } : null;

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
    investmentOverview,
    yearEndSummary: preview.yearEndSummary || null,
    tocLeft,
    tocRight,
    leftItems,
    rightItems,
    quickWins: (preview.quickWins || []).map(qw => ({
      title: qw.key,
      description: qw.summary
    })),
    quickWinsDescription
  };
}

export { aggregateYearStats };
export default { mapPreviewToTemplate, aggregateYearStats };

