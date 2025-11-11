export function parseDateParam(p){ if(!p) return null; const d=new Date(p); return Number.isNaN(d.getTime())?null:d; }
export function isWithinInclusive(dateStr, from, to){
  if(!dateStr) return false; const d=new Date(dateStr); if(Number.isNaN(d.getTime())) return false;
  if(from && d<from) return false; if(to && d>to) return false; return true;
}
export function extractTextFromADF(node){
  if(!node) return '';
  if(Array.isArray(node)) return node.map(extractTextFromADF).join('');
  if(typeof node==='object'){ const {type,text,content=[]}=node; if(type==='text') return text||''; return content.map(extractTextFromADF).join(''); }
  return '';
}
export function cleanBulletLine(s){ return s.replace(/^\s*[-*]\s*/, '').trim(); }
export function stripNames(text){
  return text.replace(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g, '[team]');
}
export function capWords(s, maxWords=15){
  const parts = s.split(/\s+/).filter(Boolean);
  return parts.slice(0, maxWords).join(' ') + (parts.length>maxWords ? '…' : '');
}
export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
