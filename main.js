// main.js

// ✅ Block access if not logged in via Ghost
if (!window.loggedInUserEmail) {
  document.body.innerHTML = `
    <h2 style="text-align:center;margin-top:50px;font-family:sans-serif">
      Access denied. Please log in via <a href="https://tiankriek.com" target="_blank">tiankriek.com</a>
    </h2>`;
  throw new Error('Not logged in');
}

// ✅ Modular Imports
import { loadCache, saveCache } from './modules/cache.js';
import { loadPortfolio, savePortfolio, userEmail } from './modules/portfolio.js';
import { runScanner } from './modules/scanner.js';
import { wireUpInvestInputs } from './modules/portfolioInputs.js';
import { getProjectedAnnualReturn } from './modules/projectedReturns.js';
import { loadInterestRates } from './modules/interestRates.js';
import { cryptoSymbols, forexSymbols, stockSymbols } from './modules/symbols.js';
import { generateAISummary } from './modules/ai.js';
import './modules/rateLimit.js'; // applies axios interceptor globally

// ✅ DOM Elements
const symbolInput = document.getElementById('symbolInput');
const datalistEl = document.getElementById('symbolDatalist');
const aiBtn = document.getElementById('aiBtn');
const scannerFilter = document.getElementById('scannerFilter');

// ✅ Combined symbols
const symbols = [...cryptoSymbols, ...forexSymbols, ...stockSymbols];

// ✅ Scanner table column headers
function buildScannerHeader() {
  const header = document.querySelector('#scannerTable thead tr');
  header.innerHTML = `
    <th>Symbol</th>
    <th>EMA Signal</th>
    <th>RSI Signal</th>
    <th>Target</th>
    <th>$ Invested</th>
    <th>% Weight</th>
    ${Array.from({ length: 12 }).map((_, i) => `<th class="month-${i + 1}">${new Date(0, i).toLocaleString('en', { month: 'short' })}</th>`).join('')}
    <th>5 Yr</th>
  `;
}

// ✅ Main Initialization
(async function init() {
  await loadInterestRates();

  // Dummy chart containers for internal analysis
  ['scannerTempDaily', 'scannerTempHourly'].forEach(id => {
    if (!document.getElementById(id)) {
      const d = document.createElement('div');
      d.id = id;
      d.style.display = 'none';
      document.body.appendChild(d);
    }
  });

  // Populate symbol dropdown
  symbols.forEach(s => {
    const o = document.createElement('option');
    o.value = s;
    datalistEl.appendChild(o);
  });

  buildScannerHeader();

  // Default selection
  symbolInput.value = cryptoSymbols[0];
  symbolInput.addEventListener('input', () => {
    if (symbols.includes(symbolInput.value)) updateDashboard();
  });

  aiBtn.addEventListener('click', generateAISummary);
  scannerFilter.addEventListener('input', runScanner);

  await updateDashboard();

  if (userEmail) {
    await loadPortfolio(userEmail);
  }
})();

// ✅ Update Dashboard based on selected symbol
async function updateDashboard() {
  const sym = symbolInput.value;
  const cagr = await getProjectedAnnualReturn(sym);
  document.getElementById('scannerFilter').value = sym;
  await runScanner();
}
