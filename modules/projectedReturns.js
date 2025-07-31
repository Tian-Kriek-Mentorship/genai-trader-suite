import axios from 'axios';
import { loadCache, saveCache } from './cache.js';
import { cryptoSymbols, forexSymbols } from './symbols.js';

const API_KEY = window.TD_API_KEY;

function toTDSymbol(sym) {
  if (cryptoSymbols.includes(sym)) return null;
  if (forexSymbols.includes(sym)) return `${sym.slice(0, 3)}/${sym.slice(3)}`;
  return sym;
}

export async function getProjectedAnnualReturn(sym) {
  const sc = loadCache();
  sc[sym] = sc[sym] || {};
  const info = sc[sym].projInfo;

  const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

  if (info && typeof info.proj === 'number' && (Date.now() - info.ts) < MONTH_MS) {
    return info.proj;
  }

  let cagr = null;

  if (cryptoSymbols.includes(sym)) {
    try {
      const resp = await axios.get('https://api.binance.com/api/v3/klines', {
        params: { symbol: sym, interval: '1M', limit: 60 }
      });
      const d = resp.data;
      const first = parseFloat(d[0][4]), last = parseFloat(d[d.length - 1][4]);
      const yrs = (d.length - 1) / 12;
      cagr = Math.pow(last / first, 1 / yrs) - 1;
    } catch {
      cagr = null;
    }
  } else {
    try {
      const tdSym = toTDSymbol(sym);
      const r = await axios.get('https://api.twelvedata.com/time_series', {
        params: {
          symbol: tdSym,
          interval: '1month',
          outputsize: 60,
          apikey: API_KEY
        }
      });
      if (r.data.status === 'error') throw new Error(r.data.message);
      const vals = (r.data.values || []).slice().reverse();
      if (vals.length > 1) {
        const rets = [];
        for (let i = 1; i < vals.length; i++) {
          const prev = parseFloat(vals[i - 1].close),
                cur  = parseFloat(vals[i].close);
          rets.push(cur / prev - 1);
        }
        const avgM = rets.reduce((a, b) => a + b, 0) / rets.length;
        cagr = Math.pow(1 + avgM, 12) - 1;
      }
    } catch {
      cagr = null;
    }
  }

  sc[sym].projInfo = { proj: cagr, ts: Date.now() };
  saveCache(sc);

  return cagr;
}
