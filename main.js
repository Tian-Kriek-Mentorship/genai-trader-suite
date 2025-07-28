/* ---------- main.js (clean) ---------- */
import axios from 'https://cdn.jsdelivr.net/npm/axios@1.6.8/+esm';

/* expose the chart object globally so we can probe it */
window.chartApi = window.LightweightCharts.createChart(
  document.getElementById('chartContainer'),
  { width: 800, height: 400 }
);
const series = window.chartApi.addLineSeries({ color: '#2962FF' });

/* load BTC‑USDT closes */
(async () => {
  try {
    const url = 'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=150';
    const { data } = await axios.get(url);
    series.setData(data.map(c => ({ time: c[0] / 1000, value: +c[4] })));
  } catch (e) {
    console.error('Price‑data fetch failed:', e);
  }
})();

/* AI summary button */
document.getElementById('aiBtn').onclick = async () => {
  const out = document.getElementById('out');
  out.textContent = 'Loading AI summary…';
  try {
    const { data } = await axios.get('/api/ai');
    out.textContent = data.text.trim();
  } catch (e) {
    out.textContent = 'Error: ' + (e.response?.data?.error || e.message);
  }
};
