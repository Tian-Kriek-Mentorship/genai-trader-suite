console.log('✅ MAIN.JS LOADED', Date.now());

window.addEventListener('DOMContentLoaded', async () => {

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

      if (curr > prev1 && curr > prev2 && curr > next1 && curr > next2) {
        fractals.push({ time: data[i].time, position: 'above', price: data[i].high });
      }
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

  function calculateRSI(closes, period = 14) {
    const rsi = [];
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 1; i <= period; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) avgGain += change;
      else avgLoss -= change;
    }

    avgGain /= period;
    avgLoss /= period;
    rsi[period] = 100 - (100 / (1 + avgGain / avgLoss));

    for (let i = period + 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      const gain = change > 0 ? change : 0;
      const loss = change < 0 ? -change : 0;

      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;

      rsi[i] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    }

    return rsi;
  }

  function calculateMomentum(candles) {
    const sensitivity = 150;
    const fastLength = 20;
    const slowLength = 40;

    const closes = candles.map(c => c.close);
    const fast = ema(closes, fastLength);
    const slow = ema(closes, slowLength);
    const macd = fast.map((v, i) => v - slow[i]);
    const t1 = macd.map((v, i) => i === 0 ? 0 : (v - macd[i - 1]) * sensitivity);

    return candles.map((c, i) => ({
      time: c.time,
      value: t1[i],
      color: t1[i] >= 0 ? 'rgba(0,200,0,0.5)' : 'rgba(255,0,0,0.5)'
    }));
  }

  function ema(src, len) {
    const alpha = 2 / (len + 1);
    const result = [src[0]];
    for (let i = 1; i < src.length; i++) {
      result.push(result[i - 1] + alpha * (src[i] - result[i - 1]));
    }
    return result;
  }

  function drawChart(containerId, candles) {
    const chart = LightweightCharts.createChart(document.getElementById(containerId), {
      width: 800,
      height: 400
    });

    const candleSeries = chart.addCandlestickSeries();
    candleSeries.setData(candles);

    const sma50Line = chart.addLineSeries({ color: '#FF6D00', lineWidth: 1 });
    const sma200Line = chart.addLineSeries({ color: '#43A047', lineWidth: 1 });

    sma50Line.setData(calculateSMA(candles, 50));
    sma200Line.setData(calculateSMA(candles, 200));

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

  const dailyCandles = await fetchCandles('BTCUSDT', '1d', 300);
  const hourlyCandles = await fetchCandles('BTCUSDT', '1h', 300);

  drawChart('dailyChart', dailyCandles);
  drawChart('hourlyChart', hourlyCandles);

  const momentumChart = LightweightCharts.createChart(document.getElementById('momentumChart'), {
    width: 800, height: 100
  });
  const momentumSeries = momentumChart.addHistogramSeries({ priceFormat: { type: 'volume' } });
  momentumSeries.setData(calculateMomentum(dailyCandles));

  const rsiChart = LightweightCharts.createChart(document.getElementById('rsiChart'), {
    width: 800, height: 100
  });
  const rsiSeries = rsiChart.addLineSeries({ color: '#7E57C2', lineWidth: 2 });
  const rsiData = calculateRSI(dailyCandles.map(c => c.close));
  rsiSeries.setData(rsiData.map((v, i) => ({ time: dailyCandles[i]?.time, value: v })));

  const rsiUpper = rsiChart.addLineSeries({ color: '#ccc', lineWidth: 1 });
  const rsiLower = rsiChart.addLineSeries({ color: '#ccc', lineWidth: 1 });
  rsiUpper.setData(dailyCandles.map(c => ({ time: c.time, value: 70 })));
  rsiLower.setData(dailyCandles.map(c => ({ time: c.time, value: 30 })));

  document.getElementById('aiBtn').onclick = async () => {
    const o = document.getElementById('out');
    o.textContent = 'Loading…';
    try {
      o.textContent = (await axios.get('/api/ai')).data.text.trim();
    } catch (e) {
      o.textContent = 'Error: ' + (e.response?.data?.error || e.message);
    }
  };

});
