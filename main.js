console.log("✅ main.js loaded");

// Create charts
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

// ------------------ EMA Function ------------------
function calculateEMA(data, period = 45) {
  const k = 2 / (period + 1);
  let emaArray = [];
  let emaPrev;

  for (let i = 0; i < data.length; i++) {
    const price = data[i].close;
    const time = data[i].time;

    if (i < period - 1) continue;

    if (i === period - 1) {
      const sum = data.slice(i - period + 1, i + 1).reduce((acc, d) => acc + d.close, 0);
      emaPrev = sum / period;
    } else {
      emaPrev = price * k + emaPrev * (1 - k);
    }

    emaArray.push({ time, value: emaPrev });
  }

  return emaArray;
}

// ------------------ Fibonacci Plot ------------------
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
  const range = Math.abs(swingHigh.close - swingLow.close);

  const fibPercents = [0.382, 0.5, 0.618, 1, 1.618, 2.618];
  const levels = fibPercents.map(pct => {
    return isUptrend
      ? fibStart.close + range * pct
      : fibStart.close - range * pct;
  });

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

// ------------------ Fetch CoinGecko Candle Data ------------------
async function fetchCoinGeckoCandles(symbolId, days = 30) {
  const res = await fetch(`/api/crypto?symbol=${symbolId}&days=${days}`);
  const data = await res.json();
  if (!data.candles || !Array.isArray(data.candles)) throw new Error("Invalid candle structure");
  return data.candles;
}

// ------------------ Load Charts ------------------
async function loadCharts(symbolId = "bitcoin") {
  try {
    const dailyData = await fetchCoinGeckoCandles(symbolId, 365);
    dailySeries.setData(dailyData);
    plotFibonacci(dailyChart, dailyData);

    const emaData = calculateEMA(dailyData);
    const emaSeries = dailyChart.addLineSeries({ color: "#FF00FF", lineWidth: 2 });
    emaSeries.setData(emaData);

    const h1Data = await fetchCoinGeckoCandles(symbolId, 60);
    h1Series.setData(h1Data);
    plotFibonacci(h1Chart, h1Data);
  } catch (err) {
    console.error("Chart loading error:", err);
  }
}

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

// Initial load
loadCharts("bitcoin");
