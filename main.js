/* ---------- main.js ----------
   zero‑build version
   1. uses global LightweightCharts bundle
   2. pulls Axios via jsDelivr (+esm = CORS‑ready)
*/

/* deps */
import axios from 'https://cdn.jsdelivr.net/npm/axios@1.6.8/+esm';

const chartApi = window.LightweightCharts.createChart(
  document.getElementById('chartContainer'),
  { width: 800, height: 400 }
);
const series = chartApi.addLineSeries({ color: '#2962FF' });

/* load BTC‑USDT closes (last 150 days) */
(async () => {
  const url =
    'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=150';
  const { data } = await axios.get(url);
  series.setData(
    data.map(c => ({ time: c[0] / 1000, value: +c[4] }))
  );
})();

/* AI summary */
document.getElementById('aiBtn').onclick = async () => {
  const out = document.getElementById('out');
  out.textContent = 'Loading AI summary…';
  try {
    const { data } = await axios.get('/api/ai');
    out.textContent = data.text.trim();
  } catch (e) {
    out.textContent =
      'Error: ' + (e.response?.data?.error || e.message);
  }
};
