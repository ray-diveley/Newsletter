import fs from 'fs';
import { mapPreviewToTemplate } from '../src/lib/mapper.js';

async function run(){
  const raw = fs.readFileSync(new URL('../newsletter.example.json', import.meta.url));
  const preview = JSON.parse(raw.toString());
  const result = await mapPreviewToTemplate(preview, null); // pass null to avoid OpenAI calls in smoke test
  if(!result || !result.investmentOverview){
    console.error('Investment overview missing in mapper output');
    process.exit(1);
  }
  if(!result.prioritiesSection){
    console.error('Priorities section missing');
    process.exit(1);
  }
  if(!Array.isArray(result.leftItems) || !Array.isArray(result.rightItems)){
    console.error('Left/right item columns not produced');
    process.exit(1);
  }
  console.log('Smoke test passed: structure looks good.');
}

run().catch(e=>{ console.error(e); process.exit(1); });
