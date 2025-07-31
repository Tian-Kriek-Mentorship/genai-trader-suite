// interestRates.js

const INTEREST_CACHE_KEY = 'interest_rates_cache';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Loads cached interest rates from localStorage.
 */
function loadCachedRates() {
  try {
    const s = localStorage.getItem(INTEREST_CACHE_KEY);
    if (!s) return null;
    const o = JSON.parse(s);
    if (Date.now() - o.ts > CACHE_TTL) {
      localStorage.removeItem(INTEREST_CACHE_KEY);
      return null;
    }
    return o.data || null;
  } catch {
    return null;
  }
}

/**
 * Saves interest rates to localStorage with a timestamp.
 */
function saveCachedRates(data) {
  try {
    localStorage.setItem(INTEREST_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

/**
 * Loads interest rates from Twelve Data or returns from cache if fresh.
 * Appends them to your UI if a container with ID "interestRates" exists.
 */
export async function loadInterestRates() {
  const cached = loadCachedRates();
  if (cached) {
    renderRates(cached);
    return;
  }

  try {
    const res = await fetch('https://api.twelvedata.com/interest_rate?apikey=1eed79e08f4a4d6092a9b4e634c3bbf8');
    const json = await res.json();
    const data = json?.data || [];
    saveCachedRates(data);
    renderRates(data);
  } catch (e) {
    console.warn('Interest rate fetch failed', e);
  }
}

/**
 * Renders interest rates into the page (if applicable).
 */
function renderRates(rates) {
  const el = document.getElementById('interestRates');
  if (!el) return;

  el.innerHTML = '';
  for (const rate of rates) {
    const div = document.createElement('div');
    div.textContent = `${rate.country}: ${rate.interest_rate}%`;
    el.appendChild(div);
  }
}
