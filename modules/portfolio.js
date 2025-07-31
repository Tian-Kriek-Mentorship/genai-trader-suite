// portfolio.js — save/load user portfolio via PHP API

export async function savePortfolio(email, symbol, amount_invested, portfolio_weight) {
  await fetch('https://tiankriekmentorship.com/api/savePortfolio.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, symbol, amount_invested, portfolio_weight })
  });
}

export async function loadPortfolio(email) {
  const res = await fetch(`https://tiankriekmentorship.com/api/loadPortfolio.php?email=${email}`);
  const json = await res.json();
  if (json.status !== 'success') return;

  json.portfolios.forEach(p => {
    const tr = Array.from(document.querySelectorAll('#scannerTable tbody tr'))
      .find(row => row.querySelector('td:first-child')?.textContent === p.symbol);
    if (tr) {
      const amtInput = tr.querySelectorAll('.amount-invested')[0];
      const weightInput = tr.querySelectorAll('.amount-invested')[1];
      amtInput.value = p.amount_invested;
      weightInput.value = p.portfolio_weight;
      amtInput.dispatchEvent(new Event('input'));
    }
  });
}
