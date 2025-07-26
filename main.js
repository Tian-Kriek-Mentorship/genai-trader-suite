/* ---------- main.js ---------- */
import axios from 'https://cdn.jsdelivr.net/npm/axios@1.6.8/+esm';
const { createChart } = window.LightweightCharts;

/* chart */
const chart  = createChart(document.getElementById('chart'), { width: 800, height: 400 });
const series = chart.addLineSeries({ color: '#2962FF' });

(async () => {
  const url = 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=150';
  const { data } = await axios.get(url);
  series.setData(data.map(c => ({ time: c[0] / 1000, value: +c[4] })));
})();

/* AI summary */
document.getElementById('aiBtn').onclick = async () => {
  const out = document.getElementById('out');
  out.textContent = 'Loading AI summary…';
  try { out.textContent = (await axios.get('/api/ai')).data.text.trim(); }
  catch (e) { out.textContent = 'Error: ' + (e.response?.data?.error || e.message); }
};
