// /api/crypto.js

export default async function handler(req, res) {
  const symbol = req.query.symbol || "bitcoin";
  const days = req.query.days || "1";
  const url = `https://api.coingecko.com/api/v3/coins/${symbol}/ohlc?vs_currency=usd&days=${days}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to fetch from CoinGecko" });
    }

    const raw = await response.json();
    const formatted = raw.map(candle => ({
      time: Math.floor(candle[0] / 1000),
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
    }));

    res.setHeader("Cache-Control", "s-maxage=60"); // cache for 1 minute
    return res.status(200).json({ candles: formatted });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
