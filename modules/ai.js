// ai.js

const aiEndpoint = '/api/ai';

/**
 * Calls your serverless OpenAI backend and injects AI summary into the page.
 */
export async function generateAISummary() {
  const input = document.getElementById('symbolInput');
  const symbol = input?.value || '';
  if (!symbol) return;

  const output = document.getElementById('aiSummary');
  if (output) {
    output.innerHTML = `<div style="margin-top:1em;font-style:italic">⏳ Generating summary for <b>${symbol}</b>...</div>`;
  }

  const prompt = `
You are a professional trading assistant providing a structured, concise market summary for ${symbol}.
Your response should be a numbered list covering the following points:

1. The overall trend and sentiment.
2. Signal from the 45 EMA (bullish, bearish, or neutral).
3. Any TradingView-style signal (buy, sell, or wait).
4. Long-term Fibonacci target (daily timeframe).
5. Short-term Fibonacci target (hourly timeframe).
6. Key upcoming events or macroeconomic factors to watch.
7. Projected annual return as a percentage.
8. A brief explanation of what ${symbol} is and how it trades.

Use short paragraphs and write in plain English.
`;

  try {
    const res = await fetch(aiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, prompt })
    });

    const json = await res.json();
    const summary = json?.summary || '⚠️ No summary returned.';

    if (output) {
      output.innerHTML = `<div style="margin-top:1em"><b>🧠 AI Summary for ${symbol}</b><br/><br/>${summary}</div>`;
    }
  } catch (e) {
    console.error('AI Summary Error:', e);
    if (output) {
      output.innerHTML = `<div style="margin-top:1em;color:red">⚠️ Failed to generate AI summary. Please try again later.</div>`;
    }
  }
}
