// /api/quotes.js
export default async function handler(req, res) {
  const { symbol, interval } = req.query;
  const apiKey = process.env.TWELVE_DATA_KEY; // Safe storage

  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&outputsize=500&apikey=${apiKey}`;

  const response = await fetch(url);
  const data = await response.json();

  res.status(200).json(data);
}
