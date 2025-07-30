// scanner.js
import { 
  symbols, 
  cryptoSymbols, 
  equitiesSymbols, 
  etfSymbols,
  loadCache,
  saveCache,
  fetchAndRender,
  drawEMAandProbability,
  drawRSIandSignal,
  drawFibsOnChart,
  getPositiveCarryFX,
  getProjectedAnnualReturn
} from './main.js';  // adjust path if needed

// 1‑hour cache
let lastScan = { ts: 0, data: [] };

function renderScannerRows(rows) {
  const tbody = document.querySelector('#scannerTable tbody');
  tbody.innerHTML = '';
  rows.forEach(r => tbody.append(r));
}

export async function runScanner() {
  const now = Date.now();
  if (now - lastScan.ts < 60*60*1000) {
    return renderScannerRows(lastScan.data);
  }

  const filter = document.getElementById('scannerFilter').value.trim().toUpperCase();
  let list = filter
    ? symbols.filter(s => s.includes(filter))
    : symbols.slice();

  // dedupe
  list = Array.from(new Set(list));

  const rows = [];
  let count = 0;
  for (const sym of list) {
    if (!filter && count >= 20) break;

    // daily
    await fetchAndRender(sym, '1d', 'scannerTempDaily');
    const pb = drawEMAandProbability('scannerTempDaily');

    // hourly
    await fetchAndRender(sym, '1h', 'scannerTempHourly');
    drawFibsOnChart('scannerTempHourly');
    const h1T = window.charts.scannerTempHourly?.fibTarget ?? '—';
    const sg = drawRSIandSignal('scannerTempHourly', pb);

    if (!filter && pb === false && sg === null) continue;

    // status
    let statusText, statusColor;
    if (sg === true)      { statusText='Buy Signal confirmed';  statusColor='green'; }
    else if (sg === false){ statusText='Sell Signal confirmed'; statusColor='red';   }
    else                  { statusText=pb?'Wait for Buy Signal':'Wait for Sell Signal'; statusColor='gray'; }

    // projected return
    let proj = '—';
    if (cryptoSymbols.includes(sym)) {
      const c = await getProjectedAnnualReturn(sym);
      proj = (typeof c === 'number')?`${(c*100).toFixed(2)}%`:'N/A';
    } else if (equitiesSymbols.includes(sym) || etfSymbols.includes(sym)) {
      const bars = window.charts.scannerTempDaily.data;
      if (bars.length > 1) {
        const first=bars[0].close, last=bars[bars.length-1].close;
        const yrs=(bars[bars.length-1].time-bars[0].time)/(365*24*60*60);
        const cagr=Math.pow(last/first,1/yrs)-1;
        proj=`${(cagr*100).toFixed(2)}%`;
      } else proj='N/A';
    }

    const tr = document.createElement('tr');
    tr.innerHTML=`
      <td>${sym}</td>
      <td style="color:${pb?'green':'red'}">${pb?'Bullish':'Bearish'}</td>
      <td style="color:${statusColor}">${statusText}</td>
      <td>${(typeof h1T==='number'?h1T.toFixed(4):h1T)}</td>
      <td style="text-align:right;">${proj}</td>
    `;
    rows.push(tr);
    count++;
  }

  lastScan = { ts: now, data: rows };
  renderScannerRows(rows);
}
