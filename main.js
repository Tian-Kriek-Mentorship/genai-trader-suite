import { createChart } from "https://esm.sh/lightweight-charts@4.0.0";

console.log("✅ main.js loaded");

// ------------------ Chart Setup ------------------
const dailyChart = createChart(document.getElementById("dailyChart"), {
  width: 800,
  height: 400,
});
const h1Chart = createChart(document.getElementById("hourlyChart"), {
  width: 800,
  height: 400,
});

const dailySeries = dailyChart.addCandlestickSeries({ upColor: "#26a69a", downColor: "#ef5350", borderVisible: false });
const h1Series = h1Chart.addCandlestickSeries({ upColor: "#26a69a", downColor: "#ef5350", borderVisible: false });


// --- Fetch Binance Data ---
async function fetchBinanceData(symbol = "BTCUSDT", interval = "1d", limit = 500) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  const raw = await res.json();
  return raw.map(c => ({
    time: c[0] / 1000,
    open: parseFloat(c[1]),
    high: parseFloat(c[2]),
    low: parseFloat(c[3]),
    close: parseFloat(c[4]),
  }));
}

// --- Fibonacci Overlay ---
function plotFibonacci(chart, candles) {
  const len = candles.length;
  if (len < 50) return;

  let swingLow = candles[len - 50];
  let swingHigh = candles[len - 50];

  for (let i = len - 50; i < len; i++) {
    if (candles[i].low < swingLow.low) swingLow = candles[i];
    if (candles[i].high > swingHigh.high) swingHigh = candles[i];
  }

  const isUp = swingHigh.time > swingLow.time;
  const base = isUp ? swingLow : swingHigh;
  const peak = isUp ? swingHigh : swingLow;
  const range = Math.abs(peak.close - base.close);

  const levels = isUp
    ? [1.618, 2.618].map(m => peak.close + range * (m - 1))
    : [1.618, 2.618].map(m => peak.close - range * (m - 1));

  levels.forEach(price => {
    const line = chart.addLineSeries({
      color: isUp ? "green" : "red",
      lineWidth: 1,
    });
    line.setData([
      { time: base.time, value: price },
      { time: candles[len - 1].time, value: price },
    ]);
  });
}

// --- Load + Render ---
(async () => {
  const dailyData = await fetchBinanceData("BTCUSDT", "1d");
  dailySeries.setData(dailyData);
  plotFibonacci(dailyChart, dailyData);

  const h1Data = await fetchBinanceData("BTCUSDT", "1h");
  h1Series.setData(h1Data);
  plotFibonacci(h1Chart, h1Data);
})();

// --- AI Summary ---
document.getElementById("aiBtn").addEventListener("click", async () => {
  const res = await fetch("https://api.llama.fi/summary?symbol=BTC");
  const data = await res.json();
  document.getElementById("out").textContent = data?.summary || "No summary found.";
});
