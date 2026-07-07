export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { prompt } = req.body || {};
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "API key missing" });
    }

    const system = `
You are a CAD floorplan generator.
Return ONLY valid JSON (no markdown, no explanation).
Schema:
{
  "walls": [{"x1":0,"y1":0,"x2":10,"y2":0,"thickness":16}],
  "doors": [{"wallIndex":0,"position":2,"width":3}],
  "windows": [{"wallIndex":0,"position":6,"width":4}],
  "meta": {"units":"ft"}
}
All numbers must be numeric. Provide enough walls to form rooms.
`.trim();

    const user = `Generate a simple 2D floorplan for: ${prompt}`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-ultra-550b-a55b:free",
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
      }),
    });

    const data = await response.json();

    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({ error: "No content from AI", raw: data });
    }

    // Remove ```json fences if model returns them
    const cleaned = content.replace(/```json|```/g, "").trim();

    let plan;
    try {
      plan = JSON.parse(cleaned);
    } catch (e) {
      return res.status(502).json({
        error: "AI did not return valid JSON",
        content: cleaned,
      });
    }

    return res.status(200).json(plan);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}