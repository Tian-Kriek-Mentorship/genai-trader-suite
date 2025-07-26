/* ---------- api/ai.js ---------- */
export default async function handler(req, res) {
  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',          // swap to 'gpt-3.5-turbo' if 4o-mini is not enabled
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

    /* ---- HANDLE OPENAI ERRORS GRACEFULLY ---- */
    if (openaiRes.error) {
      // forward the error message to the client
      return res.status(502).json({ error: openaiRes.error.message });
    }

    const text = openaiRes.choices?.[0]?.message?.content || 'No text returned.';
    return res.status(200).json({ text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
