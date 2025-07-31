// api.js

// ✅ Ghost-authenticated user
export const userEmail = window.loggedInUserEmail || null;

// ✅ Save portfolio entry to server
export async function savePortfolio(email, symbol, amount_invested, portfolio_weight) {
  try {
    await fetch('https://tiankriekmentorship.com/api/savePortfolio.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, symbol, amount_invested, portfolio_weight })
    });
  } catch (e) {
    console.warn('Failed to save portfolio:', e);
  }
}

// ✅ Fetch saved portfolio from server (pure function)
export async function fetchPortfolio(email) {
  try {
    const res = await fetch(`https://tiankriekmentorship.com/api/loadPortfolio.php?email=${email}`);
    const json = await res.json();
    return json.status === 'success' ? json.portfolios : [];
  } catch (e) {
    console.error('Failed to fetch portfolio:', e);
    return [];
  }
}

// ✅ Populate table using loaded data
export function populatePortfolioTable(portfolios) {
  portfolios.forEach(p => {
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
