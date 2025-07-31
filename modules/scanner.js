import { getProjectedAnnualReturn } from './projectedReturns.js';
import { drawEMAandProbability, drawRSIandSignal } from './indicators.js';
import { drawFibsOnChart } from './fibs.js';
import { wireUpInvestInputs } from './portfolioInputs.js';
import { loadCandles } from './fetchCandles.js';
import { cryptoSymbols, forexSymbols, stockSymbols } from './symbols.js';

const SCANNER_LIMIT = 10;

export async function runScanner() {
  const filter = document.getElementById('scannerFilter').value.toLowerCase();
  const tableBody = document.querySelector('#scannerTable tbody');
  tableBody.innerHTML = '';

  const matches = [...cryptoSymbols, ...forexSymbols, ...stockSymbols]
    .filter(sym => sym.toLowerCase().includes(filter))
    .slice(0, SCANNER_LIMIT);

  for (const sym of matches) {
    const row = document.createElement('tr');
    const cagr = await getProjectedAnnualReturn(sym);
    const daily = await loadCandles(sym, '1d');
    const hourly = await loadCandles(sym, '1h');

    if (!cagr || daily.length < 60 || hourly.length < 60) continue;

    const dailyChart = LightweightCharts.createChart(document.getElementById('scannerTempDaily'), {
      width: 600, height: 300, layout: { backgroundColor: '#000', textColor: '#fff' }
    });

    const dailySeries = dailyChart.addCandlestickSeries();
    dailySeries.setData(daily);

    const { signal: emaSig } = drawEMAandProbability(dailyChart, daily);
    const { signal: rsiSig } = drawRSIandSignal(dailyChart, daily);
    const fibTarget = drawFibsOnChart(dailyChart, daily, true); // Simplified logic

    row.innerHTML = `
      <td>${sym}</td>
      <td>${emaSig || ''}</td>
      <td>${rsiSig || ''}</td>
      <td>${fibTarget ? fibTarget.toFixed(2) : ''}</td>
      <td><input type="number" class="amount-invested" placeholder="0.00" style="width:6em;text-align:right"/></td>
      <td><input type="number" class="amount-invested" placeholder="%" style="width:3.5em;text-align:right"/></td>
      ${Array.from({ length: 12 }).map((_, i) => `<td class="month-${i + 1}">-</td>`).join('')}
      <td class="five-year">-</td>
    `;

    tableBody.appendChild(row);
    wireUpInvestInputs(row, cagr);
  }
}
