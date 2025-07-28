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

// 5) Helper: EMA for price
function ema(arr, period) {
  const k = 2 / (period + 1);
  const out = [];
  let prev;
  for (let i = 0; i < arr.length; i++) {
    if (i === period - 1) {
      const sum = arr.slice(0, period).reduce((a,b)=>a+b,0);
      prev = sum/period;
      out[i] = prev;
    } else if (i >= period) {
      prev = arr[i]*k + prev*(1-k);
      out[i] = prev;
    } else out[i] = null;
  }
  return out;
}

// 5b) Helper: SMA for array
function sma(arr, period) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += arr[j];
    out.push(sum/period);
  }
  return out;
}

// 5c) Helper: RSI
function rsi(arr, period) {
  const gains = [], losses = [], out = [];
  for (let i = 1; i < arr.length; i++) {
    const diff = arr[i] - arr[i-1];
    gains.push(diff>0?diff:0);
    losses.push(diff<0?-diff:0);
  }
  let avgGain = gains.slice(0,period).reduce((a,b)=>a+b,0)/period;
  let avgLoss = losses.slice(0,period).reduce((a,b)=>a+b,0)/period;
  out[period] = 100 - (100/(1 + avgGain/avgLoss));
  for (let i = period+1; i < arr.length; i++) {
    avgGain = (avgGain*(period-1) + gains[i-1]) / period;
    avgLoss = (avgLoss*(period-1) + losses[i-1]) / period;
    out[i] = 100 - 100/(1 + avgGain/avgLoss);
  }
  return out;
}

// 6) AI summary
async function generateAISummary() {
  const sym = symbolSelect.value;
  outPre.textContent = `Loading AI summary for ${sym}…`;
  try {
    const resp = await axios.get('/api/ai',{ params:{ symbol:sym } });
    const summary = typeof resp.data==='string'?resp.data:
      resp.data.summary?resp.data.summary:
      resp.data.text?resp.data.text:
      JSON.stringify(resp.data,null,2);
    outPre.textContent = summary;
  } catch(e) {
    console.error(e);
    outPre.textContent = `❌ AI error: ${e.message}`;
  }
}
aiBtn.addEventListener('click', generateAISummary);

// 7) Update
async function updateDashboard() {
  const sym = symbolSelect.value;
  dailyTitle.textContent  = `${sym} — Daily`;
  hourlyTitle.textContent = `${sym} — 1 Hour`;
  await fetchAndDraw(sym,'daily','1d','dailyChart');
  await fetchAndDraw(sym,'hourly','1h','hourlyChart');
  drawFibsOnChart('dailyChart');
  drawFibsOnChart('hourlyChart');
  const bullishDaily = drawEMAandProbability('dailyChart');
  drawRSIandSignal('hourlyChart', bullishDaily);
  await generateAISummary();
}
symbolSelect.addEventListener('change',updateDashboard);
updateDashboard();

// fetch + draw
async function fetchAndDraw(symbol,type,interval,containerId) {
  const limit=1000;
  const resp=await axios.get('https://api.binance.com/api/v3/klines',{ params:{symbol,interval,limit} });
  const data=resp.data.map(k=>({time:k[0]/1000, open:+k[1], high:+k[2], low:+k[3], close:+k[4]}));
  const container=document.getElementById(containerId);
  container.innerHTML='';
  const chart=LightweightCharts.createChart(container,{ layout:{textColor:'#000'}, rightPriceScale:{scaleMargins:{top:0.3,bottom:0.1}}, timeScale:{timeVisible:true,secondsVisible:false} });
  const series=chart.addCandlestickSeries(); series.setData(data);
  charts[containerId]={chart,series,data};
  if(containerId==='dailyChart'){
    const closes=data.map(d=>d.close);
    const emaArr=ema(closes,45);
    const emaData=data.map((d,i)=>({time:d.time,value:emaArr[i]})).filter(pt=>pt.value!=null);
    const emaS=chart.addLineSeries({color:'orange',lineWidth:2}); emaS.setData(emaData);
    charts[containerId].emaArr=emaArr;
  }
}

// fibs auto-zoom
function drawFibsOnChart(containerId) {
  const e=charts[containerId]; if(!e) return;
  const{chart,series,data}=e;
  const opens=data.map(d=>d.open), highs=data.map(d=>d.high), lows=data.map(d=>d.low);
  const ma50=sma(opens,50), ma200=sma(opens,200);
  let lastGC=-1,lastDC=-1;
  for(let i=1;i<opens.length;i++){ if(ma50[i]>ma200[i]&&ma50[i-1]<=ma200[i-1]) lastGC=i; if(ma50[i]<ma200[i]&&ma50[i-1]>=ma200[i-1]) lastDC=i; }
  const isUp=lastGC>lastDC, idx=isUp?lastGC:lastDC; if(idx<0)return;
  let pre=idx,start=(isUp?lastDC:lastGC)>0?(isUp?lastDC:lastGC):0;
  for(let i=start;i<idx;i++){ if(isUp? lows[i]<lows[pre] : highs[i]>highs[pre]) pre=i; }
  let post=-1;
  for(let i=idx+2;i<data.length-2;i++){ const fh=highs[i]>highs[i-1]&&highs[i]>highs[i-2]&&highs[i]>highs[i+1]&&highs[i]>highs[i+2]; const fl=lows[i]<lows[i-1]&&lows[i]<lows[i-2]&&lows[i]<lows[i+1]&&lows[i]<lows[i+2]; if(isUp&&fh){post=i;break;} if(!isUp&&fl){post=i;break;} } if(post<0)return;
  const preP=isUp?lows[pre]:highs[pre], postP=isUp?highs[post]:lows[post], r=Math.abs(postP-preP);
  const retrace=isUp?postP-r*0.618:postP+r*0.618; const ext127=isUp?postP+r*0.27:postP-r*0.27; const ext618=isUp?postP+r*0.618:postP-r*0.618; const ext2618=isUp?postP+r*1.618:postP-r*1.618;
  let t=false,m=false; for(let i=post+1;i<data.length;i++){ if(isUp? lows[i]<=retrace: highs[i]>=retrace) t=true; if(isUp? highs[i]>=ext127: lows[i]<=ext127) m=true; }
  const level = t?ext618:(!t&&!m?ext127:ext2618);
  series.createPriceLine({price:level,color:'darkgreen',lineWidth:2,lineStyle:0,axisLabelVisible:true});
  if(!e.zoomSeries){ const zs=chart.addLineSeries({color:'rgba(0,0,0,0)',lineWidth:0}); e.zoomSeries=zs; }
  e.zoomSeries.setData([{time:data[0].time,value:level},{time:data[data.length-1].time,value:level}]);
}

// EMA & probability; returns bullishDaily boolean
function drawEMAandProbability(containerId) {
  const e=charts[containerId]; if(!e||!e.emaArr) return false;
  const {chart,data,emaArr} = e;
  const lastClose=data[data.length-1].close; const lastE=emaArr[emaArr.length-1];
  const bull= lastClose>lastE;
  // overlay inside chart
  const id=`${containerId}-prob`;
  let div=document.getElementById(id);
  if(!div){ div=document.createElement('div'); div.id=id; div.style.position='absolute'; div.style.top='8px'; div.style.left='8px'; div.style.zIndex='20'; div.style.fontSize='16px'; div.style.fontWeight='bold'; div.style.whiteSpace='pre'; div.style.pointerEvents='none'; document.getElementById(containerId).appendChild(div); }
  div.style.color=bull?'green':'red'; div.textContent=`${bull?'▲':'▼'}\nProbability - ${bull?'Bullish':'Bearish'}`;
  return bull;
}

// RSI & signal on H1
function drawRSIandSignal(containerId, bullishDaily) {
  if (!bullishDaily) bullishDaily = false;
  const e = charts[containerId]; if (!e) return;
  const { data } = e;
  // Calculate RSI(13)
  const closes = data.map(d => d.close);
  const rsiArr = rsi(closes, 13);
  // Calculate SMA(14) of RSI
  const rsiValid = rsiArr.filter(v => v !== null);
  const rsiMA = sma(rsiValid, 14);
  const lastIdx = rsiArr.length - 1;
  const lastR = rsiArr[lastIdx];
  const lastMA = rsiMA[rsiMA.length - 1];
  // Determine signal text
  let signalText, color;
  if (bullishDaily) {
    if (lastR < 50 && lastR > lastMA) {
      signalText = 'Buy Signal confirmed'; color = 'green';
    } else {
      signalText = 'Wait for Buy Signal'; color = 'gray';
    }
  } else {
    if (lastR > 50 && lastR < lastMA) {
      signalText = 'Sell Signal confirmed'; color = 'red';
    } else {
      signalText = 'Wait for Sell Signal'; color = 'gray';
    }
  }
  // Overlay on H1 chart upper-left
  const overlayId = containerId + '-rsi-signal';
  let div = document.getElementById(overlayId);
  if (!div) {
    div = document.createElement('div');
    div.id = overlayId;
    div.style.position      = 'absolute';
    div.style.top           = '8px';
    div.style.left          = '8px';
    div.style.zIndex        = '20';
    div.style.fontSize      = '16px';
    div.style.fontWeight    = 'bold';
    div.style.whiteSpace    = 'pre';
    div.style.pointerEvents = 'none';
    document.getElementById(containerId).appendChild(div);
  }
  div.style.color = color;
  div.textContent = `RSI: ${lastR.toFixed(2)}
${signalText}`;
}
