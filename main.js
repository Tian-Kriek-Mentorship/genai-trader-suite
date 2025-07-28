// main.js

// 1) References
const symbolSelect   = document.getElementById('symbolSelect');
const dailyTitle     = document.getElementById('dailyTitle');
const hourlyTitle    = document.getElementById('hourlyTitle');
const aiBtn          = document.getElementById('aiBtn');
const outPre         = document.getElementById('out');
const scannerFilter  = document.getElementById('scannerFilter');
const scannerTbody   = document.querySelector('#scannerTable tbody');

// 2) State
let symbols = [];         // filled from Binance
const charts = {};

// 3) Helpers: EMA, SMA, RSI
function ema(arr, p) { /* same as before */ }
function sma(arr, p) { /* same as before */ }
function rsi(arr, p) { /* same as before */ }

// 4) Load USDT symbols from Binance (unique)
async function loadSymbols() {
  try {
    const info = await axios.get('https://api.binance.com/api/v3/exchangeInfo');
    symbols = Array.from(new Set(
      info.data.symbols
        .map(x=>x.symbol)
        .filter(x=>x.endsWith('USDT'))
    )).sort();
    // dropdown
    symbols.forEach(sym=>{
      const o = document.createElement('option');
      o.value = sym; o.text = sym.replace('USDT','/USDT');
      symbolSelect.append(o);
    });
    symbolSelect.value = symbols[0];
    await updateDashboard();
  } catch(err) {
    console.error(err);
    outPre.textContent = '❌ Failed to load symbols';
  }
}

// 5) AI summary
async function generateAISummary() { /* same as before */ }
aiBtn.addEventListener('click', generateAISummary);

// 6) Update dashboard (charts + overlays + scanner)
async function updateDashboard() {
  const sym = symbolSelect.value;
  dailyTitle.textContent  = `${sym} — Daily`;
  hourlyTitle.textContent = `${sym} — 1 Hour`;

  await fetchAndDraw(sym,'daily','1d','dailyChart');
  await fetchAndDraw(sym,'hourly','1h','hourlyChart');
  drawFibsOnChart('dailyChart');
  drawFibsOnChart('hourlyChart');

  const bullDaily = drawEMAandProbability('dailyChart');
  drawRSIandSignal('hourlyChart', bullDaily);

  await generateAISummary();
  await runScanner();
}
symbolSelect.addEventListener('change', updateDashboard);

// on load
window.addEventListener('load', loadSymbols);

// 7) fetchAndDraw (includes 1d EMA injection)
async function fetchAndDraw(sym,type,intv,containerId) {
  /* same as before */
}

// 8) drawFibsOnChart, drawEMAandProbability, drawRSIandSignal
/* reuse your existing code exactly here – unchanged */

// 9) Scanner: top‑20 default + live filter
async function runScanner() {
  scannerTbody.innerHTML = '';
  let list = symbols.slice(0, 20);
  const f = scannerFilter.value.trim().toUpperCase();
  if (f) list = symbols.filter(s => s.includes(f));

  // ensure temp divs exist
  ['scannerTempDaily','scannerTempHourly'].forEach(id=>{
    if (!document.getElementById(id)) {
      const d = document.createElement('div');
      d.id = id;
      d.style.display = 'none';
      document.body.appendChild(d);
    }
  });

  for (const sym of list) {
    await fetchAndDraw(sym,'daily','1d','scannerTempDaily');
    const prob = drawEMAandProbability('scannerTempDaily');
    await fetchAndDraw(sym,'hourly','1h','scannerTempHourly');
    drawFibsOnChart('scannerTempHourly');
    const h1Target = charts['scannerTempHourly'].fibTarget ?? '—';
    const sig      = drawRSIandSignal('scannerTempHourly', prob);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${sym}</td>
      <td style="color:${prob?'green':'red'}">${prob?'Bullish':'Bearish'}</td>
      <td style="color:${sig===true?'green':sig===false?'red':'gray'}">
        ${sig===true?'Buy Signal confirmed':sig===false?'Sell Signal confirmed':'Wait for signal'}
      </td>
      <td>${typeof h1Target === 'number' ? h1Target.toFixed(2) : h1Target}</td>`;
    scannerTbody.append(tr);
  }
}

// live filter
scannerFilter.addEventListener('input', runScanner);
