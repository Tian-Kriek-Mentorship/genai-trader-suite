console.log('✅ MAIN.JS LOADED', Date.now());

async function fetchCandles(symbol, interval, limit) {
  const res = await axios.get(`https://api.binance.com/api/v3/klines`, {
    params: { symbol, interval, limit }
  });
  return res.data.map(c => ({
    time: c[0] / 1000,
    open: +c[1],
    high: +c[2],
    low: +c[3],
    close: +c[4]
  }));
}

function calculateSMA(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push({ time: data[i].time, value: null });
      continue;
    }
    const slice = data.slice(i - period + 1, i + 1);
    const avg = slice.reduce((sum, d) => sum + d.close, 0) / period;
    result.push({ time: data[i].time, value: avg });
  }
  return result;
}

function findFractals(data) {
  const fractals = [];
  for (let i = 2; i < data.length - 2; i++) {
    const prev2 = data[i - 2].high;
    const prev1 = data[i - 1].high;
    const curr = data[i].high;
    const next1 = data[i + 1].high;
    const next2 = data[i + 2].high;

    // Swing high
    if (curr > prev1 && curr > prev2 && curr > next1 && curr > next2) {
      fractals.push({ time: data[i].time, position: 'above', price: data[i].high });
    }

    // Swing low
    if (
      data[i].low < data[i - 1].low &&
      data[i].low < data[i - 2].low &&
      data[i].low < data[i + 1].low &&
      data[i].low < data[i + 2].low
    ) {
      fractals.push({ time: data[i].time, position: 'below', price: data[i].low });
    }
  }
  return fractals;
}

function drawChart(containerId, candles) {
  const chart = LightweightCharts.createChart(document.getElementById(containerId), {
    width: 800,
    height: 400
  });

  const candleSeries = chart.addCandlestickSeries();
  candleSeries.setData(candles);

  const sma50 = calculateSMA(candles, 50);
  const sma200 = calculateSMA(candles, 200);

  const sma50Line = chart.addLineSeries({ color: '#FF6D00', lineWidth: 1 });
  const sma200Line = chart.addLineSeries({ color: '#43A047', lineWidth: 1 });

  sma50Line.setData(sma50);
  sma200Line.setData(sma200);

  // Fractals
  const fractals = findFractals(candles);
  for (const f of fractals) {
    chart.addShape({
      time: f.time,
      price: f.price,
      shape: f.position === 'above' ? 'arrowDown' : 'arrowUp',
      color: f.position === 'above' ? '#f44336' : '#2196f3',
      text: '',
      shapeId: `${f.time}-${f.price}`,
    });
  }
}

(async () => {
  const dailyCandles = await fetchCandles('BTCUSDT', '1d', 300);
  const hourlyCandles = await fetchCandles('BTCUSDT', '1h', 300);

  drawChart('dailyChart', dailyCandles);
  drawChart('hourlyChart', hourlyCandles);
})();

document.getElementById('aiBtn').onclick = async () => {
  const o = document.getElementById('out');
  o.textContent = 'Loading…';
  try {
    o.textContent = (await axios.get('/api/ai')).data.text.trim();
  } catch (e) {
    o.textContent = 'Error: ' + (e.response?.data?.error || e.message);
  }
};
