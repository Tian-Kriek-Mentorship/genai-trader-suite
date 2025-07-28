console.log("✅ main.js loaded");

// Chart setup
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

const dailyEmaSeries = dailyChart.addLineSeries({ color: "#00C853", lineWidth: 1 });

// ------------------ Fetch IG Candle Data ------------------
async function fetchIGCandles(symbol, resolution = "DAY", points = 500) {
  const res = await fetch(`/api/ig-price?symbol=${symbol}&resolution=${resolution}&points=${points}`);
  const json = await res.json();
  if (!json.candles || !Array.isArray(json.candles)) {
    console.error("Unexpected response:", json);
    return [];
  }
  return json.candles;
}

// ------------------ Fibonacci Extensions ------------------
function plotFibonacci(chart, candles) {
  const len = candles.length;
  if (len < 60) return;

  let swingLow = candles[len - 60];
  let swingHigh = candles[len - 60];

  for (let i = len - 60; i < len; i++) {
    if (candles[i].low < swingLow.low) swingLow = candles[i];
    if (candles[i].high > swingHigh.high) swingHigh = candles[i];
  }

  const isUptrend = swingHigh.time > swingLow.time;
  const fibStart = isUptrend ? swingLow : swingHigh;
  const fibEnd = isUptrend ? swingHigh : swingLow;
  const range = Math.abs(fibEnd.close - fibStart.close);

  const customLevels = [1.27, 1.618, 2.0, 2.618];
  const levels = isUptrend
    ? customLevels.map(level => fibEnd.close + range * (level - 1))
    : customLevels.map(level => fibEnd.close - range * (level - 1));

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

// ------------------ 45 EMA ------------------
function calculateEMA(candles, period = 45) {
  const ema = [];
  const k = 2 / (period + 1);
  let prevEma = candles[0].close;

  for (let i = 0; i < candles.length; i++) {
    const price = candles[i].close;
    prevEma = price * k + prevEma * (1 - k);
    ema.push({ time: candles[i].time, value: prevEma });
  }
  return ema;
}

// ------------------ Load Charts ------------------
async function loadCharts(symbol = "CS.D.BITCOIN.CFD.IP") {
  try {
    const dailyData = await fetchIGCandles(symbol, "DAY", 365);
    const h1Data = await fetchIGCandles(symbol, "HOUR", 90 * 24);

    if (dailyData.length === 0 || h1Data.length === 0) {
      console.warn("No data returned");
      return;
    }

    dailySeries.setData(dailyData);
    h1Series.setData(h1Data);

    // 45 EMA
    const emaData = calculateEMA(dailyData, 45);
    dailyEmaSeries.setData(emaData);

    // Fib levels
    plotFibonacci(dailyChart, dailyData);
    plotFibonacci(h1Chart, h1Data);
  } catch (err) {
    console.error("Chart loading error:", err);
  }
}

// ------------------ Symbol Switch ------------------
document.getElementById("symbolSelect").addEventListener("change", (e) => {
  const selected = e.target.value;
  loadCharts(selected);
});

// ------------------ Initial Load ------------------
loadCharts("CS.D.BITCOIN.CFD.IP");
