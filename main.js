console.log('✅ MAIN.JS LOADED', Date.now());

const chart = LightweightCharts.createChart(
  document.getElementById('chartContainer'),
  { width: 800, height: 400 }
);

const series = chart.addLineSeries({ color: '#2962FF' });

(async () => {
  const { data } = await axios.get(
    'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=150'
  );
  series.setData(data.map(c => ({ time: c[0] / 1000, value: +c[4] })));
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
