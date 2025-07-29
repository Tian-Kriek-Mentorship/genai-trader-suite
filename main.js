// main.js

// ――― 1) Config & State ―――
const cryptoSymbols = [
  'BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT',
  'SOLUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','AVAXUSDT'
];
const forexSymbols = [
  'EURUSD','EURCAD','GBPUSD','USDJPY','AUDUSD',
  'USDCAD','USDCHF','NZDUSD'
];
const symbols = [...cryptoSymbols, ...forexSymbols];

// read your key injected as window.TD_API_KEY
const TD_API_KEY = window.TD_API_KEY;

const tdCache = {};   // cache for Twelve Data time_series: { "<SYMBOL>_<interval>": data[] }
const charts  = {};   // will hold { chart, series, data, emaArr, fibTarget, zoomSeries }

// DOM refs
const symbolSelect  = document.getElementById('symbolSelect');
const dailyTitle    = document.getElementById('dailyTitle');
const hourlyTitle   = document.getElementById('hourlyTitle');
const aiBtn         = document.getElementById('aiBtn');
const outPre        = document.getElementById('out');
const scannerFilter = document.getElementById('scannerFilter');
const scannerTbody  = document.querySelector('#scannerTable tbody');

// ――― 2) AI Summary ―――
async function generateAISummary() {
  const sym = symbolSelect.value;
  outPre.textContent = `Loading AI summary for ${sym}…`;
  try {
    const resp = await axios.get('/api/ai', { params: { symbol: sym } });
    const d = resp.data;
    outPre.textContent = typeof d === 'string'
      ? d
      : d.summary ? d.summary
      : d.text    ? d.text
      : JSON.stringify(d, null, 2);
  } catch (e) {
    console.error(e);
    outPre.textContent = `❌ AI error: ${e.message}`;
  }
}

// ――― 3) Indicators ―――
function ema(arr, p) {
  const k = 2/(p+1), out = [], n = arr.length;
  let prev;
  for (let i=0; i<n; i++) {
    if (i===p-1) {
      prev = arr.slice(0,p).reduce((a,b)=>a+b,0)/p;
      out[i] = prev;
    } else if (i>=p) {
      prev = arr[i]*k + prev*(1-k);
      out[i] = prev;
    } else {
      out[i] = null;
    }
  }
  return out;
}
function sma(arr, p) {
  const out = [];
  for (let i=0; i<arr.length; i++) {
    if (i < p-1) { out.push(null); continue; }
    let sum = 0;
    for (let j=i-p+1; j<=i; j++) sum += arr[j];
    out.push(sum/p);
  }
  return out;
}
function rsi(arr, p) {
  const gains = [], losses = [], out = [];
  for (let i=1; i<arr.length; i++) {
    const d = arr[i] - arr[i-1];
    gains.push(d>0 ? d : 0);
    losses.push(d<0 ? -d : 0);
  }
  let avgG = gains.slice(0,p).reduce((a,b)=>a+b,0)/p;
  let avgL = losses.slice(0,p).reduce((a,b)=>a+b,0)/p;
  out[p] = 100 - (100/(1 + avgG/avgL));
  for (let i=p+1; i<arr.length; i++){
    avgG = (avgG*(p-1) + gains[i-1]) / p;
    avgL = (avgL*(p-1) + losses[i-1]) / p;
    out[i] = 100 - 100/(1 + avgG/avgL);
  }
  return out;
}

// ――― 4) fetchAndDraw via Twelve Data only ―――
async function fetchAndDraw(symbol, _, interval, containerId) {
  // map flat code to "BASE/QUOTE"
  let tdSymbol;
  if (symbol.endsWith('USDT')) {
    tdSymbol = symbol.slice(0, -4) + '/USDT';
  } else {
    tdSymbol = symbol.slice(0, 3) + '/' + symbol.slice(3);
  }

  const tdInterval = interval === '1d' ? '1day' : '1h';
  const cacheKey   = `${tdSymbol}_${interval}`;
  if (!tdCache[cacheKey]) {
    const resp = await axios.get('https://api.twelvedata.com/time_series', {
      params: {
        symbol:     tdSymbol,
        interval:   tdInterval,
        outputsize: 500,
        apikey:     TD_API_KEY
      }
    });
    const vals = resp.data.values || [];
    tdCache[cacheKey] = vals.map(v => ({
      time:  Math.floor(new Date(v.datetime).getTime()/1000),
      open:  +v.open,
      high:  +v.high,
      low:   +v.low,
      close: +v.close
    })).reverse();
  }
  const data = tdCache[cacheKey];

  // create chart
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const chart = LightweightCharts.createChart(container, {
    layout:          { textColor: '#000' },
    rightPriceScale:{ scaleMargins: { top: 0.3, bottom: 0.1 } },
    timeScale:       { timeVisible: true, secondsVisible: false }
  });
  const series = chart.addCandlestickSeries();
  series.setData(data);
  charts[containerId] = { chart, series, data };

  // 45‑EMA on daily
  if (interval === '1d') {
    const closes = data.map(d=>d.close);
    const arr    = ema(closes, 45);
    const ed     = data.map((d,i)=>({ time: d.time, value: arr[i] }))
                       .filter(p=>p.value != null);
    const ls     = chart.addLineSeries({ color:'orange', lineWidth:2 });
    ls.setData(ed);
    charts[containerId].emaArr = arr;
  }
}

// ――― 5) drawFibsOnChart + auto‑zoom ―――
function drawFibsOnChart(cid) {
  const e = charts[cid];
  if (!e) return;
  const { chart, series, data } = e;
  const o = data.map(d=>d.open),
        h = data.map(d=>d.high),
        l = data.map(d=>d.low);
  const m50 = sma(o,50), m200 = sma(o,200);
  let gc=-1, dc=-1;
  for (let i=1; i<o.length; i++) {
    if (m50[i]>m200[i]&&m50[i-1]<=m200[i-1]) gc = i;
    if (m50[i]<m200[i]&&m50[i-1]>=m200[i-1]) dc = i;
  }
  const up = gc>dc, idx = up?gc:dc;
  if (idx < 0) return;
  let pre = idx, start = ((up?dc:gc)>0?(up?dc:gc):0);
  for (let i=start; i<idx; i++){
    if (up? l[i]<l[pre] : h[i]>h[pre]) pre = i;
  }
  let post = -1;
  for (let i=idx+2; i<data.length-2; i++){
    const fh = h[i]>h[i-1]&&h[i]>h[i-2]&&h[i]>h[i+1]&&h[i]>h[i+2],
          fl = l[i]<l[i-1]&&l[i]<l[i-2]&&l[i]<l[i+1]&&l[i]<l[i+2];
    if (up&&fh)      { post = i; break; }
    if (!up&&fl)     { post = i; break; }
  }
  if (post < 0) return;
  const preP  = up? l[pre] : h[pre],
        postP = up? h[post] : l[post],
        r     = Math.abs(postP-preP);
  const retr  = up? postP-r*0.618 : postP+r*0.618,
        e127  = up? postP+r*0.27  : postP-r*0.27,
        e618  = up? postP+r*0.618 : postP-r*0.618,
        e2618 = up? postP+r*1.618 : postP-r*1.618;
  let touched=false, moved127=false;
  for (let i=post+1; i<data.length; i++){
    if (up) {
      if (l[i]<=retr) touched=true;
      if (h[i]>=e127) moved127=true;
    } else {
      if (h[i]>=retr) touched=true;
      if (l[i]<=e127) moved127=true;
    }
  }
  const level = touched? e618 : (!touched&&!moved127 ? e127 : e2618);
  series.createPriceLine({
    price:            level,
    color:            'darkgreen',
    lineWidth:        2,
    axisLabelVisible: true
  });
  e.fibTarget = level;

  if (!e.zoomSeries) {
    e.zoomSeries = chart.addLineSeries({
      color:     'rgba(0,0,0,0)',
      lineWidth: 0
    });
  }
  e.zoomSeries.setData([
    { time: data[0].time,            value: level },
    { time: data[data.length-1].time, value: level }
  ]);
}

// ――― 6) EMA & Probability overlay ―――
function drawEMAandProbability(cid) {
  const e = charts[cid];
  if (!e || !e.emaArr) return false;
  const lastC = e.data[e.data.length-1].close,
        lastE = e.emaArr[e.emaArr.length-1],
        bull  = lastC > lastE,
        id    = `${cid}-prob`;
  let div = document.getElementById(id);
  if (!div) {
    div = document.createElement('div');
    div.id = id;
    Object.assign(div.style, {
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

// ――― 7) RSI & Signal overlay ―――
function drawRSIandSignal(cid, bullish) {
  const e = charts[cid];
  if (!e) return null;
  const arr   = rsi(e.data.map(d=>d.close), 13),
        val   = arr[arr.length-1],
        valid = arr.filter(v=>v!=null),
        maVal = sma(valid,14).slice(-1)[0];
  let txt, clr, rtn = null;
  if (bullish) {
    if (val<50 && val>maVal) { txt='Buy Signal confirmed'; clr='green'; rtn=true; }
    else                      { txt='Wait for Buy Signal';    clr='gray';  }
  } else {
    if (val>50 && val<maVal) { txt='Sell Signal confirmed';clr='red';   rtn=false; }
    else                      { txt='Wait for Sell Signal'; clr='gray';  }
  }
  const id = `${cid}-rsi`;
  let div = document.getElementById(id);
  if (!div) {
    div = document.createElement('div');
    div.id = id;
    Object.assign(div.style, {
      position:'absolute', top:'8px', left:'8px',
      zIndex:'20', fontSize:'16px', fontWeight:'bold',
      whiteSpace:'pre', pointerEvents:'none'
    });
    document.getElementById(cid).appendChild(div);
  }
  div.style.color   = clr;
  div.textContent   = `RSI: ${val.toFixed(2)}\n${txt}`;
  return rtn;
