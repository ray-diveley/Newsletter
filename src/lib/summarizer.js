import { randomInt, cleanBulletLine, capWords, stripNames } from './utils.js';

export async function summarizeExecutive(openai, issue, comments){
  if(!openai || comments.length===0) return [];
  const text = comments.map(c=>`- ${c.text}`).join('\n');
  const prompt = `
Summarize these notes into 3–5 concise bullets for an internal engineering newsletter.
- Combine overlapping points where possible
- No leading "-" or "*"
- Use **labels** like **Key highlight:** when helpful
- Keep it positive, specific, and non-technical

Issue: ${issue.key} — ${issue.summary}
Notes:
${stripNames(text)}`.trim();

  try{
    const resp = await openai.chat.completions.create({
      model:'gpt-4o-mini', temperature:0.4,
      messages:[{ role:'system', content:'Return a short set of 3–5 crisp bullets.' },{ role:'user', content: prompt }]
    });
    let bullets = resp.choices[0].message.content
      .split('\n').map(l=>l.trim()).filter(Boolean);

    // Randomize count between 3–5
    const target = randomInt(3, Math.min(5, bullets.length));
    if (bullets.length > target) {
      bullets = bullets.slice(0, target);
    }

    return bullets.map(cleanBulletLine);
  }catch(e){ console.error('OpenAI bullets:', e?.message || e); return []; }
}

export async function summarizeOneLiner(openai, issue, comments){
  if(!openai || comments.length===0) return '';
  const text = stripNames(comments.map(c=>c.text).join(' '));
  const prompt = `
One short, positive headline (≤15 words) for a newsletter.
No names. Focus on progress or value delivered.
Issue: ${issue.key} — ${issue.summary}
From notes: ${text}`.trim();
  try{
    const r = await openai.chat.completions.create({
      model:'gpt-4o-mini', temperature:0.3,
      messages:[{ role:'system', content:'Return exactly one upbeat sentence, ≤15 words.' },
                { role:'user', content: prompt }]
    });
    return capWords(r.choices[0].message.content.replace(/^[\-\*\s]+/, '').trim(), 15);
  }catch(e){ console.error('OpenAI one-liner:', e?.message || e); return ''; }
}
