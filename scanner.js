// scanner.js
import axios from 'axios';
import Bottleneck from 'bottleneck';
import axiosRetry from 'axios-retry';

// 1. Retry on 429 or 5xx with exponential back-off
axiosRetry(axios, {
  retries: 3,
  retryCondition: (error) =>
    axiosRetry.isNetworkOrIdempotentRequestError(error) ||
    error.response?.status === 429,
  retryDelay: (retryCount) =>
    1000 * Math.pow(2, retryCount - 1) // 1s, 2s, 4s
});

// 2. Bottleneck limiter: 1 request at a time, ≥8s between calls
const limiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 8_000
});

// Wrap your Twelve Data fetch through the limiter
const fetchSeries = limiter.wrap(async (symbol) => {
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
  return { symbol, data: resp.data.values };
});

// 3. Batch‐aware scanner function
export async function runScanner(symbols = []) {
  const results = [];
  for (let i = 0; i < symbols.length; i += 5) {
    const batch = symbols.slice(i, i + 5);
    try {
      const batchRes = await Promise.all(batch.map(fetchSeries));
      results.push(...batchRes);
    } catch (err) {
      console.warn('Batch error, retrying after delay:', err);
      // longer wait on failure
      await new Promise((r) => setTimeout(r, 10_000));
    }
    // small pause between batches
    await new Promise((r) => setTimeout(r, 5_000));
  }
  return results;
}
