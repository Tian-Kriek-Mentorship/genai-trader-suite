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

// ――― 3) Helper functions ―――
function toTDSymbol(sym) {
  if (cryptoSymbols.includes(sym)) return null;
  if (forexSymbols.includes(sym))   return `${sym.slice(0,3)}/${sym.slice(3)}`;
  return sym;
}

function ema(arr,p){ /* same as before */ }
function sma(arr,p){ /* same as before */ }
function rsi(arr,p){ /* same as before */ }

// ――― 4) Interest rates ―――
async function loadInterestRates(){ /* same as before */ }
function getPositiveCarryFX(){ /* same as before */ }

// ――― 5) Projected Annual Return ―――
async function getProjectedAnnualReturn(sym){ /* same as before */ }

// ――― 6) fetchAndDraw (simplified Binance) ―――
async function fetchAndDraw(symbol, _, interval, containerId) {
  let data = [];

  if (cryptoSymbols.includes(symbol)) {
    // single 1000‑bar Binance request
    try {
      const resp = await axios.get(
        'https://api.binance.com/api/v3/klines',
        { params: { symbol, interval, limit: 1000 } }
      );
      data = resp.data.map(k => ({
        time:  k[0] / 1000,
        open:  +k[1],
        high:  +k[2],
        low:   +k[3],
        close: +k[4],
      }));
    } catch (e) {
      console.error('Binance fetch error for', symbol, e);
    }

  } else {
    // Twelve Data for FX / Stocks / ETFs
    const tdSym = toTDSymbol(symbol),
          key   = `${tdSym}_${interval}`;
    if (tdCache[key]) {
      data = tdCache[key];
    } else {
      try {
        const tdInt = interval === '1d' ? '1day' : '1h';
        const resp = await axios.get(
          'https://api.twelvedata.com/time_series',
          { params: {
              symbol:     tdSym,
              interval:   tdInt,
              outputsize: 2200,
              apikey:     API_KEY
          } }
        );
        const vals = resp.data.values || [];
        data = vals.map(v => ({
          time:  Math.floor(new Date(v.datetime).getTime() / 1000),
          open:  +v.open,
          high:  +v.high,
          low:   +v.low,
          close: +v.close
        })).reverse();
      } catch (e) {
        console.error('Twelve Data fetch error for', tdSym, e);
      }
      tdCache[key] = data;
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
    const arr = ema(data.map(d => d.close), 45);
    const ed  = data
      .map((d, i) => ({ time: d.time, value: arr[i] }))
      .filter(p => p.value != null);
    const emaSer = chart.addLineSeries({ color: 'orange', lineWidth: 2 });
    emaSer.setData(ed);
    charts[containerId].emaArr = arr;
  }

  // 50 & 200 SMA on H1
  if (interval === '1h') {
    const opens = data.map(d => d.open);
    const s50 = sma(opens, 50);
    const s200= sma(opens,200);
    const d50  = data.map((d,i)=>({ time:d.time, value:s50[i] }))
                    .filter(p=>p.value!=null);
    const d200 = data.map((d,i)=>({ time:d.time, value:s200[i] }))
                    .filter(p=>p.value!=null);
    const ls50 = chart.addLineSeries({ color:'blue',  lineWidth:2 });
    const ls200= chart.addLineSeries({ color:'black', lineWidth:2 });
    ls50.setData(d50);
    ls200.setData(d200);
    charts[containerId].sma50 = s50;
    charts[containerId].sma200= s200;
  }
}

// ――― 7) drawFibsOnChart ―――
function drawFibsOnChart(cid) {
  const e=charts[cid];
  if(!e||!e.data||e.data.length<5) return;
  const {chart,series,data}=e;
  const o=data.map(d=>d.open);
  const m50=sma(o,50), m200=sma(o,200);

  let lastGC=-1, lastDC=-1;
  for(let i=1;i<o.length;i++){
    if(m50[i]>m200[i]&&m50[i-1]<=m200[i-1]) lastGC=i;
    if(m50[i]<m200[i]&&m50[i-1]>=m200[i-1]) lastDC=i;
  }
  const inUp=lastGC>lastDC, cross=inUp?lastGC:lastDC;
  if(cross<2) return;

  let pre=cross;
  const start=inUp?(lastDC>0?lastDC:0):(lastGC>0?lastGC:0);
  for(let i=start;i<=cross;i++){
    if(inUp){
      if(data[i].low<data[pre].low) pre=i;
    } else {
      if(data[i].high>data[pre].high) pre=i;
    }
  }

  let post=-1;
  for(let i=cross+2;i<data.length-2;i++){
    const fh=data[i].high>data[i-1].high&&data[i].high>data[i-2].high&&
             data[i].high>data[i+1].high&&data[i].high>data[i+2].high;
    const fl=data[i].low<data[i-1].low&&data[i].low<data[i-2].low&&
             data[i].low<data[i+1].low&&data[i].low<data[i+2].low;
    if(inUp&&fh){ post=i; break; }
    if(!inUp&&fl){ post=i; break; }
  }
  if(post<0) return;

  const p0=inUp?data[pre].low:data[pre].high;
  const p1=inUp?data[post].high:data[post].low;
  const r=Math.abs(p1-p0);
  const lvl=inUp
    ? {retr:p1-r*0.618,ext127:p1+r*0.27,ext618:p1+r*0.618,ext2618:p1+r*1.618}
    : {retr:p1+r*0.618,ext127:p1-r*0.27,ext618:p1-r*0.618,ext2618:p1-r*1.618};

  let touched=false,moved127=false;
  for(let i=post+1;i<data.length;i++){
    if(inUp){
      if(data[i].low<=lvl.retr) touched=true;
      if(data[i].high>=lvl.ext127) moved127=true;
    } else {
      if(data[i].high>=lvl.retr) touched=true;
      if(data[i].low<=lvl.ext127) moved127=true;
    }
  }
  const target=touched?lvl.ext618:(!touched&&!moved127?lvl.ext127:lvl.ext2618);

  series.createPriceLine({
    price:            target,
    color:            'darkgreen',
    lineWidth:        2,
    axisLabelVisible: true,
    title:            `Fibonacci Target: ${target.toFixed(4)}`
  });
  e.fibTarget=target;

  if(!e.zoomSeries){
    e.zoomSeries=chart.addLineSeries({color:'transparent',lineWidth:0});
  }
  e.zoomSeries.setData([
    {time:data[0].time,          value:target},
    {time:data[data.length-1].time,value:target}
  ]);
}

// ――― 8) drawEMAandProbability ―――
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

// ――― 9) drawRSIandSignal ―――
function drawRSIandSignal(cid,dailyBullish){
  const e=charts[cid];
  if(!e||!e.data) return null;
  if(dailyBullish){
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

// ――― 10) generateAISummary ―――
async function generateAISummary(){
  const sym=symbolInput.value;
  outPre.textContent=`Loading AI summary for ${sym}…`;
  const bull=drawEMAandProbability('dailyChart');
  const sig=drawRSIandSignal('hourlyChart',bull);
  const tgt=charts.hourlyChart?.fibTarget;
  let avgRet='N/A';
  try{
    const tdSym=toTDSymbol(sym)||sym;
    const r=await axios.get('https://api.twelvedata.com/time_series',{params:{
      symbol:tdSym,interval:'1month',outputsize:60,apikey:API_KEY
    }});
    const vals=r.data.values||[], rets=[];
    for(let i=1;i<vals.length;i++){
      const p=parseFloat(vals[i-1].close),c=parseFloat(vals[i].close);
      rets.push((c/p-1)*100);
    }
    avgRet=`${(rets.reduce((a,b)=>a+b,0)/rets.length).toFixed(2)}%`;
  }catch(e){ console.error(e); }
  const prompt=`
Symbol: ${sym}
Probability (45‑EMA): ${bull?'Bullish':'Bearish'}
H1 Signal: ${sig===true?'Buy Signal confirmed':sig===false?'Sell Signal confirmed':'Wait for signal'}
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
    console.error(e);
    outPre.textContent=`❌ AI error: ${e.message}`;
  }
}

// ――― 11) runScanner ―――
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
    const sg=drawRSIandSignal('scannerTempHourly',pb);
    if(!filter&&sg===null) continue;
    let st,sc;
    if(sg===true){ st='Buy Signal confirmed'; sc='green'; }
    else if(sg===false){ st='Sell Signal confirmed'; sc='red'; }
    else               { st='Wait for signal';      sc='gray';}
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

// ――― 12) updateDashboard ―――
async function updateDashboard(){
  const sym=symbolInput.value;
  if(!symbols.includes(sym)) return;
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

// ――― 13) init ―――
(async function init(){
  await loadInterestRates();
  ['scannerTempDaily','scannerTempHourly'].forEach(id=>{
    const d=document.createElement('div');
    d.id=id; d.style.display='none';
    document.body.appendChild(d);
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
