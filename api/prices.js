// /api/prices.js
import axios from 'axios';

const CACHE = {
  ts: 0,
  data: null,
};
const TTL = 60*60*1000;  // 1 hour

export default async function handler(req, res) {
  const now = Date.now();

  // 1) If our cache is fresh, just return it
  if (CACHE.data && (now - CACHE.ts) < TTL) {
    return res.json(CACHE.data);
  }

  // 2) Otherwise, fetch everything we need in one batch
  const symbols = [
    // your master list:
    'BTCUSDT','ETHUSDT', /* … crypto … */,
    'EURUSD','USDJPY',    /* … FX … */,
    'AAPL','NVDA',        /* … stocks … */
  ];

  // Example: fetch hourly & daily for all symbols in parallel
  const calls = symbols.flatMap(sym => [
    // Binance for cryptos:
    cryptoSymbols.includes(sym)
      ? axios.get('https://api.binance.com/api/v3/klines',{ params:{ symbol:sym, interval:'1h', limit:500 }})
      : null,
    // Twelve Data for non‑crypto:
    !cryptoSymbols.includes(sym)
      ? axios.get('https://api.twelvedata.com/time_series',{ params:{
          symbol: toTDSymbol(sym),
          interval:'1h',
          outputsize:500,
          apikey: process.env.TD_API_KEY
        }})
      : null,
    // repeat for daily if you like…
  ]).filter(Boolean);

  const responses = await Promise.all(calls);
  // transform them into a { bySymbol: { hourly: […], daily: […] } } map
  const payload = {};
  let idx = 0;
  for (const sym of symbols) {
    const isCrypto = cryptoSymbols.includes(sym);
    const hr = responses[idx++].data;
    const dy = responses[idx++].data;
    payload[sym] = {
      hourly:  isCrypto
        ? hr.map(k=>({ time:k[0]/1000, open:+k[1], high:+k[2], low:+k[3], close:+k[4] }))
        : dy.values.map(v=>({ time:new Date(v.datetime).getTime()/1000, open:+v.open, high:+v.high, low:+v.low, close:+v.close })),
      // repeat daily…
    };
  }

  // 3) Cache & return
  CACHE.ts = now;
  CACHE.data = payload;
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  return res.json(payload);
}
