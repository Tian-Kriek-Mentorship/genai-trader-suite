console.log("✅ main.js loaded");

// ------------------ Chart Setup ------------------
const dailyChart = LightweightCharts.createChart(document.getElementById("dailyChart"), {
  width: 800,
  height: 400,
});
const h1Chart = LightweightCharts.createChart(document.getElementById("hourlyChart"), {
  width: 800,
  height: 400,
});

const dailySeries = dailyChart.addLineSeries({ color: "#2962FF" });
const h1Series = h1Chart.addLineSeries({ color: "#FF9800" });

// ------------------ Fetch Candle Data (Proxy to /api/quotes) ------------------
async function fetchCandles(symbol, interval) {
  const res = await fetch(`/api/quotes?symbol=${encodeURIComponent(symbol)}&interval=${interval}`);
  if (!res.ok) {
    console.error("Failed to fetch candle data");
    return [];
  }
  const data = await res.json();
  return data.values
    .map(c => ({
      time: Math.floor(new Date(c.datetime).getTime() / 1000),
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close),
    }))
    .reverse(); // Twelve Data returns newest first
}

// ------------------ Fibonacci Logic ------------------
function plotFibonacci(chart, candles) {
  const len = candles.length;
  if (len < 50) return;

  let swingLow = candles[len - 50];
  let swingHigh = candles[len - 50];

  for (let i = len - 50; i < len; i++) {
    if (candles[i].low < swingLow.low) swingLow = candles[i];
    if (candles[i].high > swingHigh.high) swingHigh = candles[i];
  }

  const isUptrend = swingHigh.time > swingLow.time;
  const fibStart = isUptrend ? swingLow : swingHigh;
  const fibEnd = isUptrend ? swingHigh : swingLow;
  const range = Math.abs(fibEnd.close - fibStart.close);

  const levels = isUptrend
    ? [1.618, 2.618].map(m => fibEnd.close + range * (m - 1))
    : [1.618, 2.618].map(m => fibEnd.close - range * (m - 1));

  levels.forEach(price => {
    const line = chart.addLineSeries({
      color: isUptrend ? "green" : "red",
      lineWidth: 1,
      lineStyle: 1,
    });
    line.setData([
      { time: fibStart.time, value: price },
      { time: candles[len - 1].time, value: price },
    ]);
  });
}

// ------------------ Load Charts ------------------
async function loadCharts(symbol = "BTC/USD") {
  try {
    const dailyData = await fetchCandles(symbol, "1day");
    dailySeries.setData(dailyData);
    plotFibonacci(dailyChart, dailyData);

    const h1Data = await fetchCandles(symbol, "1h");
    h1Series.setData(h1Data);
    plotFibonacci(h1Chart, h1Data);
  } catch (err) {
    console.error("Chart loading error:", err);
  }
}

// ------------------ Symbol Dropdown ------------------
document.getElementById("symbolSelect").addEventListener("change", (e) => {
  const selected = e.target.value;
  loadCharts(selected);
});

// ------------------ AI Summary ------------------
document.getElementById("aiBtn").addEventListener("click", async () => {
  try {
    const res = await fetch("/api/ai");
    const data = await res.json();
    document.getElementById("out").textContent = data.summary || "No summary found.";
  } catch (err) {
    document.getElementById("out").textContent = "Failed to load summary.";
  }
});

// ------------------ Initial Load ------------------
loadCharts("BTC/USD");
