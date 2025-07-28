console.log("✅ main.js loaded");

// Chart setup (Lightweight Charts v4)
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

// ------------------ Fetch Close-Only Data ------------------
async function fetchCoinGeckoCloses(coinId, days) {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.prices) throw new Error("Unexpected data structure from CoinGecko");

  return data.prices.map(([ts, price]) => ({
    time: Math.floor(ts / 1000),
    value: price,
  }));
}


// ------------------ Plot Fibonacci Levels ------------------
function plotApproxFibonacci(chart, data) {
  if (data.length < 10) return;

  const recent = data.slice(-50);
  let swingLow = recent[0];
  let swingHigh = recent[0];

  for (const candle of recent) {
    if (candle.value < swingLow.value) swingLow = candle;
    if (candle.value > swingHigh.value) swingHigh = candle;
  }

  const isUptrend = swingHigh.time > swingLow.time;
  const fibStart = isUptrend ? swingLow : swingHigh;
  const fibEnd = isUptrend ? swingHigh : swingLow;
  const range = Math.abs(fibEnd.value - fibStart.value);

  const levels = isUptrend
    ? [1.618, 2.618].map(mult => fibEnd.value + range * (mult - 1))
    : [1.618, 2.618].map(mult => fibEnd.value - range * (mult - 1));

  for (const level of levels) {
    const line = chart.addLineSeries({
      color: isUptrend ? "green" : "red",
      lineWidth: 1,
      lineStyle: 2,
    });
    line.setData([
      { time: fibStart.time, value: level },
      { time: data[data.length - 1].time, value: level },
    ]);
  }
}

// ------------------ Load Charts ------------------
async function loadCharts(symbolId = "bitcoin") {
  try {
    const dailyData = await fetchCoinGeckoCloses(symbolId, 365, "daily");
    dailySeries.setData(dailyData);
    plotApproxFibonacci(dailyChart, dailyData);

    const h1Data = await fetchCoinGeckoCloses(symbolId, 60); // ← No interval param

    h1Series.setData(h1Data);
    plotApproxFibonacci(h1Chart, h1Data);
  } catch (err) {
    console.error("Chart loading error:", err);
  }
}

// ------------------ Initial Load ------------------
loadCharts("bitcoin");

// ------------------ AI Summary ------------------
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
  };
  const coinId = coinGeckoMap[selected] || "bitcoin";
  loadCharts(coinId);
});
