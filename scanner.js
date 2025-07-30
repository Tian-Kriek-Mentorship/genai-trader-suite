// scanner.js

import {
  symbols,
  cryptoSymbols,
  equitiesSymbols,
  etfSymbols,
  getPositiveCarryFX
} from './utils.js';

import {
  fetchAndRender,
  drawEMAandProbability,
  drawFibsOnChart,
  drawRSIandSignal,
  getProjectedAnnualReturn,
  charts
} from './utils.js';

const scannerTbody  = document.querySelector('#scannerTable tbody');
const scannerFilter = document.getElementById('scannerFilter');

let lastScan = { ts: 0, data: [] };

function renderScannerRows(rows) {
  scannerTbody.innerHTML = '';
  rows.forEach(r => scannerTbody.append(r));
}

export async function runScanner() {
  const now = Date.now();
  if (now - lastScan.ts < 3600_000) {
    return renderScannerRows(lastScan.data);
  }

  const filter = scannerFilter.value.trim().toUpperCase();
  let list = filter
    ? symbols.filter(s => s.includes(filter))
    : symbols.slice();

  // dedupe
  list = [...new Set(list)];

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
    const h1T = charts.scannerTempHourly?.fibTarget ?? '—';
    const sg  = drawRSIandSignal('scannerTempHourly', pb);

    if (!filter && pb === false && sg === null) continue;

    let statusText, statusColor;
    if (sg === true)       { statusText='Buy Signal confirmed';  statusColor='green'; }
    else if (sg === false) { statusText='Sell Signal confirmed'; statusColor='red';   }
    else                   { statusText=pb?'Wait for Buy Signal':'Wait for Sell Signal'; statusColor='gray'; }

    let proj = '—';
    if (cryptoSymbols.includes(sym)) {
      const cagr = await getProjectedAnnualReturn(sym);
      proj = (typeof cagr==='number')?`${(cagr*100).toFixed(2)}%`:'N/A';
    } else if (equitiesSymbols.includes(sym) || etfSymbols.includes(sym)) {
      const bars = charts.scannerTempDaily.data;
      if (bars?.length>1) {
        const first = bars[0].close,
              last  = bars[bars.length-1].close,
              yrs   = (bars[bars.length-1].time-bars[0].time)/(365*24*60*60),
              cagr  = Math.pow(last/first,1/yrs)-1;
        proj = `${(cagr*100).toFixed(2)}%`;
      } else proj = 'N/A';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${sym}</td>
      <td style="color:${pb?'green':'red'}">${pb?'Bullish':'Bearish'}</td>
      <td style="color:${statusColor}">${statusText}</td>
      <td>${typeof h1T==='number'?h1T.toFixed(4):h1T}</td>
      <td style="text-align:right;">${proj}</td>
    `;
    rows.push(tr);
    count++;
  }

  lastScan = { ts: now, data: rows };
  renderScannerRows(rows);
}

// wire up filtering immediately
scannerFilter.addEventListener('input', runScanner);
