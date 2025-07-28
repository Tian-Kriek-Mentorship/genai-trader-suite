<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Liquidity‑Cycle Dashboard</title>
  <link rel="icon" href="/favicon.png" />
  <style>
    body {
      font-family: system-ui, sans-serif;
      font-size: 22px;
      margin: 2rem;
    }
    h1 { margin-bottom: 1rem; font-size: 32px; }
    h2 { margin-top: 2rem; font-size: 26px; }
    #dailyChart,
    #hourlyChart {
      max-width: 800px;
      height: 400px;
      margin-top: 1rem;
    }
    pre {
      white-space: pre-wrap;
      background: #f6f6f6;
      padding: 1rem;
      font-size: 20px;
      line-height: 1.5;
      max-width: 800px;
      margin-top: 0.5rem;
    }
    button {
      margin-bottom: 1rem;
      padding: 0.75rem 1.5rem;
      font-size: 20px;
      cursor: pointer;
      border: none;
      background-color: #1976d2;
      color: white;
      border-radius: 5px;
    }
    .explanation {
      font-size: 22px;
      line-height: 1.7;
      max-width: 800px;
      margin-top: 2rem;
    }
    .explanation ul {
      margin-top: 0.5rem;
      padding-left: 1.4rem;
    }
    .explanation li {
      margin-bottom: 0.75rem;
    }
  </style>
</head>
<body>
  <h1>Liquidity‑Cycle Dashboard (v0.1)</h1>

  <!-- Symbol selector -->
  <div style="margin-bottom: 1.5rem;">
    <label for="symbolSelect" style="font-size:22px; margin-right:0.5rem;">
      Select Symbol:
    </label>
    <select id="symbolSelect" style="font-size:20px; padding:0.3rem;">
      <!-- options populated by JS -->
    </select>
  </div>

  <!-- AI Summary -->
  <button id="aiBtn">AI Summary</button>
  <pre id="out"></pre>

  <!-- Charts -->
  <h2 id="dailyTitle">BTCUSDT — Daily</h2>
  <div id="dailyChart"></div>

  <h2 id="hourlyTitle">BTCUSDT — 1 Hour</h2>
  <div id="hourlyChart"></div>

  <!-- Explanation moved below charts -->
  <div class="explanation">
    <h3>❗ What Is the Liquidity‑Cycle Dashboard (v0.1)?</h3>
    <p>The Liquidity‑Cycle Dashboard helps traders understand where money is flowing in and out of the crypto market.</p>
    <p>Instead of watching dozens of charts or guessing when to trade, this dashboard shows you how Bitcoin (BTCUSDT) is behaving across two key timeframes:</p>
    <ul>
      <li>📅 <strong>Daily chart</strong> – the big picture trend</li>
      <li>🕐 <strong>Hourly chart</strong> – short-term moves</li>
    </ul>
    <p><strong>The goal?</strong><br>
    To spot shifts in momentum and liquidity – so you trade with the market, not against it.</p>

    <h4>Why It’s Called “Liquidity‑Cycle”</h4>
    <p>In every market, price moves in cycles – from accumulation to expansion, then slowdown and reversal. These cycles are driven by liquidity (where the money is). This dashboard makes it easier to:</p>
    <ul>
      <li>✅ See when buyers/sellers are taking control</li>
      <li>✅ Time entries during expansions, not chop</li>
      <li>✅ Avoid trades when liquidity dries up</li>
    </ul>

    <h4>What’s “v0.1”?</h4>
    <p>This is the first public version, focused only on BTC/USDT.<br>
    Future updates will include:</p>
    <ul>
      <li>📊 Trend strength indicators</li>
      <li>📈 Volume + momentum overlays</li>
      <li>🌍 Asset switching (ETH, SPX, DXY, etc.)</li>
      <li>🧠 AI summaries and alerts</li>
    </ul>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.8/dist/axios.min.js"></script>
  <script src="https://unpkg.com/lightweight-charts@4.0.0/dist/lightweight-charts.standalone.production.js"></script>
  <script src="/main.js"></script>
</body>
</html>
