// main.js

// ――― 0) Caching Layer ―――
const CACHE = {};                     // { key: { ts: timestamp_ms, data: [...] } }
const TTL_MS = 30 * 60 * 1000;        // 30 minutes
function isStale(entry) {
  return !entry || (Date.now() - entry.ts) > TTL_MS;
}

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
  if (cryptoSymbols.includes(sym))      return null;
  if (forexSymbols.includes(sym))       return `${sym.slice(0,3)}/${sym.slice(3)}`;
  if (equitiesSymbols.includes(sym) ||
      etfSymbols.includes(sym))         return sym;
  return sym;
}

function ema(arr,p){
  const k=2/(p+1), out=[], n=arr.length; let prev;
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
    let sum=0; for(let j=i-p+1;j<=i;j++) sum+=arr[j];
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
    avgG = (avgG*(p-1) + gains[i-1]) / p;
    avgL = (avgL*(p-1) + losses[i-1]) / p;
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
    interestRates = {};
  }
}
function getPositiveCarryFX(){
  return forexSymbols.filter(sym=>{
    const b=sym.slice(0,3), q=sym.slice(3);
    return interestRates[b] > interestRates[q];
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
      const first=parseFloat(d[0][4]), last=parseFloat(d[d.length-1][4]);
      const yrs=(d.length-1)/12, cagr=Math.pow(last/first,1/yrs)-1;
      return projCache[sym]=cagr;
    } catch(e){ return projCache[sym]=null; }
  }
  try {
    const tdSym=toTDSymbol(sym);
    const resp=await axios.get('https://api.twelvedata.com/time_series',{params:{
      symbol:tdSym,interval:'1month',outputsize:60,apikey:API_KEY
    }});
    let vals=resp.data.values||[];
    vals=vals.slice().reverse();
    const first=parseFloat(vals[0].close), last=parseFloat(vals[vals.length-1].close);
    const yrs=(vals.length-1)/12, cagr=Math.pow(last/first,1/yrs)-1;
    return projCache[sym]=cagr;
  } catch(e){ return projCache[sym]=null; }
}

// ――― 6) fetchAndDraw ―――
async function fetchAndDraw(symbol,_,interval,containerId){
  let data=[];
  const key = `${symbol}_${interval}`;
  if(cryptoSymbols.includes(symbol)){
    if(!isStale(CACHE[key])){
      data = CACHE[key].data;
    } else {
      const resp = await axios.get('https://api.binance.com/api/v3/klines',{params:{
        symbol,interval,limit:1000
      }});
      data = resp.data.map(k=>({
        time:k[0]/1000,open:+k[1],high:+k[2],low:+k[3],close:+k[4]
      }));
      CACHE[key]={ts:Date.now(),data};
    }
  } else {
    if(!isStale(CACHE[key])){
      data = CACHE[key].data;
    } else {
      const tdSym=toTDSymbol(symbol), tdInt=interval==='1d'?'1day':'1h';
      const resp=await axios.get('https://api.twelvedata.com/time_series',{params:{
        symbol:tdSym,interval:tdInt,outputsize:2200,apikey:API_KEY
      }});
      const vals=resp.data.values||[];
      data=vals.map(v=>({
        time:Math.floor(new Date(v.datetime).getTime()/1000),
        open:+v.open,high:+v.high,low:+v.low,close:+v.close
      })).reverse();
      CACHE[key]={ts:Date.now(),data};
    }
  }
  const c=document.getElementById(containerId);
  c.innerHTML='';
  const chart=LightweightCharts.createChart(c,{
    layout:{textColor:'#000'},
    rightPriceScale:{scaleMargins:{top:0.3,bottom:0.1}},
    timeScale:{timeVisible:true,secondsVisible:false}
  });
  const series=chart.addCandlestickSeries();
  series.setData(data);
  charts[containerId]={chart,series,data};

  if(interval==='1d'){
    const arr=ema(data.map(d=>d.close),45),
          ed=data.map((d,i)=>({time:d.time,value:arr[i]})).filter(p=>p.value!=null);
    chart.addLineSeries({color:'orange',lineWidth:2}).setData(ed);
    charts[containerId].emaArr=arr;
  }
  if(interval==='1h'){
    const opens=data.map(d=>d.open),
          s50=sma(opens,50),s200=sma(opens,200),
          d50=data.map((d,i)=>({time:d.time,value:s50[i]})).filter(p=>p.value!=null),
          d200=data.map((d,i)=>({time:d.time,value:s200[i]})).filter(p=>p.value!=null);
    chart.addLineSeries({color:'blue',lineWidth:2}).setData(d50);
    chart.addLineSeries({color:'black',lineWidth:2}).setData(d200);
    charts[containerId].sma50=s50;charts[containerId].sma200=s200;
  }
}

// ――― 7) drawFibsOnChart (auto‑recycle) ―――
function drawFibsOnChart(cid) {
  const e = charts[cid];
  if (!e || !e.data || e.data.length < 7) return;
  const { chart, series, data } = e;

  // 1) Determine direction via 50/200 SMA cross on opens
  const opens = data.map(d=>d.open);
  const m50 = sma(opens,50), m200 = sma(opens,200);
  let lastGC = -1, lastDC = -1;
  for (let i=1; i<opens.length; i++) {
    if (m50[i]>m200[i] && m50[i-1]<=m200[i-1]) lastGC = i;
    if (m50[i]<m200[i] && m50[i-1]>=m200[i-1]) lastDC = i;
  }
  const isUp    = lastGC > lastDC;
  const cross   = isUp ? lastGC : lastDC;
  if (cross < 2) return;

  // 2) Helpers to find pre/post pivots
  const findPre = (start, end) => {
    let idx = end;
    for (let i=start; i<=end; i++) {
      if (isUp ? data[i].low  < data[idx].low
               : data[i].high > data[idx].high) {
        idx = i;
      }
    }
    return idx;
  };
  const findPost = from => {
    for (let i=from+2; i<data.length-2; i++) {
      const fh = data[i].high>data[i-1].high && data[i].high>data[i-2].high
              && data[i].high>data[i+1].high && data[i].high>data[i+2].high;
      const fl = data[i].low <data[i-1].low  && data[i].low <data[i-2].low
              && data[i].low <data[i+1].low  && data[i].low <data[i+2].low;
      if (isUp && fh) return i;
      if (!isUp && fl) return i;
    }
    return -1;
  };

  // 3) Initial pivots
  const startIdx = isUp
    ? (lastDC>0 ? lastDC : 0)
    : (lastGC>0 ? lastGC : 0);
  let preIdx  = findPre(startIdx, cross);
  let postIdx = findPost(cross);
  if (postIdx < 0) return;

  // 4) Compute target function
  const computeTarget = (pIdx, qIdx) => {
    const p0 = isUp ? data[pIdx].low  : data[pIdx].high;
    const p1 = isUp ? data[qIdx].high : data[qIdx].low;
    const range = Math.abs(p1 - p0);
    const lvl = isUp
      ? { retr: p1 - 0.618*range, ext127: p1 + 0.27*range, ext618: p1 + 0.618*range, ext2618: p1 + 1.618*range }
      : { retr: p1 + 0.618*range, ext127: p1 - 0.27*range, ext618: p1 - 0.618*range, ext2618: p1 - 1.618*range };
    // decide which extension
    let touched = false, moved127 = false;
    for (let i=qIdx+1; i<data.length; i++) {
      if (isUp) {
        if (data[i].low  <= lvl.retr)  touched = true;
        if (data[i].high >= lvl.ext127) moved127 = true;
      } else {
        if (data[i].high >= lvl.retr)  touched = true;
        if (data[i].low  <= lvl.ext127) moved127 = true;
      }
    }
    return touched
      ? lvl.ext618
      : (!touched && !moved127)
        ? lvl.ext127
        : lvl.ext2618;
  };

  // 5) Roll forward while last close has taken the current target
  let target = computeTarget(preIdx, postIdx);
  const lastClose = data[data.length-1].close;
  while ((isUp && lastClose >= target) || (!isUp && lastClose <= target)) {
    // shift pivots forward
    preIdx  = postIdx;
    postIdx = findPost(preIdx);
    if (postIdx < 0) break;
    target = computeTarget(preIdx, postIdx);
  }

  // 6) Remove old line (if any), draw new
  if (e._fibLineId) {
    series.removePriceLine(e._fibLineId);
  }
  const line = series.createPriceLine({
    price:            target,
    color:            'darkgreen',
    lineWidth:        2,
    axisLabelVisible: true,
    title:            `Fibonacci Target: ${target.toFixed(4)}`
  });
  e._fibLineId = line.id;

  // 7) Extend chart scale so target is visible
  if (!e._zoom) {
    e._zoom = chart.addLineSeries({ color:'transparent', lineWidth:0 });
  }
  e._zoom.setData([
    { time: data[0].time,             value: target },
    { time: data[data.length-1].time, value: target }
  ]);
  e.fibTarget = target;
}

// ――― 8) drawEMAandProbability ―――
function drawEMAandProbability(cid){
  const e=charts[cid]; 
  if(!e||!e.data||!e.emaArr||!e.emaArr.length) return false;
  const lastC=e.data[e.data.length-1].close,
        lastE=e.emaArr[e.emaArr.length-1],
        bull=lastC>lastE,
        id=`${cid}-prob`;
  let div=document.getElementById(id);
  if(!div){
    div=document.createElement('div'); div.id=id;
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

// ――― 9) drawRSIandSignal ―――
function drawRSIandSignal(cid,dailyBullish){
  const e=charts[cid]; if(!e||!e.data) return null;
  const arr=rsi(e.data.map(d=>d.close),13),
        val=arr[arr.length-1],
        valid=arr.filter(v=>v!=null),
        maVal=sma(valid,14).slice(-1)[0];
  let text,color,signal=null;
  if(dailyBullish){
    if(val<50&&val>maVal){ text='Buy Signal confirmed'; color='green'; signal=true; }
    else                  { text='Wait for Buy Signal';   color='gray';  }
  } else {
    if(val>50&&val<maVal){ text='Sell Signal confirmed'; color='red';   signal=false; }
    else                  { text='Wait for Sell Signal';  color='gray';  }
  }
  const id=`${cid}-rsi`;
  let div=document.getElementById(id);
  if(!div){
    div=document.createElement('div'); div.id=id;
    Object.assign(div.style,{
      position:'absolute',top:'28px',left:'8px',
      zIndex:'20',fontSize:'16px',fontWeight:'bold',
      whiteSpace:'pre',pointerEvents:'none'
    });
    document.getElementById(cid).appendChild(div);
  }
  div.style.color=color;
  div.textContent=`RSI: ${val.toFixed(2)}\n${text}`;
  return signal;
}

// ――― 10) generateAISummary ―――
async function generateAISummary(){
  const sym=symbolInput.value;
  outPre.textContent=`Loading AI summary for ${sym}…`;
  const bull=drawEMAandProbability('dailyChart'),
        sig =drawRSIandSignal('hourlyChart',bull),
        tgt =charts.hourlyChart?.fibTarget??'—';
  let avgRet='N/A';
  try {
    const tdSym=toTDSymbol(sym)||sym;
    const resp=await axios.get('https://api.twelvedata.com/time_series',{params:{
      symbol:tdSym,interval:'1month',outputsize:60,apikey:API_KEY
    }});
    let vals=resp.data.values||[];
    vals=vals.slice().reverse();
    if(vals.length>1){
      const rets=[];
      for(let i=1;i<vals.length;i++){
        const p=parseFloat(vals[i-1].close),c=parseFloat(vals[i].close);
        rets.push((c/p-1)*100);
      }
      avgRet=`${(rets.reduce((a,b)=>a+b,0)/rets.length).toFixed(2)}%`;
    }
  } catch(e){}
  const prompt=`
Symbol: ${sym}
Probability (45‑EMA): ${bull?'Bullish':'Bearish'}
H1 Signal: ${sig?'Buy Signal confirmed':'Wait for signal'}
Fibonacci Target: ${tgt}
Average monthly return (last 5 years): ${avgRet}

Write a concise analysis covering:
1. The current state of ${sym} and overall market sentiment.
2. Major upcoming announcements or events that could impact it.
3. How the probability, H1 signal, and target fit into this context.
`;
  try {
    const ai=await axios.post('/api/ai',{prompt});
    outPre.textContent=ai.data.summary||ai.data.text||JSON.stringify(ai.data,null,2);
  } catch(e){
    outPre.textContent=`❌ AI error: ${e.message}`;
  }
}

// ――― 11) Scanner ―――
// ――― runScanner (dedup + clean returns) ―――
async function runScanner(){
  scannerTbody.innerHTML = '';
  const filter = scannerFilter.value.trim().toUpperCase();
  let list = filter
    ? symbols.filter(s => s.includes(filter))
    : symbols.slice();  // copy so we can mutate

  // dedupe
  const seen = new Set();
  list = list.filter(s => {
    if (seen.has(s)) return false;
    seen.add(s);
    return true;
  });

  const carry = getPositiveCarryFX();
  let count = 0;

  for (const sym of list) {
    // if no filter, limit to first 20
    if (!filter && count >= 20) break;

    // Daily
    await fetchAndDraw(sym, null, '1d', 'scannerTempDaily');
    const pb = drawEMAandProbability('scannerTempDaily');

    // Hourly
    await fetchAndDraw(sym, null, '1h', 'scannerTempHourly');
    drawFibsOnChart('scannerTempHourly');
    const h1T = charts.scannerTempHourly?.fibTarget ?? '—';
    const sg  = drawRSIandSignal('scannerTempHourly', pb);

    // Skip only when daily is BEARISH and there's no sell signal
    if (!filter && sg === null && pb === false) continue;

    // Build status text
    let statusText, statusColor;
    if (sg === true) {
      statusText  = 'Buy Signal confirmed';
      statusColor = 'green';
    } else if (sg === false) {
      statusText  = 'Sell Signal confirmed';
      statusColor = 'red';
    } else {
      statusText  = pb ? 'Wait for Buy Signal' : 'Wait for Sell Signal';
      statusColor = 'gray';
    }

    // Projected return
    let proj = '—';
    if (
      cryptoSymbols.includes(sym) ||
      equitiesSymbols.includes(sym) ||
      etfSymbols.includes(sym)   ||
      carry.includes(sym)
    ) {
      const cagr = await getProjectedAnnualReturn(sym);
      // guard against NaN
      if (typeof cagr === 'number' && !isNaN(cagr)) {
        proj = `${(cagr*100).toFixed(2)}%`;
      } else {
        proj = 'N/A';
      }
    }

    // Append row
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${sym}</td>
      <td style="color:${pb?'green':'red'}">${pb?'Bullish':'Bearish'}</td>
      <td style="color:${statusColor}">${statusText}</td>
      <td>${typeof h1T==='number' ? h1T.toFixed(4) : h1T}</td>
      <td style="text-align:right;">${proj}</td>
    `;
    scannerTbody.append(tr);
    count++;
  }
}



// ――― 12) Update Dashboard ―――
async function updateDashboard(){
  const sym=symbolInput.value; if(!symbols.includes(sym)) return;
  dailyTitle.textContent=`${sym} — Daily`;
  hourlyTitle.textContent=`${sym} — 1 Hour`;
  await fetchAndDraw(sym,null,'1d','dailyChart');
  await fetchAndDraw(sym,null,'1h','hourlyChart');
  drawFibsOnChart('dailyChart');
  drawFibsOnChart('hourlyChart');
  const bull=drawEMAandProbability('dailyChart');
  drawRSIandSignal('hourlyChart',bull);
  await generateAISummary();
  await runScanner();
}

// ――― 13) init ―――
(async function init(){
  await loadInterestRates();
  ['scannerTempDaily','scannerTempHourly'].forEach(id=>{
    const d=document.createElement('div'); d.id=id; d.style.display='none';
    document.body.appendChild(d);
  });
  symbols.forEach(s=>{
    const o=document.createElement('option'); o.value=s;
    datalistEl.appendChild(o);
  });
  symbolInput.value=cryptoSymbols[0];
  symbolInput.addEventListener('input',()=>{ if(symbols.includes(symbolInput.value)) updateDashboard(); });
  aiBtn.addEventListener('click',generateAISummary);
  scannerFilter.addEventListener('input',runScanner);
  updateDashboard();
})();
