console.log("✅ main.js loaded");

// Use global script from v4 CDN (no import/export)
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

async function fetchCandles(symbol, interval) {
  const res = await fetch(`/api/quotes?symbol=${encodeURIComponent(symbol)}&interval=${interval}`);
  if (!res.ok) throw new Error("Failed to fetch candle data");
  const data = await res.json();

  return data.values.map(c => ({
    time: Math.floor(new Date(c.datetime).getTime() / 1000),
    open: parseFloat(c.open),
    high: parseFloat(c.high),
    low: parseFloat(c.low),
    close: parseFloat(c.close),
  })).reverse();
}

function plotFibonacci(chart, candles) {
  if (candles.length < 50) return;

  let swingLow = candles.at(-50);
  let swingHigh = candles.at(-50);
  for (let i = candles.length - 50; i < candles.length; i++) {
    if (candles[i].low < swingLow.low) swingLow = candles[i];
    if (candles[i].high > swingHigh.high) swingHigh = candles[i];
  }

  const isUptrend = swingHigh.time > swingLow.time;
  const start = isUptrend ? swingLow : swingHigh;
  const end = isUptrend ? swingHigh : swingLow;
  const range = Math.abs(end.close - start.close);

  const levels = [1.618, 2.618].map(f => isUptrend
    ? end.close + range * (f - 1)
    : end.close - range * (f - 1));

  levels.forEach(level => {
    const line = chart.addLineSeries({ color: isUptrend ? "green" : "red", lineWidth: 1 });
    line.setData([
      { time: start.time, value: level },
      { time: candles.at(-1).time, value: level },
    ]);
  });
}

async function loadCharts(symbol = "BTC/USD") {
  const daily = await fetchCandles(symbol, "1day");
  dailySeries.setData(daily);
  plotFibonacci(dailyChart, daily);

  const h1 = await fetchCandles(symbol, "1h");
  h1Series.setData(h1);
  plotFibonacci(h1Chart, h1);
}

loadCharts();

document.getElementById("aiBtn").addEventListener("click", async () => {
  const res = await fetch("/api/ai");
  const data = await res.json();
  document.getElementById("out").textContent = data.summary || "No summary found.";
});

document.getElementById("symbolSelect").addEventListener("change", e => {
  loadCharts(e.target.value);
});
