import axios from 'axios';
import Bottleneck from 'bottleneck';
import axiosRetry from 'axios-retry';

// 0) Your Twelve Data API key from index.html
const API_KEY = window.TD_API_KEY;

// 1) Configure axios-retry for 429/5xx with exponential back-off
axiosRetry(axios, {
  retries: 3,
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    error.response?.status === 429,
  retryDelay: (retryCount) => 1000 * Math.pow(2, retryCount - 1),
});

// 2) Bottleneck limiter: 1 request at a time, ≥8s between calls
const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 8000,
});

// 3) Crypto list (route these through Binance)
const cryptoSymbols = [
  'BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT',
  'SOLUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','AVAXUSDT'
];

// 4) Wrapped fetch function
const fetchSeries = limiter.wrap(async (symbol) => {
  // → if crypto, use Binance
  if (cryptoSymbols.includes(symbol)) {
    const resp = await axios.get('https://api.binance.com/api/v3/klines', {
      params: { symbol, interval: '1h', limit: 100 },
    });
    const data = resp.data.map(k => ({
      time: k[0] / 1000,
      open: +k[1], high: +k[2],
      low:  +k[3], close:+k[4],
    }));
    return { symbol, data };
  }

  // → otherwise, use Twelve Data
  // Map EURUSD → EUR/USD for Forex
  let tdSymbol = symbol;
  if (/^[A-Z]{6}$/.test(symbol)) {
    tdSymbol = `${symbol.slice(0,3)}/${symbol.slice(3)}`;
  }

  const resp = await axios.get('https://api.twelvedata.com/time_series', {
    params: {
      symbol: tdSymbol,
      interval: '1h',
      outputsize: 100,
      apikey: API_KEY,
    },
  });
  if (resp.data.status === 'error') {
    throw new Error(`Twelve Data error for ${symbol}: ${resp.data.message}`);
  }
  const data = (resp.data.values || [])
    .map(v => ({
      time: Math.floor(new Date(v.datetime).getTime() / 1000),
      open:  +v.open,
      high:  +v.high,
      low:   +v.low,
      close: +v.close,
    }))
    .reverse();
  return { symbol, data };
});

// 5) Batch‑aware runner
export async function runScanner(symbols = []) {
  const results = [];
  for (let i = 0; i < symbols.length; i += 5) {
    const batch = symbols.slice(i, i + 5);
    try {
      const batchRes = await Promise.all(batch.map(fetchSeries));
      results.push(...batchRes);
    } catch (err) {
      console.warn('Batch error, retrying after delay:', err);
      await new Promise(r => setTimeout(r, 10000));
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  return results;
}
