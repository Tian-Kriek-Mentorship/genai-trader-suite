import { loadCache, saveCache } from './cache.js';
import { savePortfolio, loadPortfolio } from './portfolio.js';
import {
  cryptoSymbols, forexSymbols, equitiesSymbols, etfSymbols,
  symbols, scanSymbols, API_KEY
} from './config.js';
import {
  symbolInput, datalistEl, dailyTitle, hourlyTitle,
  aiBtn, outPre, scannerFilter, scannerTbody
} from './dom.js';
import { buildScannerHeader } from './scannerHeader.js';
import { ema, sma, rsi } from './math.js';
import { loadInterestRates, getPositiveCarryFX } from './interestRates.js';
import { getProjectedAnnualReturn } from './projectedReturns.js';
import { fetchAndRender, charts } from './charting.js';
import { drawFibsOnChart } from './drawFibs.js';
import { drawEMAandProbability, drawRSIandSignal } from './drawIndicators.js';
import { generateAISummary } from './aiSummary.js';
import { runScanner, wireUpInvestInputs } from './scanner.js';
import { updateDashboard } from './dashboard.js';

// --- Init logic (was in init.js)
(async function init(){
  await loadInterestRates();

  ['scannerTempDaily','scannerTempHourly'].forEach(id => {
    if (!document.getElementById(id)) {
      const d = document.createElement('div');
      d.id = id; d.style.display = 'none';
      document.body.appendChild(d);
    }
  });

  symbols.forEach(s => {
    const o = document.createElement('option');
    o.value = s;
    datalistEl.appendChild(o);
  });

  buildScannerHeader();

  symbolInput.value = cryptoSymbols[0];
  symbolInput.addEventListener('input', () => {
    if (symbols.includes(symbolInput.value)) updateDashboard();
  });
  aiBtn.addEventListener('click', generateAISummary);
  scannerFilter.addEventListener('input', runScanner);

  await updateDashboard();

  if (window.loggedInUserEmail) {
    await loadPortfolio(window.loggedInUserEmail);
  }
})();
