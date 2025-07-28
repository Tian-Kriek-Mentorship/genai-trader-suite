console.log("✅ main.js loaded");

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

// ------------------ EMA ------------------
function calculateEMA(data, period = 45) {
  const k = 2 / (period + 1);
  const emaData = [];
  let ema;

  for (let i = 0; i < data.length; i++) {
    const price = data[i].close;
    const time = data[i].time;

    if (i < period) {
      continue;
    } else if (i === period) {
      const sum = data.slice(i - period, i).reduce((acc, d) => acc + d.close, 0);
      ema = sum / period;
    } else {
      ema = price * k + ema * (1 - k);
    }

    if (ema) {
      emaData.push({ time, value: ema });
    }
  }

  return emaData;
}

// ------------------ Fibonacci ------------------
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

  fibPercents.forEach(pct => {
    const level = isUptrend
      ? fibStart.close + range * pct
      : fibStart.close - range * pct;

    chart.createPriceLine({
      price: level,
      color: isUptrend ? "green" : "red",
      lineWidth: 1,
      lineStyle: 2,
    });
  });
}

// ------------------ Fetch from Proxy ------------------
async function fetchCoinGeckoCandles(symbolId, days = 30) {
  const res = await fetch(`/api/crypto?symbol=${symbolId}&days=${days}`);
  const data = await res.json();
  if (!Array.isArray(data.candles)) throw new Error("Candle structure invalid");
  return data.candles;
}

// ------------------ Load Charts ------------------
async function loadCharts(symbolId = "bitcoin") {
  try {
    const dailyData = await fetchCoinGeckoCandles(symbolId, 365);
    dailySeries.setData(dailyData);
    plotFibonacci(dailyChart, dailyData);

    const emaData = calculateEMA(dailyData);
    const emaLine = dailyChart.addLineSeries({ color: "magenta", lineWidth: 2 });
    emaLine.setData(emaData);

    const h1Data = await fetchCoinGeckoCandles(symbolId, 60);
    h1Series.setData(h1Data);
    plotFibonacci(h1Chart, h1Data);

  } catch (err) {
    console.error("Chart loading error:", err);
  }
}

// ------------------ AI Summary Button ------------------
document.getElementById("aiBtn").addEventListener("click", async () => {
  const res = await fetch("/api/ai");
  const data = await res.json();
  document.getElementById("out").textContent = data.summary || "No summary found.";
});

// ------------------ Dropdown Symbol Selector ------------------
document.getElementById("symbolSelect").addEventListener("change", (e) => {
  const symbolMap = {
    "BTC/USD": "bitcoin",
    "ETH/USD": "ethereum",
  };
  loadCharts(symbolMap[e.target.value] || "bitcoin");
});

// Initial
loadCharts("bitcoin");
