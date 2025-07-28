// main.js

// 1) Top‑10 USDT trading pairs
const symbols = [
  'BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT',
  'SOLUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','AVAXUSDT'
];

// 2) DOM refs
const symbolSelect = document.getElementById('symbolSelect');
const dailyTitle   = document.getElementById('dailyTitle');
const hourlyTitle  = document.getElementById('hourlyTitle');
const aiBtn        = document.getElementById('aiBtn');
const outPre       = document.getElementById('out');

// 3) Store each chart’s chart, series & raw data here
const charts = {};

// 4) Populate the symbol dropdown
symbols.forEach(sym => {
  const opt = document.createElement('option');
  opt.value = sym;
  opt.text  = sym.replace('USDT','/USDT');
  symbolSelect.appendChild(opt);
});

// 5) EMA helper
function ema(arr, period) {
  const k = 2 / (period + 1);
  const out = [];
  let emaPrev;
  for (let i = 0; i < arr.length; i++) {
    if (i === period - 1) {
      const sum = arr.slice(0, period).reduce((a, b) => a + b, 0);
      emaPrev = sum / period;
      out[i] = emaPrev;
    } else if (i >= period) {
      const v = arr[i] * k + emaPrev * (1 - k);
      emaPrev = v;
      out[i] = v;
    } else {
      out[i] = null;
    }
  }
  return out;
}

// 6) AI summary (unchanged)
async function generateAISummary() {
  const sym = symbolSelect.value;
  outPre.textContent = `Loading AI summary for ${sym}…`;
  try {
    const resp = await axios.get('/api/ai', { params: { symbol: sym } });
    let summary = (
      typeof resp.data === 'string'   ? resp.data :
      resp.data.summary               ? resp.data.summary :
      resp.data.text                  ? resp.data.text :
      JSON.stringify(resp.data, null, 2)
    );
    outPre.textContent = summary;
  } catch (e) {
    console.error('[AI]', e);
    outPre.textContent = `❌ AI error: ${e.message}`;
  }
}
aiBtn.addEventListener('click', generateAISummary);

// 7) Main updater: redraw charts → draw fibs → EMA & probability → AI summary
async function updateDashboard() {
  const sym = symbolSelect.value;
  dailyTitle.textContent  = `${sym} — Daily`;
  hourlyTitle.textContent = `${sym} — 1 Hour`;

  // draw both charts (fills charts[...] entries)
  await fetchAndDraw(sym, 'daily',  '1d', 'dailyChart');
  await fetchAndDraw(sym, 'hourly', '1h', 'hourlyChart');

  // draw fibs on each
  drawFibsOnChart('dailyChart');
  drawFibsOnChart('hourlyChart');

  // draw EMA + probability on daily only
  drawEMAandProbability('dailyChart');

  // AI summary
  await generateAISummary();
}
symbolSelect.addEventListener('change', updateDashboard);
updateDashboard();

// ─── fetch + draw candlesticks ────────────────────────────────────
async function fetchAndDraw(symbol, type, interval, containerId) {
  const limit = 1000; // fetch enough to include crosses
  const resp = await axios.get(
    'https://api.binance.com/api/v3/klines', { params: { symbol, interval, limit } }
  );
  const data = resp.data.map(k => ({
    time:  k[0] / 1000,
    open:  +k[1], high:+k[2],
    low:   +k[3], close:+k[4]
  }));

  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const chart = LightweightCharts.createChart(container, {
    layout:          { textColor: '#000' },
    rightPriceScale: { scaleMargins: { top: 0.3, bottom: 0.1 } },
    timeScale:       { timeVisible: true, secondsVisible: false }
  });
  const series = chart.addCandlestickSeries();
  series.setData(data);

  // stash chart, series, data
  charts[containerId] = { chart, series, data };

  // if daily, add EMA line
  if (containerId === 'dailyChart') {
    const closes = data.map(d => d.close);
    const emaArr = ema(closes, 45);
    const emaData = data.map((d, i) => ({ time: d.time, value: emaArr[i] })).filter(pt => pt.value !== null);
    const emaSeries = chart.addLineSeries({ color: 'orange', lineWidth: 2 });
    emaSeries.setData(emaData);
    charts[containerId].emaArr = emaArr;
  }
}

// ─── draw your Fibonacci target with auto-zoom ────────────────────
function drawFibsOnChart(containerId) {
  const entry = charts[containerId]; if (!entry) return;
  const { chart, series, data } = entry;

  // SMA helper
  const sma = (arr, p) => { const out=[]; for(let i=0;i<arr.length;i++){ if(i<p-1){out.push(null);continue;} let s=0;for(let j=i-p+1;j<=i;j++)s+=arr[j]; out.push(s/p);} return out; };
  const opens=data.map(d=>d.open), highs=data.map(d=>d.high), lows=data.map(d=>d.low);
  const ma50=sma(opens,50), ma200=sma(opens,200);
  let lastGC=-1, lastDC=-1;
  for(let i=1;i<opens.length;i++){
    if(ma50[i]>ma200[i]&& ma50[i-1]<=ma200[i-1]) lastGC=i;
    if(ma50[i]<ma200[i]&& ma50[i-1]>=ma200[i-1]) lastDC=i;
  }
  const isUp = lastGC>lastDC;
  const idx  = isUp?lastGC:lastDC;
  if(idx<0) return;

  // find pre and post swings
  let pre=idx, start=(isUp?lastDC:lastGC)>0?(isUp?lastDC:lastGC):0;
  for(let i=start;i<idx;i++){ if(isUp? lows[i]<lows[pre] : highs[i]>highs[pre]) pre=i; }
  let post=-1;
  for(let i=idx+2;i<data.length-2;i++){
    const fh = highs[i]>highs[i-1]&&highs[i]>highs[i-2]&&highs[i]>highs[i+1]&&highs[i]>highs[i+2];
    const fl = lows[i]<lows[i-1] && lows[i]<lows[i-2] && lows[i]<lows[i+1] && lows[i]<lows[i+2];
    if(isUp&&fh){ post=i; break; }
    if(!isUp&&fl){ post=i; break; }
  }
  if(post<0) return;

  const preP  = isUp? lows[pre] : highs[pre];
  const postP = isUp? highs[post] : lows[post];
  const r = Math.abs(postP-preP);
  const retrace = isUp? postP - r*0.618 : postP + r*0.618;
  const ext127  = isUp? postP + r*0.27  : postP - r*0.27;
  const ext1618 = isUp? postP + r*0.618 : postP - r*0.618;
  const ext2618 = isUp? postP + r*1.618 : postP - r*1.618;

  let touch=false, m127=false;
  for(let i=post+1;i<data.length;i++){
    if(isUp){ if(lows[i]<=retrace) touch=true; if(highs[i]>=ext127) m127=true; }
    else    { if(highs[i]>=retrace) touch=true; if(lows[i]<=ext127) m127=true; }
  }
  const level = touch? ext1618 : (!touch && !m127? ext127 : ext2618);

  // draw price line
  series.createPriceLine({ price: level, color: 'darkgreen', lineWidth:2, lineStyle:0, axisLabelVisible:true });

  // ensure target is in view: invisible zoom series
  if(!entry.zoomSeries){
    const zs = chart.addLineSeries({ color: 'rgba(0,0,0,0)', lineWidth:0 });
    entry.zoomSeries = zs;
  }
  entry.zoomSeries.setData([
    { time: data[0].time,           value: level },
    { time: data[data.length-1].time, value: level }
  ]);
}

// ─── draw EMA + probability overlay for daily ─────────────────────
function drawEMAandProbability(containerId) {
  const entry = charts[containerId]; if (!entry || !entry.emaArr) return;
  const { chart, data, emaArr } = entry;

  const lastClose = data[data.length-1].close;
  const lastEma   = emaArr[emaArr.length-1];
  const bullish   = lastClose > lastEma;
  const color     = bullish ? 'green' : 'red';
  const arrow     = bullish ? '▲' : '▼';
  const overlayId = containerId + '-prob';
  let overlay = document.getElementById(overlayId);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.style.position      = 'absolute';
    overlay.style.top           = '8px';
    overlay.style.left          = '8px';
    overlay.style.zIndex        = '20';
    overlay.style.fontSize      = '16px';
    overlay.style.fontWeight    = 'bold';
    overlay.style.whiteSpace    = 'pre';
    overlay.style.pointerEvents = 'none';
    document.getElementById(containerId).appendChild(overlay);
  }
  overlay.style.color = color;
  overlay.textContent = `${arrow}\nProbability - ${bullish? 'Bullish':'Bearish'}`;
}
