// init.js

(async function init(){
  await loadInterestRates();

  // Create hidden chart divs for scanner rendering
  ['scannerTempDaily','scannerTempHourly'].forEach(id => {
    if (!document.getElementById(id)) {
      const d = document.createElement('div');
      d.id = id; d.style.display = 'none';
      document.body.appendChild(d);
    }
  });

  // Populate datalist with symbols
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
