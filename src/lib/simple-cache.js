import fs from 'fs/promises';
import path from 'path';

const CACHE_DIR = path.join(process.cwd(), '.cache');

async function ensureCacheDir(){
  try{ await fs.mkdir(CACHE_DIR, { recursive: true }); }catch(e){}
}

function cacheFilePath(key){
  // sanitize key for filename
  const safe = key.replace(/[^a-z0-9-_\.]/gi,'-');
  return path.join(CACHE_DIR, `${safe}.json`);
}

export async function readCache(key){
  try{
    const p = cacheFilePath(key);
    const raw = await fs.readFile(p, 'utf8');
    const obj = JSON.parse(raw);
    // check expiry
    if (obj.expiresAt && Date.now() > obj.expiresAt) {
      try{ await fs.unlink(p); }catch(e){}
      return null;
    }
    return obj.value;
  }catch(e){ return null; }
}

export async function writeCache(key, value, ttlDays = 7){
  try{
    await ensureCacheDir();
    const p = cacheFilePath(key);
    const payload = { value, expiresAt: Date.now() + ttlDays * 24 * 60 * 60 * 1000 };
    await fs.writeFile(p, JSON.stringify(payload, null, 2), 'utf8');
    return true;
  }catch(e){ console.error('Cache write failed:', e.message || e); return false; }
}

export default { readCache, writeCache };
