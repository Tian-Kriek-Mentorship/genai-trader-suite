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

  function calculateMomentum(data) {
    const result = [];
    const sensitivity = 150;
    const fastLen = 20;
    const slowLen = 40;
    const bbLen = 20;
    const mult = 2;

    function ema(src, len, i) {
      const k = 2 / (len + 1);
      let ema = src[i - 1] || src[i];
      for (let j = i - len + 1; j <= i; j++) {
        if (j < 0) continue;
        ema = src[j] * k + ema * (1 - k);
      }
      return ema;
    }

    for (let i = 0; i < data.length; i++) {
      if (i < slowLen || i < bbLen) {
        result.push({ time: data[i].time, value: null });
        continue;
      }

      const macd = ema(data.map(d => d.close), fastLen, i) - ema(data.map(d => d.close), slowLen, i);
      const macdPrev = ema(data.map(d => d.close), fastLen, i - 1) - ema(data.map(d => d.close), slowLen, i - 1);
      const t1 = (macd - macdPrev) * sensitivity;

      result.push({
        time: data[i].time,
        value: t1,
        color: t1 >= 0 ? 'green' : 'red'
      });
    }
    return result;
  }

  function calculateRSI(closePrices, period = 14) {
    const rsi = [];
    let avgGain = 0, avgLoss = 0;

    for (let i = 1; i < closePrices.length; i++) {
      const diff = closePrices[i] - closePrices[i - 1];
      avgGain += diff > 0 ? diff : 0;
      avgLoss += diff < 0 ? -diff : 0;
    }

    avgGain /= period;
    avgLoss /= period;

    rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    for (let i = period + 1; i < closePrices.length; i++) {
      const diff = closePrices[i] - closePrices[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? -diff : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }

    return rsi;
  }

  function drawDailyChartWithIndicators(candles) {
    const chartContainer = document.getElementById('dailyChart');
    chartContainer.style.height = '400px';
    chartContainer.style.width = '800px';
    const chart = LightweightCharts.createChart(chartContainer, { height: 400, width: 800 });
    const candleSeries = chart.addCandlestickSeries();
    candleSeries.setData(candles);

    const sma50 = calculateSMA(candles, 50);
    const sma200 = calculateSMA(candles, 200);
    chart.addLineSeries({ color: '#FF6D00' }).setData(sma50);
    chart.addLineSeries({ color: '#43A047' }).setData(sma200);

    for (const f of findFractals(candles)) {
      chart.addShape({
        time: f.time,
        price: f.price,
        shape: f.position === 'above' ? 'arrowDown' : 'arrowUp',
        color: f.position === 'above' ? '#f44336' : '#2196f3',
        text: '',
        shapeId: `${f.time}-${f.price}`,
      });
    }

    // Momentum
    const momentumContainer = document.getElementById('momentumChart');
    momentumContainer.style.height = '100px';
    momentumContainer.style.width = '800px';
    const momentumChart = LightweightCharts.createChart(momentumContainer, { height: 100, width: 800 });
    const momentumSeries = momentumChart.addHistogramSeries({ priceFormat: { type: 'volume' } });
    momentumSeries.setData(calculateMomentum(candles));

    // RSI
    const rsiContainer = document.getElementById('rsiChart');
    rsiContainer.style.height = '100px';
    rsiContainer.style.width = '800px';
    const rsiChart = LightweightCharts.createChart(rsiContainer, { height: 100, width: 800 });
    const rsiValues = calculateRSI(candles.map(c => c.close));
    const rsiSeries = rsiChart.addLineSeries({ color: '#7E57C2', lineWidth: 2 });
    rsiSeries.setData(rsiValues.map((v, i) => ({ time: candles[i]?.time, value: v })));
    rsiChart.addLineSeries({ color: '#ccc' }).setData(candles.map(c => ({ time: c.time, value: 70 })));
    rsiChart.addLineSeries({ color: '#ccc' }).setData(candles.map(c => ({ time: c.time, value: 30 })));
  }

  function drawSimpleChart(containerId, candles) {
    const container = document.getElementById(containerId);
    container.style.height = '400px';
    container.style.width = '800px';
    const chart = LightweightCharts.createChart(container, { height: 400, width: 800 });
    chart.addCandlestickSeries().setData(candles);
  }

  const dailyCandles = await fetchCandles('BTCUSDT', '1d', 300);
  const hourlyCandles = await fetchCandles('BTCUSDT', '1h', 300);

  drawDailyChartWithIndicators(dailyCandles);
  drawSimpleChart('hourlyChart', hourlyCandles);

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
