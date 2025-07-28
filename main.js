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

// 3) Keep a map of charts & their data
const charts = {};  // will hold charts[containerId] = { series, data }

// 4) Populate the symbol dropdown
symbols.forEach(sym => {
  const opt = document.createElement('option');
  opt.value = sym;
  opt.text  = sym.replace('USDT','/USDT');
  symbolSelect.appendChild(opt);
});

// 5) AI‑summary (unchanged)
async function generateAISummary() {
  const sym = symbolSelect.value;
  outPre.textContent = `Loading AI summary for ${sym}…`;
  try {
    const resp = await axios.get('/api/ai', { params:{ symbol: sym } });
    let summary = (
      typeof resp.data==='string' ? resp.data :
      resp.data.summary          ? resp.data.summary :
      resp.data.text             ? resp.data.text :
      JSON.stringify(resp.data, null, 2)
    );
    outPre.textContent = summary;
  } catch (e) {
    console.error(e);
    outPre.textContent = `❌ AI error: ${e.message}`;
  }
}
aiBtn.addEventListener('click', generateAISummary);

// 6) Main dashboard updater
async function updateDashboard() {
  const sym = symbolSelect.value;
  dailyTitle.textContent  = `${sym} — Daily`;
  hourlyTitle.textContent = `${sym} — 1 Hour`;

  // draw both charts (fills charts[...])
  await fetchAndDraw(sym,'daily','1d','dailyChart');
  await fetchAndDraw(sym,'hourly','1h','hourlyChart');

  // now draw fibs on each
  drawFibsOnChart('dailyChart');
  drawFibsOnChart('hourlyChart');

  // and finally AI summary
  await generateAISummary();
}
symbolSelect.addEventListener('change', updateDashboard);
updateDashboard();

// ─── fetch + draw candlesticks ────────────────────────────────────
async function fetchAndDraw(symbol, type, interval, containerId) {
  const end   = Date.now();
  const start = end - (type==='daily'
    ? 365*24*3600*1000
    :   7 *24*3600*1000);
  const limit = type==='daily'?365:168;

  const resp = await axios.get(
    'https://api.binance.com/api/v3/klines',{
      params:{ symbol, interval, startTime:start, endTime:end, limit }
    }
  );
  const data = resp.data.map(k=>({
    time:  k[0]/1000,
    open:  +k[1],
    high:  +k[2],
    low:   +k[3],
    close: +k[4]
  }));

  const container = document.getElementById(containerId);
  container.innerHTML = '';  // clear old

  // create chart & series
  const chart = LightweightCharts.createChart(container, {
    layout:{ textColor:'#000' },
    rightPriceScale:{ scaleMargins:{top:0.1,bottom:0.1} },
    timeScale:{ timeVisible:true, secondsVisible:false }
  });
  const series = chart.addCandlestickSeries();
  series.setData(data);

  // stash for later
  charts[containerId] = { series, data };
}

// ─── draw your Fibonacci logic ────────────────────────────────────
function drawFibsOnChart(containerId) {
  const entry = charts[containerId];
  if (!entry) return;
  const { series, data } = entry;

  // simple SMA helper
  function sma(arr, period) {
    const out = [];
    for (let i=0; i<arr.length; i++) {
      if (i < period-1) { out.push(null); continue; }
      let sum=0;
      for (let j=i-period+1; j<=i; j++) sum += arr[j];
      out.push(sum/period);
    }
    return out;
  }

  const opens = data.map(d=>d.open);
  const highs = data.map(d=>d.high);
  const lows  = data.map(d=>d.low);

  const ma50  = sma(opens, 50);
  const ma200 = sma(opens,200);

  // find last cross
  let lastGC=-1, lastDC=-1;
  for (let i=1; i<opens.length; i++) {
    if (ma50[i]>ma200[i] && ma50[i-1]<=ma200[i-1]) lastGC=i;
    if (ma50[i]<ma200[i] && ma50[i-1]>=ma200[i-1]) lastDC=i;
  }
  const isUp = lastGC > lastDC;
  const crossIdx = isUp ? lastGC : lastDC;
  if (crossIdx < 0) return;

  // pre‑swing index
  let preIdx = crossIdx;
  const startIdx = (isUp ? lastDC : lastGC) > 0 ? (isUp ? lastDC : lastGC) : 0;
  for (let i=startIdx; i<crossIdx; i++) {
    if (isUp ? lows[i]<lows[preIdx] : highs[i]>highs[preIdx]) {
      preIdx = i;
    }
  }

  // post‑fractal index
  let postIdx = -1;
  for (let i=crossIdx+2; i<data.length-2; i++) {
    const isFractHigh = highs[i] > highs[i-1] && highs[i] > highs[i-2]
                     && highs[i] > highs[i+1] && highs[i] > highs[i+2];
    const isFractLow  = lows[i]  < lows[i-1]  && lows[i]  < lows[i-2]
                     && lows[i]  < lows[i+1]  && lows[i]  < lows[i+2];
    if (isUp && isFractHigh) { postIdx = i; break; }
    if (!isUp && isFractLow)  { postIdx = i; break; }
  }
  if (postIdx < 0) return;

  const prePrice  = isUp ? lows[preIdx] : highs[preIdx];
  const postPrice = isUp ? highs[postIdx] : lows[postIdx];
  const range     = Math.abs(postPrice - prePrice);

  // levels
  const retrace = isUp ? postPrice - range*0.618 : postPrice + range*0.618;
  const ext127  = isUp ? postPrice + range*0.27  : postPrice - range*0.27;
  const ext1618 = isUp ? postPrice + range*0.618 : postPrice - range*0.618;
  const ext2618 = isUp ? postPrice + range*1.618 : postPrice - range*1.618;

  // scan forward
  let touchedRetrace=false, movedExt127=false;
  for (let i=postIdx+1; i<data.length; i++) {
    if (isUp) {
      if (lows[i] <= retrace)   touchedRetrace = true;
      if (highs[i] >= ext127)   movedExt127   = true;
    } else {
      if (highs[i] >= retrace)  touchedRetrace = true;
      if (lows[i]  <= ext127)   movedExt127   = true;
    }
  }

  // pick level
  let level, color;
  if (touchedRetrace) {
    level = ext1618; color = 'lime';
  } else if (!touchedRetrace && !movedExt127) {
    level = ext127;  color = 'orangered';
  } else {
    level = ext2618; color = 'deeppink';
  }

  // draw it
  series.createPriceLine({
    price:           level,
    color,
    lineWidth:       2,
    lineStyle:       0,
    axisLabelVisible:true
  });
}
