console.log("✅ main.js loaded");

// Create charts from global LightweightCharts object
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

// ------------------ Fetch from Your API ------------------
async function fetchCandles(symbol, interval) {
  const res = await fetch(`/api/quotes?symbol=${encodeURIComponent(symbol)}&interval=${interval}`);
  if (!res.ok) throw new Error("Failed to fetch candle data");
  const data = await res.json();

  return data.values
    .map(candle => ({
      time: Math.floor(new Date(candle.datetime).getTime() / 1000),
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
    }))
    .reverse(); // API returns newest first, reverse for chart
}

// ------------------ Fibonacci Logic ------------------
function plotFibonacci(chart, candles) {
  const len = candles.length;
  if (len < 50) return;

  // Find recent swing low and high
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
    ? [1.618, 2.618].map(mult => fibEnd.close + range * (mult - 1))
    : [1.618, 2.618].map(mult => fibEnd.close - range * (mult - 1));

  levels.forEach((price, i) => {
    const fibLine = chart.addLineSeries({
      color: isUptrend ? "green" : "red",
      lineWidth: 1,
      lineStyle: 1,
    });
    fibLine.setData([
      { time: fibStart.time, value: price },
      { time: candles[len - 1].time, value: price },
    ]);
  });
}

// ------------------ Load + Plot ------------------
async function loadCharts(symbol = "BTC/USD") {
  const dailyData = await fetchCandles(symbol, "1day");
  dailySeries.setData(dailyData);
  plotFibonacci(dailyChart, dailyData);

  const h1Data = await fetchCandles(symbol, "1h");
  h1Series.setData(h1Data);
  plotFibonacci(h1Chart, h1Data);
}

// Initial load
loadCharts();

// ------------------ AI Summary Button ------------------
document.getElementById("aiBtn").addEventListener("click", async () => {
  const res = await fetch("/api/ai");
  const data = await res.json();
  document.getElementById("out").textContent = data.summary || "No summary found.";
});

// ------------------ Symbol Search Dropdown ------------------
const symbolDropdown = document.getElementById("symbolSelect");

symbolDropdown.addEventListener("change", (e) => {
  const selectedSymbol = e.target.value;
  loadCharts(selectedSymbol);
});
