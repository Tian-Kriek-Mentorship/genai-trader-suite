// fibs.js

/**
 * Draws a Fib extension line from swing low/high to fractal, then determines
 * whether to project the 0.618, 1.618, or 2.618 target based on price behavior.
 *
 * @param {Object} chart - LightweightCharts chart
 * @param {Array} candles - Array of OHLC candles
 * @param {boolean} isUptrend - true for bullish structure, false for bearish
 * @returns {number|null} - The projected Fibonacci target level
 */
export function drawFibsOnChart(chart, candles, isUptrend = true) {
  const findSwing = (data, start, end, up) => {
    let idx = start;
    for (let i = start; i <= end; i++) {
      if (up ? data[i].low < data[idx].low : data[i].high > data[idx].high) idx = i;
    }
    return idx;
  };

  const findFractalAfter = (data, fromIdx, up) => {
    for (let i = fromIdx + 2; i < data.length - 2; i++) {
      const isHigh = data[i].high > data[i - 1].high && data[i].high > data[i - 2].high &&
                     data[i].high > data[i + 1].high && data[i].high > data[i + 2].high;
      const isLow  = data[i].low  < data[i - 1].low  && data[i].low  < data[i - 2].low &&
                     data[i].low  < data[i + 1].low  && data[i].low  < data[i + 2].low;
      if ((up && isHigh) || (!up && isLow)) return i;
    }
    return -1;
  };

  const computeTarget = (data, pIdx, qIdx, up) => {
    const p = up ? data[pIdx].low : data[pIdx].high;
    const q = up ? data[qIdx].high : data[qIdx].low;
    const r = Math.abs(q - p);

    const levels = up
      ? { retr: q - r * 0.618, ext127: q + r * 0.27, ext618: q + r * 0.618, ext2618: q + r * 1.618 }
      : { retr: q + r * 0.618, ext127: q - r * 0.27, ext618: q - r * 0.618, ext2618: q - r * 1.618 };

    let touched = false, moved127 = false;

    for (let i = qIdx + 1; i < data.length; i++) {
      if (up) {
        if (data[i].low <= levels.retr) touched = true;
        if (data[i].high >= levels.ext127) moved127 = true;
      } else {
        if (data[i].high >= levels.retr) touched = true;
        if (data[i].low <= levels.ext127) moved127 = true;
      }
    }

    return touched ? levels.ext618 : (!touched && !moved127 ? levels.ext127 : levels.ext2618);
  };

  const crossIdx = candles.findIndex((_, i) =>
    i > 0 &&
    ((isUptrend && candles[i - 1].open < candles[i - 1].close && candles[i].open > candles[i].close) ||
     (!isUptrend && candles[i - 1].open > candles[i - 1].close && candles[i].open < candles[i].close))
  );

  if (crossIdx < 5) return null;

  let pIdx = findSwing(candles, isUptrend ? 0 : 5, crossIdx, isUptrend);
  let qIdx = findFractalAfter(candles, crossIdx, isUptrend);
  if (qIdx < 0) return null;

  let target = computeTarget(candles, pIdx, qIdx, isUptrend);

  const line = chart.addLineSeries({ color: 'darkgreen', lineWidth: 2 });
  line.setData([
    { time: candles[0].time, value: target },
    { time: candles.at(-1).time, value: target }
  ]);

  return target;
}
