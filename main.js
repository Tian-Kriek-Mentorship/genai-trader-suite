/* ---------- main.js ---------- */
// main.js  — use jsDelivr ES‑modules (CORS‑ready)
import { createChart } from 'https://cdn.jsdelivr.net/npm/lightweight-charts@5.0.8/dist/lightweight-charts.esm.js';
import axios from 'https://cdn.jsdelivr.net/npm/axios@1.6.8/dist/axios.esm.min.js';



/* 1 · Render a BTC‑USDT line chart (last 150 daily closes) */
const chart = createChart(document.getElementById('chart'), {
  width: 800,
  height: 400,
});
const series = chart.addLineSeries({ color: '#2962FF' });

(async function loadData() {
  const url =
    'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=150';
  const { data } = await axios.get(url);
  series.setData(
    data.map(candle => ({
      time: candle[0] / 1000,       // Binance gives ms; convert to seconds
      value: parseFloat(candle[4]), // Close price
    })),
  );
})();

/* 2 · AI Summary button */
document.getElementById('aiBtn').onclick = async () => {
  const out = document.getElementById('out');
  out.textContent = 'Loading AI summary…';

  try {
    const res = await axios.get('/api/ai');
    out.textContent = res.data.text.trim();
  } catch (err) {
    out.textContent = 'Error: ' + (err.response?.data?.error || err.message);
  }
};
