// main.js

// ✅ Auth handshake with Ghost via postMessage
const allowedOrigins = ['https://tiankriek.com'];

window.addEventListener('message', (event) => {
  if (allowedOrigins.includes(event.origin) && event.data.email) {
    localStorage.setItem('gtm_user_email', event.data.email);
    location.reload(); // Refresh so init() sees the login
  }
});

setTimeout(() => {
  const email = localStorage.getItem('gtm_user_email');
  if (!email) {
    document.body.innerHTML = `
      <h2 style="text-align:center;margin-top:50px;font-family:sans-serif">
        Access denied. Please log in via <a href="https://tiankriek.com" target="_blank">tiankriek.com</a>
      </h2>`;
    throw new Error('Not logged in');
  }
}, 1500);




window.loggedInUserEmail = emailFromGhost;


// ✅ Modular Imports
import { loadCache, saveCache } from './modules/cache.js';
import { loadPortfolio, savePortfolio, userEmail } from './modules/portfolio.js';
import { runScanner } from './modules/scanner.js';
import { wireUpInvestInputs } from './modules/portfolioInputs.js';
import { getProjectedAnnualReturn } from './modules/projectedReturns.js';
import { loadInterestRates } from './modules/interestRates.js';
import { cryptoSymbols, forexSymbols, stockSymbols } from './modules/symbols.js';
import { generateAISummary } from './modules/ai.js';
import './modules/rateLimit.js';

document.addEventListener('DOMContentLoaded', async () => {
  const email = localStorage.getItem('gtm_user_email');
  if (!email) {
    document.body.innerHTML = `
      <h2 style="text-align:center;margin-top:50px;font-family:sans-serif">
        Access denied. Please log in via <a href="https://tiankriek.com" target="_blank">tiankriek.com</a>
      </h2>`;
    throw new Error('Not logged in');
  }

  window.loggedInUserEmail = email;

  // ✅ DOM Elements
  const symbolInput = document.getElementById('symbolInput');
  const datalistEl = document.getElementById('symbolDatalist');
  const aiBtn = document.getElementById('aiBtn');
  const scannerFilter = document.getElementById('scannerFilter');
  const scannerTable = document.getElementById('scannerTable');

  if (!symbolInput || !datalistEl || !scannerFilter || !scannerTable) {
    console.error('❌ Required DOM elements not found.');
    return;
  }

  const symbols = [...cryptoSymbols, ...forexSymbols, ...stockSymbols];

  function buildScannerHeader() {
    const header = scannerTable.querySelector('thead tr');
    if (!header) return;
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

  try {
    await loadInterestRates(); // You can disable this temporarily if API fails
  } catch (e) {
    console.warn('⚠️ Skipping interest rate fetch due to error:', e.message);
  }

  ['scannerTempDaily', 'scannerTempHourly'].forEach(id => {
    if (!document.getElementById(id)) {
      const d = document.createElement('div');
      d.id = id;
      d.style.display = 'none';
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

  const activeEmail = userEmail();
  if (activeEmail) {
    await loadPortfolio(activeEmail);
  }

  async function updateDashboard() {
    const sym = symbolInput.value;
    const cagr = await getProjectedAnnualReturn(sym);
    document.getElementById('scannerFilter').value = sym;
    await runScanner();
  }
});
