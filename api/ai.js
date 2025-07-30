// api/ai.js
import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "No prompt provided" });
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const chat = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You’re a concise market‑analysis assistant." },
        { role: "user",   content: prompt },
      ],
      temperature: 0.7,
    });
    const summary = chat.choices[0].message.content;
    res.status(200).json({ summary });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
