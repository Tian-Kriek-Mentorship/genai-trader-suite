// scanner.js
import axios from 'axios';
import Bottleneck from 'bottleneck';
import axiosRetry from 'axios-retry';

// List of crypto symbols to route via Binance
const cryptoSymbols = [
  'BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT',
  'SOLUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','AVAXUSDT'
];

// 1) Retry on 429/5xx with exponential back-off
axiosRetry(axios, {
  retries: 3,
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    error.response?.status === 429,
  retryDelay: (retryCount) => 1000 * Math.pow(2, retryCount - 1)
});

// 2) Bottleneck limiter: 1 request at a time, ≥8s between calls
const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 8_000
});

// 3) Wrapper to fetch series data
const fetchSeries = limiter.wrap(async (symbol) => {
  // Crypto via Binance
  if (cryptoSymbols.includes(symbol)) {
    const resp = await axios.get('https://api.binance.com/api/v3/klines', {
      params: { symbol, interval: '1h', limit: 100 }
    });
    const data = resp.data.map(k => ({
      time: k[0] / 1000,
      open: +k[1],
      high: +k[2],
      low:  +k[3],
      close:+k[4]
    }));
    return { symbol, data };
  }

  // All others via Twelve Data
  const resp = await axios.get('https://api.twelvedata.com/time_series', {
    params: {
      symbol,
      interval: '1h',
      outputsize: 100,
      apikey: import.meta.env.VITE_TWELVEDATA_API_KEY
    }
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
      close: +v.close
    }))
    .reverse();
  return { symbol, data };
});

// 4) Batch‐aware scanner function
e**x**port async function runScanner(symbols = []) {
  const results = [];
  for (let i = 0; i < symbols.length; i += 5) {
    const batch = symbols.slice(i, i + 5);
    try {
      const batchRes = await Promise.all(batch.map(fetchSeries));
      results.push(...batchRes);
    } catch (err) {
      console.warn('Batch error, retrying after delay:', err);
      // Wait longer on failure
      await new Promise(r => setTimeout(r, 10_000));
    }
    // Small pause between batches
    await new Promise(r => setTimeout(r, 5_000));
  }
  return results;
}
