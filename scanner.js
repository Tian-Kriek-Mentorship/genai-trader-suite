// scanner.js

import axios from 'axios'
import Bottleneck from 'bottleneck'
import axiosRetry from 'axios-retry'

// —————————————————————————————————————————————
// 1. Configure axios to retry on 429/5xx with exponential back‑off
// —————————————————————————————————————————————
axiosRetry(axios, {
  retries: 3,                        // try up to 3 times
  retryCondition: (error) => {
    // only retry on 429 or 500–599
    return axiosRetry.isNetworkOrIdempotentRequestError(error)
        || error.response?.status === 429
  },
  retryDelay: (retryCount, error) => {
    // exponential back‑off: 1s, 2s, 4s...
    return 1000 * Math.pow(2, retryCount - 1)
  }
})

// —————————————————————————————————————————————
// 2. Create a Bottleneck limiter
//    Adjust maxConcurrent and minTime to fit your Twelve Data quota.
//    For example, if you get 8 calls/min free tier => minTime ≈ 8_000ms.
// —————————————————————————————————————————————
const limiter = new Bottleneck({
  maxConcurrent: 1,    // only one request at a time
  minTime: 8_000       // wait ≥8s between calls (≈7.5 calls/min)
})

// Wrap your fetch so it goes through the limiter
const fetchSeries = limiter.wrap(async (symbol) => {
  const resp = await axios.get('https://api.twelvedata.com/time_series', {
    params: {
      symbol,
      interval: '1h',
      outputsize: 100,
      apikey: import.meta.env.VITE_TWELVEDATA_API_KEY
    }
  })
  if (resp.data.status === 'error') {
    throw new Error(`TD error for ${symbol}: ${resp.data.message}`)
  }
  return { symbol, data: resp.data.values }
})

// —————————————————————————————————————————————
// 3. Batch up your symbols and fire them
// —————————————————————————————————————————————
export async function runScanner(symbols = []) {
  const results = []
  for (let i = 0; i < symbols.length; i += 5) {
    const batch = symbols.slice(i, i + 5)
    try {
      const batchRes = await Promise.all(batch.map(fetchSeries))
      results.push(...batchRes)
    } catch (err) {
      console.warn('Batch fetch error, continuing after delay:', err)
      // Wait a bit longer on a hard failure
      await new Promise((r) => setTimeout(r, 10_000))
    }
    // Optional extra delay between batches
    await new Promise((r) => setTimeout(r, 5_000))
  }
  return results
}
