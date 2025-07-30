// utils.js

export const charts = {};
export let interestRates = {};

// 1) Caching
export function loadCache(){ /* … */ }
export function saveCache(d){ /* … */ }

// 2) Rate‑limit banner (axios interceptor)
import axios from 'axios';
let rateLimited = false;
axios.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 429 && !rateLimited) {
      rateLimited = true;
      document.getElementById('rateLimitBanner').style.display = 'block';
    }
    return Promise.reject(err);
  }
);

// 3) Config lists
export const cryptoSymbols   = [ /* … */ ];
export const forexSymbols    = [ /* … */ ];
export const equitiesSymbols = [ /* … */ ];
export const etfSymbols      = [ /* … */ ];
export const symbols         = [...cryptoSymbols, ...forexSymbols, ...equitiesSymbols, ...etfSymbols];

// 4) Symbol translations & rate data
export function toTDSymbol(sym){ /* … */ }
export async function loadInterestRates(){ /* … */ }
export function getPositiveCarryFX(){ /* … */ }

// 5) Indicators: EMA, SMA, RSI
export function ema(arr,p){ /* … */ }
export function sma(arr,p){ /* … */ }
export function rsi(arr,p){ /* … */ }

// 6) Projected return
export async function getProjectedAnnualReturn(sym){ /* … */ }

// 7) Fetch & draw the base chart
export async function fetchAndRender(symbol, interval, containerId){ /* … */ }

// 8) Annotations
export function drawFibsOnChart(cid){ /* … */ }
export function drawEMAandProbability(cid){ /* … */ }
export function drawRSIandSignal(cid, dailyBullish){ /* … */ }
