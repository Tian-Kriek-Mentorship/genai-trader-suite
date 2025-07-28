// main.js

// ――― 1) Configuration & State ―――
const cryptoSymbols = [
  'BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT',
  'SOLUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','AVAXUSDT'
];
const forexSymbols = [
  'EURUSD','GBPUSD','USDJPY','AUDUSD',
  'USDCAD','USDCHF','NZDUSD'
];
const symbols = [...cryptoSymbols, ...forexSymbols];

const FX_API_KEY = '2c89d3c16785a95303f907db6b6f8488';  // ForexRateAPI key

const fxCache = {};   // { symbol: { timestamp: ms, data: [...] } }
const charts  = {};   // { containerId: { chart, series, data, ... } }

// DOM refs (script placed at end of body)
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
    const data = resp.data;
    const txt = typeof data === 'string'
      ? data
      : data.summary
        ? data.summary
        : data.text
          ? data.text
          : JSON.stringify(data, null, 2);
    outPre.textContent = txt;
  } catch (e) {
    console.error('AI summary error', e);
    outPre.textContent = `❌ AI error: ${e.message}`;
  }
}

// ――― 3) Indicators: EMA, SMA, RSI ―――
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
  const out = [], n = arr.length;
  for (let i=0; i<n; i++) {
    if (i < p-1) { out.push(null); continue; }
    let sum=0;
    for (let j=i-p+1; j<=i; j++) sum+=arr[j];
    out.push(sum/p);
  }
  return out;
}

function rsi(arr, p) {
  const gains = [], losses = [], out = [];
  for (let i=1; i<arr.length; i++) {
    const d = arr[i]-arr[i-1];
    gains.push(d>0?d:0);
    losses.push(d<0?-d:0);
  }
  let avgG = gains.slice(0,p).reduce((a,b)=>a+b,0)/p;
  let avgL = losses.slice(0,p).reduce((a,b)=>a+b,0)/p;
  out[p] = 100 - (100/(1+avgG/avgL));
  for (let i=p+1; i<arr.length; i++) {
    avgG = (avgG*(p-1) + gains[i-1]) / p;
    avgL = (avgL*(p-1) + losses[i-1]) / p;
    out[i] = 100 - 100/(1+avgG/avgL);
  }
  return out;
}

// ――― 4) Fetch FX daily (cache 1h) ―――
async function getFXData(symbol) {
  const now = Date.now();
  if (fxCache[symbol] && (now - fxCache[symbol].timestamp) < 3600*1000) {
    return fxCache[symbol].data;
  }
  try {
    const toDate   = new Date().toISOString().slice(0,10);
    const fromDate = new Date(now - 365*24*3600*1000).toISOString().slice(0,10);
    const base = symbol.slice(0,3), curr = symbol.slice(3);
    const url = `https://api.forexrateapi.com/v1/timeframe` +
                `?api_key=${FX_API_KEY}` +
                `&start_date=${fromDate}` +
                `&end_date=${toDate}` +
                `&base=${base}` +
                `&currencies=${curr}`;
    const resp = await axios.get(url);
    if (!resp.data || !resp.data.rates) {
      console.error(`ForexRateAPI error for ${symbol}`, resp.data);
      return [];
    }
    const data = Object.entries(resp.data.rates)
      .map(([day,obj]) => {
        const rate = obj[curr];
        return {
          time:  Math.floor(new Date(day).getTime()/1000),
          open:  rate,
          high:  rate,
          low:   rate,
          close: rate
        };
      })
      .sort((a,b) => a.time - b.time);
    fxCache[symbol] = { timestamp: now, data };
    return data;
  } catch(e) {
    console.error(`FX fetch error for ${symbol}`, e);
    return [];
  }
}

// ――― 5) fetchAndDraw: crypto vs FX ―――
async function fetchAndDraw(symbol, type, interval, cid) {
  let data = [];
  if (symbol.endsWith('USDT')) {
    const resp = await axios.get(
      'https://api.binance.com/api/v3/klines',
      { params:{ symbol, interval, limit:1000 } }
    );
    data = resp.data.map(k=>({
      time: k[0]/1000,
      open:+k[1], high:+k[2],
      low:+k[3],  close:+k[4]
    }));
  } else {
    data = await getFXData(symbol);
  }

  const cont = document.getElementById(cid);
  cont.innerHTML = '';
  const chart  = LightweightCharts.createChart(cont,{
    layout:{ textColor:'#000' },
    rightPriceScale:{ scaleMargins:{ top:0.3,bottom:0.1 } },
    timeScale:{ timeVisible:true, secondsVisible:false }
  });
  const series = chart.addCandlestickSeries();
  series.setData(data);
  charts[cid] = { chart, series, data };

  if (interval==='1d') {
    const closes = data.map(d=>d.close),
          arr    = ema(closes,45),
          ed     = data.map((d,i)=>({ time:d.time, value:arr[i] }))
                       .filter(p=>p.value!=null),
          ls     = chart.addLineSeries({ color:'orange', lineWidth:2 });
    ls.setData(ed);
    charts[cid].emaArr = arr;
  }
}

// ――― 6) drawFibsOnChart + auto‑zoom ―――
function drawFibsOnChart(cid) {
  const e = charts[cid];
  if (!e) return;
  const { chart, series, data } = e;

  const o = data.map(d=>d.open),
        h = data.map(d=>d.high),
        l = data.map(d=>d.low);
  const m50 = sma(o,50), m200 = sma(o,200);
  let gc=-1, dc=-1;
  for (let i=1; i<o.length; i++){
    if (m50[i]>m200[i] && m50[i-1]<=m200[i-1]) gc=i;
    if (m50[i]<m200[i] && m50[i-1]>=m200[i-1]) dc=i;
  }
  const up  = gc>dc, idx = up?gc:dc;
  if (idx<0) return;

  let pre   = idx,
      start = ((up?dc:gc)>0?(up?dc:gc):0);
  for (let i=start; i<idx; i++){
    if (up? l[i]<l[pre] : h[i]>h[pre]) pre=i;
  }

  let post=-1;
  for (let i=idx+2; i<data.length-2; i++){
    const fh = h[i]>h[i-1]&&h[i]>h[i-2]&&h[i]>h[i+1]&&h[i]>h[i+2],
          fl = l[i]<l[i-1]&&l[i]<l[i-2]&&l[i]<l[i+1]&&l[i]<l[i+2];
    if (up && fh) { post=i; break; }
    if (!up && fl) { post=i; break; }
  }
  if (post<0) return;

  const preP  = up? l[pre] : h[pre],
        postP = up? h[post]: l[post],
        r     = Math.abs(postP-preP);
  const retr  = up? postP-r*0.618 : postP+r*0.618,
        e127  = up? postP+r*0.27  : postP-r*0.27,
        e618  = up? postP+r*0.618 : postP-r*0.618,
        e2618 = up? postP+r*1.618 : postP-r*1.618;

  let touched=false, moved127=false;
  for (let i=post+1; i<data.length; i++){
    if (up){ if (l[i]<=retr) touched=true; if (h[i]>=e127) moved127=true; }
    else  { if (h[i]>=retr) touched=true; if (l[i]<=e127) moved127=true; }
  }
  const level = touched?e618:(!touched&&!moved127?e127:e2618);

  series.createPriceLine({
    price: level,
    color:'darkgreen',
    lineWidth:2,
    axisLabelVisible:true
  });
  e.fibTarget = level;

  if (!e.zoomSeries) {
    e.zoomSeries = chart.addLineSeries({
      color:'rgba(0,0,0,0)',
      lineWidth:0
    });
  }
  e.zoomSeries.setData([
    { time: data[0].time,            value: level },
    { time: data[data.length-1].time, value: level }
  ]);
}

// ――― 7) EMA & Probability overlay ―――
function drawEMAandProbability(cid) {
  const e = charts[cid];
  if (!e || !e.emaArr) return false;
  const lastC = e.data[e.data.length-1].close,
        lastE = e.emaArr[e.emaArr.length-1],
        bull  = lastC > lastE;
  const id = `${cid}-prob`;

  let div = document.getElementById(id);
  if (!div) {
    div = document.createElement('div');
    div.id = id;
    Object.assign(div.style, {
      position:      'absolute',
      top:           '8px',
      left:          '8px',
      zIndex:        '20',
      fontSize:      '16px',
      fontWeight:    'bold',
      whiteSpace:    'pre',
      pointerEvents: 'none'
    });
    document.getElementById(cid).appendChild(div);
  }
  div.style.color   = bull ? 'green' : 'red';
  div.textContent   = `${bull?'▲':'▼'}\nProbability - ${bull?'Bullish':'Bearish'}`;
  return bull;
}

// ――― 8) RSI & H1 Signal overlay ―――
function drawRSIandSignal(cid, bullish) {
  const e = charts[cid];
  if (!e) return null;
  const arr   = rsi(e.data.map(d=>d.close),13),
        val   = arr[arr.length-1],
        valid = arr.filter(v=>v!=null),
        maVal = sma(valid,14).slice(-1)[0];

  let txt, clr, rtn = null;
  if (bullish) {
    if (val<50 && val>maVal) { txt='Buy Signal confirmed'; clr='green'; rtn=true; }
    else                      { txt='Wait for Buy Signal';    clr='gray';  }
  } else {
    if (val>50 && val<maVal) { txt='Sell Signal confirmed';clr='red';   rtn=false; }
    else                      { txt='Wait for Sell Signal';  clr='gray';  }
  }

  const id = `${cid}-rsi`;
  let div = document.getElementById(id);
  if (!div) {
    div = document.createElement('div');
    div.id = id;
    Object.assign(div.style, {
      position:      'absolute',
      top:           '8px',
      left:          '8px',
      zIndex:        '20',
      fontSize:      '16px',
      fontWeight:    'bold',
      whiteSpace:    'pre',
      pointerEvents: 'none'
    });
    document.getElementById(cid).appendChild(div);
  }
  div.style.color = clr;
  div.textContent = `RSI: ${val.toFixed(2)}\n${txt}`;
  return rtn;
}

// ――― 9) Scanner: only first 20 aligned symbols ―――
async function runScanner() {
  scannerTbody.innerHTML = '';
  const filter = scannerFilter.value.trim().toUpperCase();
  const candidates = filter
    ? symbols.filter(s => s.includes(filter))
    : symbols;

  let count = 0;
  for (const sym of candidates) {
    if (count >= 20) break;

    await fetchAndDraw(sym,'daily','1d','scannerTempDaily');
    const pb = drawEMAandProbability('scannerTempDaily');

    await fetchAndDraw(sym,'hourly','1h','scannerTempHourly');
    drawFibsOnChart('scannerTempHourly');
    const h1T = charts['scannerTempHourly'].fibTarget ?? '—';
    const sg  = drawRSIandSignal('scannerTempHourly', pb);

    // only show confirmed buy/sell signals
    if (sg === null) continue;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${sym}</td>
      <td style="color:${pb?'green':'red'}">${pb?'Bullish':'Bearish'}</td>
      <td style="color:${sg===true?'green':'red'}">
        ${sg===true?'Buy Signal confirmed':'Sell Signal confirmed'}
      </td>
      <td>${typeof h1T==='number'?h1T.toFixed(4):h1T}</td>`;
    scannerTbody.append(tr);

    count++;
  }
}

// ――― 10) updateDashboard ―――
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

// ――― 11) Initialization ―――
(function init(){
  ['scannerTempDaily','scannerTempHourly'].forEach(id=>{
    if (!document.getElementById(id)) {
      const d = document.createElement('div');
      d.id = id; d.style.display = 'none';
      document.body.appendChild(d);
    }
  });

  cryptoSymbols.forEach(s=>
    symbolSelect.append(new Option(s.replace('USDT','/USDT'), s))
  );
  symbolSelect.append(new Option('────────── Forex Pairs ──────────','',false,false));
  forexSymbols.forEach(s=>
    symbolSelect.append(new Option(s.slice(0,3)+'/'+s.slice(3), s))
  );

  symbolSelect.value = cryptoSymbols[0];
  symbolSelect.addEventListener('change', updateDashboard);
  aiBtn.addEventListener('click', generateAISummary);
  scannerFilter.addEventListener('input', runScanner);

  updateDashboard();
})();
