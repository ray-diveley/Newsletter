#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import OpenAI from 'openai';
import 'dotenv/config';
import { renderNewsletter } from '../src/lib/render.js';
import { mapPreviewToTemplate } from '../src/lib/mapper.js';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

function usage(){
  console.log('Usage: node scripts/generate-newsletter.mjs [--input file.json] [--out file.html] [--url "http://localhost:3100/preview?from=...&to=..."]');
}

async function main(){
  const args = process.argv.slice(2);
  let inputFile = 'newsletter.json';
  let outFile = 'newsletter.html';
  let url = null;

  for(let i=0;i<args.length;i++){
    const a = args[i];
    if(a==='--input' && args[i+1]){ inputFile = args[++i]; }
    else if(a==='--out' && args[i+1]){ outFile = args[++i]; }
    else if(a==='--url' && args[i+1]){ url = args[++i]; }
    else if(a==='--help' || a==='-h'){ usage(); return; }
  }

  let data = null;
  if(url){
    // If using the live preview URL, ensure it contains both from and to and map
    console.log('Fetching preview JSON from', url);
    const parsed = new URL(url);
    if (!parsed.searchParams.has('from') || !parsed.searchParams.has('to')){
      throw new Error('When using --url you must include from and to query parameters, e.g. ?from=2025-09-01&to=2025-09-30');
    }
    const r = await axios.get(url, { responseType: 'json' });
  const preview = r.data;
  // Map preview shape -> template shape expected by Handlebars (with OpenAI enrichment)
  data = await mapPreviewToTemplate(preview, openai);
  } else {
    const p = path.resolve(process.cwd(), inputFile);
    console.log('Reading JSON from', p);
    const raw = await fs.readFile(p, 'utf8');
    const parsed = JSON.parse(raw);
    // If parsed JSON isn't already in the template shape, map it
    if (!parsed.leftItems || !parsed.rightItems) {
      data = await mapPreviewToTemplate(parsed, openai);
    } else {
      data = parsed;
    }
  }

  const html = await renderNewsletter(data);
  const outPath = path.resolve(process.cwd(), outFile);
  await fs.writeFile(outPath, html, 'utf8');
  console.log('Wrote', outPath);
}



main().catch(e=>{
  console.error('Error:', e.message || e);
  process.exit(1);
});

