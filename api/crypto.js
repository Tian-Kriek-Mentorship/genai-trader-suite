// /api/crypto.js
export default async function handler(req, res) {
  const symbol = req.query.symbol || "bitcoin";
  const days = req.query.days || "1";
  const url = `https://api.coingecko.com/api/v3/coins/${symbol}/market_chart?vs_currency=usd&days=${days}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: "Failed to fetch from CoinGecko" });
    }

    const raw = await response.json();
    // raw.prices is an array of [timestamp, price]
    const formatted = raw.prices.map(p => ({
      time: Math.floor(p[0] / 1000),
      value: p[1]
    }));

    res.setHeader("Cache-Control", "s-maxage=60");
    return res.status(200).json({ candles: formatted });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
