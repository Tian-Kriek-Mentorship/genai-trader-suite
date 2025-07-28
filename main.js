// main.js

// 1. Top‑10 USDT trading pairs
const symbols = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
  'SOLUSDT', 'DOGEUSDT', 'DOTUSDT', 'MATICUSDT', 'AVAXUSDT'
];

// 2. Grab DOM refs
const symbolSelect = document.getElementById('symbolSelect');
const dailyTitle   = document.getElementById('dailyTitle');
const hourlyTitle  = document.getElementById('hourlyTitle');
const aiBtn        = document.getElementById('aiBtn');
const outPre       = document.getElementById('out');

// 3. Populate the dropdown
symbols.forEach(sym => {
  const opt = document.createElement('option');
  opt.value = sym;
  opt.text  = sym.replace('USDT', '/USDT');
  symbolSelect.appendChild(opt);
});

// 4. Your existing AI‑summary click handler should stay in place;
//    we assume you already have something like:
aiBtn.addEventListener('click', /* yourSummaryFunction */);

// 5. Unified update function
async function updateDashboard() {
  const sym = symbolSelect.value;

  // update headings
  dailyTitle.textContent  = `${sym} — Daily`;
  hourlyTitle.textContent = `${sym} — 1 Hour`;

  // draw both charts
  await fetchAndDraw(sym, 'daily',  '1d', 'dailyChart');
  await fetchAndDraw(sym, 'hourly', '1h', 'hourlyChart');

  // then run your AI summary logic directly
  // if yourSummaryFunction reads from #out, just call it here:
  aiBtn.click(); 
}

// 6. Wire it up
symbolSelect.addEventListener('change', updateDashboard);

// 7. Kickoff on load
updateDashboard();


// ─── helper: fetch + draw ─────────────────────────────────────────

async function fetchAndDraw(symbol, type, interval, containerId) {
  const end   = Date.now();
  const start = end - (type === 'daily'
    ? 365 * 24 * 3600 * 1000  // last year
    :   7 * 24 * 3600 * 1000); // last week
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
