console.log("✅ main.js loaded");

// Use Lightweight Charts v4 (already globally available)
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

// ------------------ Fetch CoinGecko Candle Data ------------------
async function fetchCoinGeckoCandles(symbolId, days = 30) {
  const res = await fetch(`/api/crypto?symbol=${symbolId}&days=${days}`);
  const data = await res.json();

  if (!Array.isArray(data.candles)) {
    console.error("Unexpected response:", data);
    throw new Error("Unexpected data structure from proxy");
  }

  // Convert [timestamp, open, high, low, close] to proper object
  return data.candles.map(([time, open, high, low, close]) => ({
    time: Math.floor(time / 1000),
    open,
    high,
    low,
    close,
  }));
}

// ------------------ Fibonacci Plot ------------------
function plotFibonacci(chart, candles) {
  const len = candles.length;
  if (len < 10) return;

  let swingLow = candles[len - 10];
  let swingHigh = candles[len - 10];

  for (let i = len - 10; i < len; i++) {
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

  levels.forEach(price => {
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
async function loadCharts(symbolId = "bitcoin") {
  try {
    const dailyData = await fetchCoinGeckoCandles(symbolId, 30);
    dailySeries.setData(dailyData);
    plotFibonacci(dailyChart, dailyData);

    const h1Data = await fetchCoinGeckoCandles(symbolId, 1); // Reuse if no lower TF
    h1Series.setData(h1Data);
    plotFibonacci(h1Chart, h1Data);
  } catch (err) {
    console.error("Chart loading error:", err);
  }
}

// Initial load
loadCharts("bitcoin");

// ------------------ AI Summary Button ------------------
document.getElementById("aiBtn").addEventListener("click", async () => {
  const res = await fetch("/api/ai");
  const data = await res.json();
  document.getElementById("out").textContent = data.summary || "No summary found.";
});

// ------------------ Symbol Selector ------------------
const symbolDropdown = document.getElementById("symbolSelect");

symbolDropdown.addEventListener("change", (e) => {
  const selected = e.target.value;
  const coinGeckoMap = {
    "BTC/USD": "bitcoin",
    "ETH/USD": "ethereum",
    "EUR/USD": "euro",
    "NVDA": "nvidia",
  };
  const coinId = coinGeckoMap[selected] || "bitcoin";
  loadCharts(coinId);
});
