import { ema, rsi } from './math.js';

export function drawEMAandProbability(chart, candles, period = 45) {
  const emaValues = ema(candles.map(c => c.close), period);
  const emaSeries = chart.addLineSeries({ lineWidth: 2 });
  emaSeries.setData(
    candles.map((c, i) => ({ time: c.time, value: emaValues[i] })).filter(d => d.value != null)
  );

  const last = candles.at(-1);
  const prev = candles.at(-2);
  const emaNow = emaValues.at(-1);
  const emaPrev = emaValues.at(-2);

  let signal = '';
  if (emaNow && emaPrev) {
    if (prev.close < emaPrev && last.close > emaNow) signal = 'Bullish cross';
    else if (prev.close > emaPrev && last.close < emaNow) signal = 'Bearish cross';
  }

  return { signal, emaSeries };
}

export function drawRSIandSignal(chart, candles, period = 13) {
  const rsiValues = rsi(candles.map(c => c.close), period);
  const rsiSeries = chart.addLineSeries({ lineWidth: 1 });
  rsiSeries.setData(
    candles.map((c, i) => ({ time: c.time, value: rsiValues[i] })).filter(d => d.value != null)
  );

  const last = rsiValues.at(-1);
  let signal = '';
  if (last < 34) signal = 'RSI Oversold';
  else if (last > 66) signal = 'RSI Overbought';

  return { signal, rsiSeries };
}
