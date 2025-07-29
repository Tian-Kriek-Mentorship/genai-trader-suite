// main.js

// ――― 1) Config & State ―――
const cryptoSymbols = [
  'BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT',
  'SOLUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','AVAXUSDT'
];
const forexSymbols = [
  'EURUSD','EURCAD','GBPUSD','USDJPY',
  'AUDUSD','USDCAD','USDCHF','NZDUSD'
];
const symbols = [...cryptoSymbols, ...forexSymbols];

const API_KEY   = window.TD_API_KEY;
const tdCache   = {};
const projCache = {};
let interestRates = {};   // loaded from public/interestRates.json
const charts    = {};

// ――― 2) DOM refs ―――
const symbolSelect  = document.getElementById('symbolSelect');
const dailyTitle    = document.getElementById('dailyTitle');
const hourlyTitle   = document.getElementById('hourlyTitle');
const aiBtn         = document.getElementById('aiBtn');
const outPre        = document.getElementById('out');
const scannerFilter = document.getElementById('scannerFilter');
const scannerTbody  = document.querySelector('#scannerTable tbody');

// ――― 3) Helpers ―――
function toTDSymbol(sym) {
  return sym.endsWith('USDT')
    ? `${sym.slice(0, sym.length - 4)}/USDT`
    : `${sym.slice(0,3)}/${sym.slice(3)}`;
}

function ema(arr,p){
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

function sma(arr,p){
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < p-1) { out.push(null); continue; }
    let sum = 0;
    for (let j = i-p+1; j <= i; j++) sum += arr[j];
    out.push(sum / p);
  }
  return out;
}

function rsi(arr,p){
  const gains = [], losses = [], out = [];
  for (let i = 1; i < arr.length; i++) {
    const d = arr[i] - arr[i-1];
    gains.push(d>0 ? d : 0);
    losses.push(d<0 ? -d : 0);
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

// ――― 4) Load interest rates from JSON ―――
async function loadInterestRates() {
  try {
    const resp = await fetch('/interestRates.json');
    interestRates = await resp.json();
  } catch (e) {
    console.error('Failed to load interest rates', e);
    interestRates = {};
  }
}

function getPositiveCarryFX() {
  return forexSymbols.filter(sym => {
    const base  = sym.slice(0,3);
    const quote = sym.slice(3);
    const rBase  = interestRates[base];
    const rQuote = interestRates[quote];
    return typeof rBase === 'number'
        && typeof rQuote === 'number'
        && rBase > rQuote;
  });
}

// ――― 5) Projected Annual Return (5yr CAGR) ―――
async function getProjectedAnnualReturn(sym) {
  if (projCache[sym] !== undefined) return projCache[sym];

  // 1) Crypto via Binance monthly klines
  if (cryptoSymbols.includes(sym)) {
    try {
      const resp = await axios.get(
        'https://api.binance.com/api/v3/klines',
        { params:{ symbol: sym, interval: '1M', limit: 60 } }
      );
      const data = resp.data;
      if (!data.length) {
        projCache[sym] = null;
        return null;
      }
      const firstClose = parseFloat(data[0][4]);
      const lastClose  = parseFloat(data[data.length-1][4]);
      const years      = (data.length - 1) / 12;
      const cagr       = Math.pow(lastClose / firstClose, 1/years) - 1;
      projCache[sym]   = cagr;
      return cagr;
    } catch (e) {
      console.error(`Binance CAGR error for ${sym}`, e);
      projCache[sym] = null;
      return null;
    }
  }

  // 2) FX via Twelve Data monthly
  try {
    const tdSym = toTDSymbol(sym);
    const resp  = await axios.get(
      'https://api.twelvedata.com/time_series',
      { params:{
          symbol:     tdSym,
          interval:   '1month',
          outputsize: 60,
          apikey:     API_KEY
        }
      }
    );
    const vals = resp.data.values || [];
    if (vals.length < 2) {
      projCache[sym] = null;
      return null;
    }
    const first = parseFloat(vals[0].close);
    const last  = parseFloat(vals[vals.length-1].close);
    const years = (vals.length - 1) / 12;
    const cagr  = Math.pow(last/first, 1/years) - 1;
    projCache[sym] = cagr;
    return cagr;
  } catch (e) {
    console.error(`Twelve Data CAGR error for ${sym}`, e);
    projCache[sym] = null;
    return null;
  }
}

// ――― 6) Fetch & Draw Chart ―――
async function fetchAndDraw(symbol, _, interval, containerId) {
  let data = [];

  if (cryptoSymbols.includes(symbol)) {
    // Crypto via Binance
    try {
      const resp = await axios.get(
        'https://api.binance.com/api/v3/klines',
        { params:{ symbol, interval, limit:1000 } }
      );
      data = resp.data.map(k=>({
        time:  k[0]/1000,
        open:  +k[1],
        high:  +k[2],
        low:   +k[3],
        close: +k[4]
      }));
    } catch (e) {
      console.error(`Binance error for ${symbol}`, e);
    }

  } else {
    // Forex via Twelve Data
    const tdSym = toTDSymbol(symbol);
    const key   = `${tdSym}_${interval}`;
    if (tdCache[key]) {
      data = tdCache[key];
    } else {
      try {
        const tdInt = interval==='1d' ? '1day' : '1h';
        const resp  = await axios.get(
          'https://api.twelvedata.com/time_series',
          { params:{
              symbol:     tdSym,
              interval:   tdInt,
              outputsize: 500,
              apikey:     API_KEY
            }
          }
        );
        const vals = resp.data.values || [];
        data = vals.map(v=>({
          time:  Math.floor(new Date(v.datetime).getTime()/1000),
          open:  +v.open,
          high:  +v.high,
          low:   +v.low,
          close: +v.close
        })).reverse();
      } catch (e) {
        console.error(`Twelve Data error for ${tdSym}`, e);
      }
      tdCache[key] = data;
    }
  }

  // Draw
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const chart = LightweightCharts.createChart(container, {
    layout:{ textColor:'#000' },
    rightPriceScale:{ scaleMargins:{ top:0.3,bottom:0.1 } },
    timeScale:{ timeVisible:true, secondsVisible:false }
  });
  const series = chart.addCandlestickSeries();
  series.setData(data);
  charts[containerId] = { chart, series, data };

  // 45‑EMA on daily
  if (interval==='1d') {
    const closes = data.map(d=>d.close);
    const arr    = ema(closes,45);
    const ed     = data.map((d,i)=>({ time:d.time, value:arr[i] }))
                       .filter(p=>p.value!=null);
    const ls     = chart.addLineSeries({ color:'orange', lineWidth:2 });
    ls.setData(ed);
    charts[containerId].emaArr = arr;
  }
}

// ――― 7) Draw Fibs + Tag Direction + Zoom ―――
function drawFibsOnChart(cid) {
  const e = charts[cid];
  if (!e || !e.data || e.data.length < 5) return;
  const { chart, series, data } = e;
  const o    = data.map(d=>d.open),
        h    = data.map(d=>d.high),
        l    = data.map(d=>d.low),
        m50  = sma(o,50),
        m200 = sma(o,200);
  let gc=-1, dc=-1;
  for (let i=1; i<o.length; i++){
    if (m50[i]>m200[i]&&m50[i-1]<=m200[i-1]) gc=i;
    if (m50[i]<m200[i]&&m50[i-1]>=m200[i-1]) dc=i;
  }
  const up  = gc>dc, idx=up?gc:dc;
  if (idx<2) return;
  let pre   = idx,
      start = ((up?dc:gc)>0 ? (up?dc:gc) : 0);
  for (let i=start; i<idx; i++){
    if (up?l[i]<l[pre]:h[i]>h[pre]) pre = i;
  }
  let post=-1;
  for (let i=idx+2; i<data.length-2; i++){
    const fh = h[i]>h[i-1]&&h[i]>h[i-2]&&h[i]>h[i+1]&&h[i]>h[i+2],
          fl = l[i]<l[i-1]&&l[i]<l[i-2]&&l[i]<l[i+1]&&l[i]<l[i+2];
    if (up&&fh){ post=i; break; }
    if (!up&&fl){ post=i; break; }
  }
  if (post<0) return;
  const preP   = up?l[pre]:h[pre],
        postP  = up?h[post]:l[post],
        r      = Math.abs(postP-preP),
        retr   = up?postP-r*0.618:postP+r*0.618,
        e127   = up?postP+r*0.27:postP-r*0.27,
        e618   = up?postP+r*0.618:postP-r*0.618,
        e2618  = up?postP+r*1.618:postP-r*1.618;
  let touched=false, moved127=false;
  for (let i=post+1; i<data.length; i++){
    if (up){ if (l[i]<=retr) touched=true; if (h[i]>=e127) moved127=true; }
    else   { if (h[i]>=retr) touched=true; if (l[i]<=e127) moved127=true; }
  }
  const level = touched?e618:(!touched&&!moved127?e127:e2618);

  series.createPriceLine({
    price:            level,
    color:            'darkgreen',
    lineWidth:        2,
    axisLabelVisible: true,
    title:            `Fibonacci Target: ${level.toFixed(4)}`
  });

  e.fibTarget    = level;
  e.fibDirection = up ? 'up' : 'down';

  if (!e.zoomSeries) {
    e.zoomSeries = chart.addLineSeries({ color:'rgba(0,0,0,0)', lineWidth:0 });
  }
  e.zoomSeries.setData([
    { time:data[0].time,            value:level },
    { time:data[data.length-1].time,value:level }
  ]);
}

// ――― 8) EMA & Probability overlay ―――
function drawEMAandProbability(cid) {
  const e = charts[cid];
  if (!e || !e.data || !e.emaArr) return false;
  const lastC = e.data[e.data.length-1].close,
        lastE = e.emaArr[e.emaArr.length-1],
        bull  = lastC > lastE,
        id    = `${cid}-prob`;
  let div = document.getElementById(id);
  if (!div) {
    div = document.createElement('div');
    div.id = id;
    Object.assign(div.style,{
      position:'absolute', top:'8px', left:'8px',
      zIndex:'20', fontSize:'16px', fontWeight:'bold',
      whiteSpace:'pre', pointerEvents:'none'
    });
    document.getElementById(cid).appendChild(div);
  }
  div.style.color   = bull ? 'green' : 'red';
  div.textContent   = `${bull?'▲':'▼'}\nProbability - ${bull?'Bullish':'Bearish'}`;
  return bull;
}

// ――― 9) RSI & H1 Signal overlay (aligned to daily) ―――
function drawRSIandSignal(cid, dailyBullish) {
  const e = charts[cid];
  if (!e || !e.data) return null;

  // dailyBullish → only buy logic
  if (dailyBullish) {
    if (e.fibDirection==='down') {
      _renderRSIDiv(cid,'Wait for Buy Signal','gray');
      return null;
    }  
    const arr   = rsi(e.data.map(d=>d.close),13),
          val   = arr[arr.length-1],
          valid = arr.filter(v=>v!=null),
          maVal = sma(valid,14).slice(-1)[0];
    if (val<50&&val>maVal) {
      _renderRSIDiv(cid,'Buy Signal confirmed','green',val);
      return true;
    }
    _renderRSIDiv(cid,'Wait for Buy Signal','gray',val);
    return null;
  }

  // dailyBearish → only sell logic
  if (e.fibDirection==='up') {
    _renderRSIDiv(cid,'Wait for Sell Signal','gray');
    return null;
  }
  _renderRSIDiv(cid,'Sell Signal confirmed','red');
  return false;
}

function _renderRSIDiv(cid,text,color,val) {
  const id = `${cid}-rsi`;
  let div = document.getElementById(id);
  if (!div) {
    div = document.createElement('div');
    div.id = id;
    Object.assign(div.style,{
      position:'absolute', top:'8px', left:'8px',
      zIndex:'20', fontSize:'16px', fontWeight:'bold',
      whiteSpace:'pre', pointerEvents:'none'
    });
    document.getElementById(cid).appendChild(div);
  }
  div.style.color = color;
  div.textContent = val!=null ? `RSI: ${val.toFixed(2)}\n${text}` : text;
}

// ――― 10) Enhanced AI Summary ―――
async function generateAISummary() {
  const sym = symbolSelect.value;
  outPre.textContent = `Loading AI summary for ${sym}…`;

  const bull   = drawEMAandProbability('dailyChart');
  const sig    = drawRSIandSignal('hourlyChart', bull);
  const target = charts.hourlyChart?.fibTarget;

  let avgRet = 'N/A';
  try {
    const tdSym = toTDSymbol(sym);
    const resp  = await axios.get(
      'https://api.twelvedata.com/time_series',
      { params:{ symbol:tdSym, interval:'1month', outputsize:60, apikey:API_KEY } }
    );
    const vals = resp.data.values||[];
    const rets = [];
    for (let i=1; i<vals.length; i++){
      const p = parseFloat(vals[i-1].close),
            c = parseFloat(vals[i].close);
      rets.push((c/p - 1)*100);
    }
    const avg = rets.reduce((a,b)=>a+b,0)/rets.length;
    avgRet = `${avg.toFixed(2)}%`;
  } catch(e) {
    console.error('Monthly return error', e);
  }

  const prompt = `
Symbol: ${sym}
Probability (45‑EMA): ${bull?'Bullish':'Bearish'}
H1 Signal: ${ sig===true  ? 'Buy Signal confirmed'
               : sig===false ? 'Sell Signal confirmed'
                             : 'Wait for signal' }
Fibonacci Target: ${target!=null?target.toFixed(4):'—'}
Average monthly return (last 5 years): ${avgRet}

Write a concise analysis covering:
1. The current state of ${sym} and overall market sentiment.
2. Major upcoming announcements or events that could impact it.
3. How the probability, H1 signal, and target fit into this context.
`;

  try {
    const aiResp = await axios.post('/api/ai', { prompt });
    const d      = aiResp.data;
    outPre.textContent = d.summary || d.text || JSON.stringify(d,null,2);
  } catch(e) {
    console.error('AI error', e);
    outPre.textContent = `❌ AI error: ${e.message}`;
  }
}

// ――― 11) Scanner ―――
async function runScanner() {
  scannerTbody.innerHTML = '';
  const filter    = scannerFilter.value.trim().toUpperCase();
  const list      = filter ? symbols.filter(s=>s.includes(filter)) : symbols;
  const carryList = getPositiveCarryFX();
  let count = 0;

  for (const sym of list) {
    if (!filter && count >= 20) break;

    await fetchAndDraw(sym,'daily','1d','scannerTempDaily');
    const pb = drawEMAandProbability('scannerTempDaily');

    await fetchAndDraw(sym,'hourly','1h','scannerTempHourly');
    drawFibsOnChart('scannerTempHourly');
    const h1T = charts['scannerTempHourly'].fibTarget ?? '—';
    const sg  = drawRSIandSignal('scannerTempHourly', pb);

    if (!filter && sg === null) continue;

    let st, sc;
    if (sg === true)    { st = 'Buy Signal confirmed';  sc = 'green'; }
    else if (sg === false){ st = 'Sell Signal confirmed'; sc = 'red';   }
    else                 { st = 'Wait for signal';       sc = 'gray';  }

    // Projected Annual Return for crypto or positive-carry FX
    let proj = '—';
    if (cryptoSymbols.includes(sym) || carryList.includes(sym)) {
      const cagr = await getProjectedAnnualReturn(sym);
      proj = cagr != null ? `${(cagr * 100).toFixed(2)}%` : 'N/A';
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
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

// ――― 12) Full Dashboard Update ―――
async function updateDashboard() {
  const sym = symbolSelect.value;
  if (!sym) return;

  dailyTitle.textContent  = `${sym} — Daily`;
  hourlyTitle.textContent = `${sym} — 1 Hour`;

  await fetchAndDraw(sym,'daily','1d','dailyChart');
  await fetchAndDraw(sym,'hourly','1h','hourlyChart');
  drawFibsOnChart('dailyChart');
  drawFibsOnChart('hourlyChart');
  const dailyBull = drawEMAandProbability('dailyChart');
  drawRSIandSignal('hourlyChart', dailyBull);

  await generateAISummary();
  await runScanner();
}

// ――― 13) Initialization ―――
(async function init() {
  await loadInterestRates();

  // hidden divs for scanner
  ['scannerTempDaily','scannerTempHourly'].forEach(id => {
    if (!document.getElementById(id)) {
      const d = document.createElement('div');
      d.id = id;
      d.style.display = 'none';
      document.body.appendChild(d);
    }
  });

  // populate dropdown
  cryptoSymbols.forEach(s =>
    symbolSelect.append(new Option(s.replace('USDT','/USDT'), s))
  );
  const sep = new Option('────────── Forex Pairs ──────────','',false,false);
  sep.disabled = true;
  symbolSelect.append(sep);
  forexSymbols.forEach(s =>
    symbolSelect.append(new Option(s.slice(0,3)+'/'+s.slice(3), s))
  );

  symbolSelect.value = cryptoSymbols[0];
  symbolSelect.addEventListener('change', updateDashboard);
  aiBtn.addEventListener('click', generateAISummary);
  scannerFilter.addEventListener('input', runScanner);

  updateDashboard();
})();
