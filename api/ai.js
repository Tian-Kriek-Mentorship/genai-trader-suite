// api/ai.js
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // Ensure this is set in your server environment
});

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { symbol, prompt } = req.body;

    if (!symbol || !prompt) {
      return res.status(400).json({ error: 'Missing symbol or prompt' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a market analyst. Write an expert trading summary for the given symbol.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const summary = completion.choices[0]?.message?.content?.trim();
    res.status(200).json({ symbol, summary });
  } catch (err) {
    console.error('AI Summary Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
