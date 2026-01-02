import 'dotenv/config';
import path from 'path';
import fs from 'fs/promises';
import express from 'express';
import dayjs from 'dayjs';
import { fileURLToPath } from 'url';
import axios from 'axios';
import OpenAI from 'openai';
// ...existing code...
import { parseDateParam, isWithinInclusive, extractTextFromADF, cleanBulletLine, stripNames, capWords, randomInt } from './lib/utils.js';
import { buildJql, searchAllIssues } from './lib/jira.js';
import { summarizeExecutive, summarizeOneLiner } from './lib/summarizer.js';
import { mapPreviewToTemplate, aggregateYearStats } from './lib/mapper.js';
import { generateYearEndSummary } from './lib/icon-generator.js';
import { renderNewsletter } from './lib/render.js';
import Handlebars from 'handlebars';

// Register Handlebars helpers
Handlebars.registerHelper('gt', function(a, b) {
  return a > b;
});

Handlebars.registerHelper('gte', function(a, b) {
  return a >= b;
});

Handlebars.registerHelper('lt', function(a, b) {
  return a < b;
});

Handlebars.registerHelper('eq', function(a, b) {
  return a === b;
});

// ----- ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ...existing code...




const app = express();
const port = process.env.PORT || 3100;

// Serve static files (CSS, etc.) from public directory
app.use(express.static(path.resolve(__dirname, '..', 'public')));

// ----- Env
const email = process.env.JIRA_EMAIL;
const apiToken = process.env.JIRA_API_TOKEN;
const domain = process.env.JIRA_DOMAIN; 
const defaultProjectKeys = (process.env.JIRA_PROJECT_KEY || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const defaultStatuses = (process.env.JIRA_STATUSES || 'In Progress,UAT,Done')
  .split(',').map(s => s.trim()).filter(Boolean);

// Quick Wins configuration
const quickWinsProjects = (process.env.QUICK_WINS_PROJECTS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const quickWinsIssueType = process.env.QUICK_WINS_ISSUE_TYPE || 'Quick Wins';

const auth = email && apiToken ? Buffer.from(`${email}:${apiToken}`).toString('base64') : null;
const missingJiraEnv = !email || !apiToken || !domain;

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// NOTE: Utility, Jira and summarizer logic has been moved to `src/lib/*` for clarity.

// ---------- Routes
app.get('/health', (_req,res)=>res.json({ok:true}));
app.get('/', (_req, res) => {
  // Simple landing page that requires the user to enter a "from" and "to" date
  // before browsing to /preview. This prevents accidentally hitting /preview
  // without a date range.
  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Newsletter Preview — Enter Dates</title>
    <style>
      body{font-family:Arial,Helvetica,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f6f8fb;margin:0}
      .card{background:#fff;padding:24px;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.08);max-width:520px;width:100%}
      label{display:block;margin:12px 0 6px;font-weight:600}
      input[type="date"]{padding:8px 10px;font-size:16px;width:100%;box-sizing:border-box}
      .row{display:flex;gap:12px}
      .row>div{flex:1}
      .actions{margin-top:18px;display:flex;gap:8px;align-items:center}
      button{background:#0366d6;color:#fff;padding:10px 14px;border-radius:6px;border:0;cursor:pointer}
      .note{color:#555;font-size:13px}
    </style>
  </head>
  <body>
    <div class="card">
      <h2>Newsletter Preview</h2>
      <p class="note">Please select a <strong>From</strong> and <strong>To</strong> date to create the preview.</p>
      <form id="dateForm" action="/preview.html" method="get">
        <div class="row">
          <div>
            <label for="from">From</label>
            <input id="from" name="from" type="date" required />
          </div>
          <div>
            <label for="to">To</label>
            <input id="to" name="to" type="date" required />
          </div>
        </div>

  <!-- Project selector removed (not used) -->

        <div class="actions">
          <button type="submit">Preview</button>
          <a href="/health" style="color:#0366d6;text-decoration:none;align-self:center">Health</a>
        </div>
      </form>

      <script>
        const form = document.getElementById('dateForm');
        form.addEventListener('submit', (e)=>{
          const from = document.getElementById('from').value;
          const to = document.getElementById('to').value;
          if(!from || !to){
            e.preventDefault();
            alert('Please provide both From and To dates.');
            return;
          }
          const f = new Date(from);
          const t = new Date(to);
          if(f>t){
            e.preventDefault();
            alert('The From date must be the same or earlier than the To date.');
            return;
          }
          // All good — form will submit as GET to /preview with from/to params
        });
      </script>
    </div>
  </body>
  </html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// Preview JSON
app.get('/preview', async (req,res)=>{
  try{
    // Require explicit from and to dates to avoid running large queries accidentally.
    const fromRaw = req.query.from?.toString();
    const toRaw = req.query.to?.toString();
    if (!fromRaw || !toRaw) {
      return res.status(400).json({
        error: 'Please provide both `from` and `to` date query parameters in YYYY-MM-DD format. Example: /preview?from=2025-09-01&to=2025-09-30'
      });
    }

    const from = parseDateParam(fromRaw);
    const to = parseDateParam(toRaw);
    console.log(`Parsed dates: from=${from}, to=${to}, from.getMonth()=${from?.getMonth()}, fromRaw=${fromRaw}`);
    if (!from || !to) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD for both `from` and `to`.' });
    }
    // If `to` was passed as YYYY-MM-DD, treat it as inclusive end of day.
    if (/^\d{4}-\d{2}-\d{2}$/.test(toRaw)) to.setHours(23,59,59,999);
    if (from > to) {
      return res.status(400).json({ error: '`from` must be the same or earlier than `to`.' });
    }

    const projectKeys = (req.query.project?.toString()||'').split(',').map(s=>s.trim()).filter(Boolean);
    const finalProjects = projectKeys.length ? projectKeys : defaultProjectKeys;

    const statusesParam = (req.query.statuses?.toString()||'').split(',').map(s=>s.trim()).filter(Boolean);
    const finalStatuses = statusesParam.length ? statusesParam : defaultStatuses;

    if (missingJiraEnv){
      return res.json({
        title:req.query.title||'Engineering Update',
        author:req.query.author||'Engineering',
        date:dayjs().format('MMMM D, YYYY'),
        issues:[{ heading:'Setup', body:'Configure JIRA_EMAIL, JIRA_API_TOKEN, JIRA_DOMAIN, and optionally JIRA_PROJECT_KEY.' }]
      });
    }

    // --- Main Issues
    const jql = buildJql(finalProjects, finalStatuses);
  const issues = await searchAllIssues(domain, auth, jql);

    const results = await Promise.all(issues.map(async (i)=>{
      const statusName = i.fields?.status?.name || '';
      const resolutionDate = i.fields?.resolutiondate || null;
      const statusChangedDate = i.fields?.statuscategorychangedate || null;

      const r = await axios.get(`https://${domain}/rest/api/3/issue/${i.key}/comment`,{
        headers:{ Authorization:`Basic ${auth}`, Accept:'application/json' }
      });
      const filtered = (r.data.comments||[]).filter(c=>{
        const created = new Date(c.created);
        if (from && created < from) return false;
        if (to && created > to) return false;
        return true;
      });
      const comments = filtered.map(c=>({
        author: c.author?.displayName ?? 'Unknown',
        created: dayjs(c.created).format('YYYY-MM-DD HH:mm'),
        text: extractTextFromADF(c.body)
      }));

      let include = false;
      if (statusName.toLowerCase()==='done'){
        include = isWithinInclusive(resolutionDate, from, to) ||
                  (!resolutionDate && isWithinInclusive(statusChangedDate, from, to));
      } else {
        include = comments.length > 0;
      }

      let bullets = [];
      let oneLiner = '';
      if (include){
        bullets = await summarizeExecutive(
          openai,
          { key:i.key, summary:i.fields?.summary ?? '(no summary)' },
          comments
        );
        oneLiner = await summarizeOneLiner(
          openai,
          { key:i.key, summary:i.fields?.summary ?? '(no summary)' },
          comments
        );
      }

      return {
        include,
        key: i.key,
        summary: i.fields?.summary ?? '(no summary)',
        status: statusName,
        resolutionDate,
        labels: i.fields?.labels || [], // Add this line
        comments,
        bullets,
        oneLiner,
        url: `https://${domain}/browse/${i.key}`,
        description: extractTextFromADF(i.fields?.description)
      };
    }));

    const filtered = results.filter(r=>r.include && !(r.labels || []).map(l=>String(l).toLowerCase()).includes('internal'));
    // ...existing code...


    // --- Quick Wins Section (Fixed)
    let quickWinItems = [];
    if (quickWinsProjects.length > 0) {
      try {
        const projectsClause = quickWinsProjects.length === 1 
          ? `project = "${quickWinsProjects[0]}"` 
          : `project IN (${quickWinsProjects.map(p => `"${p}"`).join(', ')})`;
        
        const quickWinsJql = `${projectsClause} AND type = "${quickWinsIssueType}" AND resolutiondate >= -30d ORDER BY resolved DESC`;
        console.log('Quick Wins JQL:', quickWinsJql); // Debug logging
        
  const quickWins = await searchAllIssues(domain, auth, quickWinsJql);
        quickWinItems = quickWins.map(qw => ({
          key: qw.key,
          summary: qw.fields?.summary ?? '(no summary)',
          resolutionDate: qw.fields?.resolutiondate || null,
          url: `https://${domain}/browse/${qw.key}`
        }));
      } catch (quickWinError) {
        console.error('Error fetching Quick Wins:', quickWinError.response?.data || quickWinError.message);
        // Continue without quick wins data instead of failing the entire request
      }
    }

    // --- Year-End Summary (for December newsletters)
    let yearEndSummary = null;
    // Check if fromRaw is December (avoid timezone issues) - now checking for 2025-12 to show 2025 year-end stats
    const isDecember = fromRaw && fromRaw.startsWith('2025-12');
    console.log(`Date check: from=${from}, fromRaw=${fromRaw}, isDecember=${isDecember}, finalProjects=${finalProjects.length}`);
    
    if (isDecember && finalProjects.length > 0) {
      try {
        console.log('Fetching year-end stats...');
        
        // Fetch 2024 and 2025 completed issues in parallel
        const projectsClause = finalProjects.length === 1 
          ? `project = ${finalProjects[0]}` 
          : `project IN (${finalProjects.join(', ')})`;
        
        // Use statusCategory = Done and statusCategoryChangedDate (correct JIRA field names)
        const jql2024 = `${projectsClause} AND statusCategory = Done AND statusCategoryChangedDate >= "2024-01-01" AND statusCategoryChangedDate <= "2024-12-31"`;
        const jql2025 = `${projectsClause} AND statusCategory = Done AND statusCategoryChangedDate >= "2025-01-01" AND statusCategoryChangedDate <= "2025-12-31"`;
        
        console.log('Year-end JQL 2024:', jql2024);
        console.log('Year-end JQL 2025:', jql2025);
        
        // Fetch only project stats (skip bugs and quick wins to avoid rate limiting)
        const [issues2024, issues2025] = await Promise.all([
          searchAllIssues(domain, auth, jql2024),
          searchAllIssues(domain, auth, jql2025)
        ]);

        console.log(`Year stats fetched: 2024=${issues2024.length}, 2025=${issues2025.length}`);

        // Use actual values provided by user
        const actualQuickWins2024 = 46;
        const actualQuickWins2025 = 51;
        const actualBugs2024 = 1185;
        const actualBugs2025 = 1330;
        console.log(`Using provided counts: QuickWins 2024=${actualQuickWins2024}, 2025=${actualQuickWins2025}, Bugs 2024=${actualBugs2024}, 2025=${actualBugs2025}`);
        
        const stats2024 = aggregateYearStats(issues2024);
        const stats2025 = aggregateYearStats(issues2025);
        
        const summary = await generateYearEndSummary(openai, stats2024, stats2025);
        
        const growth = stats2024.total > 0 ? Math.round(((stats2025.total - stats2024.total) / stats2024.total) * 100) : 0;
        const quickWinsGrowth = actualQuickWins2024 > 0 ? Math.round(((actualQuickWins2025 - actualQuickWins2024) / actualQuickWins2024) * 100) : 0;
        const bugsChange = actualBugs2025 - actualBugs2024;
        const bugsChangePercent = actualBugs2024 > 0 ? Math.round((bugsChange / actualBugs2024) * 100) : 0;

        // Calculate percentage for bar chart (2024 relative to 2025)
        const maxProjects = Math.max(stats2024.total, stats2025.total);
        const year2024Percent = maxProjects > 0 ? Math.round((stats2024.total / maxProjects) * 100) : 0;

        // Extract top 10 categories from 2025 with their counts
        const top2025Categories = Object.entries(stats2025.categories)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([key, count]) => ({
            name: key.replace(/_/g, ' '),
            count: count,
            percent: stats2025.total > 0 ? Math.round((count / stats2025.total) * 100) : 0
          }));

        yearEndSummary = {
          year2024: stats2024.total,
          year2025: stats2025.total,
          year2024Percent: year2024Percent,
          growth: growth,
          narrative: summary.narrative,
          topCategory2024: stats2024.topCategory,
          topCategory2025: stats2025.topCategory,
          topCategories2025: top2025Categories,
          quickWins2024: actualQuickWins2024,
          quickWins2025: actualQuickWins2025,
          quickWinsGrowth: quickWinsGrowth,
          bugs2024: actualBugs2024,
          bugs2025: actualBugs2025,
          bugsChange: bugsChange,
          bugsChangePercent: bugsChangePercent
        };
      } catch (yearError) {
        console.error('Error fetching year-end stats:', yearError.message);
        // Continue without year-end data
      }
    }

    // --- Final Response
    const response = {
      title: req.query.title || 'Engineering Update',
      author: req.query.author || 'Engineering',
      date: fromRaw, // Use the "from" date in YYYY-MM-DD format for correct title derivation
      issues: filtered,
      quickWins: quickWinItems,
      yearEndSummary: yearEndSummary
    };

    // Add priorities if provided as query parameters
    if (req.query.prioritiesHeading || req.query.prioritiesContent) {
      response.priorities = {
        heading: req.query.prioritiesHeading || 'Strategic Focus',
        content: req.query.prioritiesContent || ''
      };
    }

    res.json(response);
  }catch(err){
    console.error('Error fetching Jira data:', err.response?.data || err.message);
    res.status(500).json({ error: 'Error fetching Jira data.' });
  }
});
// ...existing code...

// ...existing code...


// Serve generated newsletter HTML (if present) and raw HTML for easy copy/paste
app.get('/newsletter', async (_req, res) => {
  try {
    const filePath = path.resolve(__dirname, '..', 'newsletter.html');
    // sendFile will set correct HTML content-type
    return res.sendFile(filePath);
  } catch (err) {
    console.error('Error serving newsletter:', err.message || err);
    return res.status(404).send('newsletter.html not found. Generate it first with scripts/generate-newsletter.mjs');
  }
});

app.get('/newsletter/source', async (_req, res) => {
  try {
    const filePath = path.resolve(__dirname, '..', 'newsletter.html');
    const txt = await fs.readFile(filePath, 'utf8');
    res.type('text/plain').send(txt);
  } catch (err) {
    console.error('Error serving newsletter source:', err.message || err);
    return res.status(404).send('newsletter.html not found. Generate it first with scripts/generate-newsletter.mjs');
  }
});


// Rendered preview HTML directly from preview JSON
app.get('/preview.html', async (req, res) => {
  try {
    // Keep the same validation rules as /preview: require from & to
    const fromRaw = req.query.from?.toString();
    const toRaw = req.query.to?.toString();
    if (!fromRaw || !toRaw) {
      return res.status(400).send('Please provide both `from` and `to` query parameters in YYYY-MM-DD format.');
    }

    // Call the existing /preview endpoint on this server to get the JSON payload
    const protocol = req.protocol;
    const host = req.get('host');
    const url = `${protocol}://${host}/preview?${Object.keys(req.query).map(k=>`${encodeURIComponent(k)}=${encodeURIComponent(req.query[k])}`).join('&')}`;
    const r = await axios.get(url, { responseType: 'json' });
    const preview = r.data;

    // Map preview to template shape and render
    const data = await mapPreviewToTemplate(preview, openai);
    // Theme selection: default (base) or cool
    const theme = (req.query.theme || 'base').toString();
    if (theme === 'cool') {
      try {
        const coolPath = path.resolve(__dirname, 'templates', 'cool.hbs');
        const tplSrc = await fs.readFile(coolPath, 'utf8');
        const tpl = Handlebars.compile(tplSrc);
        const html = tpl(data);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(html);
      } catch (e) {
        console.error('Failed to render cool theme, falling back to base:', e.message || e);
      }
    }

    const html = await renderNewsletter(data); // base theme fallback
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Error rendering preview HTML:', err.response?.data || err.message || err);
    res.status(500).send('Failed to render preview HTML. See server logs for details.');
  }
});


app.listen(port, ()=>console.log(`Newsletter API running at http://localhost:${port}`));