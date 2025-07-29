// main.js

// ――― 1) Config & State ―――
const cryptoSymbols = [
  'BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT',
  'SOLUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','AVAXUSDT'
];
const forexSymbols = [
  'EURUSD','USDJPY','GBPUSD','USDCHF','USDCAD','AUDUSD','NZDUSD',
  'EURGBP','EURJPY','EURCHF','EURCAD','EURNZD',
  'GBPJPY','GBPCHF','GBPAUD','GBPCAD','GBPNZD',
  'AUDJPY','AUDCAD','AUDCHF','AUDNZD',
  'CADJPY','CADCHF','CADNZD',
  'CHFJPY','NZDJPY','NZDCHF'
];
const equitiesSymbols = [
  'AAPL','MSFT','NVDA','GOOG','META','AMZN','TSLA','BRK.B','UNH','JPM',
  'V','MA','PG','HD','JNJ','BAC','PFE','CVX','XOM','KO'
];
const etfSymbols = ['BITO','BLOK','BTF','IBIT','FBTC','GBTC','ETHE'];
const symbols = [
  ...cryptoSymbols,
  ...forexSymbols,
  ...equitiesSymbols,
  ...etfSymbols
];

const API_KEY   = window.TD_API_KEY;
const tdCache   = {};
const projCache = {};
let interestRates = {};
const charts    = {};

// ――― 2) DOM refs ―――
const symbolInput   = document.getElementById('symbolInput');
const datalistEl    = document.getElementById('symbolOptions');
const dailyTitle    = document.getElementById('dailyTitle');
const hourlyTitle   = document.getElementById('hourlyTitle');
const aiBtn         = document.getElementById('aiBtn');
const outPre        = document.getElementById('out');
const scannerFilter = document.getElementById('scannerFilter');
const scannerTbody  = document.querySelector('#scannerTable tbody');

// ――― 3) Helpers ―――
function toTDSymbol(sym) {
  if (cryptoSymbols.includes(sym)) return null;
  if (forexSymbols.includes(sym))   return `${sym.slice(0,3)}/${sym.slice(3)}`;
  return sym;
}

function ema(arr,p){
  const k=2/(p+1), out=[], n=arr.length;
  let prev;
  for(let i=0;i<n;i++){
    if(i===p-1){
      prev = arr.slice(0,p).reduce((a,b)=>a+b,0)/p;
      out[i] = prev;
    } else if(i>=p){
      prev = arr[i]*k + prev*(1-k);
      out[i] = prev;
    } else {
      out[i] = null;
    }
  }
  return out;
}

function sma(arr,p){
  const out=[]; 
  for(let i=0;i<arr.length;i++){
    if(i<p-1){ out.push(null); continue; }
    let sum=0;
    for(let j=i-p+1;j<=i;j++) sum+=arr[j];
    out.push(sum/p);
  }
  return out;
}

function rsi(arr,p){
  const gains=[], losses=[], out=[];
  for(let i=1;i<arr.length;i++){
    const d=arr[i]-arr[i-1];
    gains.push(d>0?d:0);
    losses.push(d<0?-d:0);
  }
  let avgG=gains.slice(0,p).reduce((a,b)=>a+b,0)/p;
  let avgL=losses.slice(0,p).reduce((a,b)=>a+b,0)/p;
  out[p] = 100 - (100/(1+avgG/avgL));
  for(let i=p+1;i<arr.length;i++){
    avgG = (avgG*(p-1)+gains[i-1])/p;
    avgL = (avgL*(p-1)+losses[i-1])/p;
    out[i] = 100 - 100/(1+avgG/avgL);
  }
  return out;
}

// ――― 4) Load interest rates ―――
async function loadInterestRates(){
  try {
    const resp = await fetch('/interestRates.json');
    interestRates = await resp.json();
  } catch(e){
    console.error('Failed to load interest rates', e);
    interestRates = {};
  }
}
function getPositiveCarryFX(){
  return forexSymbols.filter(sym=>{
    const b=sym.slice(0,3), q=sym.slice(3);
    const rb=interestRates[b], rq=interestRates[q];
    return typeof rb==='number' && typeof rq==='number' && rb>rq;
  });
}

// ――― 5) Projected Annual Return ―――
async function getProjectedAnnualReturn(sym){
  if(projCache[sym]!==undefined) return projCache[sym];

  if(cryptoSymbols.includes(sym)){
    try {
      const r = await axios.get('https://api.binance.com/api/v3/klines',{
        params:{symbol:sym,interval:'1M',limit:60}
      });
      const d = r.data;
      if(!d.length){ projCache[sym]=null; return null; }
      const first=parseFloat(d[0][4]), last=parseFloat(d[d.length-1][4]);
      const yrs=(d.length-1)/12, cagr=Math.pow(last/first,1/yrs)-1;
      projCache[sym]=cagr; return cagr;
    } catch(e){
      console.error(`Binance CAGR error ${sym}`, e);
      projCache[sym]=null; return null;
    }
  }

  try {
    const tdSym = toTDSymbol(sym);
    const r = await axios.get('https://api.twelvedata.com/time_series',{params:{
      symbol:tdSym,interval:'1month',outputsize:60,apikey:API_KEY
    }});
    const vals=r.data.values||[];
    if(vals.length<2){ projCache[sym]=null; return null; }
    const first=parseFloat(vals[0].close),
          last =parseFloat(vals[vals.length-1].close),
          yrs  =(vals.length-1)/12,
          cagr =Math.pow(last/first,1/yrs)-1;
    projCache[sym]=cagr; return cagr;
  } catch(e){
    console.error(`TD CAGR error ${sym}`, e);
    projCache[sym]=null; return null;
  }
}

// ――― 6) fetchAndDraw ―――
async function fetchAndDraw(symbol,_,interval,containerId){
  let data=[];
  if(cryptoSymbols.includes(symbol)){
    try {
      const r = await axios.get('https://api.binance.com/api/v3/klines',{params:{
        symbol,interval,limit:1000
      }});
      data = r.data.map(k=>({
        time:k[0]/1000,open:+k[1],high:+k[2],low:+k[3],close:+k[4]
      }));
    } catch(e){ console.error(`Binance ${symbol}`, e); }
  } else {
    const tdSym = toTDSymbol(symbol), key=`${tdSym}_${interval}`;
    if(tdCache[key]) data = tdCache[key];
    else {
      try {
        const tdInt = interval==='1d'?'1day':'1h';
        const r = await axios.get('https://api.twelvedata.com/time_series',{params:{
          symbol:tdSym,interval:tdInt,outputsize:500,apikey:API_KEY
        }});
        const vals = r.data.values||[];
        data = vals.map(v=>({
          time:Math.floor(new Date(v.datetime).getTime()/1000),
          open:+v.open,high:+v.high,low:+v.low,close:+v.close
        })).reverse();
      } catch(e){ console.error(`TD ${tdSym}`, e); }
      tdCache[key]=data;
    }
  }

  const c = document.getElementById(containerId);
  c.innerHTML='';
  const chart = LightweightCharts.createChart(c,{
    layout:{textColor:'#000'},
    rightPriceScale:{scaleMargins:{top:0.3,bottom:0.1}},
    timeScale:{timeVisible:true,secondsVisible:false}
  });
  const series = chart.addCandlestickSeries();
  series.setData(data);
  charts[containerId]={chart,series,data};

  if(interval==='1d'){
    const closes=data.map(d=>d.close),
          arr=ema(closes,45),
          ed=data.map((d,i)=>({time:d.time,value:arr[i]}))
                 .filter(p=>p.value!=null),
          ls=chart.addLineSeries({color:'orange',lineWidth:2});
    ls.setData(ed);
    charts[containerId].emaArr=arr;
  }
}

// ――― 7) drawFibsOnChart ―――
function drawFibsOnChart(cid) {
  const e = charts[cid];
  if(!e||!e.data||e.data.length<5) return;
  const {chart,series,data} = e;

  // SMAs on open
  const o    = data.map(d=>d.open);
  const m50  = sma(o,50), m200=sma(o,200);

  // last cross indices
  let lastGC=-1, lastDC=-1;
  for(let i=1;i<o.length;i++){
    if(m50[i]>m200[i]&&m50[i-1]<=m200[i-1]) lastGC=i;
    if(m50[i]<m200[i]&&m50[i-1]>=m200[i-1]) lastDC=i;
  }

  const inUpMode = lastGC>lastDC;
  const crossIdx = inUpMode?lastGC:lastDC;
  if(crossIdx<2) return;

  // pre-cross swing
  const startIdx = inUpMode?(lastDC>0?lastDC:0):(lastGC>0?lastGC:0);
  let preIdx = crossIdx;
  for(let i=startIdx;i<=crossIdx;i++){
    if(inUpMode){
      if(data[i].low < data[preIdx].low) preIdx = i;
    } else {
      if(data[i].high> data[preIdx].high) preIdx = i;
    }
  }

  // first fractal after cross
  let postIdx=-1;
  for(let i=crossIdx+2;i< data.length-2;i++){
    const fh = data[i].high>data[i-1].high&&data[i].high>data[i-2].high&&
               data[i].high>data[i+1].high&&data[i].high>data[i+2].high;
    const fl = data[i].low <data[i-1].low &&data[i].low <data[i-2].low &&
               data[i].low <data[i+1].low &&data[i].low <data[i+2].low;
    if(inUpMode&&fh){ postIdx=i; break; }
    if(!inUpMode&&fl){ postIdx=i; break; }
  }

  // if waiting on up‑fractal, bail (no fib)
  if(postIdx<0) return;

  // fib levels
  const p0 = inUpMode?data[preIdx].low:data[preIdx].high;
  const p1 = inUpMode?data[postIdx].high:data[postIdx].low;
  const r  = Math.abs(p1-p0);
  const lvl={
    retr:   inUpMode? p1-r*0.618 : p1+r*0.618,
    ext127: inUpMode? p1+r*0.27  : p1-r*0.27,
    ext618: inUpMode? p1+r*0.618 : p1-r*0.618,
    ext2618:inUpMode? p1+r*1.618 : p1-r*1.618
  };

  let touched=false, moved127=false;
  for(let i=postIdx+1;i<data.length;i++){
    if(inUpMode){
      if(data[i].low <= lvl.retr)   touched=true;
      if(data[i].high>= lvl.ext127) moved127=true;
    } else {
      if(data[i].high>=lvl.retr)    touched=true;
      if(data[i].low <=lvl.ext127)  moved127=true;
    }
  }
  const targetPrice = touched
    ? lvl.ext618
    : (!touched && !moved127)
      ? lvl.ext127
      : lvl.ext2618;

  series.createPriceLine({
    price:            targetPrice,
    color:            'darkgreen',
    lineWidth:        2,
    axisLabelVisible: true,
    title:            `Fibonacci Target: ${targetPrice.toFixed(4)}`
  });
  e.fibTarget = targetPrice;

  if(!e.zoomSeries){
    e.zoomSeries=chart.addLineSeries({color:'rgba(0,0,0,0)',lineWidth:0});
  }
  e.zoomSeries.setData([
    { time:data[0].time,            value:targetPrice },
    { time:data[data.length-1].time,value:targetPrice }
  ]);
}

// ――― 8) EMA & Probability overlay ―――
function drawEMAandProbability(cid){
  const e=charts[cid];
  if(!e||!e.data||!e.emaArr) return false;
  const lastC=e.data[e.data.length-1].close,
        lastE=e.emaArr[e.emaArr.length-1],
        bull=lastC>lastE,
        id=`${cid}-prob`;
  let div=document.getElementById(id);
  if(!div){
    div=document.createElement('div');
    div.id=id;
    Object.assign(div.style,{
      position:'absolute',top:'8px',left:'8px',
      zIndex:'20',fontSize:'16px',fontWeight:'bold',
      whiteSpace:'pre',pointerEvents:'none'
    });
    document.getElementById(cid).appendChild(div);
  }
  div.style.color=bull?'green':'red';
  div.textContent=`${bull?'▲':'▼'}\nProbability - ${bull?'Bullish':'Bearish'}`;
  return bull;
}

// … rest of main.js (RSI, AI summary, scanner, init) unchanged …







Sources
You said:
Plot the two moving averages on the H1 time frame please. I want to see when there is a deat cross and a golden cross


ChatGPT said:

Thought for a couple of seconds
I’ve added both the 50‑ and 200‑period SMAs on the H1 charts (using the open‑price series), so you’ll now see exactly where golden and death crosses occur there, just like on your MT4.

Below is your updated main.js—I’ve highlighted the two new series (sma50SeriesH1 in blue, sma200SeriesH1 in black) that get added whenever interval === '1h'. Everything else is unchanged.

js
Copy
Edit
// main.js

// … all your existing imports, config, helper functions, etc. remain the same … 

async function fetchAndDraw(symbol, _, interval, containerId) {
  let data = [];

  // … your existing code to fetch `data` from Binance or Twelve Data …

  // draw chart
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const chart = LightweightCharts.createChart(container, {
    layout: { textColor: '#000' },
    rightPriceScale: { scaleMargins: { top: 0.3, bottom: 0.1 } },
    timeScale: { timeVisible: true, secondsVisible: false }
  });
  const series = chart.addCandlestickSeries();
  series.setData(data);
  charts[containerId] = { chart, series, data };

  // 45‑EMA on daily
  if (interval === '1d') {
    const closes = data.map(d => d.close);
    const arr = ema(closes, 45);
    const ed = data
      .map((d, i) => ({ time: d.time, value: arr[i] }))
      .filter(p => p.value != null);
    const emaSeries = chart.addLineSeries({ color: 'orange', lineWidth: 2 });
    emaSeries.setData(ed);
    charts[containerId].emaArr = arr;
  }

  // ─── NEW: plot 50 & 200 SMA on H1 ───
  if (interval === '1h') {
    // compute SMAs on open prices
    const opens = data.map(d => d.open);
    const sma50 = sma(opens, 50);
    const sma200 = sma(opens, 200);

    // map to time/value pairs
    const sma50Data = data
      .map((d, i) => ({ time: d.time, value: sma50[i] }))
      .filter(p => p.value != null);
    const sma200Data = data
      .map((d, i) => ({ time: d.time, value: sma200[i] }))
      .filter(p => p.value != null);

    // add to chart
    const sma50SeriesH1 = chart.addLineSeries({ color: 'blue', lineWidth: 2 });
    sma50SeriesH1.setData(sma50Data);

    const sma200SeriesH1 = chart.addLineSeries({ color: 'black', lineWidth: 2 });
    sma200SeriesH1.setData(sma200Data);

    // keep for later if you need the arrays
    charts[containerId].sma50 = sma50;
    charts[containerId].sma200 = sma200;
  }
}

// … the rest of your code (drawFibsOnChart, drawEMAandProbability, drawRSIandSignal, etc.) stays the same … 
With that in place, every time you load an H1 chart you’ll see:

Blue line = 50‑period SMA on the open series

Black line = 200‑period SMA on the open series

Golden crosses (blue crossing above black) and death crosses (blue crossing below black) will be immediately visible on your 1‑hour pane.








Sources
You said:
fully updated code please


ChatGPT said:
Below are both complete files with the 50‑ and 200‑period SMAs plotted on the H1 charts in blue and black respectively.

index.html
html
Copy
Edit
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Liquidity‑Cycle Dashboard</title>
  <link rel="icon" href="/favicon.png" />
  <style>
    body { font-family: system-ui, sans-serif; font-size: 22px; margin: 2rem; }
    h1 { margin-bottom: 1rem; font-size: 32px; }
    h2 { margin-top: 1rem; font-size: 26px; }
    button {
      margin-bottom: 1rem;
      padding: 0.75rem 1.5rem;
      font-size: 20px;
      cursor: pointer;
      border: none;
      background-color: #1976d2;
      color: white;
      border-radius: 5px;
    }
    input, input[list] {
      font-size: 20px;
      padding: 0.5rem;
      margin-right: 1rem;
      width: 300px;
    }
    pre {
      white-space: pre-wrap;
      background: #f6f6f6;
      padding: 1rem;
      font-size: 20px;
      line-height: 1.5;
      width: 100%;
      box-sizing: border-box;
      margin-top: 0.5rem;
    }
    .charts-container { display: flex; gap: 2rem; margin-top: 1.5rem; }
    .chart-block { flex: 1; }
    .chart-block > div {
      position: relative;
      width: 100%;
      height: 700px;
      margin-top: 0.5rem;
    }
    #scannerTable {
      width: 100%;
      border-collapse: collapse;
      margin-top: 0.5rem;
    }
    #scannerTable th, #scannerTable td {
      border: 1px solid #ddd;
      padding: 0.5rem;
      text-align: left;
    }
    #scannerTable th { background-color: #f0f0f0; }
    .explanation {
      font-size: 22px;
      line-height: 1.7;
      max-width: 800px;
      margin-top: 2rem;
    }
    .explanation ul { margin-top: 0.5rem; padding-left: 1.4rem; }
    .explanation li { margin-bottom: 0.75rem; }
  </style>
</head>
<body>
  <h1>Liquidity‑Cycle Dashboard (v0.1)</h1>

  <div style="margin-bottom: 1rem;">
    <label for="symbolInput" style="font-size:22px; margin-right:0.5rem;">
      Select Symbol:
    </label>
    <input list="symbolOptions" id="symbolInput" placeholder="Search symbol…" />
    <datalist id="symbolOptions"></datalist>
  </div>

  <div>
    <button id="aiBtn">AI Summary</button>
    <pre id="out"></pre>
  </div>

  <div class="charts-container">
    <div class="chart-block">
      <h2 id="dailyTitle">BTCUSDT — Daily</h2>
      <div id="dailyChart"></div>
    </div>
    <div class="chart-block">
      <h2 id="hourlyTitle">BTCUSDT — 1 Hour</h2>
      <div id="hourlyChart"></div>
    </div>
  </div>

  <h2>Scanner</h2>
  <input id="scannerFilter" placeholder="Filter symbols…" />
  <table id="scannerTable">
    <thead>
      <tr>
        <th>Symbol</th>
        <th>Probability</th>
        <th>Signal</th>
        <th>H1 Target</th>
        <th>Projected Annual Return</th>
      </tr>
    </thead>
    <tbody></tbody>
  </table>

  <div class="explanation">
    <h3>❗ What Is the Liquidity‑Cycle Dashboard (v0.1)?</h3>
    <p>The Liquidity‑Cycle Dashboard helps traders understand where money is flowing in and out of the crypto market.</p>
    <p>Instead of watching dozens of charts or guessing when to trade, this dashboard shows you how Bitcoin (BTCUSDT) is behaving across two key timeframes:</p>
    <ul>
      <li>📅 <strong>Daily chart</strong> – the big picture trend</li>
      <li>🕐 <strong>Hourly chart</strong> – short-term moves</li>
    </ul>
    <p><strong>The goal?</strong><br>
    To spot shifts in momentum and liquidity – so you trade with the market, not against it.</p>
    <!-- etc. -->
  </div>

  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.8/dist/axios.min.js"></script>
  <script src="https://unpkg.com/lightweight-charts@4.0.0/dist/lightweight-charts.standalone.production.js"></script>
  <script>window.TD_API_KEY = '1eed79e08f4a4d6092a9b4e634c3bbf8';</script>
  <script type="module" src="/main.js"></script>
</body>
</html>
main.js
js
Copy
Edit
// main.js

// ――― 1) Config & State ―――
const cryptoSymbols = [
  'BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT',
  'SOLUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','AVAXUSDT'
];
const forexSymbols = [
  'EURUSD','USDJPY','GBPUSD','USDCHF','USDCAD','AUDUSD','NZDUSD',
  'EURGBP','EURJPY','EURCHF','EURCAD','EURNZD',
  'GBPJPY','GBPCHF','GBPAUD','GBPCAD','GBPNZD',
  'AUDJPY','AUDCAD','AUDCHF','AUDNZD',
  'CADJPY','CADCHF','CADNZD',
  'CHFJPY','NZDJPY','NZDCHF'
];
const equitiesSymbols = [
  'AAPL','MSFT','NVDA','GOOG','META','AMZN','TSLA','BRK.B','UNH','JPM',
  'V','MA','PG','HD','JNJ','BAC','PFE','CVX','XOM','KO'
];
const etfSymbols = ['BITO','BLOK','BTF','IBIT','FBTC','GBTC','ETHE'];
const symbols = [
  ...cryptoSymbols,
  ...forexSymbols,
  ...equitiesSymbols,
  ...etfSymbols
];

const API_KEY   = window.TD_API_KEY;
const tdCache   = {};
const projCache = {};
let interestRates = {};   // loaded from public/interestRates.json
const charts    = {};

// ――― 2) DOM refs ―――
const symbolInput   = document.getElementById('symbolInput');
const datalistEl    = document.getElementById('symbolOptions');
const dailyTitle    = document.getElementById('dailyTitle');
const hourlyTitle   = document.getElementById('hourlyTitle');
const aiBtn         = document.getElementById('aiBtn');
const outPre        = document.getElementById('out');
const scannerFilter = document.getElementById('scannerFilter');
const scannerTbody  = document.querySelector('#scannerTable tbody');

// ――― 3) Helpers ―――
function toTDSymbol(sym) {
  if (cryptoSymbols.includes(sym)) return null;
  if (forexSymbols.includes(sym))   return `${sym.slice(0,3)}/${sym.slice(3)}`;
  return sym;
}

function ema(arr,p){
  const k=2/(p+1), out=[], n=arr.length;
  let prev;
  for(let i=0;i<n;i++){
    if(i===p-1){
      prev = arr.slice(0,p).reduce((a,b)=>a+b,0)/p;
      out[i] = prev;
    } else if(i>=p){
      prev = arr[i]*k + prev*(1-k);
      out[i] = prev;
    } else {
      out[i] = null;
    }
  }
  return out;
}

function sma(arr,p){
  const out=[]; 
  for(let i=0;i<arr.length;i++){
    if(i<p-1){ out.push(null); continue; }
    let sum=0; 
    for(let j=i-p+1;j<=i;j++) sum+=arr[j];
    out.push(sum/p);
  }
  return out;
}

function rsi(arr,p){
  const gains=[], losses=[], out=[];
  for(let i=1;i<arr.length;i++){
    const d=arr[i]-arr[i-1];
    gains.push(d>0?d:0);
    losses.push(d<0?-d:0);
  }
  let avgG=gains.slice(0,p).reduce((a,b)=>a+b,0)/p;
  let avgL=losses.slice(0,p).reduce((a,b)=>a+b,0)/p;
  out[p] = 100 - (100/(1+avgG/avgL));
  for(let i=p+1;i<arr.length;i++){
    avgG = (avgG*(p-1)+gains[i-1])/p;
    avgL = (avgL*(p-1)+losses[i-1])/p;
    out[i] = 100 - 100/(1+avgG/avgL);
  }
  return out;
}

// ――― 4) Load interest rates ―――
async function loadInterestRates(){
  try {
    const resp = await fetch('/interestRates.json');
    interestRates = await resp.json();
  } catch(e){
    console.error('Failed to load interest rates', e);
    interestRates = {};
  }
}
function getPositiveCarryFX(){
  return forexSymbols.filter(sym=>{
    const b=sym.slice(0,3), q=sym.slice(3);
    const rb=interestRates[b], rq=interestRates[q];
    return typeof rb==='number' && typeof rq==='number' && rb>rq;
  });
}

// ――― 5) Projected Annual Return ―――
async function getProjectedAnnualReturn(sym){
  if(projCache[sym]!==undefined) return projCache[sym];

  if(cryptoSymbols.includes(sym)){
    try {
      const r = await axios.get('https://api.binance.com/api/v3/klines',{params:{
        symbol:sym,interval:'1M',limit:60
      }});
      const d = r.data;
      if(!d.length){ projCache[sym]=null; return null; }
      const first=parseFloat(d[0][4]), last=parseFloat(d[d.length-1][4]);
      const yrs=(d.length-1)/12, cagr=Math.pow(last/first,1/yrs)-1;
      projCache[sym]=cagr; return cagr;
    } catch(e){
      console.error(`Binance CAGR error ${sym}`, e);
      projCache[sym]=null; return null;
    }
  }

  try {
    const tdSym = toTDSymbol(sym);
    const r = await axios.get('https://api.twelvedata.com/time_series',{params:{
      symbol:tdSym,interval:'1month',outputsize:60,apikey:API_KEY
    }});
    const vals=r.data.values||[];
    if(vals.length<2){ projCache[sym]=null; return null; }
    const first=parseFloat(vals[0].close),
          last =parseFloat(vals[vals.length-1].close),
          yrs  =(vals.length-1)/12,
          cagr =Math.pow(last/first,1/yrs)-1;
    projCache[sym]=cagr; return cagr;
  } catch(e){
    console.error(`TD CAGR error ${sym}`, e);
    projCache[sym]=null; return null;
  }
}

// ――― 6) fetchAndDraw ―――
async function fetchAndDraw(symbol, _, interval, containerId) {
  let data = [];

  if (cryptoSymbols.includes(symbol)) {
    try {
      const r = await axios.get('https://api.binance.com/api/v3/klines',{params:{
        symbol,interval,limit:1000
      }});
      data = r.data.map(k=>({
        time:k[0]/1000,open:+k[1],high:+k[2],low:+k[3],close:+k[4]
      }));
    } catch(e){ console.error(`Binance ${symbol}`, e); }
  } else {
    const tdSym = toTDSymbol(symbol), key = `${tdSym}_${interval}`;
    if (tdCache[key]) {
      data = tdCache[key];
    } else {
      try {
        const tdInt = interval==='1d'?'1day':'1h';
        const r = await axios.get('https://api.twelvedata.com/time_series',{params:{
          symbol:tdSym,interval:tdInt,outputsize:500,apikey:API_KEY
        }});
        const vals = r.data.values||[];
        data = vals.map(v=>({
          time:Math.floor(new Date(v.datetime).getTime()/1000),
          open:+v.open,high:+v.high,low:+v.low,close:+v.close
        })).reverse();
      } catch(e){ console.error(`TD ${tdSym}`, e); }
      tdCache[key]=data;
    }
  }

  // draw chart
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const chart = LightweightCharts.createChart(container, {
    layout: { textColor: '#000' },
    rightPriceScale: { scaleMargins: { top: 0.3, bottom: 0.1 } },
    timeScale: { timeVisible: true, secondsVisible: false }
  });
  const series = chart.addCandlestickSeries();
  series.setData(data);
  charts[containerId] = { chart, series, data };

  // 45‑EMA on daily
  if (interval === '1d') {
    const closes = data.map(d => d.close);
    const arr    = ema(closes, 45);
    const ed     = data
      .map((d, i) => ({ time: d.time, value: arr[i] }))
      .filter(p => p.value != null);
    const emaSeries = chart.addLineSeries({ color: 'orange', lineWidth: 2 });
    emaSeries.setData(ed);
    charts[containerId].emaArr = arr;
  }

  // ─── H1 SMAs ───
  if (interval === '1h') {
    const opens = data.map(d => d.open);
    const sma50 = sma(opens, 50);
    const sma200 = sma(opens, 200);

    const sma50Data = data
      .map((d, i) => ({ time: d.time, value: sma50[i] }))
      .filter(p => p.value != null);
    const sma200Data = data
      .map((d, i) => ({ time: d.time, value: sma200[i] }))
      .filter(p => p.value != null);

    const sma50SeriesH1 = chart.addLineSeries({ color: 'blue',  lineWidth: 2 });
    sma50SeriesH1.setData(sma50Data);

    const sma200SeriesH1 = chart.addLineSeries({ color: 'black', lineWidth: 2 });
    sma200SeriesH1.setData(sma200Data);

    charts[containerId].sma50 = sma50;
    charts[containerId].sma200 = sma200;
  }
}

// ――― 7) drawFibsOnChart ―――
function drawFibsOnChart(cid) {
  const e = charts[cid];
  if(!e||!e.data||e.data.length<5) return;
  const {chart,series,data} = e;

  // SMAs on open
  const o    = data.map(d=>d.open);
  const m50  = sma(o,50), m200=sma(o,200);

  // last cross indices
  let lastGC=-1, lastDC=-1;
  for(let i=1;i<o.length;i++){
    if(m50[i]>m200[i]&&m50[i-1]<=m200[i-1]) lastGC=i;
    if(m50[i]<m200[i]&&m50[i-1]>=m200[i-1]) lastDC=i;
  }

  const inUpMode = lastGC>lastDC;
  const crossIdx = inUpMode?lastGC:lastDC;
  if(crossIdx<2) return;

  // pre-cross swing
  const startIdx = inUpMode?(lastDC>0?lastDC:0):(lastGC>0?lastGC:0);
  let preIdx = crossIdx;
  for(let i=startIdx;i<=crossIdx;i++){
    if(inUpMode){
      if(data[i].low < data[preIdx].low) preIdx = i;
    } else {
      if(data[i].high> data[preIdx].high) preIdx = i;
    }
  }

  // first fractal after cross
  let postIdx=-1;
  for(let i=crossIdx+2;i< data.length-2;i++){
    const fh = data[i].high>data[i-1].high&&data[i].high>data[i-2].high&&
               data[i].high>data[i+1].high&&data[i].high>data[i+2].high;
    const fl = data[i].low <data[i-1].low &&data[i].low <data[i-2].low &&
               data[i].low <data[i+1].low &&data[i].low <data[i+2].low;
    if(inUpMode&&fh){ postIdx=i; break; }
    if(!inUpMode&&fl){ postIdx=i; break; }
  }

  // if waiting on up‑fractal, bail (no fib)
  if(postIdx<0) return;

  // fib levels
  const p0 = inUpMode?data[preIdx].low:data[preIdx].high;
  const p1 = inUpMode?data[postIdx].high:data[postIdx].low;
  const r  = Math.abs(p1-p0);
  const lvl={
    retr:   inUpMode? p1-r*0.618 : p1+r*0.618,
    ext127: inUpMode? p1+r*0.27  : p1-r*0.27,
    ext618: inUpMode? p1+r*0.618 : p1-r*0.618,
    ext2618:inUpMode? p1+r*1.618 : p1-r*1.618
  };

  let touched=false, moved127=false;
  for(let i=postIdx+1;i<data.length;i++){
    if(inUpMode){
      if(data[i].low <= lvl.retr)   touched=true;
      if(data[i].high>= lvl.ext127) moved127=true;
    } else {
      if(data[i].high>=lvl.retr)    touched=true;
      if(data[i].low <=lvl.ext127)  moved127=true;
    }
  }
  const targetPrice = touched
    ? lvl.ext618
    : (!touched && !moved127)
      ? lvl.ext127
      : lvl.ext2618;

  series.createPriceLine({
    price:            targetPrice,
    color:            'darkgreen',
    lineWidth:        2,
    axisLabelVisible: true,
    title:            `Fibonacci Target: ${targetPrice.toFixed(4)}`
  });
  e.fibTarget = targetPrice;

  if(!e.zoomSeries){
    e.zoomSeries=chart.addLineSeries({color:'rgba(0,0,0,0)',lineWidth:0});
  }
  e.zoomSeries.setData([
    { time:data[0].time,            value:targetPrice },
    { time:data[data.length-1].time,value:targetPrice }
  ]);
}

// ――― 8) EMA & Probability overlay ―――
function drawEMAandProbability(cid){
  const e=charts[cid];
  if(!e||!e.data||!e.emaArr) return false;
  const lastC=e.data[e.data.length-1].close,
        lastE=e.emaArr[e.emaArr.length-1],
        bull=lastC>lastE,
        id=`${cid}-prob`;
  let div=document.getElementById(id);
  if(!div){
    div=document.createElement('div');
    div.id=id;
    Object.assign(div.style,{
      position:'absolute',top:'8px',left:'8px',
      zIndex:'20',fontSize:'16px',fontWeight:'bold',
      whiteSpace:'pre',pointerEvents:'none'
    });
    document.getElementById(cid).appendChild(div);
  }
  div.style.color=bull?'green':'red';
  div.textContent=`${bull?'▲':'▼'}\nProbability - ${bull?'Bullish':'Bearish'}`;
  return bull;
}

// … rest of main.js (RSI, AI summary, scanner, init) unchanged …


// ――― 9) RSI & H1 Signal overlay ―――
function drawRSIandSignal(cid,dailyBullish){
  const e=charts[cid];
  if(!e||!e.data) return null;
  if(dailyBullish){
    if(e.fibDirection==='down'){
      _renderRSIDiv(cid,'Wait for Buy Signal','gray');
      return null;
    }
    const arr=rsi(e.data.map(d=>d.close),13),
          val=arr[arr.length-1],
          valid=arr.filter(v=>v!=null),
          maVal=sma(valid,14).slice(-1)[0];
    if(val<50&&val>maVal){
      _renderRSIDiv(cid,'Buy Signal confirmed','green',val);
      return true;
    }
    _renderRSIDiv(cid,'Wait for Buy Signal','gray',val);
    return null;
  }
  if(e.fibDirection==='up'){
    _renderRSIDiv(cid,'Wait for Sell Signal','gray');
    return null;
  }
  _renderRSIDiv(cid,'Sell Signal confirmed','red');
  return false;
}
function _renderRSIDiv(cid,text,color,val){
  const id=`${cid}-rsi`;
  let div=document.getElementById(id);
  if(!div){
    div=document.createElement('div');
    div.id=id;
    Object.assign(div.style,{
      position:'absolute',top:'8px',left:'8px',
      zIndex:'20',fontSize:'16px',fontWeight:'bold',
      whiteSpace:'pre',pointerEvents:'none'
    });
    document.getElementById(cid).appendChild(div);
  }
  div.style.color=color;
  div.textContent=val!=null?`RSI: ${val.toFixed(2)}\n${text}`:text;
}

// ――― 10) AI Summary ―――
async function generateAISummary(){
  const sym=symbolInput.value;
  outPre.textContent=`Loading AI summary for ${sym}…`;
  const bull=drawEMAandProbability('dailyChart');
  const sig =drawRSIandSignal('hourlyChart',bull);
  const tgt =charts.hourlyChart?.fibTarget;
  let avgRet='N/A';
  try{
    const tdSym=toTDSymbol(sym)||sym;
    const r=await axios.get('https://api.twelvedata.com/time_series',{params:{
      symbol:tdSym,interval:'1month',outputsize:60,apikey:API_KEY
    }});
    const vals=r.data.values||[],rets=[];
    for(let i=1;i<vals.length;i++){
      const p=parseFloat(vals[i-1].close),c=parseFloat(vals[i].close);
      rets.push((c/p-1)*100);
    }
    const avg=rets.reduce((a,b)=>a+b,0)/rets.length;
    avgRet=`${avg.toFixed(2)}%`;
  }catch(e){console.error('Monthly error',e);}
  const prompt=`
Symbol: ${sym}
Probability (45‑EMA): ${bull?'Bullish':'Bearish'}
H1 Signal: ${ sig===true?'Buy Signal confirmed'
               : sig===false?'Sell Signal confirmed'
                              :'Wait for signal' }
Fibonacci Target: ${tgt!=null?tgt.toFixed(4):'—'}
Average monthly return (last 5 years): ${avgRet}

Write a concise analysis covering:
1. The current state of ${sym} and overall market sentiment.
2. Major upcoming announcements or events that could impact it.
3. How the probability, H1 signal, and target fit into this context.
`;
  try{
    const ai=await axios.post('/api/ai',{prompt});
    outPre.textContent=ai.data.summary||ai.data.text||JSON.stringify(ai.data,null,2);
  }catch(e){
    console.error('AI error',e);
    outPre.textContent=`❌ AI error: ${e.message}`;
  }
}

// ――― 11) Scanner ―――
async function runScanner(){
  scannerTbody.innerHTML='';
  const filter=scannerFilter.value.trim().toUpperCase();
  const list=filter?symbols.filter(s=>s.includes(filter)):symbols;
  const carry=getPositiveCarryFX();
  let count=0;
  for(const sym of list){
    if(!filter&&count>=20) break;
    await fetchAndDraw(sym,'daily','1d','scannerTempDaily');
    const pb=drawEMAandProbability('scannerTempDaily');
    await fetchAndDraw(sym,'hourly','1h','scannerTempHourly');
    drawFibsOnChart('scannerTempHourly');
    const h1T=charts['scannerTempHourly'].fibTarget??'—';
    const sg =drawRSIandSignal('scannerTempHourly',pb);
    if(!filter&&sg===null) continue;
    let st,sc;
    if(sg===true){ st='Buy Signal confirmed'; sc='green'; }
    else if(sg===false){ st='Sell Signal confirmed'; sc='red'; }
    else { st='Wait for signal'; sc='gray'; }
    let proj='—';
    if(
      cryptoSymbols.includes(sym) ||
      equitiesSymbols.includes(sym)||
      etfSymbols.includes(sym)   ||
      carry.includes(sym)
    ){
      const cagr=await getProjectedAnnualReturn(sym);
      proj=cagr!=null?`${(cagr*100).toFixed(2)}%`:'N/A';
    }
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${sym}</td>
      <td style="color:${pb?'green':'red'}">${pb?'Bullish':'Bearish'}</td>
      <td style="color:${sc}">${st}</td>
      <td>${typeof h1T==='number'?h1T.toFixed(4):h1T}</td>
      <td style="text-align:right;">${proj}</td>
    `;
    scannerTbody.append(tr);
    count++;
  }
}

// ――― 12) Dashboard Update ―――
async function updateDashboard(){
  const sym=symbolInput.value;
  if(!symbols.includes(sym)) return;
  dailyTitle.textContent=`${sym} — Daily`;
  hourlyTitle.textContent=`${sym} — 1 Hour`;
  await fetchAndDraw(sym,'daily','1d','dailyChart');
  await fetchAndDraw(sym,'hourly','1h','hourlyChart');
  drawFibsOnChart('dailyChart');
  drawFibsOnChart('hourlyChart');
  const dailyBull=drawEMAandProbability('dailyChart');
  drawRSIandSignal('hourlyChart',dailyBull);
  await generateAISummary();
  await runScanner();
}

// ――― 13) Initialization ―――
(async function init(){
  await loadInterestRates();
  ['scannerTempDaily','scannerTempHourly'].forEach(id=>{
    if(!document.getElementById(id)){
      const d=document.createElement('div');
      d.id=id; d.style.display='none';
      document.body.appendChild(d);
    }
  });
  symbols.forEach(s=>{
    const o=document.createElement('option');
    o.value=s;
    datalistEl.appendChild(o);
  });
  symbolInput.value=cryptoSymbols[0];
  symbolInput.addEventListener('input',()=>{
    if(symbols.includes(symbolInput.value)) updateDashboard();
  });
  aiBtn.addEventListener('click',generateAISummary);
  scannerFilter.addEventListener('input',runScanner);
  updateDashboard();
})();
