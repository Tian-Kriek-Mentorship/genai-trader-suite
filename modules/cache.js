// modules/cache.js

const CACHE_KEY = 'gtm_cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export function loadCache() {
  try {
    const s = localStorage.getItem(CACHE_KEY);
    if (!s) return {};
    const o = JSON.parse(s);
    if (Date.now() - o.ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return {};
    }
    return o.data || {};
  } catch {
    return {};
  }
}

export function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}
