/* ---------- main.js ----------
   Loads Axios as an ES‑module from jsDelivr
   and pulls createChart from the global bundle
   we loaded in <index.html>. No build step needed. */

/* 1 · dependencies */
import axios from 'https://cdn.jsdelivr.net/npm/axios@1.6.8/+esm';
const { createChart } = window.LightweightCharts;   // provided by the <script> tag in index.html

/* 2 · render BTC‑USDT line chart (last 150 daily closes) */
const chart = createChart(document.getElementById('chart'), {
  width: 800,
  height: 400,
});
const series = chart.addLineSeries({ color: '#2962FF' });

(async () => {
  const url =
    'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=150';
  const { data } = await axios.get(url);
  series.setData(
    data.map(candle => ({
      time: candle[0] / 1000,        // ms → s
      value: parseFloat(candle[4]),  // close
    })),
  );
})();

/* 3 · AI‑summary button */
document.getElementById('aiBtn').onclick = async () => {
  const out = document.getElementById('out');
  out.textContent = 'Loading AI summary…';

  try {
    const res = await axios.get('/api/ai');
    out.textContent = res.data.text.trim();
  } catch (err) {
    out.textContent =
      'Error: ' + (err.response?.data?.error || err.message);
  }
};
