// math.js — technical analysis math helpers

export function ema(arr, p) {
  const k = 2 / (p + 1), out = [], n = arr.length;
  let prev;
  for (let i = 0; i < n; i++) {
    if (i === p - 1) {
      prev = arr.slice(0, p).reduce((a, b) => a + b, 0) / p;
      out[i] = prev;
    } else if (i >= p) {
      prev = arr[i] * k + prev * (1 - k);
      out[i] = prev;
    } else {
      out[i] = null;
    }
  }
  return out;
}

export function sma(arr, p) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < p - 1) { out.push(null); continue; }
    let sum = 0;
    for (let j = i - p + 1; j <= i; j++) sum += arr[j];
    out.push(sum / p);
  }
  return out;
}

export function rsi(arr, p) {
  const gains = [], losses = [], out = [];
  for (let i = 1; i < arr.length; i++) {
    const d = arr[i] - arr[i - 1];
    gains.push(d > 0 ? d : 0);
    losses.push(d < 0 ? -d : 0);
  }
  let avgG = gains.slice(0, p).reduce((a, b) => a + b, 0) / p;
  let avgL = losses.slice(0, p).reduce((a, b) => a + b, 0) / p;
  out[p] = 100 - 100 / (1 + avgG / avgL);
  for (let i = p + 1; i < arr.length; i++) {
    avgG = (avgG * (p - 1) + gains[i - 1]) / p;
    avgL = (avgL * (p - 1) + losses[i - 1]) / p;
    out[i] = 100 - 100 / (1 + avgG / avgL);
  }
  return out;
}
