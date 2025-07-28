// main.js

// 1) Top‑10 USDT trading pairs
const symbols = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
  'SOLUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT', 'AVAXUSDT'
];

// 2) DOM references
const symbolSelect = document.getElementById('symbolSelect');
const dailyTitle   = document.getElementById('dailyTitle');
const hourlyTitle  = document.getElementById('hourlyTitle');
const aiBtn        = document.getElementById('aiBtn');
const outPre       = document.getElementById('out');

// 3) Populate the symbol dropdown
symbols.forEach(sym => {
  const opt = document.createElement('option');
  opt.value = sym;
  opt.text  = sym.replace('USDT', '/USDT');
  symbolSelect.appendChild(opt);
});

// 4) Generate AI summary (GET + flexible parsing)
async function generateAISummary() {
  const sym = symbolSelect.value;
  outPre.textContent = `Loading AI summary for ${sym}…`;

  try {
    const resp = await axios.get('/api/ai', {
      params: { symbol: sym }
    });
    console.log('[AI] raw response:', resp);

    let summary;
    if (typeof resp.data === 'string') {
      summary = resp.data;
    } else if (resp.data.summary) {
      summary = resp.data.summary;
    } else if (resp.data.text) {
      summary = resp.data.text;
    } else {
      summary = JSON.stringify(resp.data, null, 2);
    }

    outPre.textContent = summary;
  } catch (err) {
    console.error('[AI] error', err);
    outPre.textContent = `❌ AI error: ${err.message}`;
  }
}

// 5) Attach AI button handler
aiBtn.addEventListener('click', generateAISummary);

// 6) Unified dashboard update
async function updateDashboard() {
  const sym = symbolSelect.value;

  // update titles
  dailyTitle.textContent  = `${sym} — Daily`;
  hourlyTitle.textContent = `${sym} — 1 Hour`;

  // redraw charts
  await fetchAndDraw(sym, 'daily',  '1d', 'dailyChart');
  await fetchAndDraw(sym, 'hourly', '1h', 'hourlyChart');

  // then auto‐run the AI summary
  await generateAISummary();
}

// 7) Hook symbol change + initial load
symbolSelect.addEventListener('change', updateDashboard);
updateDashboard();

// ─── helper: fetch OHLC + draw ────────────────────────────────────
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
  container.innerHTML = ''; // clear previous

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
