import { savePortfolio } from './api.js';

export function wireUpInvestInputs(tr, cagr) {
  const amtInput = tr.querySelectorAll('.amount-invested')[0];
  const weightInput = tr.querySelectorAll('.amount-invested')[1];
  const symbol = tr.querySelector('td:first-child')?.textContent;
  const email = window.loggedInUserEmail;

  function updateCells() {
    const amt = Math.max(parseFloat(amtInput.value) || 0, 0);
    const weight = parseFloat(weightInput.value || 0);

    for (let i = 1; i <= 12; i++) {
      const cell = tr.querySelector(`.month-${i}`);
      cell.textContent = (amt * (Math.pow(1 + cagr, i / 12) - 1)).toFixed(2);
    }
    const fiveCell = tr.querySelector('.five-year');
    fiveCell.textContent = (amt * (Math.pow(1 + cagr, 5) - 1)).toFixed(2);

    if (email && symbol) savePortfolio(email, symbol, amt, weight);
  }

  amtInput.addEventListener('input', updateCells);
  weightInput.addEventListener('input', updateCells);
}
