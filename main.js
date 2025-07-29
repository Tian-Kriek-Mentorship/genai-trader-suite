// main.js

// ――― 1) Config & State ―――
const cryptoSymbols = [
  'BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT','ADAUSDT',
  'SOLUSDT','DOGEUSDT','DOTUSDT','MATICUSDT','AVAXUSDT'
];
const forexSymbols = [
  'EURUSD','GBPUSD','USDJPY','AUDUSD',
  'USDCAD','USDCHF','NZDUSD'
];
const symbols = [...cryptoSymbols, ...forexSymbols];

// read injected key
const TD_API_KEY = window.TD_API_KEY;

const tdCache = {};   // { "SYMBOL_interval": data[] }
const charts  = {};   // { containerId: { chart, series, data, … } }

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
  const k = 2/(p+1), out = [], n = arr.length; let prev;
  for (let i=0; i<n; i++) {
    if (i===p-1) {
      prev = arr.slice(0,p).reduce((a,b)=>a+b,0)/p;
      out[i] = prev;
    } else if (i>=p) {
      prev = arr[i]*k + prev*(1-k);
      out[i] = prev;
    } else out[i] = null;
  }
  return out;
}
function sma(arr, p) {
  const out = [];
  for (let i=0; i<arr.length; i++) {
    if (i < p-1) { out.push(null); continue; }
    let sum = 0; for (let j=i-p+1; j<=i; j++) sum += arr[j];
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

// ――― 4) fetchAndDraw (crypto vs FX) ―――
async function fetchAndDraw(symbol, _, interval, containerId) {
  let data;
  if (symbol.endsWith('USDT')) {
    const resp = await axios.get(
      'https://api.binance.com/api/v3/klines',
      { params: { symbol, interval, limit:1000 } }
    );
    data = resp.data.map(k => ({
      time:  k[0]/1000,
      open: +k[1], high:+k[2],
      low:  +k[3], close:+k[4]
    }));
  } else {
    const key = `${symbol}_${interval}`;
    if (tdCache[key]) {
      data = tdCache[key];
    } else {
      const tdInterval = interval === '1d' ? '1day' : '1h';
      const fxSym = symbol.slice(0,3) + '/' + symbol.slice(3);
      const resp = await axios.get(
        'https://api.twelvedata.com/time_series',
        {
          params: {
            symbol:     fxSym,
            interval:   tdInterval,
            outputsize: 500,
            apikey:     TD_API_KEY
          }
        }
      );
      const vals = resp.data.values || [];
      data = vals.map(v => ({
        time:  Math.floor(new Date(v.datetime).getTime()/1000),
        open:  +v.open,
        high:  +v.high,
        low:   +v.low,
        close: +v.close
      })).reverse();
      tdCache[key] = data;
    }
  }

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

// ――― 5) drawFibsOnChart + zoom ―――
function drawFibsOnChart(containerId){
  const e = charts[containerId];
  if (!e) return;
  const { chart, series, data } = e;
  const o=data.map(d=>d.open), h=data.map(d=>d.high), l=data.map(d=>d.low);
  const m50=sma(o,50), m200=sma(o,200);
  let gc=-1, dc=-1;
  for(let i=1;i<o.length;i++){
    if(m50[i]>m200[i]&&m50[i-1]<=m200[i-1]) gc=i;
    if(m50[i]<m200[i]&&m50[i-1]>=m200[i-1]) dc=i;
  }
  const up=gc>dc, idx=up?gc:dc;
  if(idx<0) return;
  let pre=idx, start=((up?dc:gc)>0?(up?dc:gc):0);
  for(let i=start;i<idx;i++){
    if(up?l[i]<l[pre]:h[i]>h[pre]) pre=i;
  }
  let post=-1;
  for(let i=idx+2;i<data.length-2;i++){
    const fh=h[i]>h[i-1]&&h[i]>h[i-2]&&h[i]>h[i+1]&&h[i]>h[i+2],
          fl=l[i]<l[i-1]&&l[i]<l[i-2]&&l[i]<l[i+1]&&l[i]<l[i+2];
    if(up&&fh){ post=i; break; }
    if(!up&&fl){ post=i; break; }
  }
  if(post<0) return;
  const preP=up?l[pre]:h[pre],
        postP=up?h[post]:l[post],
        r=Math.abs(postP-preP);
  const retr=up?postP-r*0.618:postP+r*0.618,
        e127=up?postP+r*0.27:postP-r*0.27,
        e618=up?postP+r*0.618:postP-r*0.618,
        e2618=up?postP+r*1.618:postP-r*1.618;
  let touched=false,moved127=false;
  for(let i=post+1;i<data.length;i++){
    if(up){ if(l[i]<=retr) touched=true; if(h[i]>=e127) moved127=true; }
    else  { if(h[i]>=retr) touched=true; if(l[i]<=e127) moved127=true; }
  }
  const level=touched?e618:(!touched&&!moved127?e127:e2618);
  series.createPriceLine({
    price:level, color:'darkgreen', lineWidth:2, axisLabelVisible:true
  });
  e.fibTarget=level;
  if(!e.zoomSeries){
    e.zoomSeries=chart.addLineSeries({ color:'rgba(0,0,0,0)', lineWidth:0 });
  }
  e.zoomSeries.setData([
    { time:data[0].time,            value:level },
    { time:data[data.length-1].time,value:level }
  ]);
}

// ――― 6) drawEMAandProbability ―――
function drawEMAandProbability(containerId){
  const e=charts[containerId];
  if(!e||!e.emaArr) return false;
  const lastC=e.data[e.data.length-1].close,
        lastE=e.emaArr[e.emaArr.length-1],
        bull=lastC>lastE,
        id=`${containerId}-prob`;
  let div=document.getElementById(id);
  if(!div){
    div=document.createElement('div');
    div.id=id;
    Object.assign(div.style,{
      position:'absolute',top:'8px',left:'8px',
      zIndex:'20',fontSize:'16px',fontWeight:'bold',
      whiteSpace:'pre',pointerEvents:'none'
    });
    document.getElementById(containerId).appendChild(div);
  }
  div.style.color=bull?'green':'red';
  div.textContent=`${bull?'▲':'▼'}\nProbability - ${bull?'Bullish':'Bearish'}`;
  return bull;
}

// ――― 7) drawRSIandSignal ―――
function drawRSIandSignal(containerId,bullish){
  const e=charts[containerId];
  if(!e) return null;
  const arr=rsi(e.data.map(d=>d.close),13),
        val=arr[arr.length-1],
        valid=arr.filter(v=>v!=null),
        maVal=sma(valid,14).slice(-1)[0];
  let txt,clr,rtn=null;
  if(bullish){
    if(val<50&&val>maVal){ txt='Buy Signal confirmed'; clr='green'; rtn=true; }
    else                  { txt='Wait for Buy Signal';    clr='gray';  }
  } else {
    if(val>50&&val<maVal){ txt='Sell Signal confirmed';clr='red';   rtn=false; }
    else                 { txt='Wait for Sell Signal';  clr='gray';  }
  }
  const id=`${containerId}-rsi`;
  let div=document.getElementById(id);
  if(!div){
    div=document.createElement('div');
    div.id=id;
    Object.assign(div.style,{
      position:'absolute',top:'8px',left:'8px',
      zIndex:'20',fontSize:'16px',fontWeight:'bold',
      whiteSpace:'pre',pointerEvents:'none'
    });
    document.getElementById(containerId).appendChild(div);
  }
  div.style.color=clr;
  div.textContent=`RSI: ${val.toFixed(2)}\n${txt}`;
  return rtn;
}

// ――― 8) runScanner ―――
async function runScanner(){
  scannerTbody.innerHTML='';
  const filter=scannerFilter.value.trim().toUpperCase();
  const list=filter
    ? symbols.filter(s=>s.includes(filter))
    : symbols;
  let count=0;
  for(const sym of list){
    if(!filter && count>=20) break;

    await fetchAndDraw(sym,'daily','1d','scannerTempDaily');
    const pb=drawEMAandProbability('scannerTempDaily');

    await fetchAndDraw(sym,'hourly','1h','scannerTempHourly');
    drawFibsOnChart('scannerTempHourly');
    const h1T=charts['scannerTempHourly'].fibTarget ?? '—';
    const sg=drawRSIandSignal('scannerTempHourly',pb);

    // if no filter, skip "Wait for signal"
    if(!filter && sg===null) continue;

    // format signal text/color
    let signalText, signalColor;
    if(sg===true) {
      signalText = 'Buy Signal confirmed';
      signalColor = 'green';
    } else if(sg===false) {
      signalText = 'Sell Signal confirmed';
      signalColor = 'red';
    } else {
      signalText = 'Wait for signal';
      signalColor = 'gray';
    }

    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${sym}</td>
      <td style="color:${pb?'green':'red'}">${pb?'Bullish':'Bearish'}</td>
      <td style="color:${signalColor}">${signalText}</td>
      <td>${typeof h1T==='number'?h1T.toFixed(4):h1T}</td>`;
    scannerTbody.append(tr);

    count++;
  }
}

// ――― 9) updateDashboard ―――
async function updateDashboard(){
  const sym=symbolSelect.value;
  dailyTitle.textContent=`${sym} — Daily`;
  hourlyTitle.textContent=`${sym} — 1 Hour`;
  await fetchAndDraw(sym,'daily','1d','dailyChart');
  await fetchAndDraw(sym,'hourly','1h','hourlyChart');
  drawFibsOnChart('dailyChart');
  drawFibsOnChart('hourlyChart');
  const bull=drawEMAandProbability('dailyChart');
  drawRSIandSignal('hourlyChart',bull);
  await generateAISummary();
  await runScanner();
}

// ――― 10) init ―――
(function init(){
  ['scannerTempDaily','scannerTempHourly'].forEach(id=>{
    if(!document.getElementById(id)){
      const d=document.createElement('div');
      d.id=id;
      d.style.display='none';
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

  symbolSelect.value=cryptoSymbols[0];
  symbolSelect.addEventListener('change',updateDashboard);
  aiBtn.addEventListener('click',generateAISummary);
  scannerFilter.addEventListener('input',runScanner);

  updateDashboard();
})();
