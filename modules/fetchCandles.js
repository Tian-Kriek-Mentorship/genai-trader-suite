// fetchCandles.js

import { loadCache as getCached, saveCache as setCached } from './cache.js';

const BINANCE_API = 'https://api.binance.com/api/v3/klines';

const INTERVAL_MAP = {
  '1d': '1d',
  '1h': '1h',
};

/**
 * Fetches candlestick data for a given symbol and interval.
 * Returns an array of objects compatible with Lightweight Charts.
 *
 * @param {string} symbol - e.g. BTCUSDT
 * @param {string} interval - '1d' or '1h'
 * @returns {Promise<Array>} Array of candles: { time, open, high, low, close }
 */
export async function loadCandles(symbol, interval = '1d') {
  const key = `${symbol}_${interval}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const url = `${BINANCE_API}?symbol=${symbol}&interval=${INTERVAL_MAP[interval]}&limit=365`;
    const res = await fetch(url);
    const data = await res.json();

    const candles = data.map(c => ({
      time: Math.floor(c[0] / 1000), // ms → s
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4])
    }));

    setCached(key, candles);
    return candles;
  } catch (e) {
    console.error(`Failed to fetch candles for ${symbol} (${interval})`, e);
    return [];
  }
}
