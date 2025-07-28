// main.js
// 1. Top-10 USDT trading pairs
const symbols = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
  'SOLUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT', 'AVAXUSDT'
];

const symbolSelect = document.getElementById('symbolSelect');
const dailyTitle   = document.getElementById('dailyTitle');
const hourlyTitle  = document.getElementById('hourlyTitle');
const aiBtn        = document.getElementById('aiBtn');
const outPre       = document.getElementById('out');

// Populate dropdown
symbols.forEach(sym => {
  const opt = document.createElement('option');
  opt.value = sym;
  opt.text  = sym.replace('USDT', '/USDT');
  symbolSelect.appendChild(opt);
});

// On symbol change → redraw charts
symbolSelect.addEventListener('change', () => {
  const sym = symbolSelect.value;
  dailyTitle.textContent  = `${sym} — Daily`;
  hourlyTitle.textContent = `${sym} — 1 Hour`;
  fetchAndDraw(sym, 'daily',  '1d', 'dailyChart')
    .then(() => fetchAndDraw(sym, 'hourly', '1h', 'hourlyChart'))
    .then(() => {
      // after both charts are drawn, auto‑trigger AI summary
      aiBtn.click();
    });
});

// Initial render + auto‑AI on load
document.addEventListener('DOMContentLoaded', () => {
  symbolSelect.value = symbols[0];
  symbolSelect.dispatchEvent(new Event('change'));
});

// Fetch & draw helper
async function fetchAndDraw(symbol, type, interval, containerId) {
  const end = Date.now();
  const start = end - (type === 'daily'
    ? 365 * 24 * 3600 * 1000
    : 7   * 24 * 3600 * 1000);
  const limit = type === 'daily' ? 365 : 168;

  const resp = await axios.get('https://api.binance.com/api/v3/klines', {
    params: { symbol, interval, startTime: start, endTime: end, limit }
  });

  const data = resp.data.map(k => ({
    time:  k[0] / 1000,
    open:  parseFloat(k[1]),
    high:  parseFloat(k[2]),
    low:   parseFloat(k[3]),
    close: parseFloat(k[4])
  }));

  const container = document.getElementById(containerId);
  container.innerHTML = ''; // clear old chart

  const chart = LightweightCharts.createChart(container, {
    width:  container.clientWidth,
    height: container.clientHeight,
    layout: { textColor: '#000' },
    rightPriceScale: { scaleMargins: { top: 0.1, bottom: 0.1 } },
    timeScale: { timeVisible: true, secondsVisible: false }
  });
  const series = chart.addCandlestickSeries();
  series.setData(data);
}

// (Assumes you already have an event listener on #aiBtn that fills #out)
