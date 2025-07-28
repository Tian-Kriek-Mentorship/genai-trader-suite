// main.js

document.addEventListener('DOMContentLoaded', () => {
  loadSymbols();
  // ensure hidden scanner panes exist
  ['scannerTempDaily','scannerTempHourly'].forEach(id => {
    if (!document.getElementById(id)) {
      const d = document.createElement('div');
      d.id = id;
      d.style.display = 'none';
      document.body.appendChild(d);
    }
  });
  // live filter
  document.getElementById('scannerFilter').addEventListener('input', runScanner);
});

// DOM refs
const symbolSelect   = document.getElementById('symbolSelect');
const dailyTitle     = document.getElementById('dailyTitle');
const hourlyTitle    = document.getElementById('hourlyTitle');
const aiBtn          = document.getElementById('aiBtn');
const outPre         = document.getElementById('out');
const scannerFilter  = document.getElementById('scannerFilter');
const scannerTbody   = document.querySelector('#scannerTable tbody');

let symbols = [];      // will hold unique USDT symbols
const charts = {};     // store chart instances & data

// Helpers
function ema(arr, p) {
  const k = 2/(p+1), out = [], n = arr.length;
  let prev;
  for (let i = 0; i < n; i++) {
    if (i === p-1) {
      prev = arr.slice(0,p).reduce((a,b)=>a+b,0)/p;
      out[i] = prev;
    } else if (i >= p) {
      prev = arr[i]*k + prev*(1-k);
      out[i] = prev;
    } else {
      out[i] = null;
    }
  }
  return out;
}

function sma(arr, p) {
  const out = [], n = arr.length;
  for (let i = 0; i < n; i++) {
    if (i < p-1) { out.push(null); continue; }
    let sum = 0;
    for (let j = i-p+1; j <= i; j++) sum += arr[j];
    out.push(sum/p);
  }
  return out;
}

function rsi(arr, p) {
  const gains = [], losses = [], out = [];
  for (let i = 1; i < arr.length; i++) {
    const d = arr[i] - arr[i-1];
    gains.push(d>0?d:0);
    losses.push(d<0?-d:0);
  }
  let avgG = gains.slice(0,p).reduce((a,b)=>a+b,0)/p;
  let avgL = losses.slice(0,p).reduce((a,b)=>a+b,0)/p;
  out[p] = 100 - (100/(1 + avgG/avgL));
  for (let i = p+1; i < arr.length; i++) {
    avgG = (avgG*(p-1) + gains[i-1]) / p;
    avgL = (avgL*(p-1) + losses[i-1]) / p;
    out[i] = 100 - 100/(1 + avgG/avgL);
  }
  return out;
}

// 1) Load symbols
async function loadSymbols() {
  try {
    const resp = await axios.get('https://api.binance.com/api/v3/exchangeInfo');
    symbols = Array.from(new Set(
      resp.data.symbols
        .map(s=>s.symbol)
        .filter(s=>s.endsWith('USDT'))
    )).sort();
    for (const s of symbols) {
      const o = document.createElement('option');
      o.value = s;
      o.text  = s.replace('USDT','/USDT');
      symbolSelect.append(o);
    }
    symbolSelect.value = symbols[0];
    symbolSelect.addEventListener('change', updateDashboard);
    aiBtn.addEventListener('click', generateAISummary);
    await updateDashboard();
  } catch (e) {
    console.error(e);
    outPre.textContent = '❌ Failed to load symbols';
  }
}

// 2) AI summary
async function generateAISummary() {
  const sym = symbolSelect.value;
  outPre.textContent = `Loading AI summary for ${sym}…`;
  try {
    const resp = await axios.get('/api/ai',{ params:{ symbol:sym } });
    const txt = typeof resp.data==='string'?resp.data:
      resp.data.summary?resp.data.summary:
      resp.data.text?resp.data.text:
      JSON.stringify(resp.data,null,2);
    outPre.textContent = txt;
  } catch (e) {
    console.error(e);
    outPre.textContent = `❌ AI error: ${e.message}`;
  }
}

// 3) Main update
async function updateDashboard() {
  const sym = symbolSelect.value;
  dailyTitle.textContent  = `${sym} — Daily`;
  hourlyTitle.textContent = `${sym} — 1 Hour`;

  await fetchAndDraw(sym,'daily','1d','dailyChart');
  await fetchAndDraw(sym,'hourly','1h','hourlyChart');
  drawFibsOnChart('dailyChart');
  drawFibsOnChart('hourlyChart');
  const bull = drawEMAandProbability('dailyChart');
  drawRSIandSignal('hourlyChart', bull);
  await generateAISummary();
  await runScanner();
}

// 4) fetch + draw
async function fetchAndDraw(symbol, type, interval, cid) {
  const limit = 1000;
  const resp  = await axios.get('https://api.binance.com/api/v3/klines',{
    params:{ symbol, interval, limit }
  });
  const data = resp.data.map(k=>({
    time: k[0]/1000, open:+k[1], high:+k[2],
    low:+k[3], close:+k[4]
  }));
  const cont = document.getElementById(cid);
  cont.innerHTML = '';
  const chart = LightweightCharts.createChart(cont,{
    layout:{ textColor:'#000' },
    rightPriceScale:{ scaleMargins:{ top:0.3,bottom:0.1 } },
    timeScale:{ timeVisible:true, secondsVisible:false }
  });
  const series = chart.addCandlestickSeries();
  series.setData(data);
  charts[cid] = { chart, series, data };

  if (interval === '1d') {
    const closes = data.map(d=>d.close);
    const arr    = ema(closes,45);
    const ed     = data.map((d,i)=>({ time:d.time, value:arr[i] }))
                       .filter(p=>p.value!=null);
    const ls     = chart.addLineSeries({ color:'orange', lineWidth:2 });
    ls.setData(ed);
    charts[cid].emaArr = arr;
  }
}

// 5) fib + auto‑zoom
function drawFibsOnChart(cid) {
  const e = charts[cid];
  if (!e) return;
  const { series, data } = e;
  const o = data.map(d=>d.open),
        h = data.map(d=>d.high),
        l = data.map(d=>d.low);
  const m50 = sma(o,50), m200 = sma(o,200);
  let gc=-1, dc=-1;
  for (let i=1;i<o.length;i++){
    if (m50[i]>m200[i]&&m50[i-1]<=m200[i-1]) gc=i;
    if (m50[i]<m200[i]&&m50[i-1]>=m200[i-1]) dc=i;
  }
  const up = gc>dc, idx = up?gc:dc;
  if (idx<0) return;
  let pre = idx, start = ((up?dc:gc)>0 ? (up?dc:gc):0);
  for (let i=start;i<idx;i++){
    if (up? l[i]<l[pre] : h[i]>h[pre]) pre=i;
  }
  let post=-1;
  for (let i=idx+2;i<data.length-2;i++){
    const fh = h[i]>h[i-1]&&h[i]>h[i-2]&&h[i]>h[i+1]&&h[i]>h[i+2],
          fl = l[i]<l[i-1]&&l[i]<l[i-2]&&l[i]<l[i+1]&&l[i]<l[i+2];
    if (up&&fh) { post=i; break; }
    if (!up&&fl) { post=i; break; }
  }
  if (post<0) return;
  const preP  = up? l[pre] : h[pre],
        postP = up? h[post]: l[post],
        r     = Math.abs(postP-preP);
  const rec   = up? postP-r*0.618: postP+r*0.618,
        e127  = up? postP+r*0.27 : postP-r*0.27,
        e618  = up? postP+r*0.618: postP-r*0.618,
        e2618 = up? postP+r*1.618: postP-r*1.618;
  let t=false, m127=false;
  for (let i=post+1;i<data.length;i++){
    if (up) { if(l[i]<=rec) t=true; if(h[i]>=e127) m127=true; }
    else    { if(h[i]>=rec) t=true; if(l[i]<=e127) m127=true; }
  }
  const lvl = t?e618:(!t&&!m127?e127:e2618);
  series.createPriceLine({ price:lvl, color:'darkgreen', lineWidth:2, axisLabelVisible:true });
  e.fibTarget = lvl;
  if (!e.zoomSeries) {
    const zs = e.chart.addLineSeries({ color:'rgba(0,0,0,0)', lineWidth:0 });
    e.zoomSeries = zs;
  }
  e.zoomSeries.setData([
    { time:data[0].time,           value:lvl },
    { time:data[data.length-1].time,value:lvl }
  ]);
}

// 6) EMA & probability
function drawEMAandProbability(cid) {
  const e = charts[cid];
  if (!e||!e.emaArr) return false;
  const last = e.data[e.data.length-1].close,
        ema  = e.emaArr[e.emaArr.length-1],
        bull = last>ema;
  const id = `${cid}-prob`;
  let d = document.getElementById(id);
  if (!d) {
    d=document.createElement('div');
    d.id = id;
    d.style.position='absolute';
    d.style.top='8px';
    d.style.left='8px';
    d.style.zIndex='20';
    d.style.fontSize='16px';
    d.style.fontWeight='bold';
    d.style.whiteSpace='pre';
    d.style.pointerEvents='none';
    document.getElementById(cid).appendChild(d);
  }
  d.style.color = bull?'green':'red';
  d.textContent = `${bull?'▲':'▼'}\nProbability - ${bull?'Bullish':'Bearish'}`;
  return bull;
}

// 7) RSI & H1 signal
function drawRSIandSignal(cid, bullish) {
  const e = charts[cid];
  if (!e) return null;
  const arr = rsi(e.data.map(d=>d.close),13),
        val = arr[arr.length-1];
  const valid = arr.filter(v=>v!=null),
        ma    = sma(valid,14).slice(-1)[0];
  let txt, clr, rtn=null;
  if (bullish) {
    if (val<50 && val>ma) { txt='Buy Signal confirmed'; clr='green'; rtn=true; }
    else                  { txt='Wait for Buy Signal';    clr='gray';  }
  } else {
    if (val>50 && val<ma) { txt='Sell Signal confirmed';clr='red'; rtn=false; }
    else                  { txt='Wait for Sell Signal';  clr='gray';  }
  }
  const id = `${cid}-rsi`;
  let d = document.getElementById(id);
  if (!d) {
    d=document.createElement('div');
    d.id=id;
    d.style.position='absolute';
    d.style.top='8px';
    d.style.left='8px';
    d.style.zIndex='20';
    d.style.fontSize='16px';
    d.style.fontWeight='bold';
    d.style.whiteSpace='pre';
    d.style.pointerEvents='none';
    document.getElementById(cid).appendChild(d);
  }
  d.style.color = clr;
  d.textContent = `RSI: ${val.toFixed(2)}\n${txt}`;
  return rtn;
}

// 8) Scanner
async function runScanner() {
  scannerTbody.innerHTML = '';
  const filter = scannerFilter.value.trim().toUpperCase();
  const list   = filter
    ? symbols.filter(s=>s.includes(filter))
    : symbols.slice(0,20);

  for (const s of list) {
    await fetchAndDraw(s,'daily','1d','scannerTempDaily');
    const pb = drawEMAandProbability('scannerTempDaily');
    await fetchAndDraw(s,'hourly','1h','scannerTempHourly');
    drawFibsOnChart('scannerTempHourly');
    const tg = charts['scannerTempHourly'].fibTarget ?? '—';
    const sg = drawRSIandSignal('scannerTempHourly', pb);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s}</td>
      <td style="color:${pb?'green':'red'}">${pb?'Bullish':'Bearish'}</td>
      <td style="color:${sg===true?'green':sg===false?'red':'gray'}">
        ${sg===true?'Buy Signal confirmed':sg===false?'Sell Signal confirmed':'Wait for signal'}
      </td>
      <td>${typeof tg==='number'?tg.toFixed(2):tg}</td>`;
    scannerTbody.append(tr);
  }
}
