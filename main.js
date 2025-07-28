// main.js

// ─── 1) Top‑10 USDT trading pairs ───────────────────────────────────
const symbols = [
  'BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT',
  'SOLUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','AVAXUSDT'
];

// ─── 2) DOM refs ────────────────────────────────────────────────────
const symbolSelect = document.getElementById('symbolSelect');
const dailyTitle   = document.getElementById('dailyTitle');
const hourlyTitle  = document.getElementById('hourlyTitle');
const aiBtn        = document.getElementById('aiBtn');
const outPre       = document.getElementById('out');

// ─── 3) Populate dropdown ──────────────────────────────────────────
symbols.forEach(sym => {
  const opt = document.createElement('option');
  opt.value = sym;
  opt.text  = sym.replace('USDT', '/USDT');
  symbolSelect.appendChild(opt);
});

// ─── 4) Your AI‐summary function ────────────────────────────────────
// Replace the body of this with your actual AI‐call (e.g. axios→OpenAI).
async function generateAISummary() {
  const sym = symbolSelect.value;
  outPre.textContent = 'Loading AI summary for ' + sym + ' …';

  try {
    // EXAMPLE placeholder: swap this out for your real endpoint & payload
    const resp = await axios.post('/api/ai-summary', { symbol: sym });
    outPre.textContent = resp.data.summary;
  } catch (err) {
    console.error(err);
    outPre.textContent = '❌ Failed to load summary.';
  }
}

// ─── 5) Wire up the AI button correctly ───────────────────────────
aiBtn.addEventListener('click', generateAISummary);

// ─── 6) Unified update function ────────────────────────────────────
async function updateDashboard() {
  const sym = symbolSelect.value;

  // update headings
  dailyTitle.textContent  = `${sym} — Daily`;
  hourlyTitle.textContent = `${sym} — 1 Hour`;

  // redraw charts
  await fetchAndDraw(sym, 'daily',  '1d', 'dailyChart');
  await fetchAndDraw(sym, 'hourly', '1h', 'hourlyChart');

  // then auto‐run the summary
  await generateAISummary();
}

// ─── 7) Hook symbol‐change & initial load ──────────────────────────
symbolSelect.addEventListener('change', updateDashboard);
updateDashboard();  // on page load

// ─── helper: fetch + draw ──────────────────────────────────────────
async function fetchAndDraw(symbol, type, interval, containerId) {
  const end   = Date.now();
  const start = end - (type === 'daily'
    ? 365 * 24 * 3600 * 1000
    :   7 * 24 * 3600 * 1000);
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
    rightPriceScale: { scaleMargins: { top:0.1, bottom:0.1 } },
    timeScale:        { timeVisible:true, secondsVisible:false }
  });

  const series = chart.addCandlestickSeries();
  series.setData(data);
}
