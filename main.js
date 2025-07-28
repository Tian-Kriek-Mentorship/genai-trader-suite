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

// —————————————————————————————————————————————————————————————————————
// 7) Fibonacci + auto‑zoom (stores fibTarget in chart state)
// —————————————————————————————————————————————————————————————————————
function drawFibsOnChart(containerId) {
  const e = charts[containerId];
  if (!e) return;
  const { chart, series, data } = e;
  const opens = data.map(d=>d.open), highs = data.map(d=>d.high), lows = data.map(d=>d.low);
  const ma50  = sma(opens,50), ma200 = sma(opens,200);
  let lastGC=-1, lastDC=-1;
  for (let i=1; i<opens.length; i++){
    if (ma50[i]>ma200[i] && ma50[i-1]<=ma200[i-1]) lastGC=i;
    if (ma50[i]<ma200[i] && ma50[i-1]>=ma200[i-1]) lastDC=i;
  }
  const isUp = lastGC>lastDC, idx = isUp?lastGC:lastDC;
  if (idx<0) return;

  let pre = idx, start = ((isUp?lastDC:lastGC)>0 ? (isUp?lastDC:lastGC):0);
  for (let i=start; i<idx; i++){
    if (isUp? lows[i]<lows[pre] : highs[i]>highs[pre]) pre=i;
  }
  let post=-1;
  for (let i=idx+2; i<data.length-2; i++){
    const fh = highs[i]>highs[i-1]&&highs[i]>highs[i-2]&&highs[i]>highs[i+1]&&highs[i]>highs[i+2];
    const fl = lows[i]<lows[i-1] && lows[i]<lows[i-2] && lows[i]<lows[i+1] && lows[i]<lows[i+2];
    if (isUp && fh) { post=i; break; }
    if (!isUp && fl) { post=i; break; }
  }
  if (post<0) return;

  const preP  = isUp? lows[pre] : highs[pre],
        postP = isUp? highs[post]: lows[post],
        r     = Math.abs(postP-preP);
  const retrace = isUp? postP-r*0.618: postP+r*0.618,
        ext127  = isUp? postP+r*0.27 : postP-r*0.27,
        ext618  = isUp? postP+r*0.618: postP-r*0.618,
        ext2618 = isUp? postP+r*1.618: postP-r*1.618;
  let touched=false, moved127=false;
  for (let i=post+1; i<data.length; i++){
    if (isUp){ if(lows[i]<=retrace) touched=true; if(highs[i]>=ext127) moved127=true; }
    else    { if(highs[i]>=retrace) touched=true; if(lows[i]<=ext127) moved127=true; }
  }
  const level = touched?ext618:(!touched&&!moved127?ext127:ext2618);
  series.createPriceLine({ price:level, color:'darkgreen', lineWidth:2, axisLabelVisible:true });

  // stash the target for the scanner
  charts[containerId].fibTarget = level;

  // force-zoom
  if (!e.zoomSeries) {
    const zs = chart.addLineSeries({ color:'rgba(0,0,0,0)', lineWidth:0 });
    e.zoomSeries = zs;
  }
  e.zoomSeries.setData([
    { time:data[0].time,            value:level },
    { time:data[data.length-1].time, value:level }
  ]);
}

// —————————————————————————————————————————————————————————————————————
// 8) EMA & probability overlay
// —————————————————————————————————————————————————————————————————————
function drawEMAandProbability(containerId) {
  const e = charts[containerId];
  if (!e || !e.emaArr) return false;
  const lastClose = e.data[e.data.length-1].close;
  const lastEma   = e.emaArr[e.emaArr.length-1];
  const bull      = lastClose > lastEma;
  const id        = `${containerId}-prob`;
  let div = document.getElementById(id);
  if (!div) {
    div = document.createElement('div');
    div.id = id;
    div.style.position      = 'absolute';
    div.style.top           = '8px';
    div.style.left          = '8px';
    div.style.zIndex        = '20';
    div.style.fontSize      = '16px';
    div.style.fontWeight    = 'bold';
    div.style.whiteSpace    = 'pre';
    div.style.pointerEvents = 'none';
    document.getElementById(containerId).appendChild(div);
  }
  div.style.color    = bull ? 'green' : 'red';
  div.textContent    = `${bull?'▲':'▼'}\nProbability - ${bull?'Bullish':'Bearish'}`;
  return bull;
}


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
