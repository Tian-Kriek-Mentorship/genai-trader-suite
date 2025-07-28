console.log("✅ main.js loaded");

// ------------------ Global Setup ------------------
import {
  createChart
} from 'https://unpkg.com/lightweight-charts@4.0.0/dist/lightweight-charts.standalone.production.js';

const dailyChart = createChart(document.getElementById("dailyChart"), {
  width: 800,
  height: 400,
});
const h1Chart = createChart(document.getElementById("hourlyChart"), {
  width: 800,
  height: 400,
});

const dailySeries = dailyChart.addLineSeries({ color: "#2962FF" });
const h1Series = h1Chart.addLineSeries({ color: "#FF9800" });

// ------------------ Fetch Binance Candle Data ------------------
async function fetchBinanceData(symbol = "BTCUSDT", interval = "1d", limit = 500) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  const raw = await res.json();
  return raw.map(candle => ({
    time: candle[0] / 1000,
    open: parseFloat(candle[1]),
    high: parseFloat(candle[2]),
    low: parseFloat(candle[3]),
    close: parseFloat(candle[4]),
  }));
}

// ------------------ Fibonacci Logic ------------------
function plotFibonacci(chart, candles) {
  const len = candles.length;
  if (len < 10) return;

  // Find recent swing low and swing high
  let swingLow = candles[0];
  let swingHigh = candles[0];

  for (let i = len - 50; i < len; i++) {
    if (candles[i].low < swingLow.low) swingLow = candles[i];
    if (candles[i].high > swingHigh.high) swingHigh = candles[i];
  }

  const isUpTrend = swingHigh.time > swingLow.time;

  const fibLines = chart.addLineSeries({
    color: isUpTrend ? "green" : "red",
    lineWidth: 1,
    lineStyle: 1,
  });

  const fibStart = isUpTrend ? swingLow : swingHigh;
  const fibEnd = isUpTrend ? swingHigh : swingLow;
  const range = Math.abs(fibEnd.close - fibStart.close);

  const levels = isUpTrend
    ? [1.618, 2.618].map(mult => fibEnd.close + range * (mult - 1))
    : [1.618, 2.618].map(mult => fibEnd.close - range * (mult - 1));

  levels.forEach((price, i) => {
    fibLines.setData([
      { time: fibStart.time, value: price },
      { time: candles[len - 1].time, value: price },
    ]);
  });
}

// ------------------ Load and Plot ------------------
(async () => {
  const dailyData = await fetchBinanceData("BTCUSDT", "1d");
  dailySeries.setData(dailyData);
  plotFibonacci(dailyChart, dailyData);

  const h1Data = await fetchBinanceData("BTCUSDT", "1h");
  h1Series.setData(h1Data);
  plotFibonacci(h1Chart, h1Data);
})();

// ------------------ AI Summary Button ------------------
document.getElementById("aiBtn").addEventListener("click", async () => {
  const res = await fetch("https://api.llama.fi/summary?symbol=BTC");
  const data = await res.json();
  document.getElementById("out").textContent = data?.summary || "No summary found.";
});
