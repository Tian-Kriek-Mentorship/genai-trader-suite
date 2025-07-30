// main.js

// ――― 0) Shared localStorage Cache (30 min) ―――
const CACHE_KEY = 'gtm_cache';
const CACHE_TTL = 30 * 60 * 1000;
function loadCache() {
  try {
    const s = localStorage.getItem(CACHE_KEY);
    if (!s) return {};
    const o = JSON.parse(s);
    if (Date.now() - o.ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return {};
    }
    return o.data || {};
  } catch {
    return {};
  }
}
function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

// ――― 0.5) Rate‑limit detection & banner ―――
let rateLimited = false;
axios.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 429 && !rateLimited) {
      rateLimited = true;
      const b = document.getElementById('rateLimitBanner');
      if (b) b.style.display = 'block';
    }
    return Promise.reject(err);
  }
);

// ――― 1) Config & State ―――
const API_KEY = window.TD_API_KEY;
console.log('🚀 TD API key is:', API_KEY);

const cryptoSymbols   = ['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT','SOLUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','AVAXUSDT'];
const forexSymbols    = ['EURUSD','USDJPY','GBPUSD','USDCHF','USDCAD','AUDUSD','NZDUSD','EURGBP','EURJPY','EURCHF','EURCAD','EURNZD','GBPJPY','GBPCHF','GBPAUD','GBPCAD','GBPNZD','AUDJPY','AUDCAD','AUDCHF','AUDNZD','CADJPY','CADCHF','CADNZD','CHFJPY','NZDJPY','NZDCHF'];
const equitiesSymbols = ['AAPL','MSFT','NVDA','GOOG','META','AMZN','TSLA','BRK.B','UNH','JPM','V','MA','PG','HD','JNJ','BAC','PFE','CVX','XOM','KO'];
const etfSymbols      = ['BITO','BLOK','BTF','IBIT','FBTC','GBTC','ETHE'];
const symbols         = [...cryptoSymbols, ...forexSymbols, ...equitiesSymbols, ...etfSymbols];

const projCache    = {};
let interestRates  = {};
const charts       = {};

// ――― 2) DOM refs ―――
const symbolInput   = document.getElementById('symbolInput');
const datalistEl    = document.getElementById('symbolOptions');
const dailyTitle    = document.getElementById('dailyTitle');
const hourlyTitle   = document.getElementById('hourlyTitle');
const aiBtn         = document.getElementById('aiBtn');
const outPre        = document.getElementById('out');
const scannerFilter = document.getElementById('scannerFilter');
const scannerTbody  = document.querySelector('#scannerTable tbody');

// ――― 3) Math Helpers ―――
function ema(arr, p) {
  const k = 2 / (p + 1), out = [], n = arr.length;
  let prev;
  for (let i = 0; i < n; i++) {
    if (i === p - 1) {
      prev = arr.slice(0, p).reduce((a, b) => a + b, 0) / p;
      out[i] = prev;
    } else if (i >= p) {
      prev = arr[i] * k + prev * (1 - k);
      out[i] = prev;
    } else {
      out[i] = null;
    }
  }
  return out;
}

function sma(arr, p) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < p - 1) {
      out.push(null);
      continue;
    }
    let sum = 0;
    for (let j = i - p + 1; j <= i; j++) sum += arr[j];
    out.push(sum / p);
  }
  return out;
}

function rsi(arr, p) {
  const gains = [], losses = [], out = [];
  for (let i = 1; i < arr.length; i++) {
    const d = arr[i] - arr[i - 1];
    gains.push(d > 0 ? d : 0);
    losses.push(d < 0 ? -d : 0);
  }
  let avgG = gains.slice(0, p).reduce((a, b) => a + b, 0) / p;
  let avgL = losses.slice(0, p).reduce((a, b) => a + b, 0) / p;
  out[p] = 100 - 100 / (1 + avgG / avgL);
  for (let i = p + 1; i < arr.length; i++) {
    avgG = (avgG * (p - 1) + gains[i - 1]) / p;
    avgL = (avgL * (p - 1) + losses[i - 1]) / p;
    out[i] = 100 - 100 / (1 + avgG / avgL);
  }
  return out;
}

// ――― 4) Interest Rates ―――
function toTDSymbol(sym) {
  if (cryptoSymbols.includes(sym))      return null;
  if (forexSymbols.includes(sym))       return `${sym.slice(0,3)}/${sym.slice(3)}`;
  return sym; // stocks & ETFs use plain symbol
}

async function loadInterestRates() {
  try {
    const r = await fetch('/interestRates.json');
    interestRates = await r.json();
  } catch {
    interestRates = {};
  }
}

function getPositiveCarryFX() {
  return forexSymbols.filter(sym => {
    const b = sym.slice(0,3), q = sym.slice(3);
    return (interestRates[b]||0) > (interestRates[q]||0);
  });
}

// ――― 5) Projected Annual Return ―――
async function getProjectedAnnualReturn(sym) {
  if (projCache[sym] !== undefined) return projCache[sym];
  if (cryptoSymbols.includes(sym)) {
    const sc = loadCache();
    if (sc[sym]?.proj != null) return projCache[sym] = sc[sym].proj;
    try {
      const resp = await axios.get('https://api.binance.com/api/v3/klines', {
        params:{ symbol: sym, interval: '1M', limit: 60 }
      });
      const d = resp.data;
      const first = parseFloat(d[0][4]), last = parseFloat(d[d.length-1][4]);
      const yrs = (d.length-1)/12, cagr = Math.pow(last/first,1/yrs)-1;
      sc[sym] = sc[sym]||{}; sc[sym].proj = cagr; saveCache(sc);
      return projCache[sym] = cagr;
    } catch {
      return projCache[sym] = null;
    }
  }
  return projCache[sym] = null;
}

// ――― 6) fetchAndRender (with cache & rate‑limit fallback) ―――
async function fetchAndRender(symbol, interval, containerId) {
  const sc = loadCache();
  sc[symbol] = sc[symbol]||{};
  let data = sc[symbol][interval];

  if (!data && (cryptoSymbols.includes(symbol) || !rateLimited)) {
    try {
      if (cryptoSymbols.includes(symbol)) {
        const r = await axios.get('https://api.binance.com/api/v3/klines', {
          params:{ symbol, interval, limit: 1000 }
        });
        data = r.data.map(k=>({
          time: k[0]/1000,
          open:+k[1], high:+k[2],
          low: +k[3], close:+k[4]
        }));
      } else {
        const tdInt = interval==='1d' ? '1day' : '1h';
        const tdSym = toTDSymbol(symbol);
        const r = await axios.get('https://api.twelvedata.com/time_series', {
          params:{ symbol: tdSym, interval: tdInt, outputsize: 2200, apikey: API_KEY }
        });
        if (r.data.status === 'error') throw new Error(r.data.message);
        const vals = r.data.values||[];
        data = vals.map(v=>({
          time: Math.floor(new Date(v.datetime).getTime()/1000),
          open:+v.open, high:+v.high,
          low: +v.low, close:+v.close
        })).reverse();
      }
      sc[symbol][interval] = data;
      saveCache(sc);
    } catch(e) {
      if (rateLimited) {
        outPre.textContent = '⚠️ Twelve Data rate limit reached—showing cached data.';
      } else {
        console.error(e);
        outPre.textContent = `Fetch error: ${e.message}`;
      }
      data = sc[symbol][interval] || [];
    }
  }

  // render chart
  const c = document.getElementById(containerId);
  c.innerHTML = '';
  const chart = LightweightCharts.createChart(c, {
    layout:           { textColor: '#000' },
    rightPriceScale:  { scaleMargins: { top: 0.3, bottom: 0.1 } },
    timeScale:        { timeVisible: true, secondsVisible: false }
  });
  const series = chart.addCandlestickSeries();
  series.setData(data);
  charts[containerId] = { chart, series, data };

  // overlays
  if (interval === '1d') {
    const arr = ema(data.map(d=>d.close),45);
    chart.addLineSeries({ lineWidth: 2 })
         .setData(data.map((d,i)=>({ time:d.time, value:arr[i] }))
                     .filter(p=>p.value!=null));
    charts[containerId].emaArr = arr;
  } else {
    const opens = data.map(d=>d.open);
    const s50   = sma(opens,50), s200 = sma(opens,200);
    chart.addLineSeries({ lineWidth: 2 })
         .setData(data.map((d,i)=>({ time:d.time, value:s50[i] }))
                     .filter(p=>p.value!=null));
    chart.addLineSeries({ lineWidth: 2 })
         .setData(data.map((d,i)=>({ time:d.time, value:s200[i] }))
                     .filter(p=>p.value!=null));
  }

  // annotations & labels
  drawFibsOnChart(containerId);
  if (interval==='1d') drawEMAandProbability(containerId);
  if (interval==='1h') drawRSIandSignal(containerId, drawEMAandProbability('dailyChart'));
}

// ――― 7) drawFibsOnChart ―――
function drawFibsOnChart(cid){

  const e=charts[cid]; if(!e?.data?.length) return;
  const {chart,series,data}=e;
  const opens=data.map(d=>d.open), m50=sma(opens,50), m200=sma(opens,200);
  let lastGC=-1,lastDC=-1;
  for(let i=1;i<opens.length;i++){
    if(m50[i]>m200[i]&&m50[i-1]<=m200[i-1]) lastGC=i;
    if(m50[i]<m200[i]&&m50[i-1]>=m200[i-1]) lastDC=i;
  }
  const isUp=lastGC>lastDC, cross=isUp?lastGC:lastDC;
  if(cross<2) return;

  const findPre=(st,en)=>{let idx=en;
    for(let i=st;i<=en;i++){
      if(isUp?data[i].low<data[idx].low:data[i].high>data[idx].high) idx=i;
    }
    return idx;
  };
  const findPost=from=>{for(let i=from+2;i<data.length-2;i++){
    const fh=data[i].high>data[i-1].high&&data[i].high>data[i-2].high&&data[i].high>data[i+1].high&&data[i].high>data[i+2].high;
    const fl=data[i].low<data[i-1].low&&data[i].low<data[i-2].low&&data[i].low<data[i+1].low&&data[i].low<data[i+2].low;
    if(isUp&&fh) return i;
    if(!isUp&&fl) return i;
  } return -1;};

  let preIdx=findPre(isUp?(lastDC>0?lastDC:0):(lastGC>0?lastGC:0),cross),
      postIdx=findPost(cross);
  if(postIdx<0) return;

  const computeTarget=(p,q)=>{const p0=isUp?data[p].low:data[p].high,p1=isUp?data[q].high:data[q].low,r=Math.abs(p1-p0),
    lvl=isUp
      ?{retr:p1-r*0.618,ext127:p1+r*0.27,ext618:p1+r*0.618,ext2618:p1+r*1.618}
      :{retr:p1+r*0.618,ext127:p1-r*0.27,ext618:p1-r*0.618,ext2618:p1-r*1.618};
    let touched=false,moved127=false;
    for(let i=q+1;i<data.length;i++){
      if(isUp){ if(data[i].low<=lvl.retr) touched=true; if(data[i].high>=lvl.ext127) moved127=true; }
      else   { if(data[i].high>=lvl.retr) touched=true; if(data[i].low<=lvl.ext127) moved127=true; }
    }
    return touched?lvl.ext618:(!touched&&!moved127?lvl.ext127:lvl.ext2618);
  };

  let target=computeTarget(preIdx,postIdx), lastClose=data[data.length-1].close;
  while((isUp&&lastClose>=target)||(!isUp&&lastClose<=target)){
    preIdx=postIdx;
    postIdx=findPost(preIdx);
    if(postIdx<0) break;
    target=computeTarget(preIdx,postIdx);
  }

  if(e._fibLineId) series.removePriceLine(e._fibLineId);
  const line=series.createPriceLine({price:target,color:'darkgreen',lineWidth:2,axisLabelVisible:true,title:`Fibonacci Target: ${target.toFixed(4)}`});
  e._fibLineId=line.id;
  if(!e._zoom) e._zoom=chart.addLineSeries({color:'transparent',lineWidth:0});
  e._zoom.setData([{time:data[0].time,value:target},{time:data[data.length-1].time,value:target}]);
  e.fibTarget=target;
}

// ――― 8) drawEMAandProbability ―――
function drawEMAandProbability(cid){
  const e=charts[cid]; if(!e?.data?.length||!e.emaArr) return false;
  const lastC=e.data[e.data.length-1].close, lastE=e.emaArr[e.emaArr.length-1], bull=lastC>lastE;
  const id=`${cid}-prob`;
  let div=document.getElementById(id);
  if(!div){
    div=document.createElement('div'); div.id=id;
    Object.assign(div.style,{position:'absolute',top:'8px',left:'8px',zIndex:20,fontSize:'16px',fontWeight:'bold',whiteSpace:'pre',pointerEvents:'none'});
    document.getElementById(cid).appendChild(div);
  }
  div.style.color=bull?'green':'red';
  div.textContent=`${bull?'▲':'▼'}\nProbability - ${bull?'Bullish':'Bearish'}`;
  return bull;
}

// ――― 9) drawRSIandSignal ―――
function drawRSIandSignal(cid,dailyBullish){
  const e=charts[cid]; if(!e?.data?.length) return null;
  const arr=rsi(e.data.map(d=>d.close),13), val=arr[arr.length-1], valid=arr.filter(v=>v!=null), maVal=sma(valid,14).slice(-1)[0];
  let text,color,signal=null;
  if(dailyBullish){
    if(val<50&&val>maVal){text='Buy Signal confirmed';color='green';signal=true;}
    else{text='Wait for Buy Signal';color='gray';}
  } else {
    if(val>50&&val<maVal){text='Sell Signal confirmed';color='red';signal=false;}
    else{text='Wait for Sell Signal';color='gray';}
  }
  const id=`${cid}-rsi`;
  let div=document.getElementById(id);
  if(!div){
    div=document.createElement('div'); div.id=id;
    Object.assign(div.style,{position:'absolute',top:'28px',left:'8px',zIndex:20,fontSize:'16px',fontWeight:'bold',whiteSpace:'pre',pointerEvents:'none'});
    document.getElementById(cid).appendChild(div);
  }
  div.style.color=color;
  div.textContent=`RSI: ${val.toFixed(2)}\n${text}`;
  return signal;
}

// ――― 10) generateAISummary ―――
async function generateAISummary(){
  const sym = symbolInput.value;
  outPre.textContent = `Loading AI summary for ${sym}…`;

  // draw and capture indicators
  const bull = drawEMAandProbability('dailyChart');
  const sig  = drawRSIandSignal('hourlyChart', bull);
  const tgt  = charts.hourlyChart?.fibTarget ?? '—';

  // compute average monthly return
  let avgRet = 'N/A';
  try {
    const resp = await axios.get('https://api.twelvedata.com/time_series', {
      params: { symbol: sym, interval: '1month', outputsize: 60, apikey: API_KEY }
    });
    let vals = (resp.data.values || []).slice().reverse();
    if (vals.length > 1) {
      const rets = [];
      for (let i = 1; i < vals.length; i++) {
        const prev = parseFloat(vals[i - 1].close);
        const cur  = parseFloat(vals[i].close);
        rets.push((cur / prev - 1) * 100);
      }
      avgRet = `${(rets.reduce((a, b) => a + b, 0) / rets.length).toFixed(2)}%`;
    }
  } catch {}

  // build prompt
  const prompt = `
Symbol: ${sym}
Probability (45‑EMA): ${bull ? 'Bullish' : 'Bearish'}
H1 Signal: ${sig ? 'Buy Signal confirmed' : 'Wait for signal'}
Fibonacci Target: ${tgt}
Average monthly return (last 5 years): ${avgRet}

Write a concise analysis covering:
1. The current state of ${sym} and overall market sentiment.
2. Major upcoming announcements or events that could impact it.
3. How the probability, H1 signal, and target fit into this context.
  `;

  // call AI
  try {
    const ai = await axios.post('/api/ai', { prompt });
    outPre.textContent = ai.data.summary || ai.data.text || JSON.stringify(ai.data, null, 2);
  } catch (e) {
    outPre.textContent = `❌ AI error: ${e.message}`;
  }
}

// ――― 11.0) Scanner cache (1 hour) ―――
let lastScan = { ts: 0, data: [] };
function renderScannerRows(rows) {
  scannerTbody.innerHTML = '';
  for (const r of rows) {
    scannerTbody.append(r);
  }
}

import { runScanner } from './scanner.js';

// ――― 12) updateDashboard ―――
async function updateDashboard(){
  const sym = symbolInput.value;
  if (!symbols.includes(sym)) return;

  dailyTitle.textContent  = `${sym} — Daily`;
  hourlyTitle.textContent = `${sym} — 1 Hour`;

  await fetchAndRender(sym, '1d', 'dailyChart');
  await fetchAndRender(sym, '1h', 'hourlyChart');

  drawFibsOnChart('dailyChart');
  drawFibsOnChart('hourlyChart');

  const bull = drawEMAandProbability('dailyChart');
  drawRSIandSignal('hourlyChart', bull);

  await generateAISummary();
  await runScanner();           // <— now lives in scanner.js
}

// ――― 13) init ―――
(async function init(){
  await loadInterestRates();

  // hidden divs…
  ['scannerTempDaily','scannerTempHourly'].forEach(id=>{
    if (!document.getElementById(id)){
      const d = document.createElement('div');
      d.id = id; d.style.display='none';
      document.body.appendChild(d);
    }
  });

  // datalist…
  symbols.forEach(s=>{
    const o = document.createElement('option');
    o.value = s;
    datalistEl.appendChild(o);
  });

  // event handlers…
  symbolInput.addEventListener('input',()=>{ if(symbols.includes(symbolInput.value)) updateDashboard(); });
  aiBtn.addEventListener('click', generateAISummary);
  scannerFilter.addEventListener('input', runScanner);

  // first draw
  updateDashboard();
})();
