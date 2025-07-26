/* ---------- main.js ----------
   Pure‑browser version: one CDN import and one global object.
   No build step, no API keys required for charts.
*/

/* 1 · dependencies */
import axios from 'https://cdn.jsdelivr.net/npm/axios@1.6.8/+esm';
const { createChart } = window.LightweightCharts;   // provided by the bundle tag

/* 2 · render BTC‑USDT line chart (last 150 daily closes) */
const chart = createChart(document.getElementById('chart'), { width: 800, height: 400 });
const series = chart.addLineSeries({ color: '#2962FF' });

(async () => {
  const url =
    'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=150';
  const { data } = await axios.get(url);
  series.setData(
    data.map(c => ({
      time: c[0] / 1000,          // ms → s
      value: parseFloat(c[4]),    // close price
    })),
  );
})();

/* 3 · AI‑summary button */
document.getElementById('aiBtn').onclick = async () => {
  const out = document.getElementById('out');
  out.textContent = 'Loading AI summary…';
  try {
    const res = await axios.get('/api/ai');          // calls api/ai.js on Vercel
    out.textContent = res.data.text.trim();
  } catch (err) {
    out.textContent = 'Error: ' + (err.response?.data?.error || err.message);
  }
};
