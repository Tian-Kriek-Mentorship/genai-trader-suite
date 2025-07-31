// portfolioInputs.js

import { savePortfolio, userEmail } from './api.js';

/**
 * Wires input events to dynamically calculate projected returns
 * and save the user's portfolio allocation via API.
 *
 * @param {HTMLElement} tr - The table row representing a symbol
 * @param {number} cagr - Compound Annual Growth Rate for the symbol
 */
export function wireUpInvestInputs(tr, cagr) {
  const amtInput = tr.querySelectorAll('.amount-invested')[0];
  const weightInput = tr.querySelectorAll('.amount-invested')[1];
  const symbol = tr.querySelector('td:first-child')?.textContent;

  amtInput.addEventListener('input', () => {
    const amt = Math.max(parseFloat(amtInput.value) || 0, 0);
    const weight = parseFloat(weightInput.value || 0);

    // Save to backend
    if (userEmail && symbol) savePortfolio(userEmail, symbol, amt, weight);

    // Calculate projected returns
    for (let i = 1; i <= 12; i++) {
      const cell = tr.querySelector(`.month-${i}`);
      cell.textContent = (amt * (Math.pow(1 + cagr, i / 12) - 1)).toFixed(2);
    }

    const fiveCell = tr.querySelector('.five-year');
    fiveCell.textContent = (amt * (Math.pow(1 + cagr, 5) - 1)).toFixed(2);
  });
}
