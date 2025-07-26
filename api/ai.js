/* ---------- api/ai.js ---------- */
export default async function handler(req, res) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content:
              'Give a 60‑word macro‑liquidity summary for crypto traders today.',
          },
        ],
        max_tokens: 120,
      }),
    }).then(r => r.json());

    res.status(200).json({ text: response.choices[0].message.content });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
