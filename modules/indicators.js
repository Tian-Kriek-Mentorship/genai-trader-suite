// indicators.js

/**
 * Calculates and plots the 45 EMA on a chart and returns a signal.
 * @param {Object} chart - LightweightCharts chart instance
 * @param {Array} candles - Array of candle objects
 * @returns {Object} { signal: 'Bullish' | 'Bearish' | null }
 */
export function drawEMAandProbability(chart, candles) {
  const emaPeriod = 45;
  const closes = candles.map(c => c.close);
  const ema = [];

  let sum = 0;
  const k = 2 / (emaPeriod + 1);
  for (let i = 0; i < closes.length; i++) {
    const price = closes[i];
    if (i < emaPeriod) {
      sum += price;
      ema.push(null);
    } else if (i === emaPeriod) {
      const sma = sum / emaPeriod;
      ema.push(sma);
    } else {
      const prev = ema[i - 1];
      const curr = price * k + prev * (1 - k);
      ema.push(curr);
    }
  }

  const series = chart.addLineSeries({ color: 'gold', lineWidth: 2 });
  const emaData = candles.map((c, i) => ({
    time: c.time,
    value: ema[i]
  })).filter(d => d.value !== null);
  series.setData(emaData);

  const latestPrice = candles[candles.length - 1].close;
  const latestEMA = ema[ema.length - 1];
  const signal = latestPrice > latestEMA ? 'Bullish' : latestPrice < latestEMA ? 'Bearish' : null;

  return { signal };
}

/**
 * Calculates RSI(13), overlays it, and returns overbought/oversold signal.
 * @param {Object} chart - LightweightCharts chart instance
 * @param {Array} candles - Array of candle objects
 * @returns {Object} { signal: 'Overbought' | 'Oversold' | null }
 */
export function drawRSIandSignal(chart, candles) {
  const rsiPeriod = 13;
  const closes = candles.map(c => c.close);
  const rsi = [];

  let gain = 0, loss = 0;
  for (let i = 1; i <= rsiPeriod; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }

  gain /= rsiPeriod;
  loss /= rsiPeriod;
  rsi[rsiPeriod] = 100 - 100 / (1 + gain / loss);

  for (let i = rsiPeriod + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    const g = delta > 0 ? delta : 0;
    const l = delta < 0 ? -delta : 0;
    gain = (gain * (rsiPeriod - 1) + g) / rsiPeriod;
    loss = (loss * (rsiPeriod - 1) + l) / rsiPeriod;
    rsi[i] = 100 - 100 / (1 + gain / loss);
  }

  const signal = rsi[rsi.length - 1] >= 66
    ? 'Overbought'
    : rsi[rsi.length - 1] <= 34
    ? 'Oversold'
    : null;

  return { signal };
}
