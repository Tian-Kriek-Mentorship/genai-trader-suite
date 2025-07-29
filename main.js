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

// ――― 3) Helpers ―――
function toTDSymbol(sym) {
  // Crypto: we use Binance
  if (cryptoSymbols.includes(sym)) return null;
  // Forex: X/Y format
  if (forexSymbols.includes(sym)) return `${sym.slice(0,3)}/${sym.slice(3)}`;
  // US Equities & ETFs on NYSE/NASDAQ: append .US
  if (equitiesSymbols.includes(sym) || etfSymbols.includes(sym)) {
    return `${sym}.US`;
  }
  // Otherwise, pass through
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
    console.error('Failed to load interest rates', e);
    interestRates = {};
  }
}
function getPositiveCarryFX(){
  return forexSymbols.filter(sym=>{
    const b=sym.slice(0,3), q=sym.slice(3);
    const rb=interestRates[b], rq=interestRates[q];
    return typeof rb==='number' && typeof rq==='number' && rb>rq;
  });
}

// ――― 5) Projected Annual Return ―――
async function getProjectedAnnualReturn(sym){
  if(projCache[sym]!==undefined) return projCache[sym];

  if(cryptoSymbols.includes(sym)){
    // Binance returns oldest→newest
    try {
      const r = await axios.get('https://api.binance.com/api/v3/klines',{params:{
        symbol:sym,interval:'1M',limit:60
      }});
      const d = r.data;
      if(!d.length){ projCache[sym]=null; return null; }
      const first=parseFloat(d[0][4]);
      const last =parseFloat(d[d.length-1][4]);
      const yrs  =(d.length-1)/12;
      const cagr=Math.pow(last/first,1/yrs)-1;
      projCache[sym]=cagr; return cagr;
    } catch(e){
      console.error(`Binance CAGR error ${sym}`, e);
      projCache[sym]=null; return null;
    }
  }

  // Twelve Data: FX/Stocks/ETFs
  try {
    const tdSym = toTDSymbol(sym);
    const resp  = await axios.get('https://api.twelvedata.com/time_series',{params:{
      symbol:tdSym,interval:'1month',outputsize:60,apikey:API_KEY
    }});
    let vals = resp.data.values||[];
    // reverse → oldest→newest
    vals = vals.slice().reverse();
    if(vals.length<2){ projCache[sym]=null; return null; }
    const first=parseFloat(vals[0].close);
    const last =parseFloat(vals[vals.length-1].close);
    const yrs  =(vals.length-1)/12;
    const cagr=Math.pow(last/first,1/yrs)-1;
    projCache[sym]=cagr; return cagr;
  } catch(e){
    console.error(`TD CAGR error ${sym}`, e);
    projCache[sym]=null; return null;
  }
}

// ――― 6) fetchAndDraw ―――
async function fetchAndDraw(symbol,_,interval,containerId){
  let data=[];

  if(cryptoSymbols.includes(symbol)){
    // Binance (1000 bars)
    try {
      const resp = await axios.get('https://api.binance.com/api/v3/klines',{
        params:{symbol,interval,limit:1000}
      });
      data = resp.data.map(k=>({
        time: k[0]/1000,
        open:+k[1],high:+k[2],
        low:+k[3], close:+k[4]
      }));
    } catch(e){
      console.error('Binance fetch error',symbol,e);
    }

  } else {
    // Twelve Data
    const tdSym = toTDSymbol(symbol),
          key   = `${tdSym}_${interval}`;
    if(tdCache[key]){
      data = tdCache[key];
    } else {
      try {
        const tdInt = interval==='1d'?'1day':'1h';
        const resp = await axios.get('https://api.twelvedata.com/time_series',{params:{
          symbol:tdSym,interval:tdInt,outputsize:2200,apikey:API_KEY
        }});
        const vals = resp.data.values||[];
        data = vals.map(v=>({
          time:Math.floor(new Date(v.datetime).getTime()/1000),
          open:+v.open,high:+v.high,low:+v.low,close:+v.close
        })).reverse();
      } catch(e){
        console.error('Twelve Data fetch error',tdSym,e);
      }
      tdCache[key] = data;
    }
  }

  // draw
  const c = document.getElementById(containerId);
  c.innerHTML = '';
  const chart = LightweightCharts.createChart(c,{
    layout:{textColor:'#000'},
    rightPriceScale:{scaleMargins:{top:0.3,bottom:0.1}},
    timeScale:{timeVisible:true,secondsVisible:false}
  });
  const series = chart.addCandlestickSeries();
  series.setData(data);
  charts[containerId] = {chart,series,data};

  // 45‑EMA on daily
  if(interval==='1d'){
    const closes=data.map(d=>d.close),
          arr=ema(closes,45),
          ed=data.map((d,i)=>({time:d.time,value:arr[i]})).filter(p=>p.value!=null),
          ls=chart.addLineSeries({color:'orange',lineWidth:2});
    ls.setData(ed);
    charts[containerId].emaArr=arr;
  }

  // 50/200 SMA on H1
  if(interval==='1h'){
    const opens=data.map(d=>d.open),
          s50=sma(opens,50),
          s200=sma(opens,200),
          d50=data.map((d,i)=>({time:d.time,value:s50[i]})).filter(p=>p.value!=null),
          d200=data.map((d,i)=>({time:d.time,value:s200[i]})).filter(p=>p.value!=null),
          ls50=chart.addLineSeries({color:'blue',lineWidth:2}),
          ls200=chart.addLineSeries({color:'black',lineWidth:2});
    ls50.setData(d50); ls200.setData(d200);
    charts[containerId].sma50=s50;
    charts[containerId].sma200=s200;
  }
}

// ――― 7) drawFibsOnChart ―――
function drawFibsOnChart(cid){
  const e=charts[cid];
  if(!e||!e.data||e.data.length<5) return;
  const {chart,series,data} = e;

  const o=data.map(d=>d.open),
        m50=sma(o,50), m200=sma(o,200);

  let lastGC=-1, lastDC=-1;
  for(let i=1;i<o.length;i++){
    if(m50[i]>m200[i]&&m50[i-1]<=m200[i-1]) lastGC=i;
    if(m50[i]<m200[i]&&m50[i-1]>=m200[i-1]) lastDC=i;
  }
  const inUp=lastGC>lastDC, cross=inUp?lastGC:lastDC;
  if(cross<2) return;

  let pre=cross,
      start = inUp?(lastDC>0?lastDC:0):(lastGC>0?lastGC:0);
  for(let i=start;i<=cross;i++){
    if(inUp){
      if(data[i].low<data[pre].low) pre=i;
    } else {
      if(data[i].high>data[pre].high) pre=i;
    }
  }

  let post=-1;
  for(let i=cross+2;i<data.length-2;i++){
    const fh=data[i].high>data[i-1].high && data[i].high>data[i-2].high
           && data[i].high>data[i+1].high && data[i].high>data[i+2].high;
    const fl=data[i].low<data[i-1].low && data[i].low<data[i-2].low
           && data[i].low<data[i+1].low && data[i].low<data[i+2].low;
    if(inUp&&fh){ post=i; break; }
    if(!inUp&&fl){ post=i; break; }
  }
  if(post<0) return;

  const p0=inUp?data[pre].low:data[pre].high,
        p1=inUp?data[post].high:data[post].low,
        r =Math.abs(p1-p0),
        lvl=inUp
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
  const target = touched
    ? lvl.ext618
    : (!touched&&!moved127)
      ? lvl.ext127
      : lvl.ext2618;

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
    {time:data[0].time,            value:target},
    {time:data[data.length-1].time,value:target}
  ]);
}

// ――― 8) drawEMAandProbability ―――
function drawEMAandProbability(cid){
  const e=charts[cid];
  if(!e||!e.data||!e.emaArr) return false;
  const lastC=e.data[e.data.length-1].close;
  const lastE=e.emaArr[e.emaArr.length-1];
  const bull = lastC>lastE;
  const id   = `${cid}-prob`;
  let div    = document.getElementById(id);
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
  const arr=rsi(e.data.map(d=>d.close),13);
  const val=arr[arr.length-1];
  const valid=arr.filter(v=>v!=null);
  const maVal=sma(valid,14).slice(-1)[0];
  let text,color,signal=null;
  if(dailyBullish){
    // only buy signals
    if(val<50&&val>maVal){
      text='Buy Signal confirmed'; color='green'; signal=true;
    } else {
      text='Wait for Buy Signal'; color='gray';
    }
  } else {
    if(val>50&&val<maVal){
      text='Sell Signal confirmed'; color='red'; signal=false;
    } else {
      text='Wait for Sell Signal'; color='gray';
    }
  }
  const id=`${cid}-rsi`;
  let div=document.getElementById(id);
  if(!div){
    div=document.createElement('div');
    div.id=id;
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
  const bull=drawEMAandProbability('dailyChart');
  const sig =drawRSIandSignal('hourlyChart',bull);
  const tgt =charts.hourlyChart?.fibTarget??'—';

  let avgRet='N/A';
  try{
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
  } catch(e){ console.error('Avg monthly error',e); }

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
  try{
    const ai=await axios.post('/api/ai',{prompt});
    outPre.textContent=ai.data.summary||ai.data.text||JSON.stringify(ai.data,null,2);
  } catch(e){
    console.error('AI error',e);
    outPre.textContent=`❌ AI error: ${e.message}`;
  }
}

// ――― 11) Scanner ―――
async function runScanner(){
  scannerTbody.innerHTML='';
  const filter=scannerFilter.value.trim().toUpperCase();
  const list=filter?symbols.filter(s=>s.includes(filter)):symbols;
  const carry=getPositiveCarryFX();
  let count=0;
  for(const sym of list){
    if(!filter&&count>=20) break;
    await fetchAndDraw(sym,null,'1d','scannerTempDaily');
    const pb=drawEMAandProbability('scannerTempDaily');
    await fetchAndDraw(sym,null,'1h','scannerTempHourly');
    drawFibsOnChart('scannerTempHourly');
    const h1T=charts.scannerTempHourly?.fibTarget??'—';
    const sg=drawRSIandSignal('scannerTempHourly',pb);
    if(!filter&&sg===null) continue;
    let st,sc;
    if(sg===true){ st='Buy Signal confirmed';  sc='green'; }
    else if(sg===false){ st='Sell Signal confirmed'; sc='red'; }
    else { st='Wait for signal'; sc='gray'; }
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
  symbolInput.addEventListener('input',()=>{
    if(symbols.includes(symbolInput.value)) updateDashboard();
  });
  aiBtn.addEventListener('click',generateAISummary);
  scannerFilter.addEventListener('input',runScanner);
  updateDashboard();
})();
