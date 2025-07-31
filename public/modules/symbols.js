// symbols.js

// Sample lists – expand or replace with your actual assets
export const cryptoSymbols = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT',
];

export const forexSymbols = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD',
];

export const stockSymbols = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA',
];

// Optionally: merge them if you need a combined list elsewhere
export const allSymbols = [...cryptoSymbols, ...forexSymbols, ...stockSymbols];
