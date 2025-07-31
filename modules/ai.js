// ai.js

export async function generateAISummary(symbol, {
  emaTrend,
  signal,
  dailyFibTarget,
  hourlyFibTarget,
  cagr
}) {
  const prompt = buildAIPrompt({
    symbol,
    emaTrend,
    signal,
    dailyFibTarget,
    hourlyFibTarget,
    cagr
  });

  const res = await fetch('/api/ai.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, prompt })
  });

  const json = await res.json();
  return json.summary || '';
}

function buildAIPrompt({
  symbol,
  emaTrend = 'unknown',
  signal = 'no signal',
  dailyFibTarget = 0,
  hourlyFibTarget = 0,
  cagr = 0
}) {
  return `
1. ${symbol} is currently in a ${emaTrend} state with recent price movements and investor sentiment driving market conditions.

2. The probability based on the 45‑EMA suggests a ${emaTrend} trend for ${symbol}.

3. The current signal for ${symbol} is: ${signal}.

4. The longer‑term Fibonacci target for ${symbol} on a daily timeframe is ${dailyFibTarget?.toFixed(2)}.

5. The short‑term Fibonacci target for ${symbol} on an hourly timeframe is ${hourlyFibTarget?.toFixed(2)}.

6. Major upcoming announcements or events, such as regulatory developments, institutional investments, or macroeconomic indicators, could impact ${symbol}'s price.

7. The projected annual return for ${symbol} is estimated at ${(cagr * 100).toFixed(2)}%.

8. ${symbol} is a trading pair that represents the exchange rate between a base and quote asset. Please describe its importance for trading strategies and market sentiment.
`.trim();
}
