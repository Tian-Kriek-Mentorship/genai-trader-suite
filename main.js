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

  function drawChart(containerId, candles) {
    const chartContainer = document.getElementById(containerId);
    chartContainer.style.height = '400px';
    chartContainer.style.width = '800px';

    const chart = LightweightCharts.createChart(chartContainer, {
      width: 800,
      height: 400
    });

    const candleSeries = chart.addCandlestickSeries();
    candleSeries.setData(candles);
  }

  const dailyCandles = await fetchCandles('BTCUSDT', '1d', 300);
  const hourlyCandles = await fetchCandles('BTCUSDT', '1h', 300);

  drawChart('dailyChart', dailyCandles);
  drawChart('hourlyChart', hourlyCandles);

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
