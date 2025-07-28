console.log("✅ main.js loaded");

// ------------------ Chart Setup ------------------
const dailyChart = LightweightCharts.createChart(document.getElementById("dailyChart"), {
  width: 900,
  height: 400,
  layout: {
    background: { color: "#111" },
    textColor: "#DDD",
  },
});
const hourlyChart = LightweightCharts.createChart(document.getElementById("hourlyChart"), {
  width: 900,
  height: 400,
  layout: {
    background: { color: "#111" },
    textColor: "#DDD",
  },
});

const dailyCandleSeries = dailyChart.addCandlestickSeries();
const hourlyCandleSeries = hourlyChart.addCandlestickSeries();

const dailyEmaSeries = dailyChart.addLineSeries({ color: "#FF4081", lineWidth: 2 });

// ------------------ Fetch Data from IG ------------------
async function fetchIGCandles(epic, resolution = "DAY", max = 365) {
  const res = await fetch(`/api/ig-price?epic=${epic}&resolution=${resolution}&max=${max}`);
  const json = await res.json();
  return json.candles || [];
}

// ------------------ 45 EMA ------------------
function calculateEMA(data, period = 45) {
  const k = 2 / (period + 1);
  let ema = [];
  let prev = data[0].close;
  ema.push({ time: data[0].time, value: prev });

  for (let i = 1; i < data.length; i++) {
    const price = data[i].close;
    const currentEMA = price * k + prev * (1 - k);
    ema.push({ time: data[i].time, value: currentEMA });
    prev = currentEMA;
  }

  return ema;
}

// ------------------ Load & Plot ------------------
async function loadCharts(epic = "CS.D.BITCOIN.CFD.IP") {
  try {
    const dailyData = await fetchIGCandles(epic, "DAY", 365);
    dailyCandleSeries.setData(dailyData);
    dailyEmaSeries.setData(calculateEMA(dailyData, 45));

    const hourlyData = await fetchIGCandles(epic, "HOUR", 96); // 4 days of hourly
    hourlyCandleSeries.setData(hourlyData);
  } catch (err) {
    console.error("Chart loading error:", err);
  }
}

// ------------------ Symbol Selector ------------------
document.getElementById("symbolSelect").addEventListener("change", (e) => {
  const epic = e.target.value;
  loadCharts(epic);
});

// Initial load
loadCharts();
