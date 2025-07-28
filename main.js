console.log("✅ IG CHART SYSTEM LOADED");

// ------------------ Globals ------------------
let CST = null, XST = null, IG_ACC = null;
const defaultEpic = "CS.D.BITCOIN.CFD.IP";
const emaPeriod = 45;

// ------------------ Chart Setup ------------------
function createIGChart(containerId) {
  return LightweightCharts.createChart(document.getElementById(containerId), {
    width: 800,
    height: 400,
    layout: {
      backgroundColor: "#000000",
      textColor: "#ffffff"
    },
    grid: { vertLines: { visible: false }, horzLines: { visible: false } },
    timeScale: { timeVisible: true, secondsVisible: false },
  });
}

const dailyChart = createIGChart("dailyChart");
const hourlyChart = createIGChart("hourlyChart");

const dailyCandles = dailyChart.addCandlestickSeries();
const hourlyCandles = hourlyChart.addCandlestickSeries();
const dailyEMA = dailyChart.addLineSeries({ color: "#FFD700", lineWidth: 2 });
const hourlyEMA = hourlyChart.addLineSeries({ color: "#00FFAA", lineWidth: 2 });

// ------------------ IG Login ------------------
async function igLogin() {
  const res = await fetch("/api/ig-login");
  const data = await res.json();
  CST = data.CST;
  XST = data.X_SECURITY_TOKEN;
  IG_ACC = data.ACCOUNT_ID;
}

// ------------------ IG Fetch OHLC ------------------
async function fetchIGCandles(epic, resolution, from, to) {
  const url = `https://demo-api.ig.com/gateway/deal/prices/${epic}/${resolution}/${from}/${to}`;
  const res = await fetch(url, {
    headers: {
      "CST": CST,
      "X-SECURITY-TOKEN": XST,
      "Version": "3",
      "Accept": "application/json"
    }
  });

  const json = await res.json();
  if (!json.prices) throw new Error("No candles returned from IG");

  return json.prices
    .filter(p => p.closePrice?.bid)
    .map(p => ({
      time: Math.floor(new Date(p.snapshotTimeUTC).getTime() / 1000),
      open: p.openPrice.bid,
      high: p.highPrice.bid,
      low: p.lowPrice.bid,
      close: p.closePrice.bid,
    }));
}

// ------------------ EMA ------------------
function calculateEMA(data, period) {
  const ema = [];
  const k = 2 / (period + 1);
  let emaPrev = data[0].close;

  for (let i = 0; i < data.length; i++) {
    const close = data[i].close;
    emaPrev = i === 0 ? close : close * k + emaPrev * (1 - k);
    ema.push({ time: data[i].time, value: emaPrev });
  }

  return ema;
}

// ------------------ Fibs ------------------
function plotFibonacci(chart, candles) {
  const len = candles.length;
  if (len < 50) return;

  let low = candles[len - 50], high = candles[len - 50];
  for (let i = len - 50; i < len; i++) {
    if (candles[i].low < low.low) low = candles[i];
    if (candles[i].high > high.high) high = candles[i];
  }

  const uptrend = high.time > low.time;
  const fibStart = uptrend ? low : high;
  const fibEnd = uptrend ? high : low;
  const range = Math.abs(fibEnd.close - fibStart.close);
  const levels = uptrend
    ? [1.618, 2.618].map(mult => fibEnd.close + range * (mult - 1))
    : [1.618, 2.618].map(mult => fibEnd.close - range * (mult - 1));

  levels.forEach(price => {
    const fibLine = chart.addLineSeries({
      color: uptrend ? "green" : "red",
      lineWidth: 1,
      lineStyle: 1,
    });
    fibLine.setData([
      { time: fibStart.time, value: price },
      { time: candles[len - 1].time, value: price },
    ]);
  });
}

// ------------------ Load Charts ------------------
async function loadCharts(epic = defaultEpic) {
  try {
    const now = new Date();
    const dailyFrom = new Date(now); dailyFrom.setFullYear(now.getFullYear() - 1);
    const hourlyFrom = new Date(now); hourlyFrom.setDate(now.getDate() - 60);
    const toDateStr = now.toISOString().split("T")[0];
    const fromDailyStr = dailyFrom.toISOString().split("T")[0];
    const fromHourlyStr = hourlyFrom.toISOString().split("T")[0];

    const dailyData = await fetchIGCandles(epic, "DAY", fromDailyStr, toDateStr);
    const hourlyData = await fetchIGCandles(epic, "HOUR", fromHourlyStr, toDateStr);

    dailyCandles.setData(dailyData);
    hourlyCandles.setData(hourlyData);

    dailyEMA.setData(calculateEMA(dailyData, emaPeriod));
    hourlyEMA.setData(calculateEMA(hourlyData, emaPeriod));

    plotFibonacci(dailyChart, dailyData);
    plotFibonacci(hourlyChart, hourlyData);
  } catch (err) {
    console.error("Chart error:", err.message);
  }
}

// ------------------ Symbol Selector ------------------
document.getElementById("symbolSelect").addEventListener("change", async (e) => {
  await loadCharts(e.target.value);
});

// ------------------ Boot ------------------
(async () => {
  await igLogin();
  await loadCharts(defaultEpic);
})();
