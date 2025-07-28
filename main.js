// main.js

// —————————————————————————————————————————————————————————————————————
// 1) DOM refs
// —————————————————————————————————————————————————————————————————————
const symbolSelect = document.getElementById('symbolSelect');
const dailyTitle   = document.getElementById('dailyTitle');
const hourlyTitle  = document.getElementById('hourlyTitle');
const aiBtn        = document.getElementById('aiBtn');
const outPre       = document.getElementById('out');
const scannerTbody = document.querySelector('#scannerTable tbody');

// Will hold our unique USDT symbols
let symbols = [];

// Central storage for chart data
const charts = {};

// —————————————————————————————————————————————————————————————————————
// 2) Helpers (EMA, SMA, RSI)
// —————————————————————————————————————————————————————————————————————
function ema(arr, period) {
  const k = 2 / (period + 1), out = [];
  let prev;
  for (let i = 0; i < arr.length; i++) {
    if (i === period - 1) {
      prev = arr.slice(0, period).reduce((a,b)=>a+b,0) / period;
      out[i] = prev;
    } else if (i >= period) {
      prev = arr[i] * k + prev * (1 - k);
      out[i] = prev;
    } else {
      out[i] = null;
    }
  }
  return out;
}

function sma(arr, period) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += arr[j];
    out.push(sum / period);
  }
  return out;
}

function rsi(arr, period) {
  const gains = [], losses = [], out = [];
  for (let i = 1; i < arr.length; i++) {
    const d = arr[i] - arr[i-1];
    gains.push(d>0 ? d : 0);
    losses.push(d<0 ? -d: 0);
  }
  let avgGain = gains.slice(0,period).reduce((a,b)=>a+b,0)/period;
  let avgLoss = losses.slice(0,period).reduce((a,b)=>a+b,0)/period;
  out[period] = 100 - (100 / (1 + avgGain/avgLoss));
  for (let i = period+1; i < arr.length; i++) {
    avgGain = (avgGain*(period-1) + gains[i-1]) / period;
    avgLoss = (avgLoss*(period-1) + losses[i-1]) / period;
    out[i] = 100 - 100/(1 + avgGain/avgLoss);
  }
  return out;
}

// —————————————————————————————————————————————————————————————————————
// 3) Fetch and populate the symbol list (unique USDT pairs)
// —————————————————————————————————————————————————————————————————————
async function loadSymbols() {
  try {
    const info = await axios.get('https://api.binance.com/api/v3/exchangeInfo');
    // filter for USDT pairs, then dedupe via Set
    symbols = Array.from(new Set(
      info.data.symbols
        .map(s=>s.symbol)
        .filter(sym=>sym.endsWith('USDT'))
    )).sort();

    // populate dropdown
    for (const sym of symbols) {
      const opt = document.createElement('option');
      opt.value = sym;
      opt.text  = sym.replace('USDT','/USDT');
      symbolSelect.append(opt);
    }

    // select first symbol & kick off dashboard
    symbolSelect.value = symbols[0];
    await updateDashboard();

  } catch (e) {
    console.error('Failed to load symbols', e);
    outPre.textContent = '❌ Error loading symbols';
  }
}

// —————————————————————————————————————————————————————————————————————
// 4) AI Summary
// —————————————————————————————————————————————————————————————————————
async function generateAISummary() {
  const sym = symbolSelect.value;
  outPre.textContent = `Loading AI summary for ${sym}…`;
  try {
    const resp = await axios.get('/api/ai',{ params:{ symbol:sym } });
    const summary = typeof resp.data==='string'?resp.data:
      resp.data.summary?resp.data.summary:
      resp.data.text?resp.data.text:
      JSON.stringify(resp.data,null,2);
    outPre.textContent = summary;
  } catch(e) {
    console.error(e);
    outPre.textContent = `❌ AI error: ${e.message}`;
  }
}
aiBtn.addEventListener('click', generateAISummary);

// —————————————————————————————————————————————————————————————————————
// 5) Main update: draw charts, overlays, scanner
// —————————————————————————————————————————————————————————————————————
async function updateDashboard() {
  const sym = symbolSelect.value;
  dailyTitle.textContent  = `${sym} — Daily`;
  hourlyTitle.textContent = `${sym} — 1 Hour`;

  // Draw charts
  await fetchAndDraw(sym,'daily','1d','dailyChart');
  await fetchAndDraw(sym,'hourly','1h','hourlyChart');
  drawFibsOnChart('dailyChart');
  drawFibsOnChart('hourlyChart');

  // Overlays
  const bullDaily = drawEMAandProbability('dailyChart');
  drawRSIandSignal('hourlyChart', bullDaily);

  // AI summary
  await generateAISummary();

  // Scanner
  await runScanner();
}
symbolSelect.addEventListener('change',updateDashboard);

// Kick off symbol loading on page load
loadSymbols();

// —————————————————————————————————————————————————————————————————————
// 6) fetch + draw candlesticks (+ daily EMA injection for any 1d series)
// —————————————————————————————————————————————————————————————————————
async function fetchAndDraw(symbol,type,interval,containerId) {
  const limit=1000;
  const resp=await axios.get('https://api.binance.com/api/v3/klines',{
    params:{ symbol, interval, limit }
  });
  const data = resp.data.map(k=>({
    time:k[0]/1000, open:+k[1], high:+k[2], low:+k[3], close:+k[4]
  }));

  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const chart = LightweightCharts.createChart(container,{
    layout:{ textColor:'#000' },
    rightPriceScale:{ scaleMargins:{ top:0.3,bottom:0.1 } },
    timeScale:{ timeVisible:true, secondsVisible:false }
  });
  const series = chart.addCandlestickSeries();
  series.setData(data);

  charts[containerId] = { chart, series, data };

  // if interval is daily (including hidden scanner pane), inject EMA
  if (interval === '1d') {
    const closes = data.map(d=>d.close);
    const emaArr = ema(closes,45);
    const emaData= data
      .map((d,i)=>({ time:d.time, value:emaArr[i] }))
      .filter(pt=>pt.value!=null);
    const emaSeries = chart.addLineSeries({ color:'orange', lineWidth:2 });
    emaSeries.setData(emaData);
    charts[containerId].emaArr = emaArr;
  }
}

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

// —————————————————————————————————————————————————————————————————————
// 9) RSI & H1 signal overlay
// —————————————————————————————————————————————————————————————————————
function drawRSIandSignal(containerId, bullishDaily) {
  const e = charts[containerId];
  if (!e) return null;
  const closes = e.data.map(d=>d.close);
  const rsiArr = rsi(closes,13);
  const valid  = rsiArr.filter(v=>v!=null);
  const maArr  = sma(valid,14);
  const lastR  = rsiArr[rsiArr.length-1];
  const lastM  = maArr[maArr.length-1];
  let txt, clr, rtn=null;
  if (bullishDaily) {
    if (lastR<50 && lastR>lastM) { txt='Buy Signal confirmed'; clr='green'; rtn=true; }
    else                         { txt='Wait for Buy Signal';    clr='gray';  }
  } else {
    if (lastR>50 && lastR<lastM) { txt='Sell Signal confirmed'; clr='red';   rtn=false; }
    else                         { txt='Wait for Sell Signal';   clr='gray';  }
  }
  const id = `${containerId}-rsi-signal`;
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
  div.style.color    = clr;
  div.textContent    = `RSI: ${lastR.toFixed(2)}\n${txt}`;
  return rtn;
}

// —————————————————————————————————————————————————————————————————————
// 10) Scanner (no duplicates, shows H1 target)
// —————————————————————————————————————————————————————————————————————
async function runScanner() {
  scannerTbody.innerHTML = '';

  for (const sym of symbols) {
    // daily probability
    await fetchAndDraw(sym,'daily','1d','scannerTempDaily');
    const probBull = drawEMAandProbability('scannerTempDaily');

    // hourly fib+signal
    await fetchAndDraw(sym,'hourly','1h','scannerTempHourly');
    drawFibsOnChart('scannerTempHourly');
    const h1Target = charts['scannerTempHourly'].fibTarget;
    const sig      = drawRSIandSignal('scannerTempHourly', probBull);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${sym}</td>
      <td style="color:${probBull?'green':'red'}">${probBull?'Bullish':'Bearish'}</td>
      <td style="color:${sig===true?'green':sig===false?'red':'gray'}">
        ${sig===true?'Buy Signal confirmed':sig===false?'Sell Signal confirmed':'Wait for signal'}
      </td>
      <td>${h1Target!=null? h1Target.toFixed(2) : '—'}</td>`;
    scannerTbody.append(tr);
  }
}

// create hidden scanner temp divs on load
window.addEventListener('load', ()=>{
  ['scannerTempDaily','scannerTempHourly'].forEach(id=>{
    if(!document.getElementById(id)){
      const d=document.createElement('div');
      d.id=id; d.style.display='none';
      document.body.append(d);
    }
  });
  runScanner();
});
