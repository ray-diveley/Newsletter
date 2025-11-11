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
import { mapPreviewToTemplate } from './lib/mapper.js';
import { renderNewsletter } from './lib/render.js';



// ----- ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ...existing code...




const app = express();
const port = process.env.PORT || 3100;

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
        url: `https://${domain}/browse/${i.key}`
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
        
        const quickWinsJql = `${projectsClause} AND issuetype = "${quickWinsIssueType}" AND resolutiondate >= -4w ORDER BY resolutiondate DESC`;
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

    // --- Final Response
    const response = {
      title: req.query.title || 'Engineering Update',
      author: req.query.author || 'Engineering',
      date: fromRaw, // Use the "from" date in YYYY-MM-DD format for correct title derivation
      issues: filtered,
      quickWins: quickWinItems
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
    const html = await renderNewsletter(data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Error rendering preview HTML:', err.response?.data || err.message || err);
    res.status(500).send('Failed to render preview HTML. See server logs for details.');
  }
});


app.listen(port, ()=>console.log(`Newsletter API running at http://localhost:${port}`));