// main.js

// —————————————————————————————————————————————————————————————————————
// 1) Configuration & State
// —————————————————————————————————————————————————————————————————————
const cryptoSymbols = [
  'BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT',
  'SOLUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','AVAXUSDT'
];
const forexSymbols = [
  'EURUSD','GBPUSD','USDJPY','AUDUSD',
  'USDCAD','USDCHF','NZDUSD'
];
// master list for dropdown & scanner
const symbols = [...cryptoSymbols, ...forexSymbols];

// your ForexRateAPI key
const FX_API_KEY = '2c89d3c16785a95303f907db6b6f8488';

// cache FX data { SYMBOL: { timestamp: ms, data: [...] } }
const fxCache = {};

// store chart instances & data
const charts = {};

// DOM refs
const symbolSelect  = document.getElementById('symbolSelect');
const dailyTitle    = document.getElementById('dailyTitle');
const hourlyTitle   = document.getElementById('hourlyTitle');
const aiBtn         = document.getElementById('aiBtn');
const outPre        = document.getElementById('out');
const scannerFilter = document.getElementById('scannerFilter');
const scannerTbody  = document.querySelector('#scannerTable tbody');

// —————————————————————————————————————————————————————————————————————
// 2) Utility indicators: EMA, SMA, RSI
// —————————————————————————————————————————————————————————————————————
function ema(arr, period) {
  const k = 2/(period+1), out = [], n = arr.length;
  let prev;
  for (let i=0; i<n; i++) {
    if (i === period-1) {
      prev = arr.slice(0,period).reduce((a,b)=>a+b,0)/period;
      out[i] = prev;
    } else if (i >= period) {
      prev = arr[i]*k + prev*(1-k);
      out[i] = prev;
    } else {
      out[i] = null;
    }
  }
  return out;
}

function sma(arr, period) {
  const out = [], n = arr.length;
  for (let i=0; i<n; i++) {
    if (i < period-1) { out.push(null); continue; }
    let sum = 0;
    for (let j=i-period+1; j<=i; j++) sum += arr[j];
    out.push(sum/period);
  }
  return out;
}

function rsi(arr, period) {
  const gains = [], losses = [], out = [];
  for (let i=1; i<arr.length; i++) {
    const d = arr[i]-arr[i-1];
    gains.push(d>0?d:0);
    losses.push(d<0?-d:0);
  }
  let avgG = gains.slice(0,period).reduce((a,b)=>a+b,0)/period;
  let avgL = losses.slice(0,period).reduce((a,b)=>a+b,0)/period;
  out[period] = 100 - (100/(1 + avgG/avgL));
  for (let i=period+1; i<arr.length; i++) {
    avgG = (avgG*(period-1) + gains[i-1]) / period;
    avgL = (avgL*(period-1) + losses[i-1]) / period;
    out[i] = 100 - 100/(1 + avgG/avgL);
  }
  return out;
}

// —————————————————————————————————————————————————————————————————————
// 3) Fetch FX daily time‑series (caching for 1h)
// —————————————————————————————————————————————————————————————————————
async function getFXData(symbol) {
  const now = Date.now();
  // use cache if <1h old
  if (fxCache[symbol] && (now - fxCache[symbol].timestamp) < 3600*1000) {
    return fxCache[symbol].data;
  }
  // build timeframe: last 365 days or fewer
  const toDate   = new Date().toISOString().slice(0,10);
  const fromDate = new Date(now - 365*24*3600*1000)
                     .toISOString().slice(0,10);
  const from = symbol.slice(0,3);
  const to   = symbol.slice(3);
  const url = `https://api.forexrateapi.com/v1/timeframe` +
              `?api_key=${FX_API_KEY}` +
              `&start_date=${fromDate}` +
              `&end_date=${toDate}` +
              `&base=${from}` +
              `&currencies=${to}`;
  const resp = await axios.get(url);
  // resp.data.rates = { '2025‑07‑27': { USD:1.09123 }, ... }
  const rates = resp.data.rates;
  const data = Object.entries(rates)
    .map(([day, obj]) => {
      const rate = obj[to];
      return {
        time:  Math.floor(new Date(day).getTime()/1000),
        open:  rate,
        high:  rate,
        low:   rate,
        close: rate
      };
    })
    .sort((a,b)=>a.time - b.time);
  fxCache[symbol] = { timestamp: now, data };
  return data;
}

// —————————————————————————————————————————————————————————————————————
// 4) Generic fetch & draw (crypto via Binance, FX via ForexRateAPI)
// —————————————————————————————————————————————————————————————————————
async function fetchAndDraw(symbol, type, interval, containerId) {
  let data;
  if (symbol.endsWith('USDT')) {
    // Crypto: Binance
    const limit = 1000;
    const resp  = await axios.get(
      'https://api.binance.com/api/v3/klines',
      { params:{ symbol, interval, limit } }
    );
    data = resp.data.map(k=>({
      time: k[0]/1000,
      open:+k[1], high:+k[2],
      low:+k[3],  close:+k[4]
    }));
  } else {
    // Forex: only daily supported
    if (interval !== '1d') {
      // fallback: use daily FX for any interval
      data = await getFXData(symbol);
    } else {
      data = await getFXData(symbol);
    }
  }

  // create chart
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

  // inject 45‑EMA on daily (crypto or FX)
  if (interval === '1d') {
    const closes  = data.map(d=>d.close);
    const emaArr  = ema(closes, 45);
    const emaData = data
      .map((d,i)=>({ time:d.time, value:emaArr[i] }))
      .filter(pt=>pt.value != null);
    const emaSeries = chart.addLineSeries({ color:'orange', lineWidth:2 });
    emaSeries.setData(emaData);
    charts[containerId].emaArr = emaArr;
  }
}

// —————————————————————————————————————————————————————————————————————
// 5) Fibonacci + auto‑zoom target (shared for crypto & FX)
// —————————————————————————————————————————————————————————————————————
function drawFibsOnChart(containerId) {
  const e = charts[containerId];
  if (!e) return;
  const { chart, series, data } = e;
  const o = data.map(d=>d.open), h = data.map(d=>d.high), l = data.map(d=>d.low);
  const m50 = sma(o,50), m200 = sma(o,200);
  let lastGC=-1, lastDC=-1;
  for (let i=1; i<o.length; i++){
    if (m50[i]>m200[i] && m50[i-1]<=m200[i-1]) lastGC=i;
    if (m50[i]<m200[i] && m50[i-1]>=m200[i-1]) lastDC=i;
  }
  const up = lastGC>lastDC, idx = up?lastGC:lastDC;
  if (idx < 0) return;
  let pre = idx,
      start = ((up?lastDC:lastGC)>0 ? (up?lastDC:lastGC) : 0);
  for (let i=start; i<idx; i++){
    if (up? l[i]<l[pre] : h[i]>h[pre]) pre=i;
  }
  let post=-1;
  for (let i=idx+2; i<data.length-2; i++){
    const fh = h[i]>h[i-1]&&h[i]>h[i-2]&&h[i]>h[i+1]&&h[i]>h[i+2];
    const fl = l[i]<l[i-1]&&l[i]<l[i-2]&&l[i]<l[i+1]&&l[i]<l[i+2];
    if (up && fh) { post=i; break; }
    if (!up && fl) { post=i; break; }
  }
  if (post<0) return;
  const preP   = up? l[pre] : h[pre],
        postP  = up? h[post]: l[post],
        rangeP = Math.abs(postP-preP);
  const retrace = up? postP-rangeP*0.618: postP+rangeP*0.618,
        ext127   = up? postP+rangeP*0.27 : postP-rangeP*0.27,
        ext618   = up? postP+rangeP*0.618: postP-rangeP*0.618,
        ext2618  = up? postP+rangeP*1.618: postP-rangeP*1.618;
  let touched=false, moved127=false;
  for (let i=post+1; i<data.length; i++){
    if (up) { if (l[i]<=retrace) touched=true; if (h[i]>=ext127) moved127=true; }
    else    { if (h[i]>=retrace) touched=true; if (l[i]<=ext127) moved127=true; }
  }
  const level = touched?ext618 : (!touched&&!moved127?ext127:ext2618);
  series.createPriceLine({
    price: level,
    color:'darkgreen',
    lineWidth:2,
    axisLabelVisible:true
  });
  // stash target
  charts[containerId].fibTarget = level;
  // force zoom to include target
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
// 6) EMA & Probability overlay
// —————————————————————————————————————————————————————————————————————
function drawEMAandProbability(containerId) {
  const e = charts[containerId];
  if (!e || !e.emaArr) return false;
  const lastClose = e.data[e.data.length-1].close;
  const lastEma   = e.emaArr[e.emaArr.length-1];
  const bull      = (lastClose > lastEma);
  const id        = `${containerId}-prob`;
  let div = document.getElementById(id);
  if (!div) {
    div = document.createElement('div');
    div.id = id;
    Object.assign(div.style, {
      position:'absolute', top:'8px', left:'8px',
      zIndex:'20', fontSize:'16px', fontWeight:'bold',
      whiteSpace:'pre', pointerEvents:'none'
    });
    document.getElementById(containerId).appendChild(div);
  }
  div.style.color   = bull?'green':'red';
  div.textContent   = `${bull?'▲':'▼'}\nProbability - ${bull?'Bullish':'Bearish'}`;
  return bull;
}

// —————————————————————————————————————————————————————————————————————
// 7) RSI & H1 Signal overlay
// —————————————————————————————————————————————————————————————————————
function drawRSIandSignal(containerId, bullishDaily) {
  const e = charts[containerId];
  if (!e) return null;
  const closes = e.data.map(d=>d.close);
  const arr    = rsi(closes,13);
  const val    = arr[arr.length-1];
  const valid  = arr.filter(v=>v!=null);
  const maArr  = sma(valid,14);
  const maVal  = maArr[maArr.length-1];
  let txt, clr, rtn=null;
  if (bullishDaily) {
    if (val < 50 && val > maVal) { txt='Buy Signal confirmed'; clr='green'; rtn=true; }
    else                         { txt='Wait for Buy Signal';    clr='gray'; }
  } else {
    if (val > 50 && val < maVal) { txt='Sell Signal confirmed';clr='red';   rtn=false; }
    else                         { txt='Wait for Sell Signal';  clr='gray'; }
  }
  const id = `${containerId}-rsi`;
  let div = document.getElementById(id);
  if (!div) {
    div = document.createElement('div');
    div.id = id;
    Object.assign(div.style, {
      position:'absolute', top:'8px', left:'8px',
      zIndex:'20', fontSize:'16px', fontWeight:'bold',
      whiteSpace:'pre', pointerEvents:'none'
    });
    document.getElementById(containerId).appendChild(div);
  }
  div.style.color = clr;
  div.textContent = `RSI: ${val.toFixed(2)}\n${txt}`;
  return rtn;
}

// —————————————————————————————————————————————————————————————————————
// 8) Scanner (top‑20 default, live filter, shows H1 target)
// —————————————————————————————————————————————————————————————————————
async function runScanner() {
  scannerTbody.innerHTML = '';
  const f = scannerFilter.value.trim().toUpperCase();
  const list = f
    ? symbols.filter(s => s.includes(f))
    : symbols.slice(0,20);

  for (const sym of list) {
    // daily probability
    await fetchAndDraw(sym,'daily','1d','scannerTempDaily');
    const pb = drawEMAandProbability('scannerTempDaily');

    // hourly signal + H1 fibTarget
    await fetchAndDraw(sym,'hourly','1h','scannerTempHourly');
    drawFibsOnChart('scannerTempHourly');
    const h1T = charts['scannerTempHourly'].fibTarget ?? '—';
    const sg = drawRSIandSignal('scannerTempHourly', pb);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${sym}</td>
      <td style="color:${pb?'green':'red'}">${pb?'Bullish':'Bearish'}</td>
      <td style="color:${sg===true?'green':sg===false?'red':'gray'}">
        ${sg===true?'Buy Signal confirmed':sg===false?'Sell Signal confirmed':'Wait for signal'}
      </td>
      <td>${typeof h1T==='number' ? h1T.toFixed(4) : h1T}</td>`;
    scannerTbody.append(tr);
  }
}

// —————————————————————————————————————————————————————————————————————
// 9) Initialize hidden scanner panes & dropdown
// —————————————————————————————————————————————————————————————————————
document.addEventListener('DOMContentLoaded', () => {
  // create hidden scan panes
  ['scannerTempDaily','scannerTempHourly'].forEach(id => {
    if (!document.getElementById(id)) {
      const d = document.createElement('div');
      d.id = id;
      d.style.display = 'none';
      document.body.appendChild(d);
    }
  });
  // live filter
  scannerFilter.addEventListener('input', runScanner);
  // populate dropdown & kick off
  cryptoSymbols.forEach(s => {
    const o = new Option(s.replace('USDT','/USDT'), s);
    symbolSelect.append(o);
  });
  // group forex after a separator
  symbolSelect.append(new Option('────────── Forex Pairs ──────────','',false,false));
  forexSymbols.forEach(s => {
    const lbl = s.slice(0,3) + '/' + s.slice(3);
    const o = new Option(lbl, s);
    symbolSelect.append(o);
  });
  symbolSelect.value = cryptoSymbols[0];
  symbolSelect.addEventListener('change', updateDashboard);
  aiBtn.addEventListener('click', generateAISummary);
  updateDashboard();
});
