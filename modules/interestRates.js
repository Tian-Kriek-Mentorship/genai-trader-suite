// interestRates.js — Load and analyze interest rate data

let interestRates = {};

export async function loadInterestRates() {
  try {
    const res = await fetch('/interestRates.json');
    interestRates = await res.json();
  } catch {
    interestRates = {};
  }
}

export function getInterestRates() {
  return interestRates;
}

export function getPositiveCarryFX(forexSymbols) {
  return forexSymbols.filter(sym => {
    const base = sym.slice(0, 3);
    const quote = sym.slice(3);
    return (interestRates[base] || 0) > (interestRates[quote] || 0);
  });
}
